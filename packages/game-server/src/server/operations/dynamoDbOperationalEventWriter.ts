import { randomUUID } from "node:crypto";
import {
  DynamoDBClient,
  PutItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import type { OperationalEvent } from "./operationalEvent.js";
import type { OperationalEventWriter } from "./boundedOperationalEventSink.js";
import { operationalActorId } from "./operationalEventIdentity.js";

export interface DynamoDbOperationalEventWriterOptions {
  readonly tableName: string;
  readonly region?: string;
  readonly retentionSeconds: number;
  readonly writeTimeoutMs?: number;
}

const DEFAULT_WRITE_TIMEOUT_MS = 1_000;

/** Uses the AWS SDK's default credential provider, including an EC2 instance role. */
export class DynamoDbOperationalEventWriter implements OperationalEventWriter {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;
  private readonly retentionSeconds: number;
  private readonly writeTimeoutMs: number;

  constructor(options: DynamoDbOperationalEventWriterOptions) {
    this.client = new DynamoDBClient(options.region ? { region: options.region } : {});
    this.tableName = options.tableName;
    this.retentionSeconds = options.retentionSeconds;
    this.writeTimeoutMs = options.writeTimeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS;
  }

  async write(event: OperationalEvent): Promise<void> {
    const at = validEventTime(event.at);
    const identifier = randomUUID();
    const actorId = operationalActorId(event.actorId);
    await this.client.send(new PutItemCommand({
      TableName: this.tableName,
      Item: operationalEventItem({ event, at, identifier, actorId, retentionSeconds: this.retentionSeconds }),
    }), { abortSignal: AbortSignal.timeout(this.writeTimeoutMs) });
  }
}

interface OperationalEventItemInput {
  readonly event: OperationalEvent;
  readonly at: number;
  readonly identifier: string;
  readonly actorId: string;
  readonly retentionSeconds: number;
}

function operationalEventItem(input: OperationalEventItemInput): Record<string, AttributeValue> {
  const { event, at, identifier, actorId, retentionSeconds } = input;
  const timeKey = `${String(at).padStart(13, "0")}#${identifier}`;
  return {
    actor_key: { S: actorId },
    event_key: { S: timeKey },
    time_partition: { S: utcDayPartition(at) },
    time_key: { S: timeKey },
    event_type: { S: event.category },
    action: { S: safeAttribute(event.action) },
    at: { N: String(at) },
    expires_at: { N: String(Math.floor(at / 1_000) + retentionSeconds) },
    ...(event.attributes ? { attributes: { M: eventAttributes(event.attributes) } } : {}),
  };
}

function eventAttributes(attributes: Readonly<Record<string, string | number | boolean>>): Record<string, AttributeValue> {
  return Object.fromEntries(
    Object.entries(attributes)
      .slice(0, 16)
      .map(([key, value]) => [safeAttribute(key), attributeValue(value)]),
  );
}

function attributeValue(value: string | number | boolean): AttributeValue {
  if (typeof value === "string") return { S: safeAttribute(value) };
  if (typeof value === "number") return { N: String(value) };
  return { BOOL: value };
}

function validEventTime(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Date.now();
}

function utcDayPartition(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

function safeAttribute(value: string): string {
  return [...value]
    .filter((character) => character.codePointAt(0)! >= 32 && character.codePointAt(0)! !== 127)
    .join("")
    .slice(0, 256);
}
