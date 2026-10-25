import { useEffect, useRef } from "react";
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

import { Icon, Wordmark } from "../components/Icon";
import { Curtain, Dots } from "../components/ShowParts";
import { SoundToggle } from "../components/SoundToggle";
import { playSfx, startMusic, unlockAudio } from "../utils/sfx";

const MAX_PLAYERS = 8;

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

  /* lobby music, and a chime each time a contestant joins */
  useEffect(() => {
    startMusic("lobby");
  }, []);

  const seenPlayersRef =
    useRef<number | null>(null);

  useEffect(() => {
    if (players === undefined) {
      return;
    }

    if (
      seenPlayersRef.current !== null &&
      players.length >
        seenPlayersRef.current
    ) {
      void playSfx("join");
    }

    seenPlayersRef.current =
      players.length;
  }, [players]);

  if (
    room === undefined ||
    players === undefined
  ) {
    return (
      <main className="shell shell-host">
        <Curtain icon="crown" title="Opening the studio">
          <Dots />
        </Curtain>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="shell shell-host">
        <Curtain icon="search" title="Room not found">
          <a className="btn btn-gold" href="/create">Create a new room</a>
        </Curtain>
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

    /* the click is the user gesture browsers need for audio */
    await unlockAudio();

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

  const seats =
    Array.from(
      { length: MAX_PLAYERS },
      (_, index) =>
        players[index]
    );

  return (
    <main className="shell shell-host">
      <header className="topbar">
        <Wordmark />
        <span className="sign">Lobby</span>
        <div className="topbar-right">
          <SoundToggle />
        </div>
      </header>

      <section className="lobby">
        <div className="marquee">
          <div className="marquee-inner lobby-join">
            <div>
              <h1>Grab your phone</h1>

              <ol className="lobby-steps">
                <li>Scan the code, or open <strong>{new URL(joinUrl).host}/join</strong></li>
                <li>Enter the room code and your name</li>
                <li>Wait for the host to start</li>
              </ol>

              <div className="lobby-code" aria-label={`Room code ${room.code}`}>
                {room.code}
              </div>

              <div className="lobby-start">
                <button
                  type="button"
                  className="btn btn-gold btn-lg"
                  onClick={handleStart}
                  disabled={players.length === 0}
                >
                  <Icon name="play" />
                  Start the game
                </button>

                <span className="muted">
                  {players.length === 0
                    ? "Waiting for the first player"
                    : `${players.length} of ${MAX_PLAYERS} seats filled`}
                </span>
              </div>
            </div>

            <div className="lobby-qr">
              <QRCodeSVG value={joinUrl} size={220} level="M" includeMargin={false} />
            </div>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-title">
            Contestants
            <small>{players.length}/{MAX_PLAYERS}</small>
          </div>

          <div className="roster">
            {seats.map((player, index) =>
              player ? (
                <div className="contestant" key={player._id}>
                  <div className="contestant-rank">{index + 1}</div>
                  <div className="contestant-name">
                    <strong>{player.name}</strong>
                    <span>Ready</span>
                  </div>
                  <div className="status-dot status-dot-done">
                    <Icon name="check" />
                  </div>
                </div>
              ) : (
                <div className="contestant seat-open" key={`open-${index}`}>
                  <div className="contestant-rank">{index + 1}</div>
                  <div className="contestant-name">
                    <span>Open seat</span>
                  </div>
                  <span />
                </div>
              )
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

export default HostLobbyPage;
