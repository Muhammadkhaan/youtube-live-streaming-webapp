export type StreamStatus =
  | 'IDLE'
  | 'STARTING'
  | 'CONNECTING'
  | 'LIVE'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED';

export type UserRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface StreamDestination {
  id: string;
  name: string;
  provider: 'youtube' | 'custom_rtmp' | 'facebook';
  rtmpUrl: string;
  streamKey: string; // Plaintext in secure DB file, masked when served to frontend
  enabled: boolean;
  createdAt: string;
}

export interface MediaAssetCompatibility {
  compatibleForCopy: boolean;
  recommendation: 'STREAM_COPY' | 'TRANSCODE_REQUIRED';
  reasons: string[];
  videoCodec?: string;
  profile?: string;
  pixelFormat?: string;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  durationSeconds?: number;
}

export interface MediaAsset {
  id: string;
  filename: string;
  displayName: string;
  fileType: string;
  sizeBytes: number;
  sizeFormatted: string;
  storagePath: string;
  url: string;
  thumbnailUrl?: string;
  durationFormatted: string;
  durationSeconds: number;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio: boolean;
  isLiveReady: boolean;
  compatibility?: MediaAssetCompatibility;
  createdAt: string;
}

export interface PlaylistItem {
  id: string;
  mediaAssetId: string;
  filename: string;
  displayName: string;
  durationSeconds: number;
  order: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: PlaylistItem[];
  totalDurationSeconds: number;
  totalDurationFormatted: string;
  createdAt: string;
  updatedAt: string;
}

export type EncodingMode =
  | 'copy'
  | 'transcode_1080p_high'
  | 'transcode_1080p'
  | 'transcode_720p'
  | 'transcode_480p';

export interface StreamConfig {
  id: string;
  name: string;
  mediaAssetId?: string;
  videoFilename: string; // Basename in uploads/
  playlistId?: string; // If playlist broadcast
  destinationId?: string; // Linked destination
  destinations?: StreamDestination[]; // Multi-destination simulcast
  rtmpUrl: string;
  streamKey: string;
  encodingMode: EncodingMode;
  loop: boolean;
  autoStart: boolean; // Auto-start on server reboot / node restart
  autoRestart: boolean; // Auto-restart on crash with backoff
  maxRetries: number; // Max restart attempts before marking FAILED (default: 5)
  channelTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreamRuntimeState {
  streamId: string;
  status: StreamStatus;
  pid?: number;
  startedAt?: string;
  uptimeSeconds: number;
  fps?: number;
  bitrate?: string;
  speed?: string;
  latencyMs?: number;
  lastProgressTime?: string;
  cpuPercent?: number;
  memoryMb?: number;
  restartCount: number;
  lastRestartTime?: string;
  retryAttempt: number;
  lastError?: string;
  recentLogs: string[];
  lastConnectedAt?: string;
}

export interface Schedule {
  id: string;
  title: string;
  streamConfigId?: string;
  videoFilename: string;
  playlistId?: string;
  destinationId?: string;
  rtmpUrl?: string;
  streamKey?: string;
  mode: EncodingMode;
  loop: boolean;
  scheduledAt: string; // ISO date string
  frequency: 'once' | 'daily' | 'weekly';
  status: 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';
  lastRunAt?: string;
  createdAt: string;
}

export interface StreamEvent {
  id: string;
  streamId: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  type: string;
  message: string;
  details?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  streamId?: string;
  result: 'SUCCESS' | 'FAILURE';
  details?: string;
  ipAddress?: string;
}

export interface ServerSettings {
  serverName: string;
  maxConcurrentStreams: number;
  maxCpuUsageThreshold: number;
  enableOrphanProcessReconciliation: boolean;
  autoStartStreamsOnBoot: boolean;
  defaultEncodingPreset: EncodingMode;
  rtmpConnectTimeoutSeconds: number;
  sessionTimeoutHours: number;
}
