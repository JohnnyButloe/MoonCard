export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function phaseNameFromDeg(
  deg: number | undefined,
  epsilonDeg = 5
): string | undefined {
  if (deg == null) return undefined;
  const d = normalizeDeg(deg);

  // Cardinal points with tolerance
  if (d <= epsilonDeg || d >= 360 - epsilonDeg) return "New Moon";
  if (Math.abs(d - 90) <= epsilonDeg) return "First Quarter";
  if (Math.abs(d - 180) <= epsilonDeg) return "Full Moon";
  if (Math.abs(d - 270) <= epsilonDeg) return "Last Quarter";

  // Ranges
  if (d > 0 && d < 90) return "Waxing Crescent";
  if (d > 90 && d < 180) return "Waxing Gibbous";
  if (d > 180 && d < 270) return "Waning Gibbous";
  if (d > 270 && d < 360) return "Waning Crescent";
  return undefined;
}
