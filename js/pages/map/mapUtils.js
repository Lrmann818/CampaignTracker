// js/pages/map/mapUtils.js

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function colorFromKey(key) {
  switch (key) {
    case "teal": return "rgba(53, 208, 214, 0.85)";
    case "red": return "rgba(224, 75, 75, 0.85)";
    case "blue": return "rgba(58, 166, 255, 0.85)";
    case "green": return "rgba(52, 201, 123, 0.85)";
    case "yellow": return "rgba(242, 201, 76, 0.85)";
    case "purple": return "rgba(155, 123, 255, 0.85)";
    case "black": return "rgba(17, 17, 17, 0.85)";
    case "white": return "rgba(240, 240, 240, 0.85)";
    default: return "rgba(140, 140, 140, 0.85)";
  }
}