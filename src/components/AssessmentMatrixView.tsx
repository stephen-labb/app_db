import React, { useState } from 'react';
import { calculateCriticalityScore, scoreToTier, getTierBadgeProps, getRecommendedSLAs } from '../utils/scoring';
import { Calculator } from 'lucide-react';

export const AssessmentMatrixView: React.FC = () => {
  // Simulator state using Appendix II 5 factors
  const [sensitiveDataScore, setSensitiveDataScore] = useState(8);
  const [exposureScore, setExposureScore] = useState(6);
  const [stabilityScore, setStabilityScore] = useState(6);
  const [attackHistoryScore, setAttackHistoryScore] = useState(0);
  const [downtimeImpactScore, setDowntimeImpactScore] = useState(6);

  const calculatedScore = calculateCriticalityScore({
    sensitiveDataScore,
    exposureScore,
    stabilityScore,
    attackHistoryScore,
    downtimeImpactScore
  });

  const calculatedTier = scoreToTier(calculatedScore);
  const badgeProps = getTierBadgeProps(calculatedTier);
  const slaProps = getRecommendedSLAs(calculatedTier);

  const ratingsData = [
    {
      code: 'C',
      title: 'Rating C - Critical Impact',
      scoreRange: 'Score ≥ 9.0 Points',
      availability: '99.99%',
      penTestFreq: 'Annual Pen Test + Continuous Automated DAST/SAST',
      patchSLA: '< 24 Hours for Critical Flaws',
      desc: 'Systems processing highly sensitive/confidential data, fully public or gaming-network facing, or critical business downtime impact.',
      examples: 'Payment Gateway, User Identity Provider, Live Core Services'
    },
    {
      code: 'H',
      title: 'Rating H - High Impact',
      scoreRange: 'Score 6.0 - 8.9 Points',
      availability: '99.9%',
      penTestFreq: 'Annual Security Audit + Bi-weekly Scans',
      patchSLA: '< 7 Days for Critical Flaws',
      desc: 'Restricted business data systems, public with access controls, or systems with minor past attack history.',
      examples: 'Customer CRM, HR Payroll Engine, Merchant Order Portal'
    },
    {
      code: 'M',
      title: 'Rating M - Medium Impact',
      scoreRange: 'Score 3.0 - 5.9 Points',
      availability: '99.5%',
      penTestFreq: 'Bi-annual Vulnerability Assessment',
      patchSLA: '< 30 Days for Critical Flaws',
      desc: 'Internal non-public operational systems, stable legacy platforms with internal data classifications.',
      examples: 'Internal Knowledge Base, BI Data Pipeline, Staging Services'
    },
    {
      code: 'L',
      title: 'Rating L - Low Impact',
      scoreRange: 'Score < 3.0 Points',
      availability: 'Best Effort',
      penTestFreq: 'Annual Automated Scan',
      patchSLA: '< 60 Days',
      desc: 'Isolated internal subnets, public static pages with no sensitive data or user interactions.',
      examples: 'Marketing Web Static Mirror, Isolated Dev Sandboxes'
    }
  ];

  return (
    <div className="space-y-8">
      
      {/* Overview Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Appendix II Standard Operating Procedure
            </span>
            <span className="text-xs text-slate-400 font-mono">Weighted Framework v3.0</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Application Criticality Rating Matrix & Assessment Formula
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Overall Criticality Rating = (Sensitive Data × 0.325) + (Exposure × 0.325) + (Stability × 0.10) + (Attack History × 0.15) + (Downtime Impact × 0.10).
          </p>
        </div>
      </div>

      {/* Rating Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ratingsData.map((item) => {
          const props = getTierBadgeProps(item.code as any);
          return (
            <div
              key={item.code}
              className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full font-bold text-xs border ${props.bg}`}>
                    Rating {item.code} ({props.label})
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {item.scoreRange}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans pt-1">
                  {item.desc}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-sans font-semibold">Target Availability</span>
                  <span className="font-bold text-slate-900">{item.availability}</span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="text-slate-700">
                    <strong className="text-indigo-700">AppSec Audit Cadence:</strong> {item.penTestFreq}
                  </div>
                  <div className="text-slate-700">
                    <strong className="text-rose-700">Patching SLA:</strong> {item.patchSLA}
                  </div>
                  <div className="text-slate-500">
                    <strong>Example Systems:</strong> {item.examples}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Interactive Scoring Simulator for IT & AppSec Viewers */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calculator className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Appendix II Criticality Simulator</h3>
            <p className="text-xs text-slate-500">
              Adjust criteria levels (0, 4, 6, 8, or 12) to test the weighted rating calculation in real time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          
          {/* Inputs */}
          <div className="md:col-span-2 space-y-3">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">1. Sensitive Data (32.5%)</label>
                <select
                  value={sensitiveDataScore}
                  onChange={(e) => setSensitiveDataScore(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value={0}>0 = Public</option>
                  <option value={4}>4 = Internal</option>
                  <option value={8}>8 = Restricted</option>
                  <option value={12}>12 = Confidential</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">2. Network Exposure (32.5%)</label>
                <select
                  value={exposureScore}
                  onChange={(e) => setExposureScore(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value={0}>0 = Internal only</option>
                  <option value={6}>6 = Public with controls</option>
                  <option value={12}>12 = Fully public / Gaming</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">3. Attack History (15%)</label>
                <select
                  value={attackHistoryScore}
                  onChange={(e) => setAttackHistoryScore(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value={0}>0 = None</option>
                  <option value={6}>6 = Attempted only</option>
                  <option value={12}>12 = Compromised</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">4. Stability / New Build (10%)</label>
                <select
                  value={stabilityScore}
                  onChange={(e) => setStabilityScore(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value={0}>0 = No update in 1 yr</option>
                  <option value={6}>6 = Recently updated</option>
                  <option value={12}>12 = Newly built</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">5. System Downtime Impact (10%)</label>
                <select
                  value={downtimeImpactScore}
                  onChange={(e) => setDowntimeImpactScore(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value={0}>0 = No impact</option>
                  <option value={6}>6 = Minor disruption</option>
                  <option value={12}>12 = Critical business impact</option>
                </select>
              </div>
            </div>

          </div>

          {/* Results Outcome Card */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">
                Calculated Rating Result
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono text-indigo-300">{calculatedScore.toFixed(1)}</span>
                <span className="text-xs text-slate-400">/ 12.0 Points</span>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full font-bold text-xs border ${badgeProps.bg}`}>
                Rating: {badgeProps.code} ({badgeProps.label})
              </span>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-300">
                <span>Target Availability:</span>
                <span className="font-bold text-emerald-400">{slaProps.availability}</span>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
