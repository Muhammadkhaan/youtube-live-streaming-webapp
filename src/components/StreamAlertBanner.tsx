import React from 'react';
import {
  AlertTriangle,
  Flame,
  Activity,
  X,
  RotateCw,
  Sliders,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { StreamAlert } from '../types';

interface StreamAlertBannerProps {
  alerts: StreamAlert[];
  onDismissAlert: (id: string) => void;
  onDismissAll?: () => void;
  onRePing?: () => void;
  onNavigateTab?: (tab: any) => void;
  onSimulateSpike?: (type: 'latency' | 'cpu' | 'reset') => void;
  onResetSimulation?: () => void;
  isSimulated?: boolean;
}

export const StreamAlertBanner: React.FC<StreamAlertBannerProps> = ({
  alerts,
  onDismissAlert,
  onDismissAll,
  onRePing,
  onNavigateTab,
  onSimulateSpike,
  onResetSimulation,
  isSimulated,
}) => {
  const activeAlerts = alerts.filter(a => !a.dismissed);
  if (activeAlerts.length === 0) return null;

  const hasCpuSpike = activeAlerts.some(a => a.type === 'cpu');
  const hasLatencySpike = activeAlerts.some(a => a.type === 'latency');

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {activeAlerts.map(alert => {
        const isCpu = alert.type === 'cpu';
        const isCritical = alert.severity === 'critical' || alert.value >= 90;

        return (
          <div
            key={alert.id}
            role="alert"
            className={`rounded-2xl p-4 border transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isCpu
                ? 'bg-red-50/90 border-red-200 text-red-950'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
            }`}
          >
            {/* Left: Icon & Alert Message */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isCpu
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-amber-500 text-white animate-pulse'
                }`}
              >
                {isCpu ? <Flame className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                      isCpu
                        ? 'bg-red-200 text-red-900'
                        : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {isCpu ? 'Server Alert' : 'Network Alert'} • {alert.severity.toUpperCase()}
                  </span>
                  <h4 className="text-sm font-bold tracking-tight">
                    {alert.title}
                  </h4>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 border border-black/5">
                    {alert.value}
                    {isCpu ? '%' : 'ms'} (Threshold: {alert.threshold}
                    {isCpu ? '%' : 'ms'})
                  </span>
                </div>

                <p className="text-xs mt-1 text-slate-700 leading-relaxed font-normal">
                  {alert.message}
                </p>

                {alert.streamTitle && (
                  <p className="text-[11px] mt-0.5 text-slate-500">
                    Affected Stream: <span className="font-semibold text-slate-700">{alert.streamTitle}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              {isCpu ? (
                <>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('streams')}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Manage Streams</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {onRePing && (
                    <button
                      type="button"
                      onClick={onRePing}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Re-ping Ingest</span>
                    </button>
                  )}
                </>
              )}

              {/* Reset simulation shortcut if this was triggered via test simulation */}
              {isSimulated && onResetSimulation && (
                <button
                  type="button"
                  onClick={onResetSimulation}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Restore nominal metrics"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Restore Normal</span>
                </button>
              )}

              {/* Dismiss Alert button */}
              <button
                type="button"
                onClick={() => onDismissAlert(alert.id)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer"
                title="Dismiss alert"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
