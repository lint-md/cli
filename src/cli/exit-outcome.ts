export type CliExitCode = 0 | 1;

export interface CliExitOutcome {
  readonly exitCode: CliExitCode;
}

export const SUCCESS_EXIT: CliExitOutcome = { exitCode: 0 };
export const FAILURE_EXIT: CliExitOutcome = { exitCode: 1 };
