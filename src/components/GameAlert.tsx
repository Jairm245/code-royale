import {
  useEffect,
} from "react";

type GameAlertProps = {
  message: string;

  type?:
    | "success"
    | "danger"
    | "shield"
    | "powerup";

  onClose: () => void;
};

function GameAlert({
  message,
  type = "powerup",
  onClose,
}: GameAlertProps) {
  useEffect(() => {
    const timer =
      setTimeout(
        onClose,
        2200
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    message,
    onClose,
  ]);

  return (
    <div
      className={`game-alert game-alert-${type}`}
    >
      <div className="game-alert-content">
        {message}
      </div>
    </div>
  );
}

export default GameAlert;