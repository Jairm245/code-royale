import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useMutation,
} from "convex/react";

import {
  api,
} from "../../convex/_generated/api";

import { Icon } from "../components/Icon";
import { stopMusic } from "../utils/sfx";

function JoinGamePage() {
  /* phones joining don't play the title theme */
  useEffect(() => {
    stopMusic();
  }, []);

  const navigate =
    useNavigate();

  const {
    code: routeCode,
  } =
    useParams();

  const initialCode =
    (routeCode ?? "")
      .trim()
      .toUpperCase();

  const [
    roomCode,
    setRoomCode,
  ] =
    useState(
      initialCode
    );

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    joining,
    setJoining,
  ] =
    useState(false);

  const joiningRef =
    useRef(false);

  const joinRoom =
    useMutation(
      api.players
        .joinRoom
    );

  async function handleJoin(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      joiningRef.current
    ) {
      return;
    }

    const cleanCode =
      roomCode
        .trim()
        .toUpperCase();

    const cleanName =
      name.trim();

    if (
      cleanCode.length ===
      0
    ) {
      setError(
        "Enter a room code."
      );

      return;
    }

    if (
      cleanName.length ===
      0
    ) {
      setError(
        "Enter your name."
      );

      return;
    }

    joiningRef.current =
      true;

    setJoining(
      true
    );

    setError(
      ""
    );

    try {
      const result =
        await joinRoom({
          roomCode:
            cleanCode,

          name:
            cleanName,
        });

      if (
        !result?.playerId
      ) {
        throw new Error(
          "Player session was not created."
        );
      }

      sessionStorage.setItem(
        "codeRoyalePlayerId",
        String(
          result.playerId
        )
      );

      navigate(
        `/player/${cleanCode}`,
        {
          state: {
            playerId:
              result.playerId,
          },
        }
      );
    } catch (err) {
      console.error(
        "Join room failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not join that room."
      );

      joiningRef.current =
        false;

      setJoining(
        false
      );
    }
  }

  return (
    <main className="shell shell-phone">
      <section className="entry">
        <form className="entry-card panel" onSubmit={handleJoin}>
          <h1>Join a game</h1>

          <div className="field">
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              className="code-input"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              spellCheck={false}
              maxLength={12}
              disabled={joining}
            />
          </div>

          <div className="field">
            <label htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="What should the host call you?"
              autoComplete="nickname"
              enterKeyHint="go"
              maxLength={24}
              disabled={joining}
            />
          </div>

          {error && <div className="notice">{error}</div>}

          <button type="submit" className="btn btn-gold btn-lg btn-block" disabled={joining}>
            <Icon name="play" />
            {joining ? "Joining…" : "Join game"}
          </button>

          <button type="button" className="btn btn-quiet btn-block" onClick={() => navigate("/")} disabled={joining}>
            <Icon name="arrow-left" />
            Back
          </button>
        </form>
      </section>
    </main>
  );
}

export default JoinGamePage;
