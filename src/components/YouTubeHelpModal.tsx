import React from 'react';
import { X, ExternalLink, Key, CheckCircle2, AlertTriangle } from 'lucide-react';

interface YouTubeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const YouTubeHelpModal: React.FC<YouTubeHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">How to Find Your YouTube Stream Key</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="font-semibold text-white">Go to YouTube Studio Live</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click the button below to open your YouTube Live control room directly in a new tab:
                </p>
                <a
                  href="https://studio.youtube.com/channel/live/livestreaming"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  <span>Open YouTube Studio Live Room</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="font-semibold text-white">Click &quot;Stream&quot; in the left sidebar</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You will see your live broadcast setup screen with title, category, and stream settings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="font-semibold text-white">Look under &quot;Stream Settings&quot;</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You will find two key fields:
                </p>
                <div className="mt-2 space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block font-mono">Stream URL:</span>
                    <span className="font-mono text-cyan-400">rtmp://a.rtmp.youtube.com/live2</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-mono">Stream Key:</span>
                    <span className="font-mono text-emerald-400">••••-••••-••••-••••</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Click the &quot;Copy&quot; button next to the dots in YouTube Studio.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div>
                <p className="font-semibold text-white">Recommended Settings for 24/7 Live Streams</p>
                <div className="mt-2 space-y-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Stream Latency:</strong> Set to &quot;Normal latency&quot; for highest buffering resilience.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Auto-stop:</strong> Make sure Auto-stop is <em>disabled</em>.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-amber-950/40 rounded-xl border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-200">Never share your stream key!</strong>
              Anyone who has your stream key can broadcast onto your YouTube channel.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
