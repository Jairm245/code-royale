/*
  Code Royale icon set — small stroke icons that replace emoji.
  24×24 grid, 2px strokes, currentColor, so they inherit text color
  and scale with font-size (1em).
*/

export type IconName =
  | "crown"
  | "bolt"
  | "shield"
  | "split"
  | "clock"
  | "check"
  | "lock"
  | "phone"
  | "trophy"
  | "flame"
  | "bug"
  | "route"
  | "blocks"
  | "search"
  | "gauge"
  | "spark"
  | "users"
  | "play"
  | "replay"
  | "plus"
  | "arrow-left"
  | "volume"
  | "volume-off"
  | "ear"
  | "flag"
  | "coach";

const PATHS: Record<IconName, string> = {
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  split: "M6 3v6a6 6 0 0 0 6 6 6 6 0 0 1 6 6M18 3v6a6 6 0 0 1-3 5.2M4 21l4-4M20 3l-3 3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  check: "M4 12.5l5 5L20 6.5",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  phone: "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9 18h6",
  flame: "M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4.5-9.5-.5 2.5-2 4-3.5 4.5C11 8 10.5 5 8.5 3 8 7 5 9.5 5 15c0 4.3 3 7 7 7z",
  bug: "M9 7a3 3 0 0 1 6 0M7 10h10v4a5 5 0 0 1-10 0v-4zM12 10v9M3 12h4M17 12h4M4 7l3 2M20 7l-3 2M4 18l3-2M20 18l-3-2",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7",
  blocks: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  gauge: "M4 18a8 8 0 1 1 16 0M12 18l4-6",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  play: "M7 4.5v15l12-7.5-12-7.5z",
  replay: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4",
  plus: "M12 5v14M5 12h14",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  volume: "M4 9h4l5-4v14l-5-4H4V9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  "volume-off": "M4 9h4l5-4v14l-5-4H4V9zM16 9l5 6M21 9l-5 6",
  ear: "M7 10a5 5 0 0 1 10 0c0 3-2.5 3.5-3 6.5-.4 2.4-2 3.5-3.5 3.5M10 10a2 2 0 0 1 4 0",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  coach: "M12 3a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1a4 4 0 0 1-8 0H7a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1V7a4 4 0 0 1 4-4zM9 21h6M12 17v4",
};

const FILLED = new Set<IconName>(["crown", "bolt", "play"]);

export function Icon({
  name,
  size = "1em",
  title,
  className,
}: {
  name: IconName;
  size?: string | number;
  title?: string;
  className?: string;
}) {
  const filled = FILLED.has(name);

  return (
    <svg
      className={`icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* The show's wordmark: crown + condensed marquee lettering. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`wordmark ${compact ? "wordmark-compact" : ""}`}>
      <Icon name="crown" className="wordmark-crown" />
      <span>Code Royale</span>
    </span>
  );
}

/* Question category → icon + plain label (no emoji). */
export function categoryOf(type?: string): { icon: IconName; label: string } {
  switch (type) {
    case "bug_hunt":
      return { icon: "bug", label: "Spot the bug" };
    case "optimal_approach":
      return { icon: "route", label: "Best approach" };
    case "complexity":
      return { icon: "gauge", label: "Complexity" };
    case "data_structure":
      return { icon: "blocks", label: "Data structures" };
    case "edge_case":
      return { icon: "search", label: "Edge case" };
    default:
      return { icon: "spark", label: "Challenge" };
  }
}
