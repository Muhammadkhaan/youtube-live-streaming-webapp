import { execFileSync } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;
let cachedFfmpegVersion: string | null = null;

export function resolveFfmpegPath(): string | null {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  // 1. Custom ENV path
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    try {
      const out = execFileSync(process.env.FFMPEG_PATH, ['-version'], { encoding: 'utf-8' });
      cachedFfmpegVersion = out.split('\n')[0] || 'Custom FFMPEG_PATH';
      cachedFfmpegPath = process.env.FFMPEG_PATH;
      return cachedFfmpegPath;
    } catch {}
  }

  // 2. System PATH
  try {
    const out = execFileSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
    cachedFfmpegVersion = out.split('\n')[0] || 'System FFmpeg';
    cachedFfmpegPath = 'ffmpeg';
    return 'ffmpeg';
  } catch {}

  // 3. Common Unix/Linux binary directories
  const commonPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      try {
        const out = execFileSync(p, ['-version'], { encoding: 'utf-8' });
        cachedFfmpegVersion = out.split('\n')[0] || p;
        cachedFfmpegPath = p;
        return p;
      } catch {}
    }
  }

  // 4. Bundled precompiled static binary fallback (@ffmpeg-installer/ffmpeg)
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
      try {
        fs.chmodSync(ffmpegInstaller.path, 0o755);
      } catch {}
      const out = execFileSync(ffmpegInstaller.path, ['-version'], { encoding: 'utf-8' });
      cachedFfmpegVersion = (out.split('\n')[0] || 'Bundled static ffmpeg') + ' (Bundled static fallback)';
      cachedFfmpegPath = ffmpegInstaller.path;
      return cachedFfmpegPath;
    }
  } catch (err) {
    // Not available
  }

  return null;
}

export function resolveFfprobePath(): string | null {
  if (cachedFfprobePath) return cachedFfprobePath;

  // 1. Custom ENV path
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    try {
      execFileSync(process.env.FFPROBE_PATH, ['-version'], { encoding: 'utf-8' });
      cachedFfprobePath = process.env.FFPROBE_PATH;
      return cachedFfprobePath;
    } catch {}
  }

  // 2. System PATH
  try {
    execFileSync('ffprobe', ['-version'], { encoding: 'utf-8' });
    cachedFfprobePath = 'ffprobe';
    return 'ffprobe';
  } catch {}

  // 3. Common Unix/Linux binary directories
  const commonPaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', '/snap/bin/ffprobe', '/opt/homebrew/bin/ffprobe'];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      try {
        execFileSync(p, ['-version'], { encoding: 'utf-8' });
        cachedFfprobePath = p;
        return p;
      } catch {}
    }
  }

  // 4. Bundled precompiled static binary fallback (@ffprobe-installer/ffprobe)
  try {
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller && ffprobeInstaller.path && fs.existsSync(ffprobeInstaller.path)) {
      try {
        fs.chmodSync(ffprobeInstaller.path, 0o755);
      } catch {}
      execFileSync(ffprobeInstaller.path, ['-version'], { encoding: 'utf-8' });
      cachedFfprobePath = ffprobeInstaller.path;
      return cachedFfprobePath;
    }
  } catch (err) {
    // Not available
  }

  return null;
}

export function isFfmpegAvailable(): boolean {
  return resolveFfmpegPath() !== null;
}

export function isFfprobeAvailable(): boolean {
  return resolveFfprobePath() !== null;
}

export function getFfmpegInfo() {
  const p = resolveFfmpegPath();
  return {
    available: !!p,
    path: p || null,
    version: cachedFfmpegVersion || (p ? 'Detected' : 'Not installed'),
  };
}
