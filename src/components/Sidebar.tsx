import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Calendar,
  PlaySquare,
  Link2,
  BarChart2,
  Settings,
  ListMusic,
  FileText,
  Server,
  Crown,
} from 'lucide-react';

export type NavTabId =
  | 'dashboard'
  | 'streams'
  | 'scheduled'
  | 'videos'
  | 'playlists'
  | 'channels'
  | 'analytics'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentTab: NavTabId;
  setCurrentTab: (tab: NavTabId) => void;
  activeStreamsCount: number;
  scheduledCount?: number;
  videosCount?: number;
  channelsCount?: number;
  onOpenUpgradeModal?: () => void;
  onOpenDiagnostics?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  activeStreamsCount,
  scheduledCount = 0,
  onOpenUpgradeModal,
  onOpenDiagnostics,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTabId,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'streams' as NavTabId,
      label: 'Live Broadcast',
      icon: Radio,
      badge:
        activeStreamsCount > 0 ? (
          <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            {activeStreamsCount}
          </span>
        ) : null,
    },
    {
      id: 'scheduled' as NavTabId,
      label: 'Scheduler',
      icon: Calendar,
      badge:
        scheduledCount > 0 ? (
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium font-mono">
            {scheduledCount}
          </span>
        ) : null,
    },
    {
      id: 'videos' as NavTabId,
      label: 'Media Library',
      icon: PlaySquare,
      badge: null,
    },
    {
      id: 'playlists' as NavTabId,
      label: 'Playlists',
      icon: ListMusic,
      badge: null,
    },
    {
      id: 'channels' as NavTabId,
      label: 'Destinations & Keys',
      icon: Link2,
      badge: null,
    },
    {
      id: 'analytics' as NavTabId,
      label: 'Analytics',
      icon: BarChart2,
      badge: null,
    },
    {
      id: 'audit' as NavTabId,
      label: 'Audit Trail',
      icon: FileText,
      badge: null,
    },
    {
      id: 'settings' as NavTabId,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  const handleNavClick = (id: NavTabId) => {
    setCurrentTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          {/* Brand Logo Header */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#E2E8F0]">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/20 shrink-0">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-[#0F172A] tracking-tight">CloudCast</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">CLOUD</span>
              </div>
              <p className="text-[11px] font-medium text-[#64748B] truncate">24/7 Multi-Stream Engine</p>
            </div>
          </div>

          {/* Nav Items List */}
          <nav className="mt-4 space-y-1 flex-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#EFF6FF] text-[#2563EB] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#2563EB]' : 'text-[#64748B]'
                    }`}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge}
                </button>
              );
            })}
          </nav>

          {/* Server Diagnostics & Cloud Status */}
          <div className="mt-4 pt-3 border-t border-[#E2E8F0] space-y-2">
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-purple-600" />
                  <span>Node Diagnostics</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            )}

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 text-center space-y-2 shadow-2xs">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Cloud Server Active</span>
              </div>
              <p className="text-[11px] text-[#64748B] leading-tight">
                Streams continue 24/7 if browser is disconnected.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
