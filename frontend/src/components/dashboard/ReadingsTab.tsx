import { PageSkeleton } from "../ui/Skeleton";
import { useState, useEffect } from "react";
import { readingsService, authService, type ReadingType } from "../../services/api";
import ReadingFormModal, { type Reading } from "./ReadingFormModal";

interface TypeSummary {
  latest: Reading | null;
  count: number;
  avg?: { value?: number; systolic?: number; diastolic?: number };
}

type Summary = Record<ReadingType, TypeSummary>;

const VitalsCard = ({ title, icon, color, onAdd, children }: { title: string; icon: string; color: string; onAdd: () => void; children: React.ReactNode }) => (
  <div className="card-premium">
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-800 flex-1">{title}</h3>
      <button onClick={onAdd} className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50" aria-label={`Add ${title.toLowerCase()} reading`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
    {children}
  </div>
);

const SimpleChart = ({ data, color, height = 80 }: { data: number[]; color: string; height?: number }) => {
  if (data.length === 0) return null;

  const min = Math.min(...data) - 10;
  const max = Math.max(...data) + 10;
  const range = max - min || 1;
  const width = 100;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");

  if (data.length === 1) {
    const y = height - ((data[0] - min) / range) * height;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none" aria-hidden="true">
        <circle cx={width / 2} cy={y} r="4" fill={color} />
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#gradient-${color})`} />
    </svg>
  );
};

const formatDate = (timestamp: string | null | undefined) => {
  if (!timestamp) return "No data";
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getGlucoseStatus = (value: number) => {
  if (value < 70) return { label: "Low", color: "text-red-500", bg: "bg-red-50" };
  if (value <= 100) return { label: "Normal", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (value <= 125) return { label: "Elevated", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "High", color: "text-red-500", bg: "bg-red-50" };
};

const getBPStatus = (sys: number, dia: number) => {
  if (sys < 120 && dia < 80) return { label: "Normal", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (sys < 130 && dia < 80) return { label: "Elevated", color: "text-amber-600", bg: "bg-amber-50" };
  if (sys < 140 && dia < 90) return { label: "High (Stage 1)", color: "text-orange-500", bg: "bg-orange-50" };
  return { label: "High (Stage 2)", color: "text-red-500", bg: "bg-red-50" };
};

const getWeightStatus = (current: number, dryWeight: number | null) => {
  if (!dryWeight) return { label: "No dry weight set", color: "text-slate-400", bg: "bg-slate-50" };
  const diff = current - dryWeight;
  if (Math.abs(diff) <= 0.5) return { label: "At dry weight", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (diff > 0) return { label: `+${diff.toFixed(1)} kg over`, color: "text-orange-500", bg: "bg-orange-50" };
  return { label: `${diff.toFixed(1)} kg under`, color: "text-blue-500", bg: "bg-blue-50" };
};

const readingStatus = (reading: Reading, dryWeight: number | null) => {
  if (reading.type === "glucose") return getGlucoseStatus(Number(reading.value));
  if (reading.type === "bp") return getBPStatus(reading.systolic || 0, reading.diastolic || 0);
  return getWeightStatus(Number(reading.value), dryWeight);
};

const formatValue = (reading: Reading) => {
  if (reading.type === "bp") return `${reading.systolic}/${reading.diastolic} mmHg`;
  return `${reading.value} ${reading.type === "weight" ? "kg" : reading.unit}`;
};

const TYPE_STYLES: Record<ReadingType, { label: string; badge: string }> = {
  glucose: { label: "Glucose", badge: "bg-purple-50 text-purple-600" },
  bp: { label: "Blood Pressure", badge: "bg-rose-50 text-rose-600" },
  weight: { label: "Weight", badge: "bg-cyan-50 text-cyan-600" },
};

const SOURCE_LABELS: Record<string, string> = {
  web: "Website",
  telegram_text: "Telegram",
  telegram_photo: "Telegram photo",
};

const EmptyVitals = ({ label, onAdd }: { label: string; onAdd: () => void }) => (
  <div className="text-center py-8">
    <p className="text-slate-500 mb-3">No {label} readings yet</p>
    <button onClick={onAdd} className="text-sm font-medium text-teal-600 hover:text-teal-700">
      Add your first reading
    </button>
  </div>
);

const ICONS = {
  glucose: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  bp: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  weight: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3",
};

const TABLE_PREVIEW_ROWS = 15;

const ReadingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dryWeight, setDryWeight] = useState<number | null>(null);
  const [glucoseUnit, setGlucoseUnit] = useState<"mg/dL" | "mmol/L">("mg/dL");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ reading?: Reading; type?: ReadingType } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError(null);
    try {
      const [readingsRes, summaryRes, userRes] = await Promise.all([
        readingsService.list(),
        readingsService.summary(),
        authService.getCurrentUser()
      ]);
      setReadings(readingsRes.data);
      setSummary(summaryRes.data);
      setDryWeight(userRes.data.dry_weight || null);
      setGlucoseUnit(userRes.data.glucose_unit === "mmol/L" ? "mmol/L" : "mg/dL");
    } catch {
      setError("Failed to load readings");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reading: Reading) => {
    if (!window.confirm(`Delete the ${TYPE_STYLES[reading.type].label.toLowerCase()} reading of ${formatValue(reading)} from ${formatDate(reading.timestamp)}?`)) return;
    try {
      await readingsService.remove(reading.id);
      await loadData();
    } catch {
      setError("Could not delete the reading. Please try again.");
    }
  };

  const series = (type: ReadingType) => readings.filter(r => r.type === type).slice(0, 20).reverse();
  const openAdd = (type?: ReadingType) => setForm({ type });

  if (loading) {
    return (
      <PageSkeleton cards={3} />
    );
  }

  const glucose = summary?.glucose;
  const bp = summary?.bp;
  const weight = summary?.weight;
  const visibleReadings = showAll ? readings : readings.slice(0, TABLE_PREVIEW_ROWS);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Log readings here or by messaging the Telegram bot.</p>
        <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add reading
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 text-red-600 rounded-glass">{error}</div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <VitalsCard title="Blood Glucose" icon={ICONS.glucose} color="bg-purple-50 text-purple-600" onAdd={() => openAdd("glucose")}>
          {glucose?.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">{glucose.latest.value}</span>
                <span className="text-lg text-slate-400">{glucose.latest.unit}</span>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getGlucoseStatus(Number(glucose.latest.value)).bg} ${getGlucoseStatus(Number(glucose.latest.value)).color}`}>
                {getGlucoseStatus(Number(glucose.latest.value)).label}
              </span>
              <SimpleChart data={series("glucose").map(r => Number(r.value))} color="#8b5cf6" />
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{glucose.count} readings{glucose.avg?.value ? ` · avg ${Math.round(glucose.avg.value)}` : ""}</span>
                <span>{formatDate(glucose.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals label="glucose" onAdd={() => openAdd("glucose")} />
          )}
        </VitalsCard>

        <VitalsCard title="Blood Pressure" icon={ICONS.bp} color="bg-rose-50 text-rose-600" onAdd={() => openAdd("bp")}>
          {bp?.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">{bp.latest.systolic}/{bp.latest.diastolic}</span>
                <span className="text-lg text-slate-400">mmHg</span>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getBPStatus(bp.latest.systolic || 0, bp.latest.diastolic || 0).bg} ${getBPStatus(bp.latest.systolic || 0, bp.latest.diastolic || 0).color}`}>
                {getBPStatus(bp.latest.systolic || 0, bp.latest.diastolic || 0).label}
              </span>
              <div className="mt-2">
                <SimpleChart data={series("bp").map(r => r.systolic || 0)} color="#f97316" />
              </div>
              <p className="text-xs text-slate-400">Chart shows systolic (top number)</p>
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{bp.count} readings{bp.avg?.systolic ? ` · avg ${Math.round(bp.avg.systolic)}/${Math.round(bp.avg.diastolic || 0)}` : ""}</span>
                <span>{formatDate(bp.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals label="blood pressure" onAdd={() => openAdd("bp")} />
          )}
        </VitalsCard>

        <VitalsCard title="Weight" icon={ICONS.weight} color="bg-cyan-50 text-cyan-600" onAdd={() => openAdd("weight")}>
          {weight?.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">{weight.latest.value}</span>
                <span className="text-lg text-slate-400">kg</span>
              </div>
              {dryWeight && (
                <div className="mb-2">
                  <span className="text-xs text-slate-400">Dry weight: {dryWeight} kg</span>
                </div>
              )}
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getWeightStatus(Number(weight.latest.value), dryWeight).bg} ${getWeightStatus(Number(weight.latest.value), dryWeight).color}`}>
                {getWeightStatus(Number(weight.latest.value), dryWeight).label}
              </span>
              {series("weight").length > 1 && (
                <SimpleChart data={series("weight").map(r => Number(r.value))} color="#06b6d4" />
              )}
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{weight.count} readings</span>
                <span>{formatDate(weight.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals label="weight" onAdd={() => openAdd("weight")} />
          )}
        </VitalsCard>
      </div>

      <div className="card-premium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Recent Readings</h3>
          <span className="text-sm text-slate-400">{readings.length} shown</span>
        </div>

        {readings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No readings recorded yet</p>
            <p className="text-sm text-slate-400 mt-1">Use "Add reading" above or send a value to the Telegram bot</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date & Time</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Value</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                    <th className="py-3 px-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReadings.map((reading) => {
                    const status = readingStatus(reading, dryWeight);
                    return (
                      <tr key={reading.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                          {formatDate(reading.timestamp)}
                          <span className="block text-xs text-slate-400">{SOURCE_LABELS[reading.source] || reading.source}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${TYPE_STYLES[reading.type].badge}`}>
                            {TYPE_STYLES[reading.type].label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">{formatValue(reading)}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setForm({ reading })} className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50" aria-label={`Edit reading from ${formatDate(reading.timestamp)}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(reading)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label={`Delete reading from ${formatDate(reading.timestamp)}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {readings.length > TABLE_PREVIEW_ROWS && (
              <button onClick={() => setShowAll(!showAll)} className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700">
                {showAll ? "Show fewer" : `Show all ${readings.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {form && (
        <ReadingFormModal
          reading={form.reading}
          defaultType={form.type}
          glucoseUnit={glucoseUnit}
          onClose={() => setForm(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
};

export default ReadingsTab;
