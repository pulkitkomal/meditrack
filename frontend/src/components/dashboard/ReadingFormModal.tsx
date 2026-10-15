import { useState, type FormEvent } from "react";
import Modal from "../ui/Modal";
import { readingsService, type ReadingInput, type ReadingType } from "../../services/api";

export interface Reading {
  id: string;
  type: ReadingType;
  value: number | string;
  unit: string;
  timestamp: string;
  source: string;
  systolic?: number;
  diastolic?: number;
}

interface ReadingFormModalProps {
  reading?: Reading;
  defaultType?: ReadingType;
  glucoseUnit?: "mg/dL" | "mmol/L";
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTIONS: { id: ReadingType; label: string }[] = [
  { id: "glucose", label: "Glucose" },
  { id: "bp", label: "Blood pressure" },
  { id: "weight", label: "Weight" },
];

const toLocalInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const apiErrorMessage = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg.replace(/^Value error, /, "");
  return fallback;
};

const ReadingFormModal = ({ reading, defaultType = "glucose", glucoseUnit = "mg/dL", onClose, onSaved }: ReadingFormModalProps) => {
  const editing = !!reading;
  const [type, setType] = useState<ReadingType>(reading?.type ?? defaultType);
  const [unit, setUnit] = useState<"mg/dL" | "mmol/L">(editing ? "mg/dL" : glucoseUnit);
  const [value, setValue] = useState(reading && reading.type !== "bp" ? String(reading.value) : "");
  const [systolic, setSystolic] = useState(reading?.systolic ? String(reading.systolic) : "");
  const [diastolic, setDiastolic] = useState(reading?.diastolic ? String(reading.diastolic) : "");
  const [takenAt, setTakenAt] = useState(toLocalInput(reading ? new Date(reading.timestamp) : new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const payload: ReadingInput = { type, timestamp: new Date(takenAt).toISOString() };
    if (type === "bp") {
      payload.systolic = Number(systolic);
      payload.diastolic = Number(diastolic);
    } else {
      payload.value = Number(value);
      payload.unit = type === "glucose" ? unit : "kg";
    }

    setSaving(true);
    try {
      if (reading) {
        await readingsService.update(reading.id, payload);
      } else {
        await readingsService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the reading. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Edit reading" : "Add reading"} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div role="radiogroup" aria-label="Reading type" className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-50 rounded-xl">
          {TYPE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={type === option.id}
              disabled={editing && type !== option.id}
              onClick={() => setType(option.id)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                type === option.id ? "bg-surface text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {type === "bp" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Systolic (top)</span>
              <input type="number" inputMode="numeric" required min={60} max={250} value={systolic}
                onChange={e => setSystolic(e.target.value)} className="input-premium mt-1" placeholder="120" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Diastolic (bottom)</span>
              <input type="number" inputMode="numeric" required min={40} max={150} value={diastolic}
                onChange={e => setDiastolic(e.target.value)} className="input-premium mt-1" placeholder="80" />
            </label>
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">{type === "glucose" ? "Blood glucose" : "Weight"}</span>
            <div className="flex gap-2 mt-1">
              <input type="number" inputMode="decimal" required step="any" value={value}
                onChange={e => setValue(e.target.value)} className="input-premium flex-1"
                placeholder={type === "weight" ? "70.5" : unit === "mmol/L" ? "5.5" : "100"} />
              {type === "glucose" ? (
                <select value={unit} onChange={e => setUnit(e.target.value as "mg/dL" | "mmol/L")}
                  className="input-premium w-32 shrink-0" aria-label="Glucose unit">
                  <option value="mg/dL">mg/dL</option>
                  <option value="mmol/L">mmol/L</option>
                </select>
              ) : (
                <span className="px-3 py-2.5 text-slate-500">kg</span>
              )}
            </div>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Taken at</span>
          <input type="datetime-local" required value={takenAt} max={toLocalInput(new Date())}
            onChange={e => setTakenAt(e.target.value)} className="input-premium mt-1" />
        </label>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2 pb-1 sticky bottom-0 bg-surface/95 -mx-5 px-5">
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
            {saving ? "Saving..." : editing ? "Save changes" : "Add reading"}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

export default ReadingFormModal;
