import { Rng } from "../testing/rng";

/**
 * FSP registry integration. The real API is not available for the case, so
 * the platform talks to an interface; `MockFspRegistry` returns a synthetic
 * but structurally faithful registry record (competition -> discipline ->
 * stage -> place / rating / sports category). See docs/fsp-integration.md.
 */
export interface FspRegistryAchievement {
  registryId: string;
  competition: string;
  discipline: "алгоритмическое" | "продуктовое" | "ИБ" | "робототехника" | "БАС";
  stage: "regional" | "district" | "final";
  year: number;
  place: number | null;
  rank: number | null;
  teamName: string | null;
}

export interface FspPerson {
  fspId: string;
  fullName: string;
  region: string;
  sportsCategory: string | null;
  rating: number;
  achievements: FspRegistryAchievement[];
}

export interface FspRegistry {
  readonly name: string;
  /** null = no such person; throws FspRegistryUnavailable when the registry is down. */
  lookup(fspId: string): Promise<FspPerson | null>;
}

export class FspRegistryUnavailable extends Error {
  constructor() {
    super("Реестр ФСП временно недоступен");
  }
}

export const FSP_ID_RE = /^FSP-\d{6}$/;

const COMPETITIONS: { name: string; discipline: FspRegistryAchievement["discipline"] }[] = [
  { name: "Чемпионат России по спортивному программированию", discipline: "алгоритмическое" },
  { name: "Кубок России по продуктовому программированию", discipline: "продуктовое" },
  { name: "Всероссийские соревнования по программированию систем ИБ", discipline: "ИБ" },
  { name: "Первенство России по программированию робототехники", discipline: "робототехника" },
  { name: "Соревнования по программированию беспилотных авиационных систем", discipline: "БАС" },
];
const REGIONS = ["Москва", "Санкт-Петербург", "Республика Татарстан", "Новосибирская область", "Свердловская область", "Томская область"];
const CATEGORIES = [null, null, "3-й разряд", "2-й разряд", "1-й разряд", "КМС", "МС"];

export class MockFspRegistry implements FspRegistry {
  readonly name = "mock";
  async lookup(fspId: string): Promise<FspPerson | null> {
    if (!FSP_ID_RE.test(fspId)) return null;
    // Documented demo behaviours: *999 -> registry outage, *000 -> unknown person.
    if (fspId.endsWith("999")) throw new FspRegistryUnavailable();
    if (fspId.endsWith("000")) return null;
    const rng = new Rng(`fsp-registry/${fspId}`);
    const strength = rng.float();
    const year = new Date().getFullYear();
    const n = rng.int(1, 5);
    const achievements = Array.from({ length: n }, (_, i) => {
      const c = rng.pick(COMPETITIONS);
      const stage = rng.pick(["regional", "regional", "district", "final"] as const);
      const placed = rng.float() < 0.25 + strength * 0.5;
      return {
        registryId: `${fspId}/${year - (i % 4)}/${i + 1}`,
        competition: c.name,
        discipline: c.discipline,
        stage,
        year: year - (i % 4),
        place: placed ? rng.int(1, 10) : null,
        rank: placed ? null : rng.int(15, 300),
        teamName: c.discipline === "продуктовое" ? `Команда ${rng.token(4).toUpperCase()}` : null,
      };
    });
    return {
      fspId,
      fullName: "",
      region: rng.pick(REGIONS),
      sportsCategory: CATEGORIES[Math.min(CATEGORIES.length - 1, Math.floor(strength * CATEGORIES.length))] ?? null,
      rating: Math.round(1000 + strength * 1500),
      achievements,
    };
  }
}

let registry: FspRegistry = new MockFspRegistry();
export const getFspRegistry = () => registry;
export const setFspRegistryForTests = (r: FspRegistry) => (registry = r);
