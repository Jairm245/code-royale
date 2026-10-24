"use node";

import {
  action,
} from "./_generated/server";

import {
  v,
} from "convex/values";

import OpenAI from "openai";

/* ========================================
   GENERATE EXPLANATION
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
          "OPENAI_API_KEY is not configured."
        );
      }

      const openai =
        new OpenAI({
          apiKey,
        });

      const correctChoice =
        args.choices[
          args.correctAnswer
        ];

      const isBugHunt =
        args.questionType ===
          "bug_hunt";

      /* ====================================
         PROMPT
      ==================================== */

      const prompt = `
You are the animated AI Coach for Code Royale.

Code Royale is a multiplayer coding interview game.

Your job is to explain WHY the correct answer works
using short animated scenes.

Question type:
${args.questionType ?? "unknown"}

Question:
${args.question}

Choices:

${args.choices
  .map(
    (
      choice,
      index
    ) =>
      `${index}: ${choice}`
  )
  .join("\n")}

Correct answer:

${correctChoice}

${
  args.codeSnippet
    ? `
ORIGINAL CODE:

${args.codeSnippet}
`
    : ""
}

========================================
GENERAL RULES
========================================

Create 4 to 6 scenes.

Every scene must teach ONE specific idea.

Every scene MUST contain a visual.

Allowed visual kinds:

- reasoning
- array
- pointers
- hashmap
- stack
- code
- complexity
- takeaway

Keep:

- titles under about 7 words
- explanation text under about 25 words
- animations understandable on a shared screen

Do NOT use vague filler.

Never use generic reasoning such as:

- Inspect
- Reason
- Decide
- Think about it
- Analyze the problem
- Look closer

Instead describe the ACTUAL reasoning.

========================================
REASONING SCENES
========================================

When visual.kind is "reasoning",
you MUST provide reasoningSteps.

reasoningSteps should contain 2 to 4 short,
problem-specific reasoning steps.

BAD:

{
  "reasoningSteps": [
    "Inspect",
    "Reason",
    "Decide"
  ]
}

GOOD DATA STRUCTURE EXAMPLE:

{
  "type": "reasoning",
  "title": "Why a hash map?",
  "text": "We need fast lookup while scanning once.",
  "visual": {
    "kind": "reasoning",
    "reasoningSteps": [
      "Need to remember values already seen",
      "Need fast complement lookup",
      "Hash map lookup is O(1) average",
      "One pass gives O(n)"
    ],
    "operation": "Choose Hash Map"
  }
}

GOOD STACK EXAMPLE:

{
  "type": "reasoning",
  "title": "Why a stack?",
  "text": "The newest opening bracket must close first.",
  "visual": {
    "kind": "reasoning",
    "reasoningSteps": [
      "Opening bracket arrives",
      "Push it onto the stack",
      "Closing bracket checks the top",
      "Last opened must close first"
    ],
    "operation": "LIFO matches the problem"
  }
}

GOOD HEAP EXAMPLE:

{
  "type": "reasoning",
  "title": "Why a heap?",
  "text": "We repeatedly need the smallest remaining value.",
  "visual": {
    "kind": "reasoning",
    "reasoningSteps": [
      "Need repeated minimum retrieval",
      "Scanning an array costs O(n)",
      "Heap removal costs O(log n)",
      "Use a min heap"
    ],
    "operation": "Efficient repeated minimum"
  }
}

========================================
ARRAY SCENES
========================================

Use actual values from the problem when possible.

Example:

{
  "type": "reasoning",
  "title": "Check the first value",
  "text": "We need 7 to reach the target.",
  "visual": {
    "kind": "array",
    "values": [
      "2",
      "7",
      "11",
      "15"
    ],
    "activeIndices": [
      0
    ],
    "operation": "9 - 2 = 7"
  }
}

========================================
POINTER SCENES
========================================

Example:

{
  "type": "reasoning",
  "title": "Move the pointers",
  "text": "The current sum is too large.",
  "visual": {
    "kind": "pointers",
    "values": [
      "1",
      "3",
      "5",
      "8"
    ],
    "activeIndices": [
      0,
      3
    ],
    "pointers": [
      {
        "label": "left",
        "index": 0
      },
      {
        "label": "right",
        "index": 3
      }
    ],
    "operation": "Compare 1 + 8"
  }
}

========================================
HASH MAP SCENES
========================================

Example:

{
  "type": "reasoning",
  "title": "Store the value",
  "text": "Remember values so complements can be found instantly.",
  "visual": {
    "kind": "hashmap",
    "entries": [
      {
        "key": "2",
        "value": "index 0",
        "active": true
      }
    ],
    "operation": "map[2] = 0"
  }
}

========================================
STACK SCENES
========================================

Example:

{
  "type": "reasoning",
  "title": "Push the bracket",
  "text": "Opening brackets wait for their matching close.",
  "visual": {
    "kind": "stack",
    "stack": [
      "(",
      "["
    ],
    "operation": "Push ["
  }
}

========================================
BUG HUNT
========================================

${
  isBugHunt
    ? `
THIS IS A BUG HUNT QUESTION.

For code scenes:

DO NOT guess line numbers.

Instead return highlightText containing the exact
source-code text that should be highlighted.

Example:

{
  "type": "code",
  "title": "Here's the bug",
  "text": "Negative input never reaches the base case.",
  "highlightText": "return n * factorial(n - 1)",
  "visual": {
    "kind": "code",
    "operation": "Recursion continues forever"
  }
}

Rules:

- use the ORIGINAL CODE
- do not rewrite the source
- highlightText should match a real source line
- ignore indentation when choosing highlightText
- at least TWO scenes should use visual.kind = "code"
- one code scene identifies the bug
- another explains the consequence or fix
`
    : `
For non-bug questions, use code scenes only when
showing actual code materially improves the explanation.
`
}

========================================
COMPLEXITY
========================================

For complexity scenes:

{
  "type": "complexity",
  "title": "Compare the runtime",
  "text": "One pass avoids nested searching.",
  "visual": {
    "kind": "complexity",
    "reasoningSteps": [
      "Nested search checks many pairs",
      "Hash lookup avoids inner scanning",
      "Each element is processed once"
    ],
    "operation": "O(n²) → O(n)"
  }
}

========================================
FINAL TAKEAWAY
========================================

The final scene MUST use:

{
  "kind": "takeaway"
}

Example:

{
  "type": "takeaway",
  "title": "Remember this",
  "text": "Match the structure to the operation you need.",
  "takeaway": "Fast lookup → think hash map",
  "visual": {
    "kind": "takeaway",
    "operation": "Fast lookup → Hash Map"
  }
}

========================================
OUTPUT
========================================

Return JSON only.

{
  "summary": "short overall explanation",

  "steps": [
    "step one",
    "step two"
  ],

  "scenes": [
    {
      "type": "reasoning",
      "title": "...",
      "text": "...",

      "highlightText": "...",

      "takeaway": "...",

      "visual": {
        "kind": "reasoning",

        "values": [],

        "activeIndices": [],

        "pointers": [],

        "entries": [],

        "stack": [],

        "operation": "...",

        "reasoningSteps": [
          "...",
          "...",
          "..."
        ]
      }
    }
  ]
}
`;

      /* ====================================
         OPENAI
      ==================================== */

      const completion =
        await openai
          .chat
          .completions
          .create({
            model:
              "gpt-4o-mini",

            messages: [
              {
                role:
                  "system",

                content:
                  `
You are a concise visual coding tutor.

Every explanation should visually demonstrate
the actual algorithmic reasoning.

Never use generic reasoning filler.

Return valid JSON only.
`,
              },

              {
                role:
                  "user",

                content:
                  prompt,
              },
            ],

            response_format: {
              type:
                "json_object",
            },

            temperature:
              0.45,

            max_tokens:
              1400,
          });

      const content =
        completion
          .choices[0]
          .message
          .content;

      if (!content) {
        throw new Error(
          "No explanation returned."
        );
      }

      let parsed:
        any;

      try {
        parsed =
          JSON.parse(
            content
          );
      } catch {
        throw new Error(
          "Explanation was not valid JSON."
        );
      }

      if (
        typeof parsed.summary !==
          "string" ||
        !Array.isArray(
          parsed.steps
        ) ||
        !Array.isArray(
          parsed.scenes
        )
      ) {
        throw new Error(
          "Invalid AI Coach explanation."
        );
      }

      /* ====================================
         NORMALIZE SCENES
      ==================================== */

      const scenes =
        parsed.scenes.map(
          (
            scene:
              any
          ) => {
            const visual =
              scene.visual &&
              typeof scene.visual ===
                "object"
                ? scene.visual
                : {
                    kind:
                      scene.type ===
                      "takeaway"
                        ? "takeaway"
                        : isBugHunt
                          ? "code"
                          : "reasoning",
                  };
                  /* =================================
   NORMALIZE HIGHLIGHT TEXT LOCATION
================================= */

let normalizedHighlightText:
  string | undefined;

if (
  typeof scene.highlightText ===
  "string"
) {
  normalizedHighlightText =
    scene.highlightText;
} else if (
  typeof visual.highlightText ===
  "string"
) {
  normalizedHighlightText =
    visual.highlightText;
}

/*
  Convex visual validator does not
  allow highlightText inside visual.
*/
if (
  "highlightText" in visual
) {
  delete visual.highlightText;
}
                  if (
  Array.isArray(
    visual.values
  )
) {
  visual.values =
    visual.values.map(
      (
        value: unknown
      ) =>
        String(
          value
        )
    );
}

            /* =================================
               REASONING FALLBACK
            ================================= */

            if (
              visual.kind ===
                "reasoning"
            ) {
              if (
                !Array.isArray(
                  visual.reasoningSteps
                ) ||
                visual.reasoningSteps
                  .length ===
                  0
              ) {
                visual.reasoningSteps =
                  [
                    typeof scene.text ===
                    "string"
                      ? scene.text
                      : "Evaluate the available approach.",

                    typeof visual.operation ===
                    "string"
                      ? visual.operation
                      : "Choose the best option.",
                  ];
              }

              visual.reasoningSteps =
                visual.reasoningSteps
                  .map(
                    (
                      step:
                        unknown
                    ) =>
                      String(
                        step
                      )
                  )
                  .filter(
                    (
                      step:
                        string
                    ) =>
                      step.trim()
                        .length >
                      0
                  )
                  .slice(
                    0,
                    4
                  );
            }

            /* =================================
               CODE
            ================================= */

            let sceneCode:
              string | undefined;

            if (
              isBugHunt &&
              visual.kind ===
                "code" &&
              args.codeSnippet
            ) {
              sceneCode =
                args.codeSnippet;
            } else if (
              typeof scene.code ===
              "string"
            ) {
              sceneCode =
                scene.code;
            }

            /* =================================
               HIGHLIGHT
            ================================= */

            let highlightLine:
              number | undefined;

            if (
  isBugHunt &&
  args.codeSnippet &&
  normalizedHighlightText
) {
  const codeLines =
    args.codeSnippet.split("\n");

  const wanted =
    normalizedHighlightText.trim();

              let matchIndex =
                codeLines.findIndex(
                  (
                    line
                  ) =>
                    line.trim() ===
                    wanted
                );

              if (
                matchIndex ===
                -1
              ) {
                matchIndex =
                  codeLines.findIndex(
                    (
                      line
                    ) => {
                      const cleaned =
                        line.trim();

                      if (!cleaned) {
                        return false;
                      }

                      return (
                        cleaned.includes(
                          wanted
                        ) ||
                        wanted.includes(
                          cleaned
                        )
                      );
                    }
                  );
              }

              if (
                matchIndex !==
                -1
              ) {
                highlightLine =
                  matchIndex +
                  1;
              }
            }

            if (
              !isBugHunt &&
              typeof scene.highlightLine ===
                "number"
            ) {
              highlightLine =
                scene.highlightLine;
            }

            if (
              sceneCode &&
              highlightLine !==
                undefined
            ) {
              const lineCount =
                sceneCode.split(
                  "\n"
                ).length;

              if (
                highlightLine <
                  1 ||
                highlightLine >
                  lineCount
              ) {
                highlightLine =
                  undefined;
              }
            }

            /* =================================
               RETURN SCENE
            ================================= */

            return {
              type:
                typeof scene.type ===
                "string"
                  ? scene.type
                  : "reasoning",

              title:
                typeof scene.title ===
                "string"
                  ? scene.title
                  : "Breaking it down",

              text:
                typeof scene.text ===
                "string"
                  ? scene.text
                  : "",

              code:
                sceneCode,

              highlightLine,

             highlightText:
  normalizedHighlightText,

              takeaway:
                typeof scene.takeaway ===
                "string"
                  ? scene.takeaway
                  : undefined,

              visual,
            };
          }
        );

      return {
        summary:
          parsed.summary,

        steps:
          parsed.steps.map(
            (
              step:
                unknown
            ) =>
              String(
                step
              )
          ),

        scenes,
      };
    },
  });