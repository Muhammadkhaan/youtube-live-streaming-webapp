import React, { useState, useRef } from 'react';
import {
  Upload,
  Trash2,
  Play,
  FileVideo,
  Plus,
  Radio,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Link as LinkIcon,
  X,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { VideoFile, UploadProgressInfo } from '../types';

interface VideoLibraryProps {
  videos: VideoFile[];
  onUploadFile: (file: File) => Promise<string | null>;
  onDeleteVideo: (filename: string) => Promise<boolean>;
  onGenerateTestVideo: () => Promise<string | null>;
  onStartWithVideo: (filename: string) => void;
  onPreviewVideo: (video: VideoFile) => void;
  uploadProgress: number | null;
  uploadInfo?: UploadProgressInfo | null;
  onCancelUpload?: () => void;
  onImportVideoUrl?: (url: string, filename?: string) => Promise<string | null>;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  videos,
  onUploadFile,
  onDeleteVideo,
  onGenerateTestVideo,
  onStartWithVideo,
  onPreviewVideo,
  uploadProgress,
  uploadInfo,
  onCancelUpload,
  onImportVideoUrl,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // URL Import Modal state
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUploadFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null);
    try {
      const filename = await onGenerateTestVideo();
      if (filename) {
        setMessage({ text: 'Generated 30-second SMPTE test video pattern!', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to generate test video', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    if (!onImportVideoUrl) {
      setMessage({ text: 'URL import not supported', type: 'error' });
      return;
    }
    setIsImporting(true);
    setMessage(null);
    try {
      const filename = await onImportVideoUrl(importUrl.trim(), importFilename.trim());
      if (filename) {
        setShowUrlImport(false);
        setImportUrl('');
        setImportFilename('');
        setMessage({ text: `Imported video directly to server!`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to import video from URL', type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (filename: string, displayName: string) => {
    setConfirmDeleteFile(null);
    setDeletingFile(filename);
    setMessage(null);
    try {
      const success = await onDeleteVideo(filename);
      if (success) {
        setMessage({ text: `Deleted "${displayName}".`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to delete video', type: 'error' });
    } finally {
      setDeletingFile(null);
    }
  };

  const filteredVideos = videos.filter(v =>
    v.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = videos.reduce((acc, v) => acc + v.sizeBytes, 0);
  const totalFormatted = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Permanent Media Storage</h1>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Multi-Broadcast Ready</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1 font-mono">
            <span>{videos.length} saved video{videos.length === 1 ? '' : 's'}</span>
            <span>•</span>
            <span>Total: {totalFormatted}</span>
            <span>•</span>
            <span className="text-[#64748B] font-sans">Stored permanently on server disk</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#E2E8F0] shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isGenerating ? 'Generating...' : 'Make Color Bars Test'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowUrlImport(true)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#E2E8F0] shadow-2xs"
            title="Download directly from cloud link (HTTP/HTTPS)"
          >
            <LinkIcon className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Import from URL</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload New Video</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Progress Bar if Active */}
      {uploadProgress !== null && (
        <div className="p-4 rounded-2xl bg-white border border-[#2563EB] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#2563EB] animate-bounce" />
              <span className="font-bold text-[#0F172A]">
                Uploading: {uploadInfo?.filename || 'video file'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[#2563EB] font-bold">{uploadProgress}%</span>
              {onCancelUpload && (
                <button
                  onClick={onCancelUpload}
                  className="text-slate-400 hover:text-red-600 font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#2563EB] h-full rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all ${
          isDragging
            ? 'border-[#2563EB] bg-blue-50'
            : 'border-[#E2E8F0] bg-white hover:border-slate-300'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6 text-[#2563EB]" />
        </div>
        <h3 className="text-sm font-bold text-[#0F172A]">Drag & drop video files here</h3>
        <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
          Supports MP4, MKV, MOV, FLV, TS files. Direct cloud upload with automatic resume.
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          Select from Computer
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved videos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-[#E2E8F0] text-center text-xs text-[#64748B]">
          No video files found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map(video => (
            <div
              key={video.filename}
              className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                      <FileVideo className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-[#0F172A] truncate block" title={video.displayName}>
                      {video.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                    {video.sizeFormatted}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono text-[#64748B] mt-2">
                  {video.resolution && <span>{video.resolution}</span>}
                  {video.durationFormatted && <span>• {video.durationFormatted}</span>}
                  {video.hasAudio !== false && <span>• Audio OK</span>}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPreviewVideo(video)}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 text-xs"
                    title="Preview video"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {confirmDeleteFile === video.filename ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(video.filename, video.displayName)}
                        className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteFile(null)}
                        className="px-2 py-1 rounded-lg border text-slate-500 text-[10px]"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={deletingFile === video.filename}
                      onClick={() => setConfirmDeleteFile(video.filename)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onStartWithVideo(video.filename)}
                  className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Radio className="w-3 h-3" />
                  <span>Stream Live</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* URL Import Modal */}
      {showUrlImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#0F172A]">Import Video from Cloud URL</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUrlImport(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUrlSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Video Download URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/stream.mp4"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">Custom Filename (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ambient_music_live.mp4"
                  value={importFilename}
                  onChange={e => setImportFilename(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUrlImport(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isImporting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Start Download</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
