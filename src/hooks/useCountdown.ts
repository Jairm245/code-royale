import { useEffect, useState } from "react";

export function useCountdown(
  endTime?: number
) {
  const [remaining, setRemaining] =
    useState(0);

  useEffect(() => {
    if (!endTime) {
      setRemaining(0);
      return;
    }

    function updateTimer() {
      const timeLeft = Math.max(
        0,
        endTime! - Date.now()
      );

      setRemaining(
        Math.ceil(timeLeft / 1000)
      );
    }

    updateTimer();

    const interval = setInterval(
      updateTimer,
      250
    );

    return () => clearInterval(interval);
  }, [endTime]);

  return remaining;
}