import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";


import {
  speak,
  stopVoice,
} from "../utils/voice";

import {
  playStreamingVoice,
  stopGeneratedVoice,
} from "../utils/generatedVoice";

import "./AICoachAnimationExpressive.css";

import {
  playSfx,
} from "../utils/sfx";

/* ========================================
   TYPES
======================================== */

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
  narration?: string;
  code?: string;
  highlightLine?: number;
  highlightText?: string;
  takeaway?: string;
  visual?: SceneVisual;
};

type Props = {
  scenes: ExplanationScene[];
  correctAnswer: string;
  questionType?: string;
  fallbackCode?: string;
  onComplete?: () => void;
};

/* ========================================
   HELPERS
======================================== */

function normalizeCodeLine(
  value: string
) {
  return value
    .replace(/\s+/g, " ")
    .replace(/['"`]/g, "")
    .trim()
    .toLowerCase();
}

function findHighlightLine(
  code: string,
  highlightLine?: number,
  highlightText?: string
) {
  const lines =
    code.split("\n");

  if (
    highlightLine !== undefined &&
    highlightLine >= 1 &&
    highlightLine <= lines.length
  ) {
    return highlightLine;
  }

  if (!highlightText) {
    return undefined;
  }

  const wanted =
    normalizeCodeLine(
      highlightText
    );

  if (!wanted) {
    return undefined;
  }

  let index =
    lines.findIndex(
      (line) =>
        normalizeCodeLine(
          line
        ) === wanted
    );

  if (index !== -1) {
    return index + 1;
  }

  index =
    lines.findIndex(
      (line) => {
        const current =
          normalizeCodeLine(
            line
          );

        if (!current) {
          return false;
        }

        return (
          current.includes(
            wanted
          ) ||
          wanted.includes(
            current
          )
        );
      }
    );

  if (index !== -1) {
    return index + 1;
  }

  const wantedTokens =
    wanted
      .split(
        /[^a-z0-9_]+/
      )
      .filter(
        (token) =>
          token.length > 1
      );

  let bestIndex = -1;
  let bestScore = 0;

  lines.forEach(
    (
      line,
      lineIndex
    ) => {
      const current =
        normalizeCodeLine(
          line
        );

      const score =
        wantedTokens.filter(
          (token) =>
            current.includes(
              token
            )
        ).length;

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        bestIndex =
          lineIndex;
      }
    }
  );

  if (
    bestIndex !== -1 &&
    bestScore >= 2
  ) {
    return bestIndex + 1;
  }

  return undefined;
}

function getSceneIcon(
  kind?: string,
  type?: string
) {
  const key =
    kind ??
    type ??
    "reasoning";

  switch (key) {
    case "array":
      return "📊";

    case "pointers":
      return "🎯";

    case "hashmap":
      return "🗂️";

    case "stack":
      return "🧱";

    case "code":
    case "bug_hunt":
      return "🔎";

    case "complexity":
      return "⚡";

    case "takeaway":
      return "🏆";

    default:
      return "🧠";
  }
}

/* ========================================
   MAIN COMPONENT
======================================== */

function AICoachAnimation({
  scenes,
  correctAnswer,
  questionType,
  fallbackCode,
  onComplete,
}: Props) {
  const [
    currentScene,
    setCurrentScene,
  ] = useState(0);

  const [
    visible,
    setVisible,
  ] = useState(true);

  const [
    sceneBeat,
    setSceneBeat,
  ] = useState(0);

  const [
    voicePlaying,
    setVoicePlaying,
  ] = useState(false);

  /*
    Keep the latest values accessible
    without restarting narration every time
    Convex gives us a new array reference.
  */

  const scenesRef =
    useRef(scenes);

  const onCompleteRef =
    useRef(onComplete);

  useEffect(() => {
    scenesRef.current =
      scenes;
  }, [
    scenes,
  ]);

  useEffect(() => {
    onCompleteRef.current =
      onComplete;
  }, [
    onComplete,
  ]);

  /* ========================================
     RESET WHEN A NEW EXPLANATION MOUNTS
  ======================================== */

  useEffect(() => {
    setCurrentScene(0);
    setVisible(true);
    setSceneBeat(0);
  }, [
    scenes.length,
  ]);

  /*
    Give every scene multiple visual beats so
    the explanation feels alive while narration
    is still playing instead of revealing one
    static picture and waiting.
  */
  useEffect(() => {
    setSceneBeat(0);

    const timers = [
      420,
      980,
      1580,
      2280,
    ].map(
      (
        delay,
        index
      ) =>
        setTimeout(
          () => {
            setSceneBeat(
              index + 1
            );
          },
          delay
        )
    );

    return () => {
      timers.forEach(
        clearTimeout
      );
    };
  }, [
    currentScene,
  ]);

  /* ========================================
     VOICE-CONTROLLED SCENE ADVANCE
  ======================================== */

  useEffect(() => {
    const currentScenes =
      scenesRef.current;

    if (
      currentScenes.length ===
      0
    ) {
      return;
    }

    const scene =
      currentScenes[
        currentScene
      ];

    if (!scene) {
      return;
    }

    const visual =
      scene.visual;

    const reasoningNarration =
      visual?.kind ===
        "reasoning" &&
      visual.reasoningSteps
        ? visual.reasoningSteps.join(
            ". "
          )
        : undefined;

    const narrationParts = [
      scene.title,
      scene.text,
      reasoningNarration,
      visual?.operation,
      scene.takeaway,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(
          value &&
            value.trim()
        )
    );

    const fallbackNarration =
      narrationParts.join(
        ". "
      );

    const narration =
      scene.narration?.trim() ||
      fallbackNarration ||
      scene.text;

    let advanceTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let transitionTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let browserFallbackStarted =
      false;

    let cancelled =
      false;

    let finished =
      false;

    function finishScene() {
      if (
        finished ||
        cancelled
      ) {
        return;
      }

      finished =
        true;

      setVoicePlaying(
        false
      );

      const latestScenes =
        scenesRef.current;

      const isLastScene =
        currentScene >=
        latestScenes.length -
          1;

      if (isLastScene) {
        void playSfx(
          "complete"
        );

        advanceTimer =
          setTimeout(
            () => {
              onCompleteRef
                .current?.();
            },
            700
          );

        return;
      }

      advanceTimer =
        setTimeout(
          () => {
            void playSfx(
              "whoosh"
            );

            setVisible(
              false
            );

            transitionTimer =
              setTimeout(
                () => {
                  setCurrentScene(
                    (
                      previous
                    ) =>
                      previous +
                      1
                  );

                  setVisible(
                    true
                  );
                },
                260
              );
          },
          280
        );
    }

    function startBrowserFallback() {
      if (
        cancelled ||
        finished ||
        browserFallbackStarted
      ) {
        return;
      }

      browserFallbackStarted =
        true;

      setVoicePlaying(
        true
      );

      speak(
        narration,
        {
          rate:
            1.03,

          pitch:
            1.0,

          onEnd:
            () => {
              finishScene();
            },

          onError:
            (
              error
            ) => {
              console.warn(
                "Browser fallback voice failed:",
                error
              );

              finishScene();
            },
        }
      );
    }

    async function startStreamingNarration() {
      try {
        console.log(
          "⚡ Starting streamed AI Coach voice"
        );

        await playStreamingVoice(
          narration,
          scene.type,
          {
            onStart:
              () => {
                if (
                  !cancelled
                ) {
                  setVoicePlaying(
                    true
                  );
                }
              },

            onEnd:
              () => {
                finishScene();
              },

            onError:
              (
                error
              ) => {
                console.warn(
                  "Streamed AI Coach voice failed:",
                  error
                );

                setVoicePlaying(
                  false
                );

                startBrowserFallback();
              },
          }
        );
      } catch (error) {
        console.warn(
          "AI Coach streaming voice failed. Using browser fallback:",
          error
        );

        setVoicePlaying(
          false
        );

        startBrowserFallback();
      }
    }

    const startTimer =
      setTimeout(
        () => {
          void startStreamingNarration();
        },
        100
      );

    return () => {
      cancelled =
        true;

      setVoicePlaying(
        false
      );

      clearTimeout(
        startTimer
      );

      if (advanceTimer) {
        clearTimeout(
          advanceTimer
        );
      }

      if (
        transitionTimer
      ) {
        clearTimeout(
          transitionTimer
        );
      }

      stopGeneratedVoice();
      stopVoice();
    };
  }, [
    currentScene,
  ]);

  if (
    scenes.length ===
    0
  ) {
    return null;
  }

  const scene =
    scenes[
      currentScene
    ];

  if (!scene) {
    return null;
  }

  const visual =
    scene.visual;

  const sceneIcon =
    getSceneIcon(
      visual?.kind,
      scene.type
    );

  const isBugHunt =
    questionType ===
    "bug_hunt";

  const isTakeaway =
    scene.type ===
      "takeaway" ||
    visual?.kind ===
      "takeaway";

  const progress =
    ((currentScene + 1) /
      scenes.length) *
    100;

  const codeToDisplay =
    isBugHunt
      ? fallbackCode ??
        scene.code
      : scene.code;

  const resolvedLine =
    codeToDisplay
      ? findHighlightLine(
          codeToDisplay,
          scene.highlightLine,
          scene.highlightText
        )
      : undefined;

  return (
    <section className="ai-video">
      {/* HEADER */}

      <div className="ai-video-header">
        <div
          className={`ai-avatar ai-avatar-expressive ${
            voicePlaying
              ? "ai-avatar-speaking"
              : ""
          }`}
        >
          <span>
            {sceneIcon}
          </span>

          <div className="coach-voice-wave">
            {[
              0,
              1,
              2,
              3,
              4,
            ].map(
              (
                bar
              ) => (
                <i
                  key={
                    bar
                  }
                />
              )
            )}
          </div>
        </div>

        <div className="ai-header-copy">
          <p className="host-eyebrow">
            AI COACH · AI-GENERATED VOICE
          </p>

          <strong>
            Let's break it
            down
          </strong>
        </div>

        <div className="ai-scene-counter">
          {currentScene + 1}
          /
          {scenes.length}
        </div>
      </div>

      {/* PROGRESS */}

      <div className="ai-progress-track">
        <div
          className="ai-progress-fill"
          style={{
            width:
              `${progress}%`,
          }}
        />
      </div>

      {/* SCENE */}

      <div
        key={currentScene}
        className={`ai-scene ${
          visible
            ? "ai-scene-visible"
            : "ai-scene-hidden"
        }`}
      >
        <div className="coach-scene-heading">
          <p className="ai-scene-label">
            {isBugHunt
              ? "🐛 BUG HUNT"
              : scene.type.toUpperCase()}
          </p>

          <h1>
            {scene.title}
          </h1>

          <p className="ai-scene-text">
            {scene.text}
          </p>
        </div>

        {/* BUG HUNT */}

        {isBugHunt &&
          codeToDisplay &&
          !isTakeaway && (
            <CodeAnimation
              code={
                codeToDisplay
              }
              highlightLine={
                resolvedLine
              }
              highlightText={
                scene.highlightText
              }
              operation={
                visual?.operation
              }
              beat={
                sceneBeat
              }
              bugMode
            />
          )}

        {/* REASONING */}

        {!isBugHunt &&
          visual?.kind ===
            "reasoning" && (
            <ReasoningVisual
              steps={
                visual.reasoningSteps ??
                [
                  scene.text,
                ]
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* ARRAY */}

        {!isBugHunt &&
          visual?.kind ===
            "array" &&
          visual.values && (
            <ArrayVisual
              values={
                visual.values
              }
              activeIndices={
                visual.activeIndices
              }
              pointers={
                visual.pointers
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* POINTERS */}

        {!isBugHunt &&
          visual?.kind ===
            "pointers" &&
          visual.values && (
            <ArrayVisual
              values={
                visual.values
              }
              activeIndices={
                visual.activeIndices
              }
              pointers={
                visual.pointers
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* HASH MAP */}

        {!isBugHunt &&
          visual?.kind ===
            "hashmap" &&
          visual.entries && (
            <HashMapVisual
              entries={
                visual.entries
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* STACK */}

        {!isBugHunt &&
          visual?.kind ===
            "stack" &&
          visual.stack && (
            <StackVisual
              stack={
                visual.stack
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* CODE */}

        {!isBugHunt &&
          codeToDisplay &&
          (
            visual?.kind ===
              "code" ||
            Boolean(
              scene.code
            )
          ) && (
            <CodeAnimation
              code={
                codeToDisplay
              }
              highlightLine={
                resolvedLine
              }
              highlightText={
                scene.highlightText
              }
              operation={
                visual?.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* COMPLEXITY */}

        {!isBugHunt &&
          visual?.kind ===
            "complexity" && (
            <ComplexityVisual
              reasoningSteps={
                visual.reasoningSteps
              }
              operation={
                visual.operation
              }
              beat={
                sceneBeat
              }
            />
          )}

        {/* FALLBACK */}

        {!isBugHunt &&
          !isTakeaway &&
          !visual && (
            <ReasoningVisual
              steps={[
                scene.text,
              ]}
              beat={
                sceneBeat
              }
            />
          )}

        {/* TAKEAWAY */}

        {isTakeaway && (
          <TakeawayVisual
            takeaway={
              scene.takeaway ??
              visual?.operation ??
              correctAnswer
            }
            beat={
              sceneBeat
            }
          />
        )}
      </div>

      {/* DOTS */}

      <div className="ai-scene-dots">
        {scenes.map(
          (
            _,
            index
          ) => (
            <span
              key={index}
              className={
                index <=
                currentScene
                  ? "ai-dot-active"
                  : ""
              }
            />
          )
        )}
      </div>
    </section>
  );
}

/* ========================================
   REASONING
======================================== */

function ReasoningVisual({
  steps,
  operation,
  beat = 0,
}: {
  steps: string[];
  operation?: string;
  beat?: number;
}) {
  const usableSteps =
    steps
      .filter(
        (step) =>
          step.trim()
            .length > 0
      )
      .slice(
        0,
        4
      );

  const activeIndex =
    Math.min(
      beat,
      Math.max(
        0,
        usableSteps.length -
          1
      )
    );

  return (
    <div className="coach-algorithm-stage coach-stage-expressive">
      <div className="coach-visual-title">
        REASONING
      </div>

      <div className="coach-reasoning-flow">
        {usableSteps.map(
          (
            step,
            index
          ) => {
            const revealed =
              index <=
              beat;

            const active =
              index ===
              activeIndex;

            return (
              <div
                className="coach-reasoning-chain"
                key={
                  `${index}-${step}`
                }
              >
                <div
                  className={`coach-reasoning-step ${
                    index ===
                    usableSteps.length -
                      1
                      ? "coach-reasoning-final"
                      : ""
                  } ${
                    revealed
                      ? "coach-beat-revealed"
                      : "coach-beat-hidden"
                  } ${
                    active
                      ? "coach-beat-current"
                      : ""
                  }`}
                >
                  <span className="coach-reasoning-number">
                    {index + 1}
                  </span>

                  <strong>
                    {step}
                  </strong>
                </div>

                {index <
                  usableSteps.length -
                    1 && (
                  <div
                    className={`coach-reasoning-arrow ${
                      index <
                      beat
                        ? "coach-arrow-live"
                        : "coach-beat-hidden"
                    }`}
                  >
                    →
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {operation && (
        <OperationBanner
          operation={
            operation
          }
          active={
            beat >= 2
          }
        />
      )}
    </div>
  );
}

/* ========================================
   CODE
======================================== */

function CodeAnimation({
  code,
  highlightLine,
  highlightText,
  operation,
  beat = 0,
  bugMode = false,
}: {
  code: string;
  highlightLine?: number;
  highlightText?: string;
  operation?: string;
  beat?: number;
  bugMode?: boolean;
}) {
  const lines =
    useMemo(
      () =>
        code.split(
          "\n"
        ),
      [
        code,
      ]
    );

  const [
    scanComplete,
    setScanComplete,
  ] = useState(false);

  const liveLine =
    highlightLine &&
    beat >= 3
      ? highlightLine
      : Math.min(
          lines.length,
          Math.max(
            1,
            1 +
              beat *
                Math.max(
                  1,
                  Math.ceil(
                    lines.length /
                      4
                  )
                )
          )
        );

  useEffect(() => {
    setScanComplete(
      false
    );

    const timer =
      setTimeout(
        () => {
          setScanComplete(
            true
          );
        },
        850
      );

    return () => {
      clearTimeout(
        timer
      );
    };
  }, [
    code,
    highlightLine,
  ]);

  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        {bugMode
          ? "BUG SCANNER"
          : "CODE WALKTHROUGH"}
      </div>

      <div
        className={`ai-code-window ${
          bugMode
            ? "ai-code-window-bug"
            : ""
        }`}
      >
        <div className="ai-code-window-header">
          <span />
          <span />
          <span />

          <strong>
            solution.py
          </strong>
        </div>

        <div className="ai-code-body">
          <div
            className={`coach-code-scanner ${
              scanComplete
                ? "coach-code-scanner-done"
                : ""
            }`}
          />

          <div className="ai-code-lines">
            {lines.map(
              (
                line,
                index
              ) => {
                const lineNumber =
                  index + 1;

                const highlighted =
                  highlightLine ===
                  lineNumber;

                const live =
                  liveLine ===
                  lineNumber;

                return (
                  <div
                    key={
                      `${lineNumber}-${line}`
                    }
                    className={`ai-code-line coach-code-line-enter ${
                      highlighted
                        ? bugMode
                          ? "ai-code-highlight ai-code-bug-highlight"
                          : "ai-code-highlight"
                        : ""
                    } ${
                      live
                        ? "coach-code-line-live"
                        : ""
                    }`}
                    style={{
                      animationDelay:
                        `${index * 90}ms`,
                    }}
                  >
                    <span className="ai-line-number">
                      {lineNumber}
                    </span>

                    <code>
                      {line ||
                        " "}
                    </code>

                    {highlighted && (
                      <div className="coach-bug-marker">
                        <span className="coach-bug-arrow">
                          →
                        </span>

                        <span>
                          {bugMode
                            ? "BUG"
                            : "NOW"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      {bugMode &&
        highlightLine && (
          <div className="coach-found-line">
            <span>
              🐛
            </span>

            <div>
              <small>
                BUG FOUND ON LINE
              </small>

              <strong>
                {highlightLine}
              </strong>
            </div>
          </div>
        )}

      {bugMode &&
        !highlightLine && (
          <div className="coach-searching-line">
            <span>
              🔎
            </span>

            <div>
              <small>
                ANALYZING
              </small>

              <strong>
                {highlightText ??
                  "Review this code"}
              </strong>
            </div>
          </div>
        )}

      {operation && (
        <OperationBanner
          operation={
            operation
          }
          active={
            beat >= 2
          }
        />
      )}
    </div>
  );
}

/* ========================================
   ARRAY
======================================== */

function ArrayVisual({
  values,
  activeIndices = [],
  pointers = [],
  operation,
  beat = 0,
}: {
  values: string[];
  activeIndices?: number[];
  pointers?: Pointer[];
  operation?: string;
  beat?: number;
}) {
  const focusCandidates =
    activeIndices.length >
    0
      ? activeIndices
      : values.map(
          (
            _,
            index
          ) => index
        );

  const focusIndex =
    focusCandidates[
      Math.min(
        beat,
        Math.max(
          0,
          focusCandidates.length -
            1
        )
      )
    ] ??
    0;

  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        ARRAY STATE
      </div>

      <div className="coach-array-scroll">
        <div className="coach-array-track">
          <span className="coach-array-bracket">
            [
          </span>

          {values.map(
            (
              value,
              index
            ) => {
              const active =
                activeIndices.includes(
                  index
                );

              const focused =
                index ===
                focusIndex;

              const cellPointers =
                pointers.filter(
                  (pointer) =>
                    pointer.index ===
                    index
                );

              return (
                <div
                  className="coach-array-position"
                  key={
                    `${index}-${value}`
                  }
                  style={{
                    animationDelay:
                      `${index * 100}ms`,
                  }}
                >
                  <div className="coach-pointer-space">
                    {cellPointers.map(
                      (
                        pointer
                      ) => (
                        <div
                          className={`coach-pointer ${
                            focused
                              ? "coach-pointer-live"
                              : ""
                          }`}
                          key={
                            pointer.label
                          }
                        >
                          <span>
                            {pointer.label}
                          </span>

                          <div className="coach-pointer-arrow">
                            ↓
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div
                    className={`coach-array-box ${
                      active
                        ? "coach-array-box-active"
                        : ""
                    } ${
                      focused
                        ? "coach-array-box-focus-live"
                        : ""
                    }`}
                  >
                    <span className="coach-array-scan" />
                    <span className="coach-array-value">
                      {value}
                    </span>
                  </div>

                  <span className="coach-array-index">
                    {index}
                  </span>
                </div>
              );
            }
          )}

          <span className="coach-array-bracket">
            ]
          </span>
        </div>
      </div>

      {operation && (
        <OperationBanner
          operation={
            operation
          }
          active={
            beat >= 2
          }
        />
      )}
    </div>
  );
}

/* ========================================
   HASH MAP
======================================== */

function HashMapVisual({
  entries,
  operation,
  beat = 0,
}: {
  entries: HashEntry[];
  operation?: string;
  beat?: number;
}) {
  const targetIndex =
    entries.findIndex(
      (
        entry
      ) =>
        entry.active
    );

  const focusIndex =
    beat >= 3 &&
    targetIndex >= 0
      ? targetIndex
      : Math.min(
          beat,
          Math.max(
            0,
            entries.length -
              1
          )
        );

  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        HASH MAP
      </div>

      <div className="coach-hashmap">
        <div className="coach-hash-header">
          <span>
            KEY
          </span>

          <span>
            VALUE
          </span>
        </div>

        {entries.map(
          (
            entry,
            index
          ) => (
            <div
              key={
                `${entry.key}-${index}`
              }
              className={`coach-hash-row ${
                entry.active
                  ? "coach-hash-row-active"
                  : ""
              } ${
                index ===
                focusIndex
                  ? "coach-hash-row-live"
                  : ""
              }`}
              style={{
                animationDelay:
                  `${index * 130}ms`,
              }}
            >
              <span className="coach-hash-key">
                {entry.key}
              </span>

              <span className="coach-hash-connector">
                →
              </span>

              <span className="coach-hash-value">
                {entry.value}
              </span>

              {entry.active && (
                <span className="coach-found-badge">
                  MATCH
                </span>
              )}
            </div>
          )
        )}
      </div>

      {operation && (
        <OperationBanner
          operation={
            operation
          }
          active={
            beat >= 2
          }
        />
      )}
    </div>
  );
}

/* ========================================
   STACK
======================================== */

function StackVisual({
  stack,
  operation,
  beat = 0,
}: {
  stack: string[];
  operation?: string;
  beat?: number;
}) {
  const reversed =
    [
      ...stack,
    ].reverse();

  const liveIndex =
    Math.min(
      beat,
      Math.max(
        0,
        reversed.length -
          1
      )
    );

  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        STACK
      </div>

      <div className="coach-stack-wrapper">
        <div className="coach-stack-container">
          {reversed.map(
              (
                value,
                index
              ) => (
                <div
                  className={`coach-stack-box ${
                    index ===
                    liveIndex
                      ? "coach-stack-box-live"
                      : ""
                  }`}
                  key={
                    `${index}-${value}`
                  }
                  style={{
                    animationDelay:
                      `${index * 110}ms`,
                  }}
                >
                  {value}
                </div>
              )
            )}
        </div>
      </div>

      {operation && (
        <OperationBanner
          operation={
            operation
          }
          active={
            beat >= 2
          }
        />
      )}
    </div>
  );
}

/* ========================================
   COMPLEXITY
======================================== */

function ComplexityVisual({
  reasoningSteps,
  operation,
  beat = 0,
}: {
  reasoningSteps?: string[];
  operation?: string;
  beat?: number;
}) {
  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        COMPLEXITY
      </div>

      {reasoningSteps &&
      reasoningSteps.length >
        0 ? (
        <ReasoningVisual
          steps={
            reasoningSteps
          }
          operation={
            operation
          }
          beat={
            beat
          }
        />
      ) : (
        <>
          <div className="coach-complexity">
            <div
              className={`coach-complexity-before ${
                beat >= 1
                  ? "coach-complexity-before-live"
                  : ""
              }`}
            >
              <span>
                Before
              </span>

              <strong>
                O(n²)
              </strong>
            </div>

            <div
              className={`coach-complexity-transition ${
                beat >= 2
                  ? "coach-complexity-arrow-live"
                  : ""
              }`}
            >
              →
            </div>

            <div
              className={`coach-complexity-after ${
                beat >= 3
                  ? "coach-complexity-after-live"
                  : ""
              }`}
            >
              <span>
                Optimized
              </span>

              <strong>
                O(n)
              </strong>
            </div>
          </div>

          {operation && (
            <OperationBanner
              operation={
                operation
              }
              active={
                beat >= 3
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/* ========================================
   TAKEAWAY
======================================== */

function TakeawayVisual({
  takeaway,
  beat = 0,
}: {
  takeaway: string;
  beat?: number;
}) {
  return (
    <div
      className={`coach-takeaway coach-takeaway-expressive ${
        beat >= 1
          ? "coach-takeaway-live"
          : ""
      }`}
    >
      <div className="coach-confetti" aria-hidden="true">
        {Array.from(
          {
            length:
              10,
          }
        ).map(
          (
            _,
            index
          ) => (
            <span
              key={
                index
              }
              style={
                {
                  "--spark":
                    index,
                } as
                  CSSProperties
              }
            />
          )
        )}
      </div>
      <div className="coach-check">
        ✓
      </div>

      <div>
        <span className="coach-takeaway-label">
          KEY TAKEAWAY
        </span>

        <strong>
          {takeaway}
        </strong>
      </div>
    </div>
  );
}

/* ========================================
   OPERATION BANNER
======================================== */

function OperationBanner({
  operation,
  active = false,
}: {
  operation: string;
  active?: boolean;
}) {
  return (
    <div
      className={`coach-operation-banner ${
        active
          ? "coach-operation-live"
          : ""
      }`}
    >
      <span className="coach-operation-icon">
        ⚡
      </span>

      <div>
        <span className="coach-operation-label">
          CURRENT OPERATION
        </span>

        <strong>
          {operation}
        </strong>
      </div>
    </div>
  );
}

export default AICoachAnimation;