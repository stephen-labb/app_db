import React from 'react';
import { Application } from '../types';
import { ShieldAlert, Globe, Layers, CheckCircle2 } from 'lucide-react';

interface StatsSummaryProps {
  applications: Application[];
  onSelectTierFilter?: (tier: string) => void;
  onSelectInternetFilter?: () => void;
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({
  applications,
  onSelectTierFilter,
  onSelectInternetFilter
}) => {
  const total = applications.length;
  const criticalCount = applications.filter((a) => a.tier === 'C' || a.rating === 'C').length;
  const highCount = applications.filter((a) => a.tier === 'H' || a.rating === 'H').length;
  const internetExposed = applications.filter((a) => a.internetExposed).length;

  const assessedRecently = applications.filter((a) => {
    const assessedDate = new Date(a.lastAssessed);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return assessedDate >= oneYearAgo;
  }).length;

  const compliancePercentage = total > 0 ? Math.round((assessedRecently / total) * 100) : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* Total Systems Card */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Applications
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">In Enterprise Inventory</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {criticalCount + highCount} Critical & High Priority Systems
          </p>
        </div>
      </div>

      {/* Critical Rating (C) Card */}
      <div
        onClick={() => onSelectTierFilter && onSelectTierFilter('C')}
        className="bg-white rounded-xl p-4 border border-rose-200/80 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:shadow-sm cursor-pointer transition-all bg-gradient-to-br from-white to-rose-50/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
            Critical (C) Rating
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-900">{criticalCount}</span>
            <span className="text-xs font-medium text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
              {total > 0 ? Math.round((criticalCount / total) * 100) : 0}% of Total
            </span>
          </div>
          <p className="text-xs text-rose-700/80 mt-1">
            Weighted Score ≥ 9.0 • Continuous Monitoring
          </p>
        </div>
      </div>

      {/* Internet Exposed Card */}
      <div
        onClick={() => onSelectInternetFilter && onSelectInternetFilter()}
        className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between hover:border-amber-300 hover:shadow-sm cursor-pointer transition-all bg-gradient-to-br from-white to-amber-50/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Internet Exposed
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-950">{internetExposed}</span>
            <span className="text-xs font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
              Attack Surface
            </span>
          </div>
          <p className="text-xs text-amber-700/80 mt-1">
            Publicly reachable endpoints requiring DAST
          </p>
        </div>
      </div>

      {/* SOP Compliance & Assessment Currency */}
      <div className="bg-white rounded-xl p-4 border border-emerald-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-all bg-gradient-to-br from-white to-emerald-50/20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            SOP Assessment SLA
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-950">{compliancePercentage}%</span>
            <span className="text-xs font-medium text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
              Up to Date
            </span>
          </div>
          <p className="text-xs text-emerald-700/80 mt-1">
            Assessed within 12-month SOP requirement
          </p>
        </div>
      </div>

    </div>
  );
};
