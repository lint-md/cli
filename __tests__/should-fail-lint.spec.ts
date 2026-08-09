import { shouldFailLint } from "../src/cli/should-fail-lint";

interface FailureCase {
  errorCount: number;
  warningCount: number;
  hasRuleFailures: boolean;
  suppressWarnings: boolean;
  expected: boolean;
}

const failureCases: FailureCase[] = [
  {
    errorCount: 0,
    warningCount: 0,
    hasRuleFailures: false,
    suppressWarnings: false,
    expected: false,
  },
  {
    errorCount: 0,
    warningCount: 0,
    hasRuleFailures: true,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 0,
    warningCount: 1,
    hasRuleFailures: false,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 0,
    warningCount: 1,
    hasRuleFailures: true,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 0,
    hasRuleFailures: false,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 0,
    hasRuleFailures: true,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 1,
    hasRuleFailures: false,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 1,
    hasRuleFailures: true,
    suppressWarnings: false,
    expected: true,
  },
  {
    errorCount: 0,
    warningCount: 0,
    hasRuleFailures: false,
    suppressWarnings: true,
    expected: false,
  },
  {
    errorCount: 0,
    warningCount: 0,
    hasRuleFailures: true,
    suppressWarnings: true,
    expected: true,
  },
  {
    errorCount: 0,
    warningCount: 1,
    hasRuleFailures: false,
    suppressWarnings: true,
    expected: false,
  },
  {
    errorCount: 0,
    warningCount: 1,
    hasRuleFailures: true,
    suppressWarnings: true,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 0,
    hasRuleFailures: false,
    suppressWarnings: true,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 0,
    hasRuleFailures: true,
    suppressWarnings: true,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 1,
    hasRuleFailures: false,
    suppressWarnings: true,
    expected: true,
  },
  {
    errorCount: 1,
    warningCount: 1,
    hasRuleFailures: true,
    suppressWarnings: true,
    expected: true,
  },
];

describe("shouldFailLint", () => {
  test.each(failureCases)(
    "returns $expected for errors=$errorCount warnings=$warningCount rule failures=$hasRuleFailures suppression=$suppressWarnings",
    ({
      errorCount,
      expected,
      hasRuleFailures,
      suppressWarnings,
      warningCount,
    }) => {
      expect(
        shouldFailLint({
          errorCount,
          hasRuleFailures,
          suppressWarnings,
          warningCount,
        })
      ).toBe(expected);
    }
  );
});
