import React, { useState } from 'react';
import {
  BookOpen,
  Server,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Radio,
  PowerOff,
  AlertCircle,
  HelpCircle,
  Download,
  CheckCircle2,
  Tv,
  Layers,
} from 'lucide-react';

export const SetupGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyButton = (text: string, index: number) => (
    <button
      onClick={() => copyToClipboard(text, index)}
      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs shrink-0 border border-slate-700"
      title="Copy command"
    >
      {copiedIndex === index ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-12">
      {/* Intro Hero */}
      <div className="bg-[#0e121b] border border-white/[0.08] rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-500 font-mono mb-3 uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5" />
            <span>Architecture & Multi-Live Deployment Guide</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            How to Run Multiple 24/7 Live Broadcasts on a $4/mo Cloud Server
          </h1>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            By running this app on a remote cloud server (VPS), you can stream single or multiple live broadcasts to YouTube 24/7 without keeping your computer on.
          </p>
        </div>

        {/* How it works 3-stage visual */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/[0.06]">
          <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/[0.06] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold shrink-0">
              1
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">Your Browser</span>
              <span className="text-zinc-400 text-[11px]">Upload video & paste YouTube stream key</span>
            </div>
          </div>

          <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/[0.06] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold shrink-0">
              2
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">Cloud Server (VPS)</span>
              <span className="text-zinc-400 text-[11px]">Streams video with FFmpeg continuously 24/7</span>
            </div>
          </div>

          <div className="bg-[#0b0e14] p-3.5 rounded-xl border border-white/[0.06] flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white text-xs font-mono font-bold shrink-0">
              3
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">Turn Off PC</span>
              <span className="text-zinc-400 text-[11px]">Multiple streams stay live for viewers 24/7</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Stream Efficiency Note */}
      <section className="p-4 bg-indigo-950/40 rounded-2xl border border-indigo-500/30 text-xs text-indigo-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Multi-Stream Efficiency Tip: Use Direct Stream Copy Mode</span>
        </div>
        <p className="leading-relaxed text-zinc-300">
          When running multiple simultaneous live streams on a $4/mo server (1 or 2 vCPUs), always select{' '}
          <strong className="text-white">Stream Copy</strong> mode. Stream Copy pushes the existing H.264 video and AAC audio directly to YouTube without CPU transcoding, allowing even a modest $4 server to broadcast <strong>3 to 5 simultaneous live streams</strong> without breaking a sweat!
        </p>
      </section>

      {/* STEP 1: Getting a VPS */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
            1
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Get a Basic Cloud Server (VPS)</h2>
            <p className="text-xs text-slate-400">Cost: approx. $3.50 to $5 per month</p>
          </div>
        </div>

        <p className="text-sm text-slate-300">
          A VPS (Virtual Private Server) is a dedicated virtual machine in a datacenter with unmetered high-speed bandwidth that stays powered on 24/7. Any of these providers work seamlessly:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">Hetzner Cloud</span>
              <span className="text-xs text-emerald-400 font-semibold">~$4/mo</span>
            </div>
            <p className="text-xs text-slate-400">
              Plan: <strong>CX22</strong> (2 vCPU, 4GB RAM). Exceptional value and high bandwidth for live video.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">DigitalOcean</span>
              <span className="text-xs text-emerald-400 font-semibold">$4 - $6/mo</span>
            </div>
            <p className="text-xs text-slate-400">
              Plan: <strong>Basic Droplet</strong> with 1-2 GB RAM. Beginner-friendly with a web terminal.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">AWS Lightsail</span>
              <span className="text-xs text-emerald-400 font-semibold">$3.50/mo</span>
            </div>
            <p className="text-xs text-slate-400">
              Plan: <strong>1 vCPU, 1 GB RAM</strong>. Includes free tier months and reliable global network.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Operating System Selection:</strong> Choose <strong>Ubuntu 22.04 LTS</strong> or <strong>Ubuntu 24.04 LTS</strong>.
          </div>
        </div>
      </section>

      {/* STEP 2: Connecting via SSH */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
            2
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Connect to Your Cloud Server</h2>
            <p className="text-xs text-slate-400">Open Terminal or PowerShell on your computer</p>
          </div>
        </div>

        <p className="text-sm text-slate-300">
          Once your server is created, your provider will give you an <strong>IP Address</strong> (e.g. <code className="text-cyan-400 font-mono">123.45.67.89</code>).
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Run in your terminal:</span>
            {copyButton('ssh root@YOUR_SERVER_IP', 1)}
          </div>
          <div className="font-mono text-xs sm:text-sm text-emerald-400 bg-slate-900/90 p-3 rounded-lg overflow-x-auto border border-slate-800">
            ssh root@YOUR_SERVER_IP
          </div>
        </div>
      </section>

      {/* STEP 3: Automated 1-Click Setup Script */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center shrink-0">
            3
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Install and Start with One Command</h2>
            <p className="text-xs text-slate-400">Installs Node.js 20, FFmpeg, and launches the app 24/7 with PM2</p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 font-semibold">Copy & Paste This Command:</span>
            {copyButton(
              `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt update && sudo apt install -y nodejs ffmpeg git build-essential && sudo npm install -g pm2 tsx`,
              2
            )}
          </div>
          <pre className="font-mono text-xs text-emerald-400 bg-slate-900/90 p-3 rounded-lg overflow-x-auto border border-slate-800 whitespace-pre-wrap leading-relaxed">
{`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \\
sudo apt update && \\
sudo apt install -y nodejs ffmpeg git build-essential && \\
sudo npm install -g pm2 tsx`}
          </pre>
        </div>

        {/* Start with PM2 */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-cyan-400 font-semibold">Then in the app folder, run:</span>
            {copyButton(
              `npm install && pm2 start "tsx server.ts" --name cloudcast && pm2 startup && pm2 save`,
              3
            )}
          </div>
          <pre className="font-mono text-xs text-emerald-400 bg-slate-900/90 p-3 rounded-lg overflow-x-auto border border-slate-800 whitespace-pre-wrap">
{`npm install
pm2 start "tsx server.ts" --name cloudcast
pm2 startup
pm2 save`}
          </pre>
        </div>
      </section>

      {/* Power Off Feature Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-800/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <PowerOff className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Shut Down Your Computer Anytime!</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Once you launch your streams from the web dashboard, the remote VPS runs the transmission daemon independently. You can turn off your laptop, go to sleep, or close your browser — all active broadcasts stay live 24/7!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
