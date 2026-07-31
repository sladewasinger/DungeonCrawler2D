export function requireOperationalEventPepper(
  tableName: string | undefined,
  pepper: string | undefined,
): string | undefined {
  if (!tableName?.trim()) return undefined;
  const configuredPepper = pepper?.trim();
  if (configuredPepper) return configuredPepper;
  throw new Error("OPERATIONAL_EVENT_PEPPER is required when OPERATIONAL_EVENT_TABLE is configured");
}
