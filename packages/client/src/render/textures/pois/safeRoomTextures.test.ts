/** Unit tests verifying Sanctuary Hub PropKind texture registration and PROP_SPECS parity [REQ-P9-15]. */
import { PROP_SPECS } from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROP_RENDER_KINDS } from "../propTextures.js";
import { SAFE_ROOM_PROP_KINDS } from "./safeRoomTextures.js";

describe("[REQ-P9-15] Hub & Safe-Room prop integrity", () => {
  it("registers all 5 Sanctuary hub props in PROP_SPECS and REGISTERED_PROP_RENDER_KINDS", () => {
    expect(SAFE_ROOM_PROP_KINDS).toHaveLength(5);
    for (const kind of SAFE_ROOM_PROP_KINDS) {
      const spec = PROP_SPECS[kind];
      expect(spec?.kind).toBe(kind);
      expect(["circle", "aabb"]).toContain(spec?.collision.shape);
      expect(REGISTERED_PROP_RENDER_KINDS).toContain(kind);
    }
  });
});
