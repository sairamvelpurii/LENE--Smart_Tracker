export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatINRDetailed(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Short labels for chart axes (avoids unreadable ticks for large values). */
export function formatINRChartAxis(n: number): string {
  const x = Math.abs(Number(n));
  if (!Number.isFinite(x)) return "₹0";
  if (x >= 1e7) return `₹${(x / 1e7).toFixed(x >= 1e8 ? 0 : 1)}Cr`;
  if (x >= 1e5) return `₹${(x / 1e5).toFixed(1)}L`;
  if (x >= 1e3) return `₹${Math.round(x / 1e3)}k`;
  return `₹${Math.round(x)}`;
}
