# Network Codec Assessment

Generated from the same 591 captured client/server packets as the actual-server
JSON baseline:

```text
npm run benchmark:codecs
```

The machine-readable result is
[`network-codec-assessment.json`](network-codec-assessment.json). All codecs
round-tripped every packet without a conformance failure.

## Warm Results

| Codec | Corpus bytes | Change from JSON | Encode µs/packet | Decode µs/packet | Packet p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| JSON | 414,349 | baseline | 1.029 | 1.840 | 1,692 B |
| MessagePack | 289,673 | -30.09% | 2.443 | 2.692 | 1,178 B |
| Protobuf envelope | 569,077 | +37.34% | 7.481 | 16.186 | 2,280 B |

MessagePack reduced client-to-server bytes from 36,977 to 23,909 and
server-to-client bytes from 377,372 to 265,764. JSON remained the fastest codec,
but all JSON and MessagePack warm costs were only a few microseconds per packet
on the benchmark host.

The Protobuf candidate is a recursive typed-value envelope that can represent
the current polymorphic protocol without dropping fields or silently changing
optional/null values. A field-specific generated schema could be smaller, but it
would introduce a second complete wire schema and mapping layer alongside the
existing Zod contracts. This result does not justify that production redesign.

JavaScript allocation counts are not reported because this short in-process run
does not have isolated, controlled garbage collection; heap deltas would be
misleading.

## Decision

Keep JSON as the runtime protocol and do not schedule negotiated `binary-v1`
yet.

MessagePack's 30% byte reduction is real, but the actual-server baseline has
zero sustained socket queue, sub-millisecond server-step p95, and no evidence
that serialization or bandwidth causes movement corrections. The long-session
movement problem was instead caused by client/server prediction-clock drift and
unbounded retained area presentation. Adding mixed-codec rollout, rollback, and
binary incident tooling would not improve that latency path today.

Revisit MessagePack when representative concurrency testing shows bandwidth or
socket queue pressure. If that happens, trial negotiated MessagePack first;
retain JSON as the default/fallback and re-run the full actual-server scenarios
before promotion.
