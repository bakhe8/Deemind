export type RunMode = "build" | "validate" | "doctor";

export interface RunRequest {
  mode: RunMode;
  inputFolder?: string;
}

export type JobState = "queued" | "running" | "ok" | "failed";

export interface JobStatus {
  id: string;
  status: JobState;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

export interface ReportSummary {
  id: string;
  type: "validation" | "conflict" | "summary";
  createdAt: string;
  path: string;
  title: string;
}

export interface OutputEntry {
  id: string;
  theme: string;
  zipPath: string;
  manifestPath: string;
  builtAt: string;
  version: string;
  passed: boolean;
}

export interface BuildReportCounts {
  warnings: number;
  errors: number;
  pages: number;
}

export interface BuildReportSummary {
  id: string;
  theme: string;
  durationMs: number;
  result: "pass" | "fail";
  counts: BuildReportCounts;
}
