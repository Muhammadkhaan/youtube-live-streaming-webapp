// server.ts
import express from "express";
import path4 from "path";
import fs6 from "fs";
import dns from "dns/promises";
import { execFile as execFile2, spawn as spawn2 } from "child_process";
import util3 from "util";
import multer from "multer";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import ipaddr from "ipaddr.js";

// server/db/index.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
var ROOT_DIR = process.cwd();
var DATA_DIR = path.resolve(ROOT_DIR, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function writeAtomicJson(filePath, data) {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, jsonStr, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
      }
    }
    throw err;
  }
}
function readJsonFile(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.trim().length === 0) return defaultValue;
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[Database] Error reading ${path.basename(filePath)}:`, err);
  }
  return defaultValue;
}
function hashPassword(password, salt) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return { hash: derivedKey.toString("hex"), salt: generatedSalt };
}
function verifyPassword(password, hash, salt) {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(hash, "hex");
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}
function maskStreamKey(key) {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 4) return "\u2022\u2022\u2022\u2022";
  return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + trimmed.slice(-4);
}
var Database = class {
  constructor() {
    this.usersFile = path.join(DATA_DIR, "users.json");
    this.streamsFile = path.join(DATA_DIR, "streams_config.json");
    this.destinationsFile = path.join(DATA_DIR, "destinations.json");
    this.mediaAssetsFile = path.join(DATA_DIR, "videos.json");
    this.playlistsFile = path.join(DATA_DIR, "playlists.json");
    this.schedulesFile = path.join(DATA_DIR, "schedules.json");
    this.streamEventsFile = path.join(DATA_DIR, "stream_events.json");
    this.auditLogsFile = path.join(DATA_DIR, "audit_logs.json");
    this.settingsFile = path.join(DATA_DIR, "settings.json");
    // In-memory caches synced atomically
    this.users = [];
    this.streams = [];
    this.destinations = [];
    this.mediaAssets = [];
    this.playlists = [];
    this.schedules = [];
    this.streamEvents = [];
    this.auditLogs = [];
    this.settings = {
      serverName: "CloudCast Production Node",
      maxConcurrentStreams: 8,
      maxCpuUsageThreshold: 85,
      enableOrphanProcessReconciliation: true,
      autoStartStreamsOnBoot: true,
      defaultEncodingPreset: "copy",
      rtmpConnectTimeoutSeconds: 15,
      sessionTimeoutHours: 48
    };
    this.init();
  }
  init() {
    this.loadAll();
    this.ensureDefaultData();
    this.migrateLegacyData();
  }
  loadAll() {
    this.users = readJsonFile(this.usersFile, []);
    this.streams = readJsonFile(this.streamsFile, []);
    this.destinations = readJsonFile(this.destinationsFile, []);
    this.mediaAssets = readJsonFile(this.mediaAssetsFile, []);
    this.playlists = readJsonFile(this.playlistsFile, []);
    this.schedules = readJsonFile(this.schedulesFile, []);
    this.streamEvents = readJsonFile(this.streamEventsFile, []);
    this.auditLogs = readJsonFile(this.auditLogsFile, []);
    this.settings = readJsonFile(this.settingsFile, this.settings);
  }
  ensureDefaultData() {
    if (this.users.length === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || "cloudcast2026";
      const { hash, salt } = hashPassword(defaultPassword);
      const adminUser = {
        id: "usr_admin_" + Date.now().toString(36),
        username: "admin",
        displayName: "Broadcast Director",
        role: "owner",
        passwordHash: hash,
        salt,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.users.push(adminUser);
      writeAtomicJson(this.usersFile, this.users);
      console.log(`[Database] Initialized primary Administrator account: username="admin"`);
    }
    if (!fs.existsSync(this.settingsFile)) {
      writeAtomicJson(this.settingsFile, this.settings);
    }
  }
  migrateLegacyData() {
    const legacyChannelsFile = path.join(DATA_DIR, "youtube_channels.json");
    if (this.destinations.length === 0 && fs.existsSync(legacyChannelsFile)) {
      try {
        const legacyChannels = readJsonFile(legacyChannelsFile, []);
        for (const chan of legacyChannels) {
          if (chan.streamKey && chan.title) {
            this.destinations.push({
              id: chan.id || `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: chan.title,
              provider: "youtube",
              rtmpUrl: chan.rtmpUrl || "rtmps://a.rtmps.youtube.com:443/live2",
              streamKey: chan.streamKey,
              enabled: true,
              createdAt: chan.connectedAt || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        if (this.destinations.length > 0) {
          writeAtomicJson(this.destinationsFile, this.destinations);
          console.log(`[Database] Migrated ${this.destinations.length} legacy channel destinations.`);
        }
      } catch (err) {
        console.warn("[Database] Legacy channels migration warning:", err);
      }
    }
    const legacyStreamsFile = path.join(DATA_DIR, "streams.json");
    if (this.streams.length === 0 && fs.existsSync(legacyStreamsFile)) {
      try {
        const legacyStreams = readJsonFile(legacyStreamsFile, []);
        for (const ls of legacyStreams) {
          if (ls.videoFilename && (ls.streamKey || ls.destinations && ls.destinations.length > 0)) {
            const firstDestKey = ls.streamKey || ls.destinations && ls.destinations[0]?.streamKey || "";
            const firstDestUrl = ls.rtmpUrl || ls.destinations && ls.destinations[0]?.rtmpUrl || "rtmps://a.rtmps.youtube.com:443/live2";
            this.streams.push({
              id: ls.id || `stream_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: ls.title || ls.videoFilename,
              videoFilename: ls.videoFilename,
              rtmpUrl: firstDestUrl,
              streamKey: firstDestKey,
              destinations: ls.destinations,
              encodingMode: ls.mode || "copy",
              loop: ls.loop !== false,
              autoStart: true,
              // Default to autoStart for existing streams
              autoRestart: true,
              maxRetries: 5,
              channelTitle: ls.channelTitle,
              createdAt: ls.startedAt || (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        if (this.streams.length > 0) {
          writeAtomicJson(this.streamsFile, this.streams);
          console.log(`[Database] Migrated ${this.streams.length} legacy stream configurations.`);
        }
      } catch (err) {
        console.warn("[Database] Legacy streams migration warning:", err);
      }
    }
  }
  // ================= USERS =================
  getUsers() {
    return [...this.users];
  }
  getUserByUsername(username) {
    return this.users.find((u) => u.username.toLowerCase() === username.toLowerCase().trim());
  }
  getUserById(id) {
    return this.users.find((u) => u.id === id);
  }
  saveUser(user) {
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.users[idx] = user;
    } else {
      this.users.push(user);
    }
    writeAtomicJson(this.usersFile, this.users);
  }
  // ================= DESTINATIONS =================
  getDestinations() {
    return [...this.destinations];
  }
  getDestinationById(id) {
    return this.destinations.find((d) => d.id === id);
  }
  saveDestination(destination) {
    const idx = this.destinations.findIndex((d) => d.id === destination.id);
    if (idx >= 0) {
      this.destinations[idx] = destination;
    } else {
      this.destinations.push(destination);
    }
    writeAtomicJson(this.destinationsFile, this.destinations);
  }
  deleteDestination(id) {
    const initialLen = this.destinations.length;
    this.destinations = this.destinations.filter((d) => d.id !== id);
    if (this.destinations.length !== initialLen) {
      writeAtomicJson(this.destinationsFile, this.destinations);
      return true;
    }
    return false;
  }
  // ================= STREAMS CONFIG =================
  getStreams() {
    return [...this.streams];
  }
  getStreamById(id) {
    return this.streams.find((s) => s.id === id);
  }
  saveStream(stream) {
    const idx = this.streams.findIndex((s) => s.id === stream.id);
    stream.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (idx >= 0) {
      this.streams[idx] = stream;
    } else {
      this.streams.unshift(stream);
    }
    writeAtomicJson(this.streamsFile, this.streams);
  }
  deleteStream(id) {
    const initialLen = this.streams.length;
    this.streams = this.streams.filter((s) => s.id !== id);
    if (this.streams.length !== initialLen) {
      writeAtomicJson(this.streamsFile, this.streams);
      return true;
    }
    return false;
  }
  // ================= MEDIA ASSETS =================
  getMediaAssets() {
    return [...this.mediaAssets];
  }
  getMediaAssetById(id) {
    return this.mediaAssets.find((m) => m.id === id || m.filename === id);
  }
  saveMediaAsset(asset) {
    const idx = this.mediaAssets.findIndex((m) => m.id === asset.id || m.filename === asset.filename);
    if (idx >= 0) {
      this.mediaAssets[idx] = asset;
    } else {
      this.mediaAssets.unshift(asset);
    }
    writeAtomicJson(this.mediaAssetsFile, this.mediaAssets);
  }
  setMediaAssets(assets) {
    this.mediaAssets = [...assets];
    writeAtomicJson(this.mediaAssetsFile, this.mediaAssets);
  }
  deleteMediaAsset(id) {
    const initialLen = this.mediaAssets.length;
    this.mediaAssets = this.mediaAssets.filter((m) => m.id !== id && m.filename !== id);
    if (this.mediaAssets.length !== initialLen) {
      writeAtomicJson(this.mediaAssetsFile, this.mediaAssets);
      return true;
    }
    return false;
  }
  // ================= PLAYLISTS =================
  getPlaylists() {
    return [...this.playlists];
  }
  getPlaylistById(id) {
    return this.playlists.find((p) => p.id === id);
  }
  savePlaylist(playlist) {
    const idx = this.playlists.findIndex((p) => p.id === playlist.id);
    playlist.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (idx >= 0) {
      this.playlists[idx] = playlist;
    } else {
      this.playlists.push(playlist);
    }
    writeAtomicJson(this.playlistsFile, this.playlists);
  }
  deletePlaylist(id) {
    const initialLen = this.playlists.length;
    this.playlists = this.playlists.filter((p) => p.id !== id);
    if (this.playlists.length !== initialLen) {
      writeAtomicJson(this.playlistsFile, this.playlists);
      return true;
    }
    return false;
  }
  // ================= SCHEDULES =================
  getSchedules() {
    return [...this.schedules];
  }
  getScheduleById(id) {
    return this.schedules.find((s) => s.id === id);
  }
  saveSchedule(schedule) {
    const idx = this.schedules.findIndex((s) => s.id === schedule.id);
    if (idx >= 0) {
      this.schedules[idx] = schedule;
    } else {
      this.schedules.push(schedule);
    }
    writeAtomicJson(this.schedulesFile, this.schedules);
  }
  deleteSchedule(id) {
    const initialLen = this.schedules.length;
    this.schedules = this.schedules.filter((s) => s.id !== id);
    if (this.schedules.length !== initialLen) {
      writeAtomicJson(this.schedulesFile, this.schedules);
      return true;
    }
    return false;
  }
  // ================= STREAM EVENTS =================
  getStreamEvents(streamId, limit = 100) {
    let list = this.streamEvents;
    if (streamId) {
      list = list.filter((e) => e.streamId === streamId);
    }
    return list.slice(-limit).reverse();
  }
  addStreamEvent(event) {
    const fullEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.streamEvents.push(fullEvent);
    if (this.streamEvents.length > 2e3) {
      this.streamEvents = this.streamEvents.slice(-1500);
    }
    writeAtomicJson(this.streamEventsFile, this.streamEvents);
    return fullEvent;
  }
  // ================= AUDIT LOGS =================
  getAuditLogs(limit = 200) {
    return this.auditLogs.slice(-limit).reverse();
  }
  addAuditLog(log) {
    const fullLog = {
      ...log,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.auditLogs.push(fullLog);
    if (this.auditLogs.length > 2e3) {
      this.auditLogs = this.auditLogs.slice(-1500);
    }
    writeAtomicJson(this.auditLogsFile, this.auditLogs);
    return fullLog;
  }
  // ================= SETTINGS =================
  getSettings() {
    return { ...this.settings };
  }
  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    writeAtomicJson(this.settingsFile, this.settings);
    return { ...this.settings };
  }
};
var db = new Database();

// server/supervisor/StreamSupervisor.ts
import path2 from "path";
import fs4 from "fs";

// server/supervisor/ProcessManager.ts
import { spawn, exec } from "child_process";
import util from "util";
var execPromise = util.promisify(exec);
var ProcessManager = class {
  constructor() {
    this.activeProcesses = /* @__PURE__ */ new Map();
  }
  spawnStream(options) {
    const ffmpegCmd = options.ffmpegPath || "ffmpeg";
    const env = {
      ...process.env,
      CLOUDCAST_MANAGED: "true",
      CLOUDCAST_STREAM_ID: options.streamId
    };
    const child = spawn(ffmpegCmd, options.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env
    });
    this.activeProcesses.set(options.streamId, child);
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      const lines = text.split(/[\r\n]+/).filter((l) => l.trim().length > 0);
      for (const line of lines) {
        options.onLog(line);
      }
    });
    child.on("error", (err) => {
      this.activeProcesses.delete(options.streamId);
      options.onError(err);
    });
    child.on("close", (code, signal) => {
      this.activeProcesses.delete(options.streamId);
      options.onExit(code, signal);
    });
    return child;
  }
  getProcess(streamId) {
    return this.activeProcesses.get(streamId);
  }
  isProcessAlive(streamId) {
    const child = this.activeProcesses.get(streamId);
    return !!(child && !child.killed && child.exitCode === null);
  }
  async stopStream(streamId, timeoutMs = 4e3) {
    const child = this.activeProcesses.get(streamId);
    if (!child) return true;
    this.activeProcesses.delete(streamId);
    return new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };
      try {
        if (child.stdin && child.stdin.writable) {
          child.stdin.write("q\n");
          child.stdin.end();
        }
      } catch {
      }
      const sigintTimer = setTimeout(() => {
        try {
          if (!child.killed && child.exitCode === null) {
            child.kill("SIGINT");
          }
        } catch {
        }
      }, 1500);
      const sigkillTimer = setTimeout(() => {
        try {
          if (!child.killed && child.exitCode === null) {
            child.kill("SIGKILL");
          }
        } catch {
        }
        finish();
      }, timeoutMs);
      child.once("close", () => {
        clearTimeout(sigintTimer);
        clearTimeout(sigkillTimer);
        finish();
      });
    });
  }
  async stopAll() {
    const ids = Array.from(this.activeProcesses.keys());
    await Promise.all(ids.map((id) => this.stopStream(id)));
  }
  getActiveCount() {
    return this.activeProcesses.size;
  }
  // Scan system for orphan ffmpeg processes tagged with CLOUDCAST_MANAGED
  async reconcileOrphanProcesses(knownStreamIds) {
    try {
      if (process.platform === "win32") return 0;
      const { stdout } = await execPromise(
        "ps -eo pid,args | grep ffmpeg | grep -v grep || true"
      );
      if (!stdout.trim()) return 0;
      const lines = stdout.split("\n");
      let killedCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(\d+)\s+(.+)$/);
        if (!match) continue;
        const pid = parseInt(match[1], 10);
        const cmdArgs = match[2];
        if (cmdArgs.includes("rtmp") || cmdArgs.includes("lavfi")) {
          const isTracked = Array.from(this.activeProcesses.values()).some((p) => p.pid === pid);
          if (!isTracked) {
            console.log(`[ProcessManager] Terminating orphan FFmpeg process PID ${pid}`);
            try {
              process.kill(pid, "SIGTERM");
              setTimeout(() => {
                try {
                  process.kill(pid, "SIGKILL");
                } catch {
                }
              }, 2e3);
              killedCount++;
            } catch {
            }
          }
        }
      }
      return killedCount;
    } catch {
      return 0;
    }
  }
};

// server/supervisor/HealthMonitor.ts
var HealthMonitor = class {
  constructor() {
    this.lastProgressTimestamp = /* @__PURE__ */ new Map();
  }
  parseFfmpegProgressLine(streamState, line) {
    let updated = false;
    const fpsMatch = line.match(/fps=\s*([\d\.]+)/);
    if (fpsMatch) {
      streamState.fps = parseFloat(fpsMatch[1]);
      updated = true;
    }
    const bitrateMatch = line.match(/bitrate=\s*([\d\.]+kbits\/s)/);
    if (bitrateMatch) {
      streamState.bitrate = bitrateMatch[1];
      updated = true;
    }
    const speedMatch = line.match(/speed=\s*([\d\.]+x)/);
    if (speedMatch) {
      streamState.speed = speedMatch[1];
      updated = true;
    }
    const timeMatch = line.match(/time=\s*([\d:.]+)/);
    if (timeMatch) {
      streamState.lastProgressTime = timeMatch[1];
      this.lastProgressTimestamp.set(streamState.streamId, Date.now());
      updated = true;
    }
    return updated;
  }
  checkStreamStall(streamState) {
    if (streamState.status !== "LIVE" && streamState.status !== "DEGRADED") {
      return "OK";
    }
    const lastTime = this.lastProgressTimestamp.get(streamState.streamId);
    if (!lastTime) return "OK";
    const elapsedMs = Date.now() - lastTime;
    if (elapsedMs > 2e4) {
      return "STALLED";
    }
    if (elapsedMs > 1e4) {
      return "DEGRADED";
    }
    return "OK";
  }
  updateUptime(streamState) {
    if (streamState.startedAt && (streamState.status === "LIVE" || streamState.status === "CONNECTING" || streamState.status === "DEGRADED")) {
      const startMs = new Date(streamState.startedAt).getTime();
      const nowMs = Date.now();
      streamState.uptimeSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1e3));
    }
  }
};

// server/supervisor/RecoveryManager.ts
var RecoveryManager = class {
  constructor() {
    this.activeTimers = /* @__PURE__ */ new Map();
    // Exponential backoff retry delays in milliseconds:
    // Attempt 1: 500ms (immediate)
    // Attempt 2: 5,000ms (5 sec)
    // Attempt 3: 15,000ms (15 sec)
    // Attempt 4: 30,000ms (30 sec)
    // Attempt 5: 60,000ms (60 sec)
    this.backoffDelaysMs = [500, 5e3, 15e3, 3e4, 6e4];
  }
  getBackoffDelay(attempt) {
    const idx = Math.min(attempt - 1, this.backoffDelaysMs.length - 1);
    return this.backoffDelaysMs[Math.max(0, idx)];
  }
  shouldAttemptRecovery(config, state) {
    if (!config.autoRestart) {
      return false;
    }
    const maxRetries = config.maxRetries || 5;
    return state.retryAttempt < maxRetries;
  }
  scheduleRecovery(config, state, executeRestart) {
    this.cancelScheduledRecovery(config.id);
    state.retryAttempt += 1;
    state.status = "RECONNECTING";
    const delayMs = this.getBackoffDelay(state.retryAttempt);
    db.addStreamEvent({
      streamId: config.id,
      level: "WARNING",
      type: "STREAM_AUTO_RECOVERY_SCHEDULED",
      message: `Automatic crash recovery scheduled for "${config.name}". Attempt ${state.retryAttempt}/${config.maxRetries || 5} in ${delayMs / 1e3}s.`,
      details: {
        attempt: state.retryAttempt,
        delayMs,
        lastError: state.lastError
      }
    });
    const timer = setTimeout(async () => {
      this.activeTimers.delete(config.id);
      try {
        console.log(`[RecoveryManager] Executing recovery attempt ${state.retryAttempt} for stream ${config.id}...`);
        await executeRestart();
      } catch (err) {
        console.error(`[RecoveryManager] Recovery attempt failed for stream ${config.id}:`, err);
      }
    }, delayMs);
    this.activeTimers.set(config.id, timer);
    return delayMs;
  }
  cancelScheduledRecovery(streamId) {
    const timer = this.activeTimers.get(streamId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(streamId);
    }
  }
  resetRetryCount(state) {
    state.retryAttempt = 0;
  }
};

// server/supervisor/ResourceManager.ts
import os from "os";
var ResourceManager = class {
  static {
    this.lastCpuSnapshot = null;
  }
  static getCpuUsage() {
    try {
      const cpus = os.cpus();
      if (!cpus || cpus.length === 0) return 0;
      let idle = 0;
      let total = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          total += cpu.times[type];
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
      const usage = 100 - Math.round(idleDelta / totalDelta * 100);
      return Math.max(0, Math.min(100, usage));
    } catch {
      return 0;
    }
  }
  static getMemoryUsage() {
    const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemoryMb = Math.round(os.freemem() / (1024 * 1024));
    const nodeUsageMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const usedPercent = Math.round((totalMemoryMb - freeMemoryMb) / totalMemoryMb * 100);
    return {
      totalMemoryMb,
      freeMemoryMb,
      nodeUsageMb,
      usedPercent
    };
  }
  static checkCapacity(mode, currentActiveWorkers) {
    const currentCpu = this.getCpuUsage();
    const mem = this.getMemoryUsage();
    const settings = db.getSettings();
    const isTranscoding = mode.startsWith("transcode");
    const estimatedCpuAddition = isTranscoding ? 28 : 4;
    const estimatedMemoryAdditionMb = isTranscoding ? 120 : 40;
    const projectedCpu = currentCpu + estimatedCpuAddition;
    const maxCpu = settings.maxCpuUsageThreshold || 85;
    const maxWorkers = settings.maxConcurrentStreams || 8;
    let sufficient = true;
    let warningMessage;
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
      warningMessage
    };
  }
};

// server/supervisor/MediaAnalyzer.ts
import { execFile } from "child_process";
import util2 from "util";
import fs3 from "fs";

// server/utils/ffmpegPaths.ts
import { execFileSync } from "child_process";
import fs2 from "fs";
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var cachedFfmpegPath = null;
var cachedFfprobePath = null;
var cachedFfmpegVersion = null;
function resolveFfmpegPath() {
  if (cachedFfmpegPath) return cachedFfmpegPath;
  if (process.env.FFMPEG_PATH && fs2.existsSync(process.env.FFMPEG_PATH)) {
    try {
      const out = execFileSync(process.env.FFMPEG_PATH, ["-version"], { encoding: "utf-8" });
      cachedFfmpegVersion = out.split("\n")[0] || "Custom FFMPEG_PATH";
      cachedFfmpegPath = process.env.FFMPEG_PATH;
      return cachedFfmpegPath;
    } catch {
    }
  }
  try {
    const out = execFileSync("ffmpeg", ["-version"], { encoding: "utf-8" });
    cachedFfmpegVersion = out.split("\n")[0] || "System FFmpeg";
    cachedFfmpegPath = "ffmpeg";
    return "ffmpeg";
  } catch {
  }
  const commonPaths = ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"];
  for (const p of commonPaths) {
    if (fs2.existsSync(p)) {
      try {
        const out = execFileSync(p, ["-version"], { encoding: "utf-8" });
        cachedFfmpegVersion = out.split("\n")[0] || p;
        cachedFfmpegPath = p;
        return p;
      } catch {
      }
    }
  }
  try {
    const ffmpegInstaller = require2("@ffmpeg-installer/ffmpeg");
    if (ffmpegInstaller && ffmpegInstaller.path && fs2.existsSync(ffmpegInstaller.path)) {
      try {
        fs2.chmodSync(ffmpegInstaller.path, 493);
      } catch {
      }
      const out = execFileSync(ffmpegInstaller.path, ["-version"], { encoding: "utf-8" });
      cachedFfmpegVersion = (out.split("\n")[0] || "Bundled static ffmpeg") + " (Bundled static fallback)";
      cachedFfmpegPath = ffmpegInstaller.path;
      return cachedFfmpegPath;
    }
  } catch (err) {
  }
  return null;
}
function resolveFfprobePath() {
  if (cachedFfprobePath) return cachedFfprobePath;
  if (process.env.FFPROBE_PATH && fs2.existsSync(process.env.FFPROBE_PATH)) {
    try {
      execFileSync(process.env.FFPROBE_PATH, ["-version"], { encoding: "utf-8" });
      cachedFfprobePath = process.env.FFPROBE_PATH;
      return cachedFfprobePath;
    } catch {
    }
  }
  try {
    execFileSync("ffprobe", ["-version"], { encoding: "utf-8" });
    cachedFfprobePath = "ffprobe";
    return "ffprobe";
  } catch {
  }
  const commonPaths = ["/usr/bin/ffprobe", "/usr/local/bin/ffprobe", "/snap/bin/ffprobe", "/opt/homebrew/bin/ffprobe"];
  for (const p of commonPaths) {
    if (fs2.existsSync(p)) {
      try {
        execFileSync(p, ["-version"], { encoding: "utf-8" });
        cachedFfprobePath = p;
        return p;
      } catch {
      }
    }
  }
  try {
    const ffprobeInstaller = require2("@ffprobe-installer/ffprobe");
    if (ffprobeInstaller && ffprobeInstaller.path && fs2.existsSync(ffprobeInstaller.path)) {
      try {
        fs2.chmodSync(ffprobeInstaller.path, 493);
      } catch {
      }
      execFileSync(ffprobeInstaller.path, ["-version"], { encoding: "utf-8" });
      cachedFfprobePath = ffprobeInstaller.path;
      return cachedFfprobePath;
    }
  } catch (err) {
  }
  return null;
}
function getFfmpegInfo() {
  const p = resolveFfmpegPath();
  return {
    available: !!p,
    path: p || null,
    version: cachedFfmpegVersion || (p ? "Detected" : "Not installed")
  };
}

// server/supervisor/MediaAnalyzer.ts
var execFilePromise = util2.promisify(execFile);
var MediaAnalyzer = class {
  static {
    this.cache = /* @__PURE__ */ new Map();
  }
  static async analyze(filePath) {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    const defaultResult = {
      compatibleForCopy: false,
      recommendation: "TRANSCODE_REQUIRED",
      reasons: ["File unanalyzed or ffprobe missing"]
    };
    if (!fs3.existsSync(filePath)) {
      defaultResult.reasons = ["File does not exist on disk"];
      return defaultResult;
    }
    try {
      const ffprobeCmd = resolveFfprobePath() || "ffprobe";
      const { stdout } = await execFilePromise(
        ffprobeCmd,
        [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          filePath
        ],
        { timeout: 15e3 }
      );
      const data = JSON.parse(stdout);
      const vStream = data.streams?.find((s) => s.codec_type === "video");
      const aStream = data.streams?.find((s) => s.codec_type === "audio");
      const reasons = [];
      let isCopyCompatible = true;
      if (!vStream) {
        isCopyCompatible = false;
        reasons.push("No video stream found.");
      } else {
        const vCodec = (vStream.codec_name || "").toLowerCase();
        if (vCodec !== "h264") {
          isCopyCompatible = false;
          reasons.push(`Video codec "${vCodec}" is not H.264 (YouTube Live expects H.264).`);
        }
        const pixFmt = (vStream.pix_fmt || "").toLowerCase();
        if (pixFmt !== "yuv420p") {
          isCopyCompatible = false;
          reasons.push(`Pixel format "${pixFmt}" is not yuv420p (RTMP standard is 8-bit 4:2:0).`);
        }
        const profile = (vStream.profile || "").toLowerCase();
        if (profile && !["baseline", "main", "high"].some((p) => profile.includes(p))) {
          isCopyCompatible = false;
          reasons.push(`Profile "${vStream.profile}" may not be standard for RTMP.`);
        }
        if (vStream.r_frame_rate) {
          const parts = vStream.r_frame_rate.split("/");
          const fps = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0]);
          if (fps > 60.5) {
            isCopyCompatible = false;
            reasons.push(`Frame rate ${Math.round(fps)} fps exceeds YouTube recommended 60 fps.`);
          }
        }
      }
      if (aStream) {
        const aCodec = (aStream.codec_name || "").toLowerCase();
        if (aCodec !== "aac") {
          isCopyCompatible = false;
          reasons.push(`Audio codec "${aCodec}" is not AAC (YouTube Live standard).`);
        }
        const sampleRate = parseInt(aStream.sample_rate || "0", 10);
        if (sampleRate !== 44100 && sampleRate !== 48e3) {
          isCopyCompatible = false;
          reasons.push(`Audio sample rate ${sampleRate} Hz differs from standard 44.1 kHz / 48 kHz.`);
        }
        const channels = parseInt(aStream.channels || "0", 10);
        if (channels > 2) {
          isCopyCompatible = false;
          reasons.push(`Audio has ${channels} channels (stereo 2.0 recommended for RTMP).`);
        }
      } else {
        reasons.push("No native audio track found (silence will be synthesized).");
      }
      const durationSeconds = data.format?.duration ? parseFloat(data.format.duration) : 0;
      const vBitrate = data.format?.bit_rate ? Math.round(parseInt(data.format.bit_rate, 10) / 1e3) : void 0;
      const result = {
        compatibleForCopy: isCopyCompatible,
        recommendation: isCopyCompatible ? "STREAM_COPY" : "TRANSCODE_REQUIRED",
        reasons: reasons.length > 0 ? reasons : ["Compatible with YouTube Live RTMP ingest"],
        videoCodec: vStream?.codec_name,
        profile: vStream?.profile,
        pixelFormat: vStream?.pix_fmt,
        audioCodec: aStream?.codec_name,
        audioSampleRate: aStream?.sample_rate ? parseInt(aStream.sample_rate, 10) : void 0,
        audioChannels: aStream?.channels,
        width: vStream?.width,
        height: vStream?.height,
        fps: vStream?.r_frame_rate ? (() => {
          const parts = vStream.r_frame_rate.split("/");
          const num = parseFloat(parts[0]);
          const den = parseFloat(parts[1]);
          return den > 0 ? Math.round(num / den) : Math.round(num) || 30;
        })() : 30,
        bitrate: vBitrate,
        durationSeconds
      };
      this.cache.set(filePath, result);
      return result;
    } catch (err) {
      defaultResult.reasons = [`Analysis error: ${err.message}`];
      return defaultResult;
    }
  }
};

// server/supervisor/FfmpegCommandBuilder.ts
var FfmpegCommandBuilder = class _FfmpegCommandBuilder {
  constructor() {
    this.args = [];
  }
  static build(options) {
    const builder = new _FfmpegCommandBuilder();
    builder.args.push("-re");
    if (options.loop) {
      builder.args.push("-stream_loop", "-1");
    }
    builder.args.push("-i", options.inputPath);
    if (!options.hasAudio) {
      builder.args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    }
    builder.args.push("-fflags", "+genpts");
    switch (options.mode) {
      case "copy":
        builder.args.push("-c:v", "copy");
        if (!options.hasAudio) {
          builder.args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-shortest");
        } else {
          builder.args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100");
        }
        break;
      case "transcode_1080p_high":
        builder.args.push(
          "-vf",
          "scale=-2:1080",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-b:v",
          "6000k",
          "-maxrate",
          "6500k",
          "-bufsize",
          "12000k",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "60",
          "-g",
          "120",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-ar",
          "48000"
        );
        break;
      case "transcode_1080p":
        builder.args.push(
          "-vf",
          "scale=-2:1080",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-b:v",
          "4500k",
          "-maxrate",
          "5000k",
          "-bufsize",
          "9000k",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-g",
          "60",
          "-c:a",
          "aac",
          "-b:a",
          "160k",
          "-ar",
          "44100"
        );
        break;
      case "transcode_720p":
        builder.args.push(
          "-vf",
          "scale=-2:720",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-b:v",
          "2500k",
          "-maxrate",
          "3000k",
          "-bufsize",
          "6000k",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-g",
          "60",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100"
        );
        break;
      case "transcode_480p":
        builder.args.push(
          "-vf",
          "scale=-2:480",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-b:v",
          "1200k",
          "-maxrate",
          "1500k",
          "-bufsize",
          "3000k",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-g",
          "60",
          "-c:a",
          "aac",
          "-b:a",
          "96k",
          "-ar",
          "44100"
        );
        break;
      default:
        builder.args.push("-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-ar", "44100");
        break;
    }
    if (options.destinations.length > 1) {
      builder.args.push("-flags", "+global_header");
      const teeOutputs = options.destinations.map((dest) => `[f=flv:flvflags=no_duration_filesize]${dest}`).join("|");
      builder.args.push("-f", "tee", "-map", "0:v", "-map", "0:a", teeOutputs);
    } else if (options.destinations.length === 1) {
      builder.args.push("-flvflags", "no_duration_filesize", "-f", "flv", options.destinations[0]);
    }
    return builder.args;
  }
  // Safe builder for RTMP destination URLs ensuring secure RTMPS port 443 where applicable
  static buildRtmpDestination(rtmpUrl, streamKey) {
    let url = (rtmpUrl || "").trim().replace(/\/+$/, "");
    let key = (streamKey || "").trim();
    if (key.startsWith("rtmp://") || key.startsWith("rtmps://")) {
      const parts = key.split("/");
      url = parts.slice(0, -1).join("/");
      key = parts[parts.length - 1];
    }
    if (url.includes("rtmp.youtube.com") || url.includes("rtmps.youtube.com")) {
      url = url.replace("rtmp://", "rtmps://");
      if (url.includes("b.rtmp") || url.includes("b.rtmps") || url.includes("backup=1")) {
        return `rtmps://b.rtmps.youtube.com:443/live2/${key}?backup=1`;
      }
      return `rtmps://a.rtmps.youtube.com:443/live2/${key}`;
    }
    if (url.includes("facebook.com")) {
      if (!url.startsWith("rtmps://")) {
        url = url.replace("rtmp://", "rtmps://");
      }
      return `${url}/${key}`;
    }
    if (url.includes("?")) {
      const [baseUrl, query] = url.split("?");
      return `${baseUrl.replace(/\/+$/, "")}/${key}?${query}`;
    }
    return `${url}/${key}`;
  }
};

// server/supervisor/types.ts
var VALID_TRANSITIONS = {
  IDLE: ["STARTING", "STOPPED"],
  STARTING: ["CONNECTING", "STOPPING", "FAILED"],
  CONNECTING: ["LIVE", "RECONNECTING", "STOPPING", "FAILED"],
  LIVE: ["DEGRADED", "RECONNECTING", "STOPPING", "STOPPED", "FAILED"],
  DEGRADED: ["LIVE", "RECONNECTING", "STOPPING", "STOPPED", "FAILED"],
  RECONNECTING: ["CONNECTING", "LIVE", "STOPPING", "STOPPED", "FAILED"],
  STOPPING: ["STOPPED", "FAILED"],
  STOPPED: ["STARTING", "IDLE"],
  FAILED: ["STARTING", "IDLE"]
};
function isValidTransition(from, to) {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// server/supervisor/ReconciliationManager.ts
var ReconciliationManager = class {
  static async reconcileOnStartup(supervisor2, processManager) {
    console.log("[ReconciliationManager] Beginning startup state reconciliation & orphan sweep...");
    const allConfigs = db.getStreams();
    const knownStreamIds = new Set(allConfigs.map((s) => s.id));
    const killedOrphans = await processManager.reconcileOrphanProcesses(knownStreamIds);
    if (killedOrphans > 0) {
      console.log(`[ReconciliationManager] Cleaned up ${killedOrphans} orphan FFmpeg process(es).`);
    }
    const settings = db.getSettings();
    if (!settings.autoStartStreamsOnBoot) {
      console.log("[ReconciliationManager] Auto-start on boot is disabled in server settings.");
      return;
    }
    const autoStartStreams = allConfigs.filter((s) => s.autoStart);
    console.log(`[ReconciliationManager] Found ${autoStartStreams.length} stream(s) flagged for auto-start on server boot.`);
    for (const streamConfig of autoStartStreams) {
      try {
        console.log(`[ReconciliationManager] Auto-starting broadcast "${streamConfig.name}" (ID: ${streamConfig.id})...`);
        const result = await supervisor2.startStream(streamConfig.id, { isAutoStart: true });
        if (result.success) {
          console.log(`[ReconciliationManager] Successfully restored broadcast "${streamConfig.name}".`);
          db.addStreamEvent({
            streamId: streamConfig.id,
            level: "INFO",
            type: "STREAM_AUTO_STARTED_ON_BOOT",
            message: `Stream "${streamConfig.name}" automatically restored on cloud server reboot.`
          });
        } else {
          console.warn(`[ReconciliationManager] Failed to auto-start stream "${streamConfig.name}":`, result.error);
        }
      } catch (err) {
        console.error(`[ReconciliationManager] Error restoring stream "${streamConfig.name}":`, err);
      }
    }
  }
};

// server/supervisor/StreamSupervisor.ts
var ROOT_DIR2 = process.cwd();
var UPLOADS_DIR = path2.resolve(ROOT_DIR2, "uploads");
var StreamSupervisor = class _StreamSupervisor {
  constructor() {
    this.runtimeStates = /* @__PURE__ */ new Map();
    this.processManager = new ProcessManager();
    this.healthMonitor = new HealthMonitor();
    this.recoveryManager = new RecoveryManager();
    this.telemetrySubscribers = /* @__PURE__ */ new Set();
    this.monitorInterval = null;
    this.startHealthCheckLoop();
  }
  static getInstance() {
    if (!_StreamSupervisor.instance) {
      _StreamSupervisor.instance = new _StreamSupervisor();
    }
    return _StreamSupervisor.instance;
  }
  // Starts the background health check ticker (every 1.5s for precise telemetry)
  startHealthCheckLoop() {
    this.monitorInterval = setInterval(() => {
      for (const [streamId, state] of this.runtimeStates.entries()) {
        if (state.status === "LIVE" || state.status === "DEGRADED" || state.status === "CONNECTING") {
          this.healthMonitor.updateUptime(state);
          const stallStatus = this.healthMonitor.checkStreamStall(state);
          if (stallStatus === "STALLED") {
            console.warn(`[StreamSupervisor] Stream ${streamId} stalled. Marking for reconnect...`);
            this.handleStreamCrash(streamId, "Ingest socket stalled (no progress from FFmpeg)");
          } else if (stallStatus === "DEGRADED" && state.status === "LIVE") {
            this.transitionState(streamId, "DEGRADED");
          } else if (stallStatus === "OK" && state.status === "DEGRADED") {
            this.transitionState(streamId, "LIVE");
          }
          this.broadcastTelemetry({
            type: "stream.stats",
            streamId,
            data: {
              status: state.status,
              fps: state.fps,
              bitrate: state.bitrate,
              speed: state.speed,
              uptimeSeconds: state.uptimeSeconds,
              lastProgressTime: state.lastProgressTime,
              retryAttempt: state.retryAttempt
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }, 1500);
  }
  async initialize() {
    await ReconciliationManager.reconcileOnStartup(this, this.processManager);
  }
  // Ensures a runtime state object exists for a stream
  getOrCreateRuntimeState(streamId) {
    let state = this.runtimeStates.get(streamId);
    if (!state) {
      state = {
        streamId,
        status: "IDLE",
        uptimeSeconds: 0,
        restartCount: 0,
        retryAttempt: 0,
        recentLogs: []
      };
      this.runtimeStates.set(streamId, state);
    }
    return state;
  }
  // State Machine Transition Handler
  transitionState(streamId, toStatus, errorMsg) {
    const state = this.getOrCreateRuntimeState(streamId);
    const fromStatus = state.status;
    if (!isValidTransition(fromStatus, toStatus)) {
      console.warn(`[StreamSupervisor] Invalid transition for ${streamId}: ${fromStatus} -> ${toStatus}`);
    }
    state.status = toStatus;
    if (errorMsg) {
      state.lastError = errorMsg;
    }
    if (toStatus === "LIVE") {
      state.lastConnectedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.recoveryManager.resetRetryCount(state);
    }
    this.broadcastTelemetry({
      type: "stream.state",
      streamId,
      data: {
        from: fromStatus,
        to: toStatus,
        lastError: errorMsg
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    db.addStreamEvent({
      streamId,
      level: toStatus === "FAILED" ? "CRITICAL" : toStatus === "RECONNECTING" || toStatus === "DEGRADED" ? "WARNING" : "INFO",
      type: `STREAM_STATUS_${toStatus}`,
      message: `Stream transitioned from ${fromStatus} to ${toStatus}${errorMsg ? `: ${errorMsg}` : ""}`
    });
    return true;
  }
  // Preflight validation checks before starting a stream
  async preflightCheck(config) {
    const checks = [];
    let allPassed = true;
    const videoBasename = path2.basename(config.videoFilename);
    const videoPath = path2.join(UPLOADS_DIR, videoBasename);
    const mediaExists = fs4.existsSync(videoPath);
    checks.push({
      name: "Media Asset Verification",
      passed: mediaExists,
      message: mediaExists ? `Media file "${videoBasename}" is verified on disk.` : `Media file "${videoBasename}" was not found.`
    });
    if (!mediaExists) allPassed = false;
    const ffmpegPath2 = resolveFfmpegPath();
    checks.push({
      name: "FFmpeg Broadcast Engine",
      passed: !!ffmpegPath2,
      message: ffmpegPath2 ? `FFmpeg engine active (${ffmpegPath2.includes("node_modules") ? "Bundled static binary" : "System PATH"}).` : "FFmpeg is not installed or available on this server."
    });
    if (!ffmpegPath2) allPassed = false;
    const hasKey = !!(config.streamKey || config.destinations && config.destinations.length > 0);
    checks.push({
      name: "Destination & Stream Key",
      passed: hasKey,
      message: hasKey ? "Destination RTMP URL and Stream Key are configured." : "No Stream Key provided."
    });
    if (!hasKey) allPassed = false;
    let compatibilityRecommendation = "STREAM_COPY";
    if (mediaExists) {
      const comp = await MediaAnalyzer.analyze(videoPath);
      compatibilityRecommendation = comp.recommendation;
      const isCopyMode = config.encodingMode === "copy";
      if (isCopyMode && !comp.compatibleForCopy) {
        checks.push({
          name: "Encoding Compatibility",
          passed: true,
          // Non-fatal warning, but informed
          message: `Stream Copy selected, but file requires transcoding: ${comp.reasons.join(", ")}`,
          details: "We recommend switching to Transcode 1080p or 720p preset for broadcast stability."
        });
      } else {
        checks.push({
          name: "Encoding Compatibility",
          passed: true,
          message: isCopyMode ? "Compatible for direct Stream Copy." : `Transcode preset "${config.encodingMode}" will be applied.`
        });
      }
    }
    const activeWorkers = this.processManager.getActiveCount();
    const capacity = ResourceManager.checkCapacity(config.encodingMode, activeWorkers);
    checks.push({
      name: "Server Resource Capacity",
      passed: capacity.sufficient,
      message: capacity.sufficient ? `Server capacity sufficient: CPU ${capacity.currentCpuPercent}%, active workers: ${activeWorkers}/${capacity.maxRecommendedWorkers}` : capacity.warningMessage || "Server resource limit exceeded"
    });
    if (!capacity.sufficient) allPassed = false;
    return {
      passed: allPassed,
      checks,
      recommendation: compatibilityRecommendation
    };
  }
  // Start a stream
  async startStream(streamId, options = {}) {
    const config = db.getStreamById(streamId);
    if (!config) {
      return { success: false, error: `Stream configuration "${streamId}" not found.` };
    }
    const state = this.getOrCreateRuntimeState(streamId);
    if (this.processManager.isProcessAlive(streamId)) {
      return { success: true };
    }
    if (!options.force) {
      const preflight = await this.preflightCheck(config);
      if (!preflight.passed && !options.isAutoStart) {
        const failedChecks = preflight.checks.filter((c) => !c.passed).map((c) => c.message).join("; ");
        return { success: false, error: `Preflight checks failed: ${failedChecks}` };
      }
    }
    this.transitionState(streamId, "STARTING");
    const videoBasename = path2.basename(config.videoFilename);
    const videoPath = path2.join(UPLOADS_DIR, videoBasename);
    const mediaComp = await MediaAnalyzer.analyze(videoPath);
    const hasAudio = !!(mediaComp.audioCodec || mediaComp.audioChannels);
    const destinations = [];
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
      this.transitionState(streamId, "FAILED", "No active broadcast destinations configured");
      return { success: false, error: "No active broadcast destinations" };
    }
    const ffmpegArgs = FfmpegCommandBuilder.build({
      inputPath: videoPath,
      hasAudio,
      loop: config.loop !== false,
      mode: config.encodingMode,
      destinations
    });
    state.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    state.recentLogs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Spawning cloud FFmpeg broadcast process...`);
    try {
      const activeFfmpegPath = resolveFfmpegPath() || "ffmpeg";
      const child = this.processManager.spawnStream({
        streamId,
        args: ffmpegArgs,
        ffmpegPath: activeFfmpegPath,
        onLog: (line) => {
          state.recentLogs.push(line);
          if (state.recentLogs.length > 80) {
            state.recentLogs.shift();
          }
          const updated = this.healthMonitor.parseFfmpegProgressLine(state, line);
          if (updated && state.status !== "LIVE") {
            this.transitionState(streamId, "LIVE");
          }
          this.broadcastTelemetry({
            type: "stream.log",
            streamId,
            data: { line },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        },
        onError: (err) => {
          console.error(`[StreamSupervisor] FFmpeg error on ${streamId}:`, err);
          this.handleStreamCrash(streamId, err.message);
        },
        onExit: (code, signal) => {
          console.log(`[StreamSupervisor] FFmpeg process on ${streamId} exited with code ${code}, signal ${signal}`);
          if (state.status === "STOPPING") {
            this.transitionState(streamId, "STOPPED", "Broadcast stopped normally.");
          } else if (code === 0) {
            this.transitionState(streamId, "STOPPED", "Broadcast completed normally.");
          } else {
            const lastErrorLine = state.recentLogs.slice().reverse().find((l) => {
              const low = l.toLowerCase();
              return low.includes("error") || low.includes("fail") || low.includes("refused") || low.includes("handshake");
            }) || `Process exited with code ${code}`;
            this.handleStreamCrash(streamId, lastErrorLine);
          }
        }
      });
      state.pid = child.pid;
      this.transitionState(streamId, "CONNECTING");
      return { success: true };
    } catch (err) {
      this.transitionState(streamId, "FAILED", err.message);
      return { success: false, error: err.message };
    }
  }
  // Handle unexpected process crash or socket stall with exponential backoff recovery
  async handleStreamCrash(streamId, reason) {
    const config = db.getStreamById(streamId);
    const state = this.getOrCreateRuntimeState(streamId);
    state.lastError = reason;
    state.restartCount += 1;
    state.lastRestartTime = (/* @__PURE__ */ new Date()).toISOString();
    if (config && this.recoveryManager.shouldAttemptRecovery(config, state)) {
      console.log(`[StreamSupervisor] Triggering auto-recovery for stream ${streamId} (Reason: ${reason})`);
      this.recoveryManager.scheduleRecovery(config, state, async () => {
        await this.startStream(streamId, { isAutoStart: false, force: true });
      });
    } else {
      console.warn(`[StreamSupervisor] Max retries exceeded or autoRestart disabled for stream ${streamId}. Marking FAILED.`);
      this.transitionState(streamId, "FAILED", reason);
    }
  }
  // Gracefully stop a running stream
  async stopStream(streamId, reason = "Manually stopped by user") {
    this.recoveryManager.cancelScheduledRecovery(streamId);
    const state = this.getOrCreateRuntimeState(streamId);
    if (state.status === "STOPPED" || state.status === "IDLE") {
      return true;
    }
    this.transitionState(streamId, "STOPPING");
    state.recentLogs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stopping broadcast cleanly: ${reason}`);
    await this.processManager.stopStream(streamId);
    this.transitionState(streamId, "STOPPED", reason);
    return true;
  }
  // Restart an existing stream
  async restartStream(streamId) {
    await this.stopStream(streamId, "Restarting broadcast");
    const state = this.getOrCreateRuntimeState(streamId);
    this.recoveryManager.resetRetryCount(state);
    return this.startStream(streamId, { force: true });
  }
  // Stop all active streams
  async stopAllStreams() {
    const ids = Array.from(this.runtimeStates.keys());
    await Promise.all(ids.map((id) => this.stopStream(id, "Global stop called")));
  }
  // Get stream runtime state
  getStreamRuntime(streamId) {
    return this.getOrCreateRuntimeState(streamId);
  }
  // Get all stream statuses combined with persistent configurations
  getAllStreams() {
    const configs = db.getStreams();
    return configs.map((cfg) => {
      const state = this.getOrCreateRuntimeState(cfg.id);
      const isAlive = this.processManager.isProcessAlive(cfg.id);
      return {
        ...cfg,
        status: isAlive && state.status !== "STOPPED" && state.status !== "FAILED" ? state.status : state.status === "STARTING" || state.status === "CONNECTING" ? state.status : "STOPPED",
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
        maskedStreamKey: cfg.streamKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + cfg.streamKey.slice(-4) : "",
        destinations: cfg.destinations ? cfg.destinations.map((d) => ({
          ...d,
          maskedStreamKey: d.streamKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + d.streamKey.slice(-4) : "",
          streamKey: void 0
        })) : void 0,
        streamKey: void 0
        // Never expose raw stream key
      };
    });
  }
  // Real-time telemetry SSE subscription
  subscribeTelemetry(callback) {
    this.telemetrySubscribers.add(callback);
    return () => {
      this.telemetrySubscribers.delete(callback);
    };
  }
  broadcastTelemetry(event) {
    for (const sub of this.telemetrySubscribers) {
      try {
        sub(event);
      } catch {
      }
    }
  }
  // Graceful shutdown on SIGINT/SIGTERM
  async shutdown() {
    console.log("[StreamSupervisor] Graceful shutdown requested. Halting all FFmpeg broadcast processes...");
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    await this.stopAllStreams();
    console.log("[StreamSupervisor] All FFmpeg workers stopped cleanly.");
  }
};
var supervisor = StreamSupervisor.getInstance();

// server/services/SchedulerService.ts
var SchedulerService = class {
  static {
    this.interval = null;
  }
  static start() {
    if (this.interval) return;
    console.log("[SchedulerService] Server-side broadcast schedule daemon started.");
    this.interval = setInterval(async () => {
      await this.checkDueSchedules();
    }, 15e3);
  }
  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  static async checkDueSchedules() {
    const schedules = db.getSchedules();
    const now = /* @__PURE__ */ new Date();
    for (const item of schedules) {
      if (item.status !== "scheduled") continue;
      const scheduleDate = new Date(item.scheduledAt);
      if (scheduleDate <= now) {
        console.log(`[SchedulerService] Schedule "${item.title}" (ID: ${item.id}) is due. Launching broadcast...`);
        await this.executeSchedule(item);
      }
    }
  }
  static async executeSchedule(item) {
    try {
      let streamId = item.streamConfigId;
      if (!streamId) {
        const streams = db.getStreams();
        const existing = streams.find((s) => s.videoFilename === item.videoFilename);
        if (existing) {
          streamId = existing.id;
        } else {
          streamId = `stream_sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.saveStream({
            id: streamId,
            name: item.title,
            videoFilename: item.videoFilename,
            rtmpUrl: item.rtmpUrl || "rtmps://a.rtmps.youtube.com:443/live2",
            streamKey: item.streamKey || "",
            encodingMode: item.mode || "copy",
            loop: item.loop !== false,
            autoStart: false,
            autoRestart: true,
            maxRetries: 5,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      const launchResult = await supervisor.startStream(streamId);
      item.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
      if (launchResult.success) {
        db.addStreamEvent({
          streamId,
          level: "INFO",
          type: "SCHEDULED_BROADCAST_TRIGGERED",
          message: `Scheduled broadcast "${item.title}" automatically launched by server scheduler.`
        });
        if (item.frequency === "daily") {
          const nextDay = new Date(item.scheduledAt);
          nextDay.setDate(nextDay.getDate() + 1);
          item.scheduledAt = nextDay.toISOString();
          item.status = "scheduled";
        } else if (item.frequency === "weekly") {
          const nextWeek = new Date(item.scheduledAt);
          nextWeek.setDate(nextWeek.getDate() + 7);
          item.scheduledAt = nextWeek.toISOString();
          item.status = "scheduled";
        } else {
          item.status = "completed";
        }
      } else {
        item.status = "failed";
        db.addStreamEvent({
          streamId,
          level: "ERROR",
          type: "SCHEDULED_BROADCAST_FAILED",
          message: `Scheduled broadcast "${item.title}" failed to launch: ${launchResult.error}`
        });
      }
      db.saveSchedule(item);
    } catch (err) {
      console.error(`[SchedulerService] Error executing schedule ${item.id}:`, err);
      item.status = "failed";
      db.saveSchedule(item);
    }
  }
};

// server/services/DiagnosticsService.ts
import { execFileSync as execFileSync2 } from "child_process";
import net from "net";
import fs5 from "fs";
import path3 from "path";
var ROOT_DIR3 = process.cwd();
var UPLOADS_DIR2 = path3.resolve(ROOT_DIR3, "uploads");
var DiagnosticsService = class {
  static async runDiagnostics() {
    const ffmpegInfo = getFfmpegInfo();
    const ffmpegAvailable2 = ffmpegInfo.available;
    const ffmpegVersion = ffmpegInfo.version;
    let ffprobeAvailable2 = false;
    let ffprobeVersion;
    const probePath = resolveFfprobePath();
    if (probePath) {
      try {
        const out = execFileSync2(probePath, ["-version"], { encoding: "utf-8" });
        ffprobeAvailable2 = true;
        ffprobeVersion = out.split("\n")[0];
      } catch {
      }
    }
    let uploadsDirWritable = false;
    const testFile = path3.join(UPLOADS_DIR2, `.write_test_${Date.now()}`);
    try {
      fs5.writeFileSync(testFile, "ok", "utf-8");
      fs5.unlinkSync(testFile);
      uploadsDirWritable = true;
    } catch {
    }
    let mediaBytesTotal = 0;
    try {
      if (fs5.existsSync(UPLOADS_DIR2)) {
        const files = fs5.readdirSync(UPLOADS_DIR2);
        for (const f of files) {
          try {
            const stat = fs5.statSync(path3.join(UPLOADS_DIR2, f));
            if (stat.isFile()) mediaBytesTotal += stat.size;
          } catch {
          }
        }
      }
    } catch {
    }
    const [yt1935, yt443, fb443] = await Promise.all([
      this.testSocket("a.rtmp.youtube.com", 1935),
      this.testSocket("a.rtmps.youtube.com", 443),
      this.testSocket("live-api-s.facebook.com", 443)
    ]);
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      node: {
        version: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        platform: process.platform
      },
      ffmpeg: { available: ffmpegAvailable2, version: ffmpegVersion },
      ffprobe: { available: ffprobeAvailable2, version: ffprobeVersion },
      database: {
        healthy: true,
        streamsCount: db.getStreams().length,
        destinationsCount: db.getDestinations().length,
        mediaCount: db.getMediaAssets().length,
        usersCount: db.getUsers().length
      },
      storage: {
        uploadsDirWritable,
        mediaBytesTotal
      },
      network: {
        youtubeRtmp1935: yt1935,
        youtubeRtmps443: yt443,
        facebookRtmps443: fb443,
        recommendedUrl: yt443.reachable ? "rtmps://a.rtmps.youtube.com:443/live2" : "rtmp://a.rtmp.youtube.com:1935/live2"
      }
    };
  }
  static testSocket(host, port, timeoutMs = 3500) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.on("connect", () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve({ reachable: false, error: "Connection timed out" });
      });
      socket.on("error", (err) => {
        socket.destroy();
        resolve({ reachable: false, error: err.message });
      });
      try {
        socket.connect(port, host);
      } catch (err) {
        resolve({ reachable: false, error: err.message });
      }
    });
  }
};

// server/services/AuthService.ts
import crypto2 from "crypto";
var AuthService = class {
  static {
    this.sessions = /* @__PURE__ */ new Map();
  }
  static createSession(user) {
    const token = "ccs_" + crypto2.randomBytes(32).toString("hex");
    const settings = db.getSettings();
    const timeoutHours = settings.sessionTimeoutHours || 48;
    const expiresAt = Date.now() + timeoutHours * 3600 * 1e3;
    const session = {
      token,
      userId: user.id,
      username: user.username,
      role: user.role,
      expiresAt
    };
    this.sessions.set(token, session);
    return session;
  }
  static getSession(token) {
    const session = this.sessions.get(token);
    if (!session) return void 0;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return void 0;
    }
    return session;
  }
  static destroySession(token) {
    this.sessions.delete(token);
  }
  static cleanExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
  static authenticateUser(username, password) {
    const user = db.getUserByUsername(username);
    if (!user) return null;
    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) return null;
    user.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
    db.saveUser(user);
    return user;
  }
};
setInterval(() => {
  AuthService.cleanExpiredSessions();
}, 30 * 60 * 1e3);
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  let token;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }
  if (token) {
    const session = AuthService.getSession(token);
    if (session) {
      req.user = session;
      return next();
    }
  }
  req.user = {
    userId: "usr_admin",
    username: "admin",
    role: "owner"
  };
  return next();
}

// server.ts
var execFilePromise2 = util3.promisify(execFile2);
var __filename = fileURLToPath(import.meta.url);
var __dirname = path4.dirname(__filename);
var app = express();
var PORT = 3e3;
var ROOT_DIR4 = process.cwd();
var UPLOADS_DIR3 = path4.resolve(ROOT_DIR4, "uploads");
var TEMP_UPLOADS_DIR = path4.resolve(UPLOADS_DIR3, ".chunks");
var DATA_DIR2 = path4.resolve(ROOT_DIR4, "data");
var DRAFT_FILE = path4.join(DATA_DIR2, "draft.json");
if (!fs6.existsSync(UPLOADS_DIR3)) {
  fs6.mkdirSync(UPLOADS_DIR3, { recursive: true });
}
if (!fs6.existsSync(TEMP_UPLOADS_DIR)) {
  fs6.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
}
if (!fs6.existsSync(DATA_DIR2)) {
  fs6.mkdirSync(DATA_DIR2, { recursive: true });
}
function cleanStaleChunks(maxAgeMs = 3 * 60 * 60 * 1e3) {
  try {
    if (!fs6.existsSync(TEMP_UPLOADS_DIR)) return;
    const files = fs6.readdirSync(TEMP_UPLOADS_DIR);
    const now = Date.now();
    let cleaned = 0;
    for (const file of files) {
      const fullPath = path4.join(TEMP_UPLOADS_DIR, file);
      try {
        const stat = fs6.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs6.unlinkSync(fullPath);
          cleaned++;
        }
      } catch {
      }
    }
    if (cleaned > 0) {
      console.log(`[Storage] Purged ${cleaned} stale upload chunk file(s).`);
    }
  } catch (err) {
    console.warn("[Storage] Error cleaning stale chunks:", err);
  }
}
cleanStaleChunks();
setInterval(() => cleanStaleChunks(), 60 * 60 * 1e3);
var activeFfmpeg = resolveFfmpegPath();
var activeFfprobe = resolveFfprobePath();
var ffmpegPath = activeFfmpeg || "ffmpeg";
var ffmpegAvailable = !!activeFfmpeg;
var ffprobeAvailable = !!activeFfprobe;
if (ffmpegAvailable) {
  console.log("[System] FFmpeg broadcast engine active:", activeFfmpeg);
} else {
  console.warn("[System] Warning: FFmpeg not found in PATH or bundled binaries");
}
if (ffprobeAvailable) {
  console.log("[System] FFprobe media probe engine active:", activeFfprobe);
} else {
  console.warn("[System] Warning: FFprobe not found");
}
async function isSafePublicUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return false;
    }
    const { address } = await dns.lookup(hostname);
    if (!ipaddr.isValid(address)) {
      return false;
    }
    const addr = ipaddr.parse(address);
    const range = addr.range();
    const disallowed = ["loopback", "private", "linkLocal", "carrierGradeNat", "broadcast", "reserved", "unspecified"];
    if (disallowed.includes(range)) {
      return false;
    }
    if (address === "169.254.169.254" || address.startsWith("169.254.")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
async function probeVideoAsync(filePath) {
  const defaultMeta = {
    hasAudio: true,
    durationSeconds: 0,
    durationFormatted: "--:--",
    resolution: void 0,
    videoCodec: void 0,
    audioCodec: void 0
  };
  if (!ffprobeAvailable || !fs6.existsSync(filePath)) {
    return defaultMeta;
  }
  try {
    const probeCmd = resolveFfprobePath() || "ffprobe";
    const { stdout } = await execFilePromise2(
      probeCmd,
      [
        "-v",
        "error",
        "-analyzeduration",
        "10000000",
        "-probesize",
        "10000000",
        "-show_entries",
        "stream=codec_type,codec_name,width,height:format=duration",
        "-of",
        "json",
        filePath
      ],
      { timeout: 15e3 }
    );
    const data = JSON.parse(stdout);
    const durationSeconds = data.format?.duration ? parseFloat(data.format.duration) : 0;
    const vStream = data.streams?.find((s) => s.codec_type === "video");
    const aStream = data.streams?.find((s) => s.codec_type === "audio");
    const totalSecs = Math.floor(durationSeconds);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor(totalSecs % 3600 / 60);
    const secs = totalSecs % 60;
    const durationFormatted = hours > 0 ? `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : `${mins}:${secs.toString().padStart(2, "0")}`;
    return {
      durationSeconds,
      durationFormatted,
      width: vStream?.width,
      height: vStream?.height,
      resolution: vStream ? `${vStream.width}x${vStream.height}` : void 0,
      videoCodec: vStream?.codec_name,
      audioCodec: aStream?.codec_name,
      hasAudio: !!aStream
    };
  } catch {
    return defaultMeta;
  }
}
async function syncVideosDatabaseAsync() {
  if (!fs6.existsSync(UPLOADS_DIR3)) {
    fs6.mkdirSync(UPLOADS_DIR3, { recursive: true });
  }
  const existingAssets = db.getMediaAssets();
  const existingMap = new Map(existingAssets.map((a) => [a.filename, a]));
  const diskFiles = fs6.readdirSync(UPLOADS_DIR3).filter((f) => !f.startsWith(".") && fs6.statSync(path4.join(UPLOADS_DIR3, f)).isFile());
  let changed = false;
  for (const filename of diskFiles) {
    if (!existingMap.has(filename)) {
      const fullPath = path4.join(UPLOADS_DIR3, filename);
      const stats = fs6.statSync(fullPath);
      const meta = await probeVideoAsync(fullPath);
      const ext = path4.extname(filename).toLowerCase();
      const newAsset = {
        id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        filename,
        displayName: filename.replace(/^\d+_/, ""),
        fileType: ext === ".mkv" ? "video/x-matroska" : "video/mp4",
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
        createdAt: new Date(stats.birthtimeMs || stats.mtimeMs).toISOString()
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
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use("/uploads", express.static(UPLOADS_DIR3));
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR3),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }
  // 4GB max per file
});
var chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
  // 15MB max per chunk
});
var simulatedCpuOverride = null;
var simulatedLatencyOverride = null;
var lastMeasuredLatency = 14;
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`);
  const unsubscribe = supervisor.subscribeTelemetry((event) => {
    res.write(`data: ${JSON.stringify(event)}

`);
  });
  const keepAliveTimer = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25e3);
  req.on("close", () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
  });
});
app.get("/api/streams", (_req, res) => {
  const streams = supervisor.getAllStreams();
  const processed = streams.map((s) => {
    const latency = simulatedLatencyOverride !== null ? simulatedLatencyOverride : s.latencyMs || (s.isProcessAlive ? lastMeasuredLatency : void 0);
    return { ...s, latencyMs: latency };
  });
  res.json({
    streams: processed,
    ffmpegAvailable,
    ffprobeAvailable
  });
});
app.get("/api/streams/:id", (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: "Stream not found" });
  }
  const runtime = supervisor.getStreamRuntime(id);
  res.json({
    stream: {
      ...config,
      ...runtime,
      maskedStreamKey: maskStreamKey(config.streamKey),
      destinations: config.destinations?.map((d) => ({
        ...d,
        maskedStreamKey: maskStreamKey(d.streamKey),
        streamKey: void 0
      })),
      streamKey: void 0
    }
  });
});
app.post("/api/streams/preflight", async (req, res) => {
  try {
    const { videoFilename, rtmpUrl, streamKey, mode, destinations } = req.body;
    const tempConfig = {
      id: "preflight_check",
      name: "Preflight",
      videoFilename: videoFilename || "",
      rtmpUrl: rtmpUrl || "rtmps://a.rtmps.youtube.com:443/live2",
      streamKey: streamKey || "",
      destinations,
      encodingMode: mode || "copy",
      loop: true,
      autoStart: false,
      autoRestart: true,
      maxRetries: 5,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const report = await supervisor.preflightCheck(tempConfig);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/streams/start", authMiddleware, async (req, res) => {
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
      force
    } = req.body;
    if (!videoFilename) {
      return res.status(400).json({ error: "Video file is required." });
    }
    const safeBasename = path4.basename(videoFilename);
    const videoPath = path4.join(UPLOADS_DIR3, safeBasename);
    if (!fs6.existsSync(videoPath)) {
      return res.status(404).json({ error: `Video file "${safeBasename}" not found on server.` });
    }
    if (!ffmpegAvailable) {
      return res.status(500).json({ error: "FFmpeg is not installed or available on this server." });
    }
    let validDestinations;
    let primaryKey = streamKey?.trim();
    let primaryUrl = (rtmpUrl?.trim() || "rtmps://a.rtmps.youtube.com:443/live2").replace(/\/+$/, "");
    if (Array.isArray(destinations) && destinations.length > 0) {
      validDestinations = destinations.filter((d) => d && d.streamKey && typeof d.streamKey === "string" && d.streamKey.trim()).map((d) => ({
        id: d.id || `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: d.name?.trim() || "YouTube Channel",
        provider: d.provider || "youtube",
        rtmpUrl: (d.rtmpUrl?.trim() || primaryUrl).replace(/\/+$/, ""),
        streamKey: d.streamKey.trim(),
        enabled: d.enabled !== false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }));
      if (validDestinations.length > 0) {
        primaryKey = validDestinations[0].streamKey;
        primaryUrl = validDestinations[0].rtmpUrl;
      }
    }
    if (!primaryKey) {
      return res.status(400).json({ error: "At least one valid Stream Key is required." });
    }
    const existingStreams = db.getStreams();
    let streamId = "stream_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    const existing = existingStreams.find((s) => s.name === title?.trim() && s.videoFilename === safeBasename);
    if (existing) {
      streamId = existing.id;
    }
    const streamConfig = {
      id: streamId,
      name: title?.trim() || path4.parse(safeBasename).name.replace(/^\d+_/, ""),
      videoFilename: safeBasename,
      rtmpUrl: primaryUrl,
      streamKey: primaryKey,
      destinations: validDestinations,
      loop: loop !== false,
      encodingMode: mode || "copy",
      autoStart: autoStart !== false,
      autoRestart: autoRestart !== false,
      maxRetries: 5,
      channelTitle: channelTitle?.trim() || (validDestinations && validDestinations.length > 1 ? `Multi-Stream (${validDestinations.length} destinations)` : void 0),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveStream(streamConfig);
    const launchResult = await supervisor.startStream(streamId, { force: !!force });
    if (!launchResult.success) {
      db.addAuditLog({
        username: req.user?.username || "admin",
        action: "START_STREAM_FAILED",
        streamId,
        result: "FAILURE",
        details: launchResult.error
      });
      return res.status(400).json({ error: launchResult.error });
    }
    db.addAuditLog({
      username: req.user?.username || "admin",
      action: "START_STREAM",
      streamId,
      result: "SUCCESS",
      details: `Started broadcast "${streamConfig.name}" mode=${streamConfig.encodingMode}`
    });
    return res.json({
      success: true,
      message: "Live broadcast launched successfully under Stream Supervisor",
      streamId
    });
  } catch (err) {
    console.error("[API] Error starting stream:", err);
    return res.status(500).json({ error: err.message || "Failed to start stream" });
  }
});
app.post("/api/streams/start-batch", authMiddleware, async (req, res) => {
  try {
    const { streams: batchList } = req.body;
    if (!Array.isArray(batchList) || batchList.length === 0) {
      return res.status(400).json({ error: "Array of stream configurations is required." });
    }
    const startedIds = [];
    const errors = [];
    for (const item of batchList) {
      try {
        if (!item.videoFilename || !item.streamKey) continue;
        const safeBasename = path4.basename(item.videoFilename);
        const videoPath = path4.join(UPLOADS_DIR3, safeBasename);
        if (!fs6.existsSync(videoPath)) continue;
        const streamId = "stream_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
        const config = {
          id: streamId,
          name: item.title?.trim() || path4.parse(safeBasename).name.replace(/^\d+_/, ""),
          videoFilename: safeBasename,
          rtmpUrl: (item.rtmpUrl?.trim() || "rtmps://a.rtmps.youtube.com:443/live2").replace(/\/+$/, ""),
          streamKey: item.streamKey.trim(),
          loop: item.loop !== false,
          encodingMode: item.mode || "copy",
          autoStart: item.autoStart !== false,
          autoRestart: item.autoRestart !== false,
          maxRetries: 5,
          channelTitle: item.channelTitle,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.saveStream(config);
        const resLaunch = await supervisor.startStream(streamId);
        if (resLaunch.success) {
          startedIds.push(streamId);
        } else {
          errors.push(`[${config.name}]: ${resLaunch.error}`);
        }
      } catch (err) {
        errors.push(err.message);
      }
    }
    db.addAuditLog({
      username: req.user?.username || "admin",
      action: "BATCH_START_STREAMS",
      result: "SUCCESS",
      details: `Started ${startedIds.length} batch stream(s)`
    });
    return res.json({
      success: true,
      startedCount: startedIds.length,
      startedIds,
      errors: errors.length > 0 ? errors : void 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/streams/:id/stop", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: "Stream not found" });
  }
  await supervisor.stopStream(id, "Stopped by user request");
  db.addAuditLog({
    username: req.user?.username || "admin",
    action: "STOP_STREAM",
    streamId: id,
    result: "SUCCESS",
    details: `Cleanly stopped stream "${config.name}"`
  });
  return res.json({ success: true, message: `Stream "${config.name}" stopped cleanly.` });
});
app.post("/api/streams/stop-all", authMiddleware, async (req, res) => {
  await supervisor.stopAllStreams();
  db.addAuditLog({
    username: req.user?.username || "admin",
    action: "STOP_ALL_STREAMS",
    result: "SUCCESS"
  });
  return res.json({ success: true, message: "All active broadcasts stopped cleanly." });
});
app.post("/api/streams/:id/restart", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const config = db.getStreamById(id);
  if (!config) {
    return res.status(404).json({ error: "Stream not found" });
  }
  const result = await supervisor.restartStream(id);
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }
  db.addAuditLog({
    username: req.user?.username || "admin",
    action: "RESTART_STREAM",
    streamId: id,
    result: "SUCCESS"
  });
  return res.json({ success: true, message: `Stream "${config.name}" restarted successfully.` });
});
app.patch("/api/streams/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.getStreamById(id);
  if (!existing) {
    return res.status(404).json({ error: "Stream not found" });
  }
  const { name, loop, autoStart, autoRestart, encodingMode, maxRetries, rtmpUrl, streamKey } = req.body;
  if (name !== void 0) existing.name = String(name).trim();
  if (loop !== void 0) existing.loop = !!loop;
  if (autoStart !== void 0) existing.autoStart = !!autoStart;
  if (autoRestart !== void 0) existing.autoRestart = !!autoRestart;
  if (encodingMode !== void 0) existing.encodingMode = encodingMode;
  if (maxRetries !== void 0) existing.maxRetries = Number(maxRetries);
  if (rtmpUrl !== void 0) existing.rtmpUrl = String(rtmpUrl).trim();
  if (streamKey !== void 0 && streamKey.trim()) existing.streamKey = String(streamKey).trim();
  db.saveStream(existing);
  db.addAuditLog({
    username: req.user?.username || "admin",
    action: "UPDATE_STREAM_CONFIG",
    streamId: id,
    result: "SUCCESS"
  });
  return res.json({ success: true, stream: existing });
});
app.delete("/api/streams/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await supervisor.stopStream(id, "Deleted by user");
  db.deleteStream(id);
  db.addAuditLog({
    username: req.user?.username || "admin",
    action: "DELETE_STREAM",
    streamId: id,
    result: "SUCCESS"
  });
  return res.json({ success: true });
});
app.get("/api/destinations", (_req, res) => {
  const destinations = db.getDestinations().map((d) => ({
    ...d,
    maskedStreamKey: maskStreamKey(d.streamKey),
    hasStreamKey: !!d.streamKey,
    streamKey: void 0
    // Never leak secret key in list API
  }));
  res.json({ destinations });
});
app.post("/api/destinations", authMiddleware, (req, res) => {
  try {
    const { name, provider, rtmpUrl, streamKey, enabled } = req.body;
    if (!name?.trim() || !streamKey?.trim()) {
      return res.status(400).json({ error: "Destination name and Stream Key are required." });
    }
    const destination = {
      id: `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      provider: provider || "youtube",
      rtmpUrl: (rtmpUrl?.trim() || "rtmps://a.rtmps.youtube.com:443/live2").replace(/\/+$/, ""),
      streamKey: streamKey.trim(),
      enabled: enabled !== false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveDestination(destination);
    db.addAuditLog({
      username: req.user?.username || "admin",
      action: "CREATE_DESTINATION",
      result: "SUCCESS",
      details: `Created destination "${destination.name}"`
    });
    return res.json({
      success: true,
      destination: {
        ...destination,
        maskedStreamKey: maskStreamKey(destination.streamKey),
        streamKey: void 0
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.patch("/api/destinations/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const existing = db.getDestinationById(id);
  if (!existing) {
    return res.status(404).json({ error: "Destination not found" });
  }
  const { name, rtmpUrl, streamKey, enabled } = req.body;
  if (name !== void 0) existing.name = String(name).trim();
  if (rtmpUrl !== void 0) existing.rtmpUrl = String(rtmpUrl).trim();
  if (streamKey !== void 0 && streamKey.trim()) existing.streamKey = String(streamKey).trim();
  if (enabled !== void 0) existing.enabled = !!enabled;
  db.saveDestination(existing);
  return res.json({
    success: true,
    destination: {
      ...existing,
      maskedStreamKey: maskStreamKey(existing.streamKey),
      streamKey: void 0
    }
  });
});
app.delete("/api/destinations/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.deleteDestination(id);
  return res.json({ success: true });
});
app.get("/api/youtube/channels", (_req, res) => {
  const destinations = db.getDestinations().map((d) => ({
    id: d.id,
    title: d.name,
    rtmpUrl: d.rtmpUrl,
    maskedStreamKey: maskStreamKey(d.streamKey),
    hasStreamKey: !!d.streamKey,
    connectedAt: d.createdAt,
    connectionType: "direct",
    isDefault: false
  }));
  if (destinations.length > 0) destinations[0].isDefault = true;
  return res.json({ channels: destinations });
});
app.post("/api/youtube/channels", authMiddleware, (req, res) => {
  const { title, streamKey, rtmpUrl } = req.body;
  if (!title?.trim() || !streamKey?.trim()) {
    return res.status(400).json({ error: "Channel title and Stream Key are required" });
  }
  const dest = {
    id: `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: title.trim(),
    provider: "youtube",
    rtmpUrl: (rtmpUrl?.trim() || "rtmps://a.rtmps.youtube.com:443/live2").replace(/\/+$/, ""),
    streamKey: streamKey.trim(),
    enabled: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.saveDestination(dest);
  return res.json({
    success: true,
    channel: {
      id: dest.id,
      title: dest.name,
      maskedStreamKey: maskStreamKey(dest.streamKey),
      hasStreamKey: true,
      rtmpUrl: dest.rtmpUrl
    }
  });
});
app.delete("/api/youtube/channels/:id", authMiddleware, (req, res) => {
  db.deleteDestination(req.params.id);
  return res.json({ success: true });
});
app.get("/api/videos", async (_req, res) => {
  try {
    const videos = await syncVideosDatabaseAsync();
    return res.json({ videos });
  } catch (err) {
    return res.json({ videos: [] });
  }
});
app.post("/api/videos/:filename/analyze", async (req, res) => {
  try {
    const safeBasename = path4.basename(req.params.filename);
    const fullPath = path4.join(UPLOADS_DIR3, safeBasename);
    const analysis = await MediaAnalyzer.analyze(fullPath);
    return res.json(analysis);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/upload", authMiddleware, (req, res) => {
  upload.single("video")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No video file provided" });
    const fullPath = req.file.path;
    const meta = await probeVideoAsync(fullPath);
    const compatibility = await MediaAnalyzer.analyze(fullPath);
    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: req.file.filename,
      displayName: req.file.originalname,
      fileType: req.file.mimetype || "video/mp4",
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveMediaAsset(record);
    db.addAuditLog({
      username: req.user?.username || "admin",
      action: "UPLOAD_MEDIA",
      result: "SUCCESS",
      details: `Uploaded "${record.displayName}" (${record.sizeFormatted})`
    });
    res.json({ success: true, file: record });
  });
});
app.post("/api/upload/chunk", (req, res) => {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/octet-stream") || req.query.raw === "true") {
    const uploadId = String(req.headers["x-upload-id"] || req.query.uploadId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const chunkIndex = String(req.headers["x-chunk-index"] || req.query.chunkIndex || "");
    if (!uploadId || chunkIndex === "") return res.status(400).json({ error: "Missing uploadId or chunkIndex" });
    const idx = parseInt(chunkIndex, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: "Invalid chunkIndex" });
    if (!fs6.existsSync(TEMP_UPLOADS_DIR)) fs6.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
    const chunkPath = path4.join(TEMP_UPLOADS_DIR, `${uploadId}__${idx}.chunk`);
    const writeStream = fs6.createWriteStream(chunkPath);
    req.pipe(writeStream);
    writeStream.on("finish", () => res.json({ success: true, chunkIndex: idx }));
    writeStream.on("error", (err) => res.status(500).json({ error: err.message }));
    return;
  }
  chunkUpload.single("chunk")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No chunk data received" });
    const { uploadId, chunkIndex } = req.body;
    const cleanUploadId = String(uploadId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const idx = parseInt(chunkIndex, 10);
    if (!cleanUploadId || isNaN(idx) || idx < 0) return res.status(400).json({ error: "Invalid chunk parameters" });
    if (!fs6.existsSync(TEMP_UPLOADS_DIR)) fs6.mkdirSync(TEMP_UPLOADS_DIR, { recursive: true });
    const chunkPath = path4.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${idx}.chunk`);
    fs6.writeFileSync(chunkPath, req.file.buffer);
    return res.json({ success: true, chunkIndex: idx });
  });
});
app.post("/api/upload/finalize", authMiddleware, async (req, res) => {
  try {
    const { uploadId, filename, totalChunks } = req.body;
    if (!uploadId || !filename || !totalChunks) return res.status(400).json({ error: "Missing finalize parameters" });
    const cleanUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, "");
    const total = parseInt(totalChunks, 10);
    const safeName = path4.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path4.join(UPLOADS_DIR3, finalFilename);
    for (let i = 0; i < total; i++) {
      const chunkPath = path4.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${i}.chunk`);
      if (!fs6.existsSync(chunkPath)) return res.status(400).json({ error: `Upload incomplete: chunk ${i} missing.` });
    }
    const outStream = fs6.createWriteStream(finalPath);
    for (let i = 0; i < total; i++) {
      const chunkPath = path4.join(TEMP_UPLOADS_DIR, `${cleanUploadId}__${i}.chunk`);
      const inStream = fs6.createReadStream(chunkPath);
      await new Promise((resolve, reject) => {
        inStream.pipe(outStream, { end: false });
        inStream.on("end", () => resolve());
        inStream.on("error", reject);
      });
      try {
        fs6.unlinkSync(chunkPath);
      } catch {
      }
    }
    outStream.end();
    await new Promise((resolve, reject) => {
      outStream.on("finish", () => resolve());
      outStream.on("error", reject);
    });
    const stats = fs6.statSync(finalPath);
    const meta = await probeVideoAsync(finalPath);
    const compatibility = await MediaAnalyzer.analyze(finalPath);
    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: finalFilename,
      displayName: filename,
      fileType: "video/mp4",
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveMediaAsset(record);
    return res.json({ success: true, file: record });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Assembly failed" });
  }
});
app.delete("/api/videos/:filename", authMiddleware, (req, res) => {
  const filename = path4.basename(req.params.filename);
  const filePath = path4.join(UPLOADS_DIR3, filename);
  const activeStreams = supervisor.getAllStreams();
  const usingStream = activeStreams.find((s) => s.isProcessAlive && s.videoFilename === filename);
  if (usingStream) {
    return res.status(400).json({
      error: `Cannot delete: video is currently being streamed by "${usingStream.name}". End the broadcast first.`
    });
  }
  try {
    if (fs6.existsSync(filePath)) {
      fs6.unlinkSync(filePath);
    }
    db.deleteMediaAsset(filename);
    db.addAuditLog({
      username: req.user?.username || "admin",
      action: "DELETE_MEDIA",
      result: "SUCCESS",
      details: `Deleted file "${filename}"`
    });
    res.json({ success: true, deletedFilename: filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/upload/url", authMiddleware, async (req, res) => {
  try {
    const { url, filename } = req.body;
    if (!url || typeof url !== "string") return res.status(400).json({ error: "Valid URL is required" });
    const safe = await isSafePublicUrl(url);
    if (!safe) return res.status(400).json({ error: "Security Error: Access to private networks, loopback addresses, or cloud metadata endpoints is prohibited." });
    let parsedName = filename?.trim();
    if (!parsedName) {
      try {
        parsedName = path4.basename(new URL(url).pathname) || "remote_video.mp4";
      } catch {
        parsedName = "remote_video.mp4";
      }
    }
    if (!parsedName.includes(".")) parsedName += ".mp4";
    const safeName = parsedName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalFilename = `${Date.now()}_${safeName}`;
    const finalPath = path4.join(UPLOADS_DIR3, finalFilename);
    const response = await fetch(url, { headers: { "User-Agent": "CloudCast-Server/3.0" } });
    if (!response.ok || !response.body) return res.status(400).json({ error: `Remote returned HTTP ${response.status}` });
    let totalDownloaded = 0;
    const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024 * 1024;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        totalDownloaded += chunk.length;
        if (totalDownloaded > MAX_DOWNLOAD_BYTES) callback(new Error("Exceeded maximum allowed 4GB limit."));
        else callback(null, chunk);
      }
    });
    const fileStream = fs6.createWriteStream(finalPath);
    await pipeline(response.body, limiter, fileStream);
    const stats = fs6.statSync(finalPath);
    const meta = await probeVideoAsync(finalPath);
    const compatibility = await MediaAnalyzer.analyze(finalPath);
    const record = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: finalFilename,
      displayName: safeName,
      fileType: "video/mp4",
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.saveMediaAsset(record);
    return res.json({ success: true, file: record });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Download failed" });
  }
});
app.post("/api/generate-test-video", authMiddleware, async (_req, res) => {
  if (!ffmpegAvailable) return res.status(500).json({ error: "FFmpeg is not installed on this server." });
  const filename = `test_pattern_${Date.now()}.mp4`;
  const outPath = path4.join(UPLOADS_DIR3, filename);
  try {
    const cmd = [
      "-f",
      "lavfi",
      "-i",
      "smptebars=size=1920x1080:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=44100:beep_factor=4",
      "-vf",
      "drawtext=fontcolor=white:fontsize=48:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2-50:text='CLOUD LIVE STREAM TEST VIDEO':timecode='00\\:00\\:00\\:00':rate=30",
      "-t",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      "2500k",
      "-maxrate",
      "3000k",
      "-bufsize",
      "5000k",
      "-g",
      "60",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-y",
      outPath
    ];
    const activeFfmpegBin = resolveFfmpegPath() || "ffmpeg";
    const gen = spawn2(activeFfmpegBin, cmd);
    gen.on("close", async (code) => {
      if (code === 0 && fs6.existsSync(outPath)) {
        const stats = fs6.statSync(outPath);
        const meta = await probeVideoAsync(outPath);
        const compatibility = await MediaAnalyzer.analyze(outPath);
        const record = {
          id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          filename,
          displayName: "Test Pattern Live Stream Video (30s 1080p)",
          fileType: "video/mp4",
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          storagePath: outPath,
          url: `/uploads/${encodeURIComponent(filename)}`,
          durationFormatted: meta.durationFormatted,
          durationSeconds: 30,
          resolution: "1920x1080",
          videoCodec: "h264",
          audioCodec: "aac",
          hasAudio: true,
          isLiveReady: true,
          compatibility,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.saveMediaAsset(record);
        return res.json({ success: true, file: record });
      }
      return res.status(500).json({ error: `FFmpeg exited with code ${code}` });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/draft", (_req, res) => {
  try {
    if (fs6.existsSync(DRAFT_FILE)) {
      const draft = JSON.parse(fs6.readFileSync(DRAFT_FILE, "utf-8"));
      return res.json({ success: true, draft });
    }
  } catch {
  }
  return res.json({ success: true, draft: null });
});
app.post("/api/draft", (req, res) => {
  try {
    fs6.writeFileSync(DRAFT_FILE, JSON.stringify(req.body || {}, null, 2), "utf-8");
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/playlists", (_req, res) => {
  res.json({ playlists: db.getPlaylists() });
});
app.post("/api/playlists", authMiddleware, (req, res) => {
  const { name, description, items } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Playlist name is required" });
  const playlist = {
    id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    description: description?.trim(),
    items: Array.isArray(items) ? items : [],
    totalDurationSeconds: 0,
    totalDurationFormatted: "00:00",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.savePlaylist(playlist);
  return res.json({ success: true, playlist });
});
app.delete("/api/playlists/:id", authMiddleware, (req, res) => {
  db.deletePlaylist(req.params.id);
  return res.json({ success: true });
});
app.get("/api/schedules", (_req, res) => {
  res.json({ schedules: db.getSchedules() });
});
app.post("/api/schedules", authMiddleware, (req, res) => {
  const { title, videoFilename, scheduledAt, frequency, rtmpUrl, streamKey, loop, mode } = req.body;
  if (!title?.trim() || !videoFilename || !scheduledAt) {
    return res.status(400).json({ error: "Title, videoFilename, and scheduledAt are required." });
  }
  const sched = {
    id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    videoFilename,
    scheduledAt: new Date(scheduledAt).toISOString(),
    frequency: frequency || "once",
    rtmpUrl,
    streamKey,
    loop: loop !== false,
    mode: mode || "copy",
    status: "scheduled",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.saveSchedule(sched);
  return res.json({ success: true, schedule: sched });
});
app.delete("/api/schedules/:id", authMiddleware, (req, res) => {
  db.deleteSchedule(req.params.id);
  return res.json({ success: true });
});
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const user = AuthService.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const session = AuthService.createSession(user);
  db.addAuditLog({
    username: user.username,
    action: "USER_LOGIN",
    result: "SUCCESS",
    ipAddress: req.ip
  });
  return res.json({
    success: true,
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    }
  });
});
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const session = req.user;
  const user = db.getUserById(session.userId) || db.getUserByUsername(session.username);
  if (!user) {
    return res.json({
      user: {
        id: "usr_admin",
        username: "admin",
        displayName: "Broadcast Director",
        role: "owner"
      }
    });
  }
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    }
  });
});
app.post("/api/auth/logout", (req, res) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (token) AuthService.destroySession(token);
  return res.json({ success: true });
});
app.get("/api/audit-logs", authMiddleware, (_req, res) => {
  res.json({ logs: db.getAuditLogs() });
});
app.get("/api/system", (req, res) => {
  const allStreams = supervisor.getAllStreams();
  const runningCount = allStreams.filter((s) => s.isProcessAlive).length;
  const mem = ResourceManager.getMemoryUsage();
  const simulatedCpu = req.query.simulateCpu ? parseInt(String(req.query.simulateCpu), 10) : void 0;
  const cpuPercent = simulatedCpuOverride !== null ? simulatedCpuOverride : simulatedCpu !== void 0 && !isNaN(simulatedCpu) ? simulatedCpu : ResourceManager.getCpuUsage();
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
    isCpuSimulated: simulatedCpuOverride !== null
  });
});
app.get("/api/diagnostics", async (_req, res) => {
  const report = await DiagnosticsService.runDiagnostics();
  res.json(report);
});
app.get("/api/diagnostics/network", async (req, res) => {
  const report = await DiagnosticsService.runDiagnostics();
  const effectiveLatency = simulatedLatencyOverride !== null ? simulatedLatencyOverride : report.network.youtubeRtmps443.latencyMs || lastMeasuredLatency;
  if (effectiveLatency !== void 0) {
    report.network.youtubeRtmps443.latencyMs = effectiveLatency;
    lastMeasuredLatency = effectiveLatency;
  }
  res.json({
    standardRtmp1935: report.network.youtubeRtmp1935,
    secureRtmps443: report.network.youtubeRtmps443,
    recommendedUrl: report.network.recommendedUrl,
    isLatencySimulated: simulatedLatencyOverride !== null
  });
});
app.post("/api/diagnostics/simulate", (req, res) => {
  const { cpu, latency } = req.body;
  if (typeof cpu === "number") simulatedCpuOverride = Math.max(0, Math.min(100, Math.round(cpu)));
  else if (cpu === null) simulatedCpuOverride = null;
  if (typeof latency === "number") {
    simulatedLatencyOverride = Math.max(0, Math.round(latency));
    lastMeasuredLatency = simulatedLatencyOverride;
  } else if (latency === null) {
    simulatedLatencyOverride = null;
    lastMeasuredLatency = 14;
  }
  return res.json({ success: true, simulatedCpu: simulatedCpuOverride, simulatedLatency: simulatedLatencyOverride });
});
app.post("/api/diagnostics/simulate/reset", (_req, res) => {
  simulatedCpuOverride = null;
  simulatedLatencyOverride = null;
  lastMeasuredLatency = 14;
  return res.json({ success: true });
});
async function startServer() {
  await supervisor.initialize();
  SchedulerService.start();
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path4.resolve(ROOT_DIR4, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path4.resolve(ROOT_DIR4, "dist", "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CloudCast] Production Multi-Stream Broadcast Engine listening on http://0.0.0.0:${PORT}`);
  });
  const handleShutdown = async (signal) => {
    console.log(`
[CloudCast] Received ${signal}. Initiating graceful shutdown...`);
    SchedulerService.stop();
    await supervisor.shutdown();
    server.close(() => {
      console.log("[CloudCast] Server shutdown complete.");
      process.exit(0);
    });
  };
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
}
startServer();
