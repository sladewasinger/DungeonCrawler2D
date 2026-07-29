import roomTuning from "./roomTuning.json" with { type: "json" };

/** Editable dimensions and spacing for reserved personal, party, safe, and spawn rooms. */
export const ROOM_TUNING = roomTuning;
export const ROOM_SLOT_STRIDE_CHUNKS = ROOM_TUNING.slotStrideChunks;
