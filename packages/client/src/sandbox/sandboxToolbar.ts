/** Top overlay toolbar for the localhost Asset & Enemy Sandbox (/?sandbox=1). */
import { domNode } from "../ui/hud/slotRenderer.js";
import type { SandboxFacing, SandboxPose } from "./sandboxAi.js";

const SANDBOX_CSS = `
.ow-sandbox-bar {
  position: fixed; top: 10px; left: 10px; right: 10px; z-index: 45;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 10px; border-radius: 12px;
  background: rgba(12, 18, 26, 0.88); backdrop-filter: blur(8px);
  border: 1px solid rgba(251, 191, 36, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.48);
  color: #f8fafc; font-size: 12px; pointer-events: auto;
}
.ow-sbx-title { font-weight: 900; color: #fde047; letter-spacing: 0.06em; padding-right: 4px; }
.ow-sbx-group { display: flex; align-items: center; gap: 3px; background: rgba(15, 23, 42, 0.8); padding: 2px 4px; border-radius: 8px; }
.ow-sbx-lbl { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; padding: 0 4px; }
.ow-sbx-btn {
  padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(30, 41, 59, 0.85); color: #e2e8f0; font-size: 11px; font-weight: 700; cursor: pointer;
}
.ow-sbx-btn:hover { background: rgba(51, 65, 85, 0.95); }
.ow-sbx-btn[data-active="true"] { background: #b45309; border-color: #fbbf24; color: #fefce8; }
.ow-sbx-link {
  margin-left: auto; padding: 4px 9px; border-radius: 999px; font-size: 11px; font-weight: 700;
  color: #7dd3fc; text-decoration: none; border: 1px solid rgba(56, 189, 248, 0.38); background: rgba(14, 116, 144, 0.24);
}
`;

export interface SandboxToolbarActions {
  readonly onToggleAi: () => void;
  readonly onWakeNearest: () => void;
  readonly onSpawnPack: () => void;
  readonly onSetPose: (pose: SandboxPose) => void;
  readonly onSetFacing: (facing: SandboxFacing) => void;
  readonly onSetDayPhase: (phase: number) => void;
  readonly onZoom: (factor: number) => void;
  readonly onJumpGallery: () => void;
  readonly onJumpTerrain: () => void;
  readonly onTogglePoseTuner: () => void;
  readonly onReset: () => void;
}

const POSES: readonly { readonly id: SandboxPose; readonly label: string }[] = [
  { id: "idle", label: "Idle" }, { id: "walk", label: "Walk" },
  { id: "run", label: "Run" }, { id: "windup", label: "Windup" }, { id: "corpse", label: "Corpse" },
];

const FACINGS: readonly { readonly id: SandboxFacing; readonly label: string }[] = [
  { id: "auto", label: "Auto" }, { id: "south", label: "S" },
  { id: "east", label: "E" }, { id: "west", label: "W" }, { id: "north", label: "N" },
];

const TIMES: readonly { readonly phase: number; readonly label: string }[] = [
  { phase: 0.23, label: "Dawn" }, { phase: 0.42, label: "Day" },
  { phase: 0.72, label: "Dusk" }, { phase: 0.95, label: "Night" },
];

const CLS_GROUP = "ow-sbx-group";

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = domNode("button", "ow-sbx-btn");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

function buildOptionGroup<T extends string>(opts: {
  readonly label: string;
  readonly items: readonly { readonly id: T; readonly label: string }[];
  readonly map: Map<T, HTMLButtonElement>;
  readonly onSelect: (id: T) => void;
}): HTMLDivElement {
  const grp = domNode("div", CLS_GROUP);
  const lbl = domNode("span", "ow-sbx-lbl");
  lbl.textContent = opts.label;
  grp.append(lbl);
  for (const item of opts.items) {
    const btn = makeBtn(item.label, () => opts.onSelect(item.id));
    opts.map.set(item.id, btn);
    grp.append(btn);
  }
  return grp;
}

export class SandboxToolbar {
  readonly el: HTMLDivElement;
  private readonly aiBtn: HTMLButtonElement;
  private readonly tunerBtn: HTMLButtonElement;
  private readonly poseBtns = new Map<SandboxPose, HTMLButtonElement>();
  private readonly facingBtns = new Map<SandboxFacing, HTMLButtonElement>();
  private readonly timeBtns: { readonly phase: number; readonly btn: HTMLButtonElement }[] = [];

  constructor(host: HTMLElement, actions: SandboxToolbarActions, spriteCount: number) {
    ensureSandboxStyles();
    this.el = domNode("div", "ow-sandbox-bar ow-hud");
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    const badge = domNode("span", "ow-sbx-title");
    badge.textContent = `SANDBOX (${spriteCount} PNGs)`;
    this.aiBtn = makeBtn("AI: Frozen", actions.onToggleAi);
    this.tunerBtn = makeBtn("Pose Tuner", actions.onTogglePoseTuner);
    const poseGrp = buildOptionGroup({ label: "Pose", items: POSES, map: this.poseBtns, onSelect: actions.onSetPose });
    const dirGrp = buildOptionGroup({ label: "Dir", items: FACINGS, map: this.facingBtns, onSelect: actions.onSetFacing });
    const titleLink = domNode("a", "ow-sbx-link");
    titleLink.href = "/";
    titleLink.textContent = "Back to Title";
    this.el.append(
      badge, this.aiBtn, makeBtn("Wake Nearest", actions.onWakeNearest), makeBtn("Spawn Wolf Pack", actions.onSpawnPack),
      poseGrp, dirGrp, this.buildTimeGroup(actions.onSetDayPhase),
      buildZoomGroup(actions.onZoom), buildJumpGroup(actions.onJumpGallery, actions.onJumpTerrain),
      this.tunerBtn, makeBtn("Reset Arena", actions.onReset), titleLink,
    );
    host.append(this.el);
  }

  private buildTimeGroup(onSetTime: (phase: number) => void): HTMLDivElement {
    const grp = domNode("div", CLS_GROUP);
    const lbl = domNode("span", "ow-sbx-lbl");
    lbl.textContent = "Time";
    grp.append(lbl);
    for (const t of TIMES) {
      const btn = makeBtn(t.label, () => onSetTime(t.phase));
      this.timeBtns.push({ phase: t.phase, btn });
      grp.append(btn);
    }
    return grp;
  }

  sync(opts: {
    readonly aiLive: boolean; readonly pose: SandboxPose; readonly facing: SandboxFacing;
    readonly dayPhase: number; readonly poseTunerOpen?: boolean | undefined;
  }): void {
    this.aiBtn.textContent = opts.aiLive ? "AI: Live" : "AI: Frozen";
    this.aiBtn.dataset.active = String(opts.aiLive);
    this.tunerBtn.dataset.active = String(Boolean(opts.poseTunerOpen));
    for (const [id, btn] of this.poseBtns) btn.dataset.active = String(!opts.aiLive && opts.pose === id);
    for (const [id, btn] of this.facingBtns) btn.dataset.active = String(!opts.aiLive && opts.facing === id);
    for (const t of this.timeBtns) t.btn.dataset.active = String(Math.abs(opts.dayPhase - t.phase) < 0.08);
  }
}

function buildZoomGroup(onZoom: (factor: number) => void): HTMLDivElement {
  const grp = domNode("div", CLS_GROUP);
  grp.append(makeBtn("-", () => onZoom(0.84)), makeBtn("+", () => onZoom(1.19)));
  return grp;
}

function buildJumpGroup(onGallery: () => void, onTerrain: () => void): HTMLDivElement {
  const grp = domNode("div", CLS_GROUP);
  grp.append(makeBtn("Gallery", onGallery), makeBtn("Terrain", onTerrain));
  return grp;
}

function ensureSandboxStyles(): void {
  if (document.getElementById("ow-sandbox-css")) return;
  const s = document.createElement("style");
  s.id = "ow-sandbox-css";
  s.textContent = SANDBOX_CSS;
  document.head.appendChild(s);
}
