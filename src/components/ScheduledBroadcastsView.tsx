import React from 'react';
import { Calendar, Plus, Clock, Trash2, Radio, Video, ExternalLink, Play } from 'lucide-react';
import { ScheduledBroadcast, VideoFile, YouTubeChannelProfile } from '../types';

interface ScheduledBroadcastsViewProps {
  scheduledList: ScheduledBroadcast[];
  onOpenScheduleModal: () => void;
  onGoLiveEarly: (broadcast: ScheduledBroadcast) => void;
  onDeleteSchedule: (id: string) => void;
}

export const ScheduledBroadcastsView: React.FC<ScheduledBroadcastsViewProps> = ({
  scheduledList,
  onOpenScheduleModal,
  onGoLiveEarly,
  onDeleteSchedule,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Scheduled Broadcasts</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {scheduledList.length} Planned
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Automate and plan upcoming 24/7 Facebook Live broadcasts ahead of time.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenScheduleModal}
          className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Schedule</span>
        </button>
      </div>

      {/* List */}
      {scheduledList.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-dashed border-[#E2E8F0] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">No Upcoming Scheduled Streams</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Plan your live broadcast schedule. When the scheduled time arrives, the server daemon can automatically initiate transmission to your Facebook Live channel.
          </p>
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Scheduled Broadcast</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scheduledList.map(item => {
            const dateObj = new Date(item.scheduledAt);
            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[11px] font-semibold border border-blue-100 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(item.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors"
                      title="Cancel schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-[#0F172A]">{item.title}</h3>
                  <div className="mt-2 space-y-1 text-xs text-[#64748B]">
                    <div className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">File: {item.videoFilename}</span>
                    </div>
                    {item.channelTitle && (
                      <div className="flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-slate-400" />
                        <span>Channel: {item.channelTitle}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">Mode: {item.mode}</span>
                  <button
                    type="button"
                    onClick={() => onGoLiveEarly(item)}
                    className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Go Live Early</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
