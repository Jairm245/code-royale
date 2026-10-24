import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  }, [
    scenes.length,
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

    const narration =
      narrationParts.join(
        ". "
      );

    let advanceTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let transitionTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let finished = false;

    function finishScene() {
      if (finished) {
        return;
      }

      finished = true;

      const latestScenes =
        scenesRef.current;

      const isLastScene =
        currentScene >=
        latestScenes.length -
          1;

      /*
        Final narration finished.
        HostGamePage now owns the transition
        into the next round.
      */

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
      900
    );

  return;
}

      /*
        Otherwise fade out and show
        the next explanation scene.
      */

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
          350
        );
    },
    500
  );
    }

    /*
      Allow entrance animation to start
      before narration begins.
    */

    const startTimer =
      setTimeout(
        () => {
          speak(
            narration,
            {
              rate: 0.98,
              pitch: 0.98,

              onEnd:
                () => {
                  finishScene();
                },

              onError:
                (
                  error
                ) => {
                  console.warn(
                    "AI Coach voice failed:",
                    error
                  );

                  /*
                    Don't permanently freeze
                    the game if browser TTS
                    genuinely fails.
                  */

                  finishScene();
                },
            }
          );
        },
        500
      );

    return () => {
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
        <div className="ai-avatar">
          🤖
        </div>

        <div className="ai-header-copy">
          <p className="host-eyebrow">
            AI COACH
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
}: {
  steps: string[];
  operation?: string;
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

  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        REASONING
      </div>

      <div className="coach-reasoning-flow">
        {usableSteps.map(
          (
            step,
            index
          ) => (
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
                }`}
                style={{
                  animationDelay:
                    `${index * 350}ms`,
                }}
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
                  className="coach-reasoning-arrow"
                  style={{
                    animationDelay:
                      `${
                        index *
                          350 +
                        250
                      }ms`,
                  }}
                >
                  →
                </div>
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
  bugMode = false,
}: {
  code: string;
  highlightLine?: number;
  highlightText?: string;
  operation?: string;
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
}: {
  values: string[];
  activeIndices?: number[];
  pointers?: Pointer[];
  operation?: string;
}) {
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
                          className="coach-pointer"
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
                    }`}
                  >
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
}: {
  entries: HashEntry[];
  operation?: string;
}) {
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
}: {
  stack: string[];
  operation?: string;
}) {
  return (
    <div className="coach-algorithm-stage">
      <div className="coach-visual-title">
        STACK
      </div>

      <div className="coach-stack-wrapper">
        <div className="coach-stack-container">
          {[...stack]
            .reverse()
            .map(
              (
                value,
                index
              ) => (
                <div
                  className="coach-stack-box"
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
}: {
  reasoningSteps?: string[];
  operation?: string;
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
        />
      ) : (
        <>
          <div className="coach-complexity">
            <div className="coach-complexity-before">
              <span>
                Before
              </span>

              <strong>
                O(n²)
              </strong>
            </div>

            <div className="coach-complexity-transition">
              →
            </div>

            <div className="coach-complexity-after">
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
}: {
  takeaway: string;
}) {
  return (
    <div className="coach-takeaway">
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
}: {
  operation: string;
}) {
  return (
    <div className="coach-operation-banner">
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