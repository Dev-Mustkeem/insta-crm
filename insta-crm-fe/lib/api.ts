const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://gen-crm.onrender.com/api"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Something went wrong";
  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(". ");
  return typeof message === "string" ? message : "Something went wrong";
}

async function request(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(
      "CRM server is unavailable. Check that the API server and database are running, then try again.",
      0,
    );
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await request(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (
    response.status === 401 &&
    retryAfterRefresh &&
    path !== "/auth/refresh"
  ) {
    const refreshResponse = await request(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (refreshResponse.ok) return apiFetch<T>(path, init, false);
  }

  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ApiError(errorMessage(payload), response.status);
  return payload as T;
}

export async function apiDownload(
  path: string,
  retryAfterRefresh = true,
): Promise<Blob> {
  const response = await request(`${API_URL}${path}`, {
    credentials: "include",
  });
  if (response.status === 401 && retryAfterRefresh) {
    const refreshResponse = await request(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (refreshResponse.ok) return apiDownload(path, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(errorMessage(payload), response.status);
  }
  return response.blob();
}

