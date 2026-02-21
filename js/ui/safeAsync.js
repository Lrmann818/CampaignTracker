export const safeAsync = (fn, onErr) =>
  (...args) => Promise.resolve(fn(...args)).catch(onErr);
