import type { ScoringPeriod, GoalAssist } from "./nhl-types";

export function getPeriodLabel(period: ScoringPeriod): string {
  const { number, periodType } = period.periodDescriptor;
  if (periodType === "OT") return "OT";
  if (periodType === "SO") return "SO";
  return `P${number}`;
}

export function formatAssists(assists: GoalAssist[]): string {
  if (assists.length === 0) return "Unassisted";
  return assists.map((a) => `${a.firstName.default} ${a.lastName.default}`).join(", ");
}
