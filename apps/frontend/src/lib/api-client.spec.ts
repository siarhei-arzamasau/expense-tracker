import { API_ROUTES } from "@expense-tracker/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient, retryApiQuery } from "./api-client";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  expire: vi.fn(),
}));

vi.mock("./auth-storage", () => ({
  authStorage: {
    get: mocks.getToken,
    expire: mocks.expire,
  },
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.clearAllMocks();
  mocks.getToken.mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiError", () => {
  it("marks only a 401 as unauthorized", () => {
    expect(new ApiError(401, "Unauthorized").isUnauthorized).toBe(true);
    expect(new ApiError(403, "Forbidden").isUnauthorized).toBe(false);
  });
});

describe("retryApiQuery", () => {
  it("retries one ordinary failure but never an unauthorized response", () => {
    expect(retryApiQuery(0, new Error("network"))).toBe(true);
    expect(retryApiQuery(1, new Error("network"))).toBe(false);
    expect(retryApiQuery(0, new ApiError(401, "Unauthorized"))).toBe(false);
  });
});

describe("apiClient", () => {
  it("adds the bearer token and preserves caller headers", async () => {
    mocks.getToken.mockReturnValue("access-token");
    fetchMock.mockResolvedValue(Response.json({ id: "user-1" }));
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

    await apiClient.get("auth/me", { headers: { "X-Trace": "trace-1" } });

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiUrl}/auth/me`,
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
          "X-Trace": "trace-1",
        },
      }),
    );
  });

  it("serializes mutation bodies and leaves DELETE bodyless when omitted", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await apiClient.patch("users/me", { name: null });
    await apiClient.delete("categories/category-1");

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ name: null }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty("body");
  });

  it("sends the password-confirmation body on account deletion", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await apiClient.delete("users/me", { password: "password123" });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ password: "password123" }),
    });
  });

  it("returns undefined for 204 instead of parsing an empty body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient.post("auth/forgot-password", {})).resolves.toBeUndefined();
  });

  it("joins class-validator messages into one ApiError", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: ["email must be an email", "password is too short"] },
        { status: 400 },
      ),
    );

    await expect(apiClient.post("auth/register", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "email must be an email, password is too short",
    });
  });

  it("falls back to status text for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(
      new Response("gateway down", { status: 502, statusText: "Bad Gateway" }),
    );

    await expect(apiClient.get("transactions")).rejects.toMatchObject({
      status: 502,
      message: "Bad Gateway",
    });
  });

  it("expires the matching token after a protected 401", async () => {
    mocks.getToken.mockReturnValue("access-token");
    fetchMock.mockResolvedValue(Response.json({ message: "Unauthorized" }, { status: 401 }));

    await expect(apiClient.get(API_ROUTES.auth.me)).rejects.toBeInstanceOf(ApiError);

    expect(mocks.expire).toHaveBeenCalledTimes(1);
  });

  it("does not expire a replacement token when an older request finishes with 401", async () => {
    mocks.getToken.mockReturnValueOnce("old-token").mockReturnValueOnce("new-token");
    fetchMock.mockResolvedValue(Response.json({ message: "Unauthorized" }, { status: 401 }));

    await expect(apiClient.get(API_ROUTES.auth.me)).rejects.toBeInstanceOf(ApiError);

    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it("does not emit session expiry for public authentication failures", async () => {
    mocks.getToken.mockReturnValue("access-token");
    fetchMock.mockResolvedValue(Response.json({ message: "Invalid credentials" }, { status: 401 }));

    await expect(apiClient.post(API_ROUTES.auth.login, {})).rejects.toBeInstanceOf(ApiError);

    expect(mocks.expire).not.toHaveBeenCalled();
  });
});
