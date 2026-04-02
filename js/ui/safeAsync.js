// @ts-check

/**
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {(err: unknown) => void} onErr
 * @returns {(...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | void>}
 */
export const safeAsync = (fn, onErr) =>
  (...args) => Promise.resolve(fn(...args)).catch(onErr);
