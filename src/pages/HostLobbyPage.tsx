import { useEffect } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useMutation,
  useQuery,
} from "convex/react";

import {
  QRCodeSVG,
} from "qrcode.react";

import {
  api,
} from "../../convex/_generated/api";

function HostLobbyPage() {
  const { code } =
    useParams();

  const navigate =
    useNavigate();

  const room =
    useQuery(
      api.rooms.getRoomByCode,
      code
        ? {
            code,
          }
        : "skip"
    );

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

  const startGame =
    useMutation(
      api.rooms.startGame
    );

  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status ===
      "playing"
    ) {
      navigate(
        `/host/game/${room.code}`
      );
    }
  }, [
    room?.status,
    room?.code,
    navigate,
  ]);

  if (
    room === undefined ||
    players === undefined
  ) {
    return (
      <main className="host-game-shell">
        <div className="host-loading">
          <div className="host-loading-crown">
            👑
          </div>

          <h2>
            Loading lobby...
          </h2>
        </div>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="host-game-shell">
        <h2>
          Room not found.
        </h2>
      </main>
    );
  }

  const joinUrl =
    `https://code-royale-orcin.vercel.app/join/${room.code}`;

  async function handleStart() {
    if (!room || !players) {
      return;
    }

    if (
      players.length === 0
    ) {
      return;
    }

    try {
      await startGame({
        roomId:
          room._id,
      });
    } catch (error) {
      console.error(
        "Failed to start game:",
        error
      );
    }
  }

  return (
    <main className="host-game-shell">
      <header className="host-topbar">
        <div className="host-brand">
          <span>
            👑
          </span>

          CODE ROYALE
        </div>

        <div className="host-room-chip">
          ROOM {room.code}
        </div>
      </header>

      <section className="lobby-game-layout">
        <div className="lobby-main-card">
          <div className="lobby-title-row">
            <div>
              <p className="host-eyebrow">
                HOST LOBBY
              </p>

              <h1>
                Ready the arena
              </h1>

              <p>
                Players can scan the QR code
                or enter the room code.
              </p>
            </div>

            <div className="lobby-live-chip">
              ● LIVE
            </div>
          </div>

          <div className="lobby-access-grid">
            <div className="lobby-code-panel">
              <p className="host-eyebrow">
                ROOM CODE
              </p>

              <div className="lobby-big-code">
                {room.code}
              </div>

              <p className="lobby-helper-text">
                Enter this code on the join screen.
              </p>
            </div>

            <div className="lobby-qr-panel">
              <QRCodeSVG
                value={joinUrl}
                size={210}
                level="H"
                includeMargin
              />

              <span>
                Scan to join
              </span>
            </div>
          </div>

          <button
            className="lobby-battle-button"
            onClick={
              handleStart
            }
            disabled={
              players.length === 0
            }
          >
            <span>
              Start Battle
            </span>

            <span>
              →
            </span>
          </button>

          {players.length ===
            0 && (
            <p className="lobby-disabled-hint">
              Waiting for at least one player.
            </p>
          )}
        </div>

        <aside className="host-live-panel">
          <div className="host-panel-heading">
            <span>
              👥
            </span>

            <h2>
              Players
            </h2>
          </div>

          <div className="lobby-count-row">
            <span>
              Ready
            </span>

            <strong>
              {players.length}
            </strong>
          </div>

          {players.length >
          0 ? (
            <div className="host-leaderboard-list">
              {players.map(
                (
                  player,
                  index
                ) => (
                  <div
                    className="host-leaderboard-row"
                    key={
                      player._id
                    }
                  >
                    <div className="host-rank">
                      {index +
                        1}
                    </div>

                    <div className="host-player-info">
                      <strong>
                        {
                          player.name
                        }
                      </strong>

                      <span>
                        Ready to play
                      </span>
                    </div>

                    <div className="lobby-ready-indicator">
                      ✓
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="lobby-empty-state">
              <div>
                👀
              </div>

              <strong>
                Waiting for players
              </strong>

              <span>
                New players will appear here live.
              </span>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default HostLobbyPage;