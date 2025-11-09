import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Props = {
  data: Array<{ theme: string; added: number; skipped: number }>;
};

export default function BaselineBarChart({ data }: Props) {
  if (!data.length) return <p className="text-sm text-slate-500">No baseline metrics recorded yet.</p>;
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="theme" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Bar dataKey="added" fill="#6366f1" name="Added" radius={[6, 6, 0, 0]} />
          <Bar dataKey="skipped" fill="#94a3b8" name="Skipped" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
