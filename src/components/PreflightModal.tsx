import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Cpu,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { PreflightCheckResult } from '../types';

interface PreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamName: string;
  videoFilename: string;
  rtmpUrl: string;
  streamKey?: string;
  mode?: string;
  onConfirmStart: () => void;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  isOpen,
  onClose,
  streamName,
  videoFilename,
  rtmpUrl,
  streamKey,
  mode = 'copy',
  onConfirmStart,
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PreflightCheckResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/streams/preflight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoFilename,
        rtmpUrl,
        streamKey,
        mode,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setResult(data);
      })
      .catch(() => {
        setResult({
          passed: false,
          checks: [
            {
              name: 'Server Communication',
              passed: false,
              message: 'Failed to communicate with preflight validation engine.',
            },
          ],
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, videoFilename, rtmpUrl, streamKey, mode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Preflight Broadcast Verification</h3>
              <p className="text-xs text-[#64748B]">Auditing cloud readiness for "{streamName}"</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-[#64748B] text-xs">
              <RotateCw className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span>Analyzing media compatibility and server resources...</span>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Overall status banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                  result.passed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {result.passed ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span>All preflight checks passed. Safe to broadcast.</span>
                      {result.recommendation && (
                        <span className="block text-[11px] font-normal mt-0.5 text-emerald-700">
                          Recommendation: {result.recommendation === 'STREAM_COPY' ? 'Stream Copy (Zero CPU overhead)' : 'Transcoding Mode'}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span>Attention needed before launching broadcast</span>
                      <span className="block text-[11px] font-normal mt-0.5 text-amber-700">
                        Review the check items below before proceeding.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Check items */}
              <div className="space-y-2">
                {result.checks.map((chk, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-3 text-xs"
                  >
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="font-bold text-[#0F172A]">{chk.name}</div>
                      <div className="text-[#64748B] text-[11px]">{chk.message}</div>
                      {chk.details && (
                        <div className="text-amber-700 font-medium text-[11px] pt-1">
                          {chk.details}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirmStart();
            }}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Broadcast</span>
          </button>
        </div>
      </div>
    </div>
  );
};
