export class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.data.length;
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  clear(): void {
    this.data = [];
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[parent]) >= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.data.length;
    for (;;) {
      let best = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.data[left], this.data[best]) < 0) best = left;
      if (right < n && this.compare(this.data[right], this.data[best]) < 0) best = right;
      if (best === i) break;
      [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
      i = best;
    }
  }
}

export class PriorityQueue<T> {
  private heap: MinHeap<T>;
  constructor(compare: (a: T, b: T) => number) {
    this.heap = new MinHeap(compare);
  }
  get size(): number {
    return this.heap.size;
  }
  enqueue(item: T): void {
    this.heap.push(item);
  }
  dequeue(): T | undefined {
    return this.heap.pop();
  }
  peek(): T | undefined {
    return this.heap.peek();
  }
}

export class Deque<T> {
  private items: T[] = [];
  get size(): number {
    return this.items.length;
  }
  pushBack(item: T): void {
    this.items.push(item);
  }
  pushFront(item: T): void {
    this.items.unshift(item);
  }
  popFront(): T | undefined {
    return this.items.shift();
  }
  popBack(): T | undefined {
    return this.items.pop();
  }
  peekFront(): T | undefined {
    return this.items[0];
  }
  peekBack(): T | undefined {
    return this.items[this.items.length - 1];
  }
  clear(): void {
    this.items = [];
  }
}
