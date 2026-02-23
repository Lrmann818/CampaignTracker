/**
 * Shared file picker helper (single hidden <input type="file">).
 *
 * Reuses one hidden input and provides a Promise-based API.
 * Includes a cancel fallback because many browsers won't fire a "change" event
 * if the user hits Cancel.
 */

export function createFilePicker(defaults = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = defaults.accept || "image/*";
  input.multiple = !!defaults.multiple;
  input.style.display = "none";
  document.body.appendChild(input);

  // Serialize pick requests so callers can't race the same input.
  let tail = Promise.resolve();

  function _pickOnce(opts = {}) {
    const accept = typeof opts.accept === "string" ? opts.accept : (defaults.accept || "image/*");
    const multiple = typeof opts.multiple === "boolean" ? opts.multiple : !!defaults.multiple;

    input.accept = accept;
    input.multiple = multiple;
    input.value = "";

    return new Promise(resolve => {
      let settled = false;

      const cleanup = () => {
        input.removeEventListener("change", onChange);
        window.removeEventListener("focus", onFocus, true);
      };

      const finish = (files) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(files);
      };

      const onChange = () => {
        const list = Array.from(input.files || []);
        finish(list);
      };

      // Cancel fallback: after the picker closes, the window regains focus.
      // If no change happened, treat as cancel.
      const onFocus = () => {
        setTimeout(() => {
          if (settled) return;
          const list = Array.from(input.files || []);
          if (list.length === 0) finish([]);
        }, 250);
      };

      input.addEventListener("change", onChange, { once: true });
      window.addEventListener("focus", onFocus, true);

      input.click();
    });
  }

  async function pick(opts = {}) {
    tail = tail.then(() => _pickOnce(opts)).catch(() => []);
    return tail;
  }

  async function pickOne(opts = {}) {
    const files = await pick(opts);
    return files[0] || null;
  }

  return { pick, pickOne };
}
