import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useParams,
} from "react-router-dom";

import {
  useAction,
  useMutation,
  useQuery,
} from "convex/react";

import {
  api,
} from "../../convex/_generated/api";

import {
  useCountdown,
} from "../hooks/useCountdown";

import AICoachAnimation
  from "../components/AICoachAnimation";

import {
  getQuestionTypeForRound,
} from "../utils/questionRotation";

import {
  speak,
  stopVoice,
} from "../utils/voice";

import {
  playSfx,
} from "../utils/sfx";

/* ========================================
   TYPES
======================================== */

type GeneratedQuestion = {
  type: string;
  question: string;
  code?: string | null;
  choices: string[];
  correctAnswer: number;
};

type Pointer = {
  label: string;
  index: number;
};

type HashEntry = {
  key: string;
  value: string;
  active: boolean;
};

type SceneVisual = {
  kind: string;
  values?: string[];
  activeIndices?: number[];
  pointers?: Pointer[];
  entries?: HashEntry[];
  stack?: string[];
  operation?: string;
  reasoningSteps?: string[];
};

type ExplanationScene = {
  type: string;
  title: string;
  text: string;

  code?: string;

  highlightLine?: number;

  highlightText?: string;

  takeaway?: string;

  visual?: SceneVisual;
};

type GeneratedExplanation = {
  summary: string;
  steps: string[];
  scenes: ExplanationScene[];
};

type PowerupType =
  | "lag"
  | "firewall"
  | "fifty";

type PowerupQueueItem = {
  id: string;
  type: PowerupType;
  playerName: string;
};

type PowerupBanner = {
  type: PowerupType;
  playerName: string;
};

const MAX_ROUNDS = 10;

/* ========================================
   HELPERS
======================================== */

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

function isValidQuestion(
  question:
    GeneratedQuestion
) {
  return (
    typeof question.question ===
      "string" &&
    question.question.trim()
      .length > 0 &&
    Array.isArray(
      question.choices
    ) &&
    question.choices.length >=
      2 &&
    Number.isInteger(
      question.correctAnswer
    ) &&
    question.correctAnswer >=
      0 &&
    question.correctAnswer <
      question.choices.length
  );
}

/* ========================================
   COMPONENT
======================================== */

function HostGamePage() {
  const {
    code,
  } =
    useParams();

  /* ========================================
     REFS
  ======================================== */

  const endingRoundRef =
    useRef(false);

  const coachAdvancingRef =
    useRef(false);

  /*
    Prevent the previous finished game's
    question/timer from flashing during replay.
  */
  const restartingGameRef =
    useRef(false);

  const prefetchRoundRef =
    useRef<
      number | null
    >(null);

  const prefetchedQuestionRef =
    useRef<{
      round: number;
      data:
        GeneratedQuestion;
    } | null>(
      null
    );

  const prefetchedExplanationRef =
    useRef<{
      round: number;
      data:
        GeneratedExplanation;
    } | null>(
      null
    );

  const lastCountdownSoundRef =
    useRef<
      number | null
    >(null);

  const resultSoundRoundRef =
    useRef<
      number | null
    >(null);

  const coachSoundRoundRef =
    useRef<
      number | null
    >(null);

  /*
    Store every event ID
    already handled by host.
  */

  const seenPowerupEventsRef =
    useRef(
      new Set<string>()
    );

  /* ========================================
     POWERUP STATE
  ======================================== */

  const powerupQueueRef =
    useRef<
      PowerupQueueItem[]
    >([]);

  const processingPowerupRef =
    useRef(false);

  const [
    powerupBanner,
    setPowerupBanner,
  ] =
    useState<
      PowerupBanner | null
    >(null);

  /* ========================================
     QUERIES
  ======================================== */

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
    EVERY powerup used during
    the current round.
  */

const powerupEvents =
  useQuery(
    (api as any)
      .powerupEvents
      .getForRound,
    room
      ? {
          roomId: room._id,
          round: room.currentRound,
        }
      : "skip"
  );

  /* ========================================
     MUTATIONS
  ======================================== */

  const endRound =
    useMutation(
      api.rooms.endRound
    );

  const awardComeback =
    useMutation(
      api.rooms.awardComeback
    );

  const setGeneratedQuestion =
    useMutation(
      api.rooms
        .setGeneratedQuestion
    );

  const setExplanation =
    useMutation(
      api.rooms
        .setExplanation
    );

  const resetRoundEffects =
    useMutation(
      api.players
        .resetRoundEffects
    );

  const finishGame =
    useMutation(
      (api as any)
        .gameLifecycle
        .finishGame
    );

  const resetGame =
    useMutation(
      (api as any)
        .gameLifecycle
        .resetGame
    );

  /* ========================================
     AI ACTIONS
  ======================================== */

  const generateQuestion =
    useAction(
      api.aiQuestions
        .generateQuestion
    );

  const generateExplanation =
    useAction(
      (api as any)
        .aiExplanation
        .generateExplanation
    );

  /* ========================================
     TIMER
  ======================================== */

  const secondsRemaining =
    useCountdown(
      room?.questionEndsAt
    );

  /* ========================================
     LOAD NEXT ROUND
  ======================================== */

  const loadNextRound =
    useCallback(
      async (
        roomId: any,
        currentRound:
          number,
        currentQuestion?:
          string
      ) => {
        const nextRound =
          currentRound +
          1;

        const expectedType =
          getQuestionTypeForRound(
            nextRound
          );

        try {
          let generated:
            GeneratedQuestion;

          const prefetched =
            prefetchedQuestionRef
              .current;

          if (
            prefetched &&
            prefetched.round ===
              currentRound &&
            prefetched.data
              .type ===
              expectedType
          ) {
            generated =
              prefetched.data;
          } else {
            const fresh =
              await generateQuestion(
                {
                  difficulty:
                    "medium-hard",

                  requestedType:
                    expectedType,

                  previousQuestions:
                    currentQuestion
                      ? [
                          currentQuestion,
                        ]
                      : [],
                }
              );

            generated = {
              type:
                expectedType,

              question:
                fresh.question,

              code:
                fresh.code,

              choices:
                fresh.choices,

              correctAnswer:
                fresh.correctAnswer,
            };
          }

          if (
            !isValidQuestion(
              generated
            )
          ) {
            throw new Error(
              "Generated question was invalid."
            );
          }

          await resetRoundEffects({
            roomId,
          });

          await setGeneratedQuestion({
            roomId,

            type:
              expectedType,

            question:
              generated.question,

            code:
              generated.code ??
              undefined,

            choices:
              generated.choices,

            correctAnswer:
              generated.correctAnswer,

            round:
              nextRound,
          });

          prefetchedQuestionRef.current =
            null;

          prefetchedExplanationRef.current =
            null;

          prefetchRoundRef.current =
            null;

          return true;
        } catch (error) {
          console.error(
            "Next round failed:",
            error
          );

          return false;
        }
      },
      [
        generateQuestion,
        resetRoundEffects,
        setGeneratedQuestion,
      ]
    );

  /* ========================================
     QUESTION NARRATION
  ======================================== */

  useEffect(() => {
    if (
      !room ||
      room.status !==
        "playing" ||
      !room.question
    ) {
      return;
    }

    const category =
      getQuestionTypeLabel(
        room.questionType
      )
        .replace(
          /[^a-zA-Z ]/g,
          ""
        )
        .trim();

    const narration =
      `${category}. ${room.question}`;

    const timer =
      setTimeout(
        () => {
          speak(
            narration,
            {
              rate: 0.98,
              pitch: 0.98,
            }
          );
        },
        500
      );

    return () => {
      clearTimeout(
        timer
      );

      stopVoice();
    };
  }, [
    room?.status,
    room?.currentRound,
    room?.question,
    room?.questionType,
  ]);

  /* ========================================
     COUNTDOWN SOUND
  ======================================== */

  useEffect(() => {
    if (
      !room ||
      room.status !==
        "playing"
    ) {
      return;
    }

    if (
      secondsRemaining >
        5 ||
      secondsRemaining <=
        0
    ) {
      return;
    }

    if (
      lastCountdownSoundRef
        .current ===
      secondsRemaining
    ) {
      return;
    }

    lastCountdownSoundRef.current =
      secondsRemaining;

    void playSfx(
      "countdown"
    );
  }, [
    room?.status,
    room?.currentRound,
    secondsRemaining,
  ]);

  useEffect(() => {
    lastCountdownSoundRef.current =
      null;
  }, [
    room?.currentRound,
  ]);

  /* ========================================
     RESET ROUND GUARDS
  ======================================== */

  useEffect(() => {
    if (
      room?.status ===
      "playing"
    ) {
      endingRoundRef.current =
        false;
    }
  }, [
    room?.currentRound,
    room?.status,
  ]);

  useEffect(() => {
    coachAdvancingRef.current =
      false;
  }, [
    room?.currentRound,
  ]);

  /* ========================================
     CLEAR POWERUP DISPLAY
     ON NEW ROUND
  ======================================== */

  useEffect(() => {
    powerupQueueRef.current =
      [];

    setPowerupBanner(
      null
    );
  }, [
    room?.currentRound,
  ]);

  /* ========================================
     POWERUP QUEUE PROCESSOR
  ======================================== */

  const processPowerupQueue =
    useCallback(
      async () => {
        if (
          processingPowerupRef.current
        ) {
          return;
        }

        processingPowerupRef.current =
          true;

        while (
          powerupQueueRef.current
            .length > 0
        ) {
          const nextEvent =
            powerupQueueRef.current
              .shift();

          if (!nextEvent) {
            continue;
          }

          setPowerupBanner({
            type:
              nextEvent.type,

            playerName:
              nextEvent.playerName,
          });

          switch (
            nextEvent.type
          ) {
            case "lag":
              void playSfx(
                "lag"
              );
              break;

            case "firewall":
              void playSfx(
                "firewall"
              );
              break;

            case "fifty":
              void playSfx(
                "fifty"
              );
              break;
          }

          await new Promise<void>(
            (resolve) => {
              setTimeout(
                resolve,
                1800
              );
            }
          );

          setPowerupBanner(
            null
          );

          await new Promise<void>(
            (resolve) => {
              setTimeout(
                resolve,
                200
              );
            }
          );
        }

        processingPowerupRef.current =
          false;
      },
      []
    );

  /* ========================================
     COLLECT POWERUP EVENTS
  ======================================== */

  useEffect(() => {
    if (
      !powerupEvents
    ) {
      return;
    }

    let addedEvent =
      false;

    for (
      const event of
      powerupEvents
    ) {
      const eventId =
        String(
          event._id
        );

      if (
        seenPowerupEventsRef
          .current
          .has(
            eventId
          )
      ) {
        continue;
      }

      seenPowerupEventsRef
        .current
        .add(
          eventId
        );

      powerupQueueRef
        .current
        .push({
          id:
            eventId,

          type:
            event.type,

          playerName:
            event.playerName,
        });

      addedEvent =
        true;

      console.log(
        "Queued powerup:",
        event.playerName,
        event.type,
        eventId
      );
    }

    if (
      addedEvent
    ) {
      void processPowerupQueue();
    }
  }, [
    powerupEvents,
    processPowerupQueue,
  ]);

  /* ========================================
     PREFETCH NEXT QUESTION
     + CURRENT EXPLANATION
  ======================================== */

  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status !==
      "playing"
    ) {
      return;
    }

    if (
      !room.question ||
      !room.choices ||
      room.correctAnswer ===
        undefined
    ) {
      return;
    }

    const currentRound =
      room.currentRound;

    if (
      currentRound >=
      MAX_ROUNDS
    ) {
      return;
    }

    if (
      prefetchRoundRef
        .current ===
      currentRound
    ) {
      return;
    }

    prefetchRoundRef.current =
      currentRound;

    const currentQuestion =
      room.question;

    const currentChoices =
      room.choices;

    const correctAnswer =
      room.correctAnswer;

    const codeSnippet =
      room.codeSnippet;
      
    const questionType =
  room.questionType;

    const nextType =
      getQuestionTypeForRound(
        currentRound + 1
      );


    async function prefetchAI() {
      const questionPromise =
        generateQuestion({
          difficulty:
            "medium-hard",

          requestedType:
            nextType,

          previousQuestions: [
            currentQuestion,
          ],
        })
          .then(
            (
              generated
            ) => {
              const question:
                GeneratedQuestion =
                {
                  type:
                    nextType,

                  question:
                    generated.question,

                  code:
                    generated.code,

                  choices:
                    generated.choices,

                  correctAnswer:
                    generated.correctAnswer,
                };

              if (
                !isValidQuestion(
                  question
                )
              ) {
                throw new Error(
                  "Prefetched question was invalid."
                );
              }

              prefetchedQuestionRef.current =
                {
                  round:
                    currentRound,

                  data:
                    question,
                };

              console.log(
                "✅ Next question prefetched"
              );
            }
          )
          .catch(
            (error) => {
              console.error(
                "Question prefetch failed:",
                error
              );
            }
          );

      const explanationPromise =
        generateExplanation({
          question:
            currentQuestion,

          questionType,

          choices:
            currentChoices,

          correctAnswer,

          codeSnippet,
        })
          .then(
            (
              explanation:
                GeneratedExplanation
            ) => {
              prefetchedExplanationRef.current =
                {
                  round:
                    currentRound,

                  data:
                    explanation,
                };

              console.log(
                "✅ Explanation prefetched"
              );
            }
          )
          .catch(
            (
              error:
                unknown
            ) => {
              console.error(
                "Explanation prefetch failed:",
                error
              );
            }
          );

      await Promise.allSettled([
        questionPromise,
        explanationPromise,
      ]);
    }

    void prefetchAI();
  }, [
    room?.status,
    room?.currentRound,
    room?.question,
    room?.questionType,
    room?.choices,
    room?.correctAnswer,
    room?.codeSnippet,
    generateQuestion,
    generateExplanation,
  ]);

  /* ========================================
     END ROUND
  ======================================== */

  useEffect(() => {
    if (
      !room ||
      !players ||
      !answers
    ) {
      return;
    }

    if (
      room.status !==
      "playing"
    ) {
      return;
    }

    if (
      endingRoundRef.current
    ) {
      return;
    }

    const roomId =
      room._id;

    const everyoneAnswered =
      players.length > 0 &&
      answers.length >=
        players.length;

    const timerFinished =
      room.questionEndsAt !==
        undefined &&
      Date.now() >=
        room.questionEndsAt;

    if (
      !everyoneAnswered &&
      !timerFinished
    ) {
      return;
    }

    endingRoundRef.current =
      true;

    async function finishRound() {
      try {
        await endRound({
          roomId,
        });

        await awardComeback({
          roomId,
        });
      } catch (error) {
        console.error(
          "Failed to end round:",
          error
        );

        endingRoundRef.current =
          false;
      }
    }

    void finishRound();
  }, [
    room,
    players,
    answers,
    secondsRemaining,
    endRound,
    awardComeback,
  ]);

  /* ========================================
     RESULT SOUND
  ======================================== */

  useEffect(() => {
    if (
      !room ||
      !answers
    ) {
      return;
    }

    if (
      room.status !==
      "results"
    ) {
      return;
    }

    if (
      resultSoundRoundRef
        .current ===
      room.currentRound
    ) {
      return;
    }

    resultSoundRoundRef.current =
      room.currentRound;

    const someoneCorrect =
      answers.some(
        (
          answer
        ) =>
          answer.correct
      );

    void playSfx(
      someoneCorrect
        ? "correct"
        : "incorrect"
    );
  }, [
    room?.status,
    room?.currentRound,
    answers,
  ]);

  /* ========================================
     AI COACH ENTRANCE SOUND
  ======================================== */

  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status !==
      "explanation"
    ) {
      return;
    }

    if (
      coachSoundRoundRef
        .current ===
      room.currentRound
    ) {
      return;
    }

    coachSoundRoundRef.current =
      room.currentRound;

    void playSfx(
      "coach"
    );
  }, [
    room?.status,
    room?.currentRound,
  ]);

  /* ========================================
     RESULTS PHASE
  ======================================== */

  useEffect(() => {
    if (
      !room ||
      !answers
    ) {
      return;
    }

    if (
      room.status !==
      "results"
    ) {
      return;
    }

    const roomId =
      room._id;

    const currentRound =
      room.currentRound;

    const currentQuestion =
      room.question;

    const currentChoices =
      room.choices;

    const correctAnswer =
      room.correctAnswer;

    const codeSnippet =
      room.codeSnippet;

    const questionType =
      room.questionType;

    const timer =
      setTimeout(
        async () => {
          if (
            currentRound >=
            MAX_ROUNDS
          ) {
            await finishGame({
              roomId,
            });

            return;
          }

          const someoneCorrect =
            answers.some(
              (
                answer
              ) =>
                answer.correct
            );

          /*
            SOMEONE GOT IT RIGHT
          */

          if (
            someoneCorrect
          ) {
            await loadNextRound(
              roomId,
              currentRound,
              currentQuestion
            );

            return;
          }

          /*
            NOBODY GOT IT RIGHT
          */

          try {
            if (
              !currentQuestion ||
              !currentChoices ||
              correctAnswer ===
                undefined
            ) {
              throw new Error(
                "Missing question information."
              );
            }

            let explanation:
              GeneratedExplanation;

            const prefetched =
              prefetchedExplanationRef
                .current;

            if (
              prefetched &&
              prefetched.round ===
                currentRound
            ) {
              explanation =
                prefetched.data;
            } else {
              explanation =
                await generateExplanation(
                  {
                    question:
                      currentQuestion,

                    questionType,

                    choices:
                      currentChoices,

                    correctAnswer,

                    codeSnippet,
                  }
                );
            }

            await setExplanation({
              roomId,

              summary:
                explanation.summary,

              steps:
                explanation.steps,

              scenes:
                explanation.scenes,
            });
          } catch (error) {
            console.error(
              "AI explanation failed:",
              error
            );

            /*
              Don't freeze game
              if explanation fails.
            */

            await loadNextRound(
              roomId,
              currentRound,
              currentQuestion
            );
          }
        },
        2500
      );

    return () => {
      clearTimeout(
        timer
      );
    };
  }, [
    room?.status,
    room?._id,
    room?.currentRound,
    room?.question,
    room?.questionType,
    room?.choices,
    room?.correctAnswer,
    room?.codeSnippet,
    answers,
    generateExplanation,
    setExplanation,
    loadNextRound,
    finishGame,
  ]);

  async function handleSkipExplanation() {
    if (
      !room ||
      room.status !==
        "explanation" ||
      coachAdvancingRef.current
    ) {
      return;
    }

    coachAdvancingRef.current =
      true;

    /*
      Stop AI Coach narration immediately.
      The animation will unmount once the
      next question becomes active.
    */
    stopVoice();

    const success =
      await loadNextRound(
        room._id,
        room.currentRound,
        room.question
      );

    if (!success) {
      coachAdvancingRef.current =
        false;
    }
  }

  async function handlePlayAgain() {
    if (!room) {
      return;
    }

    try {
      await resetGame({
        roomId:
          room._id,
      });

      const firstType =
        getQuestionTypeForRound(
          1
        );

      const fresh =
        await generateQuestion({
          difficulty:
            "medium-hard",

          requestedType:
            firstType,

          previousQuestions:
            [],
        });

      const firstQuestion:
        GeneratedQuestion =
        {
          type:
            firstType,

          question:
            fresh.question,

          code:
            fresh.code,

          choices:
            fresh.choices,

          correctAnswer:
            fresh.correctAnswer,
        };

      if (
        !isValidQuestion(
          firstQuestion
        )
      ) {
        throw new Error(
          "Generated replay question was invalid."
        );
      }

      prefetchedQuestionRef.current =
        null;

      prefetchedExplanationRef.current =
        null;

      prefetchRoundRef.current =
        null;

      seenPowerupEventsRef.current =
        new Set<string>();

      powerupQueueRef.current =
        [];

      await setGeneratedQuestion({
        roomId:
          room._id,

        type:
          firstType,

        question:
          firstQuestion.question,

        code:
          firstQuestion.code ??
          undefined,

        choices:
          firstQuestion.choices,

        correctAnswer:
          firstQuestion.correctAnswer,

        round: 1,
      });
    } catch (error) {
      console.error(
        "Play again failed:",
        error
      );
    }
  }

  /* ========================================
     LOADING
  ======================================== */

  if (
    room ===
      undefined ||
    players ===
      undefined ||
    answers ===
      undefined
  ) {
    return (
      <main className="host-game-shell">
        <div className="host-loading">
          <div className="host-loading-crown">
            👑
          </div>

          <h2>
            Loading Code
            Royale...
          </h2>
        </div>
      </main>
    );
  }

  if (
    room === null
  ) {
    return (
      <main className="host-game-shell">
        <h2>
          Game not found.
        </h2>
      </main>
    );
  }

  /* ========================================
     REPLAY TRANSITION
  ======================================== */

  if (
    restartingGameRef.current
  ) {
    return (
      <main className="host-game-shell">
        <header className="host-topbar">
          <div className="host-brand">
            <span>
              👑
            </span>

            CODE ROYALE
          </div>

          <div className="host-room-chip">
            ROOM {room.code}
          </div>
        </header>

        <section className="host-coach-screen">
          <div className="host-coach-icon">
            ⚔️
          </div>

          <p className="host-eyebrow">
            NEW GAME
          </p>

          <h1>
            Starting Round 1...
          </h1>

          <p className="host-coach-subtitle">
            Resetting scores, power-ups,
            and loading a fresh question.
          </p>
        </section>
      </main>
    );
  }

  /* ========================================
     FINAL RESULTS
  ======================================== */

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

    const winner =
      finalPlayers[0];

    return (
      <main className="host-game-shell">
        <header className="host-topbar">
          <div className="host-brand">
            <span>
              👑
            </span>

            CODE ROYALE
          </div>

          <div className="host-room-chip">
            ROOM {room.code}
          </div>
        </header>

        <section className="host-results-layout">
          <div className="host-results-main">
            <p className="host-eyebrow">
              10 ROUNDS COMPLETE
            </p>

            <div
              style={{
                fontSize:
                  "4.5rem",
                marginBottom:
                  "10px",
              }}
            >
              👑
            </div>

            <h1>
              {winner
                ? `${winner.name} wins!`
                : "Game Complete"}
            </h1>

            <div className="host-results-answer">
              <span>
                CHAMPION SCORE
              </span>

              <strong>
                {winner
                  ? `${winner.score} pts`
                  : "—"}
              </strong>
            </div>

            <p className="host-results-status">
              Code Royale complete.
              Final rankings are locked.
            </p>

            <div
              style={{
                display:
                  "flex",
                gap:
                  "12px",
                justifyContent:
                  "center",
                flexWrap:
                  "wrap",
                marginTop:
                  "24px",
              }}
            >
              <button
                onClick={
                  handlePlayAgain
                }
                style={{
                  padding:
                    "12px 20px",
                  borderRadius:
                    "12px",
                  fontWeight:
                    800,
                  cursor:
                    "pointer",
                }}
              >
                🔁 Play Again
              </button>

              <button
                onClick={() => {
                  window.location.href =
                    "/create";
                }}
                style={{
                  padding:
                    "12px 20px",
                  borderRadius:
                    "12px",
                  fontWeight:
                    800,
                  cursor:
                    "pointer",
                }}
              >
                ✨ New Room
              </button>
            </div>
          </div>

          <aside className="host-leaderboard-panel">
            <div className="host-panel-heading">
              <span>
                🏆
              </span>

              <h2>
                Final Leaderboard
              </h2>
            </div>

            <div className="host-leaderboard-list">
              {finalPlayers.map(
                (
                  player,
                  index
                ) => (
                  <div
                    className="host-leaderboard-row"
                    key={
                      player._id
                    }
                  >
                    <div className="host-rank">
                      {index === 0
                        ? "👑"
                        : index + 1}
                    </div>

                    <div className="host-player-info">
                      <strong>
                        {player.name}
                      </strong>

                      <span>
                        {index === 0
                          ? "Champion"
                          : `Place ${index + 1}`}
                      </span>
                    </div>

                    <div className="host-round-points">
                      {player.score} pts
                    </div>
                  </div>
                )
              )}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  /* ========================================
     AI COACH VIEW
  ======================================== */

  if (
    room.status ===
    "explanation"
  ) {
    const correctAnswerText =
      room.correctAnswer !==
        undefined &&
      room.choices
        ? room.choices[
            room.correctAnswer
          ]
        : "Unknown";

    return (
      <main className="host-game-shell">
        <header className="host-topbar">
          <div className="host-brand">
            <span>
              👑
            </span>

            CODE ROYALE
          </div>

          <div className="host-room-chip">
            ROOM {room.code}
          </div>
        </header>

        <div
          style={{
            width: "100%",
            maxWidth: "1050px",
            margin: "0 auto 14px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={
              handleSkipExplanation
            }
            style={{
              margin: 0,
              padding:
                "10px 16px",
              borderRadius:
                "12px",
              border:
                "1px solid rgba(255,255,255,0.16)",
              background:
                "rgba(255,255,255,0.08)",
              color:
                "white",
              fontWeight:
                800,
              cursor:
                "pointer",
            }}
          >
            Skip Explanation →
          </button>
        </div>

        <AICoachAnimation
          key={`${room._id}-${room.currentRound}`}
          scenes={
            room.explanationScenes ??
            []
          }
          correctAnswer={
            correctAnswerText
          }
          questionType={
            room.questionType
          }
          fallbackCode={
            room.codeSnippet
          }
          onComplete={
            async () => {
              if (
                coachAdvancingRef
                  .current
              ) {
                return;
              }

              coachAdvancingRef.current =
                true;

              const success =
                await loadNextRound(
                  room._id,
                  room.currentRound,
                  room.question
                );

              if (
                !success
              ) {
                coachAdvancingRef.current =
                  false;
              }
            }
          }
        />
      </main>
    );
  }

  /* ========================================
     RESULTS VIEW
  ======================================== */

  if (
    room.status ===
    "results"
  ) {
    const sortedPlayers =
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

    return (
      <main className="host-game-shell">
        <header className="host-topbar">
          <div className="host-brand">
            <span>
              👑
            </span>

            CODE ROYALE
          </div>

          <div className="host-room-chip">
            ROOM {room.code}
          </div>
        </header>

        <section className="host-results-layout">
          <div className="host-results-main">
            <p className="host-eyebrow">
              ROUND{" "}
              {
                room.currentRound
              }{" "}
              COMPLETE
            </p>

            <h1>
              Answer Revealed
            </h1>

            <div className="host-results-answer">
              <span>
                CORRECT ANSWER
              </span>

              <strong>
                {room.correctAnswer !==
                  undefined &&
                room.choices
                  ? room.choices[
                      room.correctAnswer
                    ]
                  : "Unknown"}
              </strong>
            </div>

            <p className="host-results-status">
              Preparing the
              next challenge...
            </p>
          </div>

          <aside className="host-leaderboard-panel">
            <div className="host-panel-heading">
              <span>
                🏆
              </span>

              <h2>
                Leaderboard
              </h2>
            </div>

            <div className="host-leaderboard-list">
              {sortedPlayers.map(
                (
                  player,
                  index
                ) => {
                  const playerAnswer =
                    answers.find(
                      (
                        answer
                      ) =>
                        answer.playerId ===
                        player._id
                    );

                  return (
                    <div
                      className="host-leaderboard-row"
                      key={
                        player._id
                      }
                    >
                      <div className="host-rank">
                        {
                          index +
                          1
                        }
                      </div>

                      <div className="host-player-info">
                        <strong>
                          {
                            player.name
                          }
                        </strong>

                        <span>
                          {
                            player.score
                          }{" "}
                          pts
                        </span>
                      </div>

                      <div className="host-round-points">
                        {playerAnswer?.correct
                          ? `+${playerAnswer.points}`
                          : "+0"}
                      </div>

                      {index ===
                        sortedPlayers.length -
                          1 &&
                        sortedPlayers.length >
                          1 && (
                          <div className="host-comeback-icon">
                            🔥
                          </div>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  /* ========================================
     ACTIVE GAME VIEW
  ======================================== */

  const sortedPlayers =
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

  const totalRoundTime =
    20;

  const timerPercent =
    Math.max(
      0,
      Math.min(
        100,
        (
          secondsRemaining /
          totalRoundTime
        ) *
          100
      )
    );

  const timerDanger =
    secondsRemaining <=
    5;

  const responsePercent =
    players.length > 0
      ? Math.min(
          100,
          (
            answers.length /
            players.length
          ) *
            100
        )
      : 0;

  return (
    <main className="host-game-shell">
      {/* POWERUP BANNER */}

      {powerupBanner && (
        <div
          className={`host-powerup-alert host-powerup-${powerupBanner.type}`}
        >
          <div className="host-powerup-alert-icon">
            {powerupBanner.type ===
              "lag" &&
              "⚡"}

            {powerupBanner.type ===
              "firewall" &&
              "🛡️"}

            {powerupBanner.type ===
              "fifty" &&
              "✂️"}
          </div>

          <div className="host-powerup-alert-copy">
            <span>
              {
                powerupBanner
                  .playerName
              }
            </span>

            <strong>
              {powerupBanner.type ===
                "lag" &&
                "LAG SPIKE!"}

              {powerupBanner.type ===
                "firewall" &&
                "FIREWALL!"}

              {powerupBanner.type ===
                "fifty" &&
                "50 / 50!"}
            </strong>

            <small>
              {powerupBanner.type ===
                "lag" &&
                "Opponent loses 5 seconds"}

              {powerupBanner.type ===
                "firewall" &&
                "Protection activated"}

              {powerupBanner.type ===
                "fifty" &&
                "Two wrong answers eliminated"}
            </small>
          </div>
        </div>
      )}

      <header className="host-topbar">
        <div className="host-brand">
          <span>
            👑
          </span>

          CODE ROYALE
        </div>

        <div className="host-header-meta">
          <div className="host-round-pill">
            ROUND{" "}
            {
              room.currentRound
            }
          </div>

          <div className="host-room-chip">
            ROOM {room.code}
          </div>
        </div>
      </header>

      <div className="host-game-layout">
        <section className="host-main-stage">
          <div className="host-question-meta">
            <span className="host-type-pill">
              {getQuestionTypeLabel(
                room.questionType
              )}
            </span>

            <div
              className={`host-timer-ring ${
                timerDanger
                  ? "host-timer-danger"
                  : ""
              }`}
              style={{
                background: `conic-gradient(
                  currentColor ${timerPercent}%,
                  rgba(255,255,255,0.08) ${timerPercent}%
                )`,
              }}
            >
              <div className="host-timer-inner">
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
          </div>

          <div className="host-question-card">
            <p className="host-eyebrow">
              QUESTION
            </p>

            <h1>
              {room.question ??
                "Loading question..."}
            </h1>

            {room.codeSnippet && (
              <pre className="host-code-block">
                <code>
                  {
                    room.codeSnippet
                  }
                </code>
              </pre>
            )}
          </div>

          <div className="host-answer-grid">
            {room.choices?.map(
              (
                choice,
                index
              ) => (
                <div
                  className={`host-answer-card host-answer-${index}`}
                  key={
                    index
                  }
                >
                  <span className="host-answer-letter">
                    {String.fromCharCode(
                      65 +
                        index
                    )}
                  </span>

                  <span className="host-answer-text">
                    {
                      choice
                    }
                  </span>
                </div>
              )
            )}
          </div>

          <div className="host-response-section">
            <div className="host-response-header">
              <span>
                Live responses
              </span>

              <strong>
                {
                  answers.length
                }{" "}
                /{" "}
                {
                  players.length
                }
              </strong>
            </div>

            <div className="host-response-track">
              <div
                className="host-response-fill"
                style={{
                  width:
                    `${responsePercent}%`,
                }}
              />
            </div>
          </div>
        </section>

        <aside className="host-live-panel">
          <div className="host-panel-heading">
            <span>
              🏆
            </span>

            <h2>
              Leaderboard
            </h2>
          </div>

          <div className="host-leaderboard-list">
            {sortedPlayers.map(
              (
                player,
                index
              ) => (
                <div
                  className="host-leaderboard-row"
                  key={
                    player._id
                  }
                >
                  <div className="host-rank">
                    {
                      index +
                      1
                    }
                  </div>

                  <div className="host-player-info">
                    <strong>
                      {
                        player.name
                      }
                    </strong>

                    <span>
                      {
                        player.score
                      }{" "}
                      pts
                    </span>
                  </div>

                  {answers.some(
                    (
                      answer
                    ) =>
                      answer.playerId ===
                      player._id
                  ) ? (
                    <div className="host-answered-indicator">
                      ✓
                    </div>
                  ) : (
                    <div className="host-waiting-indicator">
                      •••
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="host-live-footer">
            <span>
              📱
            </span>

            Players answer on
            their phones
          </div>
        </aside>
      </div>
    </main>
  );
}

export default HostGamePage;