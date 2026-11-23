/** Binary min-heap priority queue backed by typed arrays for A* open-set storage. */

export interface OpenHeap {
  readonly indices: Int32Array;
  readonly priorities: Float32Array;
  size: number;
}

export function createOpenHeap(capacity: number): OpenHeap {
  return {
    indices: new Int32Array(capacity),
    priorities: new Float32Array(capacity),
    size: 0,
  };
}

export function pushOpen(heap: OpenHeap, idx: number, priority: number): void {
  let pos = heap.size++;
  heap.indices[pos] = idx;
  heap.priorities[pos] = priority;
  while (pos > 0) {
    const up = (pos - 1) >> 1;
    if ((heap.priorities[up] ?? 0) <= priority) break;
    heap.indices[pos] = heap.indices[up] ?? 0;
    heap.priorities[pos] = heap.priorities[up] ?? 0;
    heap.indices[up] = idx;
    heap.priorities[up] = priority;
    pos = up;
  }
}

export function popOpen(heap: OpenHeap): number {
  const top = heap.indices[0] ?? 0;
  const last = --heap.size;
  if (last > 0) {
    heap.indices[0] = heap.indices[last] ?? 0;
    heap.priorities[0] = heap.priorities[last] ?? 0;
    siftDown(heap, 0);
  }
  return top;
}

function smallerChildIdx(heap: OpenHeap, pos: number): number {
  const left = pos * 2 + 1;
  const right = left + 1;
  if (right >= heap.size) return left;
  return (heap.priorities[right] ?? 0) < (heap.priorities[left] ?? 0) ? right : left;
}

function siftDown(heap: OpenHeap, startPos: number): void {
  let pos = startPos;
  const idx = heap.indices[pos] ?? 0;
  const prio = heap.priorities[pos] ?? 0;
  while (pos * 2 + 1 < heap.size) {
    const child = smallerChildIdx(heap, pos);
    if (prio <= (heap.priorities[child] ?? 0)) break;
    heap.indices[pos] = heap.indices[child] ?? 0;
    heap.priorities[pos] = heap.priorities[child] ?? 0;
    pos = child;
  }
  heap.indices[pos] = idx;
  heap.priorities[pos] = prio;
}
