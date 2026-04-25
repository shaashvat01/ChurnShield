export function formatDollars(amount: number): string {
  if (amount < 0) return "-" + formatDollars(Math.abs(amount));
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
