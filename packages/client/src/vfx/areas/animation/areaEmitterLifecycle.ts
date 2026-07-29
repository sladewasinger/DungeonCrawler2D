export interface AreaEmitterControl {
  setPosition(x: number, y: number): this;
  setDepth(depth: number): this;
  setActive(active: boolean): this;
  setVisible(visible: boolean): this;
  start(advance?: number, duration?: number): this;
  stop(): this;
  killAll(): this;
  destroy(): void;
}

export interface AreaEmitterPlacement {
  readonly screen: Readonly<{ x: number; y: number }>;
  readonly depth: number;
}

export function activateAreaEmitters(
  emitters: readonly AreaEmitterControl[],
  placement: AreaEmitterPlacement,
  start: boolean,
): void {
  for (const emitter of emitters) {
    emitter
      .setPosition(placement.screen.x, placement.screen.y)
      .setDepth(placement.depth)
      .setActive(true)
      .setVisible(true);
    if (start) emitter.start(0, 0);
  }
}

export function deactivateAreaEmitters(
  emitters: readonly AreaEmitterControl[],
): void {
  for (const emitter of emitters) {
    emitter.stop();
    emitter.killAll();
    emitter.setActive(false).setVisible(false);
  }
}

export function destroyAreaEmitters(
  emitters: readonly AreaEmitterControl[],
): void {
  for (const emitter of emitters) emitter.destroy();
}
