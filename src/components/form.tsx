type CampoProps = {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
};

export function Campo({ id, label, type = "text", defaultValue, required }: CampoProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </div>
  );
}

type CampoTextareaProps = {
  id: string;
  label: string;
  defaultValue?: string | null;
};

export function CampoTextarea({ id, label, defaultValue }: CampoTextareaProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={3}
        defaultValue={defaultValue ?? undefined}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </div>
  );
}

type CampoSelectProps = {
  id: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
};

export function CampoSelect({
  id,
  label,
  defaultValue,
  required,
  placeholder,
  options,
}: CampoSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        name={id}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
