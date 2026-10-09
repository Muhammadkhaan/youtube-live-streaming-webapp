import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Square,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Key,
  RotateCw,
  Plus,
  Trash2,
  Star,
  Check,
  Tv,
  ArrowRight,
  Shield,
  X,
  Share2,
} from 'lucide-react';
import { VideoFile, StreamItem, YouTubeChannelProfile } from '../types';

interface YouTubeStudioManagerProps {
  videos: VideoFile[];
  activeStreams: StreamItem[];
  onStartStream: (config: {
    videoFilename: string;
    rtmpUrl: string;
    streamKey: string;
    title: string;
    loop: boolean;
    mode: 'copy' | 'transcode_1080p' | 'transcode_720p';
    channelTitle?: string;
  }) => Promise<boolean>;
  onStopStream: (id: string) => Promise<boolean | void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const YouTubeStudioManager: React.FC<YouTubeStudioManagerProps> = ({
  videos,
  activeStreams,
  onStartStream,
  onStopStream,
  showToast,
}) => {
  // Multiple Saved Channels from server
  const [savedChannels, setSavedChannels] = useState<YouTubeChannelProfile[]>([]);
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [channelTitle, setChannelTitle] = useState('');
  const [channelHandle, setChannelHandle] = useState('');
  const [channelStreamKey, setChannelStreamKey] = useState('');
  const [channelRtmpUrl, setChannelRtmpUrl] = useState('rtmps://live-api-s.facebook.com:443/rtmp/');
  const [isSavingChannel, setIsSavingChannel] = useState(false);

  // Quick Stream Modal for a specific channel
  const [activeChannelForLaunch, setActiveChannelForLaunch] = useState<YouTubeChannelProfile | null>(null);
  const [launchVideo, setLaunchVideo] = useState(videos[0]?.filename || '');
  const [launchTitle, setLaunchTitle] = useState('');
  const [isLaunchingStream, setIsLaunchingStream] = useState(false);

  // Sync video selection
  useEffect(() => {
    if (!launchVideo && videos.length > 0) {
      setLaunchVideo(videos[0].filename);
    }
  }, [videos, launchVideo]);

  // Load Saved Channels from server
  const loadSavedChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube/channels');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.channels)) {
          setSavedChannels(data.channels);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSavedChannels();
  }, [loadSavedChannels]);

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelTitle.trim()) {
      showToast('Please enter your channel or page name', 'error');
      return;
    }
    if (!channelStreamKey.trim()) {
      showToast('Please paste your Live Stream Key', 'error');
      return;
    }
    setIsSavingChannel(true);
    try {
      const res = await fetch('/api/youtube/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: channelTitle.trim(),
          handle: channelHandle.trim(),
          streamKey: channelStreamKey.trim(),
          rtmpUrl: channelRtmpUrl.trim(),
          isDefault: savedChannels.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save channel profile');
      }
      await loadSavedChannels();
      setIsAddChannelOpen(false);
      setChannelTitle('');
      setChannelHandle('');
      setChannelStreamKey('');
      showToast(`Added channel: "${channelTitle.trim()}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save channel', 'error');
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/youtube/channels/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadSavedChannels();
        showToast(`Removed channel "${title}"`, 'info');
      }
    } catch {
      showToast('Failed to delete channel', 'error');
    }
  };

  const handleSetDefault = async (channel: YouTubeChannelProfile) => {
    try {
      await fetch('/api/youtube/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channel.id,
          title: channel.title,
          handle: channel.handle,
          streamKey: channel.streamKey || 'KEEP_EXISTING',
          rtmpUrl: channel.rtmpUrl,
          isDefault: true,
        }),
      });
      await loadSavedChannels();
      showToast(`"${channel.title}" set as default`, 'info');
    } catch {
      showToast('Failed to update default channel', 'error');
    }
  };

  const handleLaunchForChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelForLaunch || !launchVideo) return;
    setIsLaunchingStream(true);
    try {
      const success = await onStartStream({
        videoFilename: launchVideo,
        rtmpUrl: activeChannelForLaunch.rtmpUrl || 'rtmps://live-api-s.facebook.com:443/rtmp/',
        streamKey: activeChannelForLaunch.streamKey || '',
        title: launchTitle.trim() || `${activeChannelForLaunch.title} 24/7 Live`,
        loop: true,
        mode: 'copy',
        channelTitle: activeChannelForLaunch.title,
      });
      if (success) {
        setActiveChannelForLaunch(null);
        setLaunchTitle('');
      }
    } finally {
      setIsLaunchingStream(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Channels & Stream Keys Vault</h1>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Save multiple Facebook and YouTube channel stream keys for one-click simultaneous or independent 24/7 live broadcasting.
          </p>
        </div>
        <button
          onClick={() => setIsAddChannelOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors self-start sm:self-center cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Channel Profile</span>
        </button>
      </div>

      {/* Saved Channels List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Configured Channels ({savedChannels.length})
          </h2>
          <span className="text-[11px] text-[#64748B]">
            Stream keys are masked and securely encrypted on the server
          </span>
        </div>

        {savedChannels.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E2E8F0] rounded-2xl p-8 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <Key className="w-5 h-5 text-[#2563EB]" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">No Channel Profiles Added Yet</h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Add your Facebook Live or YouTube stream keys here. You can connect multiple channels to run simultaneous live broadcasts.
            </p>
            <button
              onClick={() => setIsAddChannelOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Channel</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedChannels.map(channel => {
              const activeForThis = activeStreams.find(
                s => s.status === 'running' && s.channelTitle === channel.title
              );

              return (
                <div
                  key={channel.id}
                  className="bg-white border border-[#E2E8F0] hover:border-slate-300 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-sm shrink-0">
                          f
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-sm text-[#0F172A] truncate">{channel.title}</h3>
                            {channel.isDefault && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#64748B] block truncate">
                            {channel.handle || 'Direct RTMP Ingest'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!channel.isDefault && (
                          <button
                            onClick={() => handleSetDefault(channel)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-50 transition-colors"
                            title="Set as Default Channel"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteChannel(channel.id, channel.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Channel Profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Stream Key:</span>
                        <span className="font-bold text-[#0F172A]">{channel.maskedStreamKey}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Ingest Endpoint:</span>
                        <span className="text-slate-600 text-[11px] truncate max-w-[200px]">
                          {channel.rtmpUrl}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {activeForThis ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs font-mono font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                          <span>LIVE</span>
                        </span>
                        <button
                          onClick={() => onStopStream(activeForThis.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold"
                        >
                          End Stream
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveChannelForLaunch(channel);
                          setLaunchTitle(`${channel.title} 24/7 Live Stream`);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Launch Live on Channel</span>
                      </button>
                    )}

                    <a
                      href="https://www.facebook.com/live/producer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>Producer</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Channel */}
      {isAddChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold">
                  f
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Add Streaming Channel Key</h3>
              </div>
              <button
                onClick={() => setIsAddChannelOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Channel or Page Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Facebook Gaming Page, Music Channel"
                  value={channelTitle}
                  onChange={e => setChannelTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Stream Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Paste your live stream key"
                  value={channelStreamKey}
                  onChange={e => setChannelStreamKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  RTMP Ingest Server URL
                </label>
                <input
                  type="text"
                  value={channelRtmpUrl}
                  onChange={e => setChannelRtmpUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddChannelOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingChannel}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isSavingChannel && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Channel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Launch for Specific Channel */}
      {activeChannelForLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#0F172A]">
                  Go Live on {activeChannelForLaunch.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveChannelForLaunch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLaunchForChannel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Select Video Asset</label>
                <select
                  value={launchVideo}
                  onChange={e => setLaunchVideo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                >
                  {videos.map(v => (
                    <option key={v.filename} value={v.filename}>
                      {v.displayName} ({v.sizeFormatted})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Broadcast Title</label>
                <input
                  type="text"
                  placeholder="e.g. 24/7 Facebook Live Session"
                  value={launchTitle}
                  onChange={e => setLaunchTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs text-[#0F172A]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveChannelForLaunch(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLaunchingStream}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isLaunchingStream && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Start Live Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
