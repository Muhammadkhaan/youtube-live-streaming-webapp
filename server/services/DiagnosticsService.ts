import { execSync, execFileSync } from 'child_process';
import net from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../db';
import { resolveFfmpegPath, resolveFfprobePath, getFfmpegInfo } from '../utils/ffmpegPaths';

const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

export interface DiagnosticReport {
  timestamp: string;
  node: { version: string; uptimeSeconds: number; platform: string };
  ffmpeg: { available: boolean; version?: string };
  ffprobe: { available: boolean; version?: string };
  database: {
    healthy: boolean;
    streamsCount: number;
    destinationsCount: number;
    mediaCount: number;
    usersCount: number;
  };
  storage: {
    uploadsDirWritable: boolean;
    totalDiskBytes?: number;
    freeDiskBytes?: number;
    usedDiskBytes?: number;
    mediaBytesTotal: number;
  };
  network: {
    youtubeRtmp1935: { reachable: boolean; latencyMs?: number; error?: string };
    youtubeRtmps443: { reachable: boolean; latencyMs?: number; error?: string };
    facebookRtmps443: { reachable: boolean; latencyMs?: number; error?: string };
    recommendedUrl: string;
  };
}

export class DiagnosticsService {
  public static async runDiagnostics(): Promise<DiagnosticReport> {
    // 1. FFmpeg & FFprobe version checks
    const ffmpegInfo = getFfmpegInfo();
    const ffmpegAvailable = ffmpegInfo.available;
    const ffmpegVersion = ffmpegInfo.version;

    let ffprobeAvailable = false;
    let ffprobeVersion: string | undefined;
    const probePath = resolveFfprobePath();
    if (probePath) {
      try {
        const out = execFileSync(probePath, ['-version'], { encoding: 'utf-8' });
        ffprobeAvailable = true;
        ffprobeVersion = out.split('\n')[0];
      } catch {}
    }

    // 2. Storage write test
    let uploadsDirWritable = false;
    const testFile = path.join(UPLOADS_DIR, `.write_test_${Date.now()}`);
    try {
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      uploadsDirWritable = true;
    } catch {}

    // Calculate media assets total size
    let mediaBytesTotal = 0;
    try {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const f of files) {
          try {
            const stat = fs.statSync(path.join(UPLOADS_DIR, f));
            if (stat.isFile()) mediaBytesTotal += stat.size;
          } catch {}
        }
      }
    } catch {}

    // 3. Network sockets
    const [yt1935, yt443, fb443] = await Promise.all([
      this.testSocket('a.rtmp.youtube.com', 1935),
      this.testSocket('a.rtmps.youtube.com', 443),
      this.testSocket('live-api-s.facebook.com', 443),
    ]);

    return {
      timestamp: new Date().toISOString(),
      node: {
        version: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        platform: process.platform,
      },
      ffmpeg: { available: ffmpegAvailable, version: ffmpegVersion },
      ffprobe: { available: ffprobeAvailable, version: ffprobeVersion },
      database: {
        healthy: true,
        streamsCount: db.getStreams().length,
        destinationsCount: db.getDestinations().length,
        mediaCount: db.getMediaAssets().length,
        usersCount: db.getUsers().length,
      },
      storage: {
        uploadsDirWritable,
        mediaBytesTotal,
      },
      network: {
        youtubeRtmp1935: yt1935,
        youtubeRtmps443: yt443,
        facebookRtmps443: fb443,
        recommendedUrl: yt443.reachable ? 'rtmps://a.rtmps.youtube.com:443/live2' : 'rtmp://a.rtmp.youtube.com:1935/live2',
      },
    };
  }

  private static testSocket(
    host: string,
    port: number,
    timeoutMs = 3500
  ): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
    return new Promise(resolve => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, error: 'Connection timed out' });
      });

      socket.on('error', err => {
        socket.destroy();
        resolve({ reachable: false, error: err.message });
      });

      try {
        socket.connect(port, host);
      } catch (err: any) {
        resolve({ reachable: false, error: err.message });
      }
    });
  }
}
