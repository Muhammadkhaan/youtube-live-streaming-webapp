import React from 'react';
import { X, Play, Video, Volume2, VolumeX, Layers, Clock, HardDrive } from 'lucide-react';
import { VideoFile } from '../types';

interface VideoPreviewModalProps {
  video: VideoFile | null;
  onClose: () => void;
  onStreamThisVideo: (filename: string) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  onClose,
  onStreamThisVideo,
}) => {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-red-600/20 text-red-500">
              <Video className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-white truncate max-w-md" title={video.displayName}>
              {video.displayName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="bg-black flex items-center justify-center relative aspect-video max-h-[55vh]">
          <video
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            src={video.url || `/uploads/${encodeURIComponent(video.filename)}`}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Video Technical Specs */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Resolution</span>
            <span className="font-mono text-white font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              {video.resolution || 'Original'}
            </span>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Duration</span>
            <span className="font-mono text-white font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {video.durationFormatted || '--:--'}
            </span>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">File Size</span>
            <span className="font-mono text-white font-semibold flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              {video.sizeFormatted}
            </span>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Audio Track</span>
            <span className={`font-mono text-xs font-semibold flex items-center gap-1 ${video.hasAudio !== false ? 'text-cyan-400' : 'text-amber-400'}`}>
              {video.hasAudio !== false ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  {video.audioCodec ? video.audioCodec.toUpperCase() : 'Stereo Audio'}
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  Silent (Auto-padded)
                </>
              )}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Uploaded: {new Date(video.createdAt).toLocaleString()}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onStreamThisVideo(video.filename);
                onClose();
              }}
              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Broadcast This Video Live</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
