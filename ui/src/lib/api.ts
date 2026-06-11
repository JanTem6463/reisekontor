export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(code = "unauthorized", message?: string) {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(0, "network", message);
    this.name = "NetworkError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : String(e));
  }
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new UnauthorizedError(body.error ?? "unauthorized");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? "unknown");
  }
  return res.json() as Promise<T>;
}

export type DayType =
  | "homeoffice"
  | "buero"
  | "reise_anreise"
  | "reise_voll"
  | "reise_abreise"
  | "reise_eintaegig"
  | "urlaub"
  | "krankheit"
  | "feiertag";

export interface DayEntryDto {
  date: string;
  year: number;
  type: DayType;
  homeoffice: boolean;
  tripId: number | null;
  fruehstueck: boolean;
  mittag: boolean;
  abend: boolean;
  zuzahlungCent: number;
}

export interface YearSummary {
  year: number;
  verpflegungSummeCent: number;
  kuerzungSummeCent: number;
  homeofficeTage: number;
  homeofficeMaxTage: number;
  homeofficeBetragCent: number;
  homeofficeMaxBetragCent: number;
  reisetageNachTyp: Record<
    "reise_anreise" | "reise_voll" | "reise_abreise" | "reise_eintaegig",
    number
  >;
  reisenAnzahl: number;
}

export type PlausibilitaetCode =
  | "DOPPEL_HO_REISE_VOLL"
  | "EINTAEGIG_8H_BESTAETIGEN"
  | "HO_KONFLIKT_ENTFERNUNG";

export interface PlausibilitaetHinweis {
  code: PlausibilitaetCode;
  date: string;
  schwere: "hinweis" | "warnung";
}

export interface UpsertDayBody {
  type: DayType;
  homeoffice?: boolean;
  tripId?: number | null;
  meals?: { fruehstueck?: boolean; mittag?: boolean; abend?: boolean };
  zuzahlungCent?: number;
}

export interface HolidaysSyncResult {
  year: number;
  bundesland: string;
  created: number;
  skipped: Array<{ date: string; existingType: string }>;
}

export interface TripDto {
  id: number;
  year: number;
  startDate: string;
  endDate: string;
  uebernachtung: boolean;
}

export interface TripWithDays {
  trip: TripDto;
  days: DayEntryDto[];
}

export interface TripBody {
  startDate: string;
  endDate: string;
  uebernachtung: boolean;
}

export interface Standardwoche {
  mo: boolean;
  di: boolean;
  mi: boolean;
  do: boolean;
  fr: boolean;
  sa: boolean;
  so: boolean;
}

export interface EffectiveSettings {
  bundesland: string;
  standardwoche: Standardwoche;
}

export interface UpdateSettingsBody {
  bundesland?: string;
  standardwoche?: Standardwoche;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  uptime_seconds: number;
}

export const api = {
  login: (password: string) =>
    request<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  getHealth: () => request<HealthResponse>("/api/health"),
  listDays: (year: number) => request<DayEntryDto[]>(`/api/days?year=${year}`),
  upsertDay: (date: string, body: UpsertDayBody) =>
    request<{ ok: true; created: boolean }>(`/api/days/${date}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteDay: (date: string) => request<{ ok: true }>(`/api/days/${date}`, { method: "DELETE" }),
  getSummary: (year: number) => request<YearSummary>(`/api/summary?year=${year}`),
  getChecks: (year: number) => request<PlausibilitaetHinweis[]>(`/api/checks?year=${year}`),
  syncHolidays: (year: number) =>
    request<HolidaysSyncResult>(`/api/holidays/sync?year=${year}`, { method: "POST" }),
  listTrips: (year: number) => request<TripWithDays[]>(`/api/trips?year=${year}`),
  getTrip: (id: number) => request<TripWithDays>(`/api/trips/${id}`),
  createTrip: (body: TripBody) =>
    request<TripWithDays>("/api/trips", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTrip: (id: number, body: TripBody) =>
    request<TripWithDays>(`/api/trips/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteTrip: (id: number) => request<{ ok: true }>(`/api/trips/${id}`, { method: "DELETE" }),
  getSettings: () => request<EffectiveSettings>("/api/settings"),
  updateSettings: (body: UpdateSettingsBody) =>
    request<EffectiveSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
