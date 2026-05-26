import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiService } from "./api-service";

// Helper to build a Response-like object the service can consume. The service
// only ever calls `.ok`, `.status`, and `.json()`, so we don't need a full
// `Response` polyfill.
function makeResponse(body: unknown, init: { ok: boolean; status: number }) {
  return {
    ok: init.ok,
    status: init.status,
    json: vi.fn().mockResolvedValue(body),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiService.get", () => {
  it("returns data on a 2xx response with { data }", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ data: { id: 1, name: "alpha" } }, { ok: true, status: 200 })
    );

    const result = await ApiService.get<{ id: number; name: string }>("/things/1");

    expect(result).toEqual({ id: 1, name: "alpha" });
    expect(fetchMock).toHaveBeenCalledWith("/api/things/1");
  });

  it("throws when a 2xx response carries an { error } payload", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ error: "not allowed" }, { ok: true, status: 200 })
    );

    await expect(ApiService.get("/things/1")).rejects.toThrow("not allowed");
  });

  it("throws with HTTP status info on a 4xx/5xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({}, { ok: false, status: 500 })
    );

    await expect(ApiService.get("/things/1")).rejects.toThrow(
      "HTTP error! status: 500"
    );
  });

  it("uses the body's message field on a non-ok response when present", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ message: "server exploded" }, { ok: false, status: 503 })
    );

    await expect(ApiService.get("/things/1")).rejects.toThrow("server exploded");
  });
});

describe("ApiService.post", () => {
  it("returns data on a 2xx response with { data } and sends JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ data: { id: 42 } }, { ok: true, status: 201 })
    );

    const payload = { name: "alpha" };
    const result = await ApiService.post<{ id: number }>("/things", payload);

    expect(result).toEqual({ id: 42 });
    expect(fetchMock).toHaveBeenCalledWith("/api/things", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws when a 2xx response carries an { error } payload", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ error: "validation failed" }, { ok: true, status: 200 })
    );

    await expect(ApiService.post("/things", {})).rejects.toThrow(
      "validation failed"
    );
  });

  it("throws with HTTP status info on a 4xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({}, { ok: false, status: 400 })
    );

    await expect(ApiService.post("/things", {})).rejects.toThrow(
      "HTTP error! status: 400"
    );
  });
});

describe("ApiService.put", () => {
  it("returns data on a 2xx response with { data } and sends JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ data: { ok: true } }, { ok: true, status: 200 })
    );

    const payload = { name: "beta" };
    const result = await ApiService.put<{ ok: boolean }>("/things/1", payload);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/things/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws when a 2xx response carries an { error } payload", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ error: "conflict" }, { ok: true, status: 200 })
    );

    await expect(ApiService.put("/things/1", {})).rejects.toThrow("conflict");
  });

  it("throws with HTTP status info on a 5xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({}, { ok: false, status: 502 })
    );

    await expect(ApiService.put("/things/1", {})).rejects.toThrow(
      "HTTP error! status: 502"
    );
  });
});

describe("ApiService.delete", () => {
  it("returns data on a 2xx response with { data }", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ data: { deleted: true } }, { ok: true, status: 200 })
    );

    const result = await ApiService.delete<{ deleted: boolean }>("/things/1");

    expect(result).toEqual({ deleted: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/things/1", { method: "DELETE" });
  });

  it("throws when a 2xx response carries an { error } payload", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({ error: "not found" }, { ok: true, status: 200 })
    );

    await expect(ApiService.delete("/things/1")).rejects.toThrow("not found");
  });

  it("throws with HTTP status info on a 4xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({}, { ok: false, status: 404 })
    );

    await expect(ApiService.delete("/things/1")).rejects.toThrow(
      "HTTP error! status: 404"
    );
  });

  it("falls back to status message when error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 418,
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    });

    await expect(ApiService.delete("/things/1")).rejects.toThrow(
      "HTTP error! status: 418"
    );
  });
});
