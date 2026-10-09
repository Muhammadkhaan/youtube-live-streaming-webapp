import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Menu, CheckCircle2, Radio, AlertTriangle, Flame, X, Trash2, Play } from 'lucide-react';
import { StreamAlert } from '../types';

interface TopNavProps {
  onToggleMobileMenu: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  alerts?: StreamAlert[];
  onClearAlerts?: () => void;
  onTriggerTestAlert?: (type: 'latency' | 'cpu') => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onToggleMobileMenu,
  searchQuery,
  setSearchQuery,
  alerts = [],
  onClearAlerts,
  onTriggerTestAlert,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeAlertsCount = alerts.filter(a => !a.dismissed).length;

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Mobile toggle & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Field */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search anything..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#2563EB] transition-colors"
          />
        </div>
      </div>

      {/* Right Controls: Notifications & User Avatar */}
      <div className="flex items-center gap-3 relative">
        {/* Notification Bell with Dynamic Alert Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 rounded-xl relative transition-colors cursor-pointer ${
              activeAlertsCount > 0
                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 ? (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold font-mono absolute -top-1 -right-1 ring-2 ring-white animate-pulse">
                {activeAlertsCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-300 absolute top-1.5 right-1.5 ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-3 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0F172A]">Real-Time Broadcast Alerts</span>
                  {activeAlertsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold font-mono">
                      {activeAlertsCount} Active
                    </span>
                  )}
                </div>
                {onClearAlerts && alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAlerts}
                    className="text-[11px] font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Alert List */}
              <div className="mt-2.5 space-y-2 max-h-72 overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <span className="font-semibold block text-slate-700">All Metrics Nominal</span>
                    <span>Latency &lt; 500ms • CPU &lt; 85%</span>
                  </div>
                ) : (
                  alerts.map(a => (
                    <div
                      key={a.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                        a.type === 'cpu'
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {a.type === 'cpu' ? (
                        <Flame className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate">{a.title}</span>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 leading-snug">{a.message}</p>
                      </div>
                    </div>
                  ))
                )}

                {/* Base Nominal Status */}
                <div className="p-2 rounded-lg bg-slate-50 text-slate-600 flex items-start gap-2 text-xs">
                  <Radio className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-slate-800">CloudCast Telemetry Active</span>
                    <span className="text-[11px] text-slate-500">Polling socket latency &amp; server CPU every 3s</span>
                  </div>
                </div>
              </div>

              {/* Quick Interactive Alert Simulation Bar */}
              {onTriggerTestAlert && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Test Alerts:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onTriggerTestAlert('latency')}
                      className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold"
                    >
                      &gt;500ms Latency
                    </button>
                    <button
                      type="button"
                      onClick={() => onTriggerTestAlert('cpu')}
                      className="px-2 py-0.5 rounded bg-red-100 text-red-800 hover:bg-red-200 font-semibold"
                    >
                      &gt;85% CPU
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Avatar & Account Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 sm:px-2 py-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 border border-slate-300">
              YT
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-[#0F172A]">
              YT Studio
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in text-xs text-[#0F172A]">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <span className="font-bold block">YT Studio</span>
                <span className="text-[11px] text-slate-500 truncate block">wpeureka.official@gmail.com</span>
              </div>
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Channel Settings
              </button>
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                RTMP Endpoint Keys
              </button>
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 text-red-600 transition-colors"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
