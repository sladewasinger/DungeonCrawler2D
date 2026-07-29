import type { MotionSample } from "./motionFx.js";

export class MotionSampleBuffer {
  private previousRecord: MotionSample = {
    x: 0,
    y: 0,
    groundHeight: 0,
    air: false,
    faceX: 0,
  };
  private currentRecord: MotionSample = {
    x: 0,
    y: 0,
    groundHeight: 0,
    air: false,
    faceX: 0,
  };
  private hasPrevious = false;

  begin(sample: MotionSample): MotionSample {
    this.currentRecord.x = sample.x;
    this.currentRecord.y = sample.y;
    this.currentRecord.groundHeight = sample.groundHeight;
    this.currentRecord.air = sample.air;
    this.currentRecord.faceX = sample.faceX;
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
