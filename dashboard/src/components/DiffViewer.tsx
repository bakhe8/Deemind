type Props = {
  content: string | null;
};

export default function DiffViewer({ content }: Props) {
  if (!content) return <p className="text-sm text-slate-500">No diff available yet.</p>;
  return (
    <pre className="bg-white rounded-2xl border border-slate-200 p-4 text-xs overflow-x-auto whitespace-pre-wrap">
      {content}
    </pre>
  );
}
