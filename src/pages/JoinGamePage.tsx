import {
  type FormEvent,
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

function JoinGamePage() {
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
    <main className="host-game-shell entry-page-shell">
      <section className="entry-screen">
        <div className="entry-brand">
          <div className="entry-brand-icon">
            ⚔️
          </div>

          <p className="host-eyebrow">
            ENTER THE ARENA
          </p>

          <h1>
            Join
            Code Royale
          </h1>

          <p className="entry-subtitle">
            Enter your room code
            and choose the name
            your rivals will see.
          </p>
        </div>

        <form
          className="entry-form-card"
          onSubmit={
            handleJoin
          }
        >
          <div className="entry-field">
            <label
              className="entry-label"
              htmlFor="room-code"
            >
              ROOM CODE
            </label>

            <input
              id="room-code"
              className="entry-input entry-code-input"
              value={
                roomCode
              }
              onChange={(
                event
              ) =>
                setRoomCode(
                  event.target
                    .value
                    .toUpperCase()
                )
              }
              placeholder="ABCD12"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={
                false
              }
              maxLength={
                12
              }
              disabled={
                joining
              }
            />
          </div>

          <div className="entry-field">
            <label
              className="entry-label"
              htmlFor="player-name"
            >
              PLAYER NAME
            </label>

            <input
              id="player-name"
              className="entry-input"
              value={
                name
              }
              onChange={(
                event
              ) =>
                setName(
                  event.target
                    .value
                )
              }
              placeholder="Your name"
              autoComplete="nickname"
              maxLength={
                24
              }
              disabled={
                joining
              }
            />
          </div>

          {error && (
            <div className="entry-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="entry-submit-button"
            disabled={
              joining
            }
          >
            <span>
              {joining
                ? "Joining battle..."
                : "Join Battle"}
            </span>

            <span>
              →
            </span>
          </button>

          <button
            type="button"
            className="entry-back-button"
            onClick={() =>
              navigate("/")
            }
            disabled={
              joining
            }
          >
            ← Back home
          </button>
        </form>

        <div className="entry-feature-row">
          <div className="entry-feature">
            <span>
              🧠
            </span>

            <div>
              <strong>
                Think fast
              </strong>

              <small>
                Speed boosts your score
              </small>
            </div>
          </div>

          <div className="entry-feature">
            <span>
              🛡️
            </span>

            <div>
              <strong>
                Counter rivals
              </strong>

              <small>
                Queue defenses for next round
              </small>
            </div>
          </div>

          <div className="entry-feature">
            <span>
              🏆
            </span>

            <div>
              <strong>
                Climb the board
              </strong>

              <small>
                Win the 10-round battle
              </small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default JoinGamePage;