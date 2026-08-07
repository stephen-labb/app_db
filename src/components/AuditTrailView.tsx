import React, { useState } from 'react';
import { AuditLogEntry } from '../types';
import { History, Search, Shield, User, FileText, Plus, Edit2, Trash2, Download, Filter } from 'lucide-react';

interface AuditTrailViewProps {
  logs: AuditLogEntry[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        log.user.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.appName && log.appName.toLowerCase().includes(q)) ||
        log.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getActionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'CREATE':
        return {
          label: 'Created App',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Plus
        };
      case 'UPDATE':
        return {
          label: 'Updated App',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: Edit2
        };
      case 'DELETE':
        return {
          label: 'Deleted App',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Trash2
        };
      case 'SOP_UPLOAD':
        return {
          label: 'SOP Uploaded',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: FileText
        };
      case 'EXPORT':
        return {
          label: 'DB Export',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Download
        };
      default:
        return {
          label: action,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: History
        };
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-bold text-slate-900 text-sm">System Audit Trail & Governance Log</h2>
            <p className="text-xs text-slate-500">
              Immutable history of all Create, Read, Update, Delete (CRUD) and SOP updates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
          >
            <option value="ALL">All Action Types</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="SOP_UPLOAD">SOP Upload</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Target Application</th>
                <th className="py-3 px-4">Change Log Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No audit records match your query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border text-[11px] ${badge.bg}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{log.user}</div>
                        <div className="text-[10px] text-indigo-600 font-mono">{log.role}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {log.appName ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">{log.appName}</span>
                            {log.appId && <span className="font-mono text-[10px] text-slate-400">{log.appId}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-sans max-w-md">
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
