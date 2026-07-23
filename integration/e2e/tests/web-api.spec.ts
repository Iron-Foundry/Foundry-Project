import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

test("api is reachable and healthy", async ({ request }) => {
  const res = await request.get(`${API_URL}/health`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("api serves a DB-backed endpoint (schema migrated)", async ({ request }) => {
  const res = await request.get(`${API_URL}/clan/stats`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as Record<string, number>;
  expect(body).toHaveProperty("total_gp");
});

test("web app renders and reaches the api from the browser", async ({ page }) => {
  const apiResponses: number[] = [];
  page.on("response", (res) => {
    if (res.url().startsWith(API_URL)) apiResponses.push(res.status());
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // The document rendered (not a blank crash) ...
  await expect(page.locator("body")).not.toBeEmpty();
  // ... and the browser successfully talked to the API (web -> api -> DB),
  // with no server error on those calls.
  expect(apiResponses.length).toBeGreaterThan(0);
  expect(apiResponses.every((s) => s < 500)).toBe(true);
});
