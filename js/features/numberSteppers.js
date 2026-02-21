// @ts-nocheck

export async function enhanceNumberSteppers(root = document) {
  const inputs = Array.from(root.querySelectorAll('input[type="number"]'));

  inputs.forEach((input) => {
    // Don't double-wrap
    if (input.closest(".numWrap")) return;

    // If you ever need to opt-out for a specific input:
    if (input.dataset.noStepper === "1") return;

    // Build wrapper
    const wrap = document.createElement("div");
    wrap.className = "numWrap";

    const stepper = document.createElement("div");
    stepper.className = "numStepper";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "numStepBtn";
    up.setAttribute("aria-label", "Increase");
    up.textContent = "▲";

    const down = document.createElement("button");
    down.type = "button";
    down.className = "numStepBtn";
    down.setAttribute("aria-label", "Decrease");
    down.textContent = "▼";

    stepper.appendChild(up);
    stepper.appendChild(down);

    // Insert wrap around input (without losing listeners)
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(stepper);

    const pokeInput = () => {
      // Trigger the same input listeners used by bindNumber/save wiring.
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    up.addEventListener("click", () => {
      input.stepUp();
      pokeInput();
    });

    down.addEventListener("click", () => {
      input.stepDown();
      pokeInput();
    });
  });
}
