import type { AdminMapEntity } from "@dc2d/engine";
import { petIdleFrame } from "../../../boot/petAssetFrame.js";
import type { LiveSpectatorPoint } from "../liveSpectatorView.js";

interface LiveSpectatorPetInput {
  readonly context: CanvasRenderingContext2D;
  readonly entity: AdminMapEntity;
  readonly image: HTMLImageElement | undefined;
  readonly point: LiveSpectatorPoint;
  readonly tileSize: number;
}

export function drawLiveSpectatorPet(input: LiveSpectatorPetInput): boolean {
  const { image } = input;
  if (!image || !image.complete || image.naturalWidth <= 0) return false;
  const frame = petIdleFrame(input.entity.defId, image.naturalWidth);
  if (!frame) return false;
  const scale = input.tileSize / 16;
  const width = frame.width * scale;
  const height = frame.height * scale;
  input.context.imageSmoothingEnabled = false;
  input.context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    input.point.x - width / 2,
    input.point.y - height,
    width,
    height,
  );
  return true;
}
