import { z } from "zod";

const OptionalIsoString = z.string().min(1).nullable().optional();

const AstronomyMoonEventSetSchema = z.object({
  rise_local: OptionalIsoString,
  set_local: OptionalIsoString,
  high_moon_local: OptionalIsoString,
  low_moon_local: OptionalIsoString,
  phase_name: z.string().min(1).nullable().optional(),
});

export const AstronomySummarySchema = z.object({
  meta: z.object({
    source: z.string().min(1),
    generated_at_utc: z.string().min(1),
    cache_key: z.string().min(1),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
      elevation_m: z.number(),
      timezone: z.string().min(1),
      timezone_offset: z.string().min(1),
    }),
    date: z.object({
      current_utc: z.string().min(1),
      current_local: z.string().min(1),
      local_date: z.string().min(1),
      previous_local_date: z.string().min(1),
      next_local_date: z.string().min(1),
    }),
  }),
  moon: z.object({
    current: z.object({
      observed_at_utc: z.string().min(1),
      observed_at_local: z.string().min(1),
      altitude_deg: z.number(),
      azimuth_deg: z.number(),
      illumination_frac: z.number(),
      illumination_pct: z.number(),
      phase_angle_deg: z.number(),
      bright_limb_angle_deg: z.number(),
      phase_name: z.string().min(1).nullable().optional(),
      waxing: z.boolean(),
      distance_km: z.number(),
      above_horizon: z.boolean(),
    }),
    events: z.object({
      rise_local: OptionalIsoString,
      set_local: OptionalIsoString,
      high_moon_local: OptionalIsoString,
      low_moon_local: OptionalIsoString,
      previous_rise_local: OptionalIsoString,
      previous_set_local: OptionalIsoString,
      today: AstronomyMoonEventSetSchema,
      previous_day: AstronomyMoonEventSetSchema,
      next_day: AstronomyMoonEventSetSchema,
    }),
  }),
  sun: z.object({
    current: z.object({
      observed_at_utc: z.string().min(1),
      observed_at_local: z.string().min(1),
      altitude_deg: z.number(),
      azimuth_deg: z.number(),
      above_horizon: z.boolean(),
    }),
    events: z.object({
      sunrise_local: OptionalIsoString,
      sunset_local: OptionalIsoString,
    }),
    path: z.object({
      window_start_local: z.string().min(1),
      window_end_local: z.string().min(1),
      sample_count: z.number().int().min(2),
      samples: z.array(
        z.object({
          time_utc: z.string().min(1),
          time_local: z.string().min(1),
          altitude_deg: z.number(),
          azimuth_deg: z.number(),
        }),
      ),
    }),
  }),
  twilight: z.object({
    timezone_offset: z.string().min(1),
    current_phase: z.string().min(1),
    next_transition_local: OptionalIsoString,
    segments: z.array(
      z.object({
        phase: z.string().min(1),
        start_local: z.string().min(1),
        end_local: z.string().min(1),
      }),
    ),
    sun_events: z.object({
      sunrise_local: OptionalIsoString,
      sunset_local: OptionalIsoString,
    }),
  }),
});

export const MoonPhaseWindowSchema = z.object({
  meta: z.object({
    source: z.string().min(1),
    generated_at_utc: z.string().min(1),
    cache_key: z.string().min(1),
    timezone: z.string().min(1),
    window_start_local_date: z.string().min(1),
    window_end_local_date: z.string().min(1),
    window_days: z.number().int().min(1),
    today_local_date: z.string().min(1),
  }),
  days: z.array(
    z.object({
      date_local: z.string().min(1),
      weekday_short: z.string().min(1),
      is_today: z.boolean(),
      phases: z.array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          short_label: z.string().min(1),
          phase_angle_deg: z.number(),
          illumination_frac: z.number(),
          waxing: z.boolean(),
          instant_local: z.string().min(1),
          instant_utc: z.string().min(1),
        }),
      ),
    }),
  ),
});

export const SummaryQuerySchema = z.object({
  mode: z.literal("summary"),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  tz: z.string().min(1).max(100),
  datetime_iso: z.string().datetime({ offset: true }).optional(),
  date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  elev: z.coerce.number().optional(),
  sun_path_samples: z.coerce.number().int().min(24).max(480).optional(),
});

export const PhasesQuerySchema = z.object({
  mode: z.literal("phases"),
  tz: z.string().min(1).max(100),
  start_date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  window_days: z.coerce.number().int().min(7).max(84).optional(),
});
