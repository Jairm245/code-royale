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

import "./AICoachAnimationReferenceStyle.css";

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

export type AnimationDirectorBeat = {
  cue: string;
  at: number;
  action: string;
  index?: number;
  fromIndex?: number;
  toIndex?: number;
  line?: number;
  key?: string;
  value?: string;
  text?: string;
  label?: string;
  from?: string;
  to?: string;
};

export type AnimationDirectorPlan = {
  version: number;
  style: string;
  scenes: Array<{
    sceneIndex: number;
    beats:
      AnimationDirectorBeat[];
  }>;
};

type Props = {
  scenes: ExplanationScene[];
  correctAnswer: string;
  questionType?: string;
  fallbackCode?: string;
  animationPlan?:
    AnimationDirectorPlan | null;
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

function getSceneNarration(
  scene:
    ExplanationScene
) {
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

  return (
    scene.narration?.trim() ||
    [
      scene.title,
      scene.text,
      reasoningNarration,
      visual?.operation,
      scene.takeaway,
    ]
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value &&
              value.trim()
          )
      )
      .join(
        ". "
      ) ||
    scene.text
  );
}

function getCueProgress(
  narration:
    string,

  beat:
    AnimationDirectorBeat
) {
  const fallback =
    Math.min(
      0.94,
      Math.max(
        0.04,
        beat.at
      )
    );

  const cue =
    beat.cue?.trim();

  if (!cue) {
    return fallback;
  }

  const lowerNarration =
    narration.toLowerCase();

  const cueIndex =
    lowerNarration.indexOf(
      cue.toLowerCase()
    );

  if (
    cueIndex <
    0
  ) {
    return fallback;
  }

  const beforeWords =
    narration
      .slice(
        0,
        cueIndex
      )
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )
      .length;

  const cueWords =
    cue
      .split(
        /\s+/
      )
      .filter(
        Boolean
      )
      .length;

  const totalWords =
    Math.max(
      1,
      narration
        .trim()
        .split(
          /\s+/
        )
        .filter(
          Boolean
        )
        .length
    );

  const cueProgress =
    (
      beforeWords +
      cueWords *
        0.78
    ) /
      totalWords;

  /*
    Trigger close to the END of the spoken cue.
    This feels more like the visual responds to
    the narrator instead of anticipating them.
  */
  return Math.min(
    0.94,
    Math.max(
      0.04,
      cueProgress *
        0.82 +
      fallback *
        0.18
    )
  );
}

function getLastDirectorBeat(
  beats:
    AnimationDirectorBeat[],

  actions:
    string[]
) {
  for (
    let index =
      beats.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      actions.includes(
        beats[
          index
        ].action
      )
    ) {
      return beats[
        index
      ];
    }
  }

  return undefined;
}

function applyPointerHistory(
  pointers:
    Pointer[],

  beats:
    AnimationDirectorBeat[],

  maxIndex:
    number
) {
  const next =
    pointers.map(
      (
        pointer
      ) => ({
        ...pointer,
      })
    );

  for (
    const beat
    of beats
  ) {
    if (
      beat.action !==
        "move_pointer" ||
      !beat.label ||
      beat.toIndex ===
        undefined
    ) {
      continue;
    }

    const clampedIndex =
      Math.min(
        Math.max(
          0,
          beat.toIndex
        ),
        Math.max(
          0,
          maxIndex
        )
      );

    const existing =
      next.find(
        (
          pointer
        ) =>
          pointer.label ===
          beat.label
      );

    if (existing) {
      existing.index =
        clampedIndex;
    } else {
      next.push({
        label:
          beat.label,
        index:
          clampedIndex,
      });
    }
  }

  return next;
}

/* ========================================
   MAIN COMPONENT
======================================== */

function AICoachAnimation({
  scenes,
  correctAnswer,
  questionType,
  fallbackCode,
  animationPlan,
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

  const [
    motionFrame,
    setMotionFrame,
  ] = useState(0);

  const [
    directorBeats,
    setDirectorBeats,
  ] =
    useState<
      AnimationDirectorBeat[]
    >([]);

  /*
    Keep the latest values accessible
    without restarting narration every time
    Convex gives us a new array reference.
  */

  const scenesRef =
    useRef(scenes);

  const onCompleteRef =
    useRef(onComplete);

  const animationPlanRef =
    useRef<
      AnimationDirectorPlan | null
    >(
      animationPlan ??
      null
    );

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

  useEffect(() => {
    animationPlanRef.current =
      animationPlan ??
      null;
  }, [
    animationPlan,
  ]);

  /* ========================================
     RESET WHEN A NEW EXPLANATION MOUNTS
  ======================================== */

  useEffect(() => {
    setCurrentScene(0);
    setVisible(true);
    setSceneBeat(0);
    setMotionFrame(0);
    setDirectorBeats(
      []
    );
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

    const narration =
      getSceneNarration(
        scene
      );

    const directedScene =
      animationPlanRef
        .current
        ?.scenes
        .find(
          (
            candidate
          ) =>
            candidate
              .sceneIndex ===
            currentScene
        );

    const plannedBeats =
      (
        directedScene
          ?.beats ??
        []
      )
        .map(
          (
            beat
          ) => ({
            beat,
            progress:
              getCueProgress(
                narration,
                beat
              ),
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            a.progress -
            b.progress
        );

    function syncDirector(
      progress:
        number
    ) {
      let activeIndex =
        -1;

      for (
        let index = 0;
        index <
        plannedBeats.length;
        index += 1
      ) {
        if (
          progress >=
          plannedBeats[
            index
          ].progress
        ) {
          activeIndex =
            index;
        }
      }

      if (
        activeIndex <
        0
      ) {
        setDirectorBeats(
          []
        );

        setMotionFrame(
          0
        );

        setSceneBeat(
          0
        );

        return;
      }

      const reachedBeats =
        plannedBeats
          .slice(
            0,
            activeIndex + 1
          )
          .map(
            (
              item
            ) =>
              item.beat
          );

      /*
        Keep every reached beat. Visual state is
        cumulative: a moved pointer stays moved,
        a code line stays selected, etc.
      */
      setDirectorBeats(
        reachedBeats
      );

      setMotionFrame(
        activeIndex + 1
      );

      setSceneBeat(
        Math.min(
          4,
          activeIndex + 1
        )
      );
    }

    syncDirector(
      0
    );

    let advanceTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let transitionTimer:
      ReturnType<
        typeof setTimeout
      > | undefined;

    let fallbackProgressTimer:
      ReturnType<
        typeof setInterval
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

      if (
        fallbackProgressTimer
      ) {
        clearInterval(
          fallbackProgressTimer
        );
      }

      syncDirector(
        1
      );

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

      const fallbackStart =
        performance.now();

      const fallbackWords =
        narration
          .trim()
          .split(
            /\s+/
          )
          .filter(
            Boolean
          )
          .length;

      const fallbackDurationMs =
        Math.max(
          3000,
          (
            fallbackWords /
            2.3
          ) *
            1000
        );

      fallbackProgressTimer =
        setInterval(
          () => {
            const elapsed =
              performance.now() -
              fallbackStart;

            syncDirector(
              Math.min(
                0.96,
                elapsed /
                  fallbackDurationMs
              )
            );
          },
          120
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
          "🎬 Director plan:",
          currentScene,
          plannedBeats.map(
            (
              item
            ) => ({
              cue:
                item.beat.cue,
              action:
                item.beat.action,
              at:
                item.progress,
            })
          )
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

            onProgress:
              (
                progress
              ) => {
                if (
                  !cancelled
                ) {
                  syncDirector(
                    progress
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

      if (
        fallbackProgressTimer
      ) {
        clearInterval(
          fallbackProgressTimer
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


  const isBugHunt =
    questionType ===
    "bug_hunt";

  const concreteVisualKinds =
    new Set([
      "array",
      "pointers",
      "hashmap",
      "stack",
      "tree",
      "code",
    ]);

  /*
    A takeaway scene is allowed to keep the optimal
    structure visible. Only use the dedicated takeaway
    animation when no concrete algorithm visual exists.
  */
  const isTakeaway =
    visual?.kind ===
      "takeaway" ||
    (
      scene.type ===
        "takeaway" &&
      !(
        visual &&
        concreteVisualKinds.has(
          visual.kind
        )
      )
    );

  const isCorrectedCode =
    isBugHunt &&
    scene.type ===
      "corrected_code";

  const progress =
    ((currentScene + 1) /
      scenes.length) *
    100;

  const codeToDisplay =
    isBugHunt
      ? isCorrectedCode
        ? scene.code ??
          fallbackCode
        : fallbackCode ??
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
    <section className="ref-coach">
      <div className="ref-coach-stage">
        <div className="ref-topline">
          <span>
            {questionType
              ?.replace(
                /_/g,
                " "
              )
              .toUpperCase() ??
              "CODE ROYALE"}
          </span>

          <span>
            {currentScene + 1}
            /
            {scenes.length}
          </span>
        </div>

        <div className="ref-scene-title">
          {scene.title}
        </div>

        <div
          key={currentScene}
          className={`ref-visual-wrap ${
            visible
              ? "ref-visible"
              : "ref-hidden"
          }`}
        >
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
                values={
                  visual?.values
                }
                pointers={
                  visual?.pointers
                }
                beat={
                  sceneBeat
                }
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
                bugMode={
                  !isCorrectedCode
                }
                correctedMode={
                  isCorrectedCode
                }
              />
            )}

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
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

          {!isBugHunt &&
            (
              visual?.kind ===
                "array" ||
              visual?.kind ===
                "pointers"
            ) &&
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
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

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
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

          {!isBugHunt &&
            visual?.kind ===
              "stack" &&
            visual.stack && (
              <StackVisual
                stack={
                  visual.stack
                }
                values={
                  visual.values
                }
                activeIndices={
                  visual.activeIndices
                }
                operation={
                  visual.operation
                }
                beat={
                  sceneBeat
                }
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

          {!isBugHunt &&
            visual?.kind ===
              "tree" &&
            visual.values && (
              <TreeVisual
                values={
                  visual.values
                }
                activeIndices={
                  visual.activeIndices
                }
                queue={
                  visual.stack
                }
                operation={
                  visual.operation
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

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
                values={
                  visual?.values
                }
                pointers={
                  visual?.pointers
                }
                beat={
                  sceneBeat
                }
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

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
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

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
                frame={
                  motionFrame
                }
                directorBeats={
                  directorBeats
                }
              />
            )}

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
              frame={
                motionFrame
              }
              directorBeats={
                directorBeats
              }
            />
          )}
        </div>

        <div className="ref-caption">
          {scene.text}
        </div>

        <div className="ref-footer">
          <div className="ref-progress-track">
            <span
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>

          <div
            className={`ref-voice-indicator ${
              voicePlaying
                ? "ref-speaking"
                : ""
            }`}
            aria-label="AI generated voice"
          >
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
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
  directorBeats = [],
}: {
  steps: string[];
  operation?: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const items =
    steps
      .map(
        (
          step
        ) =>
          step.trim()
      )
      .filter(
        Boolean
      )
      .slice(
        0,
        4
      );

  const relevantBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "show_equation",
        "compare_values",
        "emphasize_result",
      ]
    );

  /*
    Mostly-static reasoning diagram:
    all nodes stay visible. We only emphasize the
    newest semantic point instead of cycling them.
  */
  const active =
    items.length > 0
      ? Math.min(
          items.length - 1,
          Math.max(
            0,
            directorBeats.length
          )
        )
      : 0;

  return (
    <div className="ref-reasoning">
      <div className="ref-reasoning-line" />

      {items.map(
        (
          step,
          index
        ) => (
          <div
            key={
              `${index}-${step}`
            }
            className={`ref-reasoning-node ${
              index ===
              active
                ? "ref-node-active"
                : ""
            }`}
          >
            <span>
              {index + 1}
            </span>

            <strong>
              {step}
            </strong>

            {index <
              items.length -
                1 && (
              <i>
                →
              </i>
            )}
          </div>
        )
      )}

      {(relevantBeat?.text ||
        operation) && (
        <div className="ref-operation">
          {relevantBeat?.text ??
            operation}
        </div>
      )}
    </div>
  );
}

function CodeAnimation({
  code,
  highlightLine,
  operation,
  values = [],
  pointers = [],
  directorBeats = [],
  bugMode = false,
  correctedMode = false,
}: {
  code: string;
  highlightLine?: number;
  highlightText?: string;
  operation?: string;
  values?: string[];
  pointers?: Pointer[];
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
  bugMode?: boolean;
  correctedMode?: boolean;
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

  const lineBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "highlight_code",
        "scan_code",
      ]
    );

  const focusBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "focus_index",
        "move_pointer",
      ]
    );

  const textBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "show_equation",
        "compare_values",
      ]
    );

  const activeLine =
    lineBeat?.line !==
      undefined
      ? Math.min(
          lines.length,
          Math.max(
            1,
            lineBeat.line
          )
        )
      : highlightLine ??
        1;

  const focusIndex =
    values.length > 0
      ? Math.min(
          values.length -
            1,
          Math.max(
            0,
            focusBeat
              ?.action ===
                "focus_index"
              ? focusBeat.index ??
                0
              : focusBeat
                  ?.action ===
                    "move_pointer"
                ? focusBeat.toIndex ??
                  0
                : pointers[0]
                    ?.index ??
                  0
          )
        )
      : 0;

  const directedPointers =
    applyPointerHistory(
      pointers,
      directorBeats,
      values.length - 1
    );

  return (
    <div
      className={`ref-code-scene ${
        values.length >
        0
          ? "ref-code-with-data"
          : ""
      } ${
        correctedMode
          ? "ref-code-corrected"
          : ""
      }`}
    >
      <div className="ref-code-block">
        {lines.map(
          (
            line,
            index
          ) => {
            const number =
              index + 1;

            const live =
              number ===
              activeLine;

            const bug =
              bugMode &&
              number ===
                highlightLine;

            return (
              <div
                key={
                  `${number}-${line}`
                }
                className={`ref-code-line ${
                  live
                    ? "ref-code-live"
                    : ""
                } ${
                  bug
                    ? "ref-code-bug"
                    : ""
                }`}
              >
                <span>
                  {number}
                </span>

                <code>
                  {line ||
                    " "}
                </code>
              </div>
            );
          }
        )}
      </div>

      {values.length >
        0 && (
        <div className="ref-code-data">
          <ReferenceArrayStrip
            values={
              values
            }
            pointers={
              directedPointers
            }
            focusIndex={
              focusIndex
            }
          />
        </div>
      )}

      {(textBeat?.text ||
        operation) && (
        <div className="ref-operation">
          {textBeat?.text ??
            operation}
        </div>
      )}
    </div>
  );
}

function ReferenceArrayStrip({
  values,
  pointers = [],
  focusIndex,
  activeIndices = [],
}: {
  values: string[];
  pointers?: Pointer[];
  focusIndex: number;
  activeIndices?: number[];
}) {
  return (
    <div className="ref-array-shell">
      <div className="ref-index-row">
        {values.map(
          (
            _,
            index
          ) => (
            <span
              key={
                index
              }
            >
              {index}
            </span>
          )
        )}
      </div>

      <div className="ref-array-row">
        {values.map(
          (
            value,
            index
          ) => {
            const pointerHere =
              pointers.find(
                (
                  pointer
                ) =>
                  pointer.index ===
                  index
              );

            const active =
              index ===
                focusIndex ||
              activeIndices.includes(
                index
              );

            return (
              <div
                key={
                  `${index}-${value}`
                }
                className={`ref-cell ${
                  active
                    ? "ref-cell-active"
                    : ""
                }`}
              >
                {value}

                {pointerHere && (
                  <div className="ref-array-pointer">
                    <span>
                      {pointerHere.label}
                    </span>

                    <i />
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function ArrayVisual({
  values,
  activeIndices = [],
  pointers = [],
  operation,
  directorBeats = [],
}: {
  values: string[];
  activeIndices?: number[];
  pointers?: Pointer[];
  operation?: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const focusBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "focus_index",
        "move_pointer",
      ]
    );

  const textBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "show_equation",
        "compare_values",
      ]
    );

  const initialFocus =
    activeIndices[0] ??
    pointers[0]?.index ??
    0;

  const focusIndex =
    Math.min(
      Math.max(
        0,
        focusBeat
          ?.action ===
            "focus_index"
          ? focusBeat.index ??
            initialFocus
          : focusBeat
              ?.action ===
                "move_pointer"
            ? focusBeat.toIndex ??
              initialFocus
            : initialFocus
      ),
      Math.max(
        0,
        values.length - 1
      )
    );

  const directedPointers =
    applyPointerHistory(
      pointers,
      directorBeats,
      values.length - 1
    );

  return (
    <div className="ref-array-scene">
      {(textBeat?.text ||
        operation) && (
        <div className="ref-equation">
          {textBeat?.text ??
            operation}
        </div>
      )}

      <ReferenceArrayStrip
        values={
          values
        }
        pointers={
          directedPointers
        }
        activeIndices={
          activeIndices
        }
        focusIndex={
          focusIndex
        }
      />

      <div className="ref-array-trace">
        <span>
          i = {focusIndex}
        </span>

        <i />

        <span>
          value ={" "}
          {values[
            focusIndex
          ] ??
            "—"}
        </span>
      </div>
    </div>
  );
}

function HashMapVisual({
  entries,
  operation,
  directorBeats = [],
}: {
  entries: HashEntry[];
  operation?: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const safeEntries =
    entries.slice(
      0,
      8
    );

  const hashBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "hash_lookup",
        "hash_insert",
      ]
    );

  const directedKey =
    hashBeat?.key;

  const directedFocus =
    directedKey
      ? safeEntries.findIndex(
          (
            entry
          ) =>
            entry.key ===
            directedKey
        )
      : -1;

  const focus =
    directedFocus >=
      0
      ? directedFocus
      : Math.max(
          0,
          safeEntries.findIndex(
            (
              entry
            ) =>
              entry.active
          )
        );

  const focusEntry =
    safeEntries[
      focus
    ];

  /*
    Keep the table visible and static. The Director
    only changes the highlighted lookup/insert slot.
  */
  const visibleCount =
    safeEntries.length;

  return (
    <div className="ref-hash-scene">
      <div className="ref-hash-pipeline">
        <div className="ref-pair-box">
          <span>
            {focusEntry?.key ??
              "key"}
          </span>

          <span>
            {focusEntry?.value ??
              "value"}
          </span>
        </div>

        <i>
          →
        </i>

        <div className="ref-hash-box">
          hash function
        </div>

        <i>
          →
        </i>

        <code>
          {focusEntry
            ? `0x${(
                focusEntry.key +
                focusEntry.value
              )
                .split(
                  ""
                )
                .reduce(
                  (
                    total,
                    char
                  ) =>
                    (
                      total *
                        31 +
                      char.charCodeAt(
                        0
                      )
                    ) %
                    0xffffff,
                  7
                )
                .toString(
                  16
                )
                .padStart(
                  6,
                  "0"
                )}`
            : "0x000000"}
        </code>
      </div>

      <div className="ref-hash-arrow">
        ↓
      </div>

      <div
        className="ref-hash-table"
        style={{
          "--cols":
            Math.max(
              4,
              safeEntries.length
            ),
        } as
          CSSProperties}
      >
        <div className="ref-hash-label">
          key
        </div>

        {Array.from(
          {
            length:
              Math.max(
                4,
                safeEntries.length
              ),
          }
        ).map(
          (
            _,
            index
          ) => (
            <div
              key={
                `key-${index}`
              }
              className={`ref-hash-slot ${
                index ===
                focus
                  ? "ref-hash-slot-active"
                  : ""
              }`}
            >
              {index <
              visibleCount
                ? safeEntries[
                    index
                  ]?.key
                : ""}
            </div>
          )
        )}

        <div className="ref-hash-label">
          value
        </div>

        {Array.from(
          {
            length:
              Math.max(
                4,
                safeEntries.length
              ),
          }
        ).map(
          (
            _,
            index
          ) => (
            <div
              key={
                `value-${index}`
              }
              className={`ref-hash-slot ${
                index ===
                focus
                  ? "ref-hash-slot-active ref-hash-value-active"
                  : ""
              }`}
            >
              {index <
              visibleCount
                ? safeEntries[
                    index
                  ]?.value
                : ""}
            </div>
          )
        )}
      </div>

      {operation && (
        <div className="ref-operation">
          {operation}
        </div>
      )}
    </div>
  );
}

function StackVisual({
  stack,
  values = [],
  activeIndices = [],
  operation,
  directorBeats = [],
}: {
  stack: string[];
  values?: string[];
  activeIndices?: number[];
  operation?: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const stackBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "stack_push",
        "stack_pop",
      ]
    );

  const focusBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "focus_index",
      ]
    );

  const initialFocus =
    activeIndices[0] ??
    0;

  const focusIndex =
    values.length > 0
      ? Math.min(
          values.length - 1,
          Math.max(
            0,
            focusBeat?.index ??
              initialFocus
          )
        )
      : 0;

  const directedValueIndex =
    stackBeat?.value
      ? stack.indexOf(
          stackBeat.value
        )
      : -1;

  const visibleCount =
    stackBeat?.action ===
      "stack_push" &&
    directedValueIndex >= 0
      ? directedValueIndex + 1
      : stackBeat?.action ===
          "stack_pop" &&
        directedValueIndex >= 0
        ? Math.max(
            0,
            directedValueIndex
          )
        : stack.length;

  const visible =
    stack.slice(
      0,
      visibleCount
    );

  return (
    <div className="ref-stack-scene">
      {values.length >
        0 && (
        <div className="ref-stack-source">
          <span className="ref-structure-label">
            input
          </span>

          <ReferenceArrayStrip
            values={
              values
            }
            activeIndices={
              activeIndices
            }
            focusIndex={
              focusIndex
            }
          />
        </div>
      )}

      <div className="ref-stack-relationship">
        <span>
          {stackBeat?.action ===
            "stack_pop"
            ? "pop →"
            : stackBeat?.action ===
                "stack_push"
              ? "push →"
              : "→"}
        </span>
      </div>

      <div className="ref-stack-work">
        <span className="ref-structure-label">
          stack
        </span>

        <div className="ref-stack-column">
          {visible.length >
          0 ? (
            visible
              .slice()
              .reverse()
              .map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={
                      `${item}-${index}`
                    }
                    className={
                      index === 0
                        ? "ref-stack-top"
                        : ""
                    }
                  >
                    {item}
                  </div>
                )
              )
          ) : (
            <div className="ref-stack-empty">
              empty
            </div>
          )}

          <span className="ref-stack-base">
            top
          </span>
        </div>
      </div>

      {operation && (
        <div className="ref-operation ref-stack-operation">
          {operation}
        </div>
      )}
    </div>
  );
}

function TreeVisual({
  values,
  activeIndices = [],
  queue = [],
  operation,
  directorBeats = [],
}: {
  values: string[];
  activeIndices?: number[];
  queue?: string[];
  operation?: string;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const focusBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "focus_index",
      ]
    );

  const queueBeat =
    getLastDirectorBeat(
      directorBeats,
      [
        "queue_enqueue",
        "queue_dequeue",
      ]
    );

  const focusIndex =
    Math.min(
      Math.max(
        0,
        focusBeat?.index ??
          activeIndices[0] ??
          0
      ),
      Math.max(
        0,
        values.length - 1
      )
    );

  const workingQueue =
    [...queue];

  if (
    queueBeat?.action ===
      "queue_enqueue" &&
    queueBeat.value &&
    !workingQueue.includes(
      queueBeat.value
    )
  ) {
    workingQueue.push(
      queueBeat.value
    );
  }

  if (
    queueBeat?.action ===
      "queue_dequeue" &&
    queueBeat.value
  ) {
    const removeIndex =
      workingQueue.indexOf(
        queueBeat.value
      );

    if (
      removeIndex >= 0
    ) {
      workingQueue.splice(
        removeIndex,
        1
      );
    }
  }

  const visibleNodes =
    values
      .map(
        (
          value,
          index
        ) => ({
          value,
          index,
        })
      )
      .filter(
        (
          node
        ) =>
          node.value
            .toLowerCase() !==
          "null"
      );

  function getNodePosition(
    index:
      number
  ) {
    const level =
      Math.floor(
        Math.log2(
          index + 1
        )
      );

    const firstIndex =
      2 ** level -
      1;

    const positionInLevel =
      index -
      firstIndex;

    const nodesInLevel =
      2 ** level;

    return {
      x:
        (
          positionInLevel +
          0.5
        ) /
        nodesInLevel *
        100,
      y:
        12 +
        level *
          29,
    };
  }

  return (
    <div className="ref-tree-scene">
      <div className="ref-tree-source">
        <span className="ref-structure-label">
          tree
        </span>

        <div className="ref-tree-canvas">
          <svg
            className="ref-tree-edges"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {visibleNodes.map(
              (
                node
              ) => {
                if (
                  node.index ===
                  0
                ) {
                  return null;
                }

                const parentIndex =
                  Math.floor(
                    (
                      node.index -
                      1
                    ) /
                    2
                  );

                const parentValue =
                  values[
                    parentIndex
                  ];

                if (
                  !parentValue ||
                  parentValue
                    .toLowerCase() ===
                    "null"
                ) {
                  return null;
                }

                const from =
                  getNodePosition(
                    parentIndex
                  );

                const to =
                  getNodePosition(
                    node.index
                  );

                return (
                  <line
                    key={
                      `edge-${parentIndex}-${node.index}`
                    }
                    x1={
                      from.x
                    }
                    y1={
                      from.y
                    }
                    x2={
                      to.x
                    }
                    y2={
                      to.y
                    }
                  />
                );
              }
            )}
          </svg>

          {visibleNodes.map(
            (
              node
            ) => {
              const position =
                getNodePosition(
                  node.index
                );

              const active =
                node.index ===
                  focusIndex ||
                activeIndices.includes(
                  node.index
                );

              return (
                <div
                  key={
                    `node-${node.index}-${node.value}`
                  }
                  className={`ref-tree-node ${
                    active
                      ? "ref-tree-node-active"
                      : ""
                  }`}
                  style={{
                    left:
                      `${position.x}%`,
                    top:
                      `${position.y}%`,
                  }}
                >
                  {node.value}
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="ref-tree-middle">
        {operation && (
          <div className="ref-tree-operation">
            {operation}
          </div>
        )}
      </div>

      <div className="ref-tree-queue">
        <span className="ref-structure-label">
          queue
        </span>

        <div className="ref-queue-row">
          {workingQueue.length >
          0 ? (
            workingQueue.map(
              (
                item,
                index
              ) => (
                <div
                  key={
                    `${item}-${index}`
                  }
                  className={
                    index === 0
                      ? "ref-queue-front"
                      : ""
                  }
                >
                  {item}
                </div>
              )
            )
          ) : (
            <div className="ref-queue-empty">
              empty
            </div>
          )}
        </div>

        <div className="ref-queue-meta">
          size ={" "}
          {workingQueue.length}
        </div>
      </div>
    </div>
  );
}

function ComplexityVisual({
  reasoningSteps = [],
  operation,
  directorBeats = [],
}: {
  reasoningSteps?: string[];
  operation?: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  const directed =
    getLastDirectorBeat(
      directorBeats,
      [
        "show_complexity",
      ]
    );

  const step =
    directed?.text ??
    reasoningSteps[0] ??
    operation ??
    "compare the tradeoff";

  return (
    <div className="ref-complexity-scene">
      <div className="ref-complexity-label ref-complexity-slow">
        {directed?.from ??
          "O(n²) time"}
      </div>

      <div className="ref-complexity-center">
        <span>
          {step}
        </span>

        <div className="ref-complexity-axis">
          <i />
          <b />
          <i />
        </div>
      </div>

      <div className="ref-complexity-label ref-complexity-fast">
        {directed?.to ??
          "O(n) time"}
      </div>
    </div>
  );
}

function TakeawayVisual({
  takeaway,
  directorBeats = [],
}: {
  takeaway: string;
  beat?: number;
  frame?: number;
  directorBeats?:
    AnimationDirectorBeat[];
}) {
  return (
    <div className="ref-takeaway-scene">
      <div className="ref-takeaway-mark">
        ✓
      </div>

      <div className="ref-takeaway-line" />

      <strong>
        {getLastDirectorBeat(
          directorBeats,
          [
            "emphasize_result",
          ]
        )?.text ??
          takeaway}
      </strong>

      <span className="ref-takeaway-cursor">
        _
      </span>
    </div>
  );
}

export default AICoachAnimation;