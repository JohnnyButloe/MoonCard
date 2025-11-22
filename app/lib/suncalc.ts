import SunCalc from "suncalc";

export type MoonNow = {
  altDeg: number; // altitude, degrees
  azDeg: number; // azimuth, degrees (from South in SunCalc, will convert)
  frac: number; // illuminated fraction 0..1
  phase: number; // phase 0..1 (0=new, 0.5=full)
};

export function getMoonNow(
  lat: number,
  lon: number,
  when = new Date()
): MoonNow {
  const pos = SunCalc.getMoonPosition(when, lat, lon); // radians
  const illum = SunCalc.getMoonIllumination(when);
  // SunCalc azimuth is from south, clockwise convert to from north for UI:
  const azFromNorth = ((pos.azimuth * 180) / Math.PI + 180 + 360) % 360;
  return {
    altDeg: (pos.altitude * 180) / Math.PI,
    azDeg: azFromNorth,
    frac: illum.fraction,
    phase: illum.phase,
  };
}
