import { StreamConfig, StreamRuntimeState } from '../db/schema';
import { db } from '../db';

export class RecoveryManager {
  private activeTimers = new Map<string, NodeJS.Timeout>();

  // Exponential backoff retry delays in milliseconds:
  // Attempt 1: 500ms (immediate)
  // Attempt 2: 5,000ms (5 sec)
  // Attempt 3: 15,000ms (15 sec)
  // Attempt 4: 30,000ms (30 sec)
  // Attempt 5: 60,000ms (60 sec)
  private readonly backoffDelaysMs = [500, 5000, 15000, 30000, 60000];

  public getBackoffDelay(attempt: number): number {
    const idx = Math.min(attempt - 1, this.backoffDelaysMs.length - 1);
    return this.backoffDelaysMs[Math.max(0, idx)];
  }

  public shouldAttemptRecovery(config: StreamConfig, state: StreamRuntimeState): boolean {
    if (!config.autoRestart) {
      return false;
    }
    const maxRetries = config.maxRetries || 5;
    return state.retryAttempt < maxRetries;
  }

  public scheduleRecovery(
    config: StreamConfig,
    state: StreamRuntimeState,
    executeRestart: () => Promise<void>
  ): number {
    this.cancelScheduledRecovery(config.id);

    state.retryAttempt += 1;
    state.status = 'RECONNECTING';

    const delayMs = this.getBackoffDelay(state.retryAttempt);

    db.addStreamEvent({
      streamId: config.id,
      level: 'WARNING',
      type: 'STREAM_AUTO_RECOVERY_SCHEDULED',
      message: `Automatic crash recovery scheduled for "${config.name}". Attempt ${state.retryAttempt}/${config.maxRetries || 5} in ${delayMs / 1000}s.`,
      details: {
        attempt: state.retryAttempt,
        delayMs,
        lastError: state.lastError,
      },
    });

    const timer = setTimeout(async () => {
      this.activeTimers.delete(config.id);
      try {
        console.log(`[RecoveryManager] Executing recovery attempt ${state.retryAttempt} for stream ${config.id}...`);
        await executeRestart();
      } catch (err: any) {
        console.error(`[RecoveryManager] Recovery attempt failed for stream ${config.id}:`, err);
      }
    }, delayMs);

    this.activeTimers.set(config.id, timer);
    return delayMs;
  }

  public cancelScheduledRecovery(streamId: string): void {
    const timer = this.activeTimers.get(streamId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(streamId);
    }
  }

  public resetRetryCount(state: StreamRuntimeState): void {
    state.retryAttempt = 0;
  }
}
