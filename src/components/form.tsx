const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

type CampoProps = {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  name?: string;
};

export function Campo({
  id,
  label,
  type = "text",
  defaultValue,
  value,
  onChange,
  required,
  name,
}: CampoProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={name ?? id}
        type={type}
        required={required}
        defaultValue={onChange ? undefined : (defaultValue ?? undefined)}
        value={onChange ? (value ?? "") : undefined}
        onChange={onChange}
        step={type === "number" ? "0.01" : undefined}
        className={inputClass}
      />
    </div>
  );
}

type CampoTextareaProps = {
  id: string;
  label: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  name?: string;
};

export function CampoTextarea({ id, label, defaultValue, value, onChange, name }: CampoTextareaProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={name ?? id}
        rows={3}
        defaultValue={onChange ? undefined : (defaultValue ?? undefined)}
        value={onChange ? (value ?? "") : undefined}
        onChange={onChange}
        className={inputClass}
      />
    </div>
  );
}

type CampoSelectProps = {
  id: string;
  label: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  placeholder?: string;
  name?: string;
  options: { value: string; label: string }[];
};

export function CampoSelect({
  id,
  label,
  defaultValue,
  value,
  onChange,
  required,
  placeholder,
  name,
  options,
}: CampoSelectProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        name={name ?? id}
        required={required}
        defaultValue={onChange ? undefined : (defaultValue ?? "")}
        value={onChange ? (value ?? "") : undefined}
        onChange={onChange}
        className={inputClass}
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
