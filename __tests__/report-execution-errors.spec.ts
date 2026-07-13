import {
  getExecutionErrorWarnings,
  hasExecutionErrors,
} from "../src/utils/report-execution-errors";
import type { RuleExecutionError } from "@lint-md/core";
import type { BatchLintItem } from "../src/types";

const makeItem = (
  path: string,
  executionErrors?: RuleExecutionError[]
): BatchLintItem => ({
  path,
  lintResult: [],
  ...(executionErrors ? { executionErrors } : {}),
});

describe("report-execution-errors", () => {
  describe("hasExecutionErrors", () => {
    test("returns true when any item has execution errors", () => {
      expect(
        hasExecutionErrors([
          makeItem("a.md"),
          makeItem("b.md", [
            { ruleName: "r", message: "x", round: 1, phase: "fix" },
          ]),
        ])
      ).toBe(true);
    });

    test("returns false when no item has execution errors", () => {
      expect(hasExecutionErrors([makeItem("a.md"), makeItem("b.md")])).toBe(
        false
      );
    });

    test("returns false for empty input", () => {
      expect(hasExecutionErrors([])).toBe(false);
    });
  });

  describe("getExecutionErrorWarnings", () => {
    test("emits one line per error, in input order", () => {
      const items: BatchLintItem[] = [
        makeItem("a.md", [
          {
            ruleName: "rule-a",
            message: "boom",
            round: 1,
            phase: "fix",
            nodeType: "listItem",
          },
        ]),
        makeItem("b.md", [
          {
            ruleName: "rule-b",
            message: "crash",
            round: 3,
            phase: "selector",
          },
        ]),
      ];

      expect(getExecutionErrorWarnings(items)).toEqual([
        "[lint-md] a.md: rule-a failed in fix (round 1, node listItem): boom",
        "[lint-md] b.md: rule-b failed in selector (round 3): crash",
      ]);
    });

    test("omits the node segment when nodeType is missing", () => {
      const [line] = getExecutionErrorWarnings([
        makeItem("c.md", [
          { ruleName: "r", message: "x", round: 2, phase: "create" },
        ]),
      ]);

      expect(line).toBe("[lint-md] c.md: r failed in create (round 2): x");
      expect(line).not.toContain("node undefined");
      expect(line).not.toMatch(/node\s*$/u);
    });

    test("does not deduplicate errors from the same rule across rounds", () => {
      const [first, second] = getExecutionErrorWarnings([
        makeItem("d.md", [
          { ruleName: "r", message: "x", round: 1, phase: "fix" },
          { ruleName: "r", message: "x", round: 2, phase: "fix" },
        ]),
      ]);

      expect(first).toBe("[lint-md] d.md: r failed in fix (round 1): x");
      expect(second).toBe("[lint-md] d.md: r failed in fix (round 2): x");
    });

    test("sanitizes path, ruleName, nodeType and message", () => {
      const [line] = getExecutionErrorWarnings([
        makeItem("evil\n::error::spoof.md", [
          {
            ruleName: "evil-rule\r",
            message: "bad\0text",
            round: 1,
            phase: "fix",
            nodeType: "bad\nnode",
          },
        ]),
      ]);

      expect(line).not.toContain("\n::error::");
      expect(line).toContain("evil");
      expect(line).toContain("spoof.md");
      expect(line).not.toContain("\r");
      expect(line).not.toContain("\0");
    });

    test("returns no warnings when no item has execution errors", () => {
      expect(getExecutionErrorWarnings([makeItem("a.md")])).toEqual([]);
    });
  });
});
