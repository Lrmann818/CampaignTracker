// js/ui/topbar/topbarClock.js

let _activeTopbarClock = null;

export function initTopbarClock() {
    _activeTopbarClock?.destroy?.();
    _activeTopbarClock = null;

    const el = document.getElementById("topbarClock");
    if (!el) return { destroy() { } };

    const fmt = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
    });

    const tooltipFmt = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    let minuteAlignTimeout = 0;
    let minuteInterval = 0;

    const tick = () => {
        const now = new Date();
        el.textContent = fmt.format(now);
        el.title = tooltipFmt.format(now); // nice tooltip
    };

    tick();
    // align updates to the minute boundary
    const msToNextMinute = 60000 - (Date.now() % 60000);
    minuteAlignTimeout = window.setTimeout(() => {
        tick();
        minuteInterval = window.setInterval(tick, 60000);
    }, msToNextMinute);

    const api = {
        destroy() {
            if (minuteAlignTimeout) {
                clearTimeout(minuteAlignTimeout);
                minuteAlignTimeout = 0;
            }
            if (minuteInterval) {
                clearInterval(minuteInterval);
                minuteInterval = 0;
            }
            if (_activeTopbarClock === api) _activeTopbarClock = null;
        }
    };

    _activeTopbarClock = api;
    return api;
}
