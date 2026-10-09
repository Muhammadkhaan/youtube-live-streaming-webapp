import os from 'os';
import fs from 'fs';
import { EncodingMode } from '../db/schema';
import { db } from '../db';

export interface ResourceEstimate {
  sufficient: boolean;
  currentCpuPercent: number;
  estimatedAdditionalCpuPercent: number;
  currentMemoryUsageMb: number;
  freeMemoryMb: number;
  totalMemoryMb: number;
  activeWorkerCount: number;
  maxRecommendedWorkers: number;
  warningMessage?: string;
}

export class ResourceManager {
  private static lastCpuSnapshot: { idle: number; total: number } | null = null;

  public static getCpuUsage(): number {
    try {
      const cpus = os.cpus();
      if (!cpus || cpus.length === 0) return 0;
      let idle = 0;
      let total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          total += (cpu.times as any)[type];
        }
        idle += cpu.times.idle;
      }
      if (!this.lastCpuSnapshot) {
        this.lastCpuSnapshot = { idle, total };
        return 4;
      }
      const idleDelta = idle - this.lastCpuSnapshot.idle;
      const totalDelta = total - this.lastCpuSnapshot.total;
      this.lastCpuSnapshot = { idle, total };
      if (totalDelta <= 0) return 0;
      const usage = 100 - Math.round((idleDelta / totalDelta) * 100);
      return Math.max(0, Math.min(100, usage));
    } catch {
      return 0;
    }
  }

  public static getMemoryUsage() {
    const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemoryMb = Math.round(os.freemem() / (1024 * 1024));
    const nodeUsageMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const usedPercent = Math.round(((totalMemoryMb - freeMemoryMb) / totalMemoryMb) * 100);

    return {
      totalMemoryMb,
      freeMemoryMb,
      nodeUsageMb,
      usedPercent,
    };
  }

  public static checkCapacity(
    mode: EncodingMode,
    currentActiveWorkers: number
  ): ResourceEstimate {
    const currentCpu = this.getCpuUsage();
    const mem = this.getMemoryUsage();
    const settings = db.getSettings();

    // Stream Copy uses very low CPU (pacing + muxing only ~ 2-5%)
    // Transcoding uses significantly more CPU (~ 20-35% on standard cores)
    const isTranscoding = mode.startsWith('transcode');
    const estimatedCpuAddition = isTranscoding ? 28 : 4;
    const estimatedMemoryAdditionMb = isTranscoding ? 120 : 40;

    const projectedCpu = currentCpu + estimatedCpuAddition;
    const maxCpu = settings.maxCpuUsageThreshold || 85;
    const maxWorkers = settings.maxConcurrentStreams || 8;

    let sufficient = true;
    let warningMessage: string | undefined;

    if (currentActiveWorkers >= maxWorkers) {
      sufficient = false;
      warningMessage = `Maximum concurrent broadcast limit (${maxWorkers}) reached.`;
    } else if (projectedCpu > maxCpu) {
      sufficient = false;
      warningMessage = `Projected CPU usage (${projectedCpu}%) exceeds safety threshold of ${maxCpu}%.`;
    } else if (mem.freeMemoryMb < estimatedMemoryAdditionMb) {
      sufficient = false;
      warningMessage = `Insufficient free memory (${mem.freeMemoryMb} MB free, ~${estimatedMemoryAdditionMb} MB required).`;
    }

    return {
      sufficient,
      currentCpuPercent: currentCpu,
      estimatedAdditionalCpuPercent: estimatedCpuAddition,
      currentMemoryUsageMb: mem.totalMemoryMb - mem.freeMemoryMb,
      freeMemoryMb: mem.freeMemoryMb,
      totalMemoryMb: mem.totalMemoryMb,
      activeWorkerCount: currentActiveWorkers,
      maxRecommendedWorkers: maxWorkers,
      warningMessage,
    };
  }
}
