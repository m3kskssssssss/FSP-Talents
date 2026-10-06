import seedrandom from "seedrandom";

/** Deterministic RNG: one seed -> one and the same variant, everywhere. */
export class Rng {
  private next: () => number;
  constructor(public readonly seed: string) {
    this.next = seedrandom(seed);
  }
  float() {
    return this.next();
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: readonly T[]): T {
    if (!arr.length) throw new Error("pick from empty array");
    return arr[Math.floor(this.next() * arr.length)]!;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }
  /** k distinct elements. */
  sample<T>(arr: readonly T[], k: number): T[] {
    return this.shuffle(arr).slice(0, k);
  }
  bool(p = 0.5) {
    return this.next() < p;
  }
  /** Normal(0,1) via Box-Muller. */
  normal() {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Child RNG with a derived seed (independent stream). */
  fork(label: string) {
    return new Rng(`${this.seed}/${label}`);
  }
  token(len = 6) {
    const abc = "abcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += abc[this.int(0, abc.length - 1)];
    return s;
  }
}
