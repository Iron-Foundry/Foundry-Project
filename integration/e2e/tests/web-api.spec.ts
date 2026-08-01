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
  // A request that never reaches the server fires `requestfailed`, not
  // `response`, so counting responses alone reports "0 calls" and hides the
  // reason. Collect the failures and the console too, and put them in the
  // assertion message - a silent zero is the least useful way to fail.
  const failures: string[] = [];
  const consoleLines: string[] = [];

  page.on("response", (res) => {
    if (res.url().startsWith(API_URL)) apiResponses.push(res.status());
  });
  page.on("requestfailed", (req) => {
    failures.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText ?? "unknown"}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLines.push(`${msg.type()}: ${msg.text()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });

  // The document rendered (not a blank crash) ...
  await expect(page.locator("body")).not.toBeEmpty();
  // ... and the browser successfully talked to the API (web -> api -> DB),
  // with no server error on those calls.
  const diagnosis = [
    failures.length ? `failed requests:\n  ${failures.join("\n  ")}` : "no failed requests",
    consoleLines.length ? `console:\n  ${consoleLines.join("\n  ")}` : "console clean",
  ].join("\n");

  expect(apiResponses.length, `no browser call reached ${API_URL}.\n${diagnosis}`).toBeGreaterThan(0);
  expect(apiResponses.every((s) => s < 500), `5xx from the api.\n${diagnosis}`).toBe(true);
});
