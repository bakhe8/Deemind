import { useEffect, useMemo, useState } from 'react';

export type RuntimeEvent = {
  id: string;
  type: string;
  payload: unknown;
  receivedAt: string;
};

type Options = {
  theme?: string;
};

const EVENT_TYPES = ['status', 'cart', 'wishlist', 'session', 'store', 'twilight', 'analytics'];
const MAX_EVENTS = 40;

function makeId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function usePreviewEvents(options: Options = {}) {
  const { theme: targetTheme } = options;
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    let closed = false;
    const query = targetTheme ? `?theme=${encodeURIComponent(targetTheme)}` : '';
    const source = new EventSource(`/api/preview/events${query}`);
    const handler = (evt: MessageEvent) => {
      if (closed) return;
      let payload: unknown = evt.data;
      try {
        payload = evt.data ? JSON.parse(evt.data) : null;
      } catch {
        payload = evt.data;
      }
      if (evt.type === 'status') {
        setConnected(Boolean((payload as any)?.running));
        setTheme((payload as any)?.theme ?? null);
      } else {
        setConnected(true);
      }
      setEvents((prev) => {
        const next: RuntimeEvent[] = [{ id: makeId(evt.type), type: evt.type, payload, receivedAt: new Date().toISOString() }, ...prev];
        return next.slice(0, MAX_EVENTS);
      });
    };
    EVENT_TYPES.forEach((type) => source.addEventListener(type, handler));
    source.onerror = () => {
      setConnected(false);
    };
    return () => {
      closed = true;
      EVENT_TYPES.forEach((type) => source.removeEventListener(type, handler));
      source.close();
    };
  }, [targetTheme]);

  const latest = useMemo(() => events.slice(0, 5), [events]);

  return { events, latest, connected, theme };
}
