/** Entry point placeholder updated cleanly during Stage 2 before Stage 3 renderer mount. */
import { CHUNK_SIZE } from "@dc2d/engine";
import { QUALITY_PRESETS } from "@dc2d/content";

export const CLIENT_CONFIG_READY = CHUNK_SIZE > 0 && Boolean(QUALITY_PRESETS.high);
