export interface FormFieldProps {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export function FormField({
  label,
  name,
  type = 'text',
  autoComplete,
  required = false,
  placeholder,
  defaultValue,
  minLength,
  maxLength,
}: FormFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}

export function SubmitButton({
  loading,
  children,
}: Readonly<{ loading: boolean; children: React.ReactNode }>) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Please wait...' : children}
    </button>
  );
}
