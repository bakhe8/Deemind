type ThemeInfo = {
  name: string;
  id?: string;
  description?: string;
  version?: string;
  platform?: string;
  author?: string;
  license?: string;
};

type Props = {
  value: ThemeInfo;
  onChange: (value: ThemeInfo) => void;
};

const fields: Array<{ key: keyof ThemeInfo; label: string; placeholder?: string }> = [
  { key: 'name', label: 'Theme Name', placeholder: 'Demo Theme' },
  { key: 'id', label: 'Theme ID', placeholder: 'demo-theme' },
  { key: 'description', label: 'Description', placeholder: 'Short description' },
  { key: 'version', label: 'Version', placeholder: '1.0.0' },
  { key: 'platform', label: 'Platform', placeholder: 'Salla' },
  { key: 'author', label: 'Author', placeholder: 'Beto Harire' },
  { key: 'license', label: 'License', placeholder: 'UNLICENSED' },
];

export default function ThemeInfoForm({ value, onChange }: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col text-sm font-medium text-slate-600">
          {field.label}
          <input
            className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={value[field.key] || ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="md:col-span-2 flex gap-3">
        <button className="btn-primary" type="button" onClick={() => onChange(value)}>
          Save Draft
        </button>
      </div>
    </div>
  );
}
