import {
  action,
} from "./_generated/server";

import {
  v,
} from "convex/values";

import {
  detectConcept,
  getReferencePack,
  isLegalPointerMove,
  renderPackForDirector,
  type ConceptId,
  type PointerState,
} from "./referencePacks";

import {
  getEngineForKind,
  type StructureVisual,
} from "./structureEngines";

/*
  Code Royale Animation Director

  This agent NEVER writes React/CSS.
  It converts an already-written AI Coach scene
  into a deterministic shot list made from a
  constrained animation vocabulary.

  Later, reference videos can be distilled into
  additional STYLE_PROFILE rules without changing
  the renderer.
*/

const MODEL =
  "gpt-4o-mini";

const ALLOWED_ACTIONS =
  new Set([
    "focus_index",
    "move_pointer",
    "show_equation",
    "compare_values",
    "highlight_code",
    "scan_code",
    "hash_lookup",
    "hash_insert",
    "stack_push",
    "stack_pop",
    "queue_enqueue",
    "queue_dequeue",
    "show_complexity",
    "emphasize_result",
    "heap_insert",
    "heap_compare",
    "heap_swap",
    "heap_pop",
    "heap_settle",
    "bst_visit",
    "bst_insert",
    "bst_remove",
    "bst_replace",
    "bst_promote",
    "bst_found",
    "uf_visit",
    "uf_root",
    "uf_link",
    "seg_visit",
    "seg_set",
    "fw_visit",
    "fw_add",
    "fw_update",
    "trie_step",
    "trie_create",
    "trie_end",
    "graph_frontier",
    "graph_visit",
    "graph_edge",
    "graph_done",
    "graph_dist",
    "ll_insert",
    "ll_remove",
    "ll_reverse_step",
    "ll_reverse_done",
    "deque_push_front",
    "deque_push_back",
    "deque_pop_front",
    "deque_pop_back",
  ]);

/* Actions every concept may use on the right scene. */
const UNIVERSAL_ACTIONS =
  new Set([
    "highlight_code",
    "emphasize_result",
  ]);

type PlanContext = {
  concept:
    ConceptId | "unknown";
  questionType?: string;
};

const STYLE_PROFILE = `
CODE ROYALE VISUAL STYLE PROFILE

The reference style is a minimalist algorithm film:
- near-black empty canvas
- sparse serif + monospace typography
- thin white geometry and connector lines
- one restrained accent at a time
- blue for active traversal / pointers
- orange for warnings / bug emphasis
- green only for final success
- narration carries the explanation
- the screen shows only the data/state needed right now
- the animated object should be the optimal solution itself
- the DEFAULT state is STATIC
- movement is used only when it materially explains an algorithm state change
- avoid dashboards, cards, panels, badges, paragraphs, confetti, and decorative motion
- transitions should feel deliberate, calm, and brief
- after a state change, HOLD that state until narration explicitly changes it
- prefer highlighting/focusing over moving when both explain the idea equally well
- move a pointer/value only when movement itself is important to the explanation
- prefer drawing a relationship over describing it
- preserve large areas of empty black space
- never animate just to keep the screen busy

MOTION LANGUAGE
- array: keep the full array static; change one highlight or pointer only when needed
- sliding window: the array/string stays visible and the WINDOW itself is the main animated object
- two pointers: move left/right only when narration explicitly says the pointer changes
- code: keep code static and highlight only the exact line being discussed
- hash map: use only when hash map / hash set is actually the optimal technique
- stack: keep the stack visible; only push/pop when narration explicitly performs that operation
- complexity: keep labels static and reveal/emphasize the comparison once
- equations: reveal a compact equation and hold it

REFERENCE COMPOSITION RULES:
- When an algorithm uses a working structure, keep the SOURCE INPUT visible beside it.
- The source input is the anchor; the working structure shows the algorithm's memory/state.
- For stack solutions: input sequence on the left, stack on the right.
- For BFS/tree solutions: tree on the left, queue on the right, with compact current-level/state text between or beneath them.
- Keep the source tree visible while the queue changes.
- Highlight exactly one current input item or tree node at a time unless intentionally emphasizing a full level.
- A push/pop should correspond to that highlighted item and then HOLD the resulting stack state.
- Do not hide the source input just because the working structure appears.
- Explain the algorithm visually first; code comes after the state walkthrough.
`;

type SceneInput = {
  type: string;
  title: string;
  text: string;
  narration?: string;
  code?: string;
  highlightLine?: number;
  highlightText?: string;
  takeaway?: string;
  visual?: {
    kind: string;
    values?: string[];
    activeIndices?: number[];
    pointers?: Array<{
      label: string;
      index: number;
    }>;
    entries?: Array<{
      key: string;
      value: string;
      active: boolean;
    }>;
    stack?: string[];
    operation?: string;
    reasoningSteps?: string[];
  };
};

type DirectorBeat = {
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

type DirectedScene = {
  sceneIndex: number;
  beats: DirectorBeat[];
};

function stripJsonFences(
  value:
    string
) {
  return value
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();
}

function clampProgress(
  value:
    unknown
) {
  const numberValue =
    typeof value ===
      "number"
      ? value
      : Number(
          value
        );

  if (
    !Number.isFinite(
      numberValue
    )
  ) {
    return 0.5;
  }

  return Math.min(
    0.94,
    Math.max(
      0.04,
      numberValue
    )
  );
}

function getNarration(
  scene:
    SceneInput
) {
  return (
    scene.narration
      ?.trim() ||
    [
      scene.title,
      scene.text,
      scene.visual
        ?.operation,
      scene.takeaway,
    ]
      .filter(
        Boolean
      )
      .join(
        ". "
      )
  );
}

function sanitizeBeat(
  raw:
    unknown,

  narration:
    string
):
  DirectorBeat | null {
  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return null;
  }

  const item =
    raw as
      Record<
        string,
        unknown
      >;

  const action =
    typeof item.action ===
      "string"
      ? item.action.trim()
      : "";

  if (
    !ALLOWED_ACTIONS.has(
      action
    )
  ) {
    return null;
  }

  let cue =
    typeof item.cue ===
      "string"
      ? item.cue.trim()
      : "";

  /*
    A cue must be copied from the narration.
    If the model paraphrases it, keep the beat
    but rely on its fallback progress value.
  */
  if (
    cue &&
    !narration
      .toLowerCase()
      .includes(
        cue.toLowerCase()
      )
  ) {
    cue = "";
  }

  const beat:
    DirectorBeat =
    {
      cue,
      at:
        clampProgress(
          item.at
        ),
      action,
    };

  const numericFields =
    [
      "index",
      "fromIndex",
      "toIndex",
      "line",
    ] as const;

  for (
    const field
    of numericFields
  ) {
    const value =
      item[
        field
      ];

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      beat[
        field
      ] =
        Math.max(
          0,
          Math.round(
            value
          )
        );
    }
  }

  const stringFields =
    [
      "key",
      "value",
      "text",
      "label",
      "from",
      "to",
    ] as const;

  for (
    const field
    of stringFields
  ) {
    const value =
      item[
        field
      ];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      beat[
        field
      ] =
        value
          .trim()
          .slice(
            0,
            80
          );
    }
  }

  return beat;
}

/*
  REFERENCE-PACK FILTER
  Drops beats that the concept's pack does not
  allow, and beats that break the concept's core
  property (e.g. a sliding-window pointer moving
  backward). Bug Hunt is code-driven and keeps
  the generic vocabulary.
*/
function filterBeatsForConcept(
  beats:
    DirectorBeat[],

  scene:
    SceneInput,

  context:
    PlanContext
) {
  const isBugHunt =
    context.questionType ===
    "bug_hunt";

  const isComplexity =
    context.questionType ===
    "complexity";

  const pack =
    isBugHunt
      ? undefined
      : getReferencePack(
          context.concept
        );

  const allowed =
    pack
      ? new Set([
          ...pack.directorActions,
          ...UNIVERSAL_ACTIONS,
        ])
      : undefined;

  const pointerState:
    PointerState = {};

  for (
    const pointer
    of scene.visual
      ?.pointers ??
    []
  ) {
    pointerState[
      pointer.label
    ] =
      pointer.index;
  }

  const maxIndex =
    Math.max(
      0,
      (
        scene.visual
          ?.values
          ?.length ??
        1
      ) - 1
    );

  return beats.filter(
    (beat) => {
      /*
        Complexity is a label on top of the
        structure, never its own beat, unless the
        question is about complexity.
      */
      if (
        beat.action ===
          "show_complexity" &&
        !isComplexity
      ) {
        return false;
      }

      if (
        beat.action ===
          "scan_code" &&
        !isBugHunt
      ) {
        return false;
      }

      if (
        beat.action ===
          "highlight_code" &&
        !scene.code
      ) {
        return false;
      }

      if (
        allowed &&
        !allowed.has(
          beat.action
        ) &&
        !(
          isComplexity &&
          beat.action ===
            "show_complexity"
        )
      ) {
        return false;
      }

      if (
        beat.action ===
        "move_pointer"
      ) {
        if (
          !beat.label ||
          beat.toIndex ===
            undefined ||
          beat.toIndex >
            maxIndex
        ) {
          return false;
        }

        if (
          !isLegalPointerMove(
            context.concept,
            pointerState,
            beat.label,
            beat.toIndex
          )
        ) {
          return false;
        }

        pointerState[
          beat.label
        ] =
          beat.toIndex;
      }

      return true;
    }
  );
}

/*
  ENGINE SCENES (heap, BST, trie, graph, union-find,
  segment tree, Fenwick, linked list, queue/deque):
  the event list is computed by the structure engine,
  so every step is correct by construction. The model
  only contributes TIMING: its beats for that engine
  are reused in order as cues, and the remaining
  events are spread over the rest of the narration.
*/
function buildEngineBeats(
  scene:
    SceneInput,

  directorBeats:
    DirectorBeat[],

  engine:
    NonNullable<
      ReturnType<
        typeof getEngineForKind
      >
    >
): DirectorBeat[] {
  const engineActions =
    new Set(
      engine.actions
    );

  const { events } =
    engine.plan(
      scene.visual as StructureVisual
    );

  const otherBeats =
    directorBeats.filter(
      (beat) =>
        !engineActions.has(
          beat.action
        )
    );

  if (
    events.length ===
      0 &&
    engine.replay
  ) {
    /*
      No parseable operation, but this structure can
      verify the Director's own beats (queue/deque):
      keep them, corrected to be legal.
    */
    const replayed =
      engine.replay(
        scene.visual as StructureVisual,
        directorBeats
      ) as DirectorBeat[];

    if (
      replayed.length >
      0
    ) {
      return [
        ...replayed,
        ...otherBeats.slice(
          0,
          1
        ),
      ].sort(
        (a, b) =>
          a.at - b.at
      );
    }
  }

  if (
    events.length ===
    0
  ) {
    /*
      Structure / takeaway scene: keep it static.
      One restrained engine beat (a focus) is fine.
    */
    const focus =
      directorBeats.find(
        (beat) =>
          beat.action ===
          "focus_index"
      );

    return [
      ...(focus
        ? [focus]
        : []),
      ...otherBeats,
    ]
      .slice(0, 3)
      .sort(
        (a, b) =>
          a.at - b.at
      );
  }

  const timing =
    directorBeats
      .filter(
        (beat) =>
          engineActions.has(
            beat.action
          )
      )
      .sort(
        (a, b) =>
          a.at - b.at
      );

  /*
    The first N engine events reuse the model's N
    cues in order; any remaining events are spread
    evenly between the last cue and the end of the
    narration so they never pile up.
  */
  const timedCount =
    Math.min(
      timing.length,
      events.length
    );

  const lastTimedAt =
    timedCount > 0
      ? timing[
          timedCount - 1
        ].at
      : 0.12;

  const untimedCount =
    events.length -
    timedCount;

  const engineBeats:
    DirectorBeat[] =
    events.map(
      (
        event,
        index
      ) => {
        const timed =
          index <
          timedCount
            ? timing[index]
            : undefined;

        /*
          No cues at all: spread every event from
          0.12 to 0.92. Otherwise spread the
          leftovers after the last cue.
        */
        const spreadAt =
          timedCount === 0
            ? 0.12 +
              (0.8 * index) /
                Math.max(
                  1,
                  events.length -
                    1
                )
            : lastTimedAt +
              ((0.92 -
                lastTimedAt) *
                (index -
                  timedCount +
                  1)) /
                Math.max(
                  1,
                  untimedCount
                );

        return {
          ...event,
          cue:
            timed?.cue ??
            "",
          at:
            Math.min(
              0.94,
              Math.max(
                0.04,
                timed?.at ??
                  spreadAt
              )
            ),
        };
      }
    );

  /*
    Engine order is the truth: force timing to be
    monotonic so a swap never plays before its
    compare.
  */
  for (
    let index = 1;
    index <
    engineBeats.length;
    index += 1
  ) {
    if (
      engineBeats[index].at <=
      engineBeats[index - 1].at
    ) {
      engineBeats[index].at =
        Math.min(
          0.94,
          engineBeats[index - 1]
            .at +
            0.03
        );

      /* a cue would override the fixed time */
      engineBeats[index].cue =
        "";
    }
  }

  return [
    ...engineBeats,
    ...otherBeats.slice(
      0,
      1
    ),
  ];
}

/*
  BUG HUNT: a deterministic code walkthrough.
  - first code scene: scan line by line from the top
    and land on the bug line (the model's first cue, if
    any, times the landing)
  - later scenes before the fix: hold the bug line
  - corrected_code: land on the changed line
  Restrained model beats (equations/comparisons) are kept.
*/
function buildBugHuntBeats(
  scene:
    SceneInput,

  sceneIndex:
    number,

  firstCodeScene:
    number,

  modelBeats:
    DirectorBeat[]
): DirectorBeat[] {
  const extras =
    modelBeats
      .filter(
        (beat) =>
          beat.action ===
            "show_equation" ||
          beat.action ===
            "compare_values" ||
          beat.action ===
            "emphasize_result"
      )
      .slice(0, 2);

  const target =
    scene.highlightLine;

  if (
    !scene.code ||
    !target
  ) {
    return modelBeats.slice(
      0,
      4
    );
  }

  const lineCount =
    scene.code.split(
      "\n"
    ).length;

  const bugLine =
    Math.min(
      lineCount,
      Math.max(
        1,
        target
      )
    );

  if (
    scene.type ===
    "corrected_code"
  ) {
    return [
      {
        cue: "",
        at: 0.18,
        action:
          "highlight_code",
        line: bugLine,
      },
      ...extras,
    ];
  }

  if (
    sceneIndex !==
    firstCodeScene
  ) {
    return [
      {
        cue: "",
        at: 0.1,
        action:
          "highlight_code",
        line: bugLine,
      },
      ...extras,
    ];
  }

  const landing =
    modelBeats.find(
      (beat) =>
        beat.action ===
          "highlight_code" &&
        beat.cue
    );

  const landAt =
    Math.min(
      0.8,
      Math.max(
        0.35,
        landing?.at ??
          0.55
      )
    );

  const scanLines =
    Array.from(
      {
        length:
          Math.max(
            0,
            bugLine - 1
          ),
      },
      (_, index) =>
        index + 1
    ).slice(-6);

  const scans: DirectorBeat[] =
    scanLines.map(
      (
        line,
        index
      ) => ({
        cue: "",
        at:
          0.06 +
          ((landAt - 0.1) *
            index) /
            Math.max(
              1,
              scanLines.length
            ),
        action:
          "scan_code",
        line,
      })
    );

  return [
    ...scans,
    {
      cue:
        landing?.cue ??
        "",
      at: landAt,
      action:
        "highlight_code",
      line: bugLine,
    },
    ...extras.map(
      (beat) => ({
        ...beat,
        at: Math.max(
          beat.at,
          landAt + 0.05
        ),
      })
    ),
  ];
}

function sanitizePlan(
  raw:
    unknown,

  scenes:
    SceneInput[],

  context:
    PlanContext
) {
  const source =
    raw &&
    typeof raw ===
      "object"
      ? raw as
          Record<
            string,
            unknown
          >
      : {};

  const rawScenes =
    Array.isArray(
      source.scenes
    )
      ? source.scenes
      : [];

  const directedScenes:
    DirectedScene[] =
    [];

  scenes.forEach(
    (
      scene,
      sceneIndex
    ) => {
      const rawScene =
        rawScenes.find(
          (
            candidate
          ) => {
            if (
              !candidate ||
              typeof candidate !==
                "object"
            ) {
              return false;
            }

            return (
              Number(
                (
                  candidate as
                    Record<
                      string,
                      unknown
                    >
                ).sceneIndex
              ) ===
              sceneIndex
            );
          }
        );

      const narration =
        getNarration(
          scene
        );

      const rawBeats =
        rawScene &&
        typeof rawScene ===
          "object" &&
        Array.isArray(
          (
            rawScene as
              Record<
                string,
                unknown
              >
          ).beats
        )
          ? (
              rawScene as
                {
                  beats:
                    unknown[];
                }
            ).beats
          : [];

      const beats =
        rawBeats
          .map(
            (
              beat
            ) =>
              sanitizeBeat(
                beat,
                narration
              )
          )
          .filter(
            (
              beat
            ): beat is
              DirectorBeat =>
                Boolean(
                  beat
                )
          )
          .sort(
            (
              a,
              b
            ) =>
              a.at -
              b.at
          );

      const packBeats =
        filterBeatsForConcept(
          beats,
          scene,
          context
        );

      if (
        context.questionType ===
        "bug_hunt"
      ) {
        directedScenes.push({
          sceneIndex,
          beats:
            buildBugHuntBeats(
              scene,
              sceneIndex,
              scenes.findIndex(
                (candidate) =>
                  Boolean(
                    candidate.code
                  ) &&
                  candidate.type !==
                    "corrected_code"
              ),
              packBeats
            ),
        });

        return;
      }

      const engine =
        context.questionType !==
          "bug_hunt"
          ? getEngineForKind(
              scene.visual
                ?.kind
            )
          : undefined;

      const finalBeats =
        engine
          ? buildEngineBeats(
              scene,
              packBeats,
              engine
            )
          : packBeats.slice(
              0,
              6
            );

      directedScenes.push({
        sceneIndex,
        beats:
          finalBeats,
      });
    }
  );

  return {
    version: 2,
    style:
      "minimal_algorithm_film_v1",
    concept:
      context.concept,
    scenes:
      directedScenes,
  };
}

export const directAnimation =
  action({
    args: {
      question:
        v.string(),

      questionType:
        v.optional(
          v.string()
        ),

      correctAnswer:
        v.string(),

      codeSnippet:
        v.optional(
          v.string()
        ),

      /*
        Optional future hook for additional
        reference-derived notes.
      */
      styleNotes:
        v.optional(
          v.array(
            v.string()
          )
        ),

      scenes:
        v.array(
          v.object({
            type:
              v.string(),

            title:
              v.string(),

            text:
              v.string(),

            narration:
              v.optional(
                v.string()
              ),

            code:
              v.optional(
                v.string()
              ),

            highlightLine:
              v.optional(
                v.number()
              ),

            highlightText:
              v.optional(
                v.string()
              ),

            takeaway:
              v.optional(
                v.string()
              ),

            visual:
              v.optional(
                v.object({
                  kind:
                    v.string(),

                  values:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),

                  activeIndices:
                    v.optional(
                      v.array(
                        v.number()
                      )
                    ),

                  pointers:
                    v.optional(
                      v.array(
                        v.object({
                          label:
                            v.string(),

                          index:
                            v.number(),
                        })
                      )
                    ),

                  entries:
                    v.optional(
                      v.array(
                        v.object({
                          key:
                            v.string(),

                          value:
                            v.string(),

                          active:
                            v.boolean(),
                        })
                      )
                    ),

                  stack:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),

                  operation:
                    v.optional(
                      v.string()
                    ),

                  reasoningSteps:
                    v.optional(
                      v.array(
                        v.string()
                      )
                    ),
                })
              ),
          })
        ),
    },

    handler: async (
      _ctx,
      args
    ) => {
      const context:
        PlanContext = {
          concept:
            detectConcept(
              args.question,
              args.correctAnswer,
              args.codeSnippet ??
                ""
            ),
          questionType:
            args.questionType,
        };

      const pack =
        args.questionType ===
          "bug_hunt"
          ? undefined
          : getReferencePack(
              context.concept
            );

      const apiKey =
        process.env
          .OPENAI_API_KEY;

      if (!apiKey) {
        console.error(
          "OPENAI_API_KEY is not configured in Convex. Using deterministic reference-pack plan."
        );

        return sanitizePlan(
          {},
          args.scenes,
          context
        );
      }

      const scenePayload =
        args.scenes.map(
          (
            scene,
            sceneIndex
          ) => ({
            sceneIndex,
            ...scene,
            narration:
              getNarration(
                scene
              ),
          })
        );

      const prompt = `
You are the ANIMATION DIRECTOR for CODE ROYALE, a multiplayer coding-interview game.

Your job is NOT to explain the algorithm and NOT to write UI code.
Another AI Coach already wrote the explanation and narration.

Your only job is to turn each narration scene into a precise visual shot list.

${STYLE_PROFILE}

QUESTION TYPE:
${args.questionType ?? "general"}

QUESTION:
${args.question}

CORRECT ANSWER:
${args.correctAnswer}

${args.codeSnippet
  ? `SOURCE CODE:
${args.codeSnippet}`
  : "SOURCE CODE: none"}

${args.styleNotes?.length
  ? `ADDITIONAL REFERENCE NOTES:
${args.styleNotes.join("\n")}`
  : ""}

${pack
  ? renderPackForDirector(
      pack
    )
  : ""}

ALLOWED ACTIONS ONLY:
1. focus_index
   fields: index

2. move_pointer
   fields: label, fromIndex, toIndex

3. show_equation
   fields: text

4. compare_values
   fields: from, to, text

5. highlight_code
   fields: line

6. scan_code
   fields: line

7. hash_lookup
   fields: key

8. hash_insert
   fields: key, value

9. stack_push
   fields: value

10. stack_pop
    fields: value

11. queue_enqueue
    fields: value

12. queue_dequeue
    fields: value

13. show_complexity
    fields: from, to, text

14. emphasize_result
    fields: text

15+. STRUCTURE-ENGINE ACTIONS (only the ones listed in the reference pack above):
    heap_*, bst_*, trie_*, graph_*, uf_*, seg_*, fw_*, ll_*, deque_*.
    For these structures the engine computes the exact step sequence itself
    from the scene's visual.operation. Your job there is TIMING: emit one beat
    per narration moment, in order, with a cue copied word-for-word from the
    narration. Field values you give are ignored — only cue/at are used.

DIRECTING RULES:

SHOWCASE QUESTION PRIORITY:
- BUG HUNT: original code is the main visual. Highlight the faulty line, hold it, then the final corrected_code scene must show the repaired full snippet. Do not animate unrelated structures unless they directly demonstrate the bug.
- DATA STRUCTURE: the correct structure is the main visual. Prefer operations on that structure over reasoning text or code.
- OPTIMAL VISUAL HOLD RULE: once the optimal structure/algorithm is established, keep it visually dominant through the end of the explanation.
- Do NOT switch away from sliding window / pointers / stack / tree+queue / hashmap merely to show Big-O.
- Unless QUESTION TYPE is "complexity", complexity should be a compact label or narration beat on top of the existing optimal visual.
- For sliding window specifically, the array and left/right boundaries should remain visible during the final O(n)/space explanation.
- For corrected_code scenes, use highlight_code on the repaired line when useful, but do not use bug-style scanning.

- Produce 1-3 beats per scene. Use 4 only if the algorithm genuinely needs four distinct state changes.
- Fewer beats are better than unnecessary movement.
- A beat should happen ONLY when the narration reaches the matching idea.
- Treat each beat as a persistent state change, not a temporary effect.
- "cue" MUST be a short exact phrase copied word-for-word from that scene's narration.
- The primary animated object must represent the optimal solution named by the correct answer.
- Do not animate a helper structure if it is not the core optimal technique.
- Prefer meaningful object movement over text.
- Do not animate continuously for decoration.
- Do not use scan_code unless the narration is explicitly describing a scan/debug pass.
- Prefer highlight_code over scan_code.
- Prefer focus_index over move_pointer unless the narration explicitly says a pointer moves.
- Do not move a pointer before narration talks about moving that pointer.
- Do not highlight code before narration discusses that line.
- Do not reveal complexity before narration reaches complexity.
- Use show_complexity as a primary visual action ONLY when QUESTION TYPE is "complexity".
- For other question types, keep the optimal visual on screen and let the scene's short operation/narration communicate Big-O.
- Use the existing scene visual data; do not invent array values, hash keys, stack values, or code lines.
- If the correct answer is sliding window or two pointers, the principal beats should target pointer/window movement or pointer focus rather than hashmap actions.
- If the correct answer is a hashmap or stack, beats should target that structure directly.
- For stack scenes with visual.values, use focus_index to identify the current source item and stack_push/stack_pop only when the narration reaches the corresponding operation.
- For tree/BFS scenes, use focus_index to select the current tree node and queue_enqueue/queue_dequeue only when narration describes queue state changing.
- For BFS, visual.stack represents the queue even though the field name remains "stack".
- Keep the highlighted source item/tree node and resulting working-state structure persistent until the next meaningful change.
- at is a fallback approximate progress from 0.04 to 0.94.
- Spread beats across the narration. Do not cluster them all at the beginning.
- Leave long quiet holds between beats when narration is explaining the current state.
- Keep the final beat at or before 0.94.
- If a scene is mostly a spoken setup, fewer beats are better.
- The final takeaway should usually have only 1-2 restrained beats.

Return ONLY valid JSON in this exact shape:
{
  "scenes": [
    {
      "sceneIndex": 0,
      "beats": [
        {
          "cue": "exact words from narration",
          "at": 0.22,
          "action": "focus_index",
          "index": 0
        }
      ]
    }
  ]
}

SCENES:
${JSON.stringify(
  scenePayload,
  null,
  2
)}
`;

      /*
        The model only improves timing and
        restrained emphasis. If it fails, the
        reference-pack plan (heap sift sequence,
        pointer rules) is still produced.
      */
      try {
        const response =
          await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${apiKey}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  model:
                    MODEL,

                  temperature:
                    0.25,

                  response_format: {
                    type:
                      "json_object",
                  },

                  messages: [
                    {
                      role:
                        "system",

                      content:
                        "You are a precise animation director. Return valid JSON only. Never write React, CSS, prose, or markdown.",
                    },

                    {
                      role:
                        "user",

                      content:
                        prompt,
                    },
                  ],
                }),
            }
          );

        if (!response.ok) {
          const details =
            await response
              .text()
              .catch(
                () => ""
              );

          console.error(
            "Animation director request failed:",
            response.status,
            details
          );

          throw new Error(
            "Animation director generation failed."
          );
        }

        const payload:
          any =
          await response.json();

        const content =
          payload
            ?.choices?.[0]
            ?.message
            ?.content;

        if (
          typeof content !==
            "string" ||
          !content.trim()
        ) {
          throw new Error(
            "Animation director returned no content."
          );
        }

        let parsed:
          unknown;

        try {
          parsed =
            JSON.parse(
              stripJsonFences(
                content
              )
            );
        } catch (
          error
        ) {
          console.error(
            "Animation director returned invalid JSON:",
            content,
            error
          );

          throw new Error(
            "Animation director returned invalid JSON."
          );
        }

        return sanitizePlan(
          parsed,
          args.scenes,
          context
        );
      } catch (
        directorError
      ) {
        console.error(
          "Animation director failed. Using deterministic reference-pack plan:",
          directorError
        );

        return sanitizePlan(
          {},
          args.scenes,
          context
        );
      }
    },
  });
