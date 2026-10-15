import { useState, type FormEvent } from "react";
import { analysisService, type LabValueUpdate } from "../../services/api";
import { apiErrorMessage } from "./ReadingFormModal";

export interface LabValue {
  test: string;
  display_name?: string;
  value: number | string;
  unit?: string;
  reference_range?: string;
  status?: LabValueUpdate["status"];
  edited?: boolean;
  original?: { test?: string; value?: number | string; unit?: string; reference_range?: string; status?: string };
}

const STATUS_STYLES: Record<string, { label: string; className: string; icon: string }> = {
  critical: { label: "Critical", className: "bg-red-200 text-red-800 border border-red-300", icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" },
  high: { label: "High", className: "bg-red-100 text-red-700 border border-red-200", icon: "M5 15l7-7 7 7" },
  low: { label: "Low", className: "bg-amber-100 text-amber-800 border border-amber-200", icon: "M19 9l-7 7-7-7" },
  normal: { label: "Normal", className: "bg-emerald-100 text-emerald-700 border border-emerald-200", icon: "M5 13l4 4L19 7" },
};

const StatusBadge = ({ status }: { status?: string }) => {
  const style = STATUS_STYLES[status || ""] ?? { label: "Unknown", className: "bg-slate-100 text-slate-600 border border-slate-200", icon: "" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${style.className}`}>
      {style.icon && (
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon} />
        </svg>
      )}
      {style.label}
    </span>
  );
};

const describeOriginal = (lab: LabValue) => {
  const original = lab.original;
  if (!original) return "";
  return `AI originally read: ${original.test ?? lab.test} ${original.value ?? ""} ${original.unit ?? ""}, ${original.status ?? "unknown"}`.replace(/\s+/g, " ");
};

const EditRow = ({ docId, index, lab, onSaved, onCancel }: { docId: string; index: number; lab: LabValue; onSaved: (lab: LabValue) => void; onCancel: () => void }) => {
  const [test, setTest] = useState(lab.display_name || lab.test);
  const [value, setValue] = useState(String(lab.value ?? ""));
  const [unit, setUnit] = useState(lab.unit || "");
  const [range, setRange] = useState(lab.reference_range || "");
  const [status, setStatus] = useState<LabValueUpdate["status"]>(lab.status || "normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    const numeric = trimmed !== "" && !isNaN(Number(trimmed)) ? Number(trimmed) : trimmed;
    setSaving(true);
    setError("");
    try {
      const payload: LabValueUpdate = { value: numeric, unit: unit.trim(), reference_range: range.trim(), status };
      if (test.trim() && test.trim() !== (lab.display_name || lab.test)) payload.test = test.trim();
      const res = await analysisService.correctLabValue(docId, index, payload);
      onSaved(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the correction."));
      setSaving(false);
    }
  };

  const inputClass = "w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30";

  return (
    <tr className="bg-teal-50/50 border-b border-teal-100">
      <td colSpan={5} className="p-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <label className="col-span-2 md:col-span-1 text-xs text-slate-500">Test
              <input value={test} onChange={e => setTest(e.target.value)} maxLength={100} className={inputClass} />
            </label>
            <label className="text-xs text-slate-500">Value
              <input value={value} onChange={e => setValue(e.target.value)} required maxLength={50} className={inputClass} autoFocus />
            </label>
            <label className="text-xs text-slate-500">Unit
              <input value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} className={inputClass} />
            </label>
            <label className="text-xs text-slate-500">Reference range
              <input value={range} onChange={e => setRange(e.target.value)} maxLength={100} className={inputClass} />
            </label>
            <label className="text-xs text-slate-500">Status
              <select value={status} onChange={e => setStatus(e.target.value as LabValueUpdate["status"])} className={inputClass}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          {lab.original && <p className="text-xs text-slate-500">{describeOriginal(lab)}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onCancel} className="btn-secondary text-sm py-1.5">Cancel</button>
          </div>
        </form>
      </td>
    </tr>
  );
};

const LabValuesTable = ({ docId, labValues, onChange }: { docId: string; labValues: LabValue[]; onChange: (labs: LabValue[]) => void }) => {
  const [editing, setEditing] = useState<number | null>(null);

  const handleSaved = (index: number, lab: LabValue) => {
    onChange(labValues.map((existing, i) => (i === index ? lab : existing)));
    setEditing(null);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Test</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Value</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Reference Range</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Status</th>
            <th className="py-3 px-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {labValues.map((lab, idx) =>
            editing === idx ? (
              <EditRow key={idx} docId={docId} index={idx} lab={lab} onSaved={(saved) => handleSaved(idx, saved)} onCancel={() => setEditing(null)} />
            ) : (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-4 px-4 text-slate-800 font-medium">
                  {lab.display_name || lab.test}
                  {lab.edited && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-medium align-middle" title={describeOriginal(lab)}>
                      Edited
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 text-slate-700 whitespace-nowrap">
                  <span className="font-semibold">{lab.value}</span> {lab.unit}
                </td>
                <td className="py-4 px-4 text-slate-500">{lab.reference_range || "N/A"}</td>
                <td className="py-4 px-4"><StatusBadge status={lab.status} /></td>
                <td className="py-4 px-2 text-right">
                  <button
                    onClick={() => setEditing(idx)}
                    disabled={editing !== null}
                    className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-30"
                    aria-label={`Correct ${lab.display_name || lab.test}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LabValuesTable;
