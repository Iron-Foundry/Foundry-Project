import { expect, test } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";

test("draft page opens the live draft socket", async ({ page }) => {
  await page.goto("/activities/frenzy/draft", { waitUntil: "networkidle" });
  const socketUrl = `${API_URL.replace(/^http/, "ws")}/frenzy/draft/live`;
  // The page's own CSP governs this socket, so a missing connect-src entry fails here.
  const opened = await page.evaluate(
    (url) =>
      new Promise<boolean>((resolve) => {
        const socket = new WebSocket(url);
        socket.onopen = () => {
          socket.close();
          resolve(true);
        };
        socket.onerror = () => resolve(false);
      }),
    socketUrl,
  );
  expect(opened, `the browser could not open ${socketUrl}`).toBe(true);
  await expect(page.getByText("PVM Frenzy draft", { exact: true })).toBeVisible();
});
