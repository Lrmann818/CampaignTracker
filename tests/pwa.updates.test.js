import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { registerSWMock } = vi.hoisted(() => ({
  registerSWMock: vi.fn()
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: registerSWMock
}));

function setBrowserGlobals() {
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { serviceWorker: {} },
    configurable: true
  });
}

describe("initPwaUpdates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PROD", true);
    setBrowserGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    registerSWMock.mockReset();
    delete globalThis.window;
    delete globalThis.navigator;
  });

  it("checkForUpdates calls registration.update() and applyUpdate calls updateServiceWorker(true)", async () => {
    const mockUpdate = vi.fn(async () => {});
    const mockRegistration = { update: mockUpdate };
    const updateServiceWorker = vi.fn(async () => {});

    registerSWMock.mockImplementation((options) => {
      // Simulate vite-plugin-pwa calling onRegisteredSW after SW registration.
      options.onRegisteredSW?.("/sw.js", mockRegistration);
      return updateServiceWorker;
    });

    const onNeedRefresh = vi.fn();
    const onOfflineReady = vi.fn();
    const { initPwaUpdates } = await import("../js/pwa/updates.js");

    const api = initPwaUpdates({ onNeedRefresh, onOfflineReady });

    expect(registerSWMock).toHaveBeenCalledTimes(0);

    await expect(api.checkForUpdates()).resolves.toBe(true);
    await expect(api.applyUpdate()).resolves.toBe(true);

    expect(registerSWMock).toHaveBeenCalledTimes(1);
    // checkForUpdates must use the registration object — not the plugin update fn
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    // applyUpdate must use the plugin's updateServiceWorker with reloadPage=true
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);

    const registerArgs = registerSWMock.mock.calls[0][0];
    registerArgs.onNeedRefresh();
    registerArgs.onOfflineReady();

    expect(onNeedRefresh).toHaveBeenCalledTimes(1);
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
  });

  it("checkForUpdates returns false when registration is not available (non-prod)", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("PROD", false);

    const { initPwaUpdates } = await import("../js/pwa/updates.js");
    const api = initPwaUpdates({});

    await expect(api.checkForUpdates()).resolves.toBe(false);
    expect(registerSWMock).not.toHaveBeenCalled();
  });

  it("returns false for both methods when service workers are unsupported", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true
    });

    const { initPwaUpdates } = await import("../js/pwa/updates.js");
    const api = initPwaUpdates({});

    await expect(api.checkForUpdates()).resolves.toBe(false);
    await expect(api.applyUpdate()).resolves.toBe(false);
    expect(registerSWMock).not.toHaveBeenCalled();
  });

  it("registers only once across multiple initPwaUpdates calls", async () => {
    const mockUpdate = vi.fn(async () => {});
    const updateServiceWorker = vi.fn(async () => {});

    registerSWMock.mockImplementation((options) => {
      options.onRegisteredSW?.("/sw.js", { update: mockUpdate });
      return updateServiceWorker;
    });

    const { initPwaUpdates } = await import("../js/pwa/updates.js");

    const api1 = initPwaUpdates({});
    const api2 = initPwaUpdates({});

    await api1.checkForUpdates();
    await api2.checkForUpdates();

    expect(registerSWMock).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
