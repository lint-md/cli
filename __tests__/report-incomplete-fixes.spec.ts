import {
  getFixDevMetrics,
  getIncompleteFixWarnings,
  isIncompleteFix,
} from "../src/utils/report-incomplete-fixes";
import { FixConvergence } from "@lint-md/core";
import type { FixedResult } from "@lint-md/core";
import type { BatchLintItem } from "../src/types";

const makeItem = (
  overrides: Partial<BatchLintItem> & {
    convergence?: FixConvergence;
    metrics?: FixedResult["metrics"];
  }
): BatchLintItem => {
  const { convergence, metrics, ...rest } = overrides;
  const fixedResult: FixedResult = {
    result: "",
    notAppliedFixes: [],
  };
  if (convergence !== undefined) {
    fixedResult.convergence = convergence;
  }
  if (metrics) {
    fixedResult.metrics = metrics;
  }
  return {
    path: "docs/example.md",
    lintResult: [],
    fixedResult,
    ...rest,
  };
};

describe("report-incomplete-fixes", () => {
  describe("isIncompleteFix", () => {
    test("returns true for cycle convergence", () => {
      expect(
        isIncompleteFix(
          makeItem({ convergence: FixConvergence.CYCLE_DETECTED })
        )
      ).toBe(true);
    });

    test("returns true for max convergence", () => {
      expect(
        isIncompleteFix(makeItem({ convergence: FixConvergence.MAX_ROUNDS }))
      ).toBe(true);
    });

    test("returns false for stable convergence", () => {
      expect(
        isIncompleteFix(makeItem({ convergence: FixConvergence.STABLE }))
      ).toBe(false);
    });

    test("returns false when convergence is undefined (pre-#182 cores)", () => {
      expect(isIncompleteFix(makeItem({}))).toBe(false);
    });

    test("returns false when fixedResult is null", () => {
      expect(isIncompleteFix(makeItem({ fixedResult: null }))).toBe(false);
    });
  });

  describe("getIncompleteFixWarnings", () => {
    test("emits one warning per incomplete item, in input order", () => {
      const items: BatchLintItem[] = [
        makeItem({ path: "a.md", convergence: FixConvergence.STABLE }),
        makeItem({ path: "b.md", convergence: FixConvergence.CYCLE_DETECTED }),
        makeItem({ path: "c.md", convergence: FixConvergence.MAX_ROUNDS }),
        makeItem({ path: "d.md", convergence: FixConvergence.STABLE }),
        makeItem({ path: "e.md", convergence: FixConvergence.CYCLE_DETECTED }),
      ];

      expect(getIncompleteFixWarnings(items)).toEqual([
        "[lint-md] Fix did not fully converge for b.md: cycle.",
        "[lint-md] Fix did not fully converge for c.md: max.",
        "[lint-md] Fix did not fully converge for e.md: cycle.",
      ]);
    });

    test("skips items without a fixedResult", () => {
      const items: BatchLintItem[] = [
        makeItem({ path: "lint-only.md", fixedResult: null }),
        makeItem({
          path: "broken.md",
          convergence: FixConvergence.CYCLE_DETECTED,
        }),
      ];

      expect(getIncompleteFixWarnings(items)).toEqual([
        "[lint-md] Fix did not fully converge for broken.md: cycle.",
      ]);
    });

    test("sanitizes the file path", () => {
      const items: BatchLintItem[] = [
        makeItem({
          path: "evil\n::error::spoof.md",
          convergence: FixConvergence.MAX_ROUNDS,
        }),
      ];

      const [warning] = getIncompleteFixWarnings(items);
      expect(warning).not.toContain("\n::error::");
      expect(warning).toContain("evil");
    });

    test("returns no warnings for a clean fix run", () => {
      const items: BatchLintItem[] = [
        makeItem({ path: "ok.md", convergence: FixConvergence.STABLE }),
        makeItem({ path: "old.md" }),
      ];

      expect(getIncompleteFixWarnings(items)).toEqual([]);
    });
  });

  describe("getFixDevMetrics", () => {
    test("emits one line per item that has metrics", () => {
      const items: BatchLintItem[] = [
        makeItem({
          path: "a.md",
          convergence: FixConvergence.STABLE,
          metrics: { rounds: 1, wallTime: 0.5, perRound: [0.5] },
        }),
        makeItem({ path: "b.md", convergence: FixConvergence.CYCLE_DETECTED }),
        makeItem({
          path: "c.md",
          convergence: FixConvergence.MAX_ROUNDS,
          metrics: { rounds: 10, wallTime: 3.14159, perRound: [0.1, 0.2] },
        }),
      ];

      expect(getFixDevMetrics(items)).toEqual([
        "[lint-md] Fix metrics: a.md: convergence=stable, rounds=1, wallTime=0.50ms",
        "[lint-md] Fix metrics: c.md: convergence=max, rounds=10, wallTime=3.14ms",
      ]);
    });

    test("returns no lines when no item exposes metrics", () => {
      expect(
        getFixDevMetrics([
          makeItem({ path: "a.md", convergence: FixConvergence.STABLE }),
          makeItem({
            path: "b.md",
            convergence: FixConvergence.CYCLE_DETECTED,
          }),
        ])
      ).toEqual([]);
    });
  });
});
