type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'green' | 'amber' | 'red' | 'blue';
};

const colors: Record<NonNullable<Props['accent']>, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-700',
};

export default function StatsCard({ title, value, subtitle, accent = 'blue' }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      {subtitle && <p className={`mt-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${colors[accent]}`}>{subtitle}</p>}
    </div>
  );
}
