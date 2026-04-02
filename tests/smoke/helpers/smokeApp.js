import { expect } from "@playwright/test";

/**
 * @param {import("@playwright/test").Page} page
 * @returns {{ consoleErrors: string[], pageErrors: string[] }}
 */
export function watchForFatalSignals(page) {
  /** @type {string[]} */
  const consoleErrors = [];
  /** @type {string[]} */
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  return { consoleErrors, pageErrors };
}

/**
 * Opens the app and waits for the top-level shell to finish rendering.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<{ consoleErrors: string[], pageErrors: string[] }>}
 */
export async function openSmokeApp(page) {
  const fatalSignals = watchForFatalSignals(page);
  await page.goto("/");
  await expectTrackerShell(page);
  return fatalSignals;
}

/**
 * @param {import("@playwright/test").Page} page
 */
export async function expectTrackerShell(page) {
  await expect(page.getByRole("tablist", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tracker" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#campaignTitle")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
}

/**
 * @param {import("@playwright/test").Page} page
 */
export async function openMapWorkspace(page) {
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByRole("tab", { name: "Map" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#page-map")).toBeVisible();
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {{ consoleErrors: string[], pageErrors: string[] }} fatalSignals
 */
export async function expectNoFatalSignals(page, fatalSignals) {
  await expect(page.locator("#statusText")).not.toContainText(/failed to initialize|something went wrong/i);
  expect(fatalSignals.consoleErrors).toEqual([]);
  expect(fatalSignals.pageErrors).toEqual([]);
}
