/** Zod schemas for persistent POI discovery progress and Waystone-revealed beacons. */
import { z } from "zod";

export const RevealedBeaconSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

export type RevealedBeacon = z.infer<typeof RevealedBeaconSchema>;

export const DiscoveryStateSchema = z.object({
  discoveredPoiIds: z.array(z.string().min(1)),
  discoveredPoiKinds: z.array(z.string().min(1)),
  revealedBeacons: z.array(RevealedBeaconSchema),
});

export type DiscoveryStateSnapshot = z.infer<typeof DiscoveryStateSchema>;
