import React, { useState, useEffect } from 'react';
import {
  FileText,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  Shield,
} from 'lucide-react';
import { AuditLog } from '../types';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/audit-logs')
      .then(r => r.json())
      .then(d => setLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Security & Audit Event Logs</h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Immutable log of all user commands, broadcast state transitions, and server events.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="py-12 flex justify-center">
          <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center space-y-3 shadow-2xs">
          <Shield className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No audit events recorded yet</h3>
          <p className="text-xs text-slate-500">Actions taken in CloudCast will be permanently recorded here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[#64748B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Stream / Target</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.username}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#2563EB]">{log.action}</td>
                    <td className="py-3 px-4 text-slate-600">{log.streamId || 'System'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.result === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          FAILURE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">
                      {log.details || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
