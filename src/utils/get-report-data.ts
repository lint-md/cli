import chalk from 'chalk';
import table from 'text-table';
import stripAnsi from 'strip-ansi';
import type { OutputFormat } from '../types';

/**
 * Given a word and a count, append an s if count is not one.
 * @param {string} word A word in its singular form.
 * @param {number} count A number controlling whether word should be pluralized.
 * @returns {string} The original word with an s on the end if count is not one.
 */
function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

interface ResultMessage {
  fatal: boolean
  severity: number
  line: number
  column: number
  message: string
  ruleId: string
}

interface Result {
  messages: ResultMessage[]
  errorCount: number
  warningCount: number
  fixableErrorCount: number
  fixableWarningCount: number
  filePath: string
}

interface JsonMessage {
  line: number
  column: number
  severity: number
  message: string
  ruleId: string
}

interface JsonResult {
  path: string
  messages: JsonMessage[]
}

const buildResults = (problemResult: any[]): Result[] => {
  return problemResult
    .map((res) => {
      const { path, lintResult } = res;

      const errorCount = lintResult.filter(
        item => item.severity === 2
      ).length;

      const warningCount = lintResult.filter(
        item => item.severity === 1
      ).length;

      if (errorCount + warningCount === 0) {
        return null;
      }

      return {
        errorCount,
        filePath: path,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        messages: lintResult.map((lintItem) => {
          const { loc, message, severity, name } = lintItem;
          return {
            column: loc.start.column,
            fatal: false,
            line: loc.start.line,
            message,
            ruleId: name,
            severity,
          };
        }),
        warningCount,
      };
    })
    .filter(Boolean);
};

const formatJsonResult = (results: Result[]) => {
  const jsonResults: JsonResult[] = results.map((result) => {
    return {
      path: result.filePath,
      messages: result.messages.map((msg) => {
        return {
          line: msg.line,
          column: msg.column,
          severity: msg.severity,
          message: msg.message,
          ruleId: msg.ruleId,
        };
      }),
    };
  });

  const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
  const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0);

  return {
    consoleMessage: JSON.stringify(jsonResults, null, 2),
    errorCount,
    warningCount,
  };
};

// TODO: 补充类型定义
export const getReportData = (problemResult: any[], format: OutputFormat = 'default') => {
  const results: Result[] = buildResults(problemResult);

  if (format === 'json') {
    return formatJsonResult(results);
  }

  let output = '\n';
  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;
  let summaryColor = 'yellow';

  results.forEach((result) => {
    const messages = result.messages;

    if (messages.length === 0) {
      return;
    }

    errorCount += result.errorCount;
    warningCount += result.warningCount;
    fixableErrorCount += result.fixableErrorCount;
    fixableWarningCount += result.fixableWarningCount;

    output += `${chalk.underline(result.filePath)}\n`;

    output += `${table(
      messages.map((message) => {
        let messageType;

        if (message.fatal || message.severity === 2) {
          messageType = chalk.red('error');
          summaryColor = 'red';
        }
 else {
          messageType = chalk.yellow('warning');
        }

        return [
          '',
          message.line || 0,
          message.column || 0,
          messageType,
          message.message.replace(/([^ ])\.$/u, '$1'),
          chalk.dim(message.ruleId || ''),
        ];
      }),
      {
        align: ['', 'r', 'l'],
        stringLength(str) {
          return stripAnsi(str).length;
        },
      }
    )
      .split('\n')
      .map(el =>
        el.replace(/(\d+)\s+(\d+)/u, (m, p1, p2) => chalk.dim(`${p1}:${p2}`))
      )
      .join('\n')}\n\n`;
  });

  const total = errorCount + warningCount;

  if (total > 0) {
    output += chalk[summaryColor].bold(
      [
        '\u2716 ',
        total,
        pluralize(' problem', total),
        ' (',
        errorCount,
        pluralize(' error', errorCount),
        ', ',
        warningCount,
        pluralize(' warning', warningCount),
        ')\n',
      ].join('')
    );

    if (fixableErrorCount > 0 || fixableWarningCount > 0) {
      output += chalk[summaryColor].bold(
        [
          '  ',
          fixableErrorCount,
          pluralize(' error', fixableErrorCount),
          ' and ',
          fixableWarningCount,
          pluralize(' warning', fixableWarningCount),
          ' potentially fixable with the `--fix` option.\n',
        ].join('')
      );
    }
  }

  // Resets output color, for prevent change on top level
  return {
    consoleMessage: total > 0 ? chalk.reset(output) : '',
    errorCount,
    warningCount,
  };
};
