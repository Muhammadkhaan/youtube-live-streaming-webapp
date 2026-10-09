import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dns from 'dns/promises';
import { execFileSync, execFile, spawn } from 'child_process';
import util from 'util';
import multer from 'multer';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import ipaddr from 'ipaddr.js';

import { db, maskStreamKey } from './server/db';
import { supervisor } from './server/supervisor/StreamSupervisor';
import { MediaAnalyzer } from './server/supervisor/MediaAnalyzer';
import { ResourceManager } from './server/supervisor/ResourceManager';
import { SchedulerService } from './server/services/SchedulerService';
import { DiagnosticsService } from './server/services/DiagnosticsService';
import { AuthService, authMiddleware, requireRole } from './server/services/AuthService';
import { StreamConfig, StreamDestination, EncodingMode } from './server/db/schema';
import {
  resolveFfmpegPath,
  resolveFfprobePath,
  isFfmpegAvailable,
  isFfprobeAvailable,
  getFfmpegInfo,
} from './server/utils/ffmpegPaths';

const execFilePromise = util.promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');
const TEMP_UPLOADS_DIR = path.resolve(UPLOADS_DIR, '.chunks');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const DRAFT_FILE = path.join(DATA_DIR, 'draft.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_UPLOADS_DIR)) {
  fs.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Clean stale chunks older than 3 hours
function cleanStaleChunks(maxAgeMs = 3 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(TEMP_UPLOADS_DIR)) return;
    const files = fs.readdirSync(TEMP_UPLOADS_DIR);
    const now = Date.now();
    let cleaned = 0;
    for (const file of files) {
      const fullPath = path.join(TEMP_UPLOADS_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          cleaned++;
        }
      } catch {}
    }
    if (cleaned > 0) {
      console.log(`[Storage] Purged ${cleaned} stale upload chunk file(s).`);
    }
  } catch (err) {
    console.warn('[Storage] Error cleaning stale chunks:', err);
  }
}
cleanStaleChunks();
setInterval(() => cleanStaleChunks(), 60 * 60 * 1000);

// Check FFmpeg and FFprobe availability
const activeFfmpeg = resolveFfmpegPath();
const activeFfprobe = resolveFfprobePath();
let ffmpegPath = activeFfmpeg || 'ffmpeg';
let ffmpegAvailable = !!activeFfmpeg;
let ffprobeAvailable = !!activeFfprobe;

if (ffmpegAvailable) {
  console.log('[System] FFmpeg broadcast engine active:', activeFfmpeg);
} else {
  console.warn('[System] Warning: FFmpeg not found in PATH or bundled binaries');
}

if (ffprobeAvailable) {
  console.log('[System] FFprobe media probe engine active:', activeFfprobe);
} else {
  console.warn('[System] Warning: FFprobe not found');
}

// SSRF Protection for remote URL import
async function isSafePublicUrl(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
    const { address } = await dns.lookup(hostname);
    if (!ipaddr.isValid(address)) {
      return false;
    }
    const addr = ipaddr.parse(address);
    const range = addr.range();
    const disallowed = ['loopback', 'private', 'linkLocal', 'carrierGradeNat', 'broadcast', 'reserved', 'unspecified'];
    if (disallowed.includes(range)) {
      return false;
    }
    if (address === '169.254.169.254' || address.startsWith('169.254.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Video Probe helper
async function probeVideoAsync(filePath: string) {
  const defaultMeta: {
    hasAudio: boolean;
    durationSeconds: number;
    durationFormatted: string;
    width?: number;
    height?: number;
    resolution?: string;
    videoCodec?: string;
    audioCodec?: string;
  } = {
    hasAudio: true,
    durationSeconds: 0,
    durationFormatted: '--:--',
    resolution: undefined,
    videoCodec: undefined,
    audioCodec: undefined,
  };
  if (!ffprobeAvailable || !fs.existsSync(filePath)) {
    return defaultMeta;
  }
  try {
    const probeCmd = resolveFfprobePath() || 'ffprobe';
    const { stdout } = await execFilePromise(
      probeCmd,
      [
        '-v', 'error',
        '-analyzeduration', '10000000',
        '-probesize', '10000000',
        '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration',
        '-of', 'json',
        filePath,
      ],
      { timeout: 15000 }
    );
    const data = JSON.parse(stdout);
    const durationSeconds = data.format?.duration ? parseFloat(data.format.duration) : 0;
    const vStream = data.streams?.find((s: any) => s.codec_type === 'video');
    const aStream = data.streams?.find((s: any) => s.codec_type === 'audio');
    const totalSecs = Math.floor(durationSeconds);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const durationFormatted =
      hours > 0
        ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;
    return {
      durationSeconds,
      durationFormatted,
      width: vStream?.width,
      height: vStream?.height,
      resolution: vStream ? `${vStream.width}x${vStream.height}` : undefined,
      videoCodec: vStream?.codec_name,
      audioCodec: aStream?.codec_name,
      hasAudio: !!aStream,
    };
  } catch {
    return defaultMeta;
  }
}

// Synchronize database records with files in uploads directory
async function syncVideosDatabaseAsync() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const existingAssets = db.getMediaAssets();
  const existingMap = new Map(existingAssets.map(a => [a.filename, a]));
  const diskFiles = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.') && fs.statSync(path.join(UPLOADS_DIR, f)).isFile());

  let changed = false;

  for (const filename of diskFiles) {
    if (!existingMap.has(filename)) {
      const fullPath = path.join(UPLOADS_DIR, filename);
      const stats = fs.statSync(fullPath);
      const meta = await probeVideoAsync(fullPath);
      const ext = path.extname(filename).toLowerCase();

      const newAsset = {
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        filename,
        displayName: filename.replace(/^\d+_/, ''),
        fileType: ext === '.mkv' ? 'video/x-matroska' : 'video/mp4',
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        storagePath: fullPath,
        url: `/uploads/${encodeURIComponent(filename)}`,
        durationFormatted: meta.durationFormatted,
        durationSeconds: meta.durationSeconds,
        resolution: meta.resolution,
        videoCodec: meta.videoCodec,
        audioCodec: meta.audioCodec,
        hasAudio: meta.hasAudio,
        isLiveReady: true,
        createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString(),
      };

      existingAssets.push(newAsset);
      changed = true;
    }
  }

  if (changed) {
    db.setMediaAssets(existingAssets);
  }

  return existingAssets;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Storage config for standard uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4GB max per file
});

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max per chunk
});

// Telemetry simulation overrides (preserved for UI testing)
let simulatedCpuOverride: number | null = null;
let simulatedLatencyOverride: number | null = null;
let lastMeasuredLatency = 14;

// =========================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) FOR TELEMETRY & AUDIT STREAMING
// =========================================================================
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = supervisor.subscribeTelemetry(event => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const keepAliveTimer = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
  });
});

// =========================================================================
// 1. STREAM SUPERVISOR API ROUTES
// =========================================================================

// List all streams with persistent config & live supervisor runtime state
app.get('/api/streams', (_req, res) => {
  const streams = supervisor.getAllStreams();

  // Inject simulated latency if testing
  const processed = streams.map(s => {
    const latency = simulatedLatencyOverride !== null
      ? simulatedLatencyOverride
      : (s.latencyMs || (s.isProcessAlive ? lastMeasuredLatency : undefined));
    return { ...s, latencyMs: latency };
  });

  res.json({
    streams: processed,
    ffmpegAvailable,
    ffprobeAvailable,
  });
});

// Get a single stream details
app.get('/api/streams/:id', (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  const runtime = supervisor.getStreamRuntime(id);
  res.json({
    stream: {
      ...config,
      ...runtime,
      maskedStreamKey: maskStreamKey(config.streamKey),
      destinations: config.destinations?.map(d => ({
        ...d,
        maskedStreamKey: maskStreamKey(d.streamKey),
        streamKey: undefined,
      })),
      streamKey: undefined,
    },
  });
});

// Preflight check for a stream
app.post('/api/streams/preflight', async (req, res) => {
  try {
    const { videoFilename, rtmpUrl, streamKey, mode, destinations } = req.body;
    const tempConfig: StreamConfig = {
      id: 'preflight_check',
      name: 'Preflight',
      videoFilename: videoFilename || '',
      rtmpUrl: rtmpUrl || 'rtmps://a.rtmps.youtube.com:443/live2',
      streamKey: streamKey || '',
      destinations,
      encodingMode: mode || 'copy',
      loop: true,
      autoStart: false,
      autoRestart: true,
      maxRetries: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = await supervisor.preflightCheck(tempConfig);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Start a live stream (Single or Multi-destination)
app.post('/api/streams/start', authMiddleware, async (req, res) => {
  try {
    const {
      videoFilename,
      rtmpUrl,
      streamKey,
      title,
      loop,
      mode,
      destinations,
      channelTitle,
      autoStart,
      autoRestart,
      force,
    } = req.body;

    if (!videoFilename) {
      return res.status(400).json({ error: 'Video file is required.' });
    }

    const safeBasename = path.basename(videoFilename);
    const videoPath = path.join(UPLOADS_DIR, safeBasename);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: `Video file "${safeBasename}" not found on server.` });
    }
    if (!ffmpegAvailable) {
      return res.status(500).json({ error: 'FFmpeg is not installed or available on this server.' });
    }

    // Process destinations
    let validDestinations: StreamDestination[] | undefined;
    let primaryKey = streamKey?.trim();
    let primaryUrl = (rtmpUrl?.trim() || 'rtmps://a.rtmps.youtube.com:443/live2').replace(/\/+$/, '');

    if (Array.isArray(destinations) && destinations.length > 0) {
      validDestinations = destinations
        .filter((d: any) => d && d.streamKey && typeof d.streamKey === 'string' && d.streamKey.trim())
        .map((d: any) => ({
          id: d.id || `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: d.name?.trim() || 'YouTube Channel',
          provider: (d.provider || 'youtube') as any,
          rtmpUrl: (d.rtmpUrl?.trim() || primaryUrl).replace(/\/+$/, ''),
          streamKey: d.streamKey.trim(),
          enabled: d.enabled !== false,
          createdAt: new Date().toISOString(),
        }));

      if (validDestinations.length > 0) {
        primaryKey = validDestinations[0].streamKey;
        primaryUrl = validDestinations[0].rtmpUrl;
      }
    }

    if (!primaryKey) {
      return res.status(400).json({ error: 'At least one valid Stream Key is required.' });
    }

    // Check if an existing persistent config exists for this title/video
    const existingStreams = db.getStreams();
    let streamId = 'stream_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    const existing = existingStreams.find(s => s.name === title?.trim() && s.videoFilename === safeBasename);
    if (existing) {
      streamId = existing.id;
    }

    const streamConfig: StreamConfig = {
      id: streamId,
      name: title?.trim() || path.parse(safeBasename).name.replace(/^\d+_/, ''),
      videoFilename: safeBasename,
      rtmpUrl: primaryUrl,
      streamKey: primaryKey,
      destinations: validDestinations,
      loop: loop !== false,
      encodingMode: (mode || 'copy') as EncodingMode,
      autoStart: autoStart !== false,
      autoRestart: autoRestart !== false,
      maxRetries: 5,
      channelTitle: channelTitle?.trim() || (validDestinations && validDestinations.length > 1 ? `Multi-Stream (${validDestinations.length} destinations)` : undefined),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save persistent stream configuration
    db.saveStream(streamConfig);

    // Launch via StreamSupervisor
    const launchResult = await supervisor.startStream(streamId, { force: !!force });

    if (!launchResult.success) {
      db.addAuditLog({
        username: (req as any).user?.username || 'admin',
        action: 'START_STREAM_FAILED',
        streamId,
        result: 'FAILURE',
        details: launchResult.error,
      });
      return res.status(400).json({ error: launchResult.error });
    }

    db.addAuditLog({
      username: (req as any).user?.username || 'admin',
      action: 'START_STREAM',
      streamId,
      result: 'SUCCESS',
      details: `Started broadcast "${streamConfig.name}" mode=${streamConfig.encodingMode}`,
    });

    return res.json({
      success: true,
      message: 'Live broadcast launched successfully under Stream Supervisor',
      streamId,
    });
  } catch (err: any) {
    console.error('[API] Error starting stream:', err);
    return res.status(500).json({ error: err.message || 'Failed to start stream' });
  }
});

// Batch start multiple independent streams
app.post('/api/streams/start-batch', authMiddleware, async (req, res) => {
  try {
    const { streams: batchList } = req.body;
    if (!Array.isArray(batchList) || batchList.length === 0) {
      return res.status(400).json({ error: 'Array of stream configurations is required.' });
    }

    const startedIds: string[] = [];
    const errors: string[] = [];

    for (const item of batchList) {
      try {
        if (!item.videoFilename || !item.streamKey) continue;
        const safeBasename = path.basename(item.videoFilename);
        const videoPath = path.join(UPLOADS_DIR, safeBasename);
        if (!fs.existsSync(videoPath)) continue;

        const streamId = 'stream_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        const config: StreamConfig = {
          id: streamId,
          name: item.title?.trim() || path.parse(safeBasename).name.replace(/^\d+_/, ''),
          videoFilename: safeBasename,
          rtmpUrl: (item.rtmpUrl?.trim() || 'rtmps://a.rtmps.youtube.com:443/live2').replace(/\/+$/, ''),
          streamKey: item.streamKey.trim(),
          loop: item.loop !== false,
          encodingMode: (item.mode || 'copy') as EncodingMode,
          autoStart: item.autoStart !== false,
          autoRestart: item.autoRestart !== false,
          maxRetries: 5,
          channelTitle: item.channelTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        db.saveStream(config);
        const resLaunch = await supervisor.startStream(streamId);
        if (resLaunch.success) {
          startedIds.push(streamId);
        } else {
          errors.push(`[${config.name}]: ${resLaunch.error}`);
        }
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    db.addAuditLog({
      username: (req as any).user?.username || 'admin',
      action: 'BATCH_START_STREAMS',
      result: 'SUCCESS',
      details: `Started ${startedIds.length} batch stream(s)`,
    });

    return res.json({
      success: true,
      startedCount: startedIds.length,
      startedIds,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Stop a live stream
app.post('/api/streams/:id/stop', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  await supervisor.stopStream(id, 'Stopped by user request');

  db.addAuditLog({
    username: (req as any).user?.username || 'admin',
    action: 'STOP_STREAM',
    streamId: id,
    result: 'SUCCESS',
    details: `Cleanly stopped stream "${config.name}"`,
  });

  return res.json({ success: true, message: `Stream "${config.name}" stopped cleanly.` });
});

// Stop all running streams
app.post('/api/streams/stop-all', authMiddleware, async (req, res) => {
  await supervisor.stopAllStreams();

  db.addAuditLog({
    username: (req as any).user?.username || 'admin',
    action: 'STOP_ALL_STREAMS',
    result: 'SUCCESS',
  });

  return res.json({ success: true, message: 'All active broadcasts stopped cleanly.' });
});

// Restart a stream
app.post('/api/streams/:id/restart', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  const result = await supervisor.restartStream(id);
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }

  db.addAuditLog({
    username: (req as any).user?.username || 'admin',
    action: 'RESTART_STREAM',
    streamId: id,
    result: 'SUCCESS',
  });

  return res.json({ success: true, message: `Stream "${config.name}" restarted successfully.` });
});

// Update stream configuration
app.patch('/api/streams/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.getStreamById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Stream not found' });
  }

  const { name, loop, autoStart, autoRestart, encodingMode, maxRetries, rtmpUrl, streamKey } = req.body;
  if (name !== undefined) existing.name = String(name).trim();
  if (loop !== undefined) existing.loop = !!loop;
  if (autoStart !== undefined) existing.autoStart = !!autoStart;
  if (autoRestart !== undefined) existing.autoRestart = !!autoRestart;
  if (encodingMode !== undefined) existing.encodingMode = encodingMode;
  if (maxRetries !== undefined) existing.maxRetries = Number(maxRetries);
  if (rtmpUrl !== undefined) existing.rtmpUrl = String(rtmpUrl).trim();
  if (streamKey !== undefined && streamKey.trim()) existing.streamKey = String(streamKey).trim();

  db.saveStream(existing);

  db.addAuditLog({
    username: (req as any).user?.username || 'admin',
    action: 'UPDATE_STREAM_CONFIG',
    streamId: id,
    result: 'SUCCESS',
  });

  return res.json({ success: true, stream: existing });
});

// Delete a stream
app.delete('/api/streams/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  await supervisor.stopStream(id, 'Deleted by user');
  db.deleteStream(id);

  db.addAuditLog({
    username: (req as any).user?.username || 'admin',
    action: 'DELETE_STREAM',
    streamId: id,
    result: 'SUCCESS',
  });

  return res.json({ success: true });
});

// =========================================================================
// 2. REUSABLE DESTINATION MANAGEMENT (Requirement 10 & 11)
// =========================================================================

app.get('/api/destinations', (_req, res) => {
  const destinations = db.getDestinations().map(d => ({
    ...d,
    maskedStreamKey: maskStreamKey(d.streamKey),
    hasStreamKey: !!d.streamKey,
    streamKey: undefined, // Never leak secret key in list API
  }));
  res.json({ destinations });
});

app.post('/api/destinations', authMiddleware, (req, res) => {
  try {
    const { name, provider, rtmpUrl, streamKey, enabled } = req.body;
    if (!name?.trim() || !streamKey?.trim()) {
      return res.status(400).json({ error: 'Destination name and Stream Key are required.' });
    }

    const destination: StreamDestination = {
      id: `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      provider: provider || 'youtube',
      rtmpUrl: (rtmpUrl?.trim() || 'rtmps://a.rtmps.youtube.com:443/live2').replace(/\/+$/, ''),
      streamKey: streamKey.trim(),
      enabled: enabled !== false,
      createdAt: new Date().toISOString(),
    };

    db.saveDestination(destination);

    db.addAuditLog({
      username: (req as any).user?.username || 'admin',
      action: 'CREATE_DESTINATION',
      result: 'SUCCESS',
      details: `Created destination "${destination.name}"`,
    });

    return res.json({
      success: true,
      destination: {
        ...destination,
        maskedStreamKey: maskStreamKey(destination.streamKey),
        streamKey: undefined,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/destinations/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.getDestinationById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Destination not found' });
  }

  const { name, rtmpUrl, streamKey, enabled } = req.body;
  if (name !== undefined) existing.name = String(name).trim();
  if (rtmpUrl !== undefined) existing.rtmpUrl = String(rtmpUrl).trim();
  if (streamKey !== undefined && streamKey.trim()) existing.streamKey = String(streamKey).trim();
  if (enabled !== undefined) existing.enabled = !!enabled;

  db.saveDestination(existing);
  return res.json({
    success: true,
    destination: {
      ...existing,
      maskedStreamKey: maskStreamKey(existing.streamKey),
      streamKey: undefined,
    },
  });
});

app.delete('/api/destinations/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.deleteDestination(id);
  return res.json({ success: true });
});

// Legacy channel routes preserved for 100% backwards compatibility
app.get('/api/youtube/channels', (_req, res) => {
  const destinations = db.getDestinations().map(d => ({
    id: d.id,
    title: d.name,
    rtmpUrl: d.rtmpUrl,
    maskedStreamKey: maskStreamKey(d.streamKey),
    hasStreamKey: !!d.streamKey,
    connectedAt: d.createdAt,
    connectionType: 'direct',
    isDefault: false,
  }));
  if (destinations.length > 0) destinations[0].isDefault = true;
  return res.json({ channels: destinations });
});

app.post('/api/youtube/channels', authMiddleware, (req, res) => {
  const { title, streamKey, rtmpUrl } = req.body;
  if (!title?.trim() || !streamKey?.trim()) {
    return res.status(400).json({ error: 'Channel title and Stream Key are required' });
  }
  const dest: StreamDestination = {
    id: `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: title.trim(),
    provider: 'youtube',
    rtmpUrl: (rtmpUrl?.trim() || 'rtmps://a.rtmps.youtube.com:443/live2').replace(/\/+$/, ''),
    streamKey: streamKey.trim(),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  db.saveDestination(dest);
  return res.json({
    success: true,
    channel: {
      id: dest.id,
      title: dest.name,
      maskedStreamKey: maskStreamKey(dest.streamKey),
      hasStreamKey: true,
      rtmpUrl: dest.rtmpUrl,
    },
  });
});

app.delete('/api/youtube/channels/:id', authMiddleware, (req, res) => {
  db.deleteDestination(req.params.id);
  return res.json({ success: true });
});

// =========================================================================
// 3. MEDIA ASSET MANAGEMENT & DEEP COMPATIBILITY ANALYSIS
// =========================================================================

app.get('/api/videos', async (_req, res) => {
  try {
    const videos = await syncVideosDatabaseAsync();
    return res.json({ videos });
  } catch (err: any) {
    return res.json({ videos: [] });
  }
});

// Deep media analysis endpoint
app.post('/api/videos/:filename/analyze', async (req, res) => {
  try {
    const safeBasename = path.basename(req.params.filename);
    const fullPath = path.join(UPLOADS_DIR, safeBasename);
    const analysis = await MediaAnalyzer.analyze(fullPath);
    return res.json(analysis);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Single file upload
app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('video')(req as any, res as any, async err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No video file provided' });

    const fullPath = req.file.path;
    const meta = await probeVideoAsync(fullPath);
    const compatibility = await MediaAnalyzer.analyze(fullPath);

    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: req.file.filename,
      displayName: req.file.originalname,
      fileType: req.file.mimetype || 'video/mp4',
      sizeBytes: req.file.size,
      sizeFormatted: formatBytes(req.file.size),
      storagePath: fullPath,
      url: `/uploads/${encodeURIComponent(req.file.filename)}`,
      durationFormatted: meta.durationFormatted,
      durationSeconds: meta.durationSeconds,
      resolution: meta.resolution,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      hasAudio: meta.hasAudio,
      isLiveReady: true,
      compatibility,
      createdAt: new Date().toISOString(),
    };

    db.saveMediaAsset(record);

    db.addAuditLog({
      username: (req as any).user?.username || 'admin',
      action: 'UPLOAD_MEDIA',
      result: 'SUCCESS',
      details: `Uploaded "${record.displayName}" (${record.sizeFormatted})`,
    });

    res.json({ success: true, file: record });
  });
});

// Chunk upload handler
app.post('/api/upload/chunk', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/octet-stream') || req.query.raw === 'true') {
    const uploadId = String(req.headers['x-upload-id'] || req.query.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = String(req.headers['x-chunk-index'] || req.query.chunkIndex || '');
    if (!uploadId || chunkIndex === '') return res.status(400).json({ error: 'Missing uploadId or chunkIndex' });
    const idx = parseInt(chunkIndex, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid chunkIndex' });

    if (!fs.existsSync(TEMP_UPLOADS_DIR)) fs.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
    const chunkPath = path.join(TEMP_UPLOADS_DIR, `${uploadId}__${idx}.chunk`);
    const writeStream = fs.createWriteStream(chunkPath);
    req.pipe(writeStream);
    writeStream.on('finish', () => res.json({ success: true, chunkIndex: idx }));
    writeStream.on('error', err => res.status(500).json({ error: err.message }));
    return;
  }

  chunkUpload.single('chunk')(req as any, res as any, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No chunk data received' });

    const { uploadId, chunkIndex } = req.body;
    const cleanUploadId = String(uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const idx = parseInt(chunkIndex, 10);
    if (!cleanUploadId || isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid chunk parameters' });

    if (!fs.existsSync(TEMP_UPLOADS_DIR)) fs.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
    const chunkPath = path.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${idx}.chunk`);
    fs.writeFileSync(chunkPath, req.file.buffer);
    return res.json({ success: true, chunkIndex: idx });
  });
});

// Finalize chunked upload
app.post('/api/upload/finalize', authMiddleware, async (req, res) => {
  try {
    const { uploadId, filename, totalChunks } = req.body;
    if (!uploadId || !filename || !totalChunks) return res.status(400).json({ error: 'Missing finalize parameters' });

    const cleanUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
    const total = parseInt(totalChunks, 10);
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${i}.chunk`);
      if (!fs.existsSync(chunkPath)) return res.status(400).json({ error: `Upload incomplete: chunk ${i} missing.` });
    }

    const outStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${i}.chunk`);
      const inStream = fs.createReadStream(chunkPath);
      await new Promise<void>((resolve, reject) => {
        inStream.pipe(outStream, { end: false });
        inStream.on('end', () => resolve());
        inStream.on('error', reject);
      });
      try { fs.unlinkSync(chunkPath); } catch {}
    }
    outStream.end();

    await new Promise<void>((resolve, reject) => {
      outStream.on('finish', () => resolve());
      outStream.on('error', reject);
    });

    const stats = fs.statSync(finalPath);
    const meta = await probeVideoAsync(finalPath);
    const compatibility = await MediaAnalyzer.analyze(finalPath);

    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: finalFilename,
      displayName: filename,
      fileType: 'video/mp4',
      sizeBytes: stats.size,
      sizeFormatted: formatBytes(stats.size),
      storagePath: finalPath,
      url: `/uploads/${encodeURIComponent(finalFilename)}`,
      durationFormatted: meta.durationFormatted,
      durationSeconds: meta.durationSeconds,
      resolution: meta.resolution,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      hasAudio: meta.hasAudio,
      isLiveReady: true,
      compatibility,
      createdAt: new Date().toISOString(),
    };

    db.saveMediaAsset(record);
    return res.json({ success: true, file: record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Assembly failed' });
  }
});

// Delete uploaded video
app.delete('/api/videos/:filename', authMiddleware, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  // Check if any stream is actively using this file
  const activeStreams = supervisor.getAllStreams();
  const usingStream = activeStreams.find(s => s.isProcessAlive && s.videoFilename === filename);
  if (usingStream) {
    return res.status(400).json({
      error: `Cannot delete: video is currently being streamed by "${usingStream.name}". End the broadcast first.`,
    });
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.deleteMediaAsset(filename);

    db.addAuditLog({
      username: (req as any).user?.username || 'admin',
      action: 'DELETE_MEDIA',
      result: 'SUCCESS',
      details: `Deleted file "${filename}"`,
    });

    res.json({ success: true, deletedFilename: filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remote URL video import
app.post('/api/upload/url', authMiddleware, async (req, res) => {
  try {
    const { url, filename } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Valid URL is required' });

    const safe = await isSafePublicUrl(url);
    if (!safe) return res.status(400).json({ error: 'Security Error: Access to private networks, loopback addresses, or cloud metadata endpoints is prohibited.' });

    let parsedName = filename?.trim();
    if (!parsedName) {
      try {
        parsedName = path.basename(new URL(url).pathname) || 'remote_video.mp4';
      } catch {
        parsedName = 'remote_video.mp4';
      }
    }
    if (!parsedName.includes('.')) parsedName += '.mp4';
    const safeName = parsedName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    const response = await fetch(url, { headers: { 'User-Agent': 'CloudCast-Server/3.0' } });
    if (!response.ok || !response.body) return res.status(400).json({ error: `Remote returned HTTP ${response.status}` });

    let totalDownloaded = 0;
    const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024 * 1024;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        totalDownloaded += chunk.length;
        if (totalDownloaded > MAX_DOWNLOAD_BYTES) callback(new Error('Exceeded maximum allowed 4GB limit.'));
        else callback(null, chunk);
      },
    });

    const fileStream = fs.createWriteStream(finalPath);
    // @ts-ignore
    await pipeline(response.body, limiter, fileStream);

    const stats = fs.statSync(finalPath);
    const meta = await probeVideoAsync(finalPath);
    const compatibility = await MediaAnalyzer.analyze(finalPath);

    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: finalFilename,
      displayName: safeName,
      fileType: 'video/mp4',
      sizeBytes: stats.size,
      sizeFormatted: formatBytes(stats.size),
      storagePath: finalPath,
      url: `/uploads/${encodeURIComponent(finalFilename)}`,
      durationFormatted: meta.durationFormatted,
      durationSeconds: meta.durationSeconds,
      resolution: meta.resolution,
      videoCodec: meta.videoCodec,
      audioCodec: meta.audioCodec,
      hasAudio: meta.hasAudio,
      isLiveReady: true,
      compatibility,
      createdAt: new Date().toISOString(),
    };

    db.saveMediaAsset(record);
    return res.json({ success: true, file: record });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Download failed' });
  }
});

// Test pattern video generator
app.post('/api/generate-test-video', authMiddleware, async (_req, res) => {
  if (!ffmpegAvailable) return res.status(500).json({ error: 'FFmpeg is not installed on this server.' });

  const filename = `test_pattern_${Date.now()}.mp4`;
  const outPath = path.join(UPLOADS_DIR, filename);

  try {
    const cmd = [
      '-f', 'lavfi', '-i', 'smptebars=size=1920x1080:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:beep_factor=4',
      '-vf', "drawtext=fontcolor=white:fontsize=48:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2-50:text='CLOUD LIVE STREAM TEST VIDEO':timecode='00\\:00\\:00\\:00':rate=30",
      '-t', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '5000k',
      '-g', '60', '-r', '30', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-y', outPath,
    ];

    const activeFfmpegBin = resolveFfmpegPath() || 'ffmpeg';
    const gen = spawn(activeFfmpegBin, cmd);
    gen.on('close', async code => {
      if (code === 0 && fs.existsSync(outPath)) {
        const stats = fs.statSync(outPath);
        const meta = await probeVideoAsync(outPath);
        const compatibility = await MediaAnalyzer.analyze(outPath);

        const record = {
          id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          filename,
          displayName: 'Test Pattern Live Stream Video (30s 1080p)',
          fileType: 'video/mp4',
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          storagePath: outPath,
          url: `/uploads/${encodeURIComponent(filename)}`,
          durationFormatted: meta.durationFormatted,
          durationSeconds: 30,
          resolution: '1920x1080',
          videoCodec: 'h264',
          audioCodec: 'aac',
          hasAudio: true,
          isLiveReady: true,
          compatibility,
          createdAt: new Date().toISOString(),
        };

        db.saveMediaAsset(record);
        return res.json({ success: true, file: record });
      }
      return res.status(500).json({ error: `FFmpeg exited with code ${code}` });
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Draft state
app.get('/api/draft', (_req, res) => {
  try {
    if (fs.existsSync(DRAFT_FILE)) {
      const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf-8'));
      return res.json({ success: true, draft });
    }
  } catch {}
  return res.json({ success: true, draft: null });
});

app.post('/api/draft', (req, res) => {
  try {
    fs.writeFileSync(DRAFT_FILE, JSON.stringify(req.body || {}, null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 4. PLAYLISTS & SCHEDULING (Requirement 21 & 22)
// =========================================================================

app.get('/api/playlists', (_req, res) => {
  res.json({ playlists: db.getPlaylists() });
});

app.post('/api/playlists', authMiddleware, (req, res) => {
  const { name, description, items } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Playlist name is required' });

  const playlist = {
    id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    description: description?.trim(),
    items: Array.isArray(items) ? items : [],
    totalDurationSeconds: 0,
    totalDurationFormatted: '00:00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.savePlaylist(playlist);
  return res.json({ success: true, playlist });
});

app.delete('/api/playlists/:id', authMiddleware, (req, res) => {
  db.deletePlaylist(req.params.id);
  return res.json({ success: true });
});

app.get('/api/schedules', (_req, res) => {
  res.json({ schedules: db.getSchedules() });
});

app.post('/api/schedules', authMiddleware, (req, res) => {
  const { title, videoFilename, scheduledAt, frequency, rtmpUrl, streamKey, loop, mode } = req.body;
  if (!title?.trim() || !videoFilename || !scheduledAt) {
    return res.status(400).json({ error: 'Title, videoFilename, and scheduledAt are required.' });
  }

  const sched = {
    id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    videoFilename,
    scheduledAt: new Date(scheduledAt).toISOString(),
    frequency: frequency || 'once',
    rtmpUrl,
    streamKey,
    loop: loop !== false,
    mode: mode || 'copy',
    status: 'scheduled' as const,
    createdAt: new Date().toISOString(),
  };

  db.saveSchedule(sched);
  return res.json({ success: true, schedule: sched });
});

app.delete('/api/schedules/:id', authMiddleware, (req, res) => {
  db.deleteSchedule(req.params.id);
  return res.json({ success: true });
});

// =========================================================================
// 5. AUTHENTICATION & AUDIT LOGS (Requirement 25 & 26)
// =========================================================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = AuthService.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const session = AuthService.createSession(user);
  db.addAuditLog({
    username: user.username,
    action: 'USER_LOGIN',
    result: 'SUCCESS',
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const session = (req as any).user;
  const user = db.getUserById(session.userId) || db.getUserByUsername(session.username);
  if (!user) {
    return res.json({
      user: {
        id: 'usr_admin',
        username: 'admin',
        displayName: 'Broadcast Director',
        role: 'owner',
      },
    });
  }
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) AuthService.destroySession(token);
  return res.json({ success: true });
});

app.get('/api/audit-logs', authMiddleware, (_req, res) => {
  res.json({ logs: db.getAuditLogs() });
});

// =========================================================================
// 6. SYSTEM, DIAGNOSTICS & TELEMETRY
// =========================================================================

app.get('/api/system', (req, res) => {
  const allStreams = supervisor.getAllStreams();
  const runningCount = allStreams.filter(s => s.isProcessAlive).length;
  const mem = ResourceManager.getMemoryUsage();

  const simulatedCpu = req.query.simulateCpu ? parseInt(String(req.query.simulateCpu), 10) : undefined;
  const cpuPercent = simulatedCpuOverride !== null
    ? simulatedCpuOverride
    : (simulatedCpu !== undefined && !isNaN(simulatedCpu) ? simulatedCpu : ResourceManager.getCpuUsage());

  res.json({
    ffmpegAvailable,
    ffprobeAvailable,
    ffmpegPath,
    activeStreamsCount: runningCount,
    maxRecommendedStreams: db.getSettings().maxConcurrentStreams || 8,
    nodeUptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: mem.nodeUsageMb,
    cpuUsagePercent: cpuPercent,
    platform: process.platform,
    isCpuSimulated: simulatedCpuOverride !== null,
  });
});

app.get('/api/diagnostics', async (_req, res) => {
  const report = await DiagnosticsService.runDiagnostics();
  res.json(report);
});

// Socket latency diagnostic
app.get('/api/diagnostics/network', async (req, res) => {
  const report = await DiagnosticsService.runDiagnostics();
  const effectiveLatency = simulatedLatencyOverride !== null
    ? simulatedLatencyOverride
    : (report.network.youtubeRtmps443.latencyMs || lastMeasuredLatency);

  if (effectiveLatency !== undefined) {
    report.network.youtubeRtmps443.latencyMs = effectiveLatency;
    lastMeasuredLatency = effectiveLatency;
  }

  res.json({
    standardRtmp1935: report.network.youtubeRtmp1935,
    secureRtmps443: report.network.youtubeRtmps443,
    recommendedUrl: report.network.recommendedUrl,
    isLatencySimulated: simulatedLatencyOverride !== null,
  });
});

// Simulation overrides
app.post('/api/diagnostics/simulate', (req, res) => {
  const { cpu, latency } = req.body;
  if (typeof cpu === 'number') simulatedCpuOverride = Math.max(0, Math.min(100, Math.round(cpu)));
  else if (cpu === null) simulatedCpuOverride = null;

  if (typeof latency === 'number') {
    simulatedLatencyOverride = Math.max(0, Math.round(latency));
    lastMeasuredLatency = simulatedLatencyOverride;
  } else if (latency === null) {
    simulatedLatencyOverride = null;
    lastMeasuredLatency = 14;
  }

  return res.json({ success: true, simulatedCpu: simulatedCpuOverride, simulatedLatency: simulatedLatencyOverride });
});

app.post('/api/diagnostics/simulate/reset', (_req, res) => {
  simulatedCpuOverride = null;
  simulatedLatencyOverride = null;
  lastMeasuredLatency = 14;
  return res.json({ success: true });
});

// =========================================================================
// 7. SERVER INITIALIZATION & GRACEFUL SHUTDOWN
// =========================================================================

async function startServer() {
  // 1. Initialize Stream Supervisor & Reconcile startup state (Restores autoStart streams!)
  await supervisor.initialize();

  // 2. Start server-side scheduler daemon
  SchedulerService.start();

  // 3. Vite development server or static production files
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(ROOT_DIR, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(ROOT_DIR, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CloudCast] Production Multi-Stream Broadcast Engine listening on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown handlers (Requirement 29)
  const handleShutdown = async (signal: string) => {
    console.log(`\n[CloudCast] Received ${signal}. Initiating graceful shutdown...`);
    SchedulerService.stop();
    await supervisor.shutdown();
    server.close(() => {
      console.log('[CloudCast] Server shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer();
