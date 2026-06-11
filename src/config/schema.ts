import { z } from "zod";

const RatesYearSchema = z.object({
  kleine_cent: z.number().int().positive(),
  grosse_cent: z.number().int().positive(),
  kuerz_fruehstueck_cent: z.number().int().nonnegative(),
  kuerz_haupt_cent: z.number().int().nonnegative(),
  homeoffice_pro_tag_cent: z.number().int().positive(),
  homeoffice_max_tage: z.number().int().positive(),
  homeoffice_max_cent: z.number().int().positive(),
});

const StandardwocheSchema = z.object({
  mo: z.boolean(),
  di: z.boolean(),
  mi: z.boolean(),
  do: z.boolean(),
  fr: z.boolean(),
  sa: z.boolean(),
  so: z.boolean(),
});

export const ConfigSchema = z.object({
  jahre: z.record(z.string().regex(/^\d{4}$/), RatesYearSchema),
  standardwoche: StandardwocheSchema,
  feiertage: z.object({
    bundesland: z.string().length(2),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type RatesYear = z.infer<typeof RatesYearSchema>;
