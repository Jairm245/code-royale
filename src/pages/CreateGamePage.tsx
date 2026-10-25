import {
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useMutation,
} from "convex/react";

import {
  api,
} from "../../convex/_generated/api";

/*
  Avoid characters that are easy
  to confuse on a phone screen.
*/
const ROOM_CODE_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(
  length = 6
) {
  let code = "";

  for (
    let i = 0;
    i < length;
    i += 1
  ) {
    const index =
      Math.floor(
        Math.random() *
          ROOM_CODE_CHARS.length
      );

    code +=
      ROOM_CODE_CHARS[
        index
      ] ?? "A";
  }

  return code;
}

function CreateGamePage() {
  const navigate =
    useNavigate();

  const creatingRef =
    useRef(false);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const createRoom =
    useMutation(
      api.rooms
        .createRoom
    );

  async function handleCreate() {
    if (
      creatingRef.current
    ) {
      return;
    }

    creatingRef.current =
      true;

    setCreating(
      true
    );

    setError(
      ""
    );

    try {
      const roomCode =
        generateRoomCode();

      await createRoom({
        code:
          roomCode,
      });

      navigate(
        `/host/${roomCode}`
      );
    } catch (err) {
      console.error(
        "Create room failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not create a room."
      );

      creatingRef.current =
        false;

      setCreating(
        false
      );
    }
  }

  return (
    <main className="host-game-shell entry-page-shell">
      <section className="entry-screen">
        <div className="entry-brand">
          <div className="entry-brand-icon">
            👑
          </div>

          <p className="host-eyebrow">
            HOST A BATTLE
          </p>

          <h1>
            Create a
            Code Royale
            room
          </h1>

          <p className="entry-subtitle">
            Launch a 10-round
            coding showdown with
            live answers, power-ups,
            and an AI Coach.
          </p>
        </div>

        <div className="entry-form-card">
          <div className="entry-form-heading">
            <div className="entry-action-icon">
              ⚔️
            </div>

            <div>
              <span>
                NEW ARENA
              </span>

              <strong>
                Ready to host?
              </strong>
            </div>
          </div>

          <div className="entry-feature-row entry-feature-row-compact">
            <div className="entry-feature">
              <span>
                🔟
              </span>

              <div>
                <strong>
                  10 rounds
                </strong>

                <small>
                  Rotating question modes
                </small>
              </div>
            </div>

            <div className="entry-feature">
              <span>
                ⚡
              </span>

              <div>
                <strong>
                  Power-Ups
                </strong>

                <small>
                  Tactical next-round effects
                </small>
              </div>
            </div>

            <div className="entry-feature">
              <span>
                🤖
              </span>

              <div>
                <strong>
                  AI Coach
                </strong>

                <small>
                  Explains missed questions
                </small>
              </div>
            </div>
          </div>

          {error && (
            <div className="entry-error">
              {error}
            </div>
          )}

          <button
            type="button"
            className="entry-submit-button"
            onClick={
              handleCreate
            }
            disabled={
              creating
            }
          >
            <span>
              {creating
                ? "Creating arena..."
                : "Create Game"}
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
              creating
            }
          >
            ← Back home
          </button>
        </div>

        <p className="entry-footer-note">
          A room code and QR
          code will be generated
          for your players.
        </p>
      </section>
    </main>
  );
}

export default CreateGamePage;