import React, { useRef, useEffect, useState } from 'react';
import { Terminal, X, Copy, Check, Radio, Activity, RefreshCw } from 'lucide-react';
import { StreamItem } from '../types';

interface LiveLogsModalProps {
  stream: StreamItem | null;
  onClose: () => void;
}

export const LiveLogsModal: React.FC<LiveLogsModalProps> = ({ stream, onClose }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (stream) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [stream?.recentLogs]);

  if (!stream) return null;

  const handleCopyLogs = () => {
    const text = stream.recentLogs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Terminal Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs text-slate-300 font-semibold truncate max-w-sm">
              ffmpeg : {stream.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
              title="Copy terminal logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time stats sub-bar */}
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800/80 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${stream.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span className="uppercase font-bold text-[10px] text-slate-300">{stream.status}</span>
            </span>
            <span>FPS: <strong className="text-cyan-400 font-mono">{stream.fps || 'N/A'}</strong></span>
            <span>Bitrate: <strong className="text-emerald-400 font-mono">{stream.bitrate || 'N/A'}</strong></span>
            <span>Speed: <strong className="text-amber-400 font-mono">{stream.speed || '1.0x'}</strong></span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
            File: {stream.videoFilename}
          </div>
        </div>

        {/* Terminal Logs Output */}
        <div className="p-4 bg-black font-mono text-xs text-emerald-400 overflow-y-auto flex-1 space-y-1 select-text leading-relaxed">
          {stream.recentLogs.length === 0 ? (
            <div className="text-slate-600 italic">Waiting for FFmpeg output stream...</div>
          ) : (
            stream.recentLogs.map((log: string, index: number) => {
              const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
              const isWarn = log.toLowerCase().includes('warning');
              const isProgress = log.includes('frame=') || log.includes('fps=');
              return (
                <div
                  key={index}
                  className={`break-all ${
                    isError
                      ? 'text-red-400 font-semibold'
                      : isWarn
                      ? 'text-amber-400'
                      : isProgress
                      ? 'text-cyan-300/90'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Updates automatically from remote server process</span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
