export type GoalStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type PointType = "knowledge" | "concept" | "skill" | "task" | "project";
export type PointLevel = "basic" | "intermediate" | "advanced";
export type PointStatus = "todo" | "learning" | "learned" | "reviewing" | "mastered" | "paused";
export type ReviewGrade = "again" | "hard" | "good" | "easy";

export interface GoalFrontmatter {
  id: string;
  title: string;
  status: GoalStatus;
  focus: string;
  summary: string;
  startDate: string | null;
  targetDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PointFrontmatter {
  id: string;
  title: string;
  domain: string;
  type: PointType;
  level: PointLevel;
  tags: string[];
  relate: string[];
  estimatedMinutes: number;
  status: PointStatus;
  mastery: number;
  confidence: number;
  lastStudiedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  lapseCount: number;
  intervalDays: number;
  ease: number;
  createdAt: string;
  updatedAt: string;
}

export interface PointIndexEntry {
  id: string;
  title: string;
  path: string;
  domain: string;
  type: PointType;
  level: PointLevel;
  status: PointStatus;
  mastery: number;
  confidence: number;
  nextReviewAt: string | null;
  tags: string[];
  relate: string[];
}

export interface LearningIndex {
  schemaVersion: string;
  goalId: string;
  generatedAt: string;
  points: PointIndexEntry[];
}

export interface ReviewLogEvent {
  pointId: string;
  pointPath: string;
  reviewedAt: string;
  grade: ReviewGrade;
  masteryBefore: number;
  masteryAfter: number;
  intervalDaysBefore: number;
  intervalDaysAfter: number;
  nextReviewAt: string;
  note?: string;
}
