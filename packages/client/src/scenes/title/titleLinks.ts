import { APP_VERSION } from "../../appVersion.js";
import { RELEASE_NOTES_INDEX_PATH } from "../../releaseNotesUrl.js";
import { spectatorUrl } from "../../spectator/spectatorUrl.js";

const LINK_FONT = "monogram,monospace";

export function createReleaseNotesLink(): HTMLAnchorElement {
  const releaseNotes = document.createElement("a");
  releaseNotes.href = RELEASE_NOTES_INDEX_PATH;
  releaseNotes.textContent = `Release Notes · v${APP_VERSION}`;
  releaseNotes.style.cssText =
    `color:#c4c4d0;font:16px ${LINK_FONT};text-underline-offset:3px;pointer-events:auto`;
  releaseNotes.setAttribute("aria-label", `Read release notes for version ${APP_VERSION}`);
  return releaseNotes;
}

export function createSpectatorLink(): HTMLAnchorElement {
  const spectator = document.createElement("a");
  spectator.href = spectatorUrl(window.location.search);
  spectator.textContent = "Watch live";
  spectator.style.cssText =
    `color:#ffd23d;font:18px ${LINK_FONT};text-underline-offset:3px;pointer-events:auto`;
  spectator.setAttribute("aria-label", "Watch connected players");
  return spectator;
}
