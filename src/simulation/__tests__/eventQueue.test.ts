import { describe, it, expect } from "vitest";
import { EventQueue } from "../EventQueue";
import { SimulationEvent } from "../../domain/models";

function ev(id: number, time: number, type: SimulationEvent["type"]): SimulationEvent {
  return { id, time, type, payload: {} };
}

describe("EventQueue", () => {
  it("pops events in time order", () => {
    const q = new EventQueue();
    q.push(ev(0, 10, "PROCESS_ARRIVAL"));
    q.push(ev(1, 5, "PROCESS_ARRIVAL"));
    q.push(ev(2, 20, "PROCESS_ARRIVAL"));
    expect(q.pop()!.time).toBe(5);
    expect(q.pop()!.time).toBe(10);
    expect(q.pop()!.time).toBe(20);
    expect(q.pop()).toBeUndefined();
  });

  it("breaks time ties by event priority", () => {
    const q = new EventQueue();
    q.push(ev(0, 1, "DISPATCH"));
    q.push(ev(1, 1, "PROCESS_ARRIVAL"));
    q.push(ev(2, 1, "CPU_BURST_COMPLETE"));
    expect(q.pop()!.type).toBe("PROCESS_ARRIVAL");
    expect(q.pop()!.type).toBe("CPU_BURST_COMPLETE");
    expect(q.pop()!.type).toBe("DISPATCH");
  });

  it("breaks same-time same-priority by sequence id", () => {
    const q = new EventQueue();
    q.push(ev(5, 1, "PROCESS_ARRIVAL"));
    q.push(ev(2, 1, "PROCESS_ARRIVAL"));
    expect(q.pop()!.id).toBe(2);
    expect(q.pop()!.id).toBe(5);
  });

  it("maintains heap invariant under interleaved push/pop", () => {
    const q = new EventQueue();
    const times = [7, 3, 9, 1, 4, 8, 2];
    times.forEach((t, i) => q.push(ev(i, t, "PROCESS_ARRIVAL")));
    const out: number[] = [];
    while (q.size > 0) out.push(q.pop()!.time);
    expect(out).toEqual([1, 2, 3, 4, 7, 8, 9]);
  });

  it("peek does not remove", () => {
    const q = new EventQueue();
    q.push(ev(0, 4, "PROCESS_ARRIVAL"));
    expect(q.peek()!.time).toBe(4);
    expect(q.size).toBe(1);
  });
});
