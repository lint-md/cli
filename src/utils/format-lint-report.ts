import chalk from "chalk";
import table from "text-table";
import stripAnsi from "strip-ansi";
import type { LintSummary } from "./summarize-lint-results";
import { sanitizeTerminalText } from "./sanitize-terminal";

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

export const formatLintReport = (summary: LintSummary): string => {
  const {
    errorCount,
    files,
    fixableErrorCount,
    fixableWarningCount,
    warningCount,
  } = summary;
  const total = errorCount + warningCount;

  if (total === 0) {
    return "";
  }

  const summaryColor = errorCount > 0 ? "red" : "yellow";
  let output = "\n";

  for (const file of files) {
    output += `${chalk.underline(sanitizeTerminalText(file.filePath))}\n`;
    output += `${table(
      file.messages.map((message) => {
        const messageType =
          message.severity === 2 ? chalk.red("error") : chalk.yellow("warning");

        return [
          "",
          message.line || 0,
          message.column || 0,
          messageType,
          sanitizeTerminalText(message.message).replace(/([^ ])\.$/u, "$1"),
          chalk.dim(sanitizeTerminalText(message.ruleId || "")),
        ];
      }),
      {
        // text-table treats undefined like "" (default alignment).
        align: [undefined, "r", "l"],
        stringLength(value) {
          return stripAnsi(value).length;
        },
      }
    )
      .split("\n")
      .map((line) =>
        line.replace(/(\d+)\s+(\d+)/u, (match, lineNumber, columnNumber) =>
          chalk.dim(`${lineNumber}:${columnNumber}`)
        )
      )
      .join("\n")}\n\n`;
  }

  output += chalk[summaryColor].bold(
    [
      "\u2716 ",
      total,
      pluralize(" problem", total),
      " (",
      errorCount,
      pluralize(" error", errorCount),
      ", ",
      warningCount,
      pluralize(" warning", warningCount),
      ")\n",
    ].join("")
  );

  if (fixableErrorCount > 0 || fixableWarningCount > 0) {
    output += chalk[summaryColor].bold(
      [
        "  ",
        fixableErrorCount,
        pluralize(" error", fixableErrorCount),
        " and ",
        fixableWarningCount,
        pluralize(" warning", fixableWarningCount),
        " potentially fixable with the `--fix` option.\n",
      ].join("")
    );
  }

  return chalk.reset(output);
};
