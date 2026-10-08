import { IsDateString, IsIn, IsObject, IsOptional } from "class-validator";

export const TRACKER_STAGES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export class SaveTrackerDto {
  @IsOptional()
  @IsIn(TRACKER_STAGES)
  stage?: (typeof TRACKER_STAGES)[number];

  /** ISO date, or null to clear the follow-up. */
  @IsOptional()
  @IsDateString()
  nextFollowUp?: string | null;

  /** Map of stage -> free-text notes. Only supplied stages are updated. */
  @IsOptional()
  @IsObject()
  stageNotes?: Record<string, string>;
}
