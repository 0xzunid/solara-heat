// Seeded randomness for SOLARA HEAT: one mulberry32 stream per world, so a
// ?shot= scene (and a ?seed= play session) stages the same city every time.
// Nothing here touches the network or the DOM.

/** A small, fast, seedable PRNG. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
  };
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle `from` toward angle `to`. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when (x, y) lies on a road of the city grid. */
export function onRoad(x, y) {
  const half = 70;
  for (const rx of [300, 900, 1500, 2100, 2700, 3300]) {
    if (Math.abs(x - rx) <= half && y >= 0 && y <= 2460) return true;
  }
  for (const ry of [300, 850, 1400, 1950, 2350]) {
    if (Math.abs(y - ry) <= half && x >= 0 && x <= 3600) return true;
  }
  return false;
}
