import React, { useState, useEffect } from 'react';
import { ArmorCodeFinding, ArmorCodeQueryRequest, ArmorCodeQueryResponse, Application, PromotionEvidence, ComplianceEvaluationResult } from '../types';
import {
  fetchArmorCodeFindings,
  fetchArmorCodeProducts,
  fetchArmorCodeSubproducts,
  constructArmorCodePayload,
  exportArmorCodeFindingsCSV
} from '../services/armorcodeService';
import { SearchableSelect, SearchableOption } from './SearchableSelect';
import {
  evaluateCompliance,
  createAndSavePromotionEvidence,
  loadPromotionEvidences,
  asyncFetchPromotionEvidences,
  revokePromotionEvidence,
  downloadEvidenceJSON
} from '../services/promotionEvidenceService';
import { loadActiveSsoUser } from '../utils/ssoScimStorage';
import appSettings from '../../appsettings.json';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Code2,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileCode,
  Lock,
  Layers,
  Sparkles,
  Settings,
  HelpCircle,
  Database,
  Sliders,
  Bug,
  Shield,
  Award,
  CheckCircle2,
  XCircle,
  FileCheck,
  Printer,
  History,
  Trash2,
  UserCheck,
  ArrowRight
} from 'lucide-react';

interface SecurityReportsViewProps {
  applications?: Application[];
  initialSubTab?: 'QUERY' | 'EVIDENCES';
}

export const SecurityReportsView: React.FC<SecurityReportsViewProps> = ({ applications = [], initialSubTab = 'QUERY' }) => {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'QUERY' | 'EVIDENCES'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Query Form State
  const [projectName, setProjectName] = useState<string>(appSettings.ArmorCode?.DefaultProject || 'sample');
  const [repositoryName, setRepositoryName] = useState<string>(appSettings.ArmorCode?.DefaultRepository || 'sample_repo');
  const [branchName, setBranchName] = useState<string>(appSettings.ArmorCode?.DefaultBranch || 'master');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['sast', 'sca', 'secret', 'dast', 'iac', 'container']);
  const [customEndpoint, setCustomEndpoint] = useState<string>(appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings');
  const [apiKey, setApiKey] = useState<string>(appSettings.ArmorCode?.ApiKey || '');

  // Products & Subproducts List States (Searchable Dropdowns)
  const [productsOptions, setProductsOptions] = useState<SearchableOption[]>([]);
  const [isFetchingProducts, setIsFetchingProducts] = useState<boolean>(false);
  const [productsSource, setProductsSource] = useState<string>('');

  const [subproductsOptions, setSubproductsOptions] = useState<SearchableOption[]>([]);
  const [isFetchingSubproducts, setIsFetchingSubproducts] = useState<boolean>(false);
  const [subproductsSource, setSubproductsSource] = useState<string>('');

  // Fetch Products from https://app.armorcode.com/user/product/elastic/paged via proxy
  const loadArmorCodeProducts = async (searchQuery?: string) => {
    setIsFetchingProducts(true);
    try {
      const res = await fetchArmorCodeProducts(apiKey, undefined, {
        search: searchQuery !== undefined ? searchQuery : (projectName || ''),
        pageSize: 20,
        pageNumber: 0,
        environmentName: ['PRODUCTION'],
        sortBy: 'NAME',
        direction: 'ASC'
      });
      if (res.products) {
        setProductsOptions(res.products.map(p => ({
          id: p.id || p.name,
          name: p.name,
          description: p.description || `ArmorCode Product: ${p.name}`,
          category: p.category || 'Product'
        })));
        setProductsSource(res.source || 'LIVE_API');
      }
    } catch (e) {
      console.warn('Failed to load ArmorCode products:', e);
    } finally {
      setIsFetchingProducts(false);
    }
  };

  // Fetch Subproducts (Repositories) from https://app.armorcode.com/api/subproduct via proxy
  const loadArmorCodeSubproducts = async (proj: string) => {
    setIsFetchingSubproducts(true);
    try {
      const res = await fetchArmorCodeSubproducts(proj, apiKey);
      if (res.subproducts && res.subproducts.length > 0) {
        setSubproductsOptions(res.subproducts.map(sp => ({
          id: sp.id || sp.name,
          name: sp.name,
          description: sp.description || `Repository under ${proj}`,
          category: sp.category || 'Repository'
        })));
        setSubproductsSource(res.source || 'LIVE_API');
      }
    } catch (e) {
      console.warn('Failed to load ArmorCode subproducts:', e);
    } finally {
      setIsFetchingSubproducts(false);
    }
  };

  // Auto-fetch products on mount & when apiKey changes
  useEffect(() => {
    loadArmorCodeProducts();
  }, [apiKey]);

  // Auto-fetch subproducts whenever selected project name changes
  useEffect(() => {
    if (projectName) {
      loadArmorCodeSubproducts(projectName);
    }
  }, [projectName, apiKey]);

  // UI Toggle States
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);
  const [showSchemaMappingInfo, setShowSchemaMappingInfo] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Response & Filter States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [queryResponse, setQueryResponse] = useState<ArmorCodeQueryResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Promotion Evidence Modal & Historic Records State
  const [promotionModalOpen, setPromotionModalOpen] = useState<boolean>(false);
  const [targetEnv, setTargetEnv] = useState<string>('Staging -> Production');
  const [releaseVersion, setReleaseVersion] = useState<string>('v2.4.0-rc1');
  const [approvalNotes, setApprovalNotes] = useState<string>('ArmorCode automated security gate passed. Approved for production deployment.');
  const [isAdminOverride, setIsAdminOverride] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  const [evidenceList, setEvidenceList] = useState<PromotionEvidence[]>([]);
  const [viewingEvidence, setViewingEvidence] = useState<PromotionEvidence | null>(null);
  const [evidenceSearchTerm, setEvidenceSearchTerm] = useState<string>('');
  const [evidenceStatusFilter, setEvidenceStatusFilter] = useState<string>('ALL');

  const activeUser = loadActiveSsoUser();

  // Auto-suggest matching application when promotion modal opens
  useEffect(() => {
    if (promotionModalOpen && applications && applications.length > 0) {
      const matchedApp = applications.find(
        a => a.name.toLowerCase() === projectName.toLowerCase() ||
             a.code.toLowerCase() === projectName.toLowerCase() ||
             a.name.toLowerCase().includes(projectName.toLowerCase())
      );
      if (matchedApp) {
        setSelectedAppId(matchedApp.id);
      } else {
        setSelectedAppId('');
      }
    }
  }, [promotionModalOpen, projectName, applications]);

  // Supported scan categories
  const supportedFindingTypes = appSettings.ArmorCode?.SupportedFindingTypes || [
    { id: 'sast', name: 'SAST (Static Code)', category: 'Code Quality' },
    { id: 'sca', name: 'SCA (Open Source)', category: 'Dependencies' },
    { id: 'secret', name: 'Secret Detection', category: 'Credentials' },
    { id: 'dast', name: 'DAST (Dynamic Scanning)', category: 'Runtime' },
    { id: 'iac', name: 'IaC Infrastructure', category: 'Cloud' },
    { id: 'container', name: 'Container Security', category: 'Docker' }
  ];

  // Auto-run initial sample query & load historic evidences on component mount
  useEffect(() => {
    handleRunQuery();
    refreshEvidences();
  }, []);

  const refreshEvidences = async () => {
    const list = await asyncFetchPromotionEvidences();
    setEvidenceList(list);
  };

  const currentQueryRequest: ArmorCodeQueryRequest = {
    project: projectName,
    repository: repositoryName.trim(),
    cycode_branch: branchName.trim(),
    finding_types: selectedTypes,
    apiKey,
    customEndpoint
  };

  const constructedPayload = constructArmorCodePayload(currentQueryRequest);

  const handleRunQuery = async () => {
    setIsLoading(true);
    setExpandedFindingId(null);
    try {
      const res = await fetchArmorCodeFindings(currentQueryRequest);
      setQueryResponse(res);
    } catch (e) {
      console.error('Failed to fetch ArmorCode report findings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      if (selectedTypes.length === 1) return; // keep at least 1 selected
      setSelectedTypes(selectedTypes.filter(t => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  const handleSelectAppSuggestion = (app: Application) => {
    setProjectName(app.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    if (app.code) {
      setRepositoryName(`${app.code.toLowerCase()}-repo`);
    }
  };

  const copyToClipboard = (text: string, isCurl: boolean) => {
    navigator.clipboard.writeText(text);
    if (isCurl) {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  const curlCommand = `curl -X POST "${customEndpoint || 'https://app.armorcode.com/api/findings'}" \\\n  -H "Authorization: Bearer ${apiKey || '<API_KEY>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(constructedPayload)}'`;

  // Raw findings & Compliance evaluation
  const rawFindings = queryResponse?.results || [];
  const complianceResult: ComplianceEvaluationResult = evaluateCompliance(rawFindings);

  // Filtered Findings for data table
  const filteredFindings = rawFindings.filter(f => {
    const matchesSearch =
      (f.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.finding_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.remediation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.repository || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.tool || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      selectedSeverityFilter === 'ALL' ||
      (f.severity || 'MEDIUM').toUpperCase() === selectedSeverityFilter.toUpperCase();

    const matchesType =
      selectedTypeFilter === 'ALL' ||
      f.type.toLowerCase() === selectedTypeFilter.toLowerCase();

    return matchesSearch && matchesSeverity && matchesType;
  });

  // KPI Metrics
  const criticalCount = rawFindings.filter(f => (f.severity || '').toUpperCase() === 'CRITICAL').length;
  const highCount = rawFindings.filter(f => (f.severity || '').toUpperCase() === 'HIGH').length;
  const sastCount = rawFindings.filter(f => f.type.toLowerCase() === 'sast').length;
  const scaCount = rawFindings.filter(f => f.type.toLowerCase() === 'sca').length;
  const secretCount = rawFindings.filter(f => f.type.toLowerCase() === 'secret').length;
  const dastCount = rawFindings.filter(f => f.type.toLowerCase() === 'dast').length;

  // Handle generating new Promotion Evidence Snapshot
  const handleGenerateEvidenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryResponse) return;

    const mappedApp = applications?.find(a => a.id === selectedAppId);

    const newEvidence = createAndSavePromotionEvidence({
      project: projectName,
      repository: repositoryName.trim() || 'ALL_REPOSITORIES',
      branch: branchName.trim() || 'master',
      targetEnvironment: targetEnv,
      releaseVersion,
      approvalNotes: isAdminOverride ? `ADMIN OVERRIDE: ${overrideReason}. ${approvalNotes}` : approvalNotes,
      userEmail: activeUser.email || 'appsec.lead@enterprise.local',
      userRole: activeUser.role || 'APPSEC_ADMIN',
      complianceEvaluation: complianceResult,
      snapshotFindings: rawFindings,
      snapshotPayload: constructedPayload,
      apiEndpointUsed: customEndpoint || 'https://app.armorcode.com/api/findings',
      isAdminOverride,
      applicationId: mappedApp ? mappedApp.id : undefined,
      applicationName: mappedApp ? mappedApp.name : undefined
    });

    setPromotionModalOpen(false);
    setViewingEvidence(newEvidence);
    refreshEvidences();
  };

  const handleRevokeEvidence = (id: string) => {
    if (confirm(`Are you sure you want to REVOKE Promotion Evidence [${id}]? This action will be recorded in audit logs.`)) {
      const updated = revokePromotionEvidence(id, activeUser.email || 'AppSec Lead', 'Security policy re-assessment revoked gate certificate.');
      setEvidenceList(updated);
      if (viewingEvidence?.evidenceId === id) {
        setViewingEvidence({ ...viewingEvidence, status: 'REVOKED' });
      }
    }
  };

  // Filtered Evidence Records
  const filteredEvidences = evidenceList.filter(ev => {
    const matchesSearch =
      ev.evidenceId.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.project.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.repository.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.branch.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.createdBy.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.releaseVersion.toLowerCase().includes(evidenceSearchTerm.toLowerCase());

    const matchesStatus = evidenceStatusFilter === 'ALL' || ev.status === evidenceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner & Sub-tab Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>ArmorCode Security API & Gate Promotion</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80">
                appsettings.json Configured
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">
              Application Security Reports & Auditable Promotion Gates
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Construct ArmorCode scan queries, evaluate zero-critical/high gate compliance, and generate auditable Promotion Evidence snapshots for production releases.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSubTab('QUERY')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'QUERY'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Query & Scanner</span>
            </button>
            <button
              onClick={() => setActiveSubTab('EVIDENCES')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
                activeSubTab === 'EVIDENCES'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Auditable Promotion Records</span>
              {evidenceList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-slate-950 font-black">
                  {evidenceList.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SUB-TAB 1: QUERY & COMPLIANCE EVALUATION   */}
      {/* ========================================== */}
      {activeSubTab === 'QUERY' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Compliance Gate Evaluation Banner */}
          {queryResponse && (
            <div className={`p-5 rounded-2xl border shadow-lg transition-all ${
              complianceResult.isCompliant
                ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/60 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    complianceResult.isCompliant
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {complianceResult.isCompliant ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-100">
                        Compliance Gate Status: {complianceResult.isCompliant ? 'PASSED / ELIGIBLE FOR PROMOTION' : 'NON-COMPLIANT / PROMOTION BLOCKED'}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300">
                        {complianceResult.gatePolicyName}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-300 mt-1">
                      {complianceResult.isCompliant
                        ? `Project '${projectName}' (Repo: ${repositoryName || 'ALL'}, Branch: ${branchName}) has 0 Critical and 0 High findings. Meets all security standards for production promotion.`
                        : `Gate standard failed: ${complianceResult.reasons.join(' ')}`}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono">
                      <span className="text-rose-400 font-bold">Critical: {complianceResult.criticalCount} (Max: {complianceResult.maxCriticalAllowed})</span>
                      <span className="text-amber-400 font-bold">High: {complianceResult.highCount} (Max: {complianceResult.maxHighAllowed})</span>
                      <span className="text-slate-400">Medium: {complianceResult.mediumCount}</span>
                      <span className="text-slate-400">Low: {complianceResult.lowCount}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 self-start md:self-center shrink-0">
                  {complianceResult.isCompliant ? (
                    <button
                      onClick={() => {
                        setIsAdminOverride(false);
                        setPromotionModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-slate-950" />
                      <span>Generate Promotion Evidence</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAdminOverride(true);
                        setPromotionModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Issue Admin Gate Override</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* API Maintenance Info Bar */}
          {showSchemaMappingInfo && (
            <div className="bg-slate-900 border border-indigo-500/30 text-slate-200 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm">ArmorCode API Schema & Gate Policy Configuration</h3>
                </div>
                <button
                  onClick={() => setShowSchemaMappingInfo(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Close Info
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase font-mono tracking-wider block">
                    Configured Compliance Policy
                  </span>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-tight">
{JSON.stringify(appSettings.ArmorCode?.ComplianceStandards || {}, null, 2)}
                  </pre>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase font-mono tracking-wider block">
                    Request / Response Mapping
                  </span>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-tight">
{JSON.stringify(appSettings.ArmorCode?.RequestSchemaMapping || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Query Builder Form & Payload Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Input Form (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Construct ArmorCode Query Parameters
                  </h2>
                </div>
                <button
                  onClick={() => setShowSchemaMappingInfo(!showSchemaMappingInfo)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Config Info</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Project Name (Searchable Product Dropdown) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <SearchableSelect
                    label="Project Name (ArmorCode Product)"
                    value={projectName}
                    onChange={(val) => {
                      setProjectName(val);
                    }}
                    onSearchChange={(query) => {
                      loadArmorCodeProducts(query);
                    }}
                    options={productsOptions}
                    placeholder="Type to search or select ArmorCode product..."
                    isLoading={isFetchingProducts}
                    onRefresh={() => loadArmorCodeProducts(projectName || '')}
                    required={true}
                    iconType="product"
                    badgeText={productsSource === 'LIVE_API' ? 'ArmorCode Elastic API (Live)' : 'ArmorCode Catalog'}
                    helpText="Searches live in real-time against POST https://app.armorcode.com/user/product/elastic/paged as you type."
                  />
                  {applications.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Quick App Shortcuts:</span>
                      {applications.slice(0, 5).map((app) => (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => handleSelectAppSuggestion(app)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[11px] font-mono transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          + {app.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Repository Name (Searchable Subproduct Dropdown) */}
                <div className="space-y-1.5">
                  <SearchableSelect
                    label="Repository Name (Subproduct)"
                    value={repositoryName}
                    onChange={(val) => setRepositoryName(val)}
                    options={subproductsOptions}
                    placeholder={`e.g. ${projectName}_repo (or leave empty for ALL)`}
                    isLoading={isFetchingSubproducts}
                    onRefresh={() => loadArmorCodeSubproducts(projectName)}
                    required={false}
                    iconType="repository"
                    badgeText={subproductsSource === 'LIVE_API' ? 'ArmorCode API /api/subproduct' : 'ArmorCode Catalog'}
                    helpText="Fetches repositories live from https://app.armorcode.com/api/subproduct."
                  />
                </div>

                {/* Branch Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Branch Name <span className="text-slate-600 dark:text-slate-400 font-normal">(cycode_branch)</span>
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. master, main, release/v2"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                    Branch identifier for scanner findings.
                  </p>
                </div>
              </div>

              {/* Scan Types */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Security Report Scanner Types</span>
                  <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">
                    {selectedTypes.length} selected
                  </span>
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {supportedFindingTypes.map((t) => {
                    const isSelected = selectedTypes.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleToggleType(t.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-start justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold uppercase font-mono block">{t.id}</span>
                          <span className="text-[11px] leading-tight block text-slate-600 dark:text-slate-400 truncate">{t.category}</span>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold border ${
                          isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-400'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{showAdvancedConfig ? 'Hide Custom Endpoint Settings' : 'Configure Custom Endpoint & Bearer Token'}</span>
                  {showAdvancedConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAdvancedConfig && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-900 text-slate-200 space-y-3 text-xs border border-slate-800">
                    <div className="space-y-1">
                      <label className="font-mono text-slate-300 font-bold block">ArmorCode API Endpoint URL</label>
                      <input
                        type="text"
                        value={customEndpoint}
                        onChange={(e) => setCustomEndpoint(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-slate-300 font-bold block">API Auth Bearer Token</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter ArmorCode API token..."
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Code & Payload Preview (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      Target API POST Request
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    JSON POST
                  </span>
                </div>

                {/* Target URL */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-300 break-all space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Endpoint URL</span>
                  <span className="text-emerald-400 font-bold">{customEndpoint || 'https://app.armorcode.com/api/findings'}</span>
                </div>

                {/* Constructed JSON Payload */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Constructed Request Body</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(constructedPayload, null, 2), false)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-amber-300/90 overflow-x-auto leading-relaxed max-h-48 scrollbar-thin">
{JSON.stringify(constructedPayload, null, 2)}
                  </pre>
                </div>

                {/* cURL Command snippet */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>cURL Snippet</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(curlCommand, true)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto leading-tight">
{curlCommand}
                  </pre>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunQuery}
                disabled={isLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Send POST Request to ArmorCode</span>
              </button>
            </div>
          </div>

          {/* Results KPI Summary & Export */}
          {queryResponse && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Total Findings</span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">{rawFindings.length}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-xs">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Critical & High</span>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{criticalCount + highCount}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">SAST Code</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{sastCount}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">SCA Libraries</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{scaCount}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Secrets Leaked</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{secretCount}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">DAST Dynamic</span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 block">{dastCount}</span>
              </div>
            </div>
          )}

          {/* Results Table & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
            
            {/* Filter Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/50">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search findings by ID, description, tool, or remediation..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSeverityFilter}
                  onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>

                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Scanner Types</option>
                  <option value="SAST">SAST</option>
                  <option value="SCA">SCA</option>
                  <option value="SECRET">Secrets</option>
                  <option value="DAST">DAST</option>
                  <option value="IAC">IaC</option>
                  <option value="CONTAINER">Container</option>
                </select>

                {queryResponse && (
                  <button
                    onClick={() => exportArmorCodeFindingsCSV(queryResponse.results, projectName)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* Findings Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Finding ID</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Repository / Branch</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-600 dark:text-slate-400 font-mono">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Querying ArmorCode API Endpoint...</span>
                      </td>
                    </tr>
                  ) : filteredFindings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-600 dark:text-slate-400">
                        <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No security findings returned</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Try adjusting your project name, repository, or scan type filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredFindings.map((finding) => {
                      const isExpanded = expandedFindingId === finding.finding_id;
                      const severityUpper = (finding.severity || 'MEDIUM').toUpperCase();
                      
                      const severityBg =
                        severityUpper === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300'
                          : severityUpper === 'HIGH'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300';

                      const typeUpper = (finding.type || 'sast').toUpperCase();
                      const typeBg =
                        typeUpper === 'SAST'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : typeUpper === 'SCA'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : typeUpper === 'SECRET'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';

                      return (
                        <React.Fragment key={finding.finding_id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {finding.finding_id}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${severityBg}`}>
                                {severityUpper}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${typeBg}`}>
                                {typeUpper}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium max-w-md">
                              <p className="line-clamp-2">{finding.description}</p>
                              {finding.tool && (
                                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono block mt-0.5">
                                  Scanner: {finding.tool} {finding.cve_id ? `(${finding.cve_id})` : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <p className="text-slate-900 dark:text-slate-200 font-bold">{finding.repository || repositoryName || 'All Repos'}</p>
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400">{finding.cycode_branch || branchName}</p>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setExpandedFindingId(isExpanded ? null : finding.finding_id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                              >
                                {isExpanded ? 'Hide Details' : 'View Remediation'}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Remediation Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-4 space-y-3">
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      <Bug className="w-4 h-4 text-rose-500" />
                                      <span>Remediation Guidance & Location</span>
                                    </span>
                                    {finding.file_path && (
                                      <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                                        {finding.file_path}:{finding.line_number || 1}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                                    <strong>Actionable Step:</strong> {finding.remediation}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 2: AUDITABLE PROMOTION RECORDS    */}
      {/* ========================================== */}
      {activeSubTab === 'EVIDENCES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Records Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={evidenceSearchTerm}
                onChange={(e) => setEvidenceSearchTerm(e.target.value)}
                placeholder="Search evidences by ID, project, repo, branch, or release version..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={evidenceStatusFilter}
                onChange={(e) => setEvidenceStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
              >
                <option value="ALL">All Gate Statuses</option>
                <option value="ISSUED">ISSUED (Active Certificate)</option>
                <option value="REVOKED">REVOKED</option>
              </select>

              <button
                onClick={refreshEvidences}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Audit Logs</span>
              </button>
            </div>
          </div>

          {/* Evidence Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-4">Evidence ID</th>
                    <th className="py-3.5 px-4">Project / Repository</th>
                    <th className="py-3.5 px-4">Branch & Version</th>
                    <th className="py-3.5 px-4">Target Env</th>
                    <th className="py-3.5 px-4">Gate Compliance</th>
                    <th className="py-3.5 px-4">Issued By & Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredEvidences.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <Award className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Auditable Promotion Evidences Found</p>
                        <p className="text-xs text-slate-500 mt-1">Run an ArmorCode scan query and click "Generate Promotion Evidence" when compliant.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEvidences.map((ev) => {
                      const isRevoked = ev.status === 'REVOKED';
                      return (
                        <tr key={ev.evidenceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-emerald-500" />
                              <span>{ev.evidenceId}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 block truncate max-w-[120px]">{ev.verificationHash}</span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <p>{ev.project}</p>
                            <p className="text-[10px] text-slate-500 font-mono font-normal">{ev.repository}</p>
                            {ev.applicationName && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-mono font-bold">
                                App: {ev.applicationName}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <p className="font-bold text-indigo-600 dark:text-indigo-400">{ev.branch}</p>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                              {ev.releaseVersion}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {ev.targetEnvironment}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                REVOKED
                              </span>
                            ) : ev.complianceStatus === 'ADMIN_OVERRIDE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                ADMIN OVERRIDE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                GATE PASSED (0 Crit / 0 High)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{ev.createdBy}</p>
                            <p className="text-[10px] text-slate-500">{new Date(ev.createdAt).toLocaleString()}</p>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setViewingEvidence(ev)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                            >
                              Inspect Certificate
                            </button>
                            {!isRevoked && (
                              <button
                                onClick={() => handleRevokeEvidence(ev.evidenceId)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 text-xs rounded-lg transition-all cursor-pointer"
                                title="Revoke Certificate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* ========================================== */}
      {/* MODAL 1: GENERATE PROMOTION EVIDENCE FORM */}
      {/* ========================================== */}
      {promotionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Issue Auditable Promotion Evidence
                </h3>
              </div>
              <button
                onClick={() => setPromotionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateEvidenceSubmit} className="space-y-4 text-xs">
              
              {/* Snapshot metadata summary */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold">
                  <span>Project / Repo:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{projectName} / {repositoryName || 'ALL'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Branch (cycode_branch):</span>
                  <span>{branchName || 'master'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Scan Snapshot:</span>
                  <span>{rawFindings.length} Total Findings (0 Critical / 0 High)</span>
                </div>
              </div>

              {/* Mapped Application in Inventory (Optional) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Mapped Application in Inventory <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {selectedAppId && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Mapped
                    </span>
                  )}
                </div>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none"
                >
                  <option value="">-- None / Unmapped (Not registered in App Database) --</option>
                  {applications && applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.code}) - Tier {app.tier}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Associates this evidence record directly with an application in your Application Database.
                </p>
              </div>

              {/* Target Environment */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Target Promotion Pipeline Environment</label>
                <select
                  value={targetEnv}
                  onChange={(e) => setTargetEnv(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none"
                >
                  <option value="Staging -> Production">Staging → Production (Main Gate)</option>
                  <option value="QA -> UAT">QA → UAT Environment</option>
                  <option value="UAT -> Production">UAT → Production Release</option>
                  <option value="Development -> Staging">Development → Staging</option>
                </select>
              </div>

              {/* Release Version */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Release Build / Tag Version</label>
                <input
                  type="text"
                  value={releaseVersion}
                  onChange={(e) => setReleaseVersion(e.target.value)}
                  placeholder="e.g. v2.4.0-rc1, build-90412"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono outline-none"
                />
              </div>

              {/* Admin Override Reason if non-compliant */}
              {isAdminOverride && (
                <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl">
                  <label className="font-bold text-amber-800 dark:text-amber-300 block flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Admin Exception Rationale (Required for Non-Zero Gate)</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide mandatory business rationale or mitigating controls for bypassing gate threshold..."
                    required={isAdminOverride}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none"
                  />
                </div>
              )}

              {/* Approval Notes / Rationale */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Approval Rationale & Auditor Sign-off</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromotionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4 text-amber-300" />
                  <span>Sign & Issue Evidence</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: INSPECT PROMOTION EVIDENCE CERT   */}
      {/* ========================================== */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl space-y-6 my-8">
            
            {/* Certificate Official Header */}
            <div className="text-center border-b border-slate-800 pb-5 space-y-2 relative">
              <button
                onClick={() => setViewingEvidence(null)}
                className="absolute top-0 right-0 text-slate-400 hover:text-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
              
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-500 to-emerald-500 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Award className="w-7 h-7 text-amber-400" />
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800/80 inline-block">
                OFFICIAL PROMOTION PASSPORT & EVIDENCE CERTIFICATE
              </span>

              <h2 className="text-xl font-black text-slate-100 tracking-tight">
                {viewingEvidence.project}
              </h2>

              <p className="text-xs text-slate-400 font-mono">
                Evidence ID: <strong className="text-amber-400">{viewingEvidence.evidenceId}</strong> | SHA256: <code className="text-indigo-300">{viewingEvidence.verificationHash}</code>
              </p>
            </div>

            {/* Certificate Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Target Pipeline</span>
                <span className="text-slate-200 font-bold text-sm">{viewingEvidence.targetEnvironment}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Release Version</span>
                <span className="text-indigo-400 font-bold text-sm">{viewingEvidence.releaseVersion}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Repository & Branch</span>
                <span className="text-slate-200">{viewingEvidence.repository} ({viewingEvidence.branch})</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Issued By</span>
                <span className="text-emerald-400">{viewingEvidence.createdBy} ({viewingEvidence.createdRole})</span>
              </div>
            </div>

            {/* Scan Snapshot & Compliance Status */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 font-mono uppercase text-[10px]">
                  ArmorCode Scan Snapshot Metrics
                </span>
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  viewingEvidence.status === 'REVOKED'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  STATUS: {viewingEvidence.status}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center py-1">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-rose-400 block font-mono uppercase">Critical</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.critical}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-amber-400 block font-mono uppercase">High</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.high}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Medium</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.medium}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Low / Info</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.low + viewingEvidence.findingCounts.info}</span>
                </div>
              </div>

              <div className="pt-2 text-slate-300 font-sans space-y-1">
                <p className="text-[11px]"><strong>Sign-off Rationale:</strong> {viewingEvidence.approvalNotes}</p>
                <p className="text-[10px] text-slate-500 font-mono">Issued at: {new Date(viewingEvidence.createdAt).toUTCString()}</p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => downloadEvidenceJSON(viewingEvidence)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Export JSON Evidence</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setViewingEvidence(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
