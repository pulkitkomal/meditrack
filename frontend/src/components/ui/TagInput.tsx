import { useId, useState, type KeyboardEvent } from "react";

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxItems?: number;
}

const TagInput = ({ label, values, onChange, suggestions = [], placeholder, maxItems = 50 }: TagInputProps) => {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const listId = useId();

  const add = (raw: string) => {
    const value = raw.trim().slice(0, 100);
    if (!value || values.length >= maxItems) return;
    if (!values.some(v => v.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  const unused = suggestions.filter(s => !values.some(v => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="input-premium flex flex-wrap items-center gap-2 py-2 min-h-[48px]">
        {values.map(value => (
          <span key={value} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-teal-50 text-teal-700 text-sm">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter(v => v !== value))}
              className="w-5 h-5 rounded-full hover:bg-teal-100 flex items-center justify-center"
              aria-label={`Remove ${value}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={inputId}
          list={unused.length ? listId : undefined}
          value={draft}
          onChange={e => {
            const value = e.target.value;
            if (unused.includes(value)) add(value);
            else setDraft(value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => add(draft)}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-slate-800 placeholder:text-slate-400 py-1"
        />
        {unused.length > 0 && (
          <datalist id={listId}>
            {unused.map(s => <option key={s} value={s} />)}
          </datalist>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">Press Enter to add each one.</p>
    </div>
  );
};

export default TagInput;
