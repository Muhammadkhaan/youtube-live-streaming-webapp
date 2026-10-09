import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Plus,
  Play,
  Square,
  Terminal,
  ExternalLink,
  RotateCw,
  Key,
  HardDrive,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame,
  FileVideo,
  Upload,
  Link as LinkIcon,
  Server,
  Share2,
  Trash2,
  Repeat,
  Wifi,
  ChevronRight,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  Layers,
  Sparkles,
  Info,
  Sliders,
  Calendar,
  Video,
  Mic,
  Camera,
  Settings as SettingsIcon,
  ChevronDown,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Database,
  Globe,
} from 'lucide-react';
import {
  StreamItem,
  VideoFile,
  SystemInfo,
  YouTubeChannelProfile,
  NetworkDiagnostic,
  UploadProgressInfo,
  ScheduledBroadcast,
  StreamAlert,
} from '../types';
import { StreamAlertBanner } from './StreamAlertBanner';

interface DashboardViewProps {
  streams: StreamItem[];
  videos: VideoFile[];
  systemInfo: SystemInfo | null;
  savedChannels: YouTubeChannelProfile[];
  scheduledBroadcasts?: ScheduledBroadcast[];
  alerts?: StreamAlert[];
  onDismissAlert?: (id: string) => void;
  onSimulateThresholdAlert?: (type: 'latency' | 'cpu' | 'reset') => void;
  simulatedCpu?: number | null;
  simulatedLatency?: number | null;
  onStartStream: (params: {
    videoFilename: string;
    rtmpUrl: string;
    streamKey: string;
    title: string;
    loop: boolean;
    mode: 'copy' | 'transcode_1080p' | 'transcode_720p';
    destinations?: { rtmpUrl: string; streamKey: string; name?: string }[];
    channelTitle?: string;
  }) => Promise<boolean>;
  onStartBatchStreams?: (
    batchList: {
      videoFilename: string;
      rtmpUrl: string;
      streamKey: string;
      title: string;
      loop: boolean;
      mode: 'copy' | 'transcode_1080p' | 'transcode_720p';
      channelTitle?: string;
    }[]
  ) => Promise<boolean>;
  onStopStream: (id: string) => Promise<boolean | void>;
  onStopAllStreams: () => Promise<void>;
  onRestartStream: (id: string) => Promise<void>;
  onDeleteStreamRecord?: (id: string) => Promise<void>;
  onOpenLogs: (stream: StreamItem) => void;
  onPreviewVideo: (video: VideoFile) => void;
  onStartWithVideo: (filename: string) => void;
  onNavigateTab: (tab: any) => void;
  onOpenYouTubeGuide: () => void;
  onGenerateTestVideo: () => Promise<string | null>;
  onUploadFile: (file: File) => Promise<string | null>;
  onImportVideoUrl?: (url: string, filename?: string) => Promise<string | null>;
  onDeleteVideo?: (filename: string) => Promise<boolean>;
  onAddChannel?: (channel: {
    title: string;
    handle?: string;
    streamKey: string;
    rtmpUrl?: string;
    isDefault?: boolean;
  }) => Promise<boolean>;
  onDeleteChannel?: (id: string, title?: string) => Promise<boolean>;
  onScheduleBroadcast?: (broadcast: Omit<ScheduledBroadcast, 'id' | 'status'>) => void;
  uploadProgress?: number | null;
  uploadInfo?: UploadProgressInfo | null;
  onCancelUpload?: () => void;
  isActionLoading: string | null;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  streams,
  videos,
  systemInfo,
  savedChannels,
  scheduledBroadcasts = [],
  alerts = [],
  onDismissAlert,
  onSimulateThresholdAlert,
  simulatedCpu = null,
  simulatedLatency = null,
  onStartStream,
  onStartBatchStreams,
  onStopStream,
  onStopAllStreams,
  onRestartStream,
  onDeleteStreamRecord,
  onOpenLogs,
  onPreviewVideo,
  onStartWithVideo,
  onNavigateTab,
  onOpenYouTubeGuide,
  onGenerateTestVideo,
  onUploadFile,
  onImportVideoUrl,
  onDeleteVideo,
  onAddChannel,
  onDeleteChannel,
  onScheduleBroadcast,
  uploadProgress,
  uploadInfo,
  onCancelUpload,
  isActionLoading,
  showToast,
}) => {
  // Mode selection: 'single' | 'simulcast' | 'batch'
  const [setupMode, setSetupMode] = useState<'single' | 'simulcast' | 'batch'>('single');

  // Broadcast setup form state
  const [selectedVideo, setSelectedVideo] = useState(videos[0]?.filename || '');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState(savedChannels[0]?.id || '');
  const [customStreamKey, setCustomStreamKey] = useState(savedChannels[0]?.streamKey || '');
  const [rtmpUrl, setRtmpUrl] = useState(
    savedChannels[0]?.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/'
  );
  const [isLoop, setIsLoop] = useState(true);
  const [encodingMode, setEncodingMode] = useState<'copy' | 'transcode_1080p'>('copy');
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
  const [isStarting, setIsStarting] = useState(false);

  // Simulcast channel selections
  const [simulcastChannelIds, setSimulcastChannelIds] = useState<string[]>([]);

  // Batch selections
  const [batchSelections, setBatchSelections] = useState<Record<string, { enabled: boolean; video: string }>>({});

  // Stream preview interactive toggles
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);

  // Bottom broadcasts tab: 'live' | 'scheduled' | 'past'
  const [bottomTab, setBottomTab] = useState<'live' | 'scheduled' | 'past'>('live');

  // Diagnostics state
  const [diagnostic, setDiagnostic] = useState<NetworkDiagnostic | null>(null);
  const [isTestingNet, setIsTestingNet] = useState(false);

  // Modals state
  const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlDownloadLink, setUrlDownloadLink] = useState('');
  const [urlCustomName, setUrlCustomName] = useState('');
  const [isDownloadingUrl, setIsDownloadingUrl] = useState(false);

  // Add Channel Form state
  const [newChanTitle, setNewChanTitle] = useState('');
  const [newChanKey, setNewChanKey] = useState('');
  const [newChanRtmp, setNewChanRtmp] = useState('rtmps://live-api-s.facebook.com:443/rtmp/');
  const [newChanDefault, setNewChanDefault] = useState(false);
  const [showKeyText, setShowKeyText] = useState(false);
  const [isSavingChan, setIsSavingChan] = useState(false);

  // Schedule Broadcast Form state
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedVideo, setSchedVideo] = useState(videos[0]?.filename || '');
  const [schedChannelId, setSchedChannelId] = useState(savedChannels[0]?.id || '');

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync defaults when videos or channels change
  useEffect(() => {
    if (!selectedVideo && videos.length > 0) {
      setSelectedVideo(videos[0].filename);
      setBroadcastTitle(videos[0].displayName.replace(/\.[^/.]+$/, ''));
    }
  }, [videos, selectedVideo]);

  useEffect(() => {
    if (savedChannels.length > 0) {
      const def = savedChannels.find(c => c.isDefault) || savedChannels[0];
      if (!selectedChannelId) {
        setSelectedChannelId(def.id);
        if (def.streamKey) setCustomStreamKey(def.streamKey);
        if (def.rtmpUrl) setRtmpUrl(def.rtmpUrl);
      }
      if (simulcastChannelIds.length === 0) {
        setSimulcastChannelIds(savedChannels.map(c => c.id));
      }
    }
  }, [savedChannels, selectedChannelId]);

  // Ping network on mount
  const runPing = () => {
    setIsTestingNet(true);
    fetch('/api/diagnostics/network')
      .then(res => res.json())
      .then(data => setDiagnostic(data))
      .catch(() => {})
      .finally(() => setIsTestingNet(false));
  };

  useEffect(() => {
    runPing();
  }, []);

  const runningStreams = streams.filter(s => s.status === 'running' || s.status === 'starting');
  const pastStreams = streams.filter(s => s.status === 'stopped' || s.status === 'error');

  // Real-time telemetry: Latency and CPU calculations
  const runningStreamWithHighLatency = streams.find(
    s => (s.status === 'running' || s.status === 'starting') && s.latencyMs && s.latencyMs > 500
  );
  const currentLatency =
    simulatedLatency ??
    (runningStreamWithHighLatency?.latencyMs ?? (diagnostic?.secureRtmps443?.latencyMs ?? 8));
  const isLatencyHigh = currentLatency > 500;

  const currentCpu = simulatedCpu ?? (systemInfo?.cpuUsagePercent ?? 0);
  const isCpuHigh = currentCpu > 85;

  const totalBytes = videos.reduce((acc, v) => acc + v.sizeBytes, 0);
  const totalMbFormatted = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';

  const calculateUptime = (startedAt: string) => {
    try {
      const diffMs = Date.now() - new Date(startedAt).getTime();
      if (diffMs < 0) return '00:00:00';
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      return `${hours.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } catch {
      return '--:--:--';
    }
  };

  // Launch stream handler
  const handleLaunchBroadcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (setupMode === 'batch') {
      if (!onStartBatchStreams) {
        showToast('Batch streaming handler is not available', 'error');
        return;
      }
      const batchEntries = Object.entries(batchSelections).filter(([, item]) => item.enabled && item.video);
      if (batchEntries.length === 0) {
        showToast('Select at least one channel and video for batch streaming', 'error');
        return;
      }
      setIsStarting(true);
      try {
        const batchList = batchEntries.map(([channelId, item]) => {
          const ch = savedChannels.find(c => c.id === channelId);
          return {
            videoFilename: item.video,
            rtmpUrl: ch?.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/',
            streamKey: ch?.streamKey || '',
            title: `${ch?.title || 'Facebook'} Live Stream`,
            loop: isLoop,
            mode: encodingMode as any,
            channelTitle: ch?.title,
          };
        });
        await onStartBatchStreams(batchList);
      } finally {
        setIsStarting(false);
      }
      return;
    }

    if (!selectedVideo) {
      showToast('Please select a video asset file first', 'error');
      return;
    }

    if (setupMode === 'simulcast') {
      const channelsToStream = savedChannels.filter(c => simulcastChannelIds.includes(c.id));
      if (channelsToStream.length === 0) {
        showToast('Select at least 1 destination channel for simulcasting', 'error');
        return;
      }
      const primary = channelsToStream[0];
      const destinations = channelsToStream.map(c => ({
        rtmpUrl: c.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/',
        streamKey: c.streamKey || '',
        name: c.title,
      }));

      setIsStarting(true);
      try {
        const title = broadcastTitle.trim() || `Simulcast (${channelsToStream.length} Channels) Facebook Live`;
        await onStartStream({
          videoFilename: selectedVideo,
          rtmpUrl: primary.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/',
          streamKey: primary.streamKey || '',
          title,
          loop: isLoop,
          mode: encodingMode,
          destinations,
          channelTitle: `Simulcast (${channelsToStream.length} Channels)`,
        });
      } finally {
        setIsStarting(false);
      }
      return;
    }

    // Single Stream
    const chosen = savedChannels.find(c => c.id === selectedChannelId);
    const key = customStreamKey.trim() || chosen?.streamKey || '';
    if (!key) {
      showToast('Please enter or select a Facebook Stream Key', 'error');
      return;
    }

    setIsStarting(true);
    try {
      const title = broadcastTitle.trim() || `${chosen?.title || 'Facebook'} Live Stream`;
      await onStartStream({
        videoFilename: selectedVideo,
        rtmpUrl: rtmpUrl.trim() || 'rtmps://live-api-s.facebook.com:443/rtmp/',
        streamKey: key,
        title,
        loop: isLoop,
        mode: encodingMode,
        channelTitle: chosen?.title,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanTitle.trim() || !newChanKey.trim()) {
      showToast('Channel title and Stream Key are required', 'error');
      return;
    }
    if (!onAddChannel) return;
    setIsSavingChan(true);
    try {
      const ok = await onAddChannel({
        title: newChanTitle.trim(),
        streamKey: newChanKey.trim(),
        rtmpUrl: newChanRtmp.trim(),
        isDefault: newChanDefault || savedChannels.length === 0,
      });
      if (ok) {
        setIsAddKeyModalOpen(false);
        setNewChanTitle('');
        setNewChanKey('');
      }
    } finally {
      setIsSavingChan(false);
    }
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedDate || !schedTime) {
      showToast('Please provide a title, date, and time for the broadcast', 'error');
      return;
    }
    if (onScheduleBroadcast) {
      const scheduledDateTime = new Date(`${schedDate}T${schedTime}`).toISOString();
      const ch = savedChannels.find(c => c.id === schedChannelId);
      onScheduleBroadcast({
        title: schedTitle.trim(),
        videoFilename: schedVideo,
        scheduledAt: scheduledDateTime,
        channelId: schedChannelId,
        channelTitle: ch?.title || 'Facebook Channel',
        loop: isLoop,
        mode: encodingMode,
      });
      showToast(`Broadcast "${schedTitle}" scheduled for ${schedDate} at ${schedTime}`, 'success');
      setIsScheduleModalOpen(false);
      setSchedTitle('');
    }
  };

  const handleDownloadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlDownloadLink.trim()) return;
    if (!onImportVideoUrl) return;
    setIsDownloadingUrl(true);
    try {
      const filename = await onImportVideoUrl(urlDownloadLink.trim(), urlCustomName.trim());
      if (filename) {
        setSelectedVideo(filename);
        setIsUrlModalOpen(false);
        setUrlDownloadLink('');
        setUrlCustomName('');
      }
    } finally {
      setIsDownloadingUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-Time Threshold Visual Alert Banners (Latency > 500ms or CPU > 85%) */}
      {alerts && alerts.length > 0 && (
        <StreamAlertBanner
          alerts={alerts}
          onDismissAlert={onDismissAlert || (() => {})}
          onRePing={runPing}
          onNavigateTab={onNavigateTab}
          onSimulateSpike={onSimulateThresholdAlert}
          onResetSimulation={() => onSimulateThresholdAlert && onSimulateThresholdAlert('reset')}
          isSimulated={simulatedCpu !== null || simulatedLatency !== null}
        />
      )}

      {/* 1. Welcoming Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
              Good Morning, YT Studio 👋
            </h1>
          </div>
          <p className="text-sm text-[#64748B] mt-1">
            Manage your Facebook Live streams, monitor performance and control your broadcasts — all in one place.
          </p>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLaunchBroadcast()}
            disabled={isStarting}
            className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isStarting ? 'Starting...' : 'Go Live Now'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Schedule Broadcast</span>
          </button>
        </div>
      </div>

      {/* 2. Overview 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Broadcasts */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <button
              onClick={() => onNavigateTab('streams')}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="View broadcasts"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-xs font-medium text-[#64748B]">Active Broadcasts</span>
            <div className="text-2xl font-bold text-[#0F172A] tracking-tight mt-0.5">
              {runningStreams.length} <span className="text-base font-normal text-slate-400">/ 4</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
              <span>{runningStreams.length > 0 ? `${runningStreams.length} Live Now` : 'Ready for broadcast'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Stored Media Assets */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <button
              onClick={() => onNavigateTab('videos')}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="View media library"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-xs font-medium text-[#64748B]">Stored Media Assets</span>
            <div className="text-2xl font-bold text-[#0F172A] tracking-tight mt-0.5 flex items-baseline gap-1.5">
              <span>{videos.length}</span>
              <span className="text-sm font-normal text-[#64748B]">({totalMbFormatted})</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Disk storage active</span>
              <button
                type="button"
                onClick={() => onNavigateTab('videos')}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Manage Assets
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Connected Channel Keys */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center">
              <LinkIcon className="w-5 h-5" />
            </div>
            <button
              onClick={() => onNavigateTab('channels')}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="View channels"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <span className="text-xs font-medium text-[#64748B]">Connected Channel Keys</span>
            <div className="text-2xl font-bold text-[#0F172A] tracking-tight mt-0.5 flex items-baseline gap-1">
              <span>{savedChannels.length}</span>
              <span className="text-sm font-normal text-[#64748B]">configured</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-[#64748B] truncate max-w-[110px]">
                {savedChannels[0]?.title || 'No channel'}
              </span>
              <button
                type="button"
                onClick={() => setIsAddKeyModalOpen(true)}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                + Add Key
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Ingest Socket */}
        <div
          className={`bg-white border rounded-2xl p-4.5 shadow-2xs flex flex-col justify-between transition-all ${
            isLatencyHigh
              ? 'border-amber-400 bg-amber-50/25 ring-2 ring-amber-400/20'
              : 'border-[#E2E8F0] hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isLatencyHigh
                  ? 'bg-amber-500 text-white animate-pulse shadow-xs'
                  : 'bg-[#DCFCE7] text-[#16A34A]'
              }`}
            >
              {isLatencyHigh ? <AlertTriangle className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <button
              onClick={runPing}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Refresh connection"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B]">YT Ingest Socket</span>
              {isLatencyHigh && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono animate-pulse">
                  &gt;500ms
                </span>
              )}
            </div>
            <div className="text-2xl font-bold tracking-tight mt-0.5 flex items-baseline gap-2">
              <span className={isLatencyHigh ? 'text-amber-600 font-mono' : 'text-[#0F172A]'}>
                {currentLatency}ms
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                  isLatencyHigh
                    ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    : 'bg-emerald-50 text-[#16A34A] border-emerald-100'
                }`}
              >
                {isLatencyHigh ? 'Latency Alert' : 'Connected'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-[#64748B] font-mono text-[11px]">
                RAM: {systemInfo?.memoryUsageMb || 267} MB
              </span>
              <button
                type="button"
                onClick={runPing}
                disabled={isTestingNet}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                {isTestingNet ? 'Pinging...' : 'Re-ping'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content Grid (Left: Stream Preview | Center: Broadcast Setup | Right: Utility Stack) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Facebook Live Stream Preview (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Facebook Icon */}
              <div className="w-7 h-7 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-sm">
                f
              </div>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Facebook Live Stream</h2>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#16A34A] border border-emerald-100 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
              <span>{runningStreams.length > 0 ? 'Streaming Live' : 'Online'}</span>
            </span>
          </div>

          {/* Large Preview Area */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[260px] relative overflow-hidden">
            {runningStreams.length > 0 ? (
              <div className="w-full space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white font-mono text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  <span>LIVE TRANSMITTING</span>
                </div>
                <h3 className="text-base font-bold text-[#0F172A] truncate">
                  {runningStreams[0].title}
                </h3>
                <div className="flex items-center justify-center gap-3 text-xs font-mono text-slate-500">
                  <span>FPS: {runningStreams[0].fps || 30}</span>
                  <span>•</span>
                  <span>Bitrate: {runningStreams[0].bitrate || '2500k'}</span>
                  <span>•</span>
                  <span>Uptime: {calculateUptime(runningStreams[0].startedAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onStopStream(runningStreams[0].id)}
                  className="mt-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  End Broadcast
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Video className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mt-3.5">Ready to Go Live</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs leading-relaxed">
                  Start your live stream and connect to your Facebook channel.
                </p>
                <button
                  type="button"
                  onClick={() => handleLaunchBroadcast()}
                  disabled={isStarting}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Go Live Now</span>
                </button>
              </>
            )}
          </div>

          {/* Control Bar inside Preview Card */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isCameraActive
                    ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                    : 'bg-white border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                }`}
                title="Camera"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Camera</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMicActive(!isMicActive)}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isMicActive
                    ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                    : 'bg-white border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                }`}
                title="Microphone"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">Microphone</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(true)}
                className="p-2 rounded-xl bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Stream Settings"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {videos.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPreviewVideo(videos[0])}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Preview</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleLaunchBroadcast()}
                disabled={isStarting}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Go Live</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Card: Broadcast Setup (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Broadcast Setup</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAdvancedModalOpen(true)}
              className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Advanced Settings</span>
            </button>
          </div>

          {/* Segmented Mode Selector: Single Stream | Simulcast | Batch Multi */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSetupMode('single')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                setupMode === 'single'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Single Stream
            </button>
            <button
              type="button"
              onClick={() => setSetupMode('simulcast')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                setupMode === 'simulcast'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Share2 className="w-3 h-3" />
              <span>Simulcast</span>
            </button>
            <button
              type="button"
              onClick={() => setSetupMode('batch')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1 ${
                setupMode === 'batch'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Batch Multi</span>
            </button>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleLaunchBroadcast} className="space-y-3.5">
            {/* Field 1: Video Asset File */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Video Asset File <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedVideo}
                    onChange={e => {
                      setSelectedVideo(e.target.value);
                      const f = videos.find(v => v.filename === e.target.value);
                      if (f && !broadcastTitle) {
                        setBroadcastTitle(f.displayName.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition-colors truncate appearance-none pr-8 font-medium"
                  >
                    {videos.map(v => (
                      <option key={v.filename} value={v.filename}>
                        {v.displayName} ({v.sizeFormatted} - {v.durationFormatted || '0:30'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Browse files"
                >
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      onUploadFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            {/* Field 2: Live Broadcast Title */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Live Broadcast Title
              </label>
              <input
                type="text"
                placeholder="Test Pattern Live Stream Video (30s 1080p)"
                value={broadcastTitle}
                onChange={e => setBroadcastTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition-colors placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Field 3: Destination Channel */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#0F172A]">Destination Channel</label>
                <button
                  type="button"
                  onClick={() => setIsAddKeyModalOpen(true)}
                  className="text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  + Add Key
                </button>
              </div>

              {setupMode === 'simulcast' ? (
                /* Multi-Channel Checkbox list */
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {savedChannels.map(ch => {
                    const checked = simulcastChannelIds.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer ${
                          checked
                            ? 'bg-[#EFF6FF] border-[#2563EB] text-[#0F172A]'
                            : 'bg-white border-[#E2E8F0] text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSimulcastChannelIds(prev => [...prev, ch.id]);
                              } else {
                                setSimulcastChannelIds(prev => prev.filter(id => id !== ch.id));
                              }
                            }}
                            className="rounded text-[#2563EB]"
                          />
                          <span className="font-semibold truncate">{ch.title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{ch.maskedStreamKey}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedChannelId}
                    onChange={e => {
                      setSelectedChannelId(e.target.value);
                      const found = savedChannels.find(c => c.id === e.target.value);
                      if (found?.streamKey) setCustomStreamKey(found.streamKey);
                      if (found?.rtmpUrl) setRtmpUrl(found.rtmpUrl);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition-colors truncate appearance-none pr-8 font-medium"
                  >
                    {savedChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title} ({ch.maskedStreamKey})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Bottom Controls: 24/7 Loop, Copy (0% CPU), 1080p */}
            <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#0F172A] font-medium">
                <input
                  type="checkbox"
                  checked={isLoop}
                  onChange={e => setIsLoop(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-0"
                />
                <span>24/7 Loop</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEncodingMode(encodingMode === 'copy' ? 'transcode_1080p' : 'copy')}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                    encodingMode === 'copy'
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-white border-[#E2E8F0] text-slate-500'
                  }`}
                >
                  Copy (0% CPU)
                </button>

                <select
                  value={resolution}
                  onChange={e => setResolution(e.target.value as any)}
                  className="px-2 py-1 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700"
                >
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Right Stack: Stream Health, Recent Activity, Quick Actions (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card 1: Stream Health */}
          <div
            className={`bg-white border rounded-2xl p-4.5 shadow-2xs space-y-2.5 transition-all ${
              isCpuHigh || isLatencyHigh
                ? 'border-red-300 bg-red-50/20 ring-2 ring-red-400/20'
                : 'border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCpuHigh || isLatencyHigh
                      ? 'bg-red-600 animate-ping'
                      : 'bg-[#16A34A] animate-pulse'
                  }`}
                ></span>
                <span className="text-xs font-bold text-[#0F172A]">Stream Health</span>
              </div>
              {(isCpuHigh || isLatencyHigh) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 uppercase font-mono">
                  {isCpuHigh && isLatencyHigh ? 'Overload' : isCpuHigh ? 'CPU Alert' : 'Latency Alert'}
                </span>
              )}
            </div>

            <div>
              <div
                className={`text-lg font-bold tracking-tight ${
                  isCpuHigh || isLatencyHigh ? 'text-red-600' : 'text-[#16A34A]'
                }`}
              >
                {isCpuHigh && isLatencyHigh
                  ? 'Critical Overload'
                  : isCpuHigh
                  ? 'Severe CPU Spike'
                  : isLatencyHigh
                  ? 'High Ingest Latency'
                  : 'Excellent'}
              </div>
              <p className="text-[11px] text-[#64748B]">
                {isCpuHigh && isLatencyHigh
                  ? 'CPU >85% and Latency >500ms — Stream frames dropping'
                  : isCpuHigh
                  ? `Server CPU at ${currentCpu}% (Exceeds 85% limit)`
                  : isLatencyHigh
                  ? `Network latency at ${currentLatency}ms (Exceeds 500ms limit)`
                  : 'Your stream is ready to go'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isCpuHigh ? 'bg-red-100/80 border border-red-200' : ''
                }`}
              >
                <span
                  className={`text-[10px] block font-mono ${
                    isCpuHigh ? 'text-red-700 font-bold' : 'text-slate-400'
                  }`}
                >
                  CPU {isCpuHigh ? '⚠️' : ''}
                </span>
                <span
                  className={`font-bold ${
                    isCpuHigh ? 'text-red-700 font-mono text-sm' : 'text-[#0F172A]'
                  }`}
                >
                  {currentCpu}%
                </span>
              </div>

              <div className="p-1.5 rounded-lg">
                <span className="text-[10px] text-slate-400 block font-mono">Memory</span>
                <span className="font-bold text-[#0F172A]">{systemInfo?.memoryUsageMb || 267} MB</span>
              </div>

              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  isLatencyHigh ? 'bg-amber-100/80 border border-amber-200' : ''
                }`}
              >
                <span
                  className={`text-[10px] block font-mono ${
                    isLatencyHigh ? 'text-amber-800 font-bold' : 'text-slate-400'
                  }`}
                >
                  Network {isLatencyHigh ? '⚠️' : ''}
                </span>
                <span
                  className={`font-bold ${
                    isLatencyHigh ? 'text-amber-800 font-mono text-sm' : 'text-[#0F172A]'
                  }`}
                >
                  {currentLatency}ms
                </span>
              </div>
            </div>

            {/* Real-time Alert System Tester / Trigger Buttons */}
            {onSimulateThresholdAlert && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-medium">
                  <span>Test Real-Time Alerts:</span>
                  {(simulatedCpu !== null || simulatedLatency !== null) && (
                    <button
                      type="button"
                      onClick={() => onSimulateThresholdAlert('reset')}
                      className="text-[#2563EB] hover:underline font-semibold cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSimulateThresholdAlert('latency')}
                    className="py-1 px-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Simulate latency exceeding 500ms"
                  >
                    <span>⚡ Latency &gt;500ms</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimulateThresholdAlert('cpu')}
                    className="py-1 px-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Simulate CPU load exceeding 85%"
                  >
                    <span>🔥 CPU &gt;85%</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Recent Activity */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#0F172A]">Recent Activity</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </span>
                <span className="text-slate-700 truncate flex-1">System initialized</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">2 min ago</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-2.5 h-2.5" />
                </span>
                <span className="text-slate-700 truncate flex-1">Channel connected</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">5 min ago</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FileVideo className="w-2.5 h-2.5" />
                </span>
                <span className="text-slate-700 truncate flex-1">Media library ready</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">12 min ago</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Server className="w-2.5 h-2.5" />
                </span>
                <span className="text-slate-700 truncate flex-1">VPS connection active</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">12 min ago</span>
              </div>
            </div>
          </div>

          {/* Card 3: Quick Actions */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-[#0F172A]">Quick Actions</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleLaunchBroadcast()}
                disabled={isStarting}
                className="w-full py-2.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Go Live Now</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Schedule Broadcast</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Upload Video</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Wide Card: Live Broadcasts */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500" />
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Live Broadcasts</h2>
            </div>

            {/* Tabs: Live (0) | Scheduled (0) | Past Broadcasts */}
            <div className="flex items-center p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBottomTab('live')}
                className={`py-1 px-3 rounded-lg transition-all ${
                  bottomTab === 'live'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Live ({runningStreams.length})
              </button>
              <button
                type="button"
                onClick={() => setBottomTab('scheduled')}
                className={`py-1 px-3 rounded-lg transition-all ${
                  bottomTab === 'scheduled'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Scheduled ({scheduledBroadcasts.length})
              </button>
              <button
                type="button"
                onClick={() => setBottomTab('past')}
                className={`py-1 px-3 rounded-lg transition-all ${
                  bottomTab === 'past'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Past Broadcasts
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('streams')}
            className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Content */}
        {bottomTab === 'live' && (
          runningStreams.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A]">No live broadcasts yet</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                Your live streams will appear here once you start broadcasting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runningStreams.map(stream => (
                <div
                  key={stream.id}
                  className="p-4 rounded-xl border border-red-200 bg-red-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="flex items-center gap-1 font-bold text-red-600 font-mono text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                        <span>LIVE NOW</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono text-slate-600 text-[11px]">
                        {calculateUptime(stream.startedAt)}
                      </span>
                      {stream.channelTitle && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-700 font-semibold">{stream.channelTitle}</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#0F172A] truncate">{stream.title}</h4>
                    <div className="mt-1 flex items-center gap-3 text-xs font-mono text-slate-500">
                      <span>FPS: {stream.fps || 30}</span>
                      <span>Bitrate: {stream.bitrate || 'Active'}</span>
                      <span>Key: {stream.maskedStreamKey}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenLogs(stream)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Logs
                    </button>
                    <button
                      type="button"
                      onClick={() => onStopStream(stream.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      End Stream
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {bottomTab === 'scheduled' && (
          scheduledBroadcasts.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A]">No scheduled broadcasts</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                Schedule a future broadcast to plan your live content streaming ahead of time.
              </p>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold"
              >
                Schedule a Broadcast
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledBroadcasts.map(sched => (
                <div
                  key={sched.id}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
                        Scheduled
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {new Date(sched.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#0F172A]">{sched.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Asset: {sched.videoFilename}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVideo(sched.videoFilename);
                      setBroadcastTitle(sched.title);
                      showToast(`Loaded scheduled stream "${sched.title}" into launcher`, 'info');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#2563EB] text-white text-xs font-semibold"
                  >
                    Go Live Early
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {bottomTab === 'past' && (
          pastStreams.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center text-xs text-[#64748B]">
              No past broadcasts recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {pastStreams.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-[#E2E8F0] bg-slate-50/50 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-[#0F172A] block truncate">{s.title}</span>
                    <span className="text-[11px] text-slate-500">
                      Ended • {new Date(s.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {onDeleteStreamRecord && (
                    <button
                      type="button"
                      onClick={() => onDeleteStreamRecord(s.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal: Add Channel / Stream Key */}
      {isAddKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold">
                  f
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Add Channel Stream Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddKeyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Channel or Page Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Facebook Gaming Page"
                  value={newChanTitle}
                  onChange={e => setNewChanTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Facebook Live Stream Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    required
                    placeholder="FB-xxxxxxxxxxxxxxxx"
                    value={newChanKey}
                    onChange={e => setNewChanKey(e.target.value)}
                    className="w-full pr-10 pl-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showKeyText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Obtain your key from Facebook Live Producer (facebook.com/live/producer).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  RTMP Ingest Server URL
                </label>
                <input
                  type="text"
                  value={newChanRtmp}
                  onChange={e => setNewChanRtmp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkDefault"
                  checked={newChanDefault}
                  onChange={e => setNewChanDefault(e.target.checked)}
                  className="rounded text-[#2563EB]"
                />
                <label htmlFor="chkDefault" className="text-xs text-[#0F172A] font-medium cursor-pointer">
                  Set as default broadcasting channel
                </label>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddKeyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingChan}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isSavingChan && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Channel Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Broadcast */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Schedule Facebook Live Broadcast</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Broadcast Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Product Showcase Live"
                  value={schedTitle}
                  onChange={e => setSchedTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={schedTime}
                    onChange={e => setSchedTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Video Asset</label>
                <select
                  value={schedVideo}
                  onChange={e => setSchedVideo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A]"
                >
                  {videos.map(v => (
                    <option key={v.filename} value={v.filename}>
                      {v.displayName} ({v.sizeFormatted})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Destination Channel</label>
                <select
                  value={schedChannelId}
                  onChange={e => setSchedChannelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A]"
                >
                  {savedChannels.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Advanced Settings */}
      {isAdvancedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#0F172A]">Advanced Stream Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Video Encoding Preset</label>
                <select
                  value={encodingMode}
                  onChange={e => setEncodingMode(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A]"
                >
                  <option value="copy">Stream Copy (Lossless Passthrough - 0% CPU)</option>
                  <option value="transcode_1080p">Transcode H.264 1080p CBR (Standard Facebook Live)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  &quot;Stream Copy&quot; sends the original MP4/H.264 packets directly to Facebook with zero CPU overhead.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Keyframe Interval (GOP)</label>
                <input
                  type="text"
                  readOnly
                  value="2 seconds (60 frames at 30fps) - Facebook Compliant"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-slate-50 text-slate-600 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Audio Codec & Bitrate</label>
                <input
                  type="text"
                  readOnly
                  value="AAC-LC 128 kbps 44.1 kHz Stereo"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-slate-50 text-slate-600 font-mono text-[11px]"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] space-y-1">
                <span className="font-bold block">✓ Facebook Ingestion Recommendation</span>
                <span>
                  Using RTMPS on Port 443 with TLS 1.3 encryption guarantees seamless ingestion without ISP throttling.
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
