import { StreamRuntimeState, StreamStatus } from '../db/schema';

export class HealthMonitor {
  private lastProgressTimestamp = new Map<string, number>();

  public parseFfmpegProgressLine(
    streamState: StreamRuntimeState,
    line: string
  ): boolean {
    let updated = false;

    // fps= 29.97
    const fpsMatch = line.match(/fps=\s*([\d\.]+)/);
    if (fpsMatch) {
      streamState.fps = parseFloat(fpsMatch[1]);
      updated = true;
    }

    // bitrate= 4520.1kbits/s
    const bitrateMatch = line.match(/bitrate=\s*([\d\.]+kbits\/s)/);
    if (bitrateMatch) {
      streamState.bitrate = bitrateMatch[1];
      updated = true;
    }

    // speed= 1.02x
    const speedMatch = line.match(/speed=\s*([\d\.]+x)/);
    if (speedMatch) {
      streamState.speed = speedMatch[1];
      updated = true;
    }

    // time=00:04:15.22
    const timeMatch = line.match(/time=\s*([\d:.]+)/);
    if (timeMatch) {
      streamState.lastProgressTime = timeMatch[1];
      this.lastProgressTimestamp.set(streamState.streamId, Date.now());
      updated = true;
    }

    return updated;
  }

  public checkStreamStall(streamState: StreamRuntimeState): 'OK' | 'STALLED' | 'DEGRADED' {
    if (streamState.status !== 'LIVE' && streamState.status !== 'DEGRADED') {
      return 'OK';
    }

    const lastTime = this.lastProgressTimestamp.get(streamState.streamId);
    if (!lastTime) return 'OK';

    const elapsedMs = Date.now() - lastTime;

    // If no progress for 20 seconds, connection is stalled
    if (elapsedMs > 20000) {
      return 'STALLED';
    }

    // If no progress for 10 seconds, degraded
    if (elapsedMs > 10000) {
      return 'DEGRADED';
    }

    return 'OK';
  }

  public updateUptime(streamState: StreamRuntimeState): void {
    if (streamState.startedAt && (streamState.status === 'LIVE' || streamState.status === 'CONNECTING' || streamState.status === 'DEGRADED')) {
      const startMs = new Date(streamState.startedAt).getTime();
      const nowMs = Date.now();
      streamState.uptimeSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    }
  }
}
