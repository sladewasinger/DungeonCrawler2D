const GREETINGS = [
  (name: string) => `Hello, Crawler ${name}!`,
  (name: string) => `Welcome, ${name}. Remember, no fighting!`,
  (name: string) => `Good to see you, ${name}. Rest while you can.`,
] as const;

export function foodAttendantGreeting(name: string, roll: number): string {
  const index = Math.min(GREETINGS.length - 1, Math.floor(roll * GREETINGS.length));
  const greeting = GREETINGS[index] ?? ((crawler: string) => `Hello, Crawler ${crawler}!`);
  return greeting(name);
}
