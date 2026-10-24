import {
  useEffect,
} from "react";

import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useQuery,
} from "convex/react";

import type {
  Id,
} from "../../convex/_generated/dataModel";

import {
  api,
} from "../../convex/_generated/api";

function PlayerLobbyPage() {
  const { code } =
    useParams();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const room =
    useQuery(
      api.rooms.getRoomByCode,
      code
        ? {
            code,
          }
        : "skip"
    );

  const statePlayerId =
    location.state?.playerId as
      | Id<"players">
      | undefined;

  const storedPlayerId =
    sessionStorage.getItem(
      "codeRoyalePlayerId"
    );

  const playerId =
    statePlayerId ??
    (storedPlayerId
      ? (storedPlayerId as Id<"players">)
      : null);

  /*
    Keep sessionStorage synced even
    if the player ID arrived through
    React Router state.
  */
  useEffect(() => {
    if (!playerId) {
      return;
    }

    sessionStorage.setItem(
      "codeRoyalePlayerId",
      String(playerId)
    );
  }, [
    playerId,
  ]);

  const players =
    useQuery(
      api.players.getPlayersByRoom,
      room
        ? {
            roomId:
              room._id,
          }
        : "skip"
    );

  const currentPlayer =
    players &&
    playerId
      ? players.find(
          (player) =>
            player._id ===
            playerId
        )
      : undefined;

  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status ===
        "playing" &&
      playerId
    ) {
      navigate(
        `/play/${room.code}`,
        {
          state: {
            playerId,
          },
        }
      );
    }
  }, [
    room?.status,
    room?.code,
    playerId,
    navigate,
  ]);

  if (
    room === undefined ||
    players === undefined
  ) {
    return (
      <main className="player-game-shell">
        <div className="player-loading">
          <div className="loading-crown">
            ⚡
          </div>

          <h2>
            Joining lobby...
          </h2>
        </div>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="player-game-shell">
        <h2>
          Room not found.
        </h2>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="player-game-shell">
        <h2>
          Player session not found.
        </h2>

        <p>
          Please rejoin the room.
        </p>
      </main>
    );
  }

  if (!currentPlayer) {
    return (
      <main className="player-game-shell">
        <h2>
          Player not found.
        </h2>

        <p>
          Please rejoin the room.
        </p>
      </main>
    );
  }

  return (
    <main className="player-game-shell">
      <header className="player-topbar">
        <div>
          <span className="topbar-logo">
            👑
          </span>

          <strong>
            CODE ROYALE
          </strong>
        </div>

        <div className="score-chip">
          ROOM {room.code}
        </div>
      </header>

      <section className="player-lobby-card">
        <div className="player-lobby-avatar">
          {currentPlayer.name
            .charAt(0)
            .toUpperCase()}
        </div>

        <p className="eyebrow">
          YOU&apos;RE READY
        </p>

        <h1>
          {currentPlayer.name}
        </h1>

        <div className="player-ready-badge">
          ✓ READY
        </div>

        <p className="player-lobby-copy">
          Waiting for the host to start the battle.
        </p>

        <div className="coach-thinking">
          <span />
          <span />
          <span />
        </div>

        <div className="player-lobby-stats">
          <div>
            <span>
              PLAYERS
            </span>

            <strong>
              {players.length}
            </strong>
          </div>

          <div>
            <span>
              ROOM
            </span>

            <strong>
              {room.code}
            </strong>
          </div>
        </div>

        <div className="player-lobby-tip">
          ⚡ Power-ups unlock during the battle.
        </div>
      </section>
    </main>
  );
}

export default PlayerLobbyPage;
