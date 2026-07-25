import type { MotionSample } from "./motionFx.js";

export class MotionSampleBuffer {
  private previousRecord: MotionSample = {
    x: 0,
    y: 0,
    air: false,
    faceX: 0,
  };
  private currentRecord: MotionSample = {
    x: 0,
    y: 0,
    air: false,
    faceX: 0,
  };
  private hasPrevious = false;

  begin(x: number, y: number, air: boolean, faceX: number): MotionSample {
    this.currentRecord.x = x;
    this.currentRecord.y = y;
    this.currentRecord.air = air;
    this.currentRecord.faceX = faceX;
    return this.currentRecord;
  }

  get previous(): MotionSample | undefined {
    return this.hasPrevious ? this.previousRecord : undefined;
  }

  get latest(): MotionSample | undefined {
    return this.previous;
  }

  commit(): void {
    const previous = this.previousRecord;
    this.previousRecord = this.currentRecord;
    this.currentRecord = previous;
    this.hasPrevious = true;
  }
}
