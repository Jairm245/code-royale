import { useEffect, useState } from "react";

/*
  Answers unlock when the host finishes reading the question
  (server moves answersOpenAt to "now") or at the 10 s cap.
  Re-renders at the moment they open; reports reading progress
  toward the cap for the "listening" clock.
*/
export function useAnswersOpen(
  answersOpenAt?: number,
  questionStartedAt?: number
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());

    if (answersOpenAt === undefined || Date.now() >= answersOpenAt) {
      return;
    }

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= answersOpenAt) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [answersOpenAt]);

  const open = answersOpenAt === undefined || now >= answersOpenAt;
  const span =
    answersOpenAt !== undefined && questionStartedAt !== undefined
      ? Math.max(1, answersOpenAt - questionStartedAt)
      : 10_000;
  const readingProgress =
    open || answersOpenAt === undefined
      ? 1
      : Math.min(1, Math.max(0, 1 - (answersOpenAt - now) / span));

  return { open, readingProgress };
}
