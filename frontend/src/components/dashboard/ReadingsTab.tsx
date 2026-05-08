import { useState, useEffect } from "react";
import { telegramService } from "../../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
  };
  bp: {
    latest: { systolic: number; diastolic: number; timestamp: string } | null;
    count: number;
  };
}

const ReadingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allReadingsRes, summaryRes] = await Promise.all([
        telegramService.getReadings(),
        telegramService.getSummary()
      ]);
      setReadings(allReadingsRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error("Failed to load readings:", err);
      setError("Failed to load readings");
    } finally {
      setLoading(false);
    }
  };

const formatDate = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

  const getStatusColor = (type: string, value: number) => {
    if (type === "glucose") {
      if (value < 70) return "text-red-600";
      if (value <= 100) return "text-green-600";
      if (value <= 125) return "text-yellow-600";
      return "text-red-600";
    }
    return "text-gray-600";
  };

  const glucoseReadings = readings.filter(r => r.type === "glucose").slice(0, 20).reverse();
  const bpReadings = readings.filter(r => r.type === "bp").slice(0, 20).reverse();

  const renderGlucoseChart = () => {
    if (glucoseReadings.length === 0) return null;
    
    const values = glucoseReadings.map(r => r.value);
    const min = Math.min(...values) - 20;
    const max = Math.max(...values) + 20;
    const range = max - min || 1;
    const height = 80;
    const width = 100;
    const step = glucoseReadings.length > 1 ? width / (values.length - 1) : 0;

    const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");

    if (glucoseReadings.length === 1) {
      const val = values[0];
      const y = height - ((val - min) / range) * height;
      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
          <circle cx={width / 2} cy={y} r="4" fill="#8b5cf6" />
        </svg>
      );
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#glucoseGradient)" />
      </svg>
    );
  };

  const renderBPChart = () => {
    if (bpReadings.length === 0) return null;
    
    const sysValues = bpReadings.map(r => r.systolic || 0);
    const diaValues = bpReadings.map(r => r.diastolic || 0);
    const allValues = [...sysValues, ...diaValues];
    const min = Math.min(...allValues) - 10;
    const max = Math.max(...allValues) + 10;
    const range = max - min || 1;
    const height = 80;
    const width = 100;
    const step = bpReadings.length > 1 ? width / (sysValues.length - 1) : 0;

    const sysPoints = sysValues.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");
    const diaPoints = diaValues.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");

    if (bpReadings.length === 1) {
      const sysY = height - ((sysValues[0] - min) / range) * height;
      const diaY = height - ((diaValues[0] - min) / range) * height;
      return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
          <circle cx={width / 2} cy={sysY} r="4" fill="#f97316" />
          <circle cx={width / 2} cy={diaY} r="4" fill="#22c55e" />
        </svg>
      );
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        <polyline points={sysPoints} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={diaPoints} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Health Readings</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Blood Glucose</CardTitle>
              <span className="text-xs text-gray-400">{summary?.glucose.count || 0} readings</span>
            </div>
          </CardHeader>
          <CardContent>
             {summary?.glucose.latest ? (
               <div className="space-y-3">
                 <p className={`text-4xl font-bold ${getStatusColor("glucose", summary.glucose.latest.value)}`}>
                   {summary.glucose.latest.value}
                   <span className="text-lg font-normal text-gray-500 ml-1">{summary.glucose.latest.unit}</span>
                 </p>
                 {renderGlucoseChart()}
                 <p className="text-xs text-gray-400">
                   Average glucose: {formatDate(summary.glucose.latest.timestamp)}
                 </p>
               </div>
             ) : (
               <div className="h-32 flex items-center justify-center">
                 <p className="text-gray-400">No glucose readings yet</p>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Blood Pressure</CardTitle>
              <span className="text-xs text-gray-400">{summary?.bp.count || 0} readings</span>
            </div>
          </CardHeader>
          <CardContent>
             {summary?.bp.latest ? (
               <div className="space-y-3">
                 <p className="text-4xl font-bold text-gray-800">
                   {summary.bp.latest.systolic}/{summary.bp.latest.diastolic}
                   <span className="text-lg font-normal text-gray-500 ml-1">mmHg</span>
                 </p>
                 {renderBPChart()}
                 <div className="flex items-center gap-4 text-xs">
                   <span className="flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                     Systolic
                   </span>
                   <span className="flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-green-500"></span>
                     Diastolic
                   </span>
                 </div>
                 <p className="text-xs text-gray-400">
                   Average BP: {formatDate(summary.bp.latest.timestamp)}
                 </p>
               </div>
             ) : (
               <div className="h-32 flex items-center justify-center">
                 <p className="text-gray-400">No blood pressure readings yet</p>
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No readings found. Connect Telegram to start logging.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Value</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 30).map((reading) => (
                    <tr key={reading.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(reading.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          reading.type === "glucose" ? "bg-purple-100 text-purple-600" : "bg-orange-100 text-orange-600"
                        }`}>
                          {reading.type === "glucose" ? "Glucose" : "Blood Pressure"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {reading.type === "glucose" ? (
                          <span className={`font-medium ${getStatusColor("glucose", reading.value)}`}>
                            {reading.value} {reading.unit}
                          </span>
                        ) : (
                          <span className="font-medium text-gray-800">
                            {reading.systolic}/{reading.diastolic} mmHg
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {reading.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReadingsTab;