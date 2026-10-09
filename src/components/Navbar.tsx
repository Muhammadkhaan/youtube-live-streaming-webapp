import React from 'react';
import { Radio, ExternalLink, Plus, Video, BookOpen, RefreshCw, Youtube, LayoutDashboard } from 'lucide-react';
import { SystemInfo } from '../types';

interface NavbarProps {
  currentTab: 'dashboard' | 'streams' | 'create' | 'youtube' | 'videos' | 'guide';
  setCurrentTab: (tab: 'dashboard' | 'streams' | 'create' | 'youtube' | 'videos' | 'guide') => void;
  activeCount: number;
  videosCount?: number;
  systemInfo: SystemInfo | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeCount,
  videosCount = 0,
  systemInfo,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="bg-[#0b0e14] border-b border-white/[0.08] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <span className="font-bold text-base text-white tracking-tight">CloudCast</span>
            </button>
          </div>

          {/* Clean Segmented Tab Navigation */}
          <nav className="flex items-center p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs font-medium">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'dashboard'
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('streams')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'streams'
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-red-500" />
              <span>Broadcasts</span>
              {activeCount > 0 && (
                <span className="font-mono text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.2 rounded-full tabular-nums">
                  {activeCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('create')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'create'
                  ? 'bg-red-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Launch</span>
            </button>

            <button
              onClick={() => setCurrentTab('youtube')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'youtube'
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">Channels & Keys</span>
              <span className="sm:hidden">Channels</span>
            </button>

            <button
              onClick={() => setCurrentTab('videos')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'videos'
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline">Media Library</span>
              <span className="md:hidden">Media</span>
              {videosCount > 0 && (
                <span className="font-mono text-[10px] font-semibold text-emerald-400 tabular-nums">
                  ({videosCount})
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('guide')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'guide'
                  ? 'bg-white/[0.12] text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden lg:inline">VPS Guide</span>
            </button>
          </nav>

          {/* Right Utility: Server Status & Links */}
          <div className="flex items-center gap-3 text-xs">
            <a
              href="https://studio.youtube.com/channel/live/livestreaming"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
            >
              <span>YT Studio</span>
              <ExternalLink className="w-3 h-3 text-zinc-500" />
            </a>
            <button
              onClick={onRefresh}
              title="Refresh telemetry"
              disabled={isLoading}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
