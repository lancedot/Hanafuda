export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
  }

  int(min: number, maxInclusive: number): number {
    const r = this.next();
    return min + Math.floor(r * (maxInclusive - min + 1));
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, Math.max(0, items.length - 1))];
  }

  shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function weightedSampleNoRepeat<T>(
  rng: SeededRng,
  items: T[],
  getWeight: (item: T) => number,
  count: number,
): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length > 0 && out.length < count) {
    const total = pool.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);
    if (total <= 0) break;
    const r = rng.next() * total;
    let acc = 0;
    let selectedIndex = 0;
    for (let i = 0; i < pool.length; i += 1) {
      acc += Math.max(0, getWeight(pool[i]));
      if (r <= acc) {
        selectedIndex = i;
        break;
      }
    }
    out.push(pool[selectedIndex]);
    pool.splice(selectedIndex, 1);
  }
  return out;
}
