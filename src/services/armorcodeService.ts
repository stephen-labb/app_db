import {
  ArmorCodeQueryRequest,
  ArmorCodeQueryResponse,
  ArmorCodeFinding,
  ArmorCodeProduct,
  ArmorCodeSubproduct,
  ArmorCodeProductsResponse,
  ArmorCodeSubproductsResponse,
  ArmorCodeProductElasticQuery
} from '../types';
import appSettings from '../../appsettings.json';

export async function fetchArmorCodeProducts(
  apiKey?: string,
  customEndpoint?: string,
  elasticQuery?: ArmorCodeProductElasticQuery
): Promise<ArmorCodeProductsResponse> {
  const defaultEndpoint = appSettings.ArmorCode?.ProductApiEndpoint || 'https://app.armorcode.com/user/product/elastic/paged';
  const targetEndpoint = customEndpoint || defaultEndpoint;

  // Elastic paged query payload specification
  const payload = {
    environmentName: elasticQuery?.environmentName || ['PRODUCTION'],
    pageSize: elasticQuery?.pageSize ?? 20,
    pageNumber: elasticQuery?.pageNumber ?? 0,
    sortBy: elasticQuery?.sortBy || 'NAME',
    search: elasticQuery?.search ?? 'testing',
    direction: elasticQuery?.direction || 'ASC',
    apiKey,
    customEndpoint: targetEndpoint
  };

  try {
    const res = await fetch('/api/armorcode/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        success: false,
        products: [],
        source: 'FALLBACK',
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        endpointUsed: targetEndpoint
      };
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      products: [],
      source: 'FALLBACK',
      errorMessage: error.message || 'Failed to fetch ArmorCode products',
      endpointUsed: targetEndpoint
    };
  }
}

export async function fetchArmorCodeSubproducts(
  project?: string,
  apiKey?: string,
  customEndpoint?: string
): Promise<ArmorCodeSubproductsResponse> {
  try {
    const res = await fetch('/api/armorcode/subproducts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project, apiKey, customEndpoint }),
    });

    if (!res.ok) {
      return {
        success: false,
        subproducts: [],
        source: 'FALLBACK',
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        endpointUsed: customEndpoint || appSettings.ArmorCode?.SubproductApiEndpoint || 'https://app.armorcode.com/api/subproduct'
      };
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      subproducts: [],
      source: 'FALLBACK',
      errorMessage: error.message || 'Failed to fetch ArmorCode subproducts',
      endpointUsed: customEndpoint || appSettings.ArmorCode?.SubproductApiEndpoint || 'https://app.armorcode.com/api/subproduct'
    };
  }
}

export async function fetchArmorCodeFindings(
  query: ArmorCodeQueryRequest
): Promise<ArmorCodeQueryResponse> {
  try {
    const res = await fetch('/api/armorcode/findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        source: 'FALLBACK_DEMO',
        endpointUsed: query.customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings',
        httpStatus: res.status,
        payloadSent: constructArmorCodePayload(query),
        results: [],
        errorMessage: `HTTP ${res.status}: ${errText || res.statusText}`,
        timestamp: new Date().toISOString()
      };
    }

    const data: ArmorCodeQueryResponse = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      source: 'FALLBACK_DEMO',
      endpointUsed: query.customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings',
      httpStatus: 0,
      payloadSent: constructArmorCodePayload(query),
      results: [],
      errorMessage: error.message || 'Network error connecting to ArmorCode API proxy handler',
      timestamp: new Date().toISOString()
    };
  }
}

export function constructArmorCodePayload(query: ArmorCodeQueryRequest): Record<string, any> {
  const reqSchema = appSettings.ArmorCode?.RequestSchemaMapping || {
    projectField: 'project',
    repositoryField: 'repository',
    branchField: 'cycode_branch'
  };

  const payload: Record<string, any> = {
    [reqSchema.projectField || 'project']: query.project || 'sample'
  };

  if (query.repository && query.repository.trim() !== '') {
    payload[reqSchema.repositoryField || 'repository'] = query.repository.trim();
  }

  if (query.cycode_branch && query.cycode_branch.trim() !== '') {
    payload[reqSchema.branchField || 'cycode_branch'] = query.cycode_branch.trim();
  }

  if (query.finding_types && query.finding_types.length > 0) {
    payload['finding_types'] = query.finding_types;
  }

  return payload;
}

export function exportArmorCodeFindingsCSV(findings: ArmorCodeFinding[], projectName: string): void {
  if (!findings || findings.length === 0) return;

  const headers = ['Finding ID', 'Type', 'Severity', 'Project', 'Repository', 'Branch', 'Description', 'Remediation', 'Tool', 'CVE / CWE', 'File Path'];
  const rows = findings.map(f => [
    f.finding_id,
    f.type.toUpperCase(),
    f.severity || 'MEDIUM',
    f.project || projectName,
    f.repository || 'N/A',
    f.cycode_branch || 'master',
    `"${(f.description || '').replace(/"/g, '""')}"`,
    `"${(f.remediation || '').replace(/"/g, '""')}"`,
    f.tool || 'Cycode / ArmorCode Scanner',
    f.cve_id || 'N/A',
    f.file_path ? `${f.file_path}:${f.line_number || 1}` : 'N/A'
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ArmorCode_Security_Report_${projectName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
