/** Owns procedural visual resources used by the Three.js prototype. */
import * as THREE from "three";

export const createEnemyTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Three.js billboard texture.");
  drawShadow(context);
  drawBody(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
};

const drawShadow = (context: CanvasRenderingContext2D) => {
  context.fillStyle = "rgba(0, 0, 0, 0.42)";
  context.beginPath();
  context.ellipse(24, 58, 16, 5, 0, 0, Math.PI * 2);
  context.fill();
};

const drawBody = (context: CanvasRenderingContext2D) => {
  context.fillStyle = "#8a3f47";
  context.fillRect(13, 24, 22, 28);
  context.fillRect(16, 12, 16, 16);
  context.fillStyle = "#f2be8a";
  context.fillRect(18, 17, 4, 4);
  context.fillRect(27, 17, 4, 4);
  context.fillRect(18, 33, 12, 5);
};
