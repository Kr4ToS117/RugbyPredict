import { test, expect } from "../../test-shim";
import { countHighSeverity } from "./utils";

test("counts high severity anomalies", () => {
  const anomalies = [
    { severity: "low" },
    { severity: "high" },
    { severity: "medium" },
    { severity: "high" },
  ];

  expect(countHighSeverity(anomalies as any)).toBe(2);
  expect(countHighSeverity(undefined)).toBe(0);
});
