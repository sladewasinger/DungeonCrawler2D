// Rotating line pools for the system-voice announcer — dry, menacing, PG-13
// snark in the books' AI-broadcast tone; never punches at real people.

export type JoinLine = (name: string, ordinal: number) => string;
export type DeathLine = (name: string) => string;
export type LevelLine = (name: string, level: number) => string;
export type KillLine = (name: string, count: number) => string;
export type FistbumpLine = (a: string, b: string) => string;
export type TorchLine = (name: string) => string;

export const JOIN_LINES: readonly JoinLine[] = [
  (_name, ordinal) => `Crawler #${ordinal} has entered Floor 1. Odds of survival have been posted.`,
  (name) => `${name} joins the dungeon. The house always has an edge.`,
  (name, ordinal) => `Crawler #${ordinal}, designation ${name}, has arrived. Sponsors, place your bets.`,
  (name) => `${name} steps in. Something in the dark just perked up.`,
];

export const DEATH_LINES: readonly DeathLine[] = [
  (name) => `${name} has died. The audience rates it a 6 out of 10.`,
  (name) => `${name} is no more. Efficient, if uninspired.`,
  (name) => `${name} has been recycled into the dungeon's ecosystem.`,
  (name) => `${name}'s run ends here. A moment of silence — thirty seconds, sponsored.`,
];

/** Chasm falls get their own pool — the drop is the punchline, not the killer. */
export const CHASM_DEATH_LINES: readonly DeathLine[] = [
  (name) => `${name} found the floor was optional. It was not.`,
  (name) => `${name} took the express route down. No survivors on record.`,
  (name) => `The dungeon swallowed ${name} whole. It does that.`,
];

export const LEVEL_UP_LINES: readonly LevelLine[] = [
  (name, level) => `${name} reaches Level ${level}. The audience is mildly impressed.`,
  (name, level) => `Level ${level} for ${name}. Somewhere, a sponsor nods.`,
  (name, level) => `${name} levels up to ${level}. Still not enough to matter, probably.`,
];

export const KILL_MILESTONE_LINES: readonly KillLine[] = [
  (name, count) => `${name} has logged ${count} kills. The dungeon keeps better count.`,
  (name, count) => `${count} kills for ${name}. Someone's angling for a sponsor.`,
  (name, count) => `${name} racks up kill #${count}. Efficient. Almost professional.`,
];

export type PersonalKillLine = (verbPhrase: string) => string;

/**
 * Killer-only lines (panel round 2 BOOKFAN) — a distinct pool from
 * KILL_MILESTONE_LINES above: these fire on every attributed kill, not
 * just milestone counts, and are delivered privately to the killer
 * (never broadcast). `verbPhrase` comes from killLine.ts's active-voice
 * transform of the enemy's content epithet.
 */
export const PERSONAL_KILL_LINES: readonly PersonalKillLine[] = [
  (verbPhrase) => `${verbPhrase}.`,
  (verbPhrase) => `${verbPhrase}. Nobody else needs to know.`,
  (verbPhrase) => `${verbPhrase}. The dungeon's tally updates quietly.`,
];

export const FISTBUMP_LINES: readonly FistbumpLine[] = [
  (a, b) => `${a} and ${b} form an alliance. How adorable.`,
  (a, b) => `${a} and ${b} are now allies. The dungeon appreciates a bigger meal.`,
];

export const FIRST_TORCH_LINES: readonly TorchLine[] = [
  (name) => `${name} throws their first torch. Fire: humanity's greatest hit.`,
  (name) => `${name} learns to throw a torch. The dark takes note.`,
];

/**
 * Epic 7.14 (The Descent) — one authored line per floor (indexed
 * `floor - 1`), not a rotating pool: a floor's identity should read the
 * same every time you arrive, escalating menace 1 -> 5.
 */
export const FLOOR_ENTRY_LINES: readonly string[] = [
  "Floor 1. Try not to die.",
  "Floor 2. The slimes here have opinions.",
  "Floor 3. It gets warmer wherever the blood pools.",
  "Floor 4. Whatever's down here has had time to think about you.",
  "Floor 5. The Warden is expecting you.",
];

export type SimpleLine = () => string;

export const BOSS_INTRO_LINES: readonly SimpleLine[] = [
  () => "The Warden of Five rises. Sponsors, place your final bets.",
  () => "Something ancient and irritated notices you've arrived. The Warden of Five.",
];

export const BOSS_KILL_LINES: readonly SimpleLine[] = [
  () => "The Warden of Five falls. The dungeon groans in disappointment — and pays out anyway.",
  () => "Five floors of buildup, ended in one undignified heap. The Warden of Five is dead.",
];
