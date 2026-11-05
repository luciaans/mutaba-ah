export function executionPercentage(performed: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((performed / total) * 1000) / 10;
}
