"use node";

import {
  action,
} from "./_generated/server";

import {
  v,
} from "convex/values";

import OpenAI from "openai";

/* ========================================
   QUESTION TYPES
======================================== */

const VALID_TYPES = [
  "data_structure",
  "optimal_approach",
  "bug_hunt",
  "complexity",
  "edge_case",
] as const;

type QuestionType =
  (typeof VALID_TYPES)[number];

/* ========================================
   CATEGORY-SPECIFIC INSTRUCTIONS
======================================== */

function getTypeInstructions(
  type: QuestionType
) {
  switch (type) {
    /* ====================================
       DATA STRUCTURES
    ==================================== */

    case "data_structure":
      return `
DATA STRUCTURE QUESTION.

The player should reason about which data structure
best fits a coding interview problem.

Good topics include:

- hash maps
- hash sets
- stacks
- queues
- heaps
- linked lists
- binary trees
- graphs

Good question styles:

- Which data structure should be used?
- Which data structure provides the desired operation efficiently?
- Which structure best fits this real coding scenario?
- Why would one structure be preferable to another?

Examples:

- efficiently tracking frequencies
- implementing undo
- BFS traversal
- detecting duplicates
- mapping values to indexes

IMPORTANT:

Do NOT turn this into a bug spotting question.

The question should primarily test data structure reasoning.
`;

    /* ====================================
       OPTIMAL APPROACH
    ==================================== */

    case "optimal_approach":
      return `
OPTIMAL APPROACH QUESTION.

Give the player a realistic coding interview problem
and ask which algorithmic approach is best.

Good techniques include:

- two pointers
- sliding window
- binary search
- hash maps
- sorting
- heaps
- BFS
- DFS
- dynamic programming

The incorrect answers should be believable approaches
that are either slower or fail for an important reason.

Example:

Given an array and a target sum, which approach finds
a valid pair in O(n)?

Good answer choices might include:

- nested loops
- sorting plus two pointers
- hash map lookup
- generating every subset

IMPORTANT:

Do NOT make this a bug spotting question.
`;

    /* ====================================
       BUG HUNT
    ==================================== */

    case "bug_hunt":
      return `
BUG HUNT QUESTION.

Provide a SHORT code snippet containing ONE
meaningful bug.

The bug should test programming reasoning.

Good bugs include:

- off-by-one errors
- wrong loop boundary
- incorrect pointer movement
- missing recursion base case
- incorrect dictionary lookup
- wrong comparison
- accidental mutation
- incorrect variable update
- invalid edge-case handling

Avoid:

- syntax errors
- missing semicolons
- indentation trivia
- extremely obscure language behavior

Keep the code around 4 to 10 lines.

Ask the player what is wrong with the code.

There must be exactly ONE best answer.
`;

    /* ====================================
       COMPLEXITY
    ==================================== */

    case "complexity":
      return `
TIME OR SPACE COMPLEXITY QUESTION.

Give the player a realistic algorithm or short
piece of code and ask about:

- time complexity
- space complexity
- or an optimization affecting complexity

Good examples:

- nested loops
- binary search
- hash map traversal
- heap operations
- sorting
- recursive algorithms
- BFS / DFS
- sliding window
- repeated list operations

The question should require reasoning about how
the algorithm grows with input size.

IMPORTANT:

Do NOT turn this into a bug spotting question.
`;

    /* ====================================
       EDGE CASE
    ==================================== */

    case "edge_case":
      return `
EDGE CASE QUESTION.

Give a coding problem or short algorithm and ask
which input reveals an important edge case.

Good edge cases include:

- empty arrays
- one-element arrays
- duplicate values
- negative numbers
- target not found
- repeated characters
- disconnected graphs
- sorted input
- all values being identical
- integer boundaries

The player should reason about what the algorithm does
with unusual input.

Good question style:

"Which input causes this implementation to fail?"

or:

"Which case must be handled separately?"

IMPORTANT:

Do NOT simply ask the player to identify a code bug.

The focus should be understanding edge-case behavior.
`;
  }
}

/* ========================================
   GENERATE QUESTION
======================================== */

/* ========================================
   DUPLICATE DETECTION
======================================== */

function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function similarity(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let shared = 0;

  for (const word of left) {
    if (right.has(word)) {
      shared += 1;
    }
  }

  return shared / Math.min(left.size, right.size);
}

function normalizeAnswer(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findDuplicate(
  parsed: any,
  previousQuestions: string[],
  previousAnswers: string[],
  type: string
) {
  if (
    typeof parsed?.question !== "string" ||
    !Array.isArray(parsed?.choices)
  ) {
    return undefined;
  }

  const repeated = previousQuestions.find(
    (question) => similarity(parsed.question, question) >= 0.7
  );

  if (repeated) {
    return `too similar to an earlier question ("${repeated.slice(0, 80)}")`;
  }

  /* bug hunts can legitimately share answers like "off-by-one" */
  if (type === "data_structure" || type === "optimal_approach") {
    const answer = String(parsed.choices[parsed.correctAnswer] ?? "");
    const reused = previousAnswers.find(
      (previous) => normalizeAnswer(previous) === normalizeAnswer(answer)
    );

    if (reused) {
      return `the correct answer "${answer}" was already used this game`;
    }
  }

  return undefined;
}

export const generateQuestion =
  action({
    args: {
      difficulty:
        v.optional(
          v.string()
        ),

      /*
        Code Royale chooses this.

        The AI is NOT allowed to choose
        the question category itself.
      */
      requestedType:
        v.optional(
          v.string()
        ),

      previousQuestions:
        v.optional(
          v.array(
            v.string()
          )
        ),

      /*
        Correct answers already used this game,
        e.g. "Min-heap". A new question must not
        have the same correct answer.
      */
      previousAnswers:
        v.optional(
          v.array(
            v.string()
          )
        ),

      /*
        The round's focus topic from the game's
        shuffled topic plan (see questionRotation).
      */
      requestedTopic:
        v.optional(
          v.string()
        ),
    },

    handler: async (
      _ctx,
      args
    ) => {
      /* ====================================
         OPENAI
      ==================================== */

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

      /* ====================================
         DIFFICULTY
      ==================================== */

      const difficulty =
        args.difficulty ??
        "medium-hard";

      /* ====================================
         QUESTION TYPE

         Do not let OpenAI choose this.
      ==================================== */

      const requestedType =
        VALID_TYPES.includes(
          args.requestedType as QuestionType
        )
          ? (args.requestedType as QuestionType)
          : "data_structure";

      /* ====================================
         PREVIOUS QUESTIONS
      ==================================== */

      const previousQuestions =
        args.previousQuestions ??
        [];

      const previousAnswers =
        args.previousAnswers ??
        [];

      const previousText =
        previousQuestions.length >
          0 ||
        previousAnswers.length >
          0
          ? `
========================================
ALREADY USED THIS GAME — DO NOT REPEAT
========================================
${previousQuestions
  .slice(-12)
  .map(
    (
      question,
      index
    ) =>
      `Q${index + 1}. ${question}`
  )
  .join("\n")}

Correct answers already used (your correct answer must be DIFFERENT from all of these):
${previousAnswers
  .slice(-12)
  .map(
    (answer) =>
      `- ${answer}`
  )
  .join("\n") || "- none"}

Do not reuse the same problem, scenario, code, or answer.
`
          : "";

      const topicText =
        args.requestedTopic
          ? `
========================================
REQUIRED FOCUS TOPIC FOR THIS ROUND
========================================
${args.requestedTopic}

The question MUST be about this topic. For data structure
and optimal approach questions, the CORRECT answer is this
structure/technique. For bug hunt and edge case questions,
the code/problem is built around this topic.
`
          : "";

      /* ====================================
         PROMPT
      ==================================== */

      const prompt = `
You generate coding interview questions for a multiplayer
game called Code Royale.

Code Royale is similar to a party trivia game, but the
questions test software engineering interview skills.

Players only have around 20 seconds to answer.

========================================
REQUIRED QUESTION CATEGORY
========================================

${requestedType}

YOU MUST GENERATE A "${requestedType}" QUESTION.

Do not switch categories.

Do not decide that another category would be better.

${getTypeInstructions(
  requestedType
)}

${topicText}

========================================
DIFFICULTY
========================================

${difficulty}

Target roughly easy-medium to medium interview difficulty.

The question should require actual reasoning but still
be answerable in approximately 15 to 25 seconds.

Avoid extremely trivial definition questions.

For example, avoid questions like:

"What does a stack do?"

Prefer questions that describe a concrete scenario and
make the player choose between believable options.

========================================
TOPICS
========================================

Use a varied mix of topics such as:

- arrays
- strings
- hash maps
- hash sets
- stacks
- queues
- linked lists
- binary trees
- graphs
- heaps
- binary search
- two pointers
- sliding window
- intervals
- recursion
- basic dynamic programming

Do not repeatedly generate the same algorithm.

========================================
ANSWER CHOICES
========================================

Return EXACTLY four answer choices.

Exactly ONE answer must be correct.

At least TWO incorrect answers should be believable.

Bad distractor example:

A. Hash Map
B. Stack
C. A banana
D. None because computers cannot solve this

Good distractors should be approaches a student might
reasonably consider.

========================================
CODE
========================================

If code helps the question:

- Keep it between 3 and 12 lines.
- ALWAYS format code across multiple lines.
- NEVER return an entire algorithm on one line.
- Include real newline characters between statements.
- Use normal indentation.
- Prefer Python-style interview code.
- Keep individual lines short enough for a shared screen.
- Do not use compressed or minified code.

BAD:

"for i in range(n): for j in range(n): print(arr[i], arr[j])"

GOOD:

"for i in range(n):
    for j in range(n):
        print(arr[i], arr[j])"

If code is not needed:

"code": null

========================================
IMPORTANT
========================================

correctAnswer must be the ZERO-BASED index.

Example:

If answer C is correct:

"correctAnswer": 2

The returned question type is controlled by Code Royale,
so DO NOT include your own question type.

${previousText}

========================================
RETURN FORMAT
========================================

Return JSON only.

{
  "question": "question text",

  "code": null,

  "choices": [
    "choice A",
    "choice B",
    "choice C",
    "choice D"
  ],

  "correctAnswer": 0
}
`;

      /* ====================================
         OPENAI REQUEST
      ==================================== */

      /*
        Up to two attempts: if the first question
        duplicates an earlier one (or reuses an earlier
        correct answer), ask again with the reason.
      */
      let parsed: any;
      let retryNote = "";

      for (
        let attempt = 0;
        attempt < 2;
        attempt += 1
      ) {
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
You create concise, challenging coding interview
questions for a multiplayer game.

Follow the requested category exactly.

Return valid JSON only.
`,
              },

              {
                role:
                  "user",

                content:
                  prompt +
                  retryNote,
              },
            ],

            response_format: {
              type:
                "json_object",
            },

            /*
              Slightly higher temperature keeps
              different rounds from feeling identical.
            */
            temperature:
              0.8,

            max_tokens:
              800,
          });

      /* ====================================
         PARSE RESPONSE
      ==================================== */

      const content =
        completion
          .choices[0]
          .message
          .content;

      if (!content) {
        throw new Error(
          "AI did not return a question."
        );
      }


      try {
        parsed =
          JSON.parse(
            content
          );
      } catch {
        throw new Error(
          "AI returned invalid JSON."
        );
      }

      /* ====================================
         VALIDATION
      ==================================== */

      if (
        typeof parsed.question !==
        "string"
      ) {
        throw new Error(
          "AI question is missing."
        );
      }

      if (
        !Array.isArray(
          parsed.choices
        )
      ) {
        throw new Error(
          "AI choices are missing."
        );
      }

      if (
        parsed.choices.length !==
        4
      ) {
        throw new Error(
          "AI must return exactly four choices."
        );
      }

      if (
        typeof parsed.correctAnswer !==
        "number"
      ) {
        throw new Error(
          "AI correctAnswer is invalid."
        );
      }

      if (
        parsed.correctAnswer <
          0 ||
        parsed.correctAnswer >
          3
      ) {
        throw new Error(
          "correctAnswer must be between 0 and 3."
        );
      }


        const duplicateReason =
          findDuplicate(
            parsed,
            previousQuestions,
            previousAnswers,
            requestedType
          );

        if (
          !duplicateReason ||
          attempt === 1
        ) {
          break;
        }

        retryNote = `

YOUR PREVIOUS ATTEMPT WAS REJECTED: ${duplicateReason}
Write a completely different question.
`;
      }

      /* ====================================
         NORMALIZE CHOICES
      ==================================== */

      const choices =
        parsed.choices.map(
          (
            choice:
              unknown
          ) =>
            String(
              choice
            )
        );

      /* ====================================
         CODE
      ==================================== */

      let code =
  typeof parsed.code === "string" &&
  parsed.code.trim().length > 0
    ? parsed.code.trim()
    : null;

/*
  Protect the UI from accidentally
  escaped newline characters.
*/
if (code) {
  code = code.replace(/\\n/g, "\n");
}

      /* ====================================
         RETURN

         IMPORTANT:

         We return requestedType,
         NOT anything chosen by AI.
      ==================================== */

      return {
        type:
          requestedType,

        question:
          parsed.question,

        code,

        choices,

        correctAnswer:
          parsed.correctAnswer,
      };
    },
  });