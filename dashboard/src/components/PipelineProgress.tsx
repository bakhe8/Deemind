import type { ThemeStructure, ThemeReports } from '../api';

type Stage = {
  key: string;
  label: string;
  description: string;
  done: boolean;
  status: 'pending' | 'done';
};

type Props = {
  structure: ThemeStructure | null;
  reports: ThemeReports | null;
  previewReady?: boolean;
  previewStatus?: string | null;
};

function computeStages(structure: ThemeStructure | null, reports: ThemeReports | null, previewReady?: boolean): Stage[] {
  const manifestAvailable = Boolean(reports?.manifest);
  const validationAvailable = Boolean(reports?.extended);
  const baselineAvailable = Boolean(reports?.baseline);
  const diffAvailable = Boolean(reports?.diff);

  return [
    {
      key: 'input',
      label: 'Input Collected',
      description: 'Theme folder detected in /input',
      done: Boolean(structure),
      status: structure ? 'done' : 'pending',
    },
    {
      key: 'parser',
      label: 'Parser',
      description: 'Canonical map + metadata',
      done: manifestAvailable,
      status: manifestAvailable ? 'done' : 'pending',
    },
    {
      key: 'adapter',
      label: 'Adapter',
      description: 'Salla layout/pages emitted',
      done: manifestAvailable,
      status: manifestAvailable ? 'done' : 'pending',
    },
    {
      key: 'baseline',
      label: 'Baseline Merge',
      description: 'Raed fallback fill',
      done: baselineAvailable,
      status: baselineAvailable ? 'done' : 'pending',
    },
    {
      key: 'validator',
      label: 'Validator',
      description: 'Extended QA results',
      done: validationAvailable,
      status: validationAvailable ? 'done' : 'pending',
    },
    {
      key: 'reporter',
      label: 'Reports',
      description: 'Summary & diff ready',
      done: diffAvailable || baselineAvailable,
      status: diffAvailable || baselineAvailable ? 'done' : 'pending',
    },
    {
      key: 'preview',
      label: 'Preview',
      description: 'Live theme server',
      done: Boolean(previewReady),
      status: previewReady ? 'done' : 'pending',
    },
  ];
}

export default function PipelineProgress({ structure, reports, previewReady, previewStatus }: Props) {
  const stages = computeStages(structure, reports, previewReady);
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-700">Pipeline Overview</h3>
      <div className="grid md:grid-cols-3 gap-3">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`rounded-2xl border px-4 py-3 shadow-sm ${
              stage.done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p className="text-sm font-semibold text-slate-700">{stage.label}</p>
            <p className="text-xs text-slate-500">{stage.description}</p>
            <p className={`text-sm mt-1 ${stage.done ? 'text-emerald-700' : 'text-slate-500'}`}>
              {stage.done ? 'Complete' : 'Pending'}
            </p>
            {stage.key === 'preview' && previewStatus && (
              <p className="text-[11px] text-slate-500 mt-1">{previewStatus}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
