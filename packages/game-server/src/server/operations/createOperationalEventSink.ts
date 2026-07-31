import { BoundedOperationalEventSink } from "./boundedOperationalEventSink.js";
import { DynamoDbOperationalEventWriter } from "./dynamoDbOperationalEventWriter.js";
import { NullOperationalEventSink, type OperationalEventSink } from "./operationalEvent.js";
import { JsonOperationalLogger } from "./structuredServerLog.js";

export interface OperationalEventConfiguration {
  readonly tableName?: string | null;
  readonly region?: string;
  readonly retentionSeconds?: number;
}

const DEFAULT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/** Returns a no-op sink unless production explicitly configures a table. */
export function createOperationalEventSink(config: OperationalEventConfiguration): OperationalEventSink {
  const tableName = config.tableName?.trim();
  if (!tableName) return new NullOperationalEventSink();
  return new BoundedOperationalEventSink({
    writer: new DynamoDbOperationalEventWriter({
      tableName,
      retentionSeconds: config.retentionSeconds ?? DEFAULT_RETENTION_SECONDS,
      ...(config.region ? { region: config.region } : {}),
    }),
    logger: new JsonOperationalLogger(),
  });
}
