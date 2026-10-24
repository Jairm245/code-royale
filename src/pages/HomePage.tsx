import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();

  return (
    <main className="player-game-shell">
      <section className="entry-screen">
        <div className="entry-brand">
          <div className="entry-brand-icon">
            👑
          </div>

          <p className="eyebrow">
            CODE ROYALE
          </p>

          <h1>
            Coding interviews,
            turned into a battle.
          </h1>

          <p className="entry-subtitle">
            AI-generated challenges,
            live scoring, power-ups,
            sabotage, and comeback mechanics.
          </p>
        </div>

        <div className="entry-actions">
          <button
            className="entry-primary-action"
            onClick={() =>
              navigate("/create")
            }
          >
            <span className="entry-action-icon">
              👑
            </span>

            <div>
              <strong>
                Host Game
              </strong>

              <small>
                Create a room and run the arena
              </small>
            </div>

            <span className="entry-action-arrow">
              →
            </span>
          </button>

          <button
            className="entry-secondary-action"
            onClick={() =>
              navigate("/join")
            }
          >
            <span className="entry-action-icon">
              ⚡
            </span>

            <div>
              <strong>
                Join Game
              </strong>

              <small>
                Enter a room code and compete
              </small>
            </div>

            <span className="entry-action-arrow">
              →
            </span>
          </button>
        </div>

        <div className="entry-feature-row">
          <div className="entry-feature">
            <span>🤖</span>

            <div>
              <strong>
                AI Questions
              </strong>

              <small>
                Fresh coding challenges
              </small>
            </div>
          </div>

          <div className="entry-feature">
            <span>🔥</span>

            <div>
              <strong>
                Comebacks
              </strong>

              <small>
                50/50 boosts for last place
              </small>
            </div>
          </div>

          <div className="entry-feature">
            <span>⚡</span>

            <div>
              <strong>
                Disruption
              </strong>

              <small>
                Lag Spike and Firewall
              </small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;