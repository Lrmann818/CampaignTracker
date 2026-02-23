// Shared search matching helpers for tracker cards.

/**
 * Build a case-insensitive "any field includes query" matcher.
 *
 * @param {string[]} fields
 * @returns {(item: any, q: any) => boolean}
 */
export function makeFieldSearchMatcher(fields) {
  const fieldList = Array.isArray(fields) ? fields : [];
  return (item, q) => {
    if (!q) return true;
    const query = String(q).toLowerCase();
    if (!query) return true;
    if (!item) return false;
    return fieldList.some((field) => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    });
  };
}
