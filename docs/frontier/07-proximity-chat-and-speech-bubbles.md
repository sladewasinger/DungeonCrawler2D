# Spec 07 — Proximity Chat & Overhead Speech Bubbles

> **Touchpoints**:
> `@dc2d/engine` (`src/net/chatSchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/chat/proximityChat.ts`, `src/sim/worldSim.ts`, `src/net/wsServer.ts`, `src/net/snapshotFilter.ts`),
> `@dc2d/client` (`src/render/world/chat/playerSpeechBubble.ts`, `src/render/world/playerSprite.ts`, `src/ui/chat/chatOverlay.ts`, `src/ui/chat/chatStyles.ts`, `src/main.ts`, `src/net/worldClient.ts`).

---

## 1. Proximity Rules & Wire Protocol

Per design decision: **chat appears in overhead bubbles and nearby feed only**, keeping exploration intimate and encouraging players to stick together or shout across clearings:

- **Ranges**:
  - **Normal Speak**: `16` tiles Euclidean radius (`PROXIMITY_CHAT_RADIUS = 16`).
  - **Shout**: `34` tiles Euclidean radius (`PROXIMITY_SHOUT_RADIUS = 34`), triggered automatically when message starts with `!` or `/shout ` (or toggling the Shout button in the chat bar).
- **Sanitization & Rate Limit (`ProximityChatManager`)**:
  - Trims whitespace, strips control chars, enforces `1..120` character length.
  - Rate limit: max `4` messages per `5s` rolling window per player.
- **Protocol (`chatSchemas.ts`)**:
  - Client -> Server: `ClientChatSchema`: `{ t: "chat", text: string, shout?: boolean, seq?: number }`.
  - Server -> Client:
    - `PlayerSnapshot.activeBubble?: { text: string; shout?: boolean; remainingSec: number }` (active for `5.5s`, filtered by proximity in `snapshotFilter.ts` so distant players outside hear-range do not receive bubble text).
    - `ServerSnapshot.chatMessages?: ChatEntry[]` delivering newly emitted messages within hear-range to recipients on that tick.

---

## 2. Overhead World-Space Speech Bubbles (`playerSpeechBubble.ts`)

- Mounted directly inside `PlayerView` above `this.label` (the player name tag), automatically shifting upward when the HP bar is visible so nothing overlaps.
- **Visual Design**:
  - Crisp pixel-framed dark slate rounded pill (`rgba(15, 23, 42, 0.9)`) with `1px` border (`#94a3b8` normal, `#fbbf24` golden border + `"!"` accent for Shout) and a small downward speech tail pointing to the speaker's head.
  - Word-wrapped monospace/pixel text (`maxWidth: 136px`, up to `3` lines), crisp resolution matching the PixiJS world stage.
  - Smooth scale-in pop (`0.12s`) and fade-out during final `0.6s` of `remainingSec`.
  - Properly destroys replaced/expired `Text` and `Graphics` (`destroy(true)`) per `docs/LESSONS.md`.

---

## 3. Compact Chat Input & Fading Feed (`chatOverlay.ts`)

- **Desktop**: Pressing `Enter` opens/focuses the compact bottom-left chat input bar (above the hotbar, clear of the vertical stamina bar); pressing `Enter` sends and blurs back to gameplay; `Escape` cancels cleanly. While focused, movement/hotbar/combat hotkeys are paused so typing `"wasd"` doesn't walk into a cliff!
- **Mobile**: A subtle chat-bubble icon button (`💬`) sits unobtrusively on the HUD, tapping it opens the compact input bar with an optional `Shout` toggle pill.
- **Nearby Feed**: Displays up to `4` recent nearby messages (`Sender: text`), each fading out automatically after `8s` so the screen stays completely clean when nobody is talking.
- **Offline Preview Parity**: When disconnected (`Local` mode), sending a message still renders your own overhead speech bubble and feed locally so players can test/enjoy it offline too.
