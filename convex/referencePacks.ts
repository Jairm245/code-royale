/*
  Code Royale Reference Packs

  A reference pack teaches the Coach and the Animation Director two
  separate things about one concept:

    1. STRUCTURE — what the data structure must look like before
       anything happens (a heap is a COMPLETE binary tree whose array
       form is level order, never an arbitrary tree).

    2. OPERATION — how one specific operation moves (insert = append at
       the next free slot, then compare/swap upward until the parent
       order holds).

  Each pack also carries highlight rules, must-show rules, never-show
  rules and a worked example with the exact visual + events we expect.

  The pack TEXT lives in ./referencePackLibrary.ts. The parts that can be
  checked in code are enforced by ./structureEngines.ts, so a model
  mistake cannot reach the screen.

  No Convex imports: both Convex actions (and the renderer) import this.
*/

import { PACKS } from "./referencePackLibrary";

/* ========================================
   TYPES
======================================== */

export type ConceptId =
  | "min_heap"
  | "max_heap"
  | "sliding_window"
  | "two_pointers"
  | "binary_search"
  | "bfs"
  | "tree_dfs"
  | "stack"
  | "hash_map"
  | "prefix_sum"
  | "linked_list"
  | "queue"
  | "deque"
  | "bst"
  | "trie"
  | "graph_representation"
  | "graph_traversal"
  | "topological_sort"
  | "shortest_path"
  | "union_find"
  | "segment_tree"
  | "fenwick_tree";

export type ReferenceSource = {
  name: string;
  url: string;
  use: string;
};

export type OperationReference = {
  name: string;
  steps: string[];
};

export type ReferencePack = {
  id: ConceptId;
  name: string;

  /* default visual.kind for the walkthrough */
  visualKind: string;

  /* every kind this concept may use (e.g. heap: tree view OR array view) */
  visualKinds?: string[];

  /* exact data contract for the Coach's visual JSON */
  visualContract?: string[];

  sources: ReferenceSource[];

  structure: string[];
  representation: string[];
  coreProperty: string[];
  operations: OperationReference[];

  highlightRules: string[];
  mustShow: string[];
  neverShow: string[];

  /*
    Director actions this concept may use (in addition to the
    universal ones). Anything else is dropped by the sanitizer.
  */
  directorActions: string[];

  /*
    When true, every scene after the structure first appears keeps it
    on screen (takeaway / complexity become labels on top of it).
  */
  holdStructureToEnd: boolean;

  example: {
    input: string;
    sceneVisual: Record<string, unknown>;
    expectedBeats: Array<Record<string, unknown>>;
  };
};

export function getReferencePack(
  id: ConceptId | "unknown"
): ReferencePack | undefined {
  return id === "unknown" ? undefined : PACKS[id];
}

export function isHeapConcept(
  id: ConceptId | "unknown"
): id is "min_heap" | "max_heap" {
  return id === "min_heap" || id === "max_heap";
}

/* ========================================
   CONCEPT DETECTION
   Order matters: the most specific signal wins
   ("binary search tree" before "binary search",
   "priority queue" before "queue").
======================================== */

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function hasWord(text: string, word: string) {
  return new RegExp(`\\b${word}\\b`).test(text);
}

function detectHeapOrder(text: string): "min_heap" | "max_heap" {
  if (
    includesAny(text, [
      "max heap",
      "max-heap",
      "maxheap",
      "_heapify_max",
      "collections.reverseorder",
      "reverseorder()",
      "(a, b) -> b - a",
      "(a,b)->b-a",
      "kth smallest",
      "k-th smallest",
      "heap sort",
      "heapsort",
    ])
  ) {
    return "max_heap";
  }

  return "min_heap";
}

/*
  The CORRECT ANSWER decides first. "Which structure does iterative DFS on a
  tree use?" mentions tree + DFS, but the answer is "Stack", so the stack pack
  must win. Only when the answer names no concept do we read the whole
  question + code.
*/
export function detectConcept(
  question: string,
  correctChoice: string,
  codeSnippet: string
): ConceptId | "unknown" {
  const fromAnswer = detectConceptInText(correctChoice.toLowerCase());

  if (fromAnswer !== "unknown") {
    return fromAnswer;
  }

  /* "a set of seen values", "Set", "use a set" → hash set (answer only; "set i = 0" in code is not a set) */
  if (/\b(hash\s*)?sets?\b|\bset\(\)/i.test(correctChoice)) {
    return "hash_map";
  }

  return detectConceptInText(`${question}\n${correctChoice}\n${codeSnippet}`.toLowerCase());
}

function detectConceptInText(text: string): ConceptId | "unknown" {

  if (includesAny(text, ["sliding window", "window size", "window of size"])) {
    return "sliding_window";
  }

  if (includesAny(text, ["heap", "priority queue", "priorityqueue", "priority_queue", "heapq", "heappush", "heappop"])) {
    return detectHeapOrder(text);
  }

  if (includesAny(text, ["union find", "union-find", "unionfind", "disjoint set", "disjoint-set"]) || hasWord(text, "dsu")) {
    return "union_find";
  }

  if (includesAny(text, ["segment tree", "segtree", "range minimum query", "range sum query - mutable"])) {
    return "segment_tree";
  }

  if (includesAny(text, ["fenwick", "binary indexed tree", "binary-indexed tree"])) {
    return "fenwick_tree";
  }

  if (includesAny(text, ["trie", "prefix tree", "startswith", "starts_with", "autocomplete"])) {
    return "trie";
  }

  if (includesAny(text, ["topological", "topo sort", "toposort", "course schedule", "prerequisite", "kahn"])) {
    return "topological_sort";
  }

  if (includesAny(text, ["dijkstra", "shortest path", "network delay", "cheapest"])) {
    return "shortest_path";
  }

  if (includesAny(text, ["adjacency list", "adjacency matrix", "edge list", "adjacency lists", "graph representation", "represent a graph", "represent the graph", "store a graph", "store the graph", "sparse graph", "dense graph"])) {
    return "graph_representation";
  }

  if (includesAny(text, ["binary search tree", "avl", "red-black", "red black"]) || hasWord(text, "bst")) {
    return "bst";
  }

  if (includesAny(text, ["linked list", "linkedlist", "listnode", "list node", "doubly linked", "singly linked"])) {
    return "linked_list";
  }

  if (
    includesAny(text, ["graph", "adjacency", "vertices", "vertex", "connected component", "number of provinces"]) &&
    includesAny(text, ["bfs", "dfs", "breadth", "depth", "travers", "connected", "reachable", "visit", "path", "component"])
  ) {
    return "graph_traversal";
  }

  if (
    includesAny(text, ["two pointers", "two-pointers"]) ||
    (text.includes("left") && text.includes("right") && includesAny(text, ["pair", "sorted", "container"]))
  ) {
    return "two_pointers";
  }

  if (includesAny(text, ["level order", "breadth-first", "breadth first"]) || hasWord(text, "bfs")) {
    return "bfs";
  }

  if (
    includesAny(text, ["preorder", "inorder", "postorder", "depth-first", "depth first"]) ||
    (hasWord(text, "dfs") && includesAny(text, ["tree", "node"]))
  ) {
    return "tree_dfs";
  }

  if (text.includes("binary search")) {
    return "binary_search";
  }

  if (includesAny(text, ["hash map", "hashmap", "hash set", "hashset", "hash table", "hashtable", "dictionary"])) {
    return "hash_map";
  }

  if (includesAny(text, ["deque", "double-ended", "double ended", "monotonic queue", "appendleft", "popleft"])) {
    return "deque";
  }

  if (text.includes("queue") || includesAny(text, ["enqueue", "dequeue", "fifo"])) {
    return "queue";
  }

  if (text.includes("stack") || hasWord(text, "lifo")) {
    return "stack";
  }

  if (text.includes("prefix sum")) {
    return "prefix_sum";
  }

  return "unknown";
}

/* ========================================
   KIND SELECTION
   Which visual.kind a concept should use for
   this particular question.
======================================== */

const ARRAY_HEAP_SIGNALS = [
  "array",
  "index",
  "indices",
  "2i",
  "2 * i",
  "2*i",
  "parent(i)",
  "(i - 1) // 2",
  "(i-1)//2",
  "(i - 1) / 2",
  "heapify",
  "build heap",
  "build-heap",
  "heap sort",
  "heapsort",
  "sift",
];

export function prefersArrayHeap(text: string) {
  return includesAny(text.toLowerCase(), ARRAY_HEAP_SIGNALS);
}

export function chooseVisualKind(
  concept: ConceptId | "unknown",
  questionText: string,
  coachKind: string | undefined
) {
  const pack = getReferencePack(concept);

  if (!pack) {
    return coachKind;
  }

  const allowed = pack.visualKinds ?? [pack.visualKind];
  const text = questionText.toLowerCase();

  if (isHeapConcept(concept)) {
    const arrayKind = `${concept}_array`;

    /* index arithmetic / heapify / heap sort questions are about the ARRAY */
    if (prefersArrayHeap(text) || coachKind === arrayKind) {
      return arrayKind;
    }

    return concept;
  }

  if (concept === "segment_tree") {
    if (includesAny(text, ["minimum", "range min", " min("])) return "segment_tree_min";
    if (includesAny(text, ["maximum", "range max", " max("])) return "segment_tree_max";
    return "segment_tree_sum";
  }

  if (concept === "linked_list") {
    return text.includes("doubly") || text.includes(".prev") ? "doubly_linked_list" : "linked_list";
  }

  if (concept === "topological_sort") {
    return "digraph";
  }

  if (concept === "hash_map") {
    if (coachKind === "hash_set" || coachKind === "hash_map") return coachKind;
    const setLike =
      includesAny(text, ["hash set", "hashset", "set()", "duplicate", "seen", "contains", "unique", "membership"]) &&
      !includesAny(text, ["count", "frequenc", "index of", "indices", "two sum", "target"]);
    return setLike ? "hash_set" : "hash_map";
  }

  if (concept === "graph_traversal" || concept === "shortest_path" || concept === "graph_representation") {
    if (coachKind === "graph" || coachKind === "digraph") return coachKind;
    return includesAny(text, ["directed", "one-way", "->", "→"]) && !text.includes("undirected") ? "digraph" : "graph";
  }

  return coachKind && allowed.includes(coachKind) ? coachKind : pack.visualKind;
}

/* ========================================
   PROMPT RENDERING
======================================== */

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderCore(pack: ReferencePack) {
  return `
REFERENCE PACK — ${pack.name.toUpperCase()}
(Distilled from reference animations. These rules override general habits.)

STRUCTURE (what it must look like before anything happens):
${bulletList(pack.structure)}

VISUAL REPRESENTATION:
${bulletList(pack.representation)}

CORE PROPERTY:
${bulletList(pack.coreProperty)}

OPERATIONS:
${pack.operations
  .map(
    (operation) =>
      `${operation.name.toUpperCase()}:\n${operation.steps
        .map((step, index) => `  ${index + 1}. ${step}`)
        .join("\n")}`
  )
  .join("\n")}

HIGHLIGHT RULES:
${bulletList(pack.highlightRules)}

MUST SHOW (cannot disappear until the concept is understood):
${bulletList(pack.mustShow)}

NEVER SHOW (common wrong interpretations):
${bulletList(pack.neverShow)}
`;
}

export function renderPackForCoach(pack: ReferencePack) {
  const kinds = pack.visualKinds ?? [pack.visualKind];

  const contract = pack.visualContract?.length
    ? `
VISUAL CONTRACT — REQUIRED:
- visual.kind: ${kinds.map((kind) => `"${kind}"`).join(" or ")} for every walkthrough scene.
${bulletList(pack.visualContract)}
- The engine animates the operation itself from visual.operation. Do NOT pre-apply the operation to the data.
- The next scene's data should be the state AFTER the previous scene's operation.
- Complexity/takeaway text goes in a later scene's operation as a label (it will not be treated as an operation).
`
    : "";

  return `
${renderCore(pack)}
${contract}
EXAMPLE (input: ${pack.example.input}):
visual = ${JSON.stringify(pack.example.sceneVisual)}
`;
}

export function renderPackForDirector(pack: ReferencePack) {
  return `
${renderCore(pack)}

ALLOWED ACTIONS FOR THIS CONCEPT:
${pack.directorActions.join(", ")}
(plus highlight_code on code scenes). Any other action is discarded.

EXPECTED EVENTS FOR THE EXAMPLE (input: ${pack.example.input}):
scene visual = ${JSON.stringify(pack.example.sceneVisual)}
beats (in order; cue/at omitted) = ${JSON.stringify(pack.example.expectedBeats)}
`;
}

/* ========================================
   POINTER RULES
   (sliding window / two pointers)
======================================== */

export type PointerState = Record<string, number>;

/*
  Returns true when moving `label` to `toIndex`
  respects the concept's core property.
*/
export function isLegalPointerMove(
  concept: ConceptId | "unknown",
  state: PointerState,
  label: string,
  toIndex: number
) {
  const current = state[label];

  if (concept === "sliding_window") {
    if (label !== "left" && label !== "right") {
      return false;
    }

    /* never backward */
    if (current !== undefined && toIndex < current) {
      return false;
    }

    const left = label === "left" ? toIndex : state.left ?? 0;
    const right = label === "right" ? toIndex : state.right ?? left;

    return left <= right + 1;
  }

  if (concept === "two_pointers") {
    if (label !== "left" && label !== "right") {
      return false;
    }

    if (current !== undefined) {
      if (label === "left" && toIndex < current) {
        return false;
      }

      if (label === "right" && toIndex > current) {
        return false;
      }
    }

    const left = label === "left" ? toIndex : state.left ?? 0;
    const right = label === "right" ? toIndex : state.right ?? toIndex;

    return left <= right;
  }

  return true;
}
