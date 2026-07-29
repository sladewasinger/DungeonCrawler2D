/** Maps authoritative remote-player snapshots into the Three.js coordinate system. */
export interface RemoteActorSnapshot {
  x: number;
  y: number;
  z: number;
  snap: { faceX?: number | undefined; faceY?: number | undefined };
}

export interface RemoteActorPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const remoteActorPose = (entity: RemoteActorSnapshot): RemoteActorPose => ({
  x: entity.x,
  y: entity.z,
  z: entity.y,
  yaw: Math.atan2(entity.snap.faceX ?? 0, entity.snap.faceY ?? 1),
});
