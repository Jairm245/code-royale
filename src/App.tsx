import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

/*
  Every page is its own chunk. A player's phone only downloads the
  join → lobby → play pages; the host-only code (AI Coach animation,
  structure visuals, QR code, question/voice orchestration) is never
  sent to phones.
*/
const HomePage = lazy(() => import("./pages/HomePage"));
const CreateGamePage = lazy(() => import("./pages/CreateGamePage"));
const JoinGamePage = lazy(() => import("./pages/JoinGamePage"));
const HostLobbyPage = lazy(() => import("./pages/HostLobbyPage"));
const PlayerLobbyPage = lazy(() => import("./pages/PlayerLobbyPage"));
const HostGamePage = lazy(() => import("./pages/HostGamePage"));
const PlayerGamePage = lazy(() => import("./pages/PlayerGamePage"));

function PageFallback() {
  return <div className="shell" aria-busy="true" />;
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateGamePage />} />
        <Route path="/join" element={<JoinGamePage />} />
        <Route path="/join/:code" element={<JoinGamePage />} />
        <Route path="/host/:code" element={<HostLobbyPage />} />
        <Route path="/player/:code" element={<PlayerLobbyPage />} />
        <Route path="/host/game/:code" element={<HostGamePage />} />
        <Route path="/play/:code" element={<PlayerGamePage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
