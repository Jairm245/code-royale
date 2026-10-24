import { useState,useRef} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useMutation,
} from "convex/react";

import {
  api,
} from "../../convex/_generated/api";

function JoinGamePage() {

    const joiningRef =
  useRef(false);

const [
  joining,
  setJoining,
] =
  useState(false);
  const navigate =
    useNavigate();

  const [
    roomCode,
    setRoomCode,
  ] =
    useState("");

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

  const joinRoom =
    useMutation(
      api.players.joinRoom
    );

 async function handleJoin() {
  if (joiningRef.current) {
    return;
  }

  try {
    joiningRef.current =
      true;

    setJoining(true);
    setError("");

    const cleanCode =
      roomCode
        .trim()
        .toUpperCase();

    const cleanName =
      name.trim();

    if (
      !cleanCode ||
      !cleanName
    ) {
      setError(
        "Enter a room code and name."
      );

      joiningRef.current =
        false;

      setJoining(false);

      return;
    }

    const result =
      await joinRoom({
        roomCode:
          cleanCode,

        name:
          cleanName,
      });

    sessionStorage.setItem(
      "codeRoyalePlayerId",
      String(result.playerId)
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
  } catch (error) {
    console.error(
      "Join failed:",
      error
    );

    setError(
      "Could not join that room."
    );

    joiningRef.current =
      false;

    setJoining(false);
  }
}

  return (
    <main>
      <h1>
        Join Code Royale
      </h1>

      <input
        placeholder="Room Code"
        value={roomCode}
        maxLength={5}
        onChange={(e) =>
          setRoomCode(
            e.target.value
              .toUpperCase()
          )
        }
      />

      <input
        placeholder="Your Name"
        value={name}
        onChange={(e) =>
          setName(
            e.target.value
          )
        }
      />

     <button
  onClick={
    handleJoin
  }
  disabled={
    joining
  }
>
  {joining
    ? "Joining..."
    : "Join Game"}
</button>

      {error && (
        <p>
          {error}
        </p>
      )}
    </main>
  );
}

export default JoinGamePage;
