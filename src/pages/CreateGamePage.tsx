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

import { Icon } from "../components/Icon";

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
    <main className="shell shell-phone">
      <section className="entry">
        <div className="entry-card panel">
          <h1>Host a game</h1>

          <ul className="entry-facts">
            <li>
              <Icon name="flag" />
              <span>
                <strong>Ten rounds</strong> of AI-written coding questions: data structures, spot the bug,
                best approach, and edge cases.
              </span>
            </li>
            <li>
              <Icon name="users" />
              <span>
                <strong>Up to eight players</strong> join from their phones with a room code or QR code.
              </span>
            </li>
            <li>
              <Icon name="coach" />
              <span>
                <strong>An AI coach</strong> walks through any question nobody gets right.
              </span>
            </li>
          </ul>

          {error && <div className="notice">{error}</div>}

          <button type="button" className="btn btn-gold btn-lg btn-block" onClick={handleCreate} disabled={creating}>
            <Icon name="play" />
            {creating ? "Creating room…" : "Create room"}
          </button>

          <button type="button" className="btn btn-quiet btn-block" onClick={() => navigate("/")} disabled={creating}>
            <Icon name="arrow-left" />
            Back
          </button>
        </div>
      </section>
    </main>
  );
}

export default CreateGamePage;
