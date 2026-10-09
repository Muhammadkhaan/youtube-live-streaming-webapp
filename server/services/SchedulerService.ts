import { db } from '../db';
import { supervisor } from '../supervisor/StreamSupervisor';
import { Schedule } from '../db/schema';

export class SchedulerService {
  private static interval: NodeJS.Timeout | null = null;

  public static start(): void {
    if (this.interval) return;

    console.log('[SchedulerService] Server-side broadcast schedule daemon started.');

    // Poll schedule queue every 15 seconds
    this.interval = setInterval(async () => {
      await this.checkDueSchedules();
    }, 15000);
  }

  public static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private static async checkDueSchedules(): Promise<void> {
    const schedules = db.getSchedules();
    const now = new Date();

    for (const item of schedules) {
      if (item.status !== 'scheduled') continue;

      const scheduleDate = new Date(item.scheduledAt);
      if (scheduleDate <= now) {
        console.log(`[SchedulerService] Schedule "${item.title}" (ID: ${item.id}) is due. Launching broadcast...`);
        await this.executeSchedule(item);
      }
    }
  }

  private static async executeSchedule(item: Schedule): Promise<void> {
    try {
      let streamId = item.streamConfigId;

      // If no pre-existing stream config linked, find or create one
      if (!streamId) {
        const streams = db.getStreams();
        const existing = streams.find(s => s.videoFilename === item.videoFilename);
        if (existing) {
          streamId = existing.id;
        } else {
          streamId = `stream_sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.saveStream({
            id: streamId,
            name: item.title,
            videoFilename: item.videoFilename,
            rtmpUrl: item.rtmpUrl || 'rtmps://a.rtmps.youtube.com:443/live2',
            streamKey: item.streamKey || '',
            encodingMode: item.mode || 'copy',
            loop: item.loop !== false,
            autoStart: false,
            autoRestart: true,
            maxRetries: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const launchResult = await supervisor.startStream(streamId);
      item.lastRunAt = new Date().toISOString();

      if (launchResult.success) {
        db.addStreamEvent({
          streamId,
          level: 'INFO',
          type: 'SCHEDULED_BROADCAST_TRIGGERED',
          message: `Scheduled broadcast "${item.title}" automatically launched by server scheduler.`,
        });

        // Recurrence logic: Daily, Weekly, or Once
        if (item.frequency === 'daily') {
          const nextDay = new Date(item.scheduledAt);
          nextDay.setDate(nextDay.getDate() + 1);
          item.scheduledAt = nextDay.toISOString();
          item.status = 'scheduled';
        } else if (item.frequency === 'weekly') {
          const nextWeek = new Date(item.scheduledAt);
          nextWeek.setDate(nextWeek.getDate() + 7);
          item.scheduledAt = nextWeek.toISOString();
          item.status = 'scheduled';
        } else {
          item.status = 'completed';
        }
      } else {
        item.status = 'failed';
        db.addStreamEvent({
          streamId,
          level: 'ERROR',
          type: 'SCHEDULED_BROADCAST_FAILED',
          message: `Scheduled broadcast "${item.title}" failed to launch: ${launchResult.error}`,
        });
      }

      db.saveSchedule(item);
    } catch (err: any) {
      console.error(`[SchedulerService] Error executing schedule ${item.id}:`, err);
      item.status = 'failed';
      db.saveSchedule(item);
    }
  }
}
