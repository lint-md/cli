const SIZE_UNITS: Record<string, number> = {
  b: 1,
  k: 1024,
  kb: 1024,
  m: 1024 ** 2,
  mb: 1024 ** 2,
  g: 1024 ** 3,
  gb: 1024 ** 3,
};

// Parses a human size string (e.g. "5mb", "500kb", "1gb") into bytes.
// Rejects decimals (1.5mb), whitespace (1 mb), 0, negatives, and any
// unrecognized unit. Throws on invalid input so callers can present the
// error in the CLI style (see getMaxFileSizeOption in configure.ts).
export const parseSize = (input: string): number => {
  const match = /^(\d+)([bkmg]+)$/i.exec(input.trim());
  if (!match) {
    throw new Error('invalid size');
  }
  const multiplier = SIZE_UNITS[match[2].toLowerCase()];
  if (!multiplier) {
    throw new Error('invalid size');
  }
  const bytes = Number(match[1]) * multiplier;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error('invalid size');
  }
  return bytes;
};

// Formats bytes as "X.X MiB", dropping a trailing ".0" to match the
// issue's warning examples (8.3 MiB, 5 MiB).
export const formatMiB = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MiB`;
