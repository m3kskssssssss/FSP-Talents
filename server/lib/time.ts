export const DAY_MS = 24 * 60 * 60 * 1000;
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
