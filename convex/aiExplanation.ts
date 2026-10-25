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

  const text =
    asString(
      raw.text
    );

  const narration =
    asString(
      raw.narration,
      text
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
    For Bug Hunt questions, always prefer the
    ORIGINAL source snippet so the AI cannot
    accidentally rewrite the buggy code.
  */
  const rawCode =
    questionType ===
      "bug_hunt" &&
    codeSnippet
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
        6
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
DATA STRUCTURE FOCUS:
- Explain why the chosen data structure fits the operations the problem needs.
- Compare it briefly against the most tempting alternative.
- Show the important state of the structure as the algorithm runs.
- Prefer array, hashmap, stack, pointers, or reasoning visuals.`;

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
BUG HUNT FOCUS:
- Use the ORIGINAL code exactly as provided.
- Identify the real problematic line or operation.
- Explain what the program does because of that bug.
- Explain the conceptual fix.
- Never silently rewrite the source code.
- Use highlightLine/highlightText when possible.`;

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

VOICE / COACH PERSONALITY:
- Sound like an energetic game-show host who is also an experienced software engineer.
- Confident, conversational, and encouraging.
- Never sound like a textbook or a robotic narrator.
- Build a little suspense before the important reveal.
- Occasionally address the group as "coders", but do not overuse it.
- Use natural transitions such as:
  "Here's the key..."
  "Now watch what happens..."
  "This is where the trap is..."
  "The interviewer is really testing whether you notice..."
- Do not insult players for missing the question.
- Technical explanations must remain accurate.

MOST IMPORTANT RULE:
Every scene has TWO different forms of explanation:

1. "text"
   - What appears on the screen.
   - Keep this SHORT: usually 1-2 sentences.

2. "narration"
   - What the AI game-show voice actually says.
   - This MUST EXPAND on the screen text instead of reading it word-for-word.
   - Explain WHY the answer works.
   - Explain the reasoning process.
   - Mention why a tempting wrong approach fails when useful.
   - Walk through important state changes in code/data structures.
   - Aim for roughly 35-75 spoken words per scene.
   - Avoid repeating the same sentence from "text".

CREATE 4 TO 6 SCENES.

A strong explanation usually follows this progression:
1. Hook: what the question is really testing.
2. Key observation: the insight needed to solve it.
3. Walkthrough: trace the code/data structure/algorithm.
4. Trap: why a tempting wrong answer fails.
5. Complexity or tradeoff.
6. Interview takeaway.

You may adapt that structure when another sequence fits the question better.

VISUAL RULES:
EVERY scene MUST include exactly ONE "visual" object.
Do NOT create text-only scenes.

The visuals should meaningfully illustrate the explanation instead of acting as decoration.

IMPORTANT VISUAL VARIETY:
- Use at most TWO "reasoning" visuals in the entire explanation.
- At least ONE middle scene MUST use a concrete animated visual when applicable:
  "array", "pointers", "hashmap", "stack", or "code".
- Use "complexity" for the complexity/tradeoff scene.
- Use "takeaway" for the final interview-takeaway scene.
- Prefer visuals that match the actual data structure or algorithm in the question.
- Do not use "reasoning" for every scene.

QUESTION-SPECIFIC VISUAL GUIDANCE:
- data_structure: visualize the actual structure changing. Prefer "array", "hashmap", "stack", or "pointers".
- optimal_approach: show the optimized structure/state and how it avoids repeated work.
- bug_hunt: use "code" for the bug walkthrough and highlight the original faulty line. Never invent replacement source code.
- complexity: include a "complexity" visual and show why the stated complexity follows from the operations.
- edge_case: visualize the exact input/state that exposes the edge case.

Allowed visual.kind values ONLY:
- "reasoning"
- "array"
- "pointers"
- "hashmap"
- "stack"
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
  "pointers": [
    {"label": "left", "index": 0},
    {"label": "right", "index": 3}
  ]
}

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
  "stack": ["(", "[", "{"],
  "operation": "Pop when the closing bracket matches"
}

REASONING:
{
  "kind": "reasoning",
  "reasoningSteps": [
    "Identify the repeated work",
    "Store what we already know",
    "Reuse it in O(1) average time"
  ]
}

COMPLEXITY:
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
      "text": "Short on-screen explanation.",
      "narration": "Longer natural spoken explanation that teaches the reasoning instead of reading the text.",
      "visual": {
        "kind": "reasoning",
        "reasoningSteps": [
          "Identify the goal",
          "Spot the repeated work"
        ]
      }
    },
    {
      "type": "walkthrough",
      "title": "Watch the State Change",
      "text": "Show the important data structure state.",
      "narration": "Walk through the changing state naturally and explain why this operation moves us toward the answer.",
      "visual": {
        "kind": "array",
        "values": ["2", "7", "11", "15"],
        "activeIndices": [0, 1],
        "operation": "Compare the active values"
      }
    },
    {
      "type": "complexity",
      "title": "Why It's Efficient",
      "text": "Connect the operations to the runtime.",
      "narration": "Explain the time and space complexity in interview terms.",
      "visual": {
        "kind": "complexity",
        "reasoningSteps": [
          "Visit each element once: O(n)",
          "Each lookup is O(1) average",
          "Store up to n values: O(n) space"
        ]
      }
    },
    {
      "type": "takeaway",
      "title": "Interview Takeaway",
      "text": "End with the reusable interview insight.",
      "narration": "Give a confident closing takeaway that the player can reuse in a real coding interview.",
      "takeaway": "Choose the data structure that removes repeated work.",
      "visual": {
        "kind": "takeaway",
        "operation": "Turn repeated searches into fast lookups"
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
The final scene should give one memorable interview takeaway.
Its narration should sound like a confident closing from the Code Royale coach.
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

      return sanitizeExplanation(
        parsed,
        questionType,
        sourceCode ||
          undefined
      );
    },
  });
