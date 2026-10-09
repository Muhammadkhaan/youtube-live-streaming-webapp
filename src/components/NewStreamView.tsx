import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Radio,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  FileVideo,
  ExternalLink,
  Plus,
  Play,
  RotateCw,
  Link as LinkIcon,
  X,
  Layers,
  Share2,
  Trash2,
  Tv,
} from 'lucide-react';
import { VideoFile, UploadProgressInfo, YouTubeChannelProfile } from '../types';

interface NewStreamViewProps {
  videos: VideoFile[];
  preselectedVideoFilename?: string | null;
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
  onStartBatchStreams?: (streams: {
    videoFilename: string;
    rtmpUrl: string;
    streamKey: string;
    title: string;
    loop: boolean;
    mode: 'copy' | 'transcode_1080p' | 'transcode_720p';
    channelTitle?: string;
  }[]) => Promise<boolean>;
  onUploadFile: (file: File) => Promise<string | null>;
  onGenerateTestVideo: () => Promise<string | null>;
  onOpenYouTubeGuide: () => void;
  onPreviewVideo: (video: VideoFile) => void;
  isStarting: boolean;
  uploadProgress: number | null;
  uploadInfo?: UploadProgressInfo | null;
  onCancelUpload?: () => void;
  onImportVideoUrl?: (url: string, filename?: string) => Promise<string | null>;
}

export const NewStreamView: React.FC<NewStreamViewProps> = ({
  videos,
  preselectedVideoFilename,
  onStartStream,
  onStartBatchStreams,
  onUploadFile,
  onGenerateTestVideo,
  onOpenYouTubeGuide,
  onPreviewVideo,
  isStarting,
  uploadProgress,
  uploadInfo,
  onCancelUpload,
  onImportVideoUrl,
}) => {
  const [streamMode, setStreamMode] = useState<'standard' | 'simulcast'>('standard');
  const [selectedVideo, setSelectedVideo] = useState<string>(preselectedVideoFilename || videos[0]?.filename || '');
  const [streamTitle, setStreamTitle] = useState<string>('');
  const [rtmpUrl, setRtmpUrl] = useState<string>('rtmps://a.rtmps.youtube.com:443/live2');
  const [streamKey, setStreamKey] = useState<string>('');
  const [showStreamKey, setShowStreamKey] = useState<boolean>(false);
  const [loopContinuously, setLoopContinuously] = useState<boolean>(true);
  const [encodingMode, setEncodingMode] = useState<'copy' | 'transcode_1080p' | 'transcode_720p'>('copy');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  // Multi-destination simulcast list
  const [simulcastDestinations, setSimulcastDestinations] = useState<
    { id: string; name: string; rtmpUrl: string; streamKey: string }[]
  >([
    { id: '1', name: 'Primary YouTube Channel', rtmpUrl: 'rtmps://a.rtmps.youtube.com:443/live2', streamKey: '' },
    { id: '2', name: 'Second Channel / Backup Key', rtmpUrl: 'rtmps://a.rtmps.youtube.com:443/live2', streamKey: '' },
  ]);

  // Saved channels list
  const [savedChannels, setSavedChannels] = useState<YouTubeChannelProfile[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // URL Import Modal state
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraftLoadedRef = useRef(false);

  // Load saved channels
  const loadChannels = () => {
    fetch('/api/youtube/channels')
      .then(res => res.json())
      .then(data => {
        if (data.channels && Array.isArray(data.channels)) {
          setSavedChannels(data.channels);
          const def = data.channels.find((c: YouTubeChannelProfile) => c.isDefault) || data.channels[0];
          if (def) {
            setSelectedChannelId(def.id);
            if (!streamKey) {
              setStreamKey(def.streamKey || '');
              if (def.rtmpUrl) setRtmpUrl(def.rtmpUrl);
            }
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadChannels();

    // Restore draft
    fetch('/api/draft')
      .then(res => res.json())
      .then(data => {
        isDraftLoadedRef.current = true;
        if (data.draft) {
          if (data.draft.selectedVideo) setSelectedVideo(data.draft.selectedVideo);
          if (data.draft.streamTitle) setStreamTitle(data.draft.streamTitle);
          if (data.draft.rtmpUrl) setRtmpUrl(prev => prev || data.draft.rtmpUrl);
          if (data.draft.streamKey) setStreamKey(prev => prev || data.draft.streamKey);
          if (data.draft.loopContinuously !== undefined) setLoopContinuously(data.draft.loopContinuously);
          if (data.draft.encodingMode) setEncodingMode(data.draft.encodingMode);
          if (data.draft.streamMode) setStreamMode(data.draft.streamMode);
        }
      })
      .catch(() => {
        isDraftLoadedRef.current = true;
      });
  }, []);

  const saveDraft = (overrides: Record<string, any> = {}) => {
    const draft = {
      selectedVideo: overrides.selectedVideo !== undefined ? overrides.selectedVideo : selectedVideo,
      streamTitle: overrides.streamTitle !== undefined ? overrides.streamTitle : streamTitle,
      rtmpUrl: overrides.rtmpUrl !== undefined ? overrides.rtmpUrl : rtmpUrl,
      streamKey: overrides.streamKey !== undefined ? overrides.streamKey : streamKey,
      loopContinuously: overrides.loopContinuously !== undefined ? overrides.loopContinuously : loopContinuously,
      encodingMode: overrides.encodingMode !== undefined ? overrides.encodingMode : encodingMode,
      streamMode: overrides.streamMode !== undefined ? overrides.streamMode : streamMode,
    };
    fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    }).catch(() => {});
  };

  // Sync if preselected video changes from parent
  useEffect(() => {
    if (preselectedVideoFilename) {
      setSelectedVideo(preselectedVideoFilename);
      const found = videos.find(v => v.filename === preselectedVideoFilename);
      if (found) {
        const title = found.displayName.replace(/\.[^/.]+$/, '');
        setStreamTitle(title);
        saveDraft({ selectedVideo: preselectedVideoFilename, streamTitle: title });
      }
    }
  }, [preselectedVideoFilename, videos]);

  // Sync selected video once draft and videos are loaded
  useEffect(() => {
    if (!isDraftLoadedRef.current) return;
    if (videos.length === 0) return;
    const currentValid = selectedVideo && videos.some(v => v.filename === selectedVideo);
    if (!currentValid) {
      const topVideo = videos[0];
      setSelectedVideo(topVideo.filename);
      if (!streamTitle || streamTitle === '24/7 Live Stream') {
        const title = topVideo.displayName.replace(/\.[^/.]+$/, '');
        setStreamTitle(title);
        saveDraft({ selectedVideo: topVideo.filename, streamTitle: title });
      }
    }
  }, [videos, selectedVideo, streamTitle]);

  const handleSelectVideo = (filename: string, displayName: string) => {
    setSelectedVideo(filename);
    const newTitle =
      !streamTitle || streamTitle === '24/7 Live Stream'
        ? displayName.replace(/\.[^/.]+$/, '')
        : streamTitle;
    setStreamTitle(newTitle);
    saveDraft({ selectedVideo: filename, streamTitle: newTitle });
  };

  const handleSelectChannelProfile = (channel: YouTubeChannelProfile) => {
    setSelectedChannelId(channel.id);
    if (channel.streamKey) {
      setStreamKey(channel.streamKey);
    }
    if (channel.rtmpUrl) {
      setRtmpUrl(channel.rtmpUrl);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    try {
      const uploadedFilename = await onUploadFile(file);
      if (uploadedFilename) {
        const title = file.name.replace(/\.[^/.]+$/, '');
        setSelectedVideo(uploadedFilename);
        setStreamTitle(title);
        saveDraft({ selectedVideo: uploadedFilename, streamTitle: title });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload encountered an error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleGenerateTestPattern = async () => {
    try {
      setIsGeneratingTest(true);
      setErrorMsg(null);
      const filename = await onGenerateTestVideo();
      if (filename) {
        setSelectedVideo(filename);
        setStreamTitle('1080p Broadcast Color Bars Test');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate test pattern');
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const handleUrlImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    if (!onImportVideoUrl) {
      setErrorMsg('URL import not supported');
      return;
    }
    setIsImporting(true);
    try {
      const filename = await onImportVideoUrl(importUrl.trim(), importFilename.trim() || undefined);
      if (filename) {
        setSelectedVideo(filename);
        setStreamTitle(importFilename.trim() || 'Imported Cloud Video');
        setShowUrlImport(false);
        setImportUrl('');
        setImportFilename('');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const addSimulcastDestination = () => {
    setSimulcastDestinations(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: `Channel Destination ${prev.length + 1}`,
        rtmpUrl: 'rtmps://a.rtmps.youtube.com:443/live2',
        streamKey: '',
      },
    ]);
  };

  const removeSimulcastDestination = (id: string) => {
    if (simulcastDestinations.length <= 1) return;
    setSimulcastDestinations(prev => prev.filter(d => d.id !== id));
  };

  const updateSimulcastDestination = (id: string, field: 'name' | 'rtmpUrl' | 'streamKey', val: string) => {
    setSimulcastDestinations(prev =>
      prev.map(d => (d.id === id ? { ...d, [field]: val } : d))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedVideo) {
      setErrorMsg('Please select a video file from your saved library.');
      return;
    }

    const titleToUse = streamTitle.trim() || '24/7 CloudCast Broadcast';
    const activeChannel = savedChannels.find(c => c.id === selectedChannelId);

    if (streamMode === 'simulcast') {
      const valid = simulcastDestinations.filter(d => d.streamKey.trim());
      if (valid.length === 0) {
        setErrorMsg('Please enter at least one valid stream key for simulcast.');
        return;
      }
      for (const d of valid) {
        if (d.streamKey.trim().startsWith('http') || d.streamKey.trim().startsWith('rtmp')) {
          setErrorMsg(`Destination "${d.name}" has a URL pasted in the Secret Stream Key field. In YouTube Studio, copy the secret Stream Key string, not the Server URL.`);
          return;
        }
      }

      await onStartStream({
        videoFilename: selectedVideo,
        rtmpUrl: valid[0].rtmpUrl,
        streamKey: valid[0].streamKey,
        title: titleToUse,
        loop: loopContinuously,
        mode: encodingMode,
        destinations: valid.map(d => ({ rtmpUrl: d.rtmpUrl, streamKey: d.streamKey, name: d.name })),
        channelTitle: `Simulcast (${valid.length} channels)`,
      });
      return;
    }

    // Standard single stream
    if (!streamKey.trim()) {
      setErrorMsg('YouTube Live Stream Key is required.');
      return;
    }
    if (streamKey.trim().startsWith('http') || streamKey.trim().startsWith('rtmp')) {
      setErrorMsg('You pasted a URL into the Secret Stream Key input. In YouTube Studio, the Stream Key is the secret password string, not the Server URL.');
      return;
    }

    await onStartStream({
      videoFilename: selectedVideo,
      rtmpUrl: rtmpUrl.trim(),
      streamKey: streamKey.trim(),
      title: titleToUse,
      loop: loopContinuously,
      mode: encodingMode,
      channelTitle: activeChannel?.title,
    });
  };

  return (
    <div className="space-y-6">
      {/* View Header with Mode Selector */}
      <div className="pb-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Configure Live Broadcast</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pick a stored video asset and start a 24/7 continuous stream to one or multiple YouTube destinations simultaneously.
          </p>
        </div>

        {/* Stream Mode Toggle: Single vs Multi-Destination Simulcast */}
        <div className="flex items-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              setStreamMode('standard');
              saveDraft({ streamMode: 'standard' });
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              streamMode === 'standard'
                ? 'bg-white/[0.12] text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-red-500" />
            <span>Single Live Stream</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStreamMode('simulcast');
              saveDraft({ streamMode: 'simulcast' });
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              streamMode === 'simulcast'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Multi-Channel Simulcast</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Media Asset Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Saved Video Asset</h2>
              <span className="text-[11px] text-zinc-400">
                Permanently saved on cloud disk — select any file to stream with 0 upload delay.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mkv,.mov,.avi,.flv,.webm,.ts"
                onClick={e => {
                  (e.currentTarget as HTMLInputElement).value = '';
                }}
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className="cursor-pointer px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/[0.08]"
                title="Upload video from your computer"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                <span>Upload PC</span>
              </label>
              <button
                type="button"
                onClick={() => setShowUrlImport(true)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/[0.08]"
                title="Download directly to server from an external URL"
              >
                <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>Import URL</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateTestPattern}
                disabled={isGeneratingTest}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors border border-white/[0.08]"
                title="Generates a 30-second SMPTE color bars test pattern"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isGeneratingTest ? '...' : 'Test Pattern'}</span>
              </button>
            </div>
          </div>

          {/* Resumable Upload Progress Bar */}
          {uploadProgress !== null && (
            <div className="p-4 bg-[#0e1422] rounded-xl border border-red-500/30 text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="font-semibold text-white truncate max-w-xs">
                  {uploadInfo?.filename || 'Uploading video...'}
                </span>
                <span className="font-mono text-red-400 font-bold tabular-nums text-sm">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-500 h-2 transition-all duration-150 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>
                  {uploadInfo?.speedFormatted || 'Streaming chunks'} • {uploadInfo?.etaFormatted || 'Uploading'}
                </span>
                {onCancelUpload && (
                  <button
                    type="button"
                    onClick={onCancelUpload}
                    className="text-red-400 hover:text-red-300 text-xs font-sans font-semibold underline underline-offset-2"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dropzone & Video Asset Gallery */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`transition-all rounded-2xl ${isDragging ? 'ring-2 ring-red-500 bg-red-950/20' : ''}`}
          >
            {videos.length === 0 ? (
              <div className="bg-[#0b0e14] border border-dashed border-white/[0.1] rounded-2xl p-10 text-center">
                <FileVideo className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
                <h3 className="text-sm font-semibold text-white">No Video Files in Storage</h3>
                <p className="text-zinc-400 text-xs max-w-sm mx-auto mt-1 mb-4">
                  Upload your video file (MP4, MKV, MOV) or import from a direct URL. Once saved, it stays on disk for multiple broadcasts.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Video</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {videos.map(v => {
                  const isSelected = selectedVideo === v.filename;
                  return (
                    <div
                      key={v.filename}
                      onClick={() => handleSelectVideo(v.filename, v.displayName)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#121824] border-red-500/80 shadow-sm'
                          : 'bg-[#0e121b] border-white/[0.06] hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-red-600 text-white' : 'bg-white/[0.04] text-zinc-400'
                          }`}
                        >
                          <FileVideo className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-white truncate" title={v.displayName}>
                              {v.displayName}
                            </p>
                            <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                              (Ready)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                            {v.resolution && <span>{v.resolution}</span>}
                            {v.resolution && <span className="text-zinc-600">•</span>}
                            {v.durationFormatted && <span>{v.durationFormatted}</span>}
                            {v.durationFormatted && <span className="text-zinc-600">•</span>}
                            <span>{v.sizeFormatted}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onPreviewVideo(v);
                          }}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Preview video"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300">
                            Select
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Transmission Settings (5 cols) */}
        <div className="lg:col-span-5 bg-[#0e121b] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">
              {streamMode === 'simulcast' ? 'Multi-Channel Simulcast' : 'Live Destination'}
            </h2>
            <button
              type="button"
              onClick={onOpenYouTubeGuide}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>How to find Key</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </button>
          </div>

          {/* Quick Saved Channel Selector if available */}
          {savedChannels.length > 0 && streamMode === 'standard' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Saved Channel Profile
              </label>
              <div className="flex flex-wrap gap-1.5">
                {savedChannels.map(channel => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleSelectChannelProfile(channel)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                      selectedChannelId === channel.id
                        ? 'bg-red-600/20 border-red-500/40 text-red-200'
                        : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="truncate max-w-[140px]">{channel.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Broadcast Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Live Broadcast Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 24/7 Continuous Live Broadcast"
              value={streamTitle}
              onChange={e => setStreamTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* STREAM MODE: STANDARD SINGLE STREAM */}
          {streamMode === 'standard' && (
            <>
              {/* Stream Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    YouTube Stream Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowStreamKey(!showStreamKey)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                  >
                    {showStreamKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-zinc-400" />}
                    <span>{showStreamKey ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showStreamKey ? 'text' : 'password'}
                  required
                  placeholder="Paste YouTube Stream Key (e.g. t9q4-twvd-...)"
                  value={streamKey}
                  onChange={e => setStreamKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white font-mono text-xs focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {/* RTMP Server URL */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Ingestion Server (RTMPS 443 Recommended)
                </label>
                <input
                  type="text"
                  value={rtmpUrl}
                  onChange={e => setRtmpUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-zinc-400 font-mono text-[11px] focus:outline-none focus:border-red-500"
                />
              </div>
            </>
          )}

          {/* STREAM MODE: MULTI-CHANNEL SIMULCAST */}
          {streamMode === 'simulcast' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Simulcast Destinations</span>
                  <span className="text-[11px] text-zinc-400">
                    Streams to multiple YouTube channels/keys at the same time via Tee muxer (zero double-encode penalty).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addSimulcastDestination}
                  className="px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Channel</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {simulcastDestinations.map((dest, idx) => (
                  <div
                    key={dest.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={dest.name}
                          onChange={e => updateSimulcastDestination(dest.id, 'name', e.target.value)}
                          placeholder="Channel Name"
                          className="bg-transparent text-white font-medium text-xs focus:outline-none focus:border-b border-indigo-500"
                        />
                      </div>
                      {simulcastDestinations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSimulcastDestination(dest.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                          title="Remove destination"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={dest.streamKey}
                      onChange={e => updateSimulcastDestination(dest.id, 'streamKey', e.target.value)}
                      placeholder="Paste YouTube Stream Key for this channel"
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transmission Options */}
          <div className="pt-2 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Continuous 24/7 Loop</span>
                <span className="text-[11px] text-zinc-400 block">Repeats video seamlessly indefinitely</span>
              </div>
              <input
                type="checkbox"
                checked={loopContinuously}
                onChange={e => setLoopContinuously(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 bg-white/[0.05] border-white/[0.1] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-white block mb-1.5">Encoding Preset</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEncodingMode('copy')}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    encodingMode === 'copy'
                      ? 'bg-white/[0.08] border-red-500/80 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-semibold block text-xs">Stream Copy</span>
                  <span className="text-[10px] text-zinc-400 block">0% CPU, recommended for VPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEncodingMode('transcode_1080p')}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${
                    encodingMode === 'transcode_1080p'
                      ? 'bg-white/[0.08] border-red-500/80 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-semibold block text-xs">1080p Standard</span>
                  <span className="text-[10px] text-zinc-400 block">Universal compatibility</span>
                </button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isStarting || !selectedVideo || (streamMode === 'standard' && !streamKey.trim())}
              className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-40 ${
                streamMode === 'simulcast' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {isStarting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Launching Cloud Broadcast...</span>
                </>
              ) : streamMode === 'simulcast' ? (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Launch Simulcast Stream</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Launch 24/7 Broadcast</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* URL Import Modal */}
      {showUrlImport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e121b] border border-white/[0.1] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-white tracking-tight">Direct Cloud URL Import</h3>
              </div>
              <button onClick={() => setShowUrlImport(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Enter a direct HTTP/HTTPS link to any video file. The cloud server will download it directly into storage with built-in SSRF protection and a 4GB quota.
            </p>
            <form onSubmit={handleUrlImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Direct Video URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/video.mp4"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-red-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Save Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. stream_video_part1.mp4"
                  value={importFilename}
                  onChange={e => setImportFilename(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUrlImport(false)}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Downloading to Cloud...</span>
                    </>
                  ) : (
                    <span>Download to Cloud</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
