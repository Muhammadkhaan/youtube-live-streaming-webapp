import React, { useState, useEffect } from 'react';
import {
  Radio,
  Square,
  RotateCw,
  Terminal,
  Clock,
  Trash2,
  Plus,
  Repeat,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ShieldCheck,
  Maximize2,
  Play,
  Cpu,
  Zap,
} from 'lucide-react';
import { StreamItem, StreamState } from '../types';
import { StreamDetailModal } from './StreamDetailModal';
import { PreflightModal } from './PreflightModal';

interface ActiveStreamsProps {
  streams: StreamItem[];
  onStopStream: (id: string) => Promise<boolean | void>;
  onStopAllStreams?: () => Promise<void>;
  onRestartStream: (id: string) => Promise<void>;
  onDeleteStreamRecord: (id: string) => Promise<void>;
  onOpenLogs: (stream: StreamItem) => void;
  onGoToCreate: () => void;
  onStartStream?: (stream: StreamItem) => void;
  isActionLoading: string | null;
}

export const ActiveStreams: React.FC<ActiveStreamsProps> = ({
  streams,
  onStopStream,
  onStopAllStreams,
  onRestartStream,
  onDeleteStreamRecord,
  onOpenLogs,
  onGoToCreate,
  onStartStream,
  isActionLoading,
}) => {
  const [, setTick] = useState(0);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);
  const [confirmStopAll, setConfirmStopAll] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);
  const [detailStream, setDetailStream] = useState<StreamItem | null>(null);
  const [preflightStream, setPreflightStream] = useState<StreamItem | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateUptime = (startedAt: string) => {
    try {
      const diffMs = Date.now() - new Date(startedAt).getTime();
      if (diffMs < 0) return '00:00:00';
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch {
      return '--:--:--';
    }
  };

  const isStreamActive = (s: StreamItem) => {
    const st = s.status;
    return st === 'LIVE' || st === 'running' || st === 'CONNECTING' || st === 'starting' || st === 'RECONNECTING' || st === 'DEGRADED';
  };

  const runningStreams = streams.filter(isStreamActive);
  const pastStreams = streams.filter(s => !isStreamActive(s));

  const handleStopAll = async () => {
    if (!onStopAllStreams) return;
    setIsStoppingAll(true);
    try {
      await onStopAllStreams();
      setConfirmStopAll(false);
    } finally {
      setIsStoppingAll(false);
    }
  };

  const renderStateBadge = (stream: StreamItem) => {
    const st = stream.status;
    if (st === 'LIVE' || st === 'running') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>LIVE</span>
        </span>
      );
    }
    if (st === 'RECONNECTING') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold text-[11px]">
          <RotateCw className="w-3 h-3 text-amber-600 animate-spin" />
          <span>RECONNECTING ({stream.retryAttempt || 1}/{stream.maxRetries || 5})</span>
        </span>
      );
    }
    if (st === 'CONNECTING' || st === 'starting') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-[11px]">
          <Radio className="w-3 h-3 text-blue-600 animate-pulse" />
          <span>CONNECTING</span>
        </span>
      );
    }
    if (st === 'DEGRADED') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-mono font-bold text-[11px]">
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
          <span>DEGRADED</span>
        </span>
      );
    }
    if (st === 'FAILED' || st === 'error') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono font-bold text-[11px]">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          <span>FAILED</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-bold text-[11px]">
        <Square className="w-2.5 h-2.5 text-slate-500" />
        <span>STOPPED</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Console Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Active Live Broadcasts</h1>
            {runningStreams.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>{runningStreams.length} Transmitting</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Independent cloud FFmpeg processes broadcasting 24/7 directly to YouTube Live & RTMP ingest nodes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {runningStreams.length > 1 && onStopAllStreams && (
            <>
              {confirmStopAll ? (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <button
                    onClick={handleStopAll}
                    disabled={isStoppingAll}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isStoppingAll ? 'Stopping...' : 'Confirm Stop All'}
                  </button>
                  <button
                    onClick={() => setConfirmStopAll(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white text-slate-600 text-xs border border-[#E2E8F0] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmStopAll(true)}
                  className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Stop All ({runningStreams.length})
                </button>
              )}
            </>
          )}

          <div className="flex items-center gap-3 text-xs font-mono text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-[#E2E8F0]">
            <div>
              <span className="text-slate-400">Live: </span>
              <span className="font-bold text-[#0F172A] tabular-nums">{runningStreams.length}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-400">History: </span>
              <span className="font-bold text-[#0F172A] tabular-nums">{pastStreams.length}</span>
            </div>
          </div>

          <button
            onClick={onGoToCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Live Stream</span>
          </button>
        </div>
      </div>

      {/* Multi-Stream Capability Highlight Banner */}
      {runningStreams.length > 1 && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs flex items-center justify-between gap-3 text-blue-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>
              <strong>Supervisor Multi-Stream Active:</strong> You are broadcasting {runningStreams.length} separate streams simultaneously on this server without cross-interference.
            </span>
          </div>
        </div>
      )}

      {/* Running Broadcasts Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#0F172A] tracking-tight uppercase tracking-wider font-mono">
          Live Transmissions ({runningStreams.length})
        </h2>

        {runningStreams.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white border border-dashed border-[#E2E8F0] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">No Live Broadcasts Running</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                No background streaming pipelines are active. Start a 24/7 broadcast to go live to YouTube.
              </p>
            </div>
            <button
              onClick={onGoToCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Launch a Live Stream</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {runningStreams.map(stream => {
              const uptime = calculateUptime(stream.startedAt);
              const isActionLoadingThis = isActionLoading === stream.id;
              const isConfirmingStop = confirmStopId === stream.id;
              const hasMultiDest = stream.destinations && stream.destinations.length > 1;

              return (
                <div
                  key={stream.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Stream Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs mb-1.5 flex-wrap">
                        {renderStateBadge(stream)}

                        <span className="font-mono text-slate-500 text-[11px] tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{uptime}</span>
                        </span>

                        {stream.loop && (
                          <span className="text-slate-600 text-[11px] flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                            <Repeat className="w-3 h-3 text-slate-400" />
                            <span>24/7 Loop</span>
                          </span>
                        )}

                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Auto-Restart ON
                        </span>

                        {hasMultiDest && (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono text-[10px]">
                            Simulcast ({stream.destinations!.length} channels)
                          </span>
                        )}

                        {stream.channelTitle && (
                          <span className="text-slate-800 font-semibold text-[11px]">
                            {stream.channelTitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#0F172A] tracking-tight truncate">
                          {stream.name || stream.title}
                        </h3>
                        <button
                          onClick={() => setDetailStream(stream)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5 cursor-pointer ml-1"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Workspace</span>
                        </button>
                      </div>

                      {/* Technical Details Strip */}
                      <div className="flex items-center gap-2 mt-2.5 text-xs font-mono text-slate-600 flex-wrap">
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          FPS: <strong className="text-[#0F172A]">{stream.fps || '30'}</strong>
                        </span>
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Bitrate: <strong className="text-emerald-700">{stream.bitrate || '4500k'}</strong>
                        </span>
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Speed: <strong className="text-[#2563EB]">{stream.speed || '1.0x'}</strong>
                        </span>
                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Mode: <strong className="text-slate-800">{stream.mode}</strong>
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Key: {stream.maskedStreamKey}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        onClick={() => onOpenLogs(stream)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5 text-slate-500" />
                        <span>Logs</span>
                      </button>

                      <button
                        disabled={isActionLoadingThis}
                        onClick={() => onRestartStream(stream.id)}
                        className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-xs transition-colors cursor-pointer"
                        title="Restart stream"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isActionLoadingThis ? 'animate-spin text-[#2563EB]' : ''}`} />
                      </button>

                      {isConfirmingStop ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <button
                            disabled={isActionLoadingThis}
                            onClick={() => {
                              onStopStream(stream.id);
                              setConfirmStopId(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Confirm End
                          </button>
                          <button
                            onClick={() => setConfirmStopId(null)}
                            className="px-2.5 py-1.5 rounded-xl bg-white text-slate-600 text-xs border border-[#E2E8F0] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isActionLoadingThis}
                          onClick={() => setConfirmStopId(stream.id)}
                          className="px-4 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>End Stream</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Streams History */}
      {pastStreams.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Broadcast Configurations & History ({pastStreams.length})
          </h2>
          <div className="space-y-2">
            {pastStreams.map(stream => (
              <div
                key={stream.id}
                className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-between text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0F172A] truncate">{stream.name || stream.title}</span>
                    {renderStateBadge(stream)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Mode: {stream.mode} • File: {stream.videoFilename} • {stream.maskedStreamKey}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onStartStream) onStartStream(stream);
                      else onRestartStream(stream.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Go Live</span>
                  </button>
                  <button
                    onClick={() => setDetailStream(stream)}
                    className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Workspace
                  </button>
                  <button
                    onClick={() => onOpenLogs(stream)}
                    className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Logs
                  </button>
                  <button
                    onClick={() => onDeleteStreamRecord(stream.id)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stream Detail Workspace Modal */}
      <StreamDetailModal
        stream={detailStream}
        onClose={() => setDetailStream(null)}
        onStart={s => {
          if (onStartStream) onStartStream(s);
          else onRestartStream(s.id);
          setDetailStream(null);
        }}
        onStop={id => {
          onStopStream(id);
          setDetailStream(null);
        }}
        onRestart={id => onRestartStream(id)}
        onRunPreflight={s => setPreflightStream(s)}
      />

      {/* Preflight Check Modal */}
      {preflightStream && (
        <PreflightModal
          isOpen={!!preflightStream}
          onClose={() => setPreflightStream(null)}
          streamName={preflightStream.name || preflightStream.title}
          videoFilename={preflightStream.videoFilename}
          rtmpUrl={preflightStream.rtmpUrl}
          mode={preflightStream.mode}
          onConfirmStart={() => {
            if (onStartStream) onStartStream(preflightStream);
            else onRestartStream(preflightStream.id);
            setPreflightStream(null);
          }}
        />
      )}
    </div>
  );
};
