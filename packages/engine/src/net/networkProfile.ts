import { z } from "zod";

/** Optional transport profile. Omission is the established standard cadence. */
export const networkProfileSchema = z.literal("corpnet");
export type NetworkProfile = z.infer<typeof networkProfileSchema>;

/** Stops carrying stale held controls when an inspected link stops delivering input. */
export const CORPNET_INPUT_LEASE_TICKS = 15;

/** Stops normal movement after a client main-thread or transport stall. */
export const STANDARD_INPUT_LEASE_TICKS = 15;

/** Authenticated selection; `null` restores the established standard cadence. */
export const clientNetworkProfileSchema = z.object({
  type: z.literal("networkProfile"),
  profile: networkProfileSchema.nullable(),
});
