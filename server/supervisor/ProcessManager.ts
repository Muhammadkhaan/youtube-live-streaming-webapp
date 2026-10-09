import { spawn, ChildProcess, exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface SpawnProcessOptions {
  streamId: string;
  args: string[];
  ffmpegPath?: string;
  onLog: (line: string) => void;
  onError: (err: Error) => void;
  onExit: (code: number | null, signal: string | null) => void;
}

export class ProcessManager {
  private activeProcesses = new Map<string, ChildProcess>();

  public spawnStream(options: SpawnProcessOptions): ChildProcess {
    const ffmpegCmd = options.ffmpegPath || 'ffmpeg';

    // Tag process environment with cloudcast metadata for clean reconciliation
    const env = {
      ...process.env,
      CLOUDCAST_MANAGED: 'true',
      CLOUDCAST_STREAM_ID: options.streamId,
    };

    const child = spawn(ffmpegCmd, options.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    this.activeProcesses.set(options.streamId, child);

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split(/[\r\n]+/).filter(l => l.trim().length > 0);
      for (const line of lines) {
        options.onLog(line);
      }
    });

    child.on('error', err => {
      this.activeProcesses.delete(options.streamId);
      options.onError(err);
    });

    child.on('close', (code, signal) => {
      this.activeProcesses.delete(options.streamId);
      options.onExit(code, signal);
    });

    return child;
  }

  public getProcess(streamId: string): ChildProcess | undefined {
    return this.activeProcesses.get(streamId);
  }

  public isProcessAlive(streamId: string): boolean {
    const child = this.activeProcesses.get(streamId);
    return !!(child && !child.killed && child.exitCode === null);
  }

  public async stopStream(streamId: string, timeoutMs = 4000): Promise<boolean> {
    const child = this.activeProcesses.get(streamId);
    if (!child) return true;

    this.activeProcesses.delete(streamId);

    return new Promise(resolve => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      // 1. Try sending 'q' to stdin for clean RTMP trailer flush
      try {
        if (child.stdin && child.stdin.writable) {
          child.stdin.write('q\n');
          child.stdin.end();
        }
      } catch {}

      // 2. Schedule SIGINT if still alive
      const sigintTimer = setTimeout(() => {
        try {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGINT');
          }
        } catch {}
      }, 1500);

      // 3. Force SIGKILL if still alive after timeout
      const sigkillTimer = setTimeout(() => {
        try {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
          }
        } catch {}
        finish();
      }, timeoutMs);

      child.once('close', () => {
        clearTimeout(sigintTimer);
        clearTimeout(sigkillTimer);
        finish();
      });
    });
  }

  public async stopAll(): Promise<void> {
    const ids = Array.from(this.activeProcesses.keys());
    await Promise.all(ids.map(id => this.stopStream(id)));
  }

  public getActiveCount(): number {
    return this.activeProcesses.size;
  }

  // Scan system for orphan ffmpeg processes tagged with CLOUDCAST_MANAGED
  public async reconcileOrphanProcesses(knownStreamIds: Set<string>): Promise<number> {
    try {
      if (process.platform === 'win32') return 0;

      // Linux/Unix ps check for CLOUDCAST_STREAM_ID in process environment
      const { stdout } = await execPromise(
        'ps -eo pid,args | grep ffmpeg | grep -v grep || true'
      );
      if (!stdout.trim()) return 0;

      const lines = stdout.split('\n');
      let killedCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(\d+)\s+(.+)$/);
        if (!match) continue;

        const pid = parseInt(match[1], 10);
        const cmdArgs = match[2];

        // Check if this process belongs to CloudCast
        if (cmdArgs.includes('rtmp') || cmdArgs.includes('lavfi')) {
          // If this pid is not in our activeProcesses map
          const isTracked = Array.from(this.activeProcesses.values()).some(p => p.pid === pid);
          if (!isTracked) {
            console.log(`[ProcessManager] Terminating orphan FFmpeg process PID ${pid}`);
            try {
              process.kill(pid, 'SIGTERM');
              setTimeout(() => {
                try {
                  process.kill(pid, 'SIGKILL');
                } catch {}
              }, 2000);
              killedCount++;
            } catch {}
          }
        }
      }

      return killedCount;
    } catch {
      return 0;
    }
  }
}
