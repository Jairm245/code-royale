import {
  action,
} from "./_generated/server";

import {
  v,
} from "convex/values";

/* ========================================
   TYPES
======================================== */

type RawVisual = {
  kind?: unknown;
  values?: unknown;
  activeIndices?: unknown;
  pointers?: unknown;
  entries?: unknown;
  stack?: unknown;
  operation?: unknown;
  reasoningSteps?: unknown;
};

type RawScene = {
  type?: unknown;
  title?: unknown;
  text?: unknown;
  narration?: unknown;
  code?: unknown;
  highlightLine?: unknown;
  highlightText?: unknown;
  takeaway?: unknown;
  visual?: unknown;
};

type RawExplanation = {
  summary?: unknown;
  steps?: unknown;
  scenes?: unknown;
};

type SanitizedVisual = {
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

type SanitizedScene = {
  type: string;
  title: string;
  text: string;
  narration: string;
  code?: string;
  highlightLine?: number;
  highlightText?: string;
  takeaway?: string;
  visual?: SanitizedVisual;
};

type SanitizedExplanation = {
  summary: string;
  steps: string[];
  scenes: SanitizedScene[];
};

/* ========================================
   HELPERS
======================================== */

function asString(
  value: unknown,
  fallback = ""
) {
  return typeof value ===
    "string"
    ? value.trim()
    : fallback;
}

function trimWords(
  value:
    string,
  maxWords:
    number
) {
  const words =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    words.length <=
    maxWords
  ) {
    return value.trim();
  }

  return (
    words
      .slice(
        0,
        maxWords
      )
      .join(
        " "
      )
      .replace(
        /[,:;]$/,
        ""
      ) +
    "…"
  );
}

function compactSceneText(
  value:
    string
) {
  return trimWords(
    value,
    10
  );
}

function compactNarration(
  value:
    string
) {
  /*
    Hard game-speed ceiling.
    Typical output should already be shorter
    because the prompt asks for 15-28 words.
  */
  return trimWords(
    value,
    34
  );
}

function normalizeCode(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const normalized =
    value
      .replace(
        /\\n/g,
        "\n"
      )
      .trim();

  return normalized.length >
    0
    ? normalized
    : undefined;
}

function sanitizeStringArray(
  value: unknown,
  maxItems = 12
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const items =
    value
      .slice(
        0,
        maxItems
      )
      .map(
        (item) => {
          if (
            typeof item ===
            "string"
          ) {
            return item;
          }

          if (
            typeof item ===
              "number" ||
            typeof item ===
              "boolean"
          ) {
            return String(
              item
            );
          }

          return "";
        }
      )
      .filter(
        (item) =>
          item.length >
          0
      );

  return items.length >
    0
    ? items
    : undefined;
}

function sanitizeNumberArray(
  value: unknown,
  maxItems = 12
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const items =
    value
      .slice(
        0,
        maxItems
      )
      .map(
        (item) =>
          typeof item ===
            "number" &&
          Number.isFinite(
            item
          )
            ? Math.trunc(
                item
              )
            : null
      )
      .filter(
        (
          item
        ): item is number =>
          item !== null
      );

  return items.length >
    0
    ? items
    : undefined;
}

function sanitizePointers(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const pointers =
    value
      .slice(
        0,
        8
      )
      .map(
        (item) => {
          if (
            !item ||
            typeof item !==
              "object"
          ) {
            return null;
          }

          const candidate =
            item as Record<
              string,
              unknown
            >;

          const label =
            asString(
              candidate.label
            );

          const index =
            candidate.index;

          if (
            !label ||
            typeof index !==
              "number" ||
            !Number.isFinite(
              index
            )
          ) {
            return null;
          }

          return {
            label,
            index:
              Math.trunc(
                index
              ),
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          label: string;
          index: number;
        } =>
          item !== null
      );

  return pointers.length >
    0
    ? pointers
    : undefined;
}

function sanitizeEntries(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined;
  }

  const entries =
    value
      .slice(
        0,
        10
      )
      .map(
        (item) => {
          if (
            !item ||
            typeof item !==
              "object"
          ) {
            return null;
          }

          const candidate =
            item as Record<
              string,
              unknown
            >;

          const key =
            typeof candidate.key ===
              "string" ||
            typeof candidate.key ===
              "number"
              ? String(
                  candidate.key
                )
              : "";

          const entryValue =
            typeof candidate.value ===
              "string" ||
            typeof candidate.value ===
              "number"
              ? String(
                  candidate.value
                )
              : "";

          if (
            !key &&
            !entryValue
          ) {
            return null;
          }

          return {
            key,
            value:
              entryValue,
            active:
              candidate.active ===
              true,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          key: string;
          value: string;
          active: boolean;
        } =>
          item !== null
      );

  return entries.length >
    0
    ? entries
    : undefined;
}

function sanitizeVisual(
  value: unknown
):
  | SanitizedVisual
  | undefined {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return undefined;
  }

  const raw =
    value as RawVisual;

  const allowedKinds =
    new Set([
      "reasoning",
      "array",
      "pointers",
      "hashmap",
      "stack",
      "tree",
      "code",
      "complexity",
      "takeaway",
    ]);

  const rawKind =
    asString(
      raw.kind,
      "reasoning"
    );

  const kind =
    allowedKinds.has(
      rawKind
    )
      ? rawKind
      : "reasoning";

  const visual:
    SanitizedVisual = {
      kind,
    };

  const values =
    sanitizeStringArray(
      raw.values
    );

  if (values) {
    visual.values =
      values;
  }

  const activeIndices =
    sanitizeNumberArray(
      raw.activeIndices
    );

  if (
    activeIndices
  ) {
    visual.activeIndices =
      activeIndices;
  }

  const pointers =
    sanitizePointers(
      raw.pointers
    );

  if (pointers) {
    visual.pointers =
      pointers;
  }

  const entries =
    sanitizeEntries(
      raw.entries
    );

  if (entries) {
    visual.entries =
      entries;
  }

  const stack =
    sanitizeStringArray(
      raw.stack
    );

  if (stack) {
    visual.stack =
      stack;
  }

  const operation =
    asString(
      raw.operation
    );

  if (operation) {
    visual.operation =
      operation;
  }

  const reasoningSteps =
    sanitizeStringArray(
      raw.reasoningSteps,
      8
    );

  if (
    reasoningSteps
  ) {
    visual.reasoningSteps =
      reasoningSteps;
  }

  return visual;
}

function sanitizeScene(
  value: unknown,
  index: number,
  questionType:
    string | undefined,
  codeSnippet:
    string | undefined
):
  SanitizedScene | null {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const raw =
    value as RawScene;

  const rawText =
    asString(
      raw.text
    );

  const rawNarration =
    asString(
      raw.narration,
      rawText
    );

  const text =
    compactSceneText(
      rawText
    );

  const narration =
    compactNarration(
      rawNarration
    );

  if (
    !text &&
    !narration
  ) {
    return null;
  }

  const scene:
    SanitizedScene = {
      type:
        asString(
          raw.type,
          index === 0
            ? "reasoning"
            : "explanation"
        ),

      title:
        asString(
          raw.title,
          index === 0
            ? "Let's Break It Down"
            : `Step ${
                index + 1
              }`
        ),

      text:
        text ||
        narration,

      narration:
        narration ||
        text,
    };

  /*
    Bug Hunt normally locks every walkthrough scene
    to the ORIGINAL source snippet.

    The one exception is the explicit corrected_code
    scene, which is allowed to carry the complete
    repaired snippet generated by the Coach.
  */
  const isCorrectedCodeScene =
    questionType ===
      "bug_hunt" &&
    scene.type ===
      "corrected_code";

  const rawCode =
    questionType ===
      "bug_hunt" &&
    codeSnippet &&
    !isCorrectedCodeScene
      ? codeSnippet
      : normalizeCode(
          raw.code
        );

  const code =
    normalizeCode(
      rawCode
    );

  if (code) {
    scene.code =
      code;
  }

  if (
    typeof raw.highlightLine ===
      "number" &&
    Number.isFinite(
      raw.highlightLine
    )
  ) {
    scene.highlightLine =
      Math.max(
        1,
        Math.trunc(
          raw.highlightLine
        )
      );
  }

  const highlightText =
    asString(
      raw.highlightText
    );

  if (
    highlightText
  ) {
    scene.highlightText =
      highlightText;
  }

  const takeaway =
    asString(
      raw.takeaway
    );

  if (takeaway) {
    scene.takeaway =
      takeaway;
  }

  const visual =
    sanitizeVisual(
      raw.visual
    );

  if (visual) {
    scene.visual =
      visual;
  }

  return scene;
}

function sanitizeExplanation(
  value: unknown,
  questionType:
    string | undefined,
  codeSnippet:
    string | undefined
):
  SanitizedExplanation {
  const raw =
    value &&
    typeof value ===
      "object"
      ? (value as RawExplanation)
      : {};

  const summary =
    asString(
      raw.summary,
      "Let's break down the correct reasoning."
    );

  const steps =
    Array.isArray(
      raw.steps
    )
      ? raw.steps
          .slice(
            0,
            8
          )
          .map(
            (step) =>
              asString(
                step
              )
          )
          .filter(
            Boolean
          )
      : [];

  const rawScenes =
    Array.isArray(
      raw.scenes
    )
      ? raw.scenes
      : [];

  const scenes =
    rawScenes
      .slice(
        0,
        4
      )
      .map(
        (
          scene,
          index
        ) =>
          sanitizeScene(
            scene,
            index,
            questionType,
            codeSnippet
          )
      )
      .filter(
        (
          scene
        ): scene is SanitizedScene =>
          scene !== null
      );

  /*
    Never return an empty scene list.
    This keeps the AI Coach UI safe.
  */
  if (
    scenes.length ===
    0
  ) {
    scenes.push({
      type:
        "reasoning",

      title:
        "The Key Idea",

      text:
        summary,

      narration:
        summary,

      visual: {
        kind:
          "reasoning",
      },
    });
  }

  return {
    summary,
    steps:
      steps.length >
      0
        ? steps
        : scenes.map(
            (scene) =>
              scene.text
          ),
    scenes,
  };
}

function preservePrimaryVisualThroughEnding(
  explanation:
    SanitizedExplanation,
  questionType:
    string | undefined
) {
  /*
    Complexity questions are the one category where
    the Big-O visualization itself is the subject.
  */
  if (
    questionType ===
      "complexity" ||
    questionType ===
      "bug_hunt"
  ) {
    return explanation;
  }

  const preferredKinds =
    new Set([
      "array",
      "pointers",
      "hashmap",
      "stack",
      "tree",
    ]);

  let primaryVisual:
    SanitizedVisual | undefined;

  for (
    const scene
    of explanation.scenes
  ) {
    if (
      scene.visual &&
      preferredKinds.has(
        scene.visual.kind
      )
    ) {
      primaryVisual =
        scene.visual;
    }
  }

  if (!primaryVisual) {
    return explanation;
  }

  for (
    const scene
    of explanation.scenes
  ) {
    const currentKind =
      scene.visual?.kind;

    if (
      currentKind !==
        "complexity" &&
      currentKind !==
        "takeaway"
    ) {
      continue;
    }

    const endingLabel =
      scene.visual
        ?.operation ||
      scene.takeaway ||
      scene.text;

    scene.visual = {
      ...primaryVisual,

      values:
        primaryVisual.values
          ? [
              ...primaryVisual.values,
            ]
          : undefined,

      activeIndices:
        primaryVisual.activeIndices
          ? [
              ...primaryVisual.activeIndices,
            ]
          : undefined,

      pointers:
        primaryVisual.pointers
          ? primaryVisual.pointers.map(
              (
                pointer
              ) => ({
                ...pointer,
              })
            )
          : undefined,

      entries:
        primaryVisual.entries
          ? primaryVisual.entries.map(
              (
                entry
              ) => ({
                ...entry,
              })
            )
          : undefined,

      stack:
        primaryVisual.stack
          ? [
              ...primaryVisual.stack,
            ]
          : undefined,

      reasoningSteps:
        primaryVisual.reasoningSteps
          ? [
              ...primaryVisual.reasoningSteps,
            ]
          : undefined,

      operation:
        endingLabel,
    };
  }

  return explanation;
}

function enforceBugHuntEnding(
  explanation:
    SanitizedExplanation,
  questionType:
    string | undefined
) {
  if (
    questionType !==
      "bug_hunt"
  ) {
    return explanation;
  }

  const correctedIndex =
    explanation.scenes.findIndex(
      (
        scene
      ) =>
        scene.type ===
          "corrected_code" &&
        Boolean(
          scene.code
        )
    );

  if (
    correctedIndex <
    0
  ) {
    /*
      Do not fake a corrected solution by copying the
      buggy source. The prompt contract requires the
      model to supply the repaired snippet.
    */
    return explanation;
  }

  const corrected =
    explanation.scenes[
      correctedIndex
    ];

  const before =
    explanation.scenes.filter(
      (
        _,
        index
      ) =>
        index !==
        correctedIndex
    );

  /*
    Correct code is always the final visual.
    Keep the game-speed maximum at four scenes.
  */
  explanation.scenes =
    [
      ...before.slice(
        0,
        3
      ),
      corrected,
    ];

  return explanation;
}

function stripJsonFences(
  value: string
) {
  return value
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();
}

function getQuestionTypeGuidance(
  questionType?: string
) {
  switch (
    questionType
  ) {
    case "data_structure":
      return `
DATA STRUCTURE SHOWCASE — HIGH VISUAL PRIORITY:
- The CORRECT data structure should be the visual centerpiece.
- Identify the structure from the correct answer and show it immediately.
- Prefer a concrete structure visual over a generic reasoning diagram.
- Scene 1: show the chosen structure and the key operation it supports.
- Scene 2: show one concrete state change on a small example.
- Final scene: give the important complexity / why-this-structure takeaway WHILE KEEPING THE SAME DATA-STRUCTURE VISUAL ON SCREEN.
- Do NOT switch to a standalone complexity animation for the ending.
- Keep the same source values across scenes so players can track state.
- Do NOT spend a full scene comparing alternatives unless the distinction is the point of the question.
- Prefer array, hashmap, stack, tree, or pointers visuals.
- The player should understand WHY this structure is the right choice by watching the state change.`;

    case "optimal_approach":
      return `
OPTIMAL APPROACH FOCUS:
- Start with the tempting brute-force idea.
- Explain exactly where it wastes work.
- Show the observation that removes repeated work.
- Connect that observation to the optimal algorithm.
- Explain the time/space tradeoff clearly.`;

    case "bug_hunt":
      return `
BUG HUNT SHOWCASE — HIGH VISUAL PRIORITY:
Use a fast visual debugging sequence.

REQUIRED ORDER:
1. Show the ORIGINAL buggy code exactly as provided.
2. Highlight the exact bad line / operation.
3. Briefly show what that bug causes.
4. END by showing the FULL CORRECTED CODE.

CRITICAL FINAL-SCENE CONTRACT:
- The final scene.type MUST be "corrected_code".
- The final scene.visual.kind MUST be "code".
- The final scene.code MUST contain the COMPLETE corrected snippet, not only the changed line.
- The corrected code must preserve the original language and surrounding structure.
- The final scene should highlight the corrected line when possible.
- The final narration should be short, e.g. "Change this condition and the loop now terminates correctly."
- Do not make the final scene a generic takeaway card.
- The corrected code itself IS the takeaway.

Before the final scene:
- Always show the original source, never a rewritten approximation.
- Use highlightLine/highlightText when possible.
- Explain the consequence in one short sentence.
- Do not spend time discussing unrelated improvements or style changes.`;

    case "complexity":
      return `
COMPLEXITY FOCUS:
- Explain where every factor in the Big-O expression comes from.
- Separate time complexity from space complexity.
- Mention nested loops, repeated work, recursion depth, or data-structure operations when relevant.
- Do not state Big-O without explaining why.`;

    case "edge_case":
      return `
EDGE CASE FOCUS:
- Give one concrete input/state that breaks the tempting solution.
- Walk through exactly what happens on that input.
- Explain what condition/check the correct solution needs.
- Prefer array, pointers, code, or reasoning visuals.`;

    default:
      return `
GENERAL FOCUS:
- Explain the key observation.
- Walk through the reasoning.
- Explain why the correct answer beats the tempting alternatives.
- End with a useful coding-interview takeaway.`;
  }
}


function detectOptimalTechnique(
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  const combined =
    `${question}
${correctChoice}
${codeSnippet}`
      .toLowerCase();

  if (
    combined.includes(
      "sliding window"
    ) ||
    combined.includes(
      "window size"
    ) ||
    combined.includes(
      "window of size"
    )
  ) {
    return "sliding_window" as const;
  }

  if (
    combined.includes(
      "two pointers"
    ) ||
    combined.includes(
      "two-pointers"
    ) ||
    (
      combined.includes(
        "left"
      ) &&
      combined.includes(
        "right"
      ) &&
      (
        combined.includes(
          "pair"
        ) ||
        combined.includes(
          "sorted"
        ) ||
        combined.includes(
          "container"
        )
      )
    )
  ) {
    return "two_pointers" as const;
  }

  if (
    combined.includes(
      "level order"
    ) ||
    combined.includes(
      "breadth-first"
    ) ||
    combined.includes(
      "breadth first"
    ) ||
    combined.includes(
      "bfs"
    )
  ) {
    return "bfs" as const;
  }

  if (
    (
      combined.includes(
        "preorder"
      ) ||
      combined.includes(
        "inorder"
      ) ||
      combined.includes(
        "postorder"
      ) ||
      combined.includes(
        "depth-first"
      ) ||
      combined.includes(
        "depth first"
      ) ||
      combined.includes(
        "dfs"
      )
    ) &&
    (
      combined.includes(
        "tree"
      ) ||
      combined.includes(
        "node"
      )
    )
  ) {
    return "tree_dfs" as const;
  }

  if (
    combined.includes(
      "binary search"
    )
  ) {
    return "binary_search" as const;
  }

  if (
    combined.includes(
      "hash map"
    ) ||
    combined.includes(
      "hashmap"
    ) ||
    combined.includes(
      "hash set"
    ) ||
    combined.includes(
      "hashset"
    )
  ) {
    return "hash_map" as const;
  }

  if (
    combined.includes(
      "stack"
    )
  ) {
    return "stack" as const;
  }

  if (
    combined.includes(
      "prefix sum"
    )
  ) {
    return "prefix_sum" as const;
  }

  if (
    combined.includes(
      "linked list"
    )
  ) {
    return "linked_list" as const;
  }

  return "unknown" as const;
}

function isSlidingWindowProblem(
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  return (
    detectOptimalTechnique(
      question,
      correctChoice,
      codeSnippet
    ) ===
    "sliding_window"
  );
}

function isTwoPointersProblem(
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  return (
    detectOptimalTechnique(
      question,
      correctChoice,
      codeSnippet
    ) ===
    "two_pointers"
  );
}

function getTechniqueFirstRule(
  technique:
    string
) {
  return `
OPTIMAL-SOLUTION ANIMATION RULE — CRITICAL:
- The PRIMARY animated walkthrough must show the CORRECT / OPTIMAL technique.
- The thing that moves or changes on screen should be the optimal solution itself.
- Do NOT animate a different technique just because it is visually easy.
- Supporting structures may appear only if they are genuinely part of the optimal solution.
- If the optimal solution is ${technique}, the animation must visibly teach ${technique}.
- The player should be able to tell what the best approach is by watching the animation alone.
`;
}

function getAlgorithmSpecificGuidance(
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  const technique =
    detectOptimalTechnique(
      question,
      correctChoice,
      codeSnippet
    );

  if (
    technique ===
    "sliding_window"
  ) {
    return `
${getTechniqueFirstRule("sliding window")}

SLIDING WINDOW OVERRIDE — VERY IMPORTANT:
This problem is solved with a sliding-window technique.

The VISUAL EXPLANATION must teach the sliding window itself.

For the walkthrough scenes:
- Prefer visual.kind = "pointers" or "array".
- Show the underlying array/string across the screen.
- Use pointer labels "left" and "right".
- The region between left and right represents the CURRENT WINDOW.
- Use activeIndices to mark the values currently inside the window.
- Show how "right" expands the window.
- Show how "left" shrinks or advances the window when the condition requires it.
- Keep the same values across consecutive walkthrough scenes so players can follow the state change.
- Use short operations such as:
  "Expand right"
  "Window sum = 7"
  "Condition fails — move left"
  "Window valid — update best"
- Narration MUST explicitly explain why moving left/right avoids recomputing every possible subarray/substring.
- For a fixed-size window, show both boundaries advancing together after the first full window.
- For a variable-size window, show right expanding and left shrinking only when the constraint is violated.

DO NOT use a hashmap/key-value table as the main walkthrough visual.
A hashmap may appear ONLY if the actual sliding-window algorithm genuinely maintains counts/frequencies, and even then:
- the primary walkthrough must still show the window with left/right pointers;
- use at most ONE secondary hashmap scene;
- never replace the sliding-window visualization with the hashmap.

A strong sliding-window scene sequence is:
1. Show the initial left/right boundaries.
2. Expand right and show what enters the window.
3. Show the condition/value being tracked inside the window.
4. If needed, move left and show what leaves the window.
5. Explain why each index moves at most once, giving O(n) time.
`;
  }

  if (
    technique ===
    "two_pointers"
  ) {
    return `
${getTechniqueFirstRule("two pointers")}

TWO POINTERS OVERRIDE — VERY IMPORTANT:
This problem is solved with a two-pointers technique.

The main walkthrough must animate the pointers themselves.

For the walkthrough scenes:
- Prefer visual.kind = "pointers" or "array".
- Show the array/string in a single horizontal line.
- Use pointer labels "left" and "right".
- Use activeIndices to emphasize the values currently being compared.
- Show the pointer movement that makes progress toward the answer.
- Use short operations like:
  "Compare left and right"
  "Sum too small — move left"
  "Sum too large — move right"
  "Better area found"
- If the problem is sorted, narration should explicitly mention that sorted order is what makes pointer movement valid.

Do NOT turn the main visual into a hashmap, stack, or abstract table unless that is actually the optimal solution.
`;
  }

  if (
    technique ===
    "binary_search"
  ) {
    return `
${getTechniqueFirstRule("binary search")}

BINARY SEARCH OVERRIDE:
- The main visual should be an array with "left", "mid", and "right" markers.
- Animate narrowing the search space.
- Do not animate unrelated data structures as the main walkthrough.
`;
  }

  if (
    technique ===
    "bfs"
  ) {
    return `
${getTechniqueFirstRule("breadth-first search with a queue")}

BFS / LEVEL-ORDER OVERRIDE — VERY IMPORTANT:
The primary walkthrough must animate the BFS traversal itself.

Use visual.kind = "tree" for the walkthrough.

Represent the tree with existing visual fields:
- visual.values = level-order tree values.
- Include "null" placeholders where needed to preserve child positions.
- visual.activeIndices = the current tree node(s) being processed or discovered.
- visual.stack = the CURRENT QUEUE contents. For tree visuals, "stack" is intentionally reused as queue state.
- visual.operation = a short state description such as:
  "Queue starts with root"
  "Dequeue 3"
  "Enqueue 9 and 20"
  "Finish level [3]"
  "Process next level"

The visual must keep BOTH:
1. the tree structure visible, and
2. the queue visible beside it.

Across consecutive walkthrough scenes:
- keep visual.values identical;
- update activeIndices to show the current node(s);
- update visual.stack to show queue state;
- keep the scene mostly static between state changes;
- code appears only after the BFS state walkthrough is clear.

A strong BFS sequence:
1. Root active; queue contains root.
2. Dequeue root; discover/enqueue children.
3. Hold completed first level.
4. Process the next level; queue updates.
5. Explain each node enters/leaves the queue once: O(n).

Do NOT replace BFS with a plain array, hashmap, isolated queue, or code-only animation.
The TREE is the source structure; the QUEUE is the working state.
`;
  }

  if (
    technique ===
    "tree_dfs"
  ) {
    return `
${getTechniqueFirstRule("tree depth-first traversal")}

TREE DFS OVERRIDE:
- Use visual.kind = "tree".
- visual.values = level-order tree representation.
- visual.activeIndices = the current node/path being visited.
- Keep the tree visible for the entire traversal walkthrough.
- Use visual.stack only if an explicit iterative stack is truly part of the optimal implementation.
- For recursive DFS, emphasize the visited node/path without inventing an unrelated data structure.
- Show code only after the traversal behavior is visually clear.
`;
  }

  if (
    technique ===
    "hash_map"
  ) {
    return `
${getTechniqueFirstRule("a hash map / hash set")}

HASH MAP / HASH SET OVERRIDE:
- The main visual should show lookups or inserts in the hash structure.
- Only animate array scanning if it directly supports the hash-map logic.
`;
  }

  if (
    technique ===
    "stack"
  ) {
    return `
${getTechniqueFirstRule("a stack")}

STACK OVERRIDE:
- The main visual should show BOTH the original input sequence and the working stack at the same time.
- visual.values = the original input sequence.
- visual.activeIndices = the current input element being processed.
- visual.stack = the current working stack.
- Keep visual.values consistent across consecutive walkthrough scenes.
- Show push/pop behavior only when the narration explains why that operation happens.
- For bracket matching, show the active closing bracket and the opener at the top of the stack before the pop.
- For monotonic stack problems, show the active array value and which stack values are removed/kept.
- Avoid replacing the stack walkthrough with a generic array unless the array is clearly being used as a stack.
- Prefer 2-4 concrete stack-state scenes before showing code.
`;
  }

  if (
    technique ===
    "prefix_sum"
  ) {
    return `
${getTechniqueFirstRule("prefix sums")}

PREFIX SUM OVERRIDE:
- The main visual should show cumulative totals building from left to right.
- Show how a range answer comes from combining prefix totals.
`;
  }

  return getTechniqueFirstRule(
    "the correct answer"
  );
}

function extractLikelySequence(
  question:
    string,
  codeSnippet:
    string
) {
  const sources = [
    question,
    codeSnippet,
  ];

  for (
    const source
    of sources
  ) {
    const matches =
      source.match(
        /\[([^\[\]]{1,120})\]/g
      ) ?? [];

    for (
      const match
      of matches
    ) {
      const inner =
        match
          .slice(1, -1)
          .trim();

      const pieces =
        inner
          .split(",")
          .map(
            (
              item
            ) =>
              item
                .trim()
                .replace(
                  /^["']|["']$/g,
                  ""
                )
          )
          .filter(
            Boolean
          );

      if (
        pieces.length >= 3 &&
        pieces.length <= 12
      ) {
        return pieces;
      }
    }
  }

  return undefined;
}

function getSlidingWindowValues(
  explanation:
    SanitizedExplanation,
  question:
    string,
  codeSnippet:
    string
) {
  for (
    const scene
    of explanation.scenes
  ) {
    const values =
      scene.visual
        ?.values;

    if (
      values &&
      values.length >= 3
    ) {
      return values;
    }
  }

  return (
    extractLikelySequence(
      question,
      codeSnippet
    ) ?? [
      "a₀",
      "a₁",
      "a₂",
      "a₃",
      "a₄",
      "a₅",
    ]
  );
}

function enforceSlidingWindowVisuals(
  explanation:
    SanitizedExplanation,
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  if (
    !isSlidingWindowProblem(
      question,
      correctChoice,
      codeSnippet
    )
  ) {
    return explanation;
  }

  const values =
    getSlidingWindowValues(
      explanation,
      question,
      codeSnippet
    );

  const maxIndex =
    Math.max(
      0,
      values.length - 1
    );

  const walkthroughIndices =
    explanation.scenes
      .map(
        (
          scene,
          index
        ) => ({
          scene,
          index,
        })
      )
      .filter(
        (
          item
        ) =>
          item.scene.visual
            ?.kind !== "complexity" &&
          item.scene.visual
            ?.kind !== "takeaway" &&
          item.index > 0
      )
      .map(
        (
          item
        ) => item.index
      );

  const walkthroughCount =
    Math.max(
      1,
      walkthroughIndices.length
    );

  let walkthroughStep =
    0;

  for (
    let sceneIndex = 0;
    sceneIndex <
      explanation.scenes.length;
    sceneIndex += 1
  ) {
    const scene =
      explanation.scenes[
        sceneIndex
      ];

    if (
      scene.visual?.kind ===
        "complexity" ||
      scene.visual?.kind ===
        "takeaway"
    ) {
      continue;
    }

    if (
      sceneIndex === 0 &&
      scene.visual?.kind ===
        "reasoning"
    ) {
      continue;
    }

    const progress =
      walkthroughCount <= 1
        ? 0
        : walkthroughStep /
          (
            walkthroughCount - 1
          );

    const right =
      Math.min(
        maxIndex,
        Math.max(
          1,
          Math.round(
            progress *
              maxIndex
          )
        )
      );

    const left =
      walkthroughStep <= 1
        ? 0
        : Math.min(
            Math.max(
              0,
              right - 2
            ),
            Math.max(
              0,
              right - 1
            )
          );

    const activeIndices =
      Array.from(
        {
          length:
            Math.max(
              1,
              right - left + 1
            ),
        },
        (
          _,
          offset
        ) =>
          left + offset
      ).filter(
        (
          index
        ) => index <= maxIndex
      );

    const existingOperation =
      scene.visual
        ?.operation;

    scene.visual = {
      kind: "pointers",
      values,
      activeIndices,
      pointers: [
        {
          label: "left",
          index: left,
        },
        {
          label: "right",
          index: right,
        },
      ],
      operation:
        existingOperation ||
        (
          walkthroughStep === 0
            ? "Start the window"
            : left === 0
              ? "Expand right"
              : "Slide the window"
        ),
    };

    walkthroughStep += 1;
  }

  return explanation;
}

function enforceTwoPointerVisuals(
  explanation:
    SanitizedExplanation,
  question:
    string,
  correctChoice:
    string,
  codeSnippet:
    string
) {
  if (
    !isTwoPointersProblem(
      question,
      correctChoice,
      codeSnippet
    )
  ) {
    return explanation;
  }

  const values =
    getSlidingWindowValues(
      explanation,
      question,
      codeSnippet
    );

  const maxIndex =
    Math.max(
      0,
      values.length - 1
    );

  const walkthroughScenes =
    explanation.scenes.filter(
      (
        scene,
        index
      ) =>
        index > 0 &&
        scene.visual?.kind !==
          "complexity" &&
        scene.visual?.kind !==
          "takeaway"
    );

  const total =
    Math.max(
      1,
      walkthroughScenes.length
    );

  let step = 0;

  for (
    let index = 0;
    index <
      explanation.scenes.length;
    index += 1
  ) {
    const scene =
      explanation.scenes[
        index
      ];

    if (
      scene.visual?.kind ===
        "complexity" ||
      scene.visual?.kind ===
        "takeaway"
    ) {
      continue;
    }

    if (
      index === 0 &&
      scene.visual?.kind ===
        "reasoning"
    ) {
      continue;
    }

    const progress =
      total <= 1
        ? 0
        : step /
          (
            total - 1
          );

    const left =
      Math.min(
        Math.floor(
          progress *
            (
              maxIndex / 2
            )
        ),
        maxIndex
      );

    const right =
      Math.max(
        left,
        maxIndex - left
      );

    scene.visual = {
      kind: "pointers",
      values,
      activeIndices:
        left === right
          ? [left]
          : [left, right],
      pointers: [
        {
          label: "left",
          index: left,
        },
        {
          label: "right",
          index: right,
        },
      ],
      operation:
        scene.visual
          ?.operation ||
        (
          step === 0
            ? "Start at both ends"
            : "Move the pointers"
        ),
    };

    step += 1;
  }

  return explanation;
}
/* ========================================
   ACTION
======================================== */

export const generateExplanation =
  action({
    args: {
      question:
        v.string(),

      questionType:
        v.optional(
          v.string()
        ),

      choices:
        v.array(
          v.string()
        ),

      correctAnswer:
        v.number(),

      codeSnippet:
        v.optional(
          v.string()
        ),
    },

    handler: async (
      _ctx,
      args
    ) => {
      const apiKey =
        process.env
          .OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not configured in Convex."
        );
      }

      const safeCorrectIndex =
        Number.isInteger(
          args.correctAnswer
        ) &&
        args.correctAnswer >=
          0 &&
        args.correctAnswer <
          args.choices.length
          ? args.correctAnswer
          : 0;

      const correctChoice =
        args.choices[
          safeCorrectIndex
        ] ??
        "Unknown";

      const sourceCode =
        args.codeSnippet
          ?.replace(
            /\\n/g,
            "\n"
          )
          .trim() ||
        "";

      const questionType =
        args.questionType
          ?.trim() ||
        "general";

      const typeGuidance =
        getQuestionTypeGuidance(
          questionType
        );

      const algorithmGuidance =
        getAlgorithmSpecificGuidance(
          args.question,
          correctChoice,
          sourceCode
        );

      const prompt = `
You are the AI COACH and game-show host for a multiplayer coding interview game called CODE ROYALE.

The players just missed this question. Your job is NOT to merely reveal the answer. Teach the reasoning an interviewer would want to hear while keeping the explanation energetic, visual, and concise enough for a game.

QUESTION TYPE:
${questionType}

QUESTION:
${args.question}

CHOICES:
${args.choices
  .map(
    (
      choice,
      index
    ) =>
      `${index}. ${choice}`
  )
  .join("\n")}

CORRECT ANSWER INDEX:
${safeCorrectIndex}

CORRECT ANSWER:
${correctChoice}

${
  sourceCode
    ? `ORIGINAL CODE:
${sourceCode}`
    : "ORIGINAL CODE: None"
}

${typeGuidance}

${algorithmGuidance}

VOICE / COACH PERSONALITY:
- Sound like a fast, confident game-show coach who knows software engineering.
- Keep the energy high but the wording tight.
- Never sound like a lecture or textbook.
- Skip filler, long setup, repeated context, and unnecessary suspense.
- Do not greet the players again inside every scene.
- Do not restate the entire question.
- Technical explanations must remain accurate.

GAME-PACE RULE — CRITICAL:
This is a multiplayer game, not a lesson video.

The ENTIRE AI Coach explanation should usually take about 20-30 seconds.

Every scene has TWO forms:

1. "text"
   - Tiny on-screen caption.
   - Usually 3-8 words.
   - Maximum about 10 words.

2. "narration"
   - What the voice says.
   - Usually 15-28 spoken words.
   - HARD preference for one or two short sentences.
   - Explain only the key reason or state change visible in that scene.
   - Do not repeat the screen text.
   - Do not explain every alternative answer.
   - Mention a wrong approach only when it is essential to understanding the trap.

CREATE 3 SCENES BY DEFAULT.
USE 4 SCENES ONLY when the optimal solution genuinely needs another visible state change.
NEVER create more than 4 scenes.
For Bug Hunt, prefer 3-4 scenes so the corrected-code ending is always included.
For Data Structure, prefer 3 scenes.
Aim for roughly 60-90 spoken words TOTAL across the whole explanation.

GAME-SPEED SCENE STRUCTURE:

QUESTION-TYPE PRIORITY:
- Bug Hunt and Data Structure questions are visual showcase categories.
- Give their concrete visual state priority over abstract reasoning.
- Bug Hunt MUST end on corrected full code.
- Data Structure questions should spend most of their time showing the chosen structure working.

3-scene default:
1. KEY IDEA
   - State the optimal insight immediately.
   - No long hook.

2. OPTIMAL WALKTHROUGH
   - Show the most important state change on a concrete input.
   - This is the visual centerpiece.

3. WHY IT WINS
   - Keep the optimal solution / data structure visible.
   - Add complexity as a SHORT label or operation on that same visual.
   - Do NOT replace the optimal visual with a separate Big-O animation.
   - Give one memorable takeaway and close quickly.

4-scene version, only when needed:
1. Key idea
2. Optimal walkthrough state A
3. Optimal walkthrough state B OR code trace
4. Complexity + takeaway, while the optimal-solution visual remains on screen

IMPORTANT:
- Concept first, implementation second.
- Do not spend a separate scene on a "trap" unless the question specifically depends on it.
- Do not create a separate code scene unless code is necessary to understand the answer.
- For Bug Hunt, code can be the walkthrough because the code itself is the problem.
- During the walkthrough, keep the original input visible whenever a working structure is also important.
- The player should understand the optimal approach quickly, then get back to the game.

VISUAL RULES:
Each scene may have ONE "visual" object.

CRITICAL VISUAL-SELECTION RULE:
- The visual must illustrate the ACTUAL algorithm named by or implied by the correct answer.
- The optimal solution should be the thing that is animated.
- Do not choose a data-structure visual merely because that data structure is common in coding interviews.
- If the optimal technique is sliding window, two pointers, BFS/DFS, binary search, stack, etc., the walkthrough must visibly demonstrate THAT technique.
- The walkthrough should show algorithm STATE changing across scenes, not unrelated data structures.
- Prefer the simplest visual that directly answers: "What is the algorithm doing right now?"
- The optimal algorithm/data structure should remain the dominant visual for MOST of the explanation.
- For every question type EXCEPT "complexity", do NOT use visual.kind = "complexity" as a replacement for the main algorithm visual.
- Time/space complexity should usually appear as short narration or visual.operation text while the optimal visual remains on screen.
- Example: for sliding window, keep the array + left/right window visible while saying "O(n) time, O(1) space."
- Example: for stack, keep input + stack visible while saying complexity.
- Example: for BFS, keep tree + queue visible while saying complexity.

Allowed visual.kind values ONLY:
- "reasoning"
- "array"
- "pointers"
- "hashmap"
- "stack"
- "tree"
- "code"
- "complexity"
- "takeaway"

Allowed visual fields ONLY:
- kind
- values
- activeIndices
- pointers
- entries
- stack
- operation
- reasoningSteps

Visual shapes:

ARRAY:
{
  "kind": "array",
  "values": ["2", "7", "11", "15"],
  "activeIndices": [0, 1]
}

POINTERS:
{
  "kind": "pointers",
  "values": ["1", "2", "3", "4"],
  "activeIndices": [0, 1, 2, 3],
  "pointers": [
    {"label": "left", "index": 0},
    {"label": "right", "index": 3}
  ],
  "operation": "Current sliding window"
}

For sliding-window problems, activeIndices should represent EVERY index currently inside the window from left through right.

HASHMAP:
{
  "kind": "hashmap",
  "entries": [
    {"key": "2", "value": "0", "active": true},
    {"key": "7", "value": "1", "active": false}
  ],
  "operation": "Check whether target - current is already stored"
}

STACK:
{
  "kind": "stack",
  "values": ["{", "[", "(", ")", "]", "}"],
  "activeIndices": [3],
  "stack": ["{", "[", "("],
  "operation": "Current ')' matches top '(' — pop"
}

STACK VISUAL RULES:
- "values" is the ORIGINAL input sequence and should stay the same across the stack walkthrough.
- "activeIndices" should normally contain the ONE input index currently being processed.
- "stack" is the CURRENT working stack state for that scene.
- Keep both the input and the stack visible at the same time.
- For matching-bracket / monotonic-stack / expression problems, animate the current input item and the stack operation together.
- Use several consecutive stack scenes when needed so players can see:
  input item -> decision -> push/pop -> updated stack.
- Do NOT show an isolated stack if the source input is important to understanding why the operation happens.

TREE / BFS:
{
  "kind": "tree",
  "values": ["3", "9", "20", "null", "null", "15", "7"],
  "activeIndices": [0],
  "stack": ["3"],
  "operation": "Queue starts with the root"
}

TREE VISUAL RULES:
- values uses level-order indexing:
  left child = 2*i + 1
  right child = 2*i + 2
- Use "null" placeholders when needed to preserve tree positions.
- activeIndices marks current / discovered / emphasized tree nodes.
- For BFS, stack is used as the queue state.
- Keep values identical across the walkthrough.
- Update only node highlights, queue state, and compact operation text.
- Keep the tree visible while queue state changes.
- For DFS, stack is optional and appears only if the actual optimal implementation uses it.

REASONING:
{
  "kind": "reasoning",
  "reasoningSteps": [
    "Identify the repeated work",
    "Store what we already know",
    "Reuse it in O(1) average time"
  ]
}

COMPLEXITY — RESERVED PRIMARILY FOR questionType = "complexity":
{
  "kind": "complexity",
  "reasoningSteps": [
    "Visit each element once: O(n)",
    "Hash lookup is O(1) average",
    "Store up to n elements: O(n) space"
  ]
}

TAKEAWAY:
{
  "kind": "takeaway",
  "reasoningSteps": [
    "State the brute-force option",
    "Identify repeated work",
    "Explain the optimized structure"
  ]
}

CODE SCENES:
- Use code scenes AFTER the optimal solution has already been demonstrated visually whenever possible.
- The code scene should reinforce the same algorithm state the player just saw, not introduce a different technique.
- "code" must contain valid source code text when used.
- "highlightLine" is 1-based.
- "highlightText" should identify the important expression or statement.
- For Bug Hunt questions, NEVER invent replacement code. Use the ORIGINAL code supplied above.
- Preserve newlines in code.

OUTPUT RULES:
Return VALID JSON ONLY.
No markdown fences.
No commentary outside the JSON.

Use exactly this top-level structure:

{
  "summary": "One concise sentence summarizing the main insight.",
  "steps": [
    "Short reasoning step 1",
    "Short reasoning step 2",
    "Short reasoning step 3"
  ],
  "scenes": [
    {
      "type": "reasoning",
      "title": "What They're Testing",
      "text": "Tiny visual caption.",
      "narration": "Short game-speed explanation tied to the visible state.",
      "visual": {
        "kind": "reasoning",
        "reasoningSteps": [
          "Step one",
          "Step two"
        ]
      }
    }
  ]
}

SCENE FIELD RULES:
Allowed scene fields ONLY:
- type
- title
- text
- narration
- code
- highlightLine
- highlightText
- takeaway
- visual

Do NOT return null.
If a field is not needed, OMIT it entirely.
Do NOT add fields not listed above.

FINAL SCENE:
The final scene should combine complexity and one memorable takeaway whenever possible.
Keep its narration short and decisive so the game can resume immediately.
`;

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
                  "gpt-4o-mini",

                temperature:
                  0.7,

                response_format: {
                  type:
                    "json_object",
                },

                messages: [
                  {
                    role:
                      "system",

                    content:
                      "You generate accurate, structured coding-interview explanations for Code Royale. Always return valid JSON and follow the requested schema exactly.",
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
          "AI explanation request failed:",
          response.status,
          details
        );

        throw new Error(
          "AI explanation generation failed."
        );
      }

      const payload:
        unknown =
        await response.json();

      if (
        !payload ||
        typeof payload !==
          "object"
      ) {
        throw new Error(
          "AI explanation returned an invalid response."
        );
      }

      const data =
        payload as {
          choices?: Array<{
            message?: {
              content?: unknown;
            };
          }>;
        };

      const content =
        data.choices?.[0]
          ?.message
          ?.content;

      if (
        typeof content !==
          "string" ||
        content.trim()
          .length === 0
      ) {
        throw new Error(
          "AI explanation returned no content."
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
          "Failed to parse AI explanation JSON:",
          content,
          error
        );

        throw new Error(
          "AI explanation returned invalid JSON."
        );
      }

      const sanitized =
        sanitizeExplanation(
          parsed,
          questionType,
          sourceCode ||
            undefined
        );

      /*
        Safety passes:
        - sliding window should animate the window itself
        - two pointers should animate the pointers themselves
      */
      const techniqueFirst =
        enforceSlidingWindowVisuals(
          sanitized,
          args.question,
          correctChoice,
          sourceCode
        );

      const techniqueSafe =
        enforceTwoPointerVisuals(
          techniqueFirst,
          args.question,
          correctChoice,
          sourceCode
        );

      const visuallyPrioritized =
        preservePrimaryVisualThroughEnding(
          techniqueSafe,
          questionType
        );

      return enforceBugHuntEnding(
        visuallyPrioritized,
        questionType
      );
    },
  });
