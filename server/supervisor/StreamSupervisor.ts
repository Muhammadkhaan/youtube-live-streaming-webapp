import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  StreamConfig,
  StreamRuntimeState,
  StreamStatus,
  MediaAsset,
} from '../db/schema';
import { db } from '../db';
import { ProcessManager } from './ProcessManager';
import { HealthMonitor } from './HealthMonitor';
import { RecoveryManager } from './RecoveryManager';
import { ResourceManager } from './ResourceManager';
import { MediaAnalyzer } from './MediaAnalyzer';
import { FfmpegCommandBuilder } from './FfmpegCommandBuilder';
import { PreflightCheckResult, isValidTransition } from './types';
import { ReconciliationManager } from './ReconciliationManager';
import { resolveFfmpegPath } from '../utils/ffmpegPaths';

const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

export class StreamSupervisor {
  private static instance: StreamSupervisor;

  private runtimeStates = new Map<string, StreamRuntimeState>();
  private processManager = new ProcessManager();
  private healthMonitor = new HealthMonitor();
  private recoveryManager = new RecoveryManager();
  private telemetrySubscribers = new Set<(event: any) => void>();
  private monitorInterval: NodeJS.Timeout | null = null;

  public static getInstance(): StreamSupervisor {
    if (!StreamSupervisor.instance) {
      StreamSupervisor.instance = new StreamSupervisor();
    }
    return StreamSupervisor.instance;
  }

  private constructor() {
    this.startHealthCheckLoop();
  }

  // Starts the background health check ticker (every 1.5s for precise telemetry)
  private startHealthCheckLoop() {
    this.monitorInterval = setInterval(() => {
      for (const [streamId, state] of this.runtimeStates.entries()) {
        if (state.status === 'LIVE' || state.status === 'DEGRADED' || state.status === 'CONNECTING') {
          this.healthMonitor.updateUptime(state);

          // Check for stream stall
          const stallStatus = this.healthMonitor.checkStreamStall(state);
          if (stallStatus === 'STALLED') {
            console.warn(`[StreamSupervisor] Stream ${streamId} stalled. Marking for reconnect...`);
            this.handleStreamCrash(streamId, 'Ingest socket stalled (no progress from FFmpeg)');
          } else if (stallStatus === 'DEGRADED' && state.status === 'LIVE') {
            this.transitionState(streamId, 'DEGRADED');
          } else if (stallStatus === 'OK' && state.status === 'DEGRADED') {
            this.transitionState(streamId, 'LIVE');
          }

          // Broadcast stats update
          this.broadcastTelemetry({
            type: 'stream.stats',
            streamId,
            data: {
              status: state.status,
              fps: state.fps,
              bitrate: state.bitrate,
              speed: state.speed,
              uptimeSeconds: state.uptimeSeconds,
              lastProgressTime: state.lastProgressTime,
              retryAttempt: state.retryAttempt,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, 1500);
  }

  public async initialize(): Promise<void> {
    await ReconciliationManager.reconcileOnStartup(this, this.processManager);
  }

  // Ensures a runtime state object exists for a stream
  private getOrCreateRuntimeState(streamId: string): StreamRuntimeState {
    let state = this.runtimeStates.get(streamId);
    if (!state) {
      state = {
        streamId,
        status: 'IDLE',
        uptimeSeconds: 0,
        restartCount: 0,
        retryAttempt: 0,
        recentLogs: [],
      };
      this.runtimeStates.set(streamId, state);
    }
    return state;
  }

  // State Machine Transition Handler
  public transitionState(streamId: string, toStatus: StreamStatus, errorMsg?: string): boolean {
    const state = this.getOrCreateRuntimeState(streamId);
    const fromStatus = state.status;

    if (!isValidTransition(fromStatus, toStatus)) {
      console.warn(`[StreamSupervisor] Invalid transition for ${streamId}: ${fromStatus} -> ${toStatus}`);
    }

    state.status = toStatus;
    if (errorMsg) {
      state.lastError = errorMsg;
    }

    if (toStatus === 'LIVE') {
      state.lastConnectedAt = new Date().toISOString();
      this.recoveryManager.resetRetryCount(state);
    }

    this.broadcastTelemetry({
      type: 'stream.state',
      streamId,
      data: {
        from: fromStatus,
        to: toStatus,
        lastError: errorMsg,
      },
      timestamp: new Date().toISOString(),
    });

    db.addStreamEvent({
      streamId,
      level: toStatus === 'FAILED' ? 'CRITICAL' : toStatus === 'RECONNECTING' || toStatus === 'DEGRADED' ? 'WARNING' : 'INFO',
      type: `STREAM_STATUS_${toStatus}`,
      message: `Stream transitioned from ${fromStatus} to ${toStatus}${errorMsg ? `: ${errorMsg}` : ''}`,
    });

    return true;
  }

  // Preflight validation checks before starting a stream
  public async preflightCheck(config: StreamConfig): Promise<PreflightCheckResult> {
    const checks: PreflightCheckResult['checks'] = [];
    let allPassed = true;

    // 1. Media exists and readable
    const videoBasename = path.basename(config.videoFilename);
    const videoPath = path.join(UPLOADS_DIR, videoBasename);
    const mediaExists = fs.existsSync(videoPath);
    checks.push({
      name: 'Media Asset Verification',
      passed: mediaExists,
      message: mediaExists ? `Media file "${videoBasename}" is verified on disk.` : `Media file "${videoBasename}" was not found.`,
    });
    if (!mediaExists) allPassed = false;

    // 2. FFmpeg Binary Verification
    const ffmpegPath = resolveFfmpegPath();
    checks.push({
      name: 'FFmpeg Broadcast Engine',
      passed: !!ffmpegPath,
      message: ffmpegPath ? `FFmpeg engine active (${ffmpegPath.includes('node_modules') ? 'Bundled static binary' : 'System PATH'}).` : 'FFmpeg is not installed or available on this server.',
    });
    if (!ffmpegPath) allPassed = false;

    // 3. Destination and Stream Key verification
    const hasKey = !!(config.streamKey || (config.destinations && config.destinations.length > 0));
    checks.push({
      name: 'Destination & Stream Key',
      passed: hasKey,
      message: hasKey ? 'Destination RTMP URL and Stream Key are configured.' : 'No Stream Key provided.',
    });
    if (!hasKey) allPassed = false;

    // 3. Media Compatibility Check
    let compatibilityRecommendation: 'STREAM_COPY' | 'TRANSCODE_REQUIRED' = 'STREAM_COPY';
    if (mediaExists) {
      const comp = await MediaAnalyzer.analyze(videoPath);
      compatibilityRecommendation = comp.recommendation;
      const isCopyMode = config.encodingMode === 'copy';

      if (isCopyMode && !comp.compatibleForCopy) {
        checks.push({
          name: 'Encoding Compatibility',
          passed: true, // Non-fatal warning, but informed
          message: `Stream Copy selected, but file requires transcoding: ${comp.reasons.join(', ')}`,
          details: 'We recommend switching to Transcode 1080p or 720p preset for broadcast stability.',
        });
      } else {
        checks.push({
          name: 'Encoding Compatibility',
          passed: true,
          message: isCopyMode ? 'Compatible for direct Stream Copy.' : `Transcode preset "${config.encodingMode}" will be applied.`,
        });
      }
    }

    // 4. Server Resource Capacity
    const activeWorkers = this.processManager.getActiveCount();
    const capacity = ResourceManager.checkCapacity(config.encodingMode, activeWorkers);
    checks.push({
      name: 'Server Resource Capacity',
      passed: capacity.sufficient,
      message: capacity.sufficient
        ? `Server capacity sufficient: CPU ${capacity.currentCpuPercent}%, active workers: ${activeWorkers}/${capacity.maxRecommendedWorkers}`
        : capacity.warningMessage || 'Server resource limit exceeded',
    });
    if (!capacity.sufficient) allPassed = false;

    return {
      passed: allPassed,
      checks,
      recommendation: compatibilityRecommendation,
    };
  }

  // Start a stream
  public async startStream(
    streamId: string,
    options: { isAutoStart?: boolean; force?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const config = db.getStreamById(streamId);
    if (!config) {
      return { success: false, error: `Stream configuration "${streamId}" not found.` };
    }

    const state = this.getOrCreateRuntimeState(streamId);

    // If already running
    if (this.processManager.isProcessAlive(streamId)) {
      return { success: true };
    }

    // Preflight checks
    if (!options.force) {
      const preflight = await this.preflightCheck(config);
      if (!preflight.passed && !options.isAutoStart) {
        const failedChecks = preflight.checks.filter(c => !c.passed).map(c => c.message).join('; ');
        return { success: false, error: `Preflight checks failed: ${failedChecks}` };
      }
    }

    this.transitionState(streamId, 'STARTING');

    const videoBasename = path.basename(config.videoFilename);
    const videoPath = path.join(UPLOADS_DIR, videoBasename);

    // Deep media check for audio synthesis
    const mediaComp = await MediaAnalyzer.analyze(videoPath);
    const hasAudio = !!(mediaComp.audioCodec || mediaComp.audioChannels);

    // Format destinations
    const destinations: string[] = [];
    if (config.destinations && config.destinations.length > 0) {
      for (const d of config.destinations) {
        if (d.enabled !== false && d.streamKey) {
          destinations.push(FfmpegCommandBuilder.buildRtmpDestination(d.rtmpUrl, d.streamKey));
        }
      }
    } else {
      destinations.push(FfmpegCommandBuilder.buildRtmpDestination(config.rtmpUrl, config.streamKey));
    }

    if (destinations.length === 0) {
      this.transitionState(streamId, 'FAILED', 'No active broadcast destinations configured');
      return { success: false, error: 'No active broadcast destinations' };
    }

    // Build safe argument array
    const ffmpegArgs = FfmpegCommandBuilder.build({
      inputPath: videoPath,
      hasAudio,
      loop: config.loop !== false,
      mode: config.encodingMode,
      destinations,
    });

    state.startedAt = new Date().toISOString();
    state.recentLogs.push(`[${new Date().toLocaleTimeString()}] Spawning cloud FFmpeg broadcast process...`);

    try {
      const activeFfmpegPath = resolveFfmpegPath() || 'ffmpeg';
      const child = this.processManager.spawnStream({
        streamId,
        args: ffmpegArgs,
        ffmpegPath: activeFfmpegPath,
        onLog: (line: string) => {
          state.recentLogs.push(line);
          if (state.recentLogs.length > 80) {
            state.recentLogs.shift();
          }

          // Progress parsing
          const updated = this.healthMonitor.parseFfmpegProgressLine(state, line);
          if (updated && state.status !== 'LIVE') {
            this.transitionState(streamId, 'LIVE');
          }

          this.broadcastTelemetry({
            type: 'stream.log',
            streamId,
            data: { line },
            timestamp: new Date().toISOString(),
          });
        },
        onError: (err: Error) => {
          console.error(`[StreamSupervisor] FFmpeg error on ${streamId}:`, err);
          this.handleStreamCrash(streamId, err.message);
        },
        onExit: (code: number | null, signal: string | null) => {
          console.log(`[StreamSupervisor] FFmpeg process on ${streamId} exited with code ${code}, signal ${signal}`);
          if (state.status === 'STOPPING') {
            this.transitionState(streamId, 'STOPPED', 'Broadcast stopped normally.');
          } else if (code === 0) {
            this.transitionState(streamId, 'STOPPED', 'Broadcast completed normally.');
          } else {
            const lastErrorLine = state.recentLogs
              .slice()
              .reverse()
              .find(l => {
                const low = l.toLowerCase();
                return low.includes('error') || low.includes('fail') || low.includes('refused') || low.includes('handshake');
              }) || `Process exited with code ${code}`;
            this.handleStreamCrash(streamId, lastErrorLine);
          }
        },
      });

      state.pid = child.pid;
      this.transitionState(streamId, 'CONNECTING');

      return { success: true };
    } catch (err: any) {
      this.transitionState(streamId, 'FAILED', err.message);
      return { success: false, error: err.message };
    }
  }

  // Handle unexpected process crash or socket stall with exponential backoff recovery
  private async handleStreamCrash(streamId: string, reason: string): Promise<void> {
    const config = db.getStreamById(streamId);
    const state = this.getOrCreateRuntimeState(streamId);

    state.lastError = reason;
    state.restartCount += 1;
    state.lastRestartTime = new Date().toISOString();

    if (config && this.recoveryManager.shouldAttemptRecovery(config, state)) {
      console.log(`[StreamSupervisor] Triggering auto-recovery for stream ${streamId} (Reason: ${reason})`);
      this.recoveryManager.scheduleRecovery(config, state, async () => {
        await this.startStream(streamId, { isAutoStart: false, force: true });
      });
    } else {
      console.warn(`[StreamSupervisor] Max retries exceeded or autoRestart disabled for stream ${streamId}. Marking FAILED.`);
      this.transitionState(streamId, 'FAILED', reason);
    }
  }

  // Gracefully stop a running stream
  public async stopStream(streamId: string, reason = 'Manually stopped by user'): Promise<boolean> {
    this.recoveryManager.cancelScheduledRecovery(streamId);
    const state = this.getOrCreateRuntimeState(streamId);

    if (state.status === 'STOPPED' || state.status === 'IDLE') {
      return true;
    }

    this.transitionState(streamId, 'STOPPING');
    state.recentLogs.push(`[${new Date().toLocaleTimeString()}] Stopping broadcast cleanly: ${reason}`);

    await this.processManager.stopStream(streamId);
    this.transitionState(streamId, 'STOPPED', reason);
    return true;
  }

  // Restart an existing stream
  public async restartStream(streamId: string): Promise<{ success: boolean; error?: string }> {
    await this.stopStream(streamId, 'Restarting broadcast');
    const state = this.getOrCreateRuntimeState(streamId);
    this.recoveryManager.resetRetryCount(state);
    return this.startStream(streamId, { force: true });
  }

  // Stop all active streams
  public async stopAllStreams(): Promise<void> {
    const ids = Array.from(this.runtimeStates.keys());
    await Promise.all(ids.map(id => this.stopStream(id, 'Global stop called')));
  }

  // Get stream runtime state
  public getStreamRuntime(streamId: string): StreamRuntimeState {
    return this.getOrCreateRuntimeState(streamId);
  }

  // Get all stream statuses combined with persistent configurations
  public getAllStreams(): any[] {
    const configs = db.getStreams();
    return configs.map(cfg => {
      const state = this.getOrCreateRuntimeState(cfg.id);
      const isAlive = this.processManager.isProcessAlive(cfg.id);

      return {
        ...cfg,
        status: isAlive && state.status !== 'STOPPED' && state.status !== 'FAILED' ? state.status : (state.status === 'STARTING' || state.status === 'CONNECTING' ? state.status : 'STOPPED'),
        isProcessAlive: isAlive,
        pid: state.pid,
        startedAt: state.startedAt || cfg.createdAt,
        uptimeSeconds: state.uptimeSeconds,
        fps: state.fps,
        bitrate: state.bitrate,
        speed: state.speed,
        latencyMs: state.latencyMs,
        lastProgressTime: state.lastProgressTime,
        lastError: state.lastError,
        restartCount: state.restartCount,
        retryAttempt: state.retryAttempt,
        recentLogs: state.recentLogs,
        maskedStreamKey: cfg.streamKey ? '••••••••' + cfg.streamKey.slice(-4) : '',
        destinations: cfg.destinations
          ? cfg.destinations.map(d => ({
              ...d,
              maskedStreamKey: d.streamKey ? '••••••••' + d.streamKey.slice(-4) : '',
              streamKey: undefined,
            }))
          : undefined,
        streamKey: undefined, // Never expose raw stream key
      };
    });
  }

  // Real-time telemetry SSE subscription
  public subscribeTelemetry(callback: (event: any) => void): () => void {
    this.telemetrySubscribers.add(callback);
    return () => {
      this.telemetrySubscribers.delete(callback);
    };
  }

  private broadcastTelemetry(event: any) {
    for (const sub of this.telemetrySubscribers) {
      try {
        sub(event);
      } catch {}
    }
  }

  // Graceful shutdown on SIGINT/SIGTERM
  public async shutdown(): Promise<void> {
    console.log('[StreamSupervisor] Graceful shutdown requested. Halting all FFmpeg broadcast processes...');
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    await this.stopAllStreams();
    console.log('[StreamSupervisor] All FFmpeg workers stopped cleanly.');
  }
}

export const supervisor = StreamSupervisor.getInstance();
