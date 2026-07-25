import { decode as decodeMessagePack, encode as encodeMessagePack } from "@msgpack/msgpack";
import { readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { resolve } from "node:path";
import { parse as parseProtobuf } from "protobufjs";
import {
  PROTO_SCHEMA,
  fromProtoValue,
  timed,
  toProtoValue,
  type Codec,
  type CorpusRecord,
  type JsonValue,
  type ProtoValue,
} from "./network-codec-support.js";
import { benchmarkCodec } from "./network-codec-benchmark.js";

const CORPUS_FILE = resolve("docs/benchmarks/network-packet-corpus.json");
const OUTPUT_FILE = resolve("docs/benchmarks/network-codec-assessment.json");
const corpus = JSON.parse(await readFile(CORPUS_FILE, "utf8")) as {
  records: CorpusRecord[];
};
const packets = corpus.records.map(({ payload }) => JSON.parse(payload) as JsonValue);

const protobufInitialization = timed(() => parseProtobuf(PROTO_SCHEMA).root);
const packetType = protobufInitialization.value.lookupType("dc2d.Packet");

const codecs: Codec<unknown>[] = [
  {
    name: "json",
    encode: (value) => JSON.stringify(value),
    decode: (encoded) => JSON.parse(encoded as string) as JsonValue,
    bytes: (encoded) => Buffer.byteLength(encoded as string, "utf8"),
  },
  {
    name: "messagepack",
    encode: (value) => encodeMessagePack(value),
    decode: (encoded) => decodeMessagePack(encoded as Uint8Array) as JsonValue,
    bytes: (encoded) => (encoded as Uint8Array).byteLength,
  },
  {
    name: "protobuf",
    encode: (value) => {
      if (Array.isArray(value) || value === null || typeof value !== "object") {
        throw new Error("wire packet root must be an object");
      }
      return packetType.encode({
        root: toProtoValue(value).objectValue,
      }).finish();
    },
    decode: (encoded) => {
      const decoded = packetType.toObject(
        packetType.decode(encoded as Uint8Array),
        { defaults: false },
      ) as { root?: ProtoValue["objectValue"] };
      if (!decoded.root) throw new Error("protobuf packet had no root");
      return fromProtoValue({ objectValue: decoded.root });
    },
    bytes: (encoded) => (encoded as Uint8Array).byteLength,
  },
];

const results = codecs.map((codec) =>
  benchmarkCodec(codec as Codec<never>, packets, corpus.records));
const json = results.find(({ codec }) => codec === "json");
const messagePack = results.find(({ codec }) => codec === "messagepack");
const protobuf = results.find(({ codec }) => codec === "protobuf");
if (!json || !messagePack || !protobuf) throw new Error("missing codec result");

const reduction = (candidate: typeof json) =>
  1 - candidate.warm.totalBytes / json.warm.totalBytes;
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  command: "npm run benchmark:codecs",
  sourceCorpus: "network-packet-corpus.json",
  corpusPackets: packets.length,
  runtime: {
    node: process.version,
    platform: platform(),
    release: release(),
    cpu: cpus()[0]?.model ?? "unknown",
  },
  protobufSchema: {
    kind: "generic recursive typed value envelope",
    initializationMilliseconds: protobufInitialization.milliseconds,
  },
  results,
  comparison: {
    messagePackByteReductionVsJson: reduction(messagePack),
    protobufByteReductionVsJson: reduction(protobuf),
  },
  implementation: {
    json: {
      browserSupport: "native",
      schemaMaintenance: "existing Zod wire schemas",
      failureDiagnostics: "human-readable payload plus Zod path diagnostics",
    },
    messagepack: {
      browserSupport: "@msgpack/msgpack supports browser Uint8Array payloads",
      schemaMaintenance: "existing Zod schemas remain required after binary decode",
      failureDiagnostics: "binary payload requires codec tooling before Zod diagnostics",
    },
    protobuf: {
      browserSupport: "protobufjs supports browser Uint8Array payloads",
      schemaMaintenance: "requires schema and generated/runtime mapping alongside Zod",
      failureDiagnostics: "binary payload and field-number mapping complicate incidents",
    },
  },
  allocationMeasurement: {
    status: "not reported",
    reason:
      "short-lived JavaScript allocations are not reliable without an isolated process and controlled garbage collection",
  },
};

await writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: OUTPUT_FILE,
  packets: packets.length,
  jsonBytes: json.warm.totalBytes,
  messagePackBytes: messagePack.warm.totalBytes,
  protobufBytes: protobuf.warm.totalBytes,
  messagePackByteReduction: output.comparison.messagePackByteReductionVsJson,
  protobufByteReduction: output.comparison.protobufByteReductionVsJson,
  encodeMicrosecondsPerPacket: Object.fromEntries(
    results.map((result) => [result.codec, result.warm.encodeMicrosecondsPerPacket]),
  ),
  decodeMicrosecondsPerPacket: Object.fromEntries(
    results.map((result) => [result.codec, result.warm.decodeMicrosecondsPerPacket]),
  ),
}, null, 2));
