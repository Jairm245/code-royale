export const QUESTION_ROTATION = [
  "data_structure",
  "bug_hunt",
  "data_structure",
  "bug_hunt",
  "optimal_approach",
  "data_structure",
  "bug_hunt",
  "edge_case",
  "data_structure",
  "bug_hunt",
] as const;

export type QuestionType =
  (typeof QUESTION_ROTATION)[number];

export function getQuestionTypeForRound(
  round: number
): QuestionType {
  const safeRound =
    Math.max(
      1,
      round
    );

  const index =
    (safeRound - 1) %
    QUESTION_ROTATION.length;

  return QUESTION_ROTATION[
    index
  ];
}
