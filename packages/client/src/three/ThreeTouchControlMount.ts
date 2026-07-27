import { bindTouchActionButton, bindTouchHoldButton, bindTouchJumpButton, createTouchButton } from "./ThreeTouchActionButtons.js";

interface TouchControlMountRequest {
  layer: HTMLDivElement;
  movementZone: HTMLDivElement;
  stick: HTMLDivElement;
  knob: HTMLDivElement;
  aimStick: HTMLDivElement;
  aimKnob: HTMLDivElement;
  beginStick(event: PointerEvent): void;
  moveStick(event: PointerEvent): void;
  endStick(event: PointerEvent): void;
  beginLook(event: PointerEvent): void;
  moveLook(event: PointerEvent): void;
  endLook(event: PointerEvent): void;
  queueJump(): void;
  triggerAction(action: "attack" | "throw"): void;
  setInteractHeld(held: boolean): void;
  setBlock(held: boolean): void;
  setRun(held: boolean): void;
  setJump(held: boolean): void;
  setJumpButton(button: HTMLButtonElement): void;
}

export const mountTouchControls = (request: TouchControlMountRequest): void => {
  mountMovement(request);
  mountLook(request);
  mountButtons(request);
};

const mountMovement = ({ layer, movementZone, stick, knob, beginStick, moveStick, endStick }: TouchControlMountRequest): void => {
  stick.style.cssText = "position:absolute;left:24px;bottom:28px;width:108px;height:108px;border:1px solid #8a8fa9;border-radius:50%;background:rgba(28,29,45,.48);pointer-events:auto;touch-action:none";
  movementZone.style.cssText = "position:absolute;left:0;bottom:0;width:50%;height:50%;pointer-events:auto;touch-action:none";
  knob.style.cssText = "position:absolute;left:36px;top:36px;width:34px;height:34px;border:1px solid #dbd8cd;border-radius:50%;background:rgba(220,220,230,.18)";
  stick.append(knob); layer.append(movementZone, stick);
  movementZone.addEventListener("pointerdown", beginStick);
  stick.addEventListener("pointerdown", beginStick); stick.addEventListener("pointermove", moveStick);
  stick.addEventListener("pointerup", endStick); stick.addEventListener("pointercancel", endStick);
};

const mountLook = ({ layer, aimStick, aimKnob, beginLook, moveLook, endLook }: TouchControlMountRequest): void => {
  aimStick.style.cssText = "position:absolute;right:24px;bottom:28px;width:108px;height:108px;border:1px solid #8a8fa9;border-radius:50%;background:rgba(28,29,45,.48);pointer-events:auto;touch-action:none";
  aimKnob.style.cssText = "position:absolute;left:36px;top:36px;width:34px;height:34px;border:1px solid #dbd8cd;border-radius:50%;background:rgba(220,220,230,.18)";
  aimStick.append(aimKnob); layer.append(aimStick);
  aimStick.addEventListener("pointerdown", beginLook); aimStick.addEventListener("pointermove", moveLook);
  aimStick.addEventListener("pointerup", endLook); aimStick.addEventListener("pointercancel", endLook);
};

const mountButtons = ({ layer, triggerAction, queueJump, setInteractHeld, setBlock, setRun, setJump, setJumpButton }: TouchControlMountRequest): void => {
  const attack = createTouchButton("ATTACK", 148, 20); const jump = createTouchButton("JUMP", 214, 20);
  const interact = createTouchButton("USE", 181, 86); const throwItem = createTouchButton("THROW", 247, 86);
  const block = createTouchButton("BLOCK", 148, 86); const sprint = createTouchButton("SPRINT", 148, 152);
  bindTouchActionButton(attack, () => triggerAction("attack")); bindTouchActionButton(throwItem, () => triggerAction("throw"));
  bindTouchHoldButton(interact, () => {}, setInteractHeld); bindTouchHoldButton(block, () => {}, setBlock);
  bindTouchHoldButton(sprint, () => {}, setRun); bindTouchJumpButton(jump, queueJump, setJump);
  setJumpButton(jump); layer.append(attack, jump, interact, throwItem, block, sprint);
};
