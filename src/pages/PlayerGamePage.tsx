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

import {
  Icon,
  categoryOf,
} from "../components/Icon";

import {
  Clock,
  Curtain,
  Dots,
} from "../components/ShowParts";

import {
  useAnswersOpen,
} from "../hooks/useAnswersOpen";

/* light haptic feedback on phones that support it */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
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
    Answers stay locked until the host has read the
    question (or 10 s pass); the 20 s timer starts then.
  */
  const {
    open: answersOpen,
    readingProgress,
  } = useAnswersOpen(
    room?.answersOpenAt,
    room?.questionStartedAt
  );

  const openedBuzzRoundRef =
    useRef<number | null>(null);

  useEffect(() => {
    if (
      room?.status ===
        "playing" &&
      answersOpen &&
      openedBuzzRoundRef.current !==
        room.currentRound
    ) {
      openedBuzzRoundRef.current =
        room.currentRound;
      buzz(30);
    }
  }, [
    room?.status,
    room?.currentRound,
    answersOpen,
  ]);

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
          ? `Firewall blocked one Lag Spike. Other attacks still cost ${penalty}s.`
          : "Firewall blocked a Lag Spike!"
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
        `LAG SPIKE! -${difference} seconds this round`
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
        "Lag Spike earned! 3-streak or 5-correct milestone reached."
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
      <main className="shell shell-phone">
        <Curtain icon="crown" title="Loading">
          <Dots />
        </Curtain>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="shell shell-phone">
        <Curtain icon="search" title="Game not found">
          <a className="btn btn-gold" href="/join">Join a game</a>
        </Curtain>
      </main>
    );
  }

  if (!playerId || !currentPlayer) {
    return (
      <main className="shell shell-phone">
        <Curtain icon="users" title="Join again">
          <p>This phone isn't in the game. Rejoin with the room code.</p>
          <a className="btn btn-gold" href={`/join/${room.code}`}>Rejoin room {room.code}</a>
        </Curtain>
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
      secondsRemaining <= 0 ||
      !answersOpen
    ) {
      return;
    }

    setSelectedAnswer(index);
    buzz(18);

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
          `Correct! +${response.points}`
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
      currentPlayer.powerupRound ===
      room.currentRound
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
        "50 / 50 activated! Two wrong answers removed."
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
      currentPlayer.powerupRound ===
      room.currentRound
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
        `Firewall queued for Round ${
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
      currentPlayer.powerupRound ===
      room.currentRound
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
        `Lag Spike queued against ${targetName} for Round ${
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

  const head = (
    <header className="phone-head">
      <div className="phone-id">
        <span className="avatar">{currentPlayer.name.charAt(0).toUpperCase()}</span>
        <strong>{currentPlayer.name}</strong>
      </div>
      <span className="score">
        {currentPlayer.score}
        <small>pts</small>
      </span>
    </header>
  );

  const toast = powerUpMessage ? (
    <GameAlert message={powerUpMessage} type={alertType} onClose={() => setPowerUpMessage("")} />
  ) : null;

  /*
    FINAL RESULTS
  */

  if (
    room.status ===
    "finished"
  ) {
    const finalPlayers =
      [...players].sort(
        (a, b) =>
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
      <main className="shell shell-phone">
        {head}

        <section className={`verdict ${isWinner ? "verdict-good" : ""}`}>
          <div className="verdict-badge" style={isWinner ? undefined : { background: "var(--velvet-2)", color: "var(--gold)" }}>
            <Icon name={isWinner ? "crown" : "trophy"} />
          </div>

          <h1>{isWinner ? "You won" : `${placement}${ordinal(placement)} place`}</h1>

          <div className="verdict-points">{currentPlayer.score}</div>
          <p className="muted">final points, {placement} of {finalPlayers.length}</p>

          <p className="muted">Watch the big screen for the podium.</p>
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
      <main className="shell shell-phone">
        {head}
        <Curtain icon="coach" title="Coach time">
          <p>Nobody got that one. The coach is explaining it on the big screen.</p>
          <Dots />
        </Curtain>
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

    const correctIndex =
      room.correctAnswer;

    const correctText =
      correctIndex !== undefined &&
      room.choices
        ? room.choices[correctIndex]
        : "Unknown";

    return (
      <main className="shell shell-phone">
        {toast}
        {head}

        <section className={`verdict ${playerAnswer?.correct ? "verdict-good" : "verdict-bad"}`}>
          <div className="verdict-badge">
            <Icon name={playerAnswer?.correct ? "check" : playerAnswer ? "flame" : "clock"} />
          </div>

          <h1>
            {playerAnswer?.correct
              ? "Correct"
              : playerAnswer
                ? "Not this time"
                : "No answer"}
          </h1>

          {playerAnswer?.correct && <div className="verdict-points">+{playerAnswer.points}</div>}

          <div className="answer-was">
            <span>The answer</span>
            {correctIndex !== undefined && (
              <div className={`tile tile-${correctIndex}`}>
                <span className="tile-key">{String.fromCharCode(65 + correctIndex)}</span>
                <span className="tile-text">{correctText}</span>
              </div>
            )}
          </div>

          {(currentPlayer.fiftyFifty ?? 0) > 0 && (
            <div className="banner banner-gold">
              <Icon name="split" />
              Comeback boost: you have a 50/50 for the next round
            </div>
          )}

          <p className="muted">
            {room.currentRound >= 10 ? "Final results are next" : "Next question coming up"}
          </p>
        </section>
      </main>
    );
  }

  /*
    ROUND TRANSITION FALLBACK
    Convex can briefly move the room through a
    transition state while the host is generating
    or loading the next question.
  */
  const freshQuestionTimerReady =
    room.questionEndsAt !== undefined &&
    room.questionEndsAt > Date.now();

  if (
    restartingGameRef.current ||
    room.status !== "playing" ||
    !room.question ||
    !room.choices ||
    !freshQuestionTimerReady
  ) {
    return (
      <main className="shell shell-phone">
        {head}
        <Curtain icon={restartingGameRef.current ? "replay" : "crown"} title={restartingGameRef.current ? "New game" : "Get ready"}>
          <p>
            {restartingGameRef.current
              ? "Scores are reset. Round 1 is on its way."
              : "The next question is about to appear."}
          </p>
          <Dots />
        </Curtain>
      </main>
    );
  }

  /*
    ACTIVE QUESTION
  */

  const category =
    categoryOf(
      room.questionType
    );

  const timeUp =
    answersOpen &&
    secondsRemaining <= 0;

  const longChoices =
    room.choices.some(
      (choice) =>
        choice.length > 28
    );

  const answerLocked =
    !answersOpen ||
    selectedAnswer !== null ||
    timeUp;

  const finalRound =
    room.currentRound >= 10;

  const powerupUsed =
    currentPlayer.powerupRound ===
    room.currentRound;

  const rivals =
    players.filter(
      (player) =>
        player._id !==
        currentPlayer._id
    );

  return (
    <main className="shell shell-phone">
      {toast}
      {head}

      <section className="phone-status">
        <div className="phone-status-text">
          <span className="phone-round">Round {room.currentRound}</span>
          <span className="tag">
            <Icon name={category.icon} />
            {category.label}
          </span>
        </div>

        <Clock
          seconds={secondsRemaining}
          reading={!answersOpen}
          readingProgress={readingProgress}
          size={84}
        />
      </section>

      {(currentPlayer.timePenalty ?? 0) > 0 && (
        <div className="banner banner-bad">
          <Icon name="bolt" />
          Lag spike: {currentPlayer.timePenalty} seconds off your clock
        </div>
      )}

      <p className="phone-question">{room.question}</p>

      {room.codeSnippet && (
        <p className="muted">The code is on the big screen.</p>
      )}

      {!answersOpen && (
        <div className="listen">
          <Icon name="ear" />
          Answers unlock when the question has been read.
        </div>
      )}

      <section
        className={`tiles ${longChoices ? "tiles-long" : ""} ${answerLocked && selectedAnswer === null ? "tiles-locked" : ""}`}
        aria-label="Answers"
      >
        {room.choices.map((choice, index) => {
          if (hiddenAnswers.includes(index)) {
            return null;
          }

          const isSelected = selectedAnswer === index;

          return (
            <button
              key={index}
              type="button"
              className={`tile tile-${index} ${isSelected ? "tile-selected" : ""}`}
              onClick={() => handleAnswer(index)}
              disabled={answerLocked}
              aria-pressed={isSelected}
            >
              <span className="tile-key">{String.fromCharCode(65 + index)}</span>
              <span className="tile-text">{choice}</span>
              {isSelected && (
                <span className="tile-mark">
                  <Icon name="lock" />
                </span>
              )}
            </button>
          );
        })}
      </section>

      {selectedAnswer !== null && (
        <div className="banner banner-gold">
          <Icon name="lock" />
          Answer locked in
        </div>
      )}

      {timeUp && selectedAnswer === null && (
        <div className="banner banner-bad">
          <Icon name="clock" />
          Time's up
        </div>
      )}

      <section>
        <div className="section-title">
          Power-ups
          {powerupUsed ? (
            <small>One per round. Used this round.</small>
          ) : finalRound ? (
            <small>Final round: no new attacks or shields</small>
          ) : (
            <small>One per round</small>
          )}
        </div>

        <div className="powerups">
          <button
            type="button"
            className="powerup"
            onClick={handleFiftyFifty}
            disabled={
              powerupUsed ||
              (currentPlayer.fiftyFifty ?? 0) <= 0 ||
              selectedAnswer !== null ||
              timeUp ||
              hiddenAnswers.length > 0
            }
          >
            <span className="powerup-icon">
              <Icon name="split" />
            </span>
            <span>
              <strong>50/50</strong>
              <small>Remove two wrong answers</small>
            </span>
            <span className="powerup-count">{currentPlayer.fiftyFifty ?? 0}</span>
          </button>

          <button
            type="button"
            className="powerup powerup-shield"
            onClick={handleFirewall}
            disabled={
              powerupUsed ||
              finalRound ||
              queuedFirewall ||
              (currentPlayer.firewall ?? 0) <= 0 ||
              selectedAnswer !== null ||
              timeUp
            }
          >
            <span className="powerup-icon">
              <Icon name="shield" />
            </span>
            <span>
              <strong>Firewall</strong>
              <small>Blocks one attack next round</small>
            </span>
            <span className="powerup-count">{currentPlayer.firewall ?? 0}</span>
          </button>
        </div>

        {currentPlayer.firewallActive && (
          <div className="banner banner-good" style={{ marginTop: 10 }}>
            <Icon name="shield" />
            Firewall is up this round
          </div>
        )}
      </section>

      {rivals.length > 0 && (
        <section>
          <div className="section-title">
            Lag spike a rival
            <small>{(currentPlayer.lagSpike ?? 0) > 0 ? "5 s off their next round" : "Used"}</small>
          </div>

          {(currentPlayer.lagSpike ?? 0) > 0 && (
            <div className="rivals">
              {rivals.map((player) => (
                <button
                  key={player._id}
                  type="button"
                  className="rival"
                  onClick={() => handleLagSpike(player._id, player.name)}
                  disabled={
                    powerupUsed ||
                    finalRound ||
                    selectedAnswer !== null ||
                    timeUp ||
                    (currentPlayer.lagSpike ?? 0) <= 0
                  }
                >
                  <Icon name="bolt" />
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.score} pts</small>
                  </span>
                  <span className="muted">Send</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ordinal(n: number) {
  const tens = n % 100;

  if (tens >= 11 && tens <= 13) {
    return "th";
  }

  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

export default PlayerGamePage;
