import { apiFetch, apiJson } from './client';

export type ThemeSummary = { name: string; status: string; updated?: string | null };
export type ThemeStructure = {
  theme: string;
  layouts: string[];
  pages: string[];
  components: string[];
  assets: string[];
  locales: string[];
  completeness: number;
};
export type ThemeReports = {
  manifest: any;
  extended: any;
  baseline: any;
  diff: string | null;
};
export type PreviewStatus = {
  status: string;
  url: string | null;
  port: number | null;
  pages: string[];
  timestamp: string | null;
};
export type UploadResponse = {
  theme: string;
  inputPath: string;
};

export async function fetchThemes() {
  return apiJson<{ themes: ThemeSummary[] }>('/api/themes');
}

export async function fetchThemeStructure(theme: string) {
  return apiJson<ThemeStructure>(`/api/themes/${encodeURIComponent(theme)}/structure`);
}

export async function fetchThemeMetadata(theme: string) {
  return apiJson<Record<string, any>>(`/api/themes/${encodeURIComponent(theme)}/metadata`);
}

export async function saveThemeMetadata(theme: string, data: Record<string, any>) {
  await apiFetch(`/api/themes/${encodeURIComponent(theme)}/metadata`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function runThemeBuild(theme: string, options?: { diff?: boolean }) {
  await apiFetch(`/api/themes/${encodeURIComponent(theme)}/run`, {
    method: 'POST',
    body: JSON.stringify({ diff: options?.diff ?? false }),
  });
}

export async function fetchThemeReports(theme: string) {
  return apiJson<ThemeReports>(`/api/themes/${encodeURIComponent(theme)}/reports`);
}

export async function fetchPreviewStatus(theme: string) {
  return apiJson<PreviewStatus>(`/api/themes/${encodeURIComponent(theme)}/preview`);
}

export async function uploadThemeBundle(file: File, themeName?: string) {
  const formData = new FormData();
  formData.append('bundle', file, file.name);
  if (themeName) formData.append('themeName', themeName);
  const res = await apiFetch('/api/themes/upload', {
    method: 'POST',
    body: formData,
  });
  return res.json() as Promise<UploadResponse>;
}
