import { apiFetch, apiJson } from '../api/client';

export type ThemeManifestPreview = {
  port: number | null;
  url: string | null;
  routes?: string[];
};

export type ThemeManifestReports = {
  extended?: string;
  core?: string;
};

export type ThemeManifestDelivery = {
  package?: string;
  packageExists?: boolean;
};

export type ThemeManifest = {
  theme: string;
  buildTime?: string;
  timestamp?: string;
  version?: string;
  warnings?: number;
  pages?: number;
  components?: number;
  assets?: number;
  preview?: ThemeManifestPreview;
  reports?: ThemeManifestReports;
  delivery?: ThemeManifestDelivery;
  [key: string]: unknown;
};

export type ThemeRecord = {
  name: string;
  status?: string;
  updated?: string | null;
  manifest?: ThemeManifest | null;
};

export type QueueStatus = {
  id: string;
  label?: string;
  command?: string;
};

export type StatusPayload = {
  current: QueueStatus | null;
  queue: QueueStatus[];
};

export async function getThemes() {
  const res = await apiJson<{ themes: ThemeRecord[] }>('/api/themes');
  return res.themes || [];
}

export async function getExtendedReport(theme: string) {
  return apiJson<Record<string, unknown>>(`/api/reports/${encodeURIComponent(theme)}/extended`);
}

export async function getStatus() {
  return apiJson<StatusPayload>('/api/status');
}

export async function runCommand(cmd: string, theme: string, args: string[] = []) {
  return apiJson('/api/run', {
    method: 'POST',
    body: JSON.stringify({ cmd, theme, args }),
  });
}

export async function runPackage(theme: string, args: string[] = []) {
  return runCommand('package', theme, args);
}

export async function runDeploy(theme: string, args: string[] = []) {
  return runCommand('deploy', theme, args);
}

export async function triggerBuild(theme: string, args: string[] = []) {
  return runCommand('build', theme, args);
}

export async function downloadReport(pathname: string) {
  const res = await apiFetch(`/${pathname.replace(/^\//, '')}`);
  return res.text();
}
