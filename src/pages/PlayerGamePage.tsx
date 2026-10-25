import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useParams,
} from "react-router-dom";

import {
  useMutation,
  useQuery,
} from "convex/react";

import {
  api,
} from "../../convex/_generated/api";

import type {
  Id,
} from "../../convex/_generated/dataModel";

import {
  useCountdown,
} from "../hooks/useCountdown";

import GameAlert from "../components/GameAlert";

function getQuestionTypeLabel(
  type?: string
) {
  switch (type) {
    case "bug_hunt":
      return "🐛 BUG HUNT";

    case "optimal_approach":
      return "⚡ OPTIMAL APPROACH";

    case "complexity":
      return "⏱️ COMPLEXITY";

    case "data_structure":
      return "🧱 DATA STRUCTURES";

    case "edge_case":
      return "🔍 EDGE CASE";

    default:
      return "CODE ROYALE";
  }
}

function PlayerGamePage() {
  const { code } =
    useParams();

  const location =
    useLocation();

  const [
    selectedAnswer,
    setSelectedAnswer,
  ] =
    useState<
      number | null
    >(null);



  const [
    hiddenAnswers,
    setHiddenAnswers,
  ] =
    useState<number[]>([]);

  const [
    powerUpMessage,
    setPowerUpMessage,
  ] =
    useState("");

  const [
    alertType,
    setAlertType,
  ] =
    useState<
      | "success"
      | "danger"
      | "shield"
      | "powerup"
    >("powerup");


  const [
    queuedFirewall,
    setQueuedFirewall,
  ] =
    useState(false);


  /*
    Used to detect when this player
    receives a new Lag Spike.
  */
  const previousPenaltyRef =
    useRef(0);

  /*
    Detect newly earned Lag Spikes without
    firing an alert for the initial inventory.
  */
  const previousLagInventoryRef =
    useRef<number | null>(
      null
    );

  const applyingEffectsRoundRef =
    useRef<number | null>(
      null
    );


  /*
    After a finished game, keep the player on
    a transition screen until the new Round 1
    question AND a fresh timer are both ready.
    This prevents the previous game's expired
    question from flashing at 0 seconds.
  */
  const restartingGameRef =
    useRef(false);

  /*
    QUERIES
  */

  const room =
    useQuery(
      api.rooms
        .getRoomByCode,
      code
        ? {
            code,
          }
        : "skip"
    );

  const statePlayerId =
    location.state?.playerId as
      | Id<"players">
      | undefined;

  const storedPlayerId =
    sessionStorage.getItem(
      "codeRoyalePlayerId"
    );

  const playerId =
    statePlayerId ??
    (storedPlayerId
      ? (storedPlayerId as Id<"players">)
      : null);

  /*
    Keep the browser session synced
    if the ID came from router state.
  */
  useEffect(() => {
    if (!playerId) {
      return;
    }

    sessionStorage.setItem(
      "codeRoyalePlayerId",
      String(playerId)
    );
  }, [
    playerId,
  ]);

  /*
    Track the boundary between the completed
    game and a replay.
  */
  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status ===
      "finished"
    ) {
      restartingGameRef.current =
        true;

      return;
    }

    const freshRoundOneReady =
      room.status ===
        "playing" &&
      room.currentRound ===
        1 &&
      Boolean(
        room.question
      ) &&
      Boolean(
        room.choices?.length
      ) &&
      room.questionEndsAt !==
        undefined &&
      room.questionEndsAt >
        Date.now();

    if (
      restartingGameRef.current &&
      freshRoundOneReady
    ) {
      restartingGameRef.current =
        false;
    }
  }, [
    room?.status,
    room?.currentRound,
    room?.question,
    room?.choices,
    room?.questionEndsAt,
  ]);

  const players =
    useQuery(
      api.players
        .getPlayersByRoom,
      room
        ? {
            roomId:
              room._id,
          }
        : "skip"
    );

  const currentPlayer =
    players &&
    playerId
      ? players.find(
          (player) =>
            player._id ===
            playerId
        )
      : undefined;

  const answers =
    useQuery(
      api.answers
        .getAnswersForRound,
      room
        ? {
            roomId:
              room._id,

            round:
              room.currentRound,
          }
        : "skip"
    );

  /*
    MUTATIONS
  */

  const submitAnswer =
    useMutation(
      api.answers
        .submitAnswer
    );

  const useFiftyFifty =
    useMutation(
      (api as any)
        .powerups
        .useFiftyFifty
    );

  const activateFirewall =
    useMutation(
      (api as any)
        .powerups
        .activateFirewall
    );

  const useLagSpike =
    useMutation(
      (api as any)
        .powerups
        .useLagSpike
    );

  const applyQueuedForRound =
    useMutation(
      (api as any)
        .powerups
        .applyQueuedForRound
    );

  /*
    TIMER
  */

  const baseSecondsRemaining =
    useCountdown(
      room?.questionEndsAt
    );

  const secondsRemaining =
    Math.max(
      0,
      baseSecondsRemaining -
        (currentPlayer
          ?.timePenalty ??
          0)
    );

  /*
    GUARANTEE NEXT-ROUND POWERUPS APPLY

    The host normally applies queued effects
    before starting the next question. This
    player-side check is a safety net so a
    Lag Spike / Firewall / 50-50 cannot be
    missed because of a transition race.

    applyQueuedForRound is idempotent, so it
    is safe if the host already applied it.
  */
  useEffect(() => {
    if (
      !room ||
      !currentPlayer ||
      room.status !==
        "playing" ||
      room.currentRound <= 1
    ) {
      return;
    }

    if (
      (currentPlayer
        .effectsRound ??
        0) ===
      room.currentRound
    ) {
      applyingEffectsRoundRef.current =
        null;

      return;
    }

    if (
      applyingEffectsRoundRef.current ===
      room.currentRound
    ) {
      return;
    }

    applyingEffectsRoundRef.current =
      room.currentRound;

    void applyQueuedForRound({
      roomId:
        room._id,

      round:
        room.currentRound,
    }).catch(
      (error) => {
        console.error(
          "Failed to apply queued powerups:",
          error
        );

        applyingEffectsRoundRef.current =
          null;
      }
    );
  }, [
    room?._id,
    room?.status,
    room?.currentRound,
    currentPlayer
      ?.effectsRound,
    applyQueuedForRound,
  ]);

  /*
    RESET NEW ROUND
  */

  useEffect(() => {
    setSelectedAnswer(
      null
    );

    setHiddenAnswers(
      []
    );

    setPowerUpMessage(
      ""
    );


    setQueuedFirewall(
      false
    );

    previousPenaltyRef.current =
      0;
  }, [
    room?.currentRound,
  ]);

  /*
    APPLY LOCAL UI FOR NEXT-ROUND EFFECTS
  */

  useEffect(() => {
    if (
      !currentPlayer ||
      !room ||
      room.status !==
        "playing"
    ) {
      return;
    }

    const penalty =
      currentPlayer.timePenalty ??
      0;

    const blocked =
      currentPlayer
        .firewallBlockedThisRound ??
      false;

    if (blocked) {
      setAlertType(
        "shield"
      );

      setPowerUpMessage(
        penalty > 0
          ? `🛡️ Firewall blocked one Lag Spike. Other attacks still cost ${penalty}s.`
          : "🛡️ Firewall blocked a Lag Spike!"
      );
    } else if (
      penalty >
      previousPenaltyRef.current
    ) {
      const difference =
        penalty -
        previousPenaltyRef.current;

      setAlertType(
        "danger"
      );

      setPowerUpMessage(
        `⚡ LAG SPIKE! -${difference} seconds this round`
      );
    }

    previousPenaltyRef.current =
      penalty;
  }, [
    room?.currentRound,
    room?.status,
    currentPlayer
      ?.timePenalty,
    currentPlayer
      ?.firewallBlockedThisRound,
  ]);

  /*
    Notify the player when a milestone
    awards another Lag Spike.
  */
  useEffect(() => {
    if (!currentPlayer) {
      return;
    }

    const currentCount =
      currentPlayer.lagSpike ??
      0;

    if (
      previousLagInventoryRef.current ===
      null
    ) {
      previousLagInventoryRef.current =
        currentCount;

      return;
    }

    if (
      currentCount >
        previousLagInventoryRef.current &&
      room?.status ===
        "results"
    ) {
      setAlertType(
        "powerup"
      );

      setPowerUpMessage(
        "⚡ Lag Spike earned! 3-streak or 5-correct milestone reached."
      );
    }

    previousLagInventoryRef.current =
      currentCount;
  }, [
    currentPlayer
      ?.lagSpike,
    room?.status,
  ]);

  /*
    LOADING
  */

  if (
    room === undefined ||
    players === undefined ||
    answers === undefined
  ) {
    return (
      <main className="player-game-shell">
        <div className="player-loading">
          <div className="loading-crown">
            👑
          </div>

          <h2>
            Loading Code Royale...
          </h2>
        </div>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="player-game-shell">
        <h2>
          Game not found.
        </h2>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="player-game-shell">
        <h2>
          Player session not found.
        </h2>

        <p>
          Please rejoin the room.
        </p>
      </main>
    );
  }

  if (!currentPlayer) {
    return (
      <main className="player-game-shell">
        <h2>
          Player not found.
        </h2>
      </main>
    );
  }

  /*
    ANSWER
  */

  async function handleAnswer(
    index: number
  ) {
    if (!room) {
      return;
    }

    if (!currentPlayer) {
      return;
    }

    if (
      selectedAnswer !== null ||
      secondsRemaining <= 0
    ) {
      return;
    }

    setSelectedAnswer(index);

    try {
      const response =
        await submitAnswer({
          roomId:
            room._id,

          playerId:
            currentPlayer._id,

          answerIndex:
            index,
        });

      

      if (
        response.correct
      ) {
        setAlertType(
          "success"
        );

        setPowerUpMessage(
          `🔥 Correct! +${response.points}`
        );
      }
    } catch (error) {
      console.error(
        "Failed to submit answer:",
        error
      );

      setSelectedAnswer(
        null
      );
    }
  }

  /*
    50 / 50
  */

  async function handleFiftyFifty() {
    if (
      !room ||
      !currentPlayer
    ) {
      return;
    }

    if (
      selectedAnswer !==
        null ||
      secondsRemaining <=
        0 ||
      hiddenAnswers.length >
        0 ||
      (currentPlayer
        .fiftyFifty ??
        0) <= 0 ||
      room.correctAnswer ===
        undefined ||
      !Array.isArray(
        room.choices
      )
    ) {
      return;
    }

    const correctAnswer =
      room.correctAnswer;

    const wrongIndexes =
      room.choices
        .map(
          (
            _choice,
            index
          ) => index
        )
        .filter(
          (index) =>
            index !==
            correctAnswer
        );

    const shuffled = [
      ...wrongIndexes,
    ].sort(
      () =>
        Math.random() -
        0.5
    );

    const answersToHide =
      shuffled.slice(
        0,
        2
      );

    try {
      await useFiftyFifty({
        playerId:
          currentPlayer._id,
      });

      setHiddenAnswers(
        answersToHide
      );

      setAlertType(
        "powerup"
      );

      setPowerUpMessage(
        "✂️ 50 / 50 activated! Two wrong answers removed."
      );
    } catch (error) {
      console.error(
        "50/50 failed:",
        error
      );
    }
  }

  /*
    FIREWALL
  */

  async function handleFirewall() {
    if (
      !room ||
      !currentPlayer
    ) {
      return;
    }

    if (
      room.currentRound >=
        10 ||
      queuedFirewall ||
      selectedAnswer !==
        null ||
      secondsRemaining <=
        0 ||
      (currentPlayer
        .firewall ??
        0) <= 0
    ) {
      return;
    }

    try {
      const response =
        await activateFirewall({
          playerId:
            currentPlayer._id,
        });

      setQueuedFirewall(
        true
      );

      setAlertType(
        "shield"
      );

      setPowerUpMessage(
        `🛡️ Firewall queued for Round ${
          response
            ?.queuedForRound ??
          room.currentRound + 1
        }`
      );
    } catch (error) {
      console.error(
        "Firewall failed:",
        error
      );
    }
  }

  /*
    LAG SPIKE
  */

  async function handleLagSpike(
    targetId:
      Id<"players">,

    targetName:
      string
  ) {
    if (
      !room ||
      !currentPlayer
    ) {
      return;
    }

    if (
      targetId ===
      currentPlayer._id
    ) {
      return;
    }

    if (
      room.currentRound >=
        10 ||
      selectedAnswer !==
        null ||
      secondsRemaining <=
        0 ||
      (currentPlayer
        .lagSpike ??
        0) <= 0
    ) {
      return;
    }

    try {
      const response =
        await useLagSpike({
          attackerId:
            currentPlayer._id,

          targetId,
        });

      setAlertType(
        "danger"
      );

      setPowerUpMessage(
        `⚡ Lag Spike queued against ${targetName} for Round ${
          response
            ?.queuedForRound ??
          room.currentRound + 1
        }`
      );
    } catch (error) {
      console.error(
        "Lag Spike failed:",
        error
      );
    }
  }

  /*
    FINAL RESULTS
  */

  if (
    room.status ===
    "finished"
  ) {
    const finalPlayers =
      [
        ...players,
      ].sort(
        (
          a,
          b
        ) =>
          b.score -
          a.score
      );

    const placement =
      finalPlayers.findIndex(
        (player) =>
          player._id ===
          currentPlayer._id
      ) + 1;

    const isWinner =
      placement === 1;

    return (
      <main className="player-game-shell">
        <header className="player-topbar">
          <div>
            <span className="topbar-logo">
              👑
            </span>

            <strong>
              CODE ROYALE
            </strong>
          </div>

          <div className="score-chip">
            {currentPlayer.score} pts
          </div>
        </header>

        <section className="results-card">
          <p className="eyebrow">
            GAME COMPLETE
          </p>

          <div className="results-icon">
            {isWinner
              ? "👑"
              : "🏆"}
          </div>

          <h1>
            {isWinner
              ? "You won!"
              : `You placed #${placement}`}
          </h1>

          <div className="points-earned">
            {currentPlayer.score}
          </div>

          <p>
            final points
          </p>

          <div className="correct-answer-card">
            <span>
              FINAL PLACEMENT
            </span>

            <strong>
              #{placement} of{" "}
              {finalPlayers.length}
            </strong>
          </div>

          <div className="player-score-pill">
            {isWinner
              ? "👑"
              : "⚔️"}{" "}
            {currentPlayer.name}

            <span>
              {currentPlayer.score} pts
            </span>
          </div>

          <p className="next-round-text">
            {isWinner
              ? "You are the Code Royale champion."
              : "Thanks for playing Code Royale."}
          </p>
        </section>
      </main>
    );
  }

  /*
    AI COACH PLAYER SCREEN
  */

  if (
    room.status ===
    "explanation"
  ) {
    return (
      <main className="player-game-shell">
        <div className="coach-player-card">
          <div className="coach-player-icon">
            🤖
          </div>

          <p className="eyebrow">
            AI COACH
          </p>

          <h1>
            Nobody got it
          </h1>

          <p>
            Watch the main
            screen for the
            explanation.
          </p>

          <div className="coach-thinking">
            <span />
            <span />
            <span />
          </div>
        </div>
      </main>
    );
  }

  /*
    RESULTS
  */

  if (
    room.status ===
    "results"
  ) {
    const playerAnswer =
      answers.find(
        (answer) =>
          answer.playerId ===
          currentPlayer._id
      );

    return (
      <main className="player-game-shell">
        {powerUpMessage && (
          <GameAlert
            message={
              powerUpMessage
            }
            type={
              alertType
            }
            onClose={() =>
              setPowerUpMessage(
                ""
              )
            }
          />
        )}

        <section className="results-card">
          <p className="eyebrow">
            ROUND{" "}
            {room.currentRound}
          </p>

          {playerAnswer?.correct ? (
            <>
              <div className="results-icon">
                🔥
              </div>

              <h1>
                Correct!
              </h1>

              <div className="points-earned">
                +
                {
                  playerAnswer.points
                }
              </div>

              <p>
                points
              </p>
            </>
          ) : (
            <>
              <div className="results-icon">
                👀
              </div>

              <h1>
                Not Quite
              </h1>

              <p>
                You'll get
                the next one.
              </p>
            </>
          )}

          <div className="correct-answer-card">
            <span>
              Correct answer
            </span>

            <strong>
              {room.correctAnswer !==
                undefined &&
              room.choices
                ? room.choices[
                    room
                      .correctAnswer
                  ]
                : "Unknown"}
            </strong>
          </div>

          <div className="player-score-pill">
            👑{" "}
            {
              currentPlayer.name
            }

            <span>
              {
                currentPlayer.score
              }{" "}
              pts
            </span>
          </div>

          {(currentPlayer
            .fiftyFifty ??
            0) > 0 && (
            <div className="comeback-banner">
              🔥 Comeback
              boost ready
              for next
              round!
            </div>
          )}

          <p className="next-round-text">
            Next round
            loading...
          </p>
        </section>
      </main>
    );
  }

  /*
    ROUND TRANSITION FALLBACK

    Convex can briefly move the room through a
    transition state while the host is generating
    or loading the next question. On slower mobile
    devices that gap can otherwise look like a
    blank/black screen.
  */

  const freshQuestionTimerReady =
    room.questionEndsAt !==
      undefined &&
    room.questionEndsAt >
      Date.now();

  if (
    restartingGameRef.current ||
    room.status !==
      "playing" ||
    !room.question ||
    !room.choices ||
    !freshQuestionTimerReady
  ) {
    return (
      <main className="player-game-shell">
        <header className="player-topbar">
          <div>
            <span className="topbar-logo">
              👑
            </span>

            <strong>
              CODE ROYALE
            </strong>
          </div>

          <div className="score-chip">
            {currentPlayer.score} pts
          </div>
        </header>

        <div className="player-loading">
          <div className="loading-crown">
            ⚔️
          </div>

          <h2>
            {restartingGameRef.current
              ? "New game starting..."
              : "Next round loading..."}
          </h2>

          <p
            style={{
              opacity: 0.6,
              textAlign: "center",
              marginTop: "8px",
            }}
          >
            {restartingGameRef.current
              ? "Resetting the arena for Round 1."
              : "Get ready for the next challenge."}
          </p>
        </div>
      </main>
    );
  }

  /*
    TIMER RING
  */

  const timerDanger =
    secondsRemaining <= 5;

  const totalRoundTime =
    20;

  const timerPercent =
    Math.max(
      0,
      Math.min(
        100,
        (secondsRemaining /
          totalRoundTime) *
          100
      )
    );

  return (
    <main className="player-game-shell">
      {powerUpMessage && (
        <GameAlert
          message={
            powerUpMessage
          }
          type={
            alertType
          }
          onClose={() =>
            setPowerUpMessage(
              ""
            )
          }
        />
      )}

      <header className="player-topbar">
        <div>
          <span className="topbar-logo">
            👑
          </span>

          <strong>
            CODE ROYALE
          </strong>
        </div>

        <div className="score-chip">
          {
            currentPlayer.score
          }{" "}
          pts
        </div>
      </header>

      <section className="round-info">
        <span className="round-chip">
          ROUND{" "}
          {
            room.currentRound
          }
        </span>

        <span className="question-type-chip">
          {getQuestionTypeLabel(
            room.questionType
          )}
        </span>
      </section>

      <section className="timer-section">
        <div
          className={`timer-ring ${
            timerDanger
              ? "timer-danger"
              : ""
          }`}
          style={{
            background: `conic-gradient(
              currentColor ${timerPercent}%,
              rgba(255,255,255,0.1) ${timerPercent}%
            )`,
          }}
        >
          <div className="timer-ring-inner">
            <strong>
              {
                secondsRemaining
              }
            </strong>

            <span>
              SEC
            </span>
          </div>
        </div>

        {(currentPlayer
          .timePenalty ??
          0) > 0 && (
          <div className="penalty-chip">
            ⚡ -
            {
              currentPlayer
                .timePenalty
            }
            s
          </div>
        )}
      </section>

      <section className="question-card">
        <p className="question-label">
          QUESTION
        </p>

        <h1>
          {room.question ??
            "Loading question..."}
        </h1>
      </section>

      <section className="answer-grid">
        {room.choices?.map(
          (
            choice,
            index
          ) => {
            if (
              hiddenAnswers.includes(
                index
              )
            ) {
              return null;
            }

            const isSelected =
              selectedAnswer ===
              index;

            return (
              <button
                key={index}
                className={`answer-card answer-${index} ${
                  isSelected
                    ? "answer-selected"
                    : ""
                }`}
                onClick={() =>
                  handleAnswer(
                    index
                  )
                }
                disabled={
                  selectedAnswer !==
                    null ||
                  secondsRemaining <=
                    0
                }
              >
                <span className="answer-letter">
                  {String.fromCharCode(
                    65 + index
                  )}
                </span>

                <span className="answer-text">
                  {choice}
                </span>

                {isSelected && (
                  <span className="answer-lock">
                    🔒
                  </span>
                )}
              </button>
            );
          }
        )}
      </section>

      {selectedAnswer !==
        null && (
        <div className="locked-banner">
          🔒 Answer
          locked in
        </div>
      )}

      {secondsRemaining ===
        0 &&
        selectedAnswer ===
          null && (
          <div className="times-up-banner">
            ⏱️ Time's
            up!
          </div>
        )}

      <section className="ability-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              YOUR LOADOUT
            </p>

            <h2>
              Power-Ups
            </h2>
          </div>
        </div>

        {room.currentRound >=
          10 && (
          <div className="firewall-active-banner">
            🏁 FINAL ROUND ·
            Lag Spike and Firewall
            cannot be queued
          </div>
        )}

        <div className="ability-grid">
          <button
            className="ability-card ability-comeback"
            onClick={
              handleFiftyFifty
            }
            disabled={
              (currentPlayer
                .fiftyFifty ??
                0) <= 0 ||
              selectedAnswer !==
                null ||
              secondsRemaining <=
                0 ||
              hiddenAnswers.length >
                0
            }
          >
            <div className="ability-icon">
              🔥
            </div>

            <strong>
              50 / 50
            </strong>

            <span>
              Remove 2 wrong
              answers now
            </span>

            <div className="ability-count">
              {
                currentPlayer
                  .fiftyFifty ??
                0
              }
              x
            </div>
          </button>

          <button
            className="ability-card ability-firewall"
            onClick={
              handleFirewall
            }
            disabled={
              room.currentRound >=
                10 ||
              queuedFirewall ||
              (currentPlayer
                .firewall ??
                0) <= 0 ||
              selectedAnswer !==
                null ||
              secondsRemaining <=
                0
            }
          >
            <div className="ability-icon">
              🛡️
            </div>

            <strong>
              Firewall
            </strong>

            <span>
              Next round: block
              one attack
            </span>

            <div className="ability-count">
              {
                currentPlayer
                  .firewall ??
                0
              }
              x
            </div>
          </button>
        </div>

        {currentPlayer
          .firewallActive && (
          <div className="firewall-active-banner">
            🛡️ FIREWALL
            ACTIVE
          </div>
        )}
      </section>

      <section className="sabotage-panel">
        <p className="eyebrow">
          DISRUPTION
        </p>

        <h2>
          Attack a Rival
        </h2>

        {(currentPlayer
          .lagSpike ??
          0) > 0 ? (
          <div className="target-list">
            {players
              .filter(
                (player) =>
                  player._id !==
                  currentPlayer._id
              )
              .map(
                (player) => (
                  <button
                    key={
                      player._id
                    }
                    className="target-button"
                    onClick={() =>
                      handleLagSpike(
                        player._id,
                        player.name
                      )
                    }
                    disabled={
                      room.currentRound >=
                        10 ||
                      selectedAnswer !==
                        null ||
                      secondsRemaining <=
                        0 ||
                      (currentPlayer
                        .lagSpike ??
                        0) <= 0
                    }
                  >
                    <span>
                      ⚡
                    </span>

                    <div>
                      <strong>
                        Lag Spike
                      </strong>

                      <small>
                        {player.name} ·
                        next round -5s
                      </small>
                    </div>

                    <span className="target-arrow">
                      →
                    </span>
                  </button>
                )
              )}
          </div>
        ) : (
          <div className="empty-sabotage">
            ⚡ Lag Spike
            used
          </div>
        )}
      </section>
    </main>
  );
}

export default PlayerGamePage;