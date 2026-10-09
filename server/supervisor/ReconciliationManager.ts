import { StreamSupervisor } from './StreamSupervisor';
import { db } from '../db';
import { ProcessManager } from './ProcessManager';

export class ReconciliationManager {
  public static async reconcileOnStartup(
    supervisor: StreamSupervisor,
    processManager: ProcessManager
  ): Promise<void> {
    console.log('[ReconciliationManager] Beginning startup state reconciliation & orphan sweep...');

    // 1. Reconcile orphan FFmpeg processes from any prior ungraceful Node.js crash
    const allConfigs = db.getStreams();
    const knownStreamIds = new Set(allConfigs.map(s => s.id));
    const killedOrphans = await processManager.reconcileOrphanProcesses(knownStreamIds);
    if (killedOrphans > 0) {
      console.log(`[ReconciliationManager] Cleaned up ${killedOrphans} orphan FFmpeg process(es).`);
    }

    // 2. Auto-start streams configured with autoStart === true
    const settings = db.getSettings();
    if (!settings.autoStartStreamsOnBoot) {
      console.log('[ReconciliationManager] Auto-start on boot is disabled in server settings.');
      return;
    }

    const autoStartStreams = allConfigs.filter(s => s.autoStart);
    console.log(`[ReconciliationManager] Found ${autoStartStreams.length} stream(s) flagged for auto-start on server boot.`);

    for (const streamConfig of autoStartStreams) {
      try {
        console.log(`[ReconciliationManager] Auto-starting broadcast "${streamConfig.name}" (ID: ${streamConfig.id})...`);
        const result = await supervisor.startStream(streamConfig.id, { isAutoStart: true });
        if (result.success) {
          console.log(`[ReconciliationManager] Successfully restored broadcast "${streamConfig.name}".`);
          db.addStreamEvent({
            streamId: streamConfig.id,
            level: 'INFO',
            type: 'STREAM_AUTO_STARTED_ON_BOOT',
            message: `Stream "${streamConfig.name}" automatically restored on cloud server reboot.`,
          });
        } else {
          console.warn(`[ReconciliationManager] Failed to auto-start stream "${streamConfig.name}":`, result.error);
        }
      } catch (err: any) {
        console.error(`[ReconciliationManager] Error restoring stream "${streamConfig.name}":`, err);
      }
    }
  }
}
