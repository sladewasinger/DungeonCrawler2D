export const PROTO_SCHEMA = `
syntax = "proto3";
package dc2d;

enum NullValue {
  NULL_VALUE = 0;
}

message ListValue {
  repeated Value values = 1;
}

message ObjectValue {
  map<string, Value> fields = 1;
}

message Value {
  oneof kind {
    double number_value = 1;
    string string_value = 2;
    bool bool_value = 3;
    NullValue null_value = 4;
    ListValue list_value = 5;
    ObjectValue object_value = 6;
  }
}

message Packet {
  ObjectValue root = 1;
}
`;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface CorpusRecord {
  readonly direction: string;
  readonly type: string;
  readonly payload: string;
}

export interface ProtoValue {
  numberValue?: number;
  stringValue?: string;
  boolValue?: boolean;
  nullValue?: 0;
  listValue?: { values?: ProtoValue[] };
  objectValue?: { fields?: Record<string, ProtoValue> };
}

export interface Codec<T> {
  readonly name: "json" | "messagepack" | "protobuf";
  encode(value: JsonValue): T;
  decode(encoded: T): JsonValue;
  bytes(encoded: T): number;
}

function scalarProtoValue(value: ProtoValue): JsonValue | undefined {
  if (value.numberValue !== undefined) return value.numberValue;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.nullValue !== undefined) return null;
  return undefined;
}

export function toProtoValue(value: JsonValue): ProtoValue {
  if (value === null) return { nullValue: 0 };
  if (typeof value === "number") return { numberValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  if (Array.isArray(value)) {
    return { listValue: { values: value.map(toProtoValue) } };
  }
  return {
    objectValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, toProtoValue(child)]),
      ),
    },
  };
}

export function fromProtoValue(value: ProtoValue): JsonValue {
  const scalar = scalarProtoValue(value);
  if (scalar !== undefined) return scalar;
  if (value.listValue) return (value.listValue.values ?? []).map(fromProtoValue);
  if (value.objectValue) {
    return Object.fromEntries(
      Object.entries(value.objectValue.fields ?? {}).map(
        ([key, child]) => [key, fromProtoValue(child)],
      ),
    );
  }
  throw new Error("protobuf value had no active kind");
}

export function distribution(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1) ?? 0,
  };
}

export function timed<T>(work: () => T): { value: T; milliseconds: number } {
  const startedAt = performance.now();
  const value = work();
  return { value, milliseconds: performance.now() - startedAt };
}
