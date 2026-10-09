import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  HardDrive,
  Cpu,
  Radio,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ServerDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerDiagnosticsModal: React.FC<ServerDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchDiagnostics = () => {
    setLoading(true);
    fetch('/api/diagnostics')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">CloudCast System Diagnostics</h3>
              <p className="text-xs text-[#64748B]">Cloud VPS runtime health & broadcast readiness</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDiagnostics}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              title="Refresh Diagnostics"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {loading && !data ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-500">
              <RotateCw className="w-6 h-6 animate-spin text-purple-600" />
              <span>Querying cloud hardware & network sockets...</span>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Grid 1: Core binaries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3 text-xs">
                  {data.ffmpeg.available ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 block">FFmpeg Broadcast Engine</span>
                    <span className="text-[11px] font-mono text-slate-600 block truncate max-w-[220px]">
                      {data.ffmpeg.version || 'Not Detected'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3 text-xs">
                  {data.ffprobe.available ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 block">FFprobe Media Inspector</span>
                    <span className="text-[11px] font-mono text-slate-600 block truncate max-w-[220px]">
                      {data.ffprobe.version || 'Not Detected'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Storage & Database */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3 text-xs">
                  <HardDrive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold text-slate-900 block">Media Storage Volume</span>
                    <span className="text-[11px] text-slate-600 block">
                      Uploads Directory: {data.storage.uploadsDirWritable ? 'Writable (OK)' : 'Read-Only (Error)'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Total Media: {(data.storage.mediaBytesTotal / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3 text-xs">
                  <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold text-slate-900 block">Atomic Database Engine</span>
                    <span className="text-[11px] text-slate-600 block">
                      Status: {data.database.healthy ? 'ACID Resilient (OK)' : 'Error'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {data.database.streamsCount} Streams • {data.database.destinationsCount} Destinations
                    </span>
                  </div>
                </div>
              </div>

              {/* Network Socket Tests */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">RTMP Broadcast Ingest Network Check</span>
                  <Radio className="w-4 h-4 text-amber-500" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">YouTube Secure RTMPS (Port 443)</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {data.network.youtubeRtmps443.reachable
                        ? `✓ Reachable (${data.network.youtubeRtmps443.latencyMs || 14} ms)`
                        : '✗ Unreachable'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">YouTube Standard RTMP (Port 1935)</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {data.network.youtubeRtmp1935.reachable
                        ? `✓ Reachable (${data.network.youtubeRtmp1935.latencyMs || 18} ms)`
                        : 'Blocked / Firewall (RTMPS 443 Recommended)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600">Facebook Live RTMPS (Port 443)</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {data.network.facebookRtmps443.reachable
                        ? `✓ Reachable (${data.network.facebookRtmps443.latencyMs || 22} ms)`
                        : '✗ Unreachable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-end bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
