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

import { Icon, Wordmark } from "../components/Icon";
import { Curtain, Dots } from "../components/ShowParts";

import { stopMusic } from "../utils/sfx";

function PlayerLobbyPage() {
  useEffect(() => {
    stopMusic();
  }, []);

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
      <main className="shell shell-phone">
        <Curtain icon="crown" title="Joining">
          <Dots />
        </Curtain>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="shell shell-phone">
        <Curtain icon="search" title="Room not found">
          <p>Check the code on the host screen and join again.</p>
          <a className="btn btn-gold" href="/join">Join a game</a>
        </Curtain>
      </main>
    );
  }

  if (!playerId || !currentPlayer) {
    return (
      <main className="shell shell-phone">
        <Curtain icon="users" title="Join again">
          <p>This phone isn't in the game yet. Rejoin with the room code.</p>
          <a className="btn btn-gold" href={`/join/${room.code}`}>Rejoin room {room.code}</a>
        </Curtain>
      </main>
    );
  }

  const seat =
    players.findIndex(
      (player) =>
        player._id ===
        currentPlayer._id
    ) + 1;

  return (
    <main className="shell shell-phone">
      <header className="phone-head">
        <Wordmark compact />
        <span className="plate">
          Room <strong>{room.code}</strong>
        </span>
      </header>

      <section className="lobby-card">
        <div className="avatar">
          {currentPlayer.name.charAt(0).toUpperCase()}
        </div>

        <h1>{currentPlayer.name}</h1>

        <div className="banner banner-good">
          <Icon name="check" />
          You're in. Watch the big screen.
        </div>

        <div className="facts">
          <div className="fact">
            <span>Your seat</span>
            <strong>{seat}</strong>
          </div>
          <div className="fact">
            <span>Players</span>
            <strong>{players.length}/8</strong>
          </div>
        </div>

        <p className="muted">
          The game starts when the host is ready. Questions are read aloud first, then you have 20 seconds to answer.
        </p>

        <Dots />
      </section>
    </main>
  );
}

export default PlayerLobbyPage;
