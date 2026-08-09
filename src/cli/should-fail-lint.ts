export interface LintFailureInput {
  errorCount: number;
  warningCount: number;
  hasRuleFailures: boolean;
  suppressWarnings: boolean;
}

export const shouldFailLint = ({
  errorCount,
  hasRuleFailures,
  suppressWarnings,
  warningCount,
}: LintFailureInput): boolean =>
  errorCount > 0 || hasRuleFailures || (!suppressWarnings && warningCount > 0);
