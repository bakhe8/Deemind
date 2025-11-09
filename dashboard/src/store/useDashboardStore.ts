import { create } from 'zustand';
import { SERVICE_URL } from '../utils/constants';

export type QueueItem = { label: string; id?: string };
export type StatusResponse = { current: QueueItem | null; queue: QueueItem[] };

interface DashboardState {
  token: string;
  serviceUrl: string;
  status: StatusResponse;
  logLines: string[];
  setToken: (token: string) => void;
  setStatus: (status: StatusResponse) => void;
  setLogLines: (lines: string[] | ((prev: string[]) => string[])) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  token: '',
  serviceUrl: SERVICE_URL,
  status: { current: null, queue: [] },
  logLines: [],
  setToken: (token) => set({ token }),
  setStatus: (status) => set({ status }),
  setLogLines: (lines) =>
    set((state) => ({
      logLines: typeof lines === 'function' ? lines(state.logLines) : lines,
    })),
}));
