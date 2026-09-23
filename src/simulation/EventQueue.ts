import { SimulationEvent, SimulationEventType } from "../domain/models";

export const EVENT_PRIORITY: Record<SimulationEventType, number> = {
  PROCESS_ARRIVAL: 1,
  CPU_BURST_COMPLETE: 2,
  IO_COMPLETE: 3,
  DEADLINE: 4,
  QUANTUM_EXPIRE: 5,
  PREEMPT: 6,
  AGING_TICK: 7,
  LOAD_BALANCE: 8,
  MIGRATION: 9,
  DISPATCH: 10,
  CONTEXT_SWITCH_COMPLETE: 11,
  PROCESS_TERMINATE: 12,
};

function less(a: SimulationEvent, b: SimulationEvent): boolean {
  if (a.time !== b.time) return a.time < b.time;
  const pa = EVENT_PRIORITY[a.type];
  const pb = EVENT_PRIORITY[b.type];
  if (pa !== pb) return pa < pb;
  return a.id < b.id;
}

export class EventQueue {
  private heap: SimulationEvent[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(event: SimulationEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): SimulationEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  peek(): SimulationEvent | undefined {
    return this.heap[0];
  }

  clear(): void {
    this.heap = [];
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(this.heap[i], this.heap[parent])) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && less(this.heap[left], this.heap[smallest])) smallest = left;
      if (right < n && less(this.heap[right], this.heap[smallest])) smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}
