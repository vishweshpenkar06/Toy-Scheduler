import { describe, it, expect } from "vitest";
import { MinHeap, PriorityQueue, Deque } from "../dataStructures";

describe("MinHeap", () => {
  it("pops in ascending order", () => {
    const h = new MinHeap<number>((a, b) => a - b);
    [5, 1, 4, 2, 3].forEach((n) => h.push(n));
    const out: number[] = [];
    while (h.size > 0) out.push(h.pop()!);
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });

  it("peek does not remove", () => {
    const h = new MinHeap<number>((a, b) => a - b);
    h.push(7);
    expect(h.peek()).toBe(7);
    expect(h.size).toBe(1);
  });
});

describe("PriorityQueue", () => {
  it("dequeues by priority", () => {
    const pq = new PriorityQueue<{ id: string; p: number }>((a, b) => a.p - b.p);
    pq.enqueue({ id: "low", p: 10 });
    pq.enqueue({ id: "high", p: 1 });
    pq.enqueue({ id: "mid", p: 5 });
    expect(pq.dequeue()!.id).toBe("high");
    expect(pq.dequeue()!.id).toBe("mid");
    expect(pq.dequeue()!.id).toBe("low");
  });
});

describe("Deque", () => {
  it("supports both ends", () => {
    const d = new Deque<number>();
    d.pushBack(2);
    d.pushFront(1);
    d.pushBack(3);
    expect(d.popFront()).toBe(1);
    expect(d.popBack()).toBe(3);
    expect(d.popFront()).toBe(2);
    expect(d.size).toBe(0);
  });

  it("peeks without removing", () => {
    const d = new Deque<string>();
    d.pushBack("a");
    d.pushFront("b");
    expect(d.peekFront()).toBe("b");
    expect(d.peekBack()).toBe("a");
    expect(d.size).toBe(2);
  });
});
