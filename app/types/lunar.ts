export type LunarSnapshot = {
  whenISO: string; // ISO in user tz
  altDeg: number;
  azDeg: number;
  illumPct: number;
  phaseName?: string;
  rise?: string;
  set?: string;
  highMoon?: string;
  lowMoon?: string;
};
