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
};
