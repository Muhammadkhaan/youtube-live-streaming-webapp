import React, { useState, useEffect } from 'react';
import {
  ListMusic,
  Plus,
  Trash2,
  Play,
  RotateCw,
  Clock,
  Film,
  CheckCircle2,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import { Playlist, VideoFile } from '../types';

interface PlaylistsViewProps {
  videos: VideoFile[];
  onStartWithPlaylist?: (playlist: Playlist) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  videos,
  onStartWithPlaylist,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  const fetchPlaylists = () => {
    setLoading(true);
    fetch('/api/playlists')
      .then(r => r.json())
      .then(d => setPlaylists(d.playlists || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || selectedVideos.length === 0) return;

    const items = selectedVideos.map((vidFilename, idx) => {
      const v = videos.find(x => x.filename === vidFilename);
      return {
        id: `item_${idx}_${Date.now()}`,
        mediaAssetId: v?.id || vidFilename,
        filename: vidFilename,
        displayName: v?.displayName || vidFilename,
        durationSeconds: v?.durationSeconds || 0,
        order: idx,
      };
    });

    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTitle.trim(),
        description: newDesc.trim(),
        items,
      }),
    });

    if (res.ok) {
      setNewTitle('');
      setNewDesc('');
      setSelectedVideos([]);
      setIsCreating(false);
      fetchPlaylists();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    fetchPlaylists();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Playlists & Looping Sequences</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Chain multiple clips into continuous 24/7 looping broadcast sequences (A → B → C → A).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#0F172A]">Create Looping Broadcast Playlist</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Playlist Name</label>
              <input
                type="text"
                required
                placeholder="e.g. 24/7 Music & Relax Morning Loop"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 4 video tracks running in rotation"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Select Media Clips in Order:</label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
              {videos.map(v => {
                const isSelected = selectedVideos.includes(v.filename);
                return (
                  <div
                    key={v.filename}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedVideos(selectedVideos.filter(f => f !== v.filename));
                      } else {
                        setSelectedVideos([...selectedVideos, v.filename]);
                      }
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border border-blue-200 font-semibold text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-slate-500" />
                      <span>{v.displayName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{v.durationFormatted || '--:--'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedVideos.length === 0}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              Save Playlist
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <ListMusic className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No playlists created yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Combine multiple media library videos into seamless sequences for multi-video 24/7 channels.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playlists.map(pl => (
            <div key={pl.id} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{pl.name}</h3>
                  {pl.description && <p className="text-xs text-slate-500 mt-0.5">{pl.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(pl.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Loop Sequence ({pl.items.length} clips):
                </div>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {pl.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between text-xs text-slate-700">
                      <span className="truncate max-w-[240px]">
                        {idx + 1}. {item.displayName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.durationSeconds ? `${Math.round(item.durationSeconds)}s` : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
