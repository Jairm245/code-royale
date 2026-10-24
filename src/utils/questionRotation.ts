export const QUESTION_ROTATION = [
  "data_structure",
  "optimal_approach",
  "bug_hunt",
  "complexity",
  "edge_case",
] as const;

export type QuestionType =
  (typeof QUESTION_ROTATION)[number];

export function getQuestionTypeForRound(
  round: number
): QuestionType {
  const safeRound =
    Math.max(1, round);

  const index =
    (safeRound - 1) %
    QUESTION_ROTATION.length;

  return QUESTION_ROTATION[index];
}