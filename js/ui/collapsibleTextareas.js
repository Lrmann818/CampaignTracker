export function initCollapsibleTextareas({ state, SaveManager, root = document } = {}) {
    if (!state?.character) state.character = {};
    if (!state.character.ui) state.character.ui = {};
    if (!state.character.ui.textareaCollapse) state.character.ui.textareaCollapse = {};

    const btns = Array.from(root.querySelectorAll("button[data-collapse-target]"));
    btns.forEach((btn) => {
        const id = btn.getAttribute("data-collapse-target");
        const target = document.getElementById(id);
        if (!id || !target) return;

        const collapsed = !!state.character.ui.textareaCollapse[id];
        target.hidden = collapsed;
        btn.textContent = collapsed ? "▸" : "▾";
        btn.setAttribute("aria-expanded", (!collapsed).toString());

        if (btn.dataset.boundCollapse === "1") return;
        btn.dataset.boundCollapse = "1";

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const currentTarget = document.getElementById(id);
            if (!currentTarget) return;

            const nowCollapsed = !currentTarget.hidden;
            currentTarget.hidden = nowCollapsed;

            state.character.ui.textareaCollapse[id] = nowCollapsed;
            btn.textContent = nowCollapsed ? "▸" : "▾";
            btn.setAttribute("aria-expanded", (!nowCollapsed).toString());

            SaveManager?.markDirty?.();
        });
    });
}
