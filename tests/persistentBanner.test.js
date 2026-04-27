import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createPersistentBanner } from "../js/ui/persistentBanner.js";

// createElement call order inside ensureMounted():
//   [0] bannerEl  (div)
//   [1] textEl    (span)
//   [2] actionsEl (div)
//   [3] primaryBtnEl (button)
//   [4] dismissBtnEl (button)

function makeElement() {
  return {
    className: "",
    id: "",
    hidden: false,
    textContent: "",
    type: "",
    /** @type {(() => (void | Promise<void>)) | null} */
    onclick: null,
    style: { display: "" },
    classList: {
      _classes: new Set(),
      /** @param {string} cls */
      add(cls) { this._classes.add(cls); },
      /** @param {string} cls */
      remove(cls) { this._classes.delete(cls); },
      /** @param {string} cls */
      has(cls) { return this._classes.has(cls); },
    },
    /** @param {string} _name @param {string} _val */
    setAttribute(_name, _val) {},
    /** @param {...unknown} _kids */
    append(..._kids) {},
    _removed: false,
    remove() { this._removed = true; },
  };
}

function makeDocumentStub() {
  /** @type {ReturnType<typeof makeElement>[]} */
  const created = [];
  const body = {
    /** @type {ReturnType<typeof makeElement>[]} */
    _children: [],
    /** @param {ReturnType<typeof makeElement>} child */
    appendChild(child) { this._children.push(child); },
  };
  return {
    createElement: vi.fn(() => {
      const el = makeElement();
      created.push(el);
      return el;
    }),
    body,
    /** The ordered list of elements returned by createElement calls. */
    _created: created,
  };
}

/** @type {import("../js/ui/persistentBanner.js").PersistentBannerConfig} */
const baseConfig = {
  className: "testBanner",
  role: /** @type {"alert"} */ ("alert"),
  ariaLive: /** @type {"assertive"} */ ("assertive"),
  dismissPolicy: /** @type {"transient"} */ ("transient"),
  message: "Test message",
  primaryButton: { label: "OK", className: "testBanner__btn testBanner__btn--primary" },
  dismissButton: { label: "Later" },
};

describe("createPersistentBanner", () => {
  /** @type {ReturnType<typeof makeDocumentStub>} */
  let docStub;
  /** @type {import("../js/ui/persistentBanner.js").PersistentBannerApi} */
  let banner;

  beforeEach(() => {
    docStub = makeDocumentStub();
    vi.stubGlobal("document", docStub);
    banner = createPersistentBanner(baseConfig);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("show() mounts the banner element and calls onPrimary when the primary button is clicked", async () => {
    const onPrimary = vi.fn();
    banner.show({ onPrimary });

    expect(docStub.body._children).toHaveLength(1); // banner appended to body
    // TODO: assert bannerEl.hidden === false, ARIA attributes, button text

    // Brittle: these indices assume document.createElement is called in this order:
    // [0] root div, [1] text span, [2] actions div, [3] primary button, [4] dismiss button.
    // If ensureMounted() in persistentBanner.js adds elements before the buttons, update these.
    const primaryBtn = docStub._created[3];
    await primaryBtn.onclick?.();

    expect(onPrimary).toHaveBeenCalledTimes(1);
    // TODO: assert hide() fired before onPrimary (bannerEl.hidden === true at call time)
  });

  it("hide() hides the banner", () => {
    banner.show({});
    banner.hide();

    const bannerEl = docStub._created[0];
    expect(bannerEl.hidden).toBe(true);
    // TODO: assert classList.has("isHidden") === true and style.display === "none"
  });

  it("dismissPolicy 'session' — subsequent show() calls are no-ops after dismiss fires", () => {
    banner = createPersistentBanner({ ...baseConfig, dismissPolicy: "session" });
    banner.show({});

    const bannerEl = docStub._created[0];
    const dismissBtn = docStub._created[4];
    dismissBtn.onclick?.(); // fires dismiss — sets sessionDismissed, hides

    banner.show({}); // second call — session policy must block it
    expect(bannerEl.hidden).toBe(true);
    // TODO: assert style.display and classList unchanged; createElement not called again
  });

  it("dismissPolicy 'transient' — show() re-shows after dismiss", () => {
    banner.show({});

    const bannerEl = docStub._created[0];
    const dismissBtn = docStub._created[4];
    dismissBtn.onclick?.(); // dismiss — hides but does NOT set sessionDismissed

    banner.show({}); // second call — transient policy must allow it
    expect(bannerEl.hidden).toBe(false);
    // TODO: assert classList.has("isHidden") === false and style.display === ""
  });

  it("destroy() removes the banner element from the DOM", () => {
    banner.show({});
    banner.destroy();

    const bannerEl = docStub._created[0];
    expect(bannerEl._removed).toBe(true);
    // TODO: assert createElement is not called again on subsequent show() after destroy
  });
});
