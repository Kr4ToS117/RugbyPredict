import { deepStrictEqual } from "node:assert/strict";

type TestCallback = () => void | Promise<void>;

interface Suite {
  name: string;
  beforeEach: TestCallback[];
  parent: Suite | null;
}

interface TestCase {
  name: string;
  suite: Suite;
  fn: TestCallback;
}

const rootSuite: Suite = { name: "", beforeEach: [], parent: null };
const suiteStack: Suite[] = [rootSuite];
const testQueue: TestCase[] = [];
let scheduled = false;

function fullName(suite: Suite, name: string): string {
  const parts: string[] = [name];
  let current: Suite | null = suite;
  while (current && current !== rootSuite) {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(" › ");
}

async function run() {
  let failures = 0;
  for (const test of testQueue) {
    try {
      const hooks: TestCallback[] = [];
      let cursor: Suite | null = test.suite;
      while (cursor) {
        hooks.unshift(...cursor.beforeEach);
        cursor = cursor.parent;
      }
      for (const hook of hooks) {
        await hook();
      }
      await test.fn();
      console.log(`✓ ${fullName(test.suite, test.name)}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${fullName(test.suite, test.name)}`);
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

export function describe(name: string, fn: () => void) {
  const suite: Suite = { name, beforeEach: [], parent: suiteStack[suiteStack.length - 1] };
  suiteStack.push(suite);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
}

export function test(name: string, fn: TestCallback) {
  const suite = suiteStack[suiteStack.length - 1];
  testQueue.push({ name, suite, fn });
  scheduleRun();
}

export const it = test;

export function beforeEach(fn: TestCallback) {
  const suite = suiteStack[suiteStack.length - 1];
  suite.beforeEach.push(fn);
}

export function expect<T>(received: T) {
  return {
    toBe(expected: T) {
      if (received !== expected) {
        throw new Error(`Expected ${received as any} to be ${expected as any}`);
      }
    },
    toBeUndefined() {
      if (received !== undefined) {
        throw new Error(`Expected value to be undefined`);
      }
    },
    toBeDefined() {
      if (received === undefined) {
        throw new Error(`Expected value to be defined`);
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
      if (Math.round(((received as any as number) - expected) * factor) !== 0) {
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
