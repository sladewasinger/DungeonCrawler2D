/** Overhead floating role badges and interaction highlights for Sanctuary Hub NPCs. */
import { PropKind, TILE_PX, type ChunkProp, type PlayerSnapshot, type WorldChunkCache } from "@dc2d/engine";
import { Container, Text } from "pixi.js";

export interface HubNpcCue {
  readonly propId: string;
  readonly kind: PropKind;
  readonly title: string;
  readonly accent: string;
  readonly screenX: number;
  readonly screenY: number;
}

const HUB_BADGE_META: Readonly<Partial<Record<PropKind, { readonly title: string; readonly accent: string }>>> = {
  [PropKind.NpcGuide]: { title: "Guide", accent: "#4ade80" },
  [PropKind.NpcMerchant]: { title: "Merchant", accent: "#facc15" },
  [PropKind.NpcBlacksmith]: { title: "Blacksmith", accent: "#fb923c" },
  [PropKind.BountyBoard]: { title: "Bounties", accent: "#f87171" },
  [PropKind.StashChest]: { title: "Stash", accent: "#60a5fa" },
};

function collectNearbyHubNpcCues(opts: {
  readonly props: readonly ChunkProp[];
  readonly playerX: number;
  readonly playerY: number;
}): HubNpcCue[] {
  const cues: HubNpcCue[] = [];
  for (const prop of opts.props) {
    const meta = HUB_BADGE_META[prop.kind];
    if (!meta) continue;
    if (Math.hypot(prop.x - opts.playerX, prop.y - opts.playerY) > 7.5) continue;
    cues.push({
      propId: prop.id,
      kind: prop.kind,
      title: meta.title,
      accent: meta.accent,
      screenX: prop.x * TILE_PX,
      screenY: (prop.y - 1.4) * TILE_PX,
    });
  }
  return cues;
}

function makeNpcLabel(cue: HubNpcCue): Text {
  const lbl = new Text({
    text: cue.title,
    resolution: 2,
    roundPixels: false,
    textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 26,
      fontWeight: "800",
      fill: cue.accent,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      stroke: { color: 0x090d14, width: 6, join: "round" },
    },
  });
  lbl.anchor.set(0.5, 1);
  lbl.scale.set(0.24);
  return lbl;
}

export class HubNpcOverlay {
  readonly container = new Container();
  private readonly labels = new Map<string, Text>();
  private lastKey = "";

  sync(cache: WorldChunkCache, local: PlayerSnapshot | undefined): void {
    if (!local) { this.container.visible = false; return; }
    this.container.visible = true;
    const key = `${cache.worldSeed}:${Math.floor(local.x * 2)}:${Math.floor(local.y * 2)}:${local.elevation}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const cues = collectNearbyHubNpcCues({
      props: Array.from(cache.propsNear(local.x, local.y)),
      playerX: local.x,
      playerY: local.y,
    });
    const activeIds = new Set(cues.map((c) => c.propId));
    for (const [id, lbl] of this.labels) lbl.visible = activeIds.has(id);
    for (const cue of cues) this.positionCue(cue);
  }

  private positionCue(cue: HubNpcCue): void {
    let lbl = this.labels.get(cue.propId);
    if (!lbl) {
      lbl = makeNpcLabel(cue);
      this.labels.set(cue.propId, lbl);
      this.container.addChild(lbl);
    }
    lbl.visible = true;
    lbl.position.set(cue.screenX, cue.screenY);
  }
}
