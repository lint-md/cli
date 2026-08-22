import chalk from "chalk";

export type CliErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_INVALID"
  | "INVALID_THREADS"
  | "INVALID_MAX_FILE_SIZE"
  | "CONFLICTING_INPUT";

export class CliError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "CliError";
  }
}

export const formatCliError = (error: CliError): unknown[] => {
  const output: unknown[] = [chalk.red(error.message)];

  if (error.detail !== undefined) {
    output.push(error.detail);
  }

  return output;
};
