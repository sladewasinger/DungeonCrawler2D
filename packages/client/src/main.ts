/** Entry point for the mobile-first PixiJS v8 overworld client. */
import { OVERWORLD_ENGINE_READY } from "@dc2d/engine";
import { OVERWORLD_CONTENT_READY } from "@dc2d/content";

export const CLIENT_BOOT_READY = OVERWORLD_ENGINE_READY && OVERWORLD_CONTENT_READY;
