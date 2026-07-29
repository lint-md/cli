import { FixNotAppliedReason, type NotAppliedFix } from "@lint-md/core";

export const makeNotAppliedFix = (
  range: [number, number],
  text: string
): NotAppliedFix => ({
  range,
  text,
  targetRule: "test-rule",
  reason: FixNotAppliedReason.OVERLAP,
});
