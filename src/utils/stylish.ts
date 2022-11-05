import chalk from 'chalk';
import table from 'text-table';
import stripAnsi from 'strip-ansi';

/**
 * Given a word and a count, append an s if count is not one.
 * @param {string} word A word in its singular form.
 * @param {int} count A number controlling whether word should be pluralized.
 * @returns {string} The original word with an s on the end if count is not one.
 */
function pluralize(word, count) {
  return (count === 1 ? word : `${word}s`);
}

interface Result {
  messages: {
    fatal: boolean
    severity: number
    line: number
    column: number
    message: string
    ruleId: string
  }[]
  errorCount: number
  warningCount: number
  fixableErrorCount: number
  fixableWarningCount: number
  filePath: string
}

export const stylishPrint = (results: Result[]) => {
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
          chalk.dim(message.ruleId || '')
        ];
      }),
      {
        align: ['', 'r', 'l'],
        stringLength(str) {
          return stripAnsi(str).length;
        }
      }
    ).split('\n').map(el => el.replace(/(\d+)\s+(\d+)/u, (m, p1, p2) => chalk.dim(`${p1}:${p2}`))).join('\n')}\n\n`;
  });

  const total = errorCount + warningCount;

  if (total > 0) {
    output += chalk[summaryColor].bold([
      '\u2716 ', total, pluralize(' problem', total),
      ' (', errorCount, pluralize(' error', errorCount), ', ',
      warningCount, pluralize(' warning', warningCount), ')\n'
    ].join(''));

    if (fixableErrorCount > 0 || fixableWarningCount > 0) {
      output += chalk[summaryColor].bold([
        '  ', fixableErrorCount, pluralize(' error', fixableErrorCount), ' and ',
        fixableWarningCount, pluralize(' warning', fixableWarningCount),
        ' potentially fixable with the `--fix` option.\n'
      ].join(''));
    }
  }

  // Resets output color, for prevent change on top level
  return total > 0 ? chalk.reset(output) : '';
};
