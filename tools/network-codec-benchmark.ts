import { isDeepStrictEqual } from "node:util";
import {
  distribution,
  timed,
  type Codec,
  type CorpusRecord,
  type JsonValue,
} from "./network-codec-support.js";

const WARM_BATCHES = 20;

function encodeAndVerify<T>(codec: Codec<T>, packets: JsonValue[]) {
  const coldEncode = timed(() => codec.encode(packets[0] ?? {}));
  const coldDecode = timed(() => codec.decode(coldEncode.value));
  if (!isDeepStrictEqual(coldDecode.value, packets[0] ?? {})) {
    throw new Error(`${codec.name} failed cold round-trip conformance`);
  }
  const encoded = packets.map((packet) => codec.encode(packet));
  for (let index = 0; index < packets.length; index++) {
    const packet = encoded[index];
    if (packet === undefined ||
      !isDeepStrictEqual(codec.decode(packet), packets[index])) {
      throw new Error(`${codec.name} failed corpus round-trip at packet ${index}`);
    }
  }
  return { coldEncode, coldDecode, encoded };
}

function warmTimings<T>(
  codec: Codec<T>,
  packets: JsonValue[],
  encoded: T[],
) {
  const encode = [];
  const decode = [];
  for (let batch = 0; batch < WARM_BATCHES; batch++) {
    encode.push(timed(() => {
      for (const packet of packets) codec.encode(packet);
    }).milliseconds);
    decode.push(timed(() => {
      for (const packet of encoded) codec.decode(packet);
    }).milliseconds);
  }
  return { encode: distribution(encode), decode: distribution(decode) };
}

function groupedBytes(
  records: CorpusRecord[],
  packetBytes: number[],
  keyFor: (record: CorpusRecord) => string,
) {
  const keys = [...new Set(records.map(keyFor))];
  return Object.fromEntries(keys.map((key) => [
    key,
    records.reduce(
      (sum, record, index) =>
        sum + (keyFor(record) === key ? (packetBytes[index] ?? 0) : 0),
      0,
    ),
  ]));
}

export function benchmarkCodec<T>(
  codec: Codec<T>,
  packets: JsonValue[],
  records: CorpusRecord[],
) {
  const { coldEncode, coldDecode, encoded } = encodeAndVerify(codec, packets);
  const timings = warmTimings(codec, packets, encoded);
  const packetBytes = encoded.map((packet) => codec.bytes(packet));
  return {
    codec: codec.name,
    cold: {
      packetBytes: codec.bytes(coldEncode.value),
      encodeMilliseconds: coldEncode.milliseconds,
      decodeMilliseconds: coldDecode.milliseconds,
    },
    warm: {
      batches: WARM_BATCHES,
      packetsPerBatch: packets.length,
      totalBytes: packetBytes.reduce((sum, value) => sum + value, 0),
      packetBytes: distribution(packetBytes),
      bytesByDirection: groupedBytes(records, packetBytes, ({ direction }) => direction),
      bytesByType: groupedBytes(
        records,
        packetBytes,
        ({ direction, type }) => `${direction}:${type}`,
      ),
      encodeBatchMilliseconds: timings.encode,
      decodeBatchMilliseconds: timings.decode,
      encodeMicrosecondsPerPacket:
        (timings.encode.p50 * 1000) / Math.max(1, packets.length),
      decodeMicrosecondsPerPacket:
        (timings.decode.p50 * 1000) / Math.max(1, packets.length),
    },
    conformance: { packetsRoundTripped: packets.length, failures: 0 },
  };
}
