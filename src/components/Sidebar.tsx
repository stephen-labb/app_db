import React, { useState } from 'react';
import {
  Database,
  FileText,
  BarChart3,
  History,
  Sparkles,
  Calculator,
  CheckSquare,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  Eye,
  Menu,
  X,
  UserCheck,
  Users,
  ShieldAlert,
  Lock,
  Settings,
  Award,
  ScanLine,
  Layers,
  Zap,
  Activity,
  ScrollText
} from 'lucide-react';
import { UserRole, ActiveSsoUser } from '../types';

export type TabType =
  | 'apps'
  | 'sso-scim'
  | 'user-management'
  | 'rbac-control'
  | 'security-sessions'
  | 'security-reports'
  | 'static-scan-report'
  | 'container-scan-report'
  | 'dynamic-scan-report'
  | 'promotion-records'
  | 'self-rating'
  | 'review-queue'
  | 'sop'
  | 'matrix'
  | 'audit'
  | 'access-logs';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeBg?: string;
  highlight?: boolean;
  adminOnly?: boolean;
}

interface NavSubgroup {
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

interface NavSection {
  group: string;
  adminOnlySection?: boolean;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
}

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  appCount: number;
  activeSopVersion: string;
  auditCount: number;
  pendingCount?: number;
  scimUserCount?: number;
  groupMappingsCount?: number;
  provisionedUsersCount?: number;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onOpenAzureLogin?: () => void;
  onOpenSettings?: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  appCount,
  activeSopVersion,
  auditCount,
  pendingCount = 0,
  scimUserCount = 0,
  groupMappingsCount = 0,
  provisionedUsersCount = 0,
  currentRole,
  activeSsoUser,
  onOpenAzureLogin,
  onOpenSettings,
  isMobileOpen,
  setIsMobileOpen
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN';

  const navigationSections: NavSection[] = [
    {
      group: 'Core Components',
      items: [
        {
          id: 'apps' as TabType,
          label: 'Applications Database',
          icon: Database,
          badge: `${appCount}`,
          badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
          adminOnly: false
        },
        {
          id: 'promotion-records' as TabType,
          label: 'Promotion Records',
          icon: Award,
          badge: 'Audit',
          badgeBg: 'bg-amber-100 text-amber-800 font-bold dark:bg-amber-900/60 dark:text-amber-300',
          adminOnly: false
        }
      ],
      subgroups: [
        {
          name: 'Scan Reports',
          icon: ScanLine,
          items: [
            {
              id: 'static-scan-report' as TabType,
              label: 'Static Scan Report',
              icon: ShieldCheck,
              badge: 'SAST/SCA',
              badgeBg: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-900/60 dark:text-emerald-300',
              adminOnly: false
            },
            {
              id: 'container-scan-report' as TabType,
              label: 'Container Security Report',
              icon: Layers,
              badge: 'Aqua',
              badgeBg: 'bg-cyan-100 text-cyan-800 font-bold dark:bg-cyan-900/60 dark:text-cyan-300',
              adminOnly: false
            },
            {
              id: 'dynamic-scan-report' as TabType,
              label: 'Dynamic Scan Report',
              icon: Zap,
              badge: 'DAST',
              badgeBg: 'bg-purple-100 text-purple-800 font-bold dark:bg-purple-900/60 dark:text-purple-300',
              adminOnly: false
            }
          ]
        }
      ]
    },
    {
      group: 'Workflow & Reviews',
      items: [
        {
          id: 'self-rating' as TabType,
          label: 'Self-Service Rating',
          icon: Calculator,
          badge: 'Form',
          badgeBg: 'bg-indigo-100 text-indigo-800',
          adminOnly: false
        },
        {
          id: 'review-queue' as TabType,
          label: 'Review Queue',
          icon: CheckSquare,
          badge: pendingCount > 0 ? `${pendingCount} Pending` : 'Clean',
          badgeBg: pendingCount > 0 ? 'bg-amber-100 text-amber-900 font-bold animate-pulse' : 'bg-slate-200 text-slate-700',
          adminOnly: false
        }
      ]
    },
    {
      group: 'Governance',
      items: [
        {
          id: 'sop' as TabType,
          label: 'SOP Document',
          icon: FileText,
          badge: `${activeSopVersion}`,
          badgeBg: 'bg-emerald-100 text-emerald-800',
          adminOnly: false
        },
        {
          id: 'matrix' as TabType,
          label: 'Assessment Matrix',
          icon: BarChart3,
          badge: 'Matrix',
          badgeBg: 'bg-indigo-100 text-indigo-800',
          adminOnly: false
        }
      ]
    },
    {
      group: 'Logs & Audits',
      items: [
        {
          id: 'access-logs' as TabType,
          label: 'Access Logs',
          icon: Activity,
          badge: 'Live',
          badgeBg: 'bg-cyan-100 text-cyan-800 font-bold dark:bg-cyan-900/60 dark:text-cyan-300',
          adminOnly: false
        },
        {
          id: 'audit' as TabType,
          label: 'Audit Log Trail',
          icon: ScrollText,
          badge: `${auditCount}`,
          badgeBg: 'bg-slate-200 text-slate-700',
          adminOnly: true
        }
      ]
    },
    {
      group: 'Identity & Access',
      adminOnlySection: true,
      items: [
        {
          id: 'user-management' as TabType,
          label: 'User Management',
          icon: Users,
          badge: provisionedUsersCount > 0 ? `${provisionedUsersCount}` : 'IAM',
          badgeBg: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-900/60 dark:text-emerald-300',
          highlight: true,
          adminOnly: true
        },
        {
          id: 'rbac-control' as TabType,
          label: 'RBAC Control',
          icon: Shield,
          badge: groupMappingsCount > 0 ? `${groupMappingsCount} Rules` : 'Policy',
          badgeBg: 'bg-purple-100 text-purple-800 font-bold dark:bg-purple-900/60 dark:text-purple-300',
          adminOnly: true
        },
        {
          id: 'security-sessions' as TabType,
          label: 'HTTPS & Sessions',
          icon: Lock,
          badge: 'Redis',
          badgeBg: 'bg-indigo-100 text-indigo-800 font-bold dark:bg-indigo-900/60 dark:text-indigo-300',
          adminOnly: false
        }
      ]
    }
  ];

  const handleSelectTab = (tab: TabType, isRestricted: boolean) => {
    if (isRestricted && currentRole === 'IT_VIEWER') {
      alert('Access Restricted: This administrative module requires an AppSec Admin or Super Admin role assigned via SCIM group mappings.');
      return;
    }
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  const renderNavItem = (tab: NavItem, isNested = false) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    const isRestrictedForRole = tab.adminOnly && currentRole === 'IT_VIEWER';

    return (
      <button
        key={tab.id}
        onClick={() => handleSelectTab(tab.id, isRestrictedForRole)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all relative group cursor-pointer ${
          isNested && !isCollapsed ? 'pl-3' : ''
        } ${
          isActive
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
            : isRestrictedForRole
            ? 'text-slate-500 bg-slate-950/40 opacity-70 hover:opacity-100 hover:bg-slate-900'
            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
        }`}
        title={
          isRestrictedForRole
            ? `${tab.label} (Admin Only)`
            : tab.label
        }
      >
        <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : isRestrictedForRole ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-200'}`} />

        {!isCollapsed && (
          <span className="flex-1 min-w-0 text-left flex items-center justify-between gap-1.5">
            <span className="truncate leading-snug font-medium text-[13px]" title={tab.label}>
              {tab.label}
            </span>
            {isRestrictedForRole && (
              <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 shrink-0">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>Admin</span>
              </span>
            )}
          </span>
        )}

        {tab.highlight && !isCollapsed && !isRestrictedForRole && (
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
        )}

        {tab.badge && !isCollapsed && !isRestrictedForRole && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 whitespace-nowrap ${
              isActive
                ? 'bg-white/20 text-white'
                : tab.badgeBg
            }`}
          >
            {tab.badge}
          </span>
        )}

        {/* Tooltip on collapsed desktop view */}
        {isCollapsed && (
          <div className="hidden md:block absolute left-full ml-2 px-2.5 py-1 bg-slate-950 text-white text-xs font-medium rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-slate-800">
            {tab.label}
            {isRestrictedForRole && <span className="ml-2 text-rose-400 font-mono">(Restricted)</span>}
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-16 z-40 h-[calc(100vh-4rem)] bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-300 flex flex-col shadow-xl shrink-0 ${
          isMobileOpen ? 'translate-x-0 w-80 sm:w-84' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-72 lg:w-80'}`}
      >
        {/* Collapse Toggle Button (Desktop Only) */}
        <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
          {!isCollapsed && (
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Navigation Menu
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors ml-auto cursor-pointer"
            title={isCollapsed ? 'Expand Side Menu' : 'Collapse Side Menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items Scroll Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
          {navigationSections.map((section, idx) => {
            if (section.adminOnlySection && !isAdmin) {
              return null;
            }
            return (
              <div key={idx} className="space-y-1">
                {!isCollapsed && (
                  <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {section.group}
                  </h3>
                )}

                {/* Direct Items */}
                {section.items?.map((tab) => renderNavItem(tab))}

                {/* Subgroups */}
                {section.subgroups?.map((subgroup, subIdx) => {
                  const SubgroupIcon = subgroup.icon || ScanLine;
                  return (
                    <div key={subIdx} className="pt-1.5 space-y-1">
                      {!isCollapsed && (
                        <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                          <SubgroupIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{subgroup.name}</span>
                        </div>
                      )}
                      <div className={!isCollapsed ? 'pl-2 border-l border-slate-800/80 ml-2 space-y-1' : 'space-y-1'}>
                        {subgroup.items.map((tab) => renderNavItem(tab, true))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Active Authenticated SCIM Identity Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
          
          {/* Active Identity Card */}
          {!isCollapsed && activeSsoUser && activeSsoUser.isAuthenticated ? (
            <div
              onClick={onOpenAzureLogin}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-950/40 border-rose-800/80 hover:bg-rose-900/60'
                  : currentRole === 'APPSEC_ADMIN'
                  ? 'bg-indigo-950/40 border-indigo-800/80 hover:bg-indigo-900/60'
                  : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'
              }`}
              title="Click to switch identity or log in as Super Admin"
            >
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-600/30 border-rose-500/50 text-rose-300'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              }`}>
                {currentRole === 'SUPER_ADMIN' ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : 'AZ'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate">{activeSsoUser.displayName}</p>
                <p className="text-[10px] text-indigo-300 font-mono font-semibold truncate">
                  {currentRole === 'SUPER_ADMIN'
                    ? 'Break-Glass Super Admin'
                    : currentRole === 'APPSEC_ADMIN'
                    ? 'AppSec Admin (SCIM)'
                    : 'IT Viewer (SCIM)'}
                </p>
              </div>
            </div>
          ) : !isCollapsed && onOpenAzureLogin ? (
            <button
              onClick={onOpenAzureLogin}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Connect SSO / Break-Glass</span>
            </button>
          ) : null}

          {!isCollapsed && onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setIsMobileOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-xs hover:text-white"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Settings & Data</span>
            </button>
          )}

          {!isCollapsed && (
            <p className="text-[10px] text-slate-500 text-center font-mono pt-0.5">
              RBAC Enforced via SCIM 2.0
            </p>
          )}

        </div>
      </aside>
    </>
  );
};
