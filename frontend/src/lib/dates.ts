// Record dates are calendar dates; parse the YYYY-MM-DD prefix as a local date so they don't shift across timezones.
export const parseRecordDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

export const parseTimestamp = (value?: string | null): Date | null => {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
