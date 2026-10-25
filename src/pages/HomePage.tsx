import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "../components/Icon";
import { SoundToggle } from "../components/SoundToggle";
import { startMusic } from "../utils/sfx";

function HomePage() {
  const navigate = useNavigate();

  /* title theme; browsers start it on the first tap anywhere */
  useEffect(() => {
    startMusic("title");
  }, []);

  return (
    <main className="shell shell-phone">
      <div className="entry-sound">
        <SoundToggle />
      </div>

      <section className="entry">
        <h1 className="entry-title">
          <Icon name="crown" />
          Code
          <br />
          Royale
        </h1>

        <p className="entry-lede">
          The coding interview game show. Host on the big screen, play from your phone.
        </p>

        <div className="entry-actions">
          <button type="button" className="btn btn-gold btn-lg btn-block" onClick={() => navigate("/create")}>
            <Icon name="play" />
            Host a game
          </button>

          <button type="button" className="btn btn-lg btn-block" onClick={() => navigate("/join")}>
            <Icon name="phone" />
            Join a game
          </button>
        </div>

        <p className="muted">Ten rounds, up to eight players.</p>
      </section>
    </main>
  );
}

export default HomePage;
