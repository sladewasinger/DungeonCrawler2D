/** Pixel-art 32x32 icon painters for frontier weapons, armor sets, shields, materials, and elixirs. */
import { fillCluster, fillEllipsePixel } from "../../render/textures/pixelCanvas.js";

type Painter = (ctx: CanvasRenderingContext2D, id: string) => void;
interface ArmorColorSpec { readonly base: string; readonly shade: string; readonly trim: string }

function paintBlade(ctx: CanvasRenderingContext2D, opts: { readonly blade: string; readonly edge: string; readonly hilt: string; readonly heavy?: boolean }): void {
  const w = opts.heavy ? 4 : 3;
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = i % 2 === 0 ? opts.edge : opts.blade;
    ctx.fillRect(21 - i, 6 + i, w, w);
  }
  ctx.fillStyle = opts.hilt;
  ctx.fillRect(7, 17, 7, 2);
  ctx.fillRect(10, 14, 2, 7);
  ctx.fillStyle = "#5c3317";
  ctx.fillRect(5, 22, 4, 4);
}

function paintSpear(ctx: CanvasRenderingContext2D, tip: string, shaft = "#7c4722"): void {
  for (let i = 0; i < 16; i++) { ctx.fillStyle = shaft; ctx.fillRect(6 + i, 23 - i, 2, 2); }
  ctx.fillStyle = tip; ctx.fillRect(19, 6, 6, 6);
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(22, 6, 3, 3);
}

function paintPick(ctx: CanvasRenderingContext2D, head: string, hi: string): void {
  for (let i = 0; i < 16; i++) { ctx.fillStyle = "#854d27"; ctx.fillRect(7 + i, 23 - i, 3, 3); }
  ctx.fillStyle = head; ctx.fillRect(12, 6, 11, 3); ctx.fillRect(10, 8, 4, 4); ctx.fillRect(21, 8, 4, 5);
  ctx.fillStyle = hi; ctx.fillRect(13, 6, 8, 2);
}

function paintHatchet(ctx: CanvasRenderingContext2D, opts: { readonly shaft: string; readonly blade: string; readonly hi: string }): void {
  for (let i = 0; i < 16; i++) { ctx.fillStyle = opts.shaft; ctx.fillRect(8 + i, 23 - i, 3, 3); }
  fillCluster(ctx, [{ cx: 20, cy: 11, rx: 5, ry: 5, color: opts.blade }, { cx: 22, cy: 10, rx: 2, ry: 4, color: opts.hi }]);
}

function paintRecurveBow(ctx: CanvasRenderingContext2D, opts: { readonly str: string; readonly limb: string; readonly arrow: string }): void {
  ctx.fillStyle = opts.str; ctx.fillRect(10, 6, 1, 20);
  const arc = [[10, 6], [13, 6], [16, 8], [18, 11], [19, 15], [18, 19], [16, 22], [13, 24], [10, 24]];
  for (const [x, y] of arc) { ctx.fillStyle = opts.limb; ctx.fillRect(x!, y!, 3, 2); }
  ctx.fillStyle = opts.arrow; ctx.fillRect(8, 15, 16, 2);
}

function paintArmorHead(ctx: CanvasRenderingContext2D, p: ArmorColorSpec): void {
  fillCluster(ctx, [{ cx: 16, cy: 15, rx: 8, ry: 9, color: p.base }, { cx: 16, cy: 17, rx: 4, ry: 5, color: "#1e293b" }]);
  ctx.fillStyle = p.trim; ctx.fillRect(11, 20, 10, 2);
}

function paintArmorLegs(ctx: CanvasRenderingContext2D, p: ArmorColorSpec): void {
  ctx.fillStyle = p.base; ctx.fillRect(9, 7, 14, 7); ctx.fillRect(9, 14, 6, 11); ctx.fillRect(17, 14, 6, 11);
  ctx.fillStyle = p.trim; ctx.fillRect(9, 7, 14, 2);
}

function paintArmorBoots(ctx: CanvasRenderingContext2D, p: ArmorColorSpec): void {
  ctx.fillStyle = p.base; ctx.fillRect(8, 10, 6, 14); ctx.fillRect(17, 10, 6, 14);
  ctx.fillStyle = p.shade; ctx.fillRect(8, 20, 8, 4); ctx.fillRect(17, 20, 8, 4);
  ctx.fillStyle = p.trim; ctx.fillRect(8, 10, 6, 2); ctx.fillRect(17, 10, 6, 2);
}

function paintArmorVariant(ctx: CanvasRenderingContext2D, id: string, p: ArmorColorSpec): void {
  if (/(hood|helm|cowl)$/.test(id)) { paintArmorHead(ctx, p); return; }
  if (/(leggings|greaves|legguards)$/.test(id)) { paintArmorLegs(ctx, p); return; }
  if (/(boots|sabatons)$/.test(id)) { paintArmorBoots(ctx, p); return; }
  ctx.fillStyle = p.base; ctx.fillRect(8, 7, 16, 17);
  ctx.fillStyle = p.shade; ctx.fillRect(8, 17, 16, 3);
  ctx.fillStyle = p.trim; ctx.fillRect(14, 17, 4, 3);
}

function paintGolemMaul(ctx: CanvasRenderingContext2D): void {
  paintPick(ctx, "#64748b", "#38bdf8");
  ctx.fillStyle = "#64748b";
  ctx.fillRect(15, 6, 10, 10);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(18, 9, 4, 4);
}

function paintShieldVariant(ctx: CanvasRenderingContext2D, opts: { readonly rim: string; readonly core: string; readonly boss: string }): void {
  fillCluster(ctx, [
    { cx: 16, cy: 15, rx: 9, ry: 10, color: opts.rim },
    { cx: 16, cy: 15, rx: 6, ry: 7, color: opts.core },
    { cx: 16, cy: 15, rx: 2, ry: 3, color: opts.boss },
  ]);
}

function paintIngot(ctx: CanvasRenderingContext2D, base: string, hi: string): void {
  ctx.fillStyle = base; ctx.fillRect(7, 13, 18, 8); ctx.fillRect(9, 10, 14, 4);
  ctx.fillStyle = hi; ctx.fillRect(10, 11, 10, 3);
}

function paintCrystal(ctx: CanvasRenderingContext2D, base: string, hi: string): void {
  ctx.fillStyle = base; ctx.fillRect(13, 6, 6, 18); ctx.fillRect(9, 12, 5, 11); ctx.fillRect(18, 13, 5, 10);
  ctx.fillStyle = hi; ctx.fillRect(14, 8, 3, 10);
}

function paintElixir(ctx: CanvasRenderingContext2D, liquid: string, glow: string): void {
  ctx.fillStyle = "#b45309"; ctx.fillRect(14, 6, 4, 3);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(13, 9, 6, 3);
  fillCluster(ctx, [{ cx: 16, cy: 18, rx: 7, ry: 7, color: liquid }, { cx: 14, cy: 16, rx: 3, ry: 3, color: glow }]);
}

export const FRONTIER_ITEM_PAINTERS: Readonly<Record<string, Painter>> = {
  "copper-pickaxe": (ctx) => paintPick(ctx, "#d97706", "#fcd34d"),
  "copper-axe": (ctx) => paintHatchet(ctx, { shaft: "#854d27", blade: "#d97706", hi: "#fcd34d" }),
  "copper-sword": (ctx) => paintBlade(ctx, { blade: "#d97706", edge: "#fcd34d", hilt: "#94a3b8" }),
  "copper-spear": (ctx) => paintSpear(ctx, "#d97706"),
  "bandit-cutlass": (ctx) => paintBlade(ctx, { blade: "#94a3b8", edge: "#f8fafc", hilt: "#dc2626" }),
  "bog-dagger": (ctx) => paintBlade(ctx, { blade: "#15803d", edge: "#4ade80", hilt: "#78350f" }),
  "amber-recurve-bow": (ctx) => paintRecurveBow(ctx, { str: "#fef3c7", limb: "#d97706", arrow: "#fbbf24" }),
  "frost-hatchet": (ctx) => paintHatchet(ctx, { shaft: "#475569", blade: "#60a5fa", hi: "#e0f2fe" }),
  "golem-maul": paintGolemMaul,
  "shadowfang-spear": (ctx) => paintSpear(ctx, "#a855f7", "#312e81"),
  "venom-fang-blade": (ctx) => paintBlade(ctx, { blade: "#16a34a", edge: "#86efac", hilt: "#a855f7" }),
  "sunforged-greatsword": (ctx) => paintBlade(ctx, { blade: "#f59e0b", edge: "#fef08a", hilt: "#ef4444", heavy: true }),
  "bloodmoon-scythe": (ctx) => paintBlade(ctx, { blade: "#dc2626", edge: "#fca5a5", hilt: "#7c3aed", heavy: true }),
  "whisperwind-bow": (ctx) => paintRecurveBow(ctx, { str: "#e0f2fe", limb: "#38bdf8", arrow: "#fde047" }),
  "reinforced-shield": (ctx) => paintShieldVariant(ctx, { rim: "#d97706", core: "#7c4722", boss: "#fcd34d" }),
  "runic-buckler": (ctx) => paintShieldVariant(ctx, { rim: "#64748b", core: "#334155", boss: "#38bdf8" }),
  "aegis-tower-shield": (ctx) => paintShieldVariant(ctx, { rim: "#f59e0b", core: "#475569", boss: "#fef08a" }),
  "moss-stalker-hood": (ctx, id) => paintArmorVariant(ctx, id, { base: "#3f6b3a", shade: "#284726", trim: "#84cc16" }),
  "moss-stalker-tunic": (ctx, id) => paintArmorVariant(ctx, id, { base: "#3f6b3a", shade: "#284726", trim: "#84cc16" }),
  "moss-stalker-leggings": (ctx, id) => paintArmorVariant(ctx, id, { base: "#335730", shade: "#20381e", trim: "#86efac" }),
  "moss-stalker-boots": (ctx, id) => paintArmorVariant(ctx, id, { base: "#2b4728", shade: "#1b2e19", trim: "#65a30d" }),
  "autumn-ranger-hood": (ctx, id) => paintArmorVariant(ctx, id, { base: "#9a4a24", shade: "#6e3115", trim: "#fbbf24" }),
  "autumn-ranger-tunic": (ctx, id) => paintArmorVariant(ctx, id, { base: "#914320", shade: "#652c13", trim: "#f59e0b" }),
  "autumn-ranger-leggings": (ctx, id) => paintArmorVariant(ctx, id, { base: "#7c3a1c", shade: "#542511", trim: "#fde68a" }),
  "autumn-ranger-boots": (ctx, id) => paintArmorVariant(ctx, id, { base: "#693017", shade: "#471f0e", trim: "#d97706" }),
  "iron-knight-helm": (ctx, id) => paintArmorVariant(ctx, id, { base: "#64748b", shade: "#475569", trim: "#e2e8f0" }),
  "iron-knight-cuirass": (ctx, id) => paintArmorVariant(ctx, id, { base: "#64748b", shade: "#475569", trim: "#f1f5f9" }),
  "iron-knight-greaves": (ctx, id) => paintArmorVariant(ctx, id, { base: "#475569", shade: "#334155", trim: "#cbd5e1" }),
  "iron-knight-sabatons": (ctx, id) => paintArmorVariant(ctx, id, { base: "#334155", shade: "#1e293b", trim: "#94a3b8" }),
  "shadowsteel-cowl": (ctx, id) => paintArmorVariant(ctx, id, { base: "#3b2d54", shade: "#251b38", trim: "#c084fc" }),
  "shadowsteel-coat": (ctx, id) => paintArmorVariant(ctx, id, { base: "#3b2d54", shade: "#251b38", trim: "#a855f7" }),
  "shadowsteel-legguards": (ctx, id) => paintArmorVariant(ctx, id, { base: "#2e2242", shade: "#1c1429", trim: "#c084fc" }),
  "shadowsteel-boots": (ctx, id) => paintArmorVariant(ctx, id, { base: "#241936", shade: "#150e21", trim: "#9333ea" }),
  "copper-ingot": (ctx) => paintIngot(ctx, "#d97706", "#fcd34d"),
  "iron-ingot": (ctx) => paintIngot(ctx, "#64748b", "#e2e8f0"),
  "amber-resin": (ctx) => fillEllipsePixel(ctx, { cx: 16, cy: 16, rx: 7, ry: 8, color: "#f59e0b" }),
  "bog-spore": (ctx) => { fillCluster(ctx, [{ cx: 16, cy: 13, rx: 7, ry: 5, color: "#2dd4bf" }, { cx: 16, cy: 20, rx: 3, ry: 5, color: "#cbd5e1" }]); },
  sunstone: (ctx) => paintCrystal(ctx, "#f59e0b", "#fef08a"),
  "shadow-shard": (ctx) => paintCrystal(ctx, "#7c3aed", "#e9d5ff"),
  "ancient-core": (ctx) => { fillCluster(ctx, [{ cx: 16, cy: 16, rx: 8, ry: 8, color: "#0ea5e9" }, { cx: 16, cy: 16, rx: 4, ry: 4, color: "#fef08a" }]); },
  "swiftness-draught": (ctx) => paintElixir(ctx, "#0284c7", "#7dd3fc"),
  "ironbark-tonic": (ctx) => paintElixir(ctx, "#b45309", "#fde68a"),
  "shadow-oil": (ctx) => paintElixir(ctx, "#581c87", "#c084fc"),
  "phoenix-salve": (ctx) => paintElixir(ctx, "#dc2626", "#fef08a"),
};
