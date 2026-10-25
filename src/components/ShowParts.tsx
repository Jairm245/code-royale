import { Icon } from "./Icon";

/*
  The show clock. While the question is being read it shows an
  ear and a blue arc filling toward the 10 s cap; once answers
  open it counts the 20 s answer window down in gold, red at 5.
*/
export function Clock({
  seconds,
  total = 20,
  reading = false,
  readingProgress = 0,
  size = 132,
}: {
  seconds: number;
  total?: number;
  reading?: boolean;
  readingProgress?: number;
  size?: number;
}) {
  const stroke = Math.max(6, size * 0.075);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = reading
    ? readingProgress
    : Math.max(0, Math.min(1, seconds / total));
  const danger = !reading && seconds <= 5;

  return (
    <div
      className={`clock ${reading ? "clock-reading" : ""} ${danger ? "clock-danger" : ""}`}
      style={{ ["--clock-size" as string]: `${size}px` }}
      role="timer"
      aria-label={reading ? "Question is being read" : `${seconds} seconds left`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="clock-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="clock-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>

      <div className="clock-face">
        {reading ? (
          <>
            <Icon name="ear" />
            <span>Listen</span>
          </>
        ) : (
          <>
            <strong>{seconds}</strong>
            <span>sec</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function Curtain({
  icon = "crown",
  title,
  children,
}: {
  icon?: Parameters<typeof Icon>[0]["name"];
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="curtain">
      <div className="icon-badge">
        <Icon name={icon} />
      </div>
      <h1>{title}</h1>
      {children}
    </section>
  );
}
