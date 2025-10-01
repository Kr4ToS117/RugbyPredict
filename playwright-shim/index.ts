import { deepStrictEqual } from "node:assert/strict";

type TestCallback = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestCallback;
}

const queue: TestCase[] = [];
const describeStack: string[] = [];
let scheduled = false;

function fullName(name: string): string {
  return [...describeStack, name].join(" › ");
}

async function run() {
  let failures = 0;
  for (const test of queue) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${test.name}`);
      console.error(error instanceof Error ? error.stack ?? error.message : error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

function scheduleRun() {
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(() => {
      run().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
  }
}

export const test = Object.assign(
  (name: string, fn: TestCallback) => {
    queue.push({ name: fullName(name), fn });
    scheduleRun();
  },
  {
    describe(name: string, fn: () => void) {
      describeStack.push(name);
      try {
        fn();
      } finally {
        describeStack.pop();
      }
    },
  },
);

export function expect<T>(received: T) {
  return {
    toBe(expected: T) {
      if (received !== expected) {
        throw new Error(`Expected ${received as unknown as string} to be ${expected as unknown as string}`);
      }
    },
    toBeTruthy() {
      if (!received) {
        throw new Error(`Expected value to be truthy`);
      }
    },
    toEqual(expected: unknown) {
      deepStrictEqual(received, expected);
    },
    toHaveLength(length: number) {
      const actual = (received as any)?.length;
      if (actual !== length) {
        throw new Error(`Expected length ${length}, received ${actual}`);
      }
    },
    toContain(expected: unknown) {
      if (typeof received === "string") {
        if (!received.includes(String(expected))) {
          throw new Error(`Expected "${received}" to contain "${expected}"`);
        }
        return;
      }
      if (Array.isArray(received)) {
        if (!received.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
        return;
      }
      throw new Error("toContain supports strings and arrays only");
    },
    toBeCloseTo(expected: number, precision = 2) {
      const factor = Math.pow(10, precision);
      if (Math.round((received as any as number - expected) * factor) !== 0) {
        throw new Error(`Expected ${received} to be close to ${expected}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if ((received as any as number) <= expected) {
        throw new Error(`Expected ${received} to be greater than ${expected}`);
      }
    },
  };
}
