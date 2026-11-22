/** Mobile-first floating touch joystick, keyboard WASD/arrows, and wheel zoom input. */

export interface InputCallbacks {
  readonly onToggleTorch: () => void;
  readonly onZoom: (factor: number) => void;
}

export class InputController {
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private touchVector = { x: 0, y: 0 };
  private readonly stickEl: HTMLDivElement;
  private readonly knobEl: HTMLDivElement;

  constructor(host: HTMLElement, callbacks: InputCallbacks) {
    const { ring, knob } = createJoystickDom();
    this.stickEl = ring;
    this.knobEl = knob;
    host.appendChild(ring);
    this.bindKeyboard(callbacks);
    this.bindPointer(host, callbacks);
  }

  movement(): { readonly x: number; readonly y: number } {
    if (this.pointerId !== null) return this.touchVector;
    const x = (this.down("KeyD", "ArrowRight") ? 1 : 0) - (this.down("KeyA", "ArrowLeft") ? 1 : 0);
    const y = (this.down("KeyS", "ArrowDown") ? 1 : 0) - (this.down("KeyW", "ArrowUp") ? 1 : 0);
    return { x, y };
  }

  private down(...codes: readonly string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private bindKeyboard(callbacks: InputCallbacks): void {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "KeyF" && !e.repeat) callbacks.onToggleTorch();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }

  private bindPointer(host: HTMLElement, callbacks: InputCallbacks): void {
    host.addEventListener("wheel", (e) => {
      e.preventDefault();
      callbacks.onZoom(e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });
    host.addEventListener("pointerdown", (e) => this.startTouch(e));
    host.addEventListener("pointermove", (e) => this.moveTouch(e));
    host.addEventListener("pointerup", (e) => this.endTouch(e));
    host.addEventListener("pointercancel", (e) => this.endTouch(e));
  }

  private startTouch(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".ow-hud") || this.pointerId !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.pointerId = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.touchVector = { x: 0, y: 0 };
    this.stickEl.style.left = `${e.clientX}px`;
    this.stickEl.style.top = `${e.clientY}px`;
    this.stickEl.style.display = "block";
    this.knobEl.style.transform = "translate(-50%, -50%)";
  }

  private moveTouch(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const maxRadius = 46;
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const nx = dist > 2 ? dx / dist : 0;
    const ny = dist > 2 ? dy / dist : 0;
    this.knobEl.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
    const strength = clamped / maxRadius;
    this.touchVector = strength > 0.14 ? { x: nx * strength, y: ny * strength } : { x: 0, y: 0 };
  }

  private endTouch(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.touchVector = { x: 0, y: 0 };
    this.stickEl.style.display = "none";
  }
}

function createJoystickDom(): { ring: HTMLDivElement; knob: HTMLDivElement } {
  const ring = document.createElement("div");
  ring.className = "ow-joystick";
  const knob = document.createElement("div");
  knob.className = "ow-joystick__knob";
  ring.appendChild(knob);
  return { ring, knob };
}
