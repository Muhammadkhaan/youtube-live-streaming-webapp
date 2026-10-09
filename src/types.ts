export type StreamState =
  | 'IDLE'
  | 'STARTING'
  | 'CONNECTING'
  | 'LIVE'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  // Backwards compatibility aliases
  | 'starting'
  | 'running'
  | 'stopped'
  | 'error';

export interface StreamDestination {
  id?: string;
  rtmpUrl: string;
  maskedStreamKey: string;
  name?: string;
  provider?: 'youtube' | 'custom_rtmp' | 'facebook';
  enabled?: boolean;
}

export interface StreamItem {
  id: string;
  title: string;
  name?: string;
  videoFilename: string;
  videoPath?: string;
  rtmpUrl: string;
  maskedStreamKey: string;
  destinations?: StreamDestination[];
  loop: boolean;
  mode: 'copy' | 'transcode_1080p_high' | 'transcode_1080p' | 'transcode_720p' | 'transcode_480p';
  encodingMode?: 'copy' | 'transcode_1080p_high' | 'transcode_1080p' | 'transcode_720p' | 'transcode_480p';
  startedAt: string;
  status: StreamState;
  isProcessAlive: boolean;
  pid?: number;
  uptimeSeconds?: number;
  errorMessage?: string;
  lastError?: string;
  restartCount?: number;
  retryAttempt?: number;
  maxRetries?: number;
  autoStart?: boolean;
  autoRestart?: boolean;
  fps?: number;
  bitrate?: string;
  speed?: string;
  latencyMs?: number;
  lastProgressTime?: string;
  recentLogs: string[];
  channelTitle?: string;
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

export interface VideoFile {
  id: string;
  filename: string;
  displayName: string;
  fileType: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  url: string;
  storagePath?: string;
  durationFormatted?: string;
  durationSeconds?: number;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio?: boolean;
  isLiveReady?: boolean;
  compatibility?: MediaAssetCompatibility;
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

export interface PreflightCheckResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    details?: string;
  }[];
  recommendation?: 'STREAM_COPY' | 'TRANSCODE_REQUIRED';
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

export interface NetworkDiagnostic {
  standardRtmp1935: { reachable: boolean; latencyMs?: number; error?: string };
  secureRtmps443: { reachable: boolean; latencyMs?: number; error?: string };
  recommendedUrl: string;
  isLatencySimulated?: boolean;
}

export interface YouTubeChannelProfile {
  id: string;
  title: string;
  handle?: string;
  maskedStreamKey: string;
  hasStreamKey: boolean;
  streamKey?: string;
  rtmpUrl: string;
  avatarUrl?: string;
  channelUrl?: string;
  connectedAt?: string;
  connectionType?: 'direct' | 'oauth';
  isDefault?: boolean;
}

export interface SystemInfo {
  ffmpegAvailable: boolean;
  ffprobeAvailable?: boolean;
  ffmpegPath: string;
  activeStreamsCount: number;
  maxRecommendedStreams?: number;
  nodeUptimeSeconds: number;
  memoryUsageMb: number;
  cpuUsagePercent?: number;
  platform?: string;
  isCpuSimulated?: boolean;
}

export interface StreamAlert {
  id: string;
  type: 'latency' | 'cpu';
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  dismissed?: boolean;
  streamId?: string;
  streamTitle?: string;
}

export interface UploadProgressInfo {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  speedFormatted: string;
  etaFormatted: string;
  filename: string;
}

export interface MultiStreamDestinationInput {
  id: string;
  title: string;
  rtmpUrl: string;
  streamKey: string;
  enabled: boolean;
}

export interface ScheduledBroadcast {
  id: string;
  title: string;
  videoFilename: string;
  scheduledAt: string;
  channelId?: string;
  channelTitle?: string;
  loop: boolean;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled' | 'failed';
  mode: 'copy' | 'transcode_1080p' | 'transcode_720p' | 'transcode_1080p_high' | 'transcode_480p';
  frequency?: 'once' | 'daily' | 'weekly';
  lastRunAt?: string;
}
