import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Server, Bell, Save, Check } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [rtmpEndpoint, setRtmpEndpoint] = useState('rtmps://live-api-s.facebook.com:443/rtmp/');
  const [defaultResolution, setDefaultResolution] = useState('1080p');
  const [autoLoop, setAutoLoop] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Platform & Streaming Settings</h1>
        <p className="text-xs text-[#64748B] mt-1">
          Configure default ingestion endpoints, hardware encoding presets, and live alerts.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Ingest Server Configuration */}
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-[#0F172A]">Default Ingestion Endpoint</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[#0F172A] mb-1">Facebook RTMPS Ingestion URL</label>
              <input
                type="text"
                value={rtmpEndpoint}
                onChange={e => setRtmpEndpoint(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
              <p className="text-[11px] text-[#64748B] mt-1">
                Standard secure Facebook live transmission endpoint over TLS port 443.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Default Resolution</label>
                <select
                  value={defaultResolution}
                  onChange={e => setDefaultResolution(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A]"
                >
                  <option value="1080p">1080p (Full HD - 1920x1080)</option>
                  <option value="720p">720p (HD - 1280x720)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Continuous Streaming</label>
                <div className="flex items-center gap-2 h-10">
                  <input
                    type="checkbox"
                    id="autoLoop"
                    checked={autoLoop}
                    onChange={e => setAutoLoop(e.target.checked)}
                    className="rounded text-[#2563EB]"
                  />
                  <label htmlFor="autoLoop" className="text-slate-700 cursor-pointer">
                    Enable 24/7 infinite loop by default
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access */}
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#16A34A]" />
            <h3 className="text-sm font-bold text-[#0F172A]">Stream Key Security & Masking</h3>
          </div>
          <p className="text-xs text-[#64748B]">
            All Facebook and YouTube stream keys are encrypted and masked before transmission to the client browser to prevent accidental exposure on screen shares.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {savedSuccess && (
            <span className="text-xs font-semibold text-[#16A34A] flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Settings saved successfully!</span>
            </span>
          )}
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
