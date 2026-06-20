type FieldProps = {
  label: string;
  value: string | number;
  type?: "text" | "number";
  step?: string;
  min?: string;
  onChange: (value: string) => void;
};

export function Field({ label, value, type = "number", step = "0.01", min, onChange }: FieldProps) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        className="input-control w-full"
        value={value}
        type={type}
        step={step}
        min={min}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
