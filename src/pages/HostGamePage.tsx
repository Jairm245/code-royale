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

import AICoachAnimation, {
  type AnimationDirectorPlan,
} from "../components/AICoachAnimation";

import {
  getQuestionTypeForRound,
  buildTopicPlan,
  getTopicForRound,
} from "../utils/questionRotation";

import {
  speak,
  stopVoice,
} from "../utils/voice";

import {
  playStreamingVoice,
  prefetchStreamingVoice,
  stopGeneratedVoice,
} from "../utils/generatedVoice";

import {
  playSfx,
  startMusic,
} from "../utils/sfx";

import {
  Icon,
  Wordmark,
  categoryOf,
} from "../components/Icon";

import {
  Clock,
  Curtain,
  Dots,
} from "../components/ShowParts";

import {
  SoundToggle,
} from "../components/SoundToggle";

import {
  useAnswersOpen,
} from "../hooks/useAnswersOpen";

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
  narration?: string;
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
  return categoryOf(type).label;
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

  const [
    animationPlan,
    setAnimationPlan,
  ] =
    useState<
      AnimationDirectorPlan | null
    >(null);

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

  /*
    QUESTION VARIETY
    - topic plan: a shuffled focus topic per round
      (new shuffle every game) so one structure can't
      dominate.
    - asked history: every question + correct answer
      seen in this session, sent to the generator so
      nothing repeats (kept across Play Again too).
  */
  const topicPlanRef =
    useRef<string[]>(
      buildTopicPlan(
        Math.floor(
          Math.random() *
            1_000_000_000
        )
      )
    );

  const askedQuestionsRef =
    useRef<string[]>([]);

  const askedAnswersRef =
    useRef<string[]>([]);

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
      plan:
        AnimationDirectorPlan | null;
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

    /*
      A finished game shows FINAL RESULTS and waits
      for the host to press Play Again. The replay
      screen is only armed by handlePlayAgain.
    */
    if (
      room.status ===
      "finished"
    ) {
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

  /*
    Record every question (and its correct answer)
    as soon as it goes live, including round 1 from
    the starter bank.
  */
  useEffect(() => {
    if (!room?.question) {
      return;
    }

    if (
      askedQuestionsRef.current.includes(
        room.question
      )
    ) {
      return;
    }

    askedQuestionsRef.current = [
      ...askedQuestionsRef.current,
      room.question,
    ].slice(-30);

    const answer =
      room.correctAnswer !==
      undefined
        ? room.choices?.[
            room.correctAnswer
          ]
        : undefined;

    if (answer) {
      askedAnswersRef.current = [
        ...askedAnswersRef.current,
        answer,
      ].slice(-30);
    }
  }, [
    room?.question,
    room?.choices,
    room?.correctAnswer,
  ]);

  function getAskedQuestions(
    current?: string
  ) {
    const all = [
      ...askedQuestionsRef.current,
    ];

    if (
      current &&
      !all.includes(current)
    ) {
      all.push(current);
    }

    return all.slice(-15);
  }

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

  const applyQueuedForRound =
    useMutation(
      (api as any)
        .powerups
        .applyQueuedForRound
    );

  const awardLagSpikeMilestones =
    useMutation(
      (api as any)
        .powerups
        .awardLagSpikeMilestones
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

  const generateAnimationPlan =
    useAction(
      (api as any)
        .aiAnimationDirector
        .directAnimation
    );


  /* ========================================
     TIMER
  ======================================== */

  const secondsRemaining =
    useCountdown(
      room?.questionEndsAt
    );

  /*
    READ FIRST, THEN ANSWER
    Answers unlock when the question has been read
    aloud (host calls openAnswers) or at the 10 s cap;
    the 20 s timer starts then.
  */
  const {
    open: answersOpen,
    readingProgress,
  } = useAnswersOpen(
    room?.answersOpenAt,
    room?.questionStartedAt
  );

  const openAnswers =
    useMutation(
      api.rooms.openAnswers
    );

  const openedSoundRoundRef =
    useRef<number | null>(null);

  useEffect(() => {
    if (
      !room ||
      room.status !==
        "playing" ||
      !answersOpen ||
      openedSoundRoundRef.current ===
        room.currentRound
    ) {
      return;
    }

    openedSoundRoundRef.current =
      room.currentRound;

    void playSfx("open");
  }, [
    room?.status,
    room?.currentRound,
    answersOpen,
  ]);

  /* music follows the show: tension during questions, groove on results */
  useEffect(() => {
    if (!room) {
      return;
    }

    if (
      room.status ===
      "playing"
    ) {
      startMusic("question");
    } else if (
      room.status ===
        "results" ||
      room.status ===
        "finished"
    ) {
      startMusic("results");
    } else if (
      room.status ===
      "explanation"
    ) {
      /* the coach has its own voice and sounds */
      startMusic("off");
    }
  }, [
    room?.status,
  ]);

  /* fanfare once when the game ends */
  const finaleSoundRef =
    useRef(false);

  useEffect(() => {
    if (
      room?.status ===
        "finished" &&
      !finaleSoundRef.current
    ) {
      finaleSoundRef.current =
        true;
      void playSfx("complete");
    }

    if (
      room?.status ===
      "playing"
    ) {
      finaleSoundRef.current =
        false;
    }
  }, [
    room?.status,
  ]);

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
        /*
          After the last round (and its explanation),
          "next round" means the final results.
        */
        if (
          currentRound >=
          MAX_ROUNDS
        ) {
          try {
            await finishGame({
              roomId,
            });

            setAnimationPlan(
              null
            );

            return true;
          } catch (error) {
            console.error(
              "Finishing the game failed:",
              error
            );

            return false;
          }
        }

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
                    getAskedQuestions(
                      currentQuestion
                    ),

                  previousAnswers:
                    askedAnswersRef.current,

                  requestedTopic:
                    getTopicForRound(
                      topicPlanRef.current,
                      nextRound
                    ),
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

          /*
            Apply powerups that were queued
            during the previous round BEFORE
            the new question becomes active.
          */
          await applyQueuedForRound({
            roomId,
            round:
              nextRound,
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

          setAnimationPlan(
            null
          );

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
        applyQueuedForRound,
        setGeneratedQuestion,
        finishGame,
      ]
    );

  /* ========================================
     QUESTION NARRATION

     Stream audio directly from OpenAI through
     Convex HTTP instead of waiting for a full
     generated file to be stored first.
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

    const roomId =
      room._id;

    const round =
      room.currentRound;

    /* question has been read → unlock answers and start the 20 s timer */
    function finishReading() {
      if (cancelled) {
        return;
      }

      void openAnswers({
        roomId,
        round,
      }).catch(
        (error: unknown) =>
          console.warn(
            "Opening answers failed (the 10 s cap still opens them):",
            error
          )
      );
    }

    let browserFallbackStarted =
      false;

    let cancelled =
      false;

    function startBrowserFallback() {
      if (
        cancelled ||
        browserFallbackStarted
      ) {
        return;
      }

      browserFallbackStarted =
        true;

      speak(
        narration,
        {
          rate:
            1.04,

          pitch:
            1.0,

          onEnd:
            finishReading,

          onError:
            finishReading,
        }
      );
    }

    async function startQuestionVoice() {
      try {
        console.log(
          "⚡ Starting streamed question voice"
        );

        await playStreamingVoice(
          narration,
          "question",
          {
            onEnd:
              finishReading,

            onError:
              (
                error
              ) => {
                console.warn(
                  "Streamed question voice failed:",
                  error
                );

                startBrowserFallback();
              },
          }
        );
      } catch (error) {
        console.warn(
          "Question voice stream failed. Using browser fallback:",
          error
        );

        startBrowserFallback();
      }
    }

    /*
      Let the question card render first, then
      begin streamed playback almost immediately.
    */
    /* the question sting plays, then the host reads */
    void playSfx("reveal");

    const timer =
      setTimeout(
        () => {
          void startQuestionVoice();
        },
        850
      );

    return () => {
      cancelled =
        true;

      clearTimeout(
        timer
      );

      stopGeneratedVoice();
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

    /*
      Final round: there is no next question to
      prefetch, but the Coach explanation still is,
      so it starts as fast as every other round.
    */
    const isFinalRound =
      currentRound >=
      MAX_ROUNDS;

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
        isFinalRound
          ? Promise.resolve()
          : generateQuestion({
          difficulty:
            "medium-hard",

          requestedType:
            nextType,

          previousQuestions:
            getAskedQuestions(
              currentQuestion
            ),

          previousAnswers:
            askedAnswersRef.current,

          requestedTopic:
            getTopicForRound(
              topicPlanRef.current,
              currentRound + 1
            ),
        })
          .then(
            async (
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

              /*
                Warm up the next question's voice now so
                it starts instantly when the round begins.
              */
              prefetchStreamingVoice(
                `${getQuestionTypeLabel(
                  nextType
                )
                  .replace(
                    /[^a-zA-Z ]/g,
                    ""
                  )
                  .trim()}. ${question.question}`,
                "question"
              );

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
            async (
              explanation:
                GeneratedExplanation
            ) => {
              let plan:
                AnimationDirectorPlan | null =
                null;

              try {
                plan =
                  await generateAnimationPlan(
                    {
                      question:
                        currentQuestion,

                      questionType,

                      correctAnswer:
                        currentChoices[
                          correctAnswer
                        ] ??
                        "Unknown",

                      codeSnippet,

                      scenes:
                        explanation.scenes,
                    }
                  ) as
                    AnimationDirectorPlan;

                console.log(
                  "🎬 Animation Director prefetched"
                );
              } catch (
                directorError
              ) {
                console.warn(
                  "Animation Director prefetch failed. Coach will use scene defaults:",
                  directorError
                );
              }

              prefetchedExplanationRef.current =
                {
                  round:
                    currentRound,

                  data:
                    explanation,

                  plan,
                };

              /*
                Warm up only the Coach's FIRST line (the
                Coach may not be needed if someone answers
                correctly); the rest is fetched when the
                Coach appears.
              */
              const firstScene =
                explanation.scenes[0];

              if (
                firstScene
              ) {
                prefetchStreamingVoice(
                  firstScene.narration?.trim() ||
                    firstScene.text,
                  firstScene.type
                );
              }

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
    generateAnimationPlan,
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

    /*
      A Lag Spike changes each player's
      personal timer, not the host timer.

      IMPORTANT:
      Do NOT end the round because only one
      player's personal timer reached zero.

      This special early-end condition only
      becomes true when EVERY player's
      personal timer has reached zero.
    */
    const allPlayerTimersFinished =
      players.length > 0 &&
      players.every(
        (player) => {
          const penalty =
            player.timePenalty ??
            0;

          const personalTime =
            Math.max(
              0,
              secondsRemaining -
                penalty
            );

          return (
            personalTime <= 0
          );
        }
      );

    if (
      !everyoneAnswered &&
      !timerFinished &&
      !allPlayerTimersFinished
    ) {
      return;
    }

    endingRoundRef.current =
      true;

    const currentRound =
      room.currentRound;

    async function finishRound() {
      try {
        await endRound({
          roomId,
        });

        await awardComeback({
          roomId,
        });

        await awardLagSpikeMilestones({
          roomId,
          round:
            currentRound,
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
    awardLagSpikeMilestones,
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
          /*
            The final round is handled like every other
            round (results, then the AI Coach if nobody
            got it right). loadNextRound finishes the
            game instead of starting round 11.
          */

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
            setAnimationPlan(
              null
            );

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

            let directedPlan:
              AnimationDirectorPlan | null =
              null;

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

              directedPlan =
                prefetched.plan;
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

              try {
                directedPlan =
                  await generateAnimationPlan(
                    {
                      question:
                        currentQuestion,

                      questionType,

                      correctAnswer:
                        currentChoices[
                          correctAnswer
                        ] ??
                        "Unknown",

                      codeSnippet,

                      scenes:
                        explanation.scenes,
                    }
                  ) as
                    AnimationDirectorPlan;
              } catch (
                directorError
              ) {
                console.warn(
                  "Animation Director failed. Using scene defaults:",
                  directorError
                );
              }
            }

            setAnimationPlan(
              directedPlan
            );

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
    generateAnimationPlan,
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
    stopGeneratedVoice();
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

    /*
      Only now (the host asked for a replay) hide
      the old game's results/timer while round 1
      loads.
    */
    restartingGameRef.current =
      true;

    /*
      New game: new topic order, and answers may be
      reused across games (questions still may not).
    */
    askedAnswersRef.current =
      [];

    /* fresh topic order for the new game */
    topicPlanRef.current =
      buildTopicPlan(
        Math.floor(
          Math.random() *
            1_000_000_000
        )
      );

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
            getAskedQuestions(),

          previousAnswers:
            askedAnswersRef.current,

          requestedTopic:
            getTopicForRound(
              topicPlanRef.current,
              1
            ),
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


      setAnimationPlan(
        null
      );

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
      restartingGameRef.current =
        false;

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
    room === undefined ||
    players === undefined ||
    answers === undefined
  ) {
    return (
      <main className="shell shell-host">
        <Curtain icon="crown" title="Opening the studio">
          <Dots />
        </Curtain>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="shell shell-host">
        <Curtain icon="search" title="Game not found">
          <a className="btn btn-gold" href="/create">Create a new room</a>
        </Curtain>
      </main>
    );
  }

  const topbar = (center: React.ReactNode) => (
    <header className="topbar">
      <Wordmark />
      {center}
      <div className="topbar-right">
        <span className="plate">
          Room <strong>{room.code}</strong>
        </span>
        <SoundToggle />
      </div>
    </header>
  );

  const roundSign = (
    <span className="sign">
      Round <b>{room.currentRound}</b> of {MAX_ROUNDS}
    </span>
  );

  /* ========================================
     REPLAY TRANSITION
  ======================================== */

  if (
    restartingGameRef.current
  ) {
    return (
      <main className="shell shell-host">
        {topbar(<span className="sign">New game</span>)}
        <Curtain icon="replay" title="Resetting the stage">
          <p>Scores and power-ups are cleared. Round 1 is on its way.</p>
          <Dots />
        </Curtain>
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
      [...players].sort(
        (a, b) =>
          b.score -
          a.score
      );

    const winner =
      finalPlayers[0];

    /* podium order on stage: 2nd, 1st, 3rd */
    const podium = [
      { player: finalPlayers[1], place: 2 },
      { player: finalPlayers[0], place: 1 },
      { player: finalPlayers[2], place: 3 },
    ];

    return (
      <main className="shell shell-host">
        {topbar(<span className="sign">Final</span>)}

        <section className="finale">
          <h1>{winner ? `${winner.name} wins` : "Game complete"}</h1>

          <div className="podium">
            {podium.map(({ player, place }) => (
              <div className={`podium-step podium-${place}`} key={place}>
                {player ? (
                  <>
                    {place === 1 && <Icon name="crown" className="podium-crown" />}
                    <span className="podium-name">{player.name}</span>
                    <span className="podium-score">{player.score} pts</span>
                  </>
                ) : (
                  <span className="podium-score">&nbsp;</span>
                )}
                <div className="podium-block">{place}</div>
              </div>
            ))}
          </div>

          {finalPlayers.length > 3 && (
            <div className="roster finale-rest">
              {finalPlayers.slice(3).map((player, index) => (
                <div className="contestant" key={player._id}>
                  <div className="contestant-rank">{index + 4}</div>
                  <div className="contestant-name">
                    <strong>{player.name}</strong>
                  </div>
                  <div className="contestant-side">{player.score}</div>
                </div>
              ))}
            </div>
          )}

          <div className="finale-actions">
            <button type="button" className="btn btn-gold btn-lg" onClick={handlePlayAgain}>
              <Icon name="replay" />
              Play again
            </button>
            <button
              type="button"
              className="btn btn-lg"
              onClick={() => {
                window.location.href = "/create";
              }}
            >
              <Icon name="plus" />
              New room
            </button>
          </div>
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
      room.correctAnswer !== undefined &&
      room.choices
        ? room.choices[room.correctAnswer]
        : "Unknown";

    return (
      <main className="shell shell-host">
        {topbar(roundSign)}

        <div className="coach-bar">
          <span className="tag">
            <Icon name="coach" />
            Nobody got it. The coach explains.
          </span>

          <button type="button" className="btn btn-quiet" onClick={handleSkipExplanation}>
            {room.currentRound >= MAX_ROUNDS ? "Skip to final results" : "Skip to next question"}
          </button>
        </div>

        <AICoachAnimation
          key={`${room._id}-${room.currentRound}`}
          scenes={room.explanationScenes ?? []}
          correctAnswer={correctAnswerText}
          questionType={room.questionType}
          fallbackCode={room.codeSnippet}
          animationPlan={animationPlan}
          onComplete={async () => {
            if (coachAdvancingRef.current) {
              return;
            }

            coachAdvancingRef.current = true;

            const success = await loadNextRound(
              room._id,
              room.currentRound,
              room.question
            );

            if (!success) {
              coachAdvancingRef.current = false;
            }
          }}
        />
      </main>
    );
  }

  const sortedPlayers =
    [...players].sort(
      (a, b) =>
        b.score -
        a.score
    );

  const category =
    categoryOf(
      room.questionType
    );

  /* ========================================
     RESULTS VIEW
  ======================================== */

  if (
    room.status ===
    "results"
  ) {
    const picks =
      (room.choices ?? []).map(
        (_, index) =>
          answers.filter(
            (answer) =>
              answer.answerIndex ===
              index
          ).length
      );

    const someoneCorrect =
      answers.some(
        (answer) =>
          answer.correct
      );

    return (
      <main className="shell shell-host">
        {topbar(roundSign)}

        <section className="stage">
          <div className="stage-main">
            <div className="marquee">
              <div className="marquee-inner reveal">
                <span className="tag">
                  <Icon name={category.icon} />
                  {category.label}
                </span>

                <h1>{someoneCorrect ? "The answer" : "Nobody got it"}</h1>

                <p className="board-question">{room.question}</p>
              </div>
            </div>

            <div className="tiles">
              {room.choices?.map((choice, index) => {
                const correct = index === room.correctAnswer;

                return (
                  <div
                    key={index}
                    className={`tile tile-${index} ${correct ? "tile-correct" : "tile-dim"}`}
                  >
                    <span className="tile-key">
                      {correct ? <Icon name="check" /> : String.fromCharCode(65 + index)}
                    </span>
                    <span className="tile-text">{choice}</span>
                    <span className="tile-picks">
                      {picks[index] > 0 ? `${picks[index]} ${picks[index] === 1 ? "pick" : "picks"}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="stage-note">
              <Dots />
              {room.currentRound >= MAX_ROUNDS
                ? "Final results are next"
                : "Next question coming up"}
            </div>
          </div>

          <aside className="panel stage-side">
            <div className="panel-title">
              Scores
              <small>this round</small>
            </div>

            <div className="roster">
              {sortedPlayers.map((player, index) => {
                const playerAnswer = answers.find(
                  (answer) => answer.playerId === player._id
                );

                return (
                  <div
                    className={`contestant ${index === 0 ? "contestant-lead" : ""}`}
                    key={player._id}
                  >
                    <div className="contestant-rank">{index + 1}</div>
                    <div className="contestant-name">
                      <strong>{player.name}</strong>
                      <span>{player.score} pts</span>
                    </div>
                    <div className="contestant-side">
                      {playerAnswer?.correct ? (
                        <span className="gain">+{playerAnswer.points}</span>
                      ) : (
                        <span className="zero">+0</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  /* ========================================
     ACTIVE GAME VIEW
  ======================================== */

  const responsePercent =
    players.length > 0
      ? Math.min(
          100,
          (answers.length / players.length) * 100
        )
      : 0;

  const announceCopy = {
    lag: { icon: "bolt" as const, title: "Lag spike", detail: "Attack queued for next round" },
    firewall: { icon: "shield" as const, title: "Firewall", detail: "Protection queued for next round" },
    fifty: { icon: "split" as const, title: "50/50", detail: "Two wrong answers removed" },
  };

  return (
    <main className="shell shell-host">
      {powerupBanner && (
        <div className="announce" role="status">
          <div className="announce-icon">
            <Icon name={announceCopy[powerupBanner.type].icon} />
          </div>
          <div>
            <strong>{announceCopy[powerupBanner.type].title}</strong>
            <span>
              {powerupBanner.playerName}. {announceCopy[powerupBanner.type].detail}
            </span>
          </div>
        </div>
      )}

      {topbar(roundSign)}

      <section className="stage">
        <div className="stage-main">
          {/* key: the bulbs chase once for each new question */}
          <div className="marquee marquee-chase" key={`board-${room.currentRound}`}>
            <div className="marquee-inner">
              <div className="board-head">
                <span className="tag">
                  <Icon name={category.icon} />
                  {category.label}
                </span>

                {!answersOpen && (
                  <span className="reading-note">
                    <Icon name="ear" />
                    Listen to the question
                  </span>
                )}
              </div>

              <h1 className="board-question">
                {room.question ?? "Loading question…"}
              </h1>

              {room.codeSnippet && (
                <pre className="board-code">
                  <code>{room.codeSnippet}</code>
                </pre>
              )}
            </div>
          </div>

          <div className="stage-play">
            <Clock
              seconds={secondsRemaining}
              reading={!answersOpen}
              readingProgress={readingProgress}
              size={150}
            />

            <div className="tiles">
              {room.choices?.map((choice, index) => (
                <div className={`tile tile-${index}`} key={index}>
                  <span className="tile-key">{String.fromCharCode(65 + index)}</span>
                  <span className="tile-text">{choice}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="panel stage-side">
          <div className="panel-title">
            Contestants
            <small>{answersOpen ? "answering" : "listening"}</small>
          </div>

          <div className="roster">
            {sortedPlayers.map((player, index) => {
              const answered = answers.some(
                (answer) => answer.playerId === player._id
              );

              return (
                <div
                  className={`contestant ${index === 0 && player.score > 0 ? "contestant-lead" : ""}`}
                  key={player._id}
                >
                  <div className="contestant-rank">{index + 1}</div>
                  <div className="contestant-name">
                    <strong>{player.name}</strong>
                    <span>{player.score} pts</span>
                  </div>
                  {answered ? (
                    <div className="status-dot status-dot-done" aria-label="Answered">
                      <Icon name="check" />
                    </div>
                  ) : (
                    <div className="status-dot status-dot-wait" aria-label="Not answered yet" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="meter">
            <div className="meter-head">
              Answers in
              <strong>
                {answers.length}/{players.length}
              </strong>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${responsePercent}%` }} />
            </div>
          </div>

          <div className="stage-note">
            <Icon name="phone" />
            Players answer on their phones
          </div>
        </aside>
      </section>
    </main>
  );
}

export default HostGamePage;
