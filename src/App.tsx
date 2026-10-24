import { Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import CreateGamePage from "./pages/CreateGamePage";
import JoinGamePage from "./pages/JoinGamePage";
import HostLobbyPage from "./pages/HostLobbyPage";
import PlayerLobbyPage from "./pages/PlayerLobbyPage";
import HostGamePage from "./pages/HostGamePage";
import PlayerGamePage from "./pages/PlayerGamePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/create" element={<CreateGamePage />} />

      <Route path="/join" element={<JoinGamePage />} />

      <Route
        path="/join/:code"
        element={<JoinGamePage />}
      />

      <Route
        path="/host/:code"
        element={<HostLobbyPage />}
      />

      <Route
        path="/player/:code"
        element={<PlayerLobbyPage />}
      />

      <Route
        path="/host/game/:code"
        element={<HostGamePage />}
      />

      <Route
        path="/play/:code"
        element={<PlayerGamePage />}
      />
    </Routes>
  );
}

export default App;