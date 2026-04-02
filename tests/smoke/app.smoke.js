import { expect, test } from "@playwright/test";
import {
  expectNoFatalSignals,
  expectTrackerShell,
  openMapWorkspace,
  openSmokeApp
} from "./helpers/smokeApp.js";

const STORAGE_KEY = "localCampaignTracker_v1";

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} expectedTitle
 */
async function waitForSavedCampaignTitle(page, expectedTitle) {
  await expect.poll(async () => page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw)?.tracker?.campaignTitle ?? null;
    } catch {
      return null;
    }
  }, STORAGE_KEY)).toBe(expectedTitle);
}

test("app shell renders and the map workspace opens", async ({ page }) => {
  const fatalSignals = await openSmokeApp(page);

  await expectTrackerShell(page);
  await expect(page.locator("#campaignTitle")).toHaveText("My Campaign");

  await openMapWorkspace(page);
  await expect(page.locator("#mapSelect")).toHaveValue(/.+/);
  await expect(page.locator("#mapSelect option").first()).toHaveText("World Map");
  await expect(page.locator("#mapCanvas")).toBeVisible();

  await expectNoFatalSignals(page, fatalSignals);
});

test("campaign title survives a reload", async ({ page }) => {
  const fatalSignals = await openSmokeApp(page);
  const updatedTitle = "Smoke Test Chronicle";
  const campaignTitle = page.locator("#campaignTitle");

  await expectTrackerShell(page);
  await expect(campaignTitle).toHaveText("My Campaign");

  await campaignTitle.fill(updatedTitle);
  await expect(campaignTitle).toHaveText(updatedTitle);

  await waitForSavedCampaignTitle(page, updatedTitle);

  await page.reload();

  await expectTrackerShell(page);
  await expect(page.locator("#campaignTitle")).toHaveText(updatedTitle);

  await expectNoFatalSignals(page, fatalSignals);
});
