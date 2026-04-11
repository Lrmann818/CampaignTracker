import { expect, test } from "@playwright/test";
import {
  expectNoFatalSignals,
  openSmokeApp
} from "./helpers/smokeApp.js";

test("combat tab opens the shell panels and records shell layout state", async ({ page }) => {
  const fatalSignals = await openSmokeApp(page, { campaignName: "Combat Shell Smoke" });

  await page.getByRole("tab", { name: "Combat" }).click();
  await expect(page.getByRole("tab", { name: "Combat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#page-combat")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Combat Cards" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Round Controls / Timer" })).toBeVisible();
  await expect(page.locator("#combatEmptyState")).toBeVisible();
  await expect(page.locator("#combatRoundValue")).toHaveText("1");
  await expect(page.locator("#combatElapsedValue")).toHaveText("00:00");
  await expect(page.locator("#combatTurnSecondsValue")).toHaveText("6s");

  await expect(page.locator("#combatNextTurnBtn")).toBeDisabled();
  await expect(page.locator("#combatUndoBtn")).toBeDisabled();
  await expect(page.locator("#combatClearBtn")).toBeDisabled();

  await page.locator("#combatCardsPanel .sectionMoves button[title='Move section down']").click();
  await expect.poll(() => page.evaluate(() => globalThis.__APP_STATE__?.combat?.workspace?.panelOrder))
    .toEqual(["combatRoundPanel", "combatCardsPanel"]);

  await page.locator("#combatRoundPanel > .panelHeader").click();
  await expect(page.locator("#combatRoundPanel")).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.evaluate(() => globalThis.__APP_STATE__?.combat?.workspace?.panelCollapsed))
    .toEqual({ combatRoundPanel: true });

  await expectNoFatalSignals(page, fatalSignals);
});
