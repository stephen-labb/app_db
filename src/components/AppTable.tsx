import React, { useState, useMemo } from 'react';
import { Application, UserRole, FilterState } from '../types';
import { getTierBadgeProps } from '../utils/scoring';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Globe,
  Gamepad2,
  Lock,
  ChevronDown,
  ArrowUpDown,
  Copy,
  Info,
  Shield,
  X
} from 'lucide-react';

interface AppTableProps {
  applications: Application[];
  currentRole: UserRole;
  onViewApp: (app: Application) => void;
  onEditApp: (app: Application) => void;
  onDeleteApp: (app: Application) => void;
  onDuplicateApp: (app: Application) => void;
  onCreateApp: () => void;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}

export const AppTable: React.FC<AppTableProps> = ({
  applications,
  currentRole,
  onViewApp,
  onEditApp,
  onDeleteApp,
  onDuplicateApp,
  onCreateApp,
  filterState,
  setFilterState
}) => {
  const [sortField, setSortField] = useState<keyof Application>('calculatedScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Derive unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => set.add(a.department));
    return Array.from(set).sort();
  }, [applications]);

  // Filter and sort applications
  const filteredApps = useMemo(() => {
    return applications
      .filter((app) => {
        // Search query
        if (filterState.searchQuery.trim()) {
          const q = filterState.searchQuery.toLowerCase();
          const matches =
            app.name.toLowerCase().includes(q) ||
            app.code.toLowerCase().includes(q) ||
            app.department.toLowerCase().includes(q) ||
            app.ownerAppSec.toLowerCase().includes(q) ||
            app.ownerIT.toLowerCase().includes(q) ||
            app.notes.toLowerCase().includes(q) ||
            app.complianceRequirements.some((c) => c.toLowerCase().includes(q));
          if (!matches) return false;
        }

        // Tier filter
        if (filterState.tier !== 'ALL' && app.tier !== filterState.tier) {
          return false;
        }

        // Department filter
        if (filterState.department !== 'ALL' && app.department !== filterState.department) {
          return false;
        }

        // Data classification
        if (
          filterState.dataClassification !== 'ALL' &&
          app.dataClassification !== filterState.dataClassification
        ) {
          return false;
        }

        // Status
        if (filterState.status !== 'ALL' && app.status !== filterState.status) {
          return false;
        }

        // Internet exposed
        if (filterState.internetExposedOnly && !app.internetExposed) {
          return false;
        }

        // Gaming network
        if (filterState.gamingNetworkOnly && !app.isGamingNetwork) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          valA = (valA as string).toLowerCase();
          valB = (valB as string).toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [applications, filterState, sortField, sortDirection]);

  const handleSort = (field: keyof Application) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setFilterState({
      searchQuery: '',
      tier: 'ALL',
      department: 'ALL',
      dataClassification: 'ALL',
      status: 'ALL',
      internetExposedOnly: false,
      gamingNetworkOnly: false
    });
  };

  const hasActiveFilters =
    filterState.searchQuery !== '' ||
    filterState.tier !== 'ALL' ||
    filterState.department !== 'ALL' ||
    filterState.dataClassification !== 'ALL' ||
    filterState.status !== 'ALL' ||
    filterState.internetExposedOnly ||
    Boolean(filterState.gamingNetworkOnly);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Helper component to highlight search queries in text
  const HighlightText = ({ text, query }: { text: string; query: string }) => {
    if (!query || !query.trim()) return <>{text}</>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-amber-200 text-slate-950 px-0.5 rounded-2xs font-semibold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Top Action Bar & Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Live Search Box with Autocomplete & Suggestions */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Live search by name, code, owner, department, compliance..."
              value={filterState.searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFilterState((prev) => ({ ...prev, searchQuery: '' }));
                  setIsSearchFocused(false);
                }
              }}
              onChange={(e) => setFilterState((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-9 pr-24 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {filterState.searchQuery ? (
                <>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                    {filteredApps.length} match{filteredApps.length !== 1 ? 'es' : ''}
                  </span>
                  <button
                    onClick={() => setFilterState((prev) => ({ ...prev, searchQuery: '' }))}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clear live search (ESC)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                  LIVE SEARCH
                </span>
              )}
            </div>

            {/* Interactive Live Search Dropdown Suggestions */}
            {isSearchFocused && filterState.searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                <div className="px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Search Results ({filteredApps.length})</span>
                  <span className="text-slate-400 font-normal">Press ESC to close</span>
                </div>
                {filteredApps.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    No matching applications found for "{filterState.searchQuery}"
                  </div>
                ) : (
                  filteredApps.slice(0, 6).map((app) => {
                    const badge = getTierBadgeProps(app.tier);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          onViewApp(app);
                          setIsSearchFocused(false);
                        }}
                        className="w-full px-4 py-2.5 hover:bg-indigo-50/70 text-left transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                              <HighlightText text={app.code} query={filterState.searchQuery} />
                            </span>
                            <span className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600">
                              <HighlightText text={app.name} query={filterState.searchQuery} />
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span><HighlightText text={app.department} query={filterState.searchQuery} /></span>
                            <span>•</span>
                            <span>Owner: <HighlightText text={app.ownerAppSec} query={filterState.searchQuery} /></span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 border ${badge.bg}`}>
                          Tier {badge.code}
                        </span>
                      </button>
                    );
                  })
                )}
                {filteredApps.length > 6 && (
                  <div className="p-2 text-center text-[11px] text-indigo-600 font-semibold bg-indigo-50/50">
                    + {filteredApps.length - 6} more applications visible in table below
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action: Create Button for Admin OR IT Read-Only Notice */}
          {currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN' ? (
            <button
              onClick={onCreateApp}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Application</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>IT Viewer Mode (Read-Only)</span>
            </div>
          )}

        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter:</span>
          </span>

          {/* Tier Filter */}
          <select
            value={filterState.tier}
            onChange={(e) => setFilterState((prev) => ({ ...prev, tier: e.target.value }))}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Criticality Ratings</option>
            <option value="C">Critical (C) - Score ≥ 9.0</option>
            <option value="H">High (H) - Score ≥ 6.0</option>
            <option value="M">Medium (M) - Score ≥ 3.0</option>
            <option value="L">Low (L) - Score &lt; 3.0</option>
          </select>

          {/* Department Filter */}
          <select
            value={filterState.department}
            onChange={(e) => setFilterState((prev) => ({ ...prev, department: e.target.value }))}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Data Classification Filter */}
          <select
            value={filterState.dataClassification}
            onChange={(e) =>
              setFilterState((prev) => ({ ...prev, dataClassification: e.target.value }))
            }
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Data Classifications</option>
            <option value="RESTRICTED">Restricted</option>
            <option value="CONFIDENTIAL">Confidential</option>
            <option value="INTERNAL">Internal</option>
            <option value="PUBLIC">Public</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterState.status}
            onChange={(e) => setFilterState((prev) => ({ ...prev, status: e.target.value }))}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DEPRECATED">Deprecated</option>
          </select>

          {/* Internet Exposed Toggle */}
          <button
            onClick={() =>
              setFilterState((prev) => ({
                ...prev,
                internetExposedOnly: !prev.internetExposedOnly
              }))
            }
            className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              filterState.internetExposedOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Globe className={`w-3.5 h-3.5 ${filterState.internetExposedOnly ? 'text-amber-700' : 'text-slate-400'}`} />
            <span>Internet Facing Only</span>
          </button>

          {/* Gaming Network Toggle */}
          <button
            onClick={() =>
              setFilterState((prev) => ({
                ...prev,
                gamingNetworkOnly: !prev.gamingNetworkOnly
              }))
            }
            className={`px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              filterState.gamingNetworkOnly
                ? 'bg-purple-100 text-purple-900 border-purple-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Gamepad2 className={`w-3.5 h-3.5 ${filterState.gamingNetworkOnly ? 'text-purple-700' : 'text-slate-400'}`} />
            <span>Gaming Network Only</span>
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 ml-auto"
            >
              Reset Filters
            </button>
          )}

        </div>

      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            
            {/* Table Header */}
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Application System</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('calculatedScore')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Criticality Tier</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Department & Hosting</th>
                <th className="py-3 px-4">Data Class & Compliance</th>
                <th className="py-3 px-4">AppSec & IT Owners</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Shield className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-medium text-slate-700">No applications matched your filter criteria.</p>
                      <p className="text-xs text-slate-400">
                        Try clearing search terms or filter constraints.
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => {
                  const badgeProps = getTierBadgeProps(app.tier);

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Name & Code */}
                      <td className="py-3.5 px-4 font-medium">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onViewApp(app)}
                              className="font-bold text-slate-900 hover:text-indigo-600 text-sm text-left transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>
                                <HighlightText text={app.name} query={filterState.searchQuery} />
                              </span>
                            </button>
                            {app.internetExposed && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-mono"
                                title="Internet Facing Endpoint"
                              >
                                <Globe className="w-2.5 h-2.5 text-amber-700" />
                                <span>Public</span>
                              </span>
                            )}
                            {app.isGamingNetwork && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.2 rounded font-mono"
                                title="Gaming Network Endpoint"
                              >
                                <Gamepad2 className="w-2.5 h-2.5 text-purple-700" />
                                <span>Gaming</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                            <span>
                              <HighlightText text={app.code} query={filterState.searchQuery} />
                            </span>
                            <span>•</span>
                            <span className="text-slate-400 truncate max-w-[180px]">
                              <HighlightText text={app.hostingEnv} query={filterState.searchQuery} />
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tier & Score */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border text-xs ${badgeProps.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badgeProps.dot}`} />
                            <span>{badgeProps.label}</span>
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>Score:</span>
                            <span className="font-bold text-slate-800">{app.calculatedScore}/100</span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">
                          <HighlightText text={app.department} query={filterState.searchQuery} />
                        </div>
                        <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                          Status: <span className="capitalize text-slate-600">{app.status.toLowerCase().replace('_', ' ')}</span>
                        </div>
                      </td>

                      {/* Data Classification & Compliance */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${
                              app.dataClassification === 'RESTRICTED'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : app.dataClassification === 'CONFIDENTIAL'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {app.dataClassification}
                          </span>
                          {app.complianceRequirements.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.complianceRequirements.slice(0, 2).map((comp) => (
                                <span
                                  key={comp}
                                  className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-mono"
                                >
                                  {comp}
                                </span>
                              ))}
                              {app.complianceRequirements.length > 2 && (
                                <span className="text-[10px] text-slate-400">
                                  +{app.complianceRequirements.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Owners */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="text-slate-800 font-medium">
                            <span className="text-indigo-600 font-semibold mr-1">AppSec:</span>
                            {app.ownerAppSec}
                          </div>
                          <div className="text-slate-600">
                            <span className="text-slate-400 font-semibold mr-1">IT Owner:</span>
                            {app.ownerIT}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Profile */}
                          <button
                            onClick={() => onViewApp(app)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                            title="View Full Criticality Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Admin CRUD Actions */}
                          {(currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN') && (
                            <>
                              <button
                                onClick={() => onEditApp(app)}
                                className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                                title="AppSec Edit Application"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDuplicateApp(app)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                                title="Duplicate Record"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteApp(app)}
                                className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="AppSec Delete Application"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Showing <span className="font-semibold text-slate-800">{filteredApps.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{applications.length}</span> records
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Tier 1 (&ge;85)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Tier 2 (65-84)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Tier 3 (40-64)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" /> Tier 4 (&lt;40)
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
