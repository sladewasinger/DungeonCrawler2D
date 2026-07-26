import * as THREE from "three";

export interface ThreeTextSprite {
  material: {
    map?: { dispose(): void };
    needsUpdate: boolean;
  };
  position: { y: number };
  scale: { set(x: number, y: number, z: number): void };
  visible: boolean;
}

const textTexture = (text: string, color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "rgba(8,5,8,.72)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = "bold 25px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    text.split("\n").forEach((line, index) =>
      context.fillText(line, canvas.width / 2, 44 + index * 34));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const createThreeTextSprite = (
  text: string,
  color: string,
): ThreeTextSprite => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textTexture(text, color),
    depthTest: false,
    transparent: true,
  }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite as ThreeTextSprite;
};

export const updateThreeTextSprite = (
  sprite: ThreeTextSprite,
  text: string,
  color: string,
): void => {
  sprite.material.map?.dispose();
  sprite.material.map = textTexture(text, color);
  sprite.material.needsUpdate = true;
};
