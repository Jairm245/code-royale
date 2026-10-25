import { useState } from "react";

import { Icon } from "./Icon";
import { isMuted, setMuted, unlockAudio } from "../utils/sfx";

/* Host-screen mute for music and sound effects (remembered per browser). */
export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => {
        void unlockAudio();
        setMuted(!muted);
        setMutedState(!muted);
      }}
      aria-label={muted ? "Turn sound on" : "Mute sound"}
      title={muted ? "Turn sound on" : "Mute sound"}
    >
      <Icon name={muted ? "volume-off" : "volume"} />
    </button>
  );
}
