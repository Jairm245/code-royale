export const QUESTION_ROTATION = [
  "data_structure",
  "bug_hunt",
  "data_structure",
  "bug_hunt",
  "optimal_approach",
  "data_structure",
  "bug_hunt",
  "edge_case",
  "data_structure",
  "bug_hunt",
] as const;

export type QuestionType =
  (typeof QUESTION_ROTATION)[number];

export function getQuestionTypeForRound(
  round: number
): QuestionType {
  const safeRound =
    Math.max(
      1,
      round
    );

  const index =
    (safeRound - 1) %
    QUESTION_ROTATION.length;

  return QUESTION_ROTATION[
    index
  ];
}

/* ========================================
   TOPIC PLAN

   Each game gets a shuffled plan that assigns a
   different focus topic to every round, so one
   structure (heap!) can't win round after round.
   Every topic appears at most once per game; heap
   is just one card in the deck.
======================================== */

const TOPICS_BY_TYPE: Record<QuestionType, string[]> = {
  data_structure: [
    "hash map (counting / lookup by key)",
    "hash set (membership / duplicates)",
    "stack (LIFO: undo, matching brackets, monotonic stack)",
    "queue (FIFO: BFS, task scheduling)",
    "deque (both ends: sliding window maximum)",
    "linked list (O(1) insert/delete at a known node, LRU cache)",
    "binary search tree (ordered data, floor/ceiling, range queries)",
    "trie (prefix search, autocomplete)",
    "graph adjacency list (relationships, networks)",
    "union-find (connectivity, grouping, cycle detection)",
    "heap / priority queue (repeated min/max, top-k)",
    "array / dynamic array (index access, contiguous memory)",
  ],
  optimal_approach: [
    "two pointers on a sorted array",
    "sliding window over a string or array",
    "binary search on a sorted array or on the answer",
    "hash map lookup instead of nested loops",
    "BFS for shortest path in an unweighted graph or grid",
    "DFS / backtracking",
    "dynamic programming (overlapping subproblems)",
    "prefix sums for range queries",
    "sorting + greedy",
    "interval merging",
    "monotonic stack",
    "topological sort",
  ],
  bug_hunt: [
    "off-by-one in a loop boundary over an array",
    "binary search pointer update (left/right/mid)",
    "two-pointer movement on a string (palindrome / reverse)",
    "missing recursion base case",
    "dictionary / hash map lookup or update bug",
    "linked list pointer rewiring",
    "stack push/pop logic (e.g. bracket matching)",
    "BFS/DFS visited-set handling",
    "sliding window shrink condition",
    "mutable default argument or aliasing a list",
    "wrong comparison operator in a condition",
    "accumulator / running total updated in the wrong place",
  ],
  edge_case: [
    "empty input",
    "single-element input",
    "all duplicate values",
    "negative numbers / zero",
    "target not present",
    "disconnected graph",
    "integer overflow / very large values",
    "already sorted or reverse-sorted input",
  ],
};

/* mulberry32: small, well-mixed PRNG (different seeds → different orders) */
function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

/*
  Returns topics indexed by round (index 0 = round 1).
  Same seed → same plan, so prefetch and the live
  round agree on the topic.
*/
export function buildTopicPlan(seed: number) {
  const random = seededRandom(seed);
  const decks = Object.fromEntries(
    Object.entries(TOPICS_BY_TYPE).map(([type, topics]) => [type, shuffle(topics, random)])
  ) as Record<QuestionType, string[]>;
  const used: Record<QuestionType, number> = {
    data_structure: 0,
    optimal_approach: 0,
    bug_hunt: 0,
    edge_case: 0,
  };

  return QUESTION_ROTATION.map((type) => {
    const deck = decks[type];
    const topic = deck[used[type] % deck.length];
    used[type] += 1;
    return topic;
  });
}

export function getTopicForRound(plan: string[], round: number) {
  return plan[(Math.max(1, round) - 1) % plan.length];
}
