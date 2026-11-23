/** Form section builders for each configurable rig tab in the Sandbox Pose Tuner. */
import { getPoseTuning } from "../../render/poseTuning/poseTuningStore.js";
import type {
  BodyKind, BowAimDirTune, FreeArmDirTune, LeftCarryDirTune, RightCarryDirTune,
} from "../../render/poseTuning/poseTuningTypes.js";
import { makeCheckRow, makePillGroup, makeSliderRow, ptNode } from "./poseTunerControls.js";

export type TuneTab = "freeLeft" | "freeRight" | "sword" | "lantern" | "bow";

export interface SectionRenderCtx {
  readonly body: BodyKind;
  readonly dirIdx: number;
  readonly tab: TuneTab;
  readonly syncCardinalLR: boolean;
  readonly onToggleSyncLR: (checked: boolean) => void;
}

interface SliderSpec<T> { readonly key: keyof T; readonly label: string; readonly min: number; readonly max: number; readonly step: number; }
interface CheckSpec<T> { readonly key: keyof T; readonly label: string; }

const CLS_CHECKS = "pt-checks";

const FREE_SLIDERS: readonly SliderSpec<FreeArmDirTune>[] = [
  { key: "sxOff", label: "Shoulder X", min: -2, max: 2, step: 0.05 },
  { key: "syOff", label: "Shoulder Y", min: -2, max: 2, step: 0.05 },
  { key: "txOff", label: "Target X", min: -4, max: 4, step: 0.05 },
  { key: "tyOff", label: "Target Y", min: 1, max: 9, step: 0.05 },
  { key: "maxBendRad", label: "Elbow Flare", min: 0.01, max: 1.2, step: 0.02 },
];

const FREE_CHECKS: readonly CheckSpec<FreeArmDirTune>[] = [
  { key: "upperBehind", label: "Upper Behind" },
  { key: "foreBehind", label: "Fore Behind" },
  { key: "handBehind", label: "Hand Behind" },
  { key: "shaded", label: "Shaded" },
  { key: "taper", label: "Taper" },
];

const SWORD_SLIDERS: readonly SliderSpec<RightCarryDirTune>[] = [
  { key: "x", label: "Weapon X", min: -8, max: 8, step: 0.1 },
  { key: "y", label: "Weapon Y", min: -18, max: 0, step: 0.1 },
  { key: "rot", label: "Angle (rad)", min: -3.14, max: 3.14, step: 0.02 },
  { key: "maxBendRad", label: "Arm Bend", min: 0.02, max: 1.0, step: 0.02 },
];

const SWORD_CHECKS: readonly CheckSpec<RightCarryDirTune>[] = [
  { key: "behind", label: "Weapon Behind" },
  { key: "armBehind", label: "Arm Behind" },
  { key: "armShaded", label: "Arm Shaded" },
  { key: "armTaper", label: "Arm Taper" },
];

const LANTERN_SLIDERS: readonly SliderSpec<LeftCarryDirTune>[] = [
  { key: "x", label: "Lantern X", min: -8, max: 8, step: 0.1 },
  { key: "y", label: "Lantern Y", min: -18, max: 0, step: 0.1 },
  { key: "rot", label: "Tilt (rad)", min: -1.5, max: 1.5, step: 0.02 },
  { key: "maxBendRad", label: "Arm Bend", min: 0.02, max: 1.0, step: 0.02 },
];

const LANTERN_CHECKS: readonly CheckSpec<LeftCarryDirTune>[] = [
  { key: "behind", label: "Lantern Behind" },
  { key: "armBehind", label: "Arm Behind" },
  { key: "armShaded", label: "Arm Shaded" },
  { key: "armTaper", label: "Arm Taper" },
];

const BOW_SLIDERS: readonly SliderSpec<BowAimDirTune>[] = [
  { key: "radiusX", label: "Reach X", min: 2, max: 12, step: 0.1 },
  { key: "centerY", label: "Pivot Y", min: -18, max: -6, step: 0.1 },
  { key: "radiusY", label: "Reach Y", min: 1, max: 10, step: 0.1 },
  { key: "offsetX", label: "Offset X", min: -5, max: 5, step: 0.1 },
  { key: "offsetY", label: "Offset Y", min: -5, max: 5, step: 0.1 },
  { key: "drawPull", label: "Draw Pull", min: 0, max: 8, step: 0.1 },
  { key: "gripMaxBendRad", label: "Grip Bend", min: 0.02, max: 1.0, step: 0.02 },
  { key: "drawMaxBendRad", label: "Draw Bend", min: 0.02, max: 1.2, step: 0.02 },
];

const BOW_CHECKS: readonly CheckSpec<BowAimDirTune>[] = [
  { key: "behindBody", label: "Bow Behind" },
  { key: "bowArmBehind", label: "Grip Arm Behind" },
  { key: "drawArmBehind", label: "Draw Arm Behind" },
  { key: "drawArmOverWeapon", label: "Draw Over Bow" },
];

const BEND_ITEMS: readonly { readonly id: -1 | 0 | 1; readonly label: string }[] = [
  { id: 0, label: "Auto" }, { id: 1, label: "+1" }, { id: -1, label: "-1" },
];

const SIGN_ITEMS: readonly { readonly id: -1 | 1; readonly label: string }[] = [
  { id: 1, label: "+1" }, { id: -1, label: "-1" },
];

function bindSliders<T extends Record<string, unknown>>(opts: {
  readonly host: HTMLElement; readonly target: T; readonly mirror: T | undefined; readonly specs: readonly SliderSpec<T>[];
}): void {
  const { host, target, mirror, specs } = opts;
  for (const sp of specs) {
    const k = sp.key;
    host.append(makeSliderRow({
      label: sp.label, min: sp.min, max: sp.max, step: sp.step, value: Number(target[k]),
      onChange: (v) => { target[k] = v as T[keyof T]; if (mirror) mirror[k] = v as T[keyof T]; },
    }));
  }
}

function bindChecks<T extends Record<string, unknown>>(opts: {
  readonly host: HTMLElement; readonly target: T; readonly mirror: T | undefined; readonly specs: readonly CheckSpec<T>[];
}): void {
  const { host, target, mirror, specs } = opts;
  const grid = ptNode("div", CLS_CHECKS);
  for (const sp of specs) {
    const k = sp.key;
    grid.append(makeCheckRow({
      label: sp.label, checked: Boolean(target[k]),
      onChange: (v) => { target[k] = v as T[keyof T]; if (mirror) mirror[k] = v as T[keyof T]; },
    }));
  }
  host.append(grid);
}

function renderFreeArmSection(host: HTMLElement, ctx: SectionRenderCtx, onRedraw: () => void): void {
  const tune = getPoseTuning(ctx.body);
  const isLeft = ctx.tab === "freeLeft";
  const target = (isLeft ? tune.freeLeft : tune.freeRight)[ctx.dirIdx];
  const opp = (isLeft ? tune.freeRight : tune.freeLeft)[ctx.dirIdx];
  if (!target) return;
  const isCardinal = ctx.dirIdx === 0 || ctx.dirIdx === 4;
  if (isCardinal) {
    host.append(makeCheckRow({ label: "Sync L & R Cardinal", checked: ctx.syncCardinalLR, onChange: ctx.onToggleSyncLR }));
  }
  const mirror = isCardinal && ctx.syncCardinalLR ? opp : undefined;
  host.append(makePillGroup({
    label: "Elbow Bend Dir", items: BEND_ITEMS, active: target.bendSign,
    onSelect: (id) => {
      target.bendSign = id;
      if (mirror) mirror.bendSign = id === 0 ? 0 : (-id as -1 | 1);
      onRedraw();
    },
  }));
  bindSliders({ host, target: target as unknown as Record<string, unknown>, mirror: mirror as unknown as Record<string, unknown> | undefined, specs: FREE_SLIDERS as unknown as SliderSpec<Record<string, unknown>>[] });
  bindChecks({ host, target: target as unknown as Record<string, unknown>, mirror: mirror as unknown as Record<string, unknown> | undefined, specs: FREE_CHECKS as unknown as CheckSpec<Record<string, unknown>>[] });
}

function renderSwordSection(host: HTMLElement, ctx: SectionRenderCtx, onRedraw: () => void): void {
  const sw = getPoseTuning(ctx.body).sword[ctx.dirIdx];
  if (!sw) return;
  host.append(makePillGroup({
    label: "Sprite Flip X", items: SIGN_ITEMS, active: sw.scaleSign,
    onSelect: (id) => { sw.scaleSign = id; onRedraw(); },
  }));
  host.append(makePillGroup({
    label: "Walk Sway Sign", items: SIGN_ITEMS, active: sw.rotSign,
    onSelect: (id) => { sw.rotSign = id; onRedraw(); },
  }));
  bindSliders({ host, target: sw as unknown as Record<string, unknown>, mirror: undefined, specs: SWORD_SLIDERS as unknown as SliderSpec<Record<string, unknown>>[] });
  bindChecks({ host, target: sw as unknown as Record<string, unknown>, mirror: undefined, specs: SWORD_CHECKS as unknown as CheckSpec<Record<string, unknown>>[] });
}

function renderLanternSection(host: HTMLElement, ctx: SectionRenderCtx): void {
  const lt = getPoseTuning(ctx.body).lantern[ctx.dirIdx];
  if (!lt) return;
  bindSliders({ host, target: lt as unknown as Record<string, unknown>, mirror: undefined, specs: LANTERN_SLIDERS as unknown as SliderSpec<Record<string, unknown>>[] });
  bindChecks({ host, target: lt as unknown as Record<string, unknown>, mirror: undefined, specs: LANTERN_CHECKS as unknown as CheckSpec<Record<string, unknown>>[] });
}

function renderBowSection(host: HTMLElement, ctx: SectionRenderCtx): void {
  const bw = getPoseTuning(ctx.body).bow[ctx.dirIdx];
  if (!bw) return;
  bindSliders({ host, target: bw as unknown as Record<string, unknown>, mirror: undefined, specs: BOW_SLIDERS as unknown as SliderSpec<Record<string, unknown>>[] });
  bindChecks({ host, target: bw as unknown as Record<string, unknown>, mirror: undefined, specs: BOW_CHECKS as unknown as CheckSpec<Record<string, unknown>>[] });
}

export function renderTuneFields(host: HTMLElement, ctx: SectionRenderCtx, onRedraw: () => void): void {
  host.replaceChildren();
  if (ctx.tab === "freeLeft" || ctx.tab === "freeRight") { renderFreeArmSection(host, ctx, onRedraw); return; }
  if (ctx.tab === "sword") { renderSwordSection(host, ctx, onRedraw); return; }
  if (ctx.tab === "lantern") { renderLanternSection(host, ctx); return; }
  renderBowSection(host, ctx);
}
