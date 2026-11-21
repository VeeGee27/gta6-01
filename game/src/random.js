// A small seeded random number generator: the same seed always gives the same
// sequence, which is what makes the city layout and the screenshot scenes repeatable.
// Seeded at boot from the URL (?seed=N) or from Math.random when no seed is given.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function range(min, max) {
    return min + next() * (max - min);
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  function int(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  }
  return { next, range, pick, int };
}
