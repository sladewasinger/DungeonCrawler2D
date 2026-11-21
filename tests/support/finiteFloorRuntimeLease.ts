import { randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { threadId } from "node:worker_threads";

const LEASE_POLL_MS = 25;
const LEASE_STALE_MS = 30_000;

export type FiniteFloorRuntimeLeaseState = "owner" | "peer-complete" | "unavailable";

export interface FiniteFloorRuntimeLeaseOptions {
  readonly pollMs?: number;
  readonly staleMs?: number;
  readonly completionWaitMs?: number;
  readonly ownerIsAlive?: (pid: number) => boolean;
  readonly beforePublish?: () => void;
}

export class FiniteFloorRuntimeLease {
  private readonly owned = new Map<string, string>();

  public constructor(private readonly options: FiniteFloorRuntimeLeaseOptions = {}) {}

  acquireOrAwait(path: string, isComplete: () => boolean = () => existsSync(path)): FiniteFloorRuntimeLeaseState {
    if (this.owned.has(path)) return "owner";
    if (this.claim(path)) return "owner";
    return this.waitForPeer(path, isComplete);
  }

  private claim(path: string): boolean {
    const token = tryAcquire(path, {
      staleMs: this.staleMs,
      ownerIsAlive: this.ownerIsAlive,
      beforePublish: this.options.beforePublish,
    });
    if (!token) return false;
    this.owned.set(path, token);
    return true;
  }

  private waitForPeer(path: string, isComplete: () => boolean): FiniteFloorRuntimeLeaseState {
    const deadline = Date.now() + this.completionWaitMs;
    while (Date.now() < deadline) {
      if (isComplete()) return "peer-complete";
      if (this.claim(path)) return "owner";
      waitForPoll(this.pollMs);
    }
    return this.resolveAfterWait(path, isComplete);
  }

  private resolveAfterWait(path: string, isComplete: () => boolean): FiniteFloorRuntimeLeaseState {
    if (isComplete()) return "peer-complete";
    return this.claim(path) ? "owner" : "unavailable";
  }

  release(path: string): void {
    const token = this.owned.get(path);
    if (!token) return;
    this.owned.delete(path);
    const lease = `${path}.lock`;
    if (readLeaseRecord(lease)?.token === token) unlinkSync(lease);
  }

  private get pollMs(): number { return this.options.pollMs ?? LEASE_POLL_MS; }

  private get staleMs(): number { return this.options.staleMs ?? LEASE_STALE_MS; }

  private get completionWaitMs(): number {
    return this.options.completionWaitMs ?? LEASE_STALE_MS;
  }

  private get ownerIsAlive(): (pid: number) => boolean {
    return this.options.ownerIsAlive ?? processIsAlive;
  }
}

interface LeaseRecord {
  readonly token: string;
  readonly pid: number;
  readonly threadId: number;
  readonly timestamp: number;
}

interface LeaseClaimOptions {
  readonly staleMs: number;
  readonly ownerIsAlive: (pid: number) => boolean;
  readonly beforePublish: (() => void) | undefined;
}

function tryAcquire(path: string, options: LeaseClaimOptions): string | null {
  const lease = `${path}.lock`;
  const token = randomUUID();
  const pending = `${lease}.${token}.pending`;
  try {
    mkdirSync(dirname(lease), { recursive: true });
    if (!retireStaleLease(lease, options.staleMs, options.ownerIsAlive)) return null;
    writeFileSync(pending, JSON.stringify({ token, pid: process.pid, threadId, timestamp: Date.now() }), { flag: "wx" });
    options.beforePublish?.();
    linkSync(pending, lease);
    unlinkSync(pending);
    return token;
  } catch {
    if (existsSync(pending)) unlinkSync(pending);
    return null;
  }
}

function retireStaleLease(path: string, staleMs: number, ownerIsAlive: (pid: number) => boolean): boolean {
  if (!existsSync(path)) return true;
  const record = readLeaseRecord(path);
  if (record && (!isExpired(record, staleMs) || ownerIsAlive(record.pid))) return false;
  const retired = `${path}.${randomUUID()}.stale`;
  try {
    renameSync(path, retired);
    unlinkSync(retired);
    return true;
  } catch {
    return false;
  }
}

function readLeaseRecord(path: string): LeaseRecord | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<LeaseRecord>;
    if (!validLeaseRecord(value)) return null;
    return value as LeaseRecord;
  } catch {
    return null;
  }
}

function validLeaseRecord(value: Partial<LeaseRecord>): boolean {
  return typeof value.token === "string" && typeof value.pid === "number"
    && typeof value.threadId === "number" && typeof value.timestamp === "number";
}

function isExpired(record: LeaseRecord, staleMs: number): boolean {
  return Date.now() - record.timestamp > staleMs;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function waitForPoll(pollMs: number): void {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, pollMs);
}
