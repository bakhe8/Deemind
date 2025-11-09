import { usePreviewEvents } from '../hooks/usePreviewEvents';

type Props = {
  title?: string;
  limit?: number;
  theme?: string;
};

export default function RuntimeEventFeed({ title = 'Runtime Events', limit = 10, theme }: Props) {
  const { events, connected, theme: streamingTheme } = usePreviewEvents({ theme });
  const list = events.slice(0, limit);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-slate-500">
            {connected
              ? `Listening to ${streamingTheme || theme || 'stub'}`
              : 'Waiting for stub events…'}
          </p>
        </div>
      </div>
      {!list.length ? (
        <p className="text-sm text-slate-500">No runtime activity yet.</p>
      ) : (
        <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
          {list.map((evt) => (
            <li key={evt.id} className="border border-slate-100 rounded-lg p-2 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{evt.type}</span>
                <span>{new Date(evt.receivedAt).toLocaleTimeString()}</span>
              </div>
              <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto">
                {JSON.stringify(evt.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
