import { useEffect } from "react";

import { Icon, type IconName } from "./Icon";

type GameAlertProps = {
  message: string;
  type?: "success" | "danger" | "shield" | "powerup";
  onClose: () => void;
};

const ICONS: Record<NonNullable<GameAlertProps["type"]>, IconName> = {
  success: "check",
  danger: "bolt",
  shield: "shield",
  powerup: "spark",
};

function GameAlert({ message, type = "powerup", onClose }: GameAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2200);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <Icon name={ICONS[type]} />
      <span>{message}</span>
    </div>
  );
}

export default GameAlert;
