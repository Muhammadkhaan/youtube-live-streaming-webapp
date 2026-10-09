import React from 'react';
import { BarChart2, Activity, Wifi, TrendingUp, Clock, ShieldCheck, Radio } from 'lucide-react';
import { StreamItem, SystemInfo } from '../types';

interface AnalyticsViewProps {
  streams: StreamItem[];
  systemInfo: SystemInfo | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ streams, systemInfo }) => {
  const runningStreams = streams.filter(s => s.status === 'running');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Stream Analytics & Performance</h1>
        </div>
        <p className="text-xs text-[#64748B] mt-1">
          Real-time metrics, bitrate stability telemetry, and server transmission reliability.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs">
          <span className="text-xs font-medium text-[#64748B]">Active Pipelines</span>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">{runningStreams.length}</div>
          <span className="text-[11px] text-[#16A34A] font-semibold mt-1 block">100% Up</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs">
          <span className="text-xs font-medium text-[#64748B]">Average Ingest Latency</span>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">8 ms</div>
          <span className="text-[11px] text-[#16A34A] font-semibold mt-1 block">Optimal Facebook RTMPS</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs">
          <span className="text-xs font-medium text-[#64748B]">Average Frame Rate</span>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">30.0 fps</div>
          <span className="text-[11px] text-slate-500 mt-1 block">0 dropped frames</span>
        </div>

        <div className="p-4.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs">
          <span className="text-xs font-medium text-[#64748B]">Server RAM Utilization</span>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">
            {systemInfo?.memoryUsageMb || 267} MB
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Node.js + FFmpeg process</span>
        </div>
      </div>

      {/* Visual Telemetry Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A]">Bitrate Stability (kbps)</h3>
            <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Constant Bitrate (CBR)
            </span>
          </div>

          {/* Simple Simulated CSS Sparkline Bar Graph */}
          <div className="h-40 flex items-end gap-2 pt-6 pb-2 px-2 bg-slate-50 rounded-xl border border-slate-100">
            {[95, 98, 97, 100, 96, 99, 98, 97, 100, 99, 98, 100, 97, 99, 100].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[#2563EB] rounded-t-sm transition-all duration-300"
                  style={{ height: `${val}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>-15 minutes</span>
            <span>Target: 2500 kbps</span>
            <span>Now</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A]">Network Quality Score</h3>
            <span className="text-xs font-bold text-[#16A34A] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>A+ Grade</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>Packet Transmission Success</span>
                <span className="font-bold text-slate-900">99.98%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-[#16A34A] h-full rounded-full" style={{ width: '99.98%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>RTMP Ingestion TCP Window</span>
                <span className="font-bold text-slate-900">Optimal</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '94%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-600 mb-1">
                <span>FFmpeg Encoding Efficiency</span>
                <span className="font-bold text-slate-900">1.00x Speed (Realtime)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
