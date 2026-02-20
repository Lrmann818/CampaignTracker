// js/ui/topbar/topbarClock.js
export function initTopbarClock() {
    const el = document.getElementById("topbarClock");
    if (!el) return;

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

    const tick = () => {
        const now = new Date();
        el.textContent = fmt.format(now);
        el.title = tooltipFmt.format(now); // nice tooltip
    };

    tick();
    // align updates to the minute boundary
    const msToNextMinute = 60000 - (Date.now() % 60000);
    setTimeout(() => {
        tick();
        setInterval(tick, 60000);
    }, msToNextMinute);
}
