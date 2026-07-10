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
// Units are explicitly b / k / kb / m / mb / g / gb (case-insensitive);
// decimals, whitespace, 0, negatives, and any other unit are rejected.
// Throws on invalid input so callers can present the error in the CLI
// style (see getMaxFileSizeOption in configure.ts).
export const parseSize = (input: string): number => {
  const match = /^(\d+)(b|k|kb|m|mb|g|gb)$/i.exec(input.trim());
  if (!match) {
    throw new Error("invalid size");
  }
  const multiplier = SIZE_UNITS[match[2].toLowerCase()];
  const bytes = Number(match[1]) * multiplier;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error("invalid size");
  }
  return bytes;
};

const SIZE_LABELS = ["B", "KiB", "MiB", "GiB", "TiB"];

// Formats a byte count with a dynamic unit, picking the largest unit where
// the value stays >= 1 so small files read in B / KiB instead of a
// misleading "0 MiB". One decimal, trailing ".0" dropped.
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_LABELS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1).replace(/\.0$/, "")} ${SIZE_LABELS[unit]}`;
};
