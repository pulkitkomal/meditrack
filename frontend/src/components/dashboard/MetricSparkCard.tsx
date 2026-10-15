import { Link } from "react-router-dom";
import type { MetricSeries } from "../../lib/metrics";
import StatusBadge from "../ui/StatusBadge";

export const Sparkline = ({ values, className = "" }: { values: number[]; className?: string }) => {
  if (values.length < 2) return null;
  const width = 100;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 3 - ((v - min) / span) * (height - 6),
  ]);
  const path = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`w-full h-7 text-teal-500 ${className}`} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
    </svg>
  );
};

const MetricSparkCard = ({ series }: { series: MetricSeries }) => {
  const latest = series.points[series.points.length - 1];
  const previous = series.points.length > 1 ? series.points[series.points.length - 2] : null;
  const change = previous ? latest.value - previous.value : 0;
  const recent = series.points.slice(-12);
  const href = latest.sourceType === "lab" ? `/analysis/${latest.sourceId}` : "/dashboard?tab=readings";

  return (
    <Link to={href} className="block p-4 rounded-glass border border-slate-100 bg-surface hover:border-teal-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{series.name}</p>
        <StatusBadge status={latest.status} />
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800">
        {latest.display} <span className="text-sm font-normal text-slate-500">{latest.unit}</span>
      </p>
      <Sparkline values={recent.map(p => p.value)} className="mt-2" />
      <p className="mt-1 text-xs text-slate-500 flex justify-between gap-2">
        <span>{latest.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
        {previous && change !== 0 && (
          <span>{change > 0 ? "▲" : "▼"} {Math.abs(Number(change.toFixed(1)))} since last</span>
        )}
      </p>
    </Link>
  );
};

export default MetricSparkCard;
