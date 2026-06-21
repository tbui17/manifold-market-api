/**
 * Shared, platform-agnostic HTTP client for the Manifold Markets REST API.
 * Per FR-009: sole owner of HTTP concerns. Per FR-003: verbatim passthrough.
 * Per FR-006/Q3: rely-on-upstream — sends requests with whatever key is
 * configured (none if absent); the upstream 401 surfaces as an auth-category
 * error. No per-tool auth metadata or pre-check.
 */

import { ManifoldError } from "./errors.js";

const BASE_URL = "https://api.manifold.markets/v0";

/**
 * Perform a GET request against the Manifold API.
 * Response body is returned verbatim (FR-003).
 * @param path - API path after /v0/ (e.g. "search-markets", "market/{id}")
 * @param params - Optional query parameters; undefined/null values are omitted
 * @param apiKey - Optional API key; omitted from headers when absent
 * @param signal - Optional AbortSignal for cancellation (FR-011)
 */
export async function manifoldGet<T>(
  path: string,
  params?: Record<string, unknown>,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Key ${apiKey}`;
  return doFetch<T>(url, { method: "GET", headers }, signal);
}

/**
 * Perform a POST request against the Manifold API.
 * Response body is returned verbatim (FR-003).
 * @param path - API path after /v0/ (e.g. "bet", "market/{id}/resolve")
 * @param body - Request body JSON
 * @param apiKey - API key (sent if present; upstream 401 if absent per FR-006/Q3)
 * @param signal - Optional AbortSignal for cancellation (FR-011)
 */
export async function manifoldPost<T>(
  path: string,
  body: Record<string, unknown>,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Key ${apiKey}`;
  return doFetch<T>(
    url,
    { method: "POST", headers, body: JSON.stringify(body) },
    signal,
  );
}

async function doFetch<T>(
  url: URL,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  // Combine caller signal with any fetch-level signal
  const combinedSignal = signal ?? undefined;
  try {
    const res = await fetch(url.toString(), {
      ...init,
      signal: combinedSignal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => undefined);
      // 401 → auth category (FR-006/Q3: rely on upstream)
      const category = res.status === 401 ? "auth" : "upstream";
      throw new ManifoldError(
        category,
        `Manifold API error ${res.status}: ${text ?? res.statusText}`,
        res.status,
        text,
      );
    }

    // Verbatim passthrough (FR-003) — no transformation
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ManifoldError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    // Network or timeout error
    if (err instanceof TypeError) {
      throw new ManifoldError("network", `Network error: ${(err as Error).message}`);
    }
    // Re-throw unknown errors wrapped in the uniform shape
    throw new ManifoldError("network", `Unexpected error: ${(err as Error).message}`);
  }
}
