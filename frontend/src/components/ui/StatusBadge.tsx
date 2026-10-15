import { STATUS_STYLES, toStatus } from "../../lib/metrics";

const StatusBadge = ({ status, className = "" }: { status?: string | null; className?: string }) => {
  const s = toStatus(status);
  if (!s) return null;
  const style = STATUS_STYLES[s];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.className} ${className}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
};

export default StatusBadge;
