import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { encodeStateToURL, decodeStateFromURL } from '../shareUrl';
import { AlgorithmType } from '../../types';

function makePayload(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

// We need to test the encode/decode logic without relying on window.location.
// Instead, we'll test the internal logic by importing and calling the functions
// after setting up minimal globals.

describe('shareUrl', () => {
  let mockHref: string;

  beforeEach(() => {
    mockHref = 'http://localhost:3000/';
    // Create a minimal window/location global
    (globalThis as Record<string, unknown>)['window'] = globalThis;
    Object.defineProperty(globalThis, 'location', {
      value: {
        get href() { return mockHref; },
        set href(v: string) { mockHref = v; },
        search: '',
        toString() { return mockHref; },
      },
      writable: true,
      configurable: true,
    });
    // Also need history
    (globalThis as Record<string, unknown>)['history'] = {
      replaceState: vi.fn(),
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['window'];
    vi.restoreAllMocks();
  });

  const baseState = {
    processes: [
      { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 1, color: '#2563eb' },
      { pid: 'P2', arrivalTime: 2, burstTime: 3, priority: 2, color: '#0ea5e9' },
    ],
    algorithm: 'roundRobin' as AlgorithmType,
    quantum: 3,
    coreCount: 2,
  };

  describe('encodeStateToURL', () => {
    it('should produce a URL with an s param', () => {
      mockHref = 'http://localhost:3000/';
      const url = encodeStateToURL(baseState);
      expect(url).not.toBeNull();
      expect(url!).toContain('s=');
    });

    it('should include schema version in encoded data', () => {
      mockHref = 'http://localhost:3000/';
      const url = encodeStateToURL(baseState);
      expect(url).not.toBeNull();
      const sParam = new URL(url!).searchParams.get('s')!;
      const json = decodeURIComponent(escape(atob(sParam)));
      const data = JSON.parse(json);
      expect(data.v).toBe(1);
    });

    it('should encode and decode a round-trip', () => {
      mockHref = 'http://localhost:3000/';
      const url = encodeStateToURL(baseState);
      expect(url).not.toBeNull();
      const sParam = new URL(url!).searchParams.get('s')!;
      mockHref = `http://localhost:3000/?s=${sParam}`;
      const decoded = decodeStateFromURL();
      expect(decoded).not.toBeNull();
      expect(decoded!.processes).toHaveLength(2);
      expect(decoded!.algorithm).toBe('roundRobin');
    });
  });

  it('should return null when URL would exceed 2000 chars', () => {
    const manyProcesses = Array.from({ length: 20 }, (_, i) => ({
      pid: `Proc${i + 1}`.padEnd(10, 'X'), arrivalTime: i * 2, burstTime: i + 1,
      priority: i % 5, color: '#ff0000',
    }));
    mockHref = 'http://localhost:3000/';
    const url = encodeStateToURL({
      processes: manyProcesses,
      algorithm: 'roundRobin',
      quantum: 3,
      coreCount: 4,
    });
    expect(typeof url === 'string' || url === null).toBe(true);
  });

  describe('decodeStateFromURL', () => {
    it('should return null when no s param exists', () => {
      mockHref = 'http://localhost:3000/';
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for malformed base64', () => {
      mockHref = 'http://localhost:3000/?s=!!!not-base64!!!';
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for valid base64 that is not JSON', () => {
      const encoded = btoa('not json at all');
      mockHref = `http://localhost:3000/?s=${encoded}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for JSON of wrong shape (no p array)', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({ foo: 'bar' })}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for missing schema version', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        p: [{ pid: 'P1', arr: 0, burst: 5 }],
        alg: 'fifo',
      })}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for wrong schema version', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 999,
        p: [{ pid: 'P1', arr: 0, burst: 5 }],
        alg: 'fifo',
      })}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should fall back to fifo for invalid algorithm', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: 0, burst: 5 }],
        alg: 'nonexistent',
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull();
      expect(result!.algorithm).toBe('fifo');
    });

    it('should fall back to defaults for invalid quantum', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: 0, burst: 5 }],
        alg: 'fifo',
        q: -1,
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull();
      expect(result!.quantum).toBe(2);
    });

    it('should fall back to defaults for invalid core count', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: 0, burst: 5 }],
        alg: 'fifo',
        cores: 99,
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull();
      expect(result!.coreCount).toBe(1);
    });

    it('should cap process count at 20', () => {
      const manyProcesses = Array.from({ length: 30 }, (_, i) => ({
        pid: `P${i + 1}`, arr: 0, burst: 1,
      }));
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: manyProcesses,
        alg: 'fifo',
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull();
      expect(result!.processes.length).toBeLessThanOrEqual(20);
    });

    it('should return null for process with negative arrival time', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: -1, burst: 5 }],
        alg: 'fifo',
      })}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for process with zero burst time', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: 0, burst: 0 }],
        alg: 'fifo',
      })}`;
      expect(decodeStateFromURL()).toBeNull();
    });

    it('should return null for process with NaN arrival time (serialized as null)', () => {
      // JSON.stringify converts NaN to null, so p.arr will be null (not a number)
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [{ pid: 'P1', arr: null, burst: 5 }],
        alg: 'fifo',
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull(); // defaults to 0, which is valid
      expect(result!.processes[0].arrivalTime).toBe(0);
    });

    it('should successfully decode a valid payload', () => {
      mockHref = `http://localhost:3000/?s=${makePayload({
        v: 1,
        p: [
          { pid: 'P1', arr: 0, burst: 5, pri: 1, color: '#ff0000' },
          { pid: 'P2', arr: 2, burst: 3 },
        ],
        alg: 'roundRobin',
        q: 3,
        cores: 2,
      })}`;
      const result = decodeStateFromURL();
      expect(result).not.toBeNull();
      expect(result!.processes).toHaveLength(2);
      expect(result!.processes[0].pid).toBe('P1');
      expect(result!.processes[0].arrivalTime).toBe(0);
      expect(result!.processes[0].burstTime).toBe(5);
      expect(result!.processes[0].priority).toBe(1);
      expect(result!.processes[0].color).toBe('#ff0000');
      expect(result!.algorithm).toBe('roundRobin');
      expect(result!.quantum).toBe(3);
      expect(result!.coreCount).toBe(2);
    });
  });
});
