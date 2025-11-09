import { create } from 'zustand';
import { SERVICE_URL } from '../utils/constants';
import type { ServiceLogEntry } from '../lib/serviceLogs';
import { normalizeLogEntries } from '../lib/serviceLogs';

export type QueueItem = { label: string; id?: string };
export type StatusResponse = { current: QueueItem | null; queue: QueueItem[] };

interface DashboardState {
  token: string;
  serviceUrl: string;
  status: StatusResponse;
  logLines: ServiceLogEntry[];
  setToken: (token: string) => void;
  setStatus: (status: StatusResponse) => void;
  setLogLines: (lines: ServiceLogEntry[] | ((prev: ServiceLogEntry[]) => ServiceLogEntry[])) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  token: '',
  serviceUrl: SERVICE_URL,
  status: { current: null, queue: [] },
  logLines: [],
  setToken: (token) => set({ token }),
  setStatus: (status) => set({ status }),
  setLogLines: (lines) =>
    set((state) => {
      const next = typeof lines === 'function' ? lines(state.logLines) : lines;
      const normalized = Array.isArray(next) ? normalizeLogEntries(next) : state.logLines;
      return { logLines: normalized };
    }),
}));
