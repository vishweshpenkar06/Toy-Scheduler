import { describe, it, expect } from "vitest";
import {
  validateProcessSpec,
  validateProcessSpecs,
  totalCpuTime,
  toProcessSpec,
  createRuntime,
  DEFAULT_SYSTEM_CONFIG,
} from "../index";

const baseSpec = {
  pid: "P1",
  arrivalTime: 0,
  cpuBursts: [{ type: "cpu" as const, duration: 5 }],
};

describe("validateProcessSpec", () => {
  it("accepts a minimal valid spec", () => {
    expect(validateProcessSpec(baseSpec)).toBeNull();
  });

  it("rejects empty pid", () => {
    expect(validateProcessSpec({ ...baseSpec, pid: "  " })).toMatch(/Process ID/);
  });

  it("rejects negative arrival", () => {
    expect(validateProcessSpec({ ...baseSpec, arrivalTime: -1 })).toMatch(/negative arrivalTime/);
  });

  it("rejects non-integer arrival", () => {
    expect(validateProcessSpec({ ...baseSpec, arrivalTime: 1.5 })).toMatch(/invalid arrivalTime/);
  });

  it("rejects empty cpu burst list", () => {
    expect(validateProcessSpec({ ...baseSpec, cpuBursts: [] })).toMatch(/at least one CPU burst/);
  });

  it("rejects non-positive burst duration", () => {
    expect(
      validateProcessSpec({ ...baseSpec, cpuBursts: [{ type: "cpu", duration: 0 }] })
    ).toMatch(/non-positive duration/);
  });

  it("rejects invalid burst type", () => {
    expect(
      validateProcessSpec({
        ...baseSpec,
        cpuBursts: [{ type: "disk" as never, duration: 3 }],
      })
    ).toMatch(/invalid type/);
  });

  it("accepts CPU and IO burst sequences", () => {
    const spec = {
      ...baseSpec,
      cpuBursts: [{ type: "cpu" as const, duration: 4 }],
      ioBursts: [{ type: "io" as const, duration: 6 }],
    };
    expect(validateProcessSpec(spec)).toBeNull();
  });

  it("rejects deadline before arrival", () => {
    expect(validateProcessSpec({ ...baseSpec, arrivalTime: 5, deadline: 3 })).toMatch(/invalid deadline/);
  });

  it("rejects non-positive period", () => {
    expect(validateProcessSpec({ ...baseSpec, period: 0 })).toMatch(/invalid period/);
  });

  it("rejects non-positive tickets", () => {
    expect(validateProcessSpec({ ...baseSpec, tickets: -1 })).toMatch(/invalid tickets/);
  });
});

describe("validateProcessSpecs", () => {
  it("rejects duplicate pids", () => {
    expect(() => validateProcessSpecs([baseSpec, { ...baseSpec }])).toThrow(/Duplicate process ID/);
  });

  it("passes unique valid specs", () => {
    expect(() =>
      validateProcessSpecs([baseSpec, { ...baseSpec, pid: "P2" }])
    ).not.toThrow();
  });
});

describe("totalCpuTime", () => {
  it("sums cpu bursts", () => {
    expect(
      totalCpuTime({
        ...baseSpec,
        cpuBursts: [
          { type: "cpu", duration: 4 },
          { type: "cpu", duration: 3 },
        ],
      })
    ).toBe(7);
  });
});

describe("bridge", () => {
  it("converts legacy Process to single-burst ProcessSpec", () => {
    const spec = toProcessSpec({ pid: "P1", arrivalTime: 2, burstTime: 6, priority: 1 });
    expect(spec.cpuBursts).toEqual([{ type: "cpu", duration: 6 }]);
    expect(spec.arrivalTime).toBe(2);
    expect(spec.priority).toBe(1);
  });

  it("creates runtime NEW until arrival event (including t=0)", () => {
    expect(createRuntime(baseSpec).state).toBe("NEW");
    expect(createRuntime({ ...baseSpec, arrivalTime: 3 }).state).toBe("NEW");
  });

  it("runtime remainingCpu equals total cpu time", () => {
    const rt = createRuntime({
      ...baseSpec,
      cpuBursts: [
        { type: "cpu", duration: 2 },
        { type: "cpu", duration: 3 },
      ],
    });
    expect(rt.remainingCpu).toBe(5);
  });
});

describe("DEFAULT_SYSTEM_CONFIG", () => {
  it("is single-core with zero overhead", () => {
    expect(DEFAULT_SYSTEM_CONFIG).toEqual({
      coreCount: 1,
      contextSwitchCost: 0,
      dispatchLatency: 0,
      migrationCost: 0,
    });
  });
});
