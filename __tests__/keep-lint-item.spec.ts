import { keepLintItem } from "../src/utils/batch-lint";
import { FixConvergence } from "@lint-md/core";
import type { FixedResult } from "@lint-md/core";
import type { BatchLintItem } from "../src/types";

const baseItem = (
  overrides: Partial<BatchLintItem> & {
    convergence?: FixConvergence;
  }
): BatchLintItem => {
  const { convergence, ...rest } = overrides;
  const fixedResult: FixedResult = {
    result: "",
    notAppliedFixes: [],
  };
  if (convergence !== undefined) {
    fixedResult.convergence = convergence;
  }
  return {
    path: "a.md",
    lintResult: [],
    fixedResult,
    ...rest,
  };
};

describe("keepLintItem", () => {
  test("keeps items with lint findings", () => {
    expect(
      keepLintItem(
        baseItem({
          lintResult: [
            {
              loc: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 2 },
              },
              message: "x",
              name: "r",
              content: "x",
              severity: 2 as any,
            },
          ],
        })
      )
    ).toBe(true);
  });

  test("keeps items with unapplied fixes", () => {
    expect(
      keepLintItem(
        baseItem({
          fixedResult: {
            result: "",
            notAppliedFixes: [{ range: [0, 1], text: "x" }],
          },
        })
      )
    ).toBe(true);
  });

  test("keeps items with cycle convergence so #98 warning has a target", () => {
    expect(
      keepLintItem(baseItem({ convergence: FixConvergence.CYCLE_DETECTED }))
    ).toBe(true);
  });

  test("keeps items with max convergence so #98 warning has a target", () => {
    expect(
      keepLintItem(baseItem({ convergence: FixConvergence.MAX_ROUNDS }))
    ).toBe(true);
  });

  test("drops items with stable convergence and no other signal", () => {
    expect(keepLintItem(baseItem({ convergence: FixConvergence.STABLE }))).toBe(
      false
    );
  });

  test("drops items with fixedResult: null", () => {
    expect(keepLintItem(baseItem({ fixedResult: null }))).toBe(false);
  });

  test("drops items with fixedResult: undefined", () => {
    expect(keepLintItem(baseItem({ fixedResult: undefined }))).toBe(false);
  });

  test("treats pre-#182 cores (no convergence field) like the old behaviour", () => {
    expect(keepLintItem(baseItem({}))).toBe(false);
  });

  test("keeps items with only execution errors so #96 warning has a target", () => {
    expect(
      keepLintItem(
        baseItem({
          executionErrors: [
            {
              ruleName: "r",
              message: "boom",
              round: 1,
              phase: "fix",
            },
          ],
        })
      )
    ).toBe(true);
  });

  test("drops items without execution errors when nothing else is set", () => {
    expect(keepLintItem(baseItem({ executionErrors: [] }))).toBe(false);
    expect(keepLintItem(baseItem({ executionErrors: undefined }))).toBe(false);
  });
});
