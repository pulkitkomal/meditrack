import { useState, useEffect } from "react";
import { telegramService, authService } from "../../services/api";

interface Reading {
  id: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  source: string;
  systolic?: number;
  diastolic?: number;
}

interface Summary {
  glucose: {
    latest: { value: number; unit: string; timestamp: string } | null;
    count: number;
    avg?: number;
  };
  bp: {
    latest: { systolic: number; diastolic: number; timestamp: string } | null;
    count: number;
    avg_sys?: number;
    avg_dia?: number;
  };
  weight: {
    latest: { value: number; unit: string; timestamp: string } | null;
    avg: number | null;
    count: number;
  };
}

const VitalsCard = ({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) => (
  <div className="card-premium">
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <circle cx={width / 2} cy={y} r="4" fill={color} />
      </svg>
    );
  }
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
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

const formatDate = (timestamp: string | null) => {
  if (!timestamp) return "No data";
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getGlucoseStatus = (value: number) => {
  if (value < 70) return { label: "Low", color: "text-red-500", bg: "bg-red-50" };
  if (value <= 100) return { label: "Normal", color: "text-emerald-500", bg: "bg-emerald-50" };
  if (value <= 125) return { label: "Elevated", color: "text-amber-500", bg: "bg-amber-50" };
  return { label: "High", color: "text-red-500", bg: "bg-red-50" };
};

const getBPStatus = (sys: number, dia: number) => {
  if (sys < 120 && dia < 80) return { label: "Normal", color: "text-emerald-500", bg: "bg-emerald-50" };
  if (sys < 130 && dia < 80) return { label: "Elevated", color: "text-amber-500", bg: "bg-amber-50" };
  if (sys < 140 || dia < 90) return { label: "High (Stage 1)", color: "text-orange-500", bg: "bg-orange-50" };
  return { label: "High (Stage 2)", color: "text-red-500", bg: "bg-red-50" };
};

const getWeightStatus = (current: number, dryWeight: number | null) => {
  if (!dryWeight) return { label: "No dry weight set", color: "text-slate-400", bg: "bg-slate-50" };
  const diff = current - dryWeight;
  if (Math.abs(diff) <= 0.5) return { label: "At dry weight", color: "text-emerald-500", bg: "bg-emerald-50" };
  if (diff > 0) return { label: `+${diff.toFixed(1)} kg over`, color: "text-orange-500", bg: "bg-orange-50" };
  return { label: `${diff.toFixed(1)} kg under`, color: "text-blue-500", bg: "bg-blue-50" };
};

const EmptyVitals = ({ type, onConnect }: { type: string; onConnect?: () => void }) => {
  const icons: Record<string, string> = {
    glucose: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    bp: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    weight: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
  };
  
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icons[type] || icons.glucose} />
        </svg>
      </div>
      <p className="text-slate-500 mb-2">No {type} readings yet</p>
      {onConnect && (
        <button onClick={onConnect} className="text-sm font-medium text-teal-600 hover:text-teal-700">
          Connect Telegram to start tracking →
        </button>
      )}
    </div>
  );
};

const ReadingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dryWeight, setDryWeight] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allReadingsRes, summaryRes, userRes] = await Promise.all([
        telegramService.getReadings(),
        telegramService.getSummary(),
        authService.getCurrentUser()
      ]);
      setReadings(allReadingsRes.data);
      setSummary(summaryRes.data);
      setDryWeight(userRes.data.dry_weight || null);
    } catch (err) {
      console.error("Failed to load readings:", err);
      setError("Failed to load readings");
    } finally {
      setLoading(false);
    }
  };

  const glucoseReadings = readings.filter(r => r.type === "glucose").slice(0, 20).reverse();
  const bpReadings = readings.filter(r => r.type === "bp").slice(0, 20).reverse();
  const weightReadings = readings.filter(r => r.type === "weight").slice(0, 20).reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl">{error}</div>
      )}

      {/* Vitals Overview */}
      <div className="grid md:grid-cols-3 gap-6">
        <VitalsCard 
          title="Blood Glucose" 
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          color="bg-purple-50 text-purple-600"
        >
          {summary?.glucose.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">{summary.glucose.latest.value}</span>
                <span className="text-lg text-slate-400">{summary.glucose.latest.unit}</span>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getGlucoseStatus(summary.glucose.latest.value).bg} ${getGlucoseStatus(summary.glucose.latest.value).color}`}>
                {getGlucoseStatus(summary.glucose.latest.value).label}
              </span>
              <SimpleChart data={glucoseReadings.map(r => r.value)} color="#8b5cf6" />
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{summary.glucose.count} readings</span>
                <span>{formatDate(summary.glucose.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals type="glucose" />
          )}
        </VitalsCard>

        <VitalsCard 
          title="Blood Pressure" 
          icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
          color="bg-rose-50 text-rose-600"
        >
          {summary?.bp.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">
                  {summary.bp.latest.systolic}/{summary.bp.latest.diastolic}
                </span>
                <span className="text-lg text-slate-400">mmHg</span>
              </div>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getBPStatus(summary.bp.latest.systolic, summary.bp.latest.diastolic).bg} ${getBPStatus(summary.bp.latest.systolic, summary.bp.latest.diastolic).color}`}>
                {getBPStatus(summary.bp.latest.systolic, summary.bp.latest.diastolic).label}
              </span>
              <div className="mt-2">
                <SimpleChart data={bpReadings.map(r => r.systolic || 0)} color="#f97316" />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Systolic
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                  Diastolic
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{summary.bp.count} readings</span>
                <span>{formatDate(summary.bp.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals type="blood pressure" />
          )}
        </VitalsCard>

        <VitalsCard 
          title="Weight" 
          icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" 
          color="bg-cyan-50 text-cyan-600"
        >
          {summary?.weight?.latest ? (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-bold text-slate-800">{summary.weight.latest.value}</span>
                <span className="text-lg text-slate-400">kg</span>
              </div>
              {dryWeight && (
                <div className="mb-2">
                  <span className="text-xs text-slate-400">Dry weight: {dryWeight} kg</span>
                </div>
              )}
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getWeightStatus(summary.weight.latest.value, dryWeight).bg} ${getWeightStatus(summary.weight.latest.value, dryWeight).color}`}>
                {getWeightStatus(summary.weight.latest.value, dryWeight).label}
              </span>
              {weightReadings.length > 1 && (
                <SimpleChart data={weightReadings.map(r => r.value)} color="#06b6d4" />
              )}
              <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
                <span>{summary.weight.count} readings</span>
                <span>{formatDate(summary.weight.latest.timestamp)}</span>
              </div>
            </div>
          ) : (
            <EmptyVitals type="weight" />
          )}
        </VitalsCard>
      </div>

      {/* Recent Readings Table */}
      <div className="card-premium">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Recent Readings</h3>
          <span className="text-sm text-slate-400">{readings.length} total</span>
        </div>
        
        {readings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-500">No readings recorded yet</p>
            <p className="text-sm text-slate-400 mt-1">Connect Telegram to start tracking your vitals</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date & Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Value</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 15).map((reading) => (
                  <tr key={reading.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {formatDate(reading.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        reading.type === "glucose" ? "bg-purple-50 text-purple-600" : 
                        reading.type === "bp" ? "bg-rose-50 text-rose-600" : "bg-cyan-50 text-cyan-600"
                      }`}>
                        {reading.type === "glucose" ? "Glucose" : 
                         reading.type === "bp" ? "Blood Pressure" : "Weight"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {reading.type === "glucose" ? (
                        <span className={`font-semibold ${getGlucoseStatus(reading.value).color}`}>
                          {reading.value} {reading.unit}
                        </span>
                      ) : reading.type === "bp" ? (
                        <span className="font-semibold text-slate-800">
                          {reading.systolic}/{reading.diastolic} mmHg
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-800">
                          {reading.value} kg
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {reading.type === "glucose" ? (
                        <span className={`text-xs ${getGlucoseStatus(reading.value).color}`}>
                          {getGlucoseStatus(reading.value).label}
                        </span>
                      ) : reading.type === "bp" ? (
                        <span className={`text-xs ${getBPStatus(reading.systolic || 0, reading.diastolic || 0).color}`}>
                          {getBPStatus(reading.systolic || 0, reading.diastolic || 0).label}
                        </span>
                      ) : (
                        <span className={`text-xs ${getWeightStatus(reading.value, dryWeight).color}`}>
                          {getWeightStatus(reading.value, dryWeight).label}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadingsTab;