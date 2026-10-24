import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";

function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(
      Math.random() * characters.length
    );

    code += characters[randomIndex];
  }

  return code;
}

function CreateGamePage() {
  const [loading, setLoading] = useState(false);

  const createRoom = useMutation(api.rooms.createRoom);
  const navigate = useNavigate();

  async function createGame() {
    setLoading(true);

    const newCode = generateRoomCode();

    await createRoom({
      code: newCode,
    });

    navigate(`/host/${newCode}`);
  }

  return (
    <main>
      <h1>Create Game</h1>

      <button
        onClick={createGame}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Lobby"}
      </button>
    </main>
  );
}

export default CreateGamePage;