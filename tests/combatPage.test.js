import { describe, expect, it } from "vitest";

import {
  COMBAT_CORE_PANEL_IDS,
  formatCombatElapsedTime,
  getCombatShellViewModel
} from "../js/pages/combat/combatPage.js";

describe("combat page shell helpers", () => {
  it("defines the always-present core combat panels", () => {
    expect(COMBAT_CORE_PANEL_IDS).toEqual(["combatCardsPanel", "combatRoundPanel"]);
  });

  it("formats elapsed encounter time for the shell timer", () => {
    expect(formatCombatElapsedTime(0)).toBe("00:00");
    expect(formatCombatElapsedTime(65)).toBe("01:05");
    expect(formatCombatElapsedTime(3661)).toBe("1:01:01");
    expect(formatCombatElapsedTime(-12)).toBe("00:00");
  });

  it("builds a safe empty-state view model from default combat state", () => {
    expect(
      getCombatShellViewModel({
        combat: {
          workspace: {
            panelOrder: [],
            embeddedPanels: [],
            panelCollapsed: {}
          },
          encounter: {
            id: null,
            createdAt: null,
            updatedAt: null,
            round: 1,
            activeParticipantId: null,
            elapsedSeconds: 0,
            secondsPerTurn: 6,
            participants: [],
            undoStack: []
          }
        }
      })
    ).toEqual({
      isEmpty: true,
      participantCount: 0,
      round: 1,
      elapsedSeconds: 0,
      elapsedLabel: "00:00",
      secondsPerTurn: 6
    });
  });

  it("normalizes malformed shell values without mutating future combat features", () => {
    const state = {
      combat: {
        encounter: {
          round: "4",
          elapsedSeconds: 125,
          secondsPerTurn: "9",
          participants: [{ id: "cmb_1" }, { id: "cmb_2" }]
        }
      }
    };

    expect(getCombatShellViewModel(state)).toEqual({
      isEmpty: false,
      participantCount: 2,
      round: 4,
      elapsedSeconds: 125,
      elapsedLabel: "02:05",
      secondsPerTurn: 9
    });
    expect(state.combat.encounter.participants).toEqual([{ id: "cmb_1" }, { id: "cmb_2" }]);
  });
});
