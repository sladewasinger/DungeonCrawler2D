# 20-Player Network Load Gate

The reproducible `npm run benchmark:network-load` command connects the project’s
target 20-player floor population to the real WebSocket game server. All clients
remain in one area of interest and submit production-schema movement input at the
20 Hz simulation rate for 120 measured ticks after warmup.

The committed 2026-07-25 run passed:

- Server simulation step p95: 1.35 ms against a 25 ms budget.
- Server simulation step maximum: 3.44 ms.
- Maximum client socket queue: 0 bytes.
- Protocol decode failures: 0.
- Aggregate client-to-server traffic: 43,947 bytes/second.
- Aggregate server-to-client traffic: 1,493,287 bytes/second, about 74.7 KB/s per
  client in the deliberately dense same-AOI case.

Simulation time and socket queueing have ample headroom at the target shard size.
Dense-AOI outbound bandwidth is the first scaling pressure. The codec assessment
shows MessagePack as the measured first option if production concurrency later
makes that pressure material; it is not currently a movement-latency fix.

The loopback gate does not model WAN latency or packet loss, and its short heap
sample includes normal runtime allocation. Long-session client retention is
covered separately by accelerated prediction and area-retention regression tests.
