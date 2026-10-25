/*
  Code Royale Reference Pack Library

  The rules each pack teaches the Coach and the Director. Sources:
    - VisuAlgo e-lectures (print versions): list, heap, bst, ufds,
      fenwicktree, segmenttree, graphds, dfsbfs, hashtable
    - Princeton COS 226 "Tries" lecture
    - Interview templates for Kahn's algorithm / 0-based heapq
  See references/README.md for links and the recording checklist.

  Rules that can be checked in code are ALSO enforced in
  convex/structureEngines.ts; the text here is what the model reads.
*/

import type {
  ConceptId,
  ReferencePack,
  ReferenceSource,
} from "./referencePacks";

/* ========================================
   SOURCES
======================================== */

const VISUALGO = (
  path: string,
  use: string
): ReferenceSource => ({
  name: "VisuAlgo",
  url: `https://visualgo.net/en/${path}`,
  use,
});

const ALG0: ReferenceSource = {
  name: "alg0.dev",
  url: "https://alg0.dev",
  use:
    "Animation synchronized with code + variables; reference for when a line highlight should land.",
};

const PRINCETON_TRIES: ReferenceSource = {
  name: "Princeton COS 226 — Tries",
  url: "https://www.cs.princeton.edu/courses/archive/fall21/cos226/lectures/52Tries.pdf",
  use: "R-way trie search hit/miss rules, insert, prefix matching, longest prefix.",
};

const KAHN_TEMPLATE: ReferenceSource = {
  name: "LeetCode topological sort templates",
  url: "https://leetcode.com/discuss/post/6125954/patterntemplate-topological-sorting-patt-6vwh",
  use: "Kahn's in-degree queue and the 3-state DFS variant, as interviewers expect them.",
};

const HACKEREARTH_SEGTREE: ReferenceSource = {
  name: "HackerEarth — Segment tree and lazy propagation",
  url: "https://www.hackerearth.com/practice/notes/segment-tree-and-lazy-propagation/",
  use: "Build / query (outside, inside, partial) / point update / lazy range update.",
};

const ALGORITHM_VISUALIZER: ReferenceSource = {
  name: "Algorithm Visualizer",
  url: "https://algorithm-visualizer.org",
  use:
    "Tracer-driven visuals; reference for mapping algorithm events to visual events.",
};

/* ========================================
   PACKS
======================================== */

function heapPack(
  order: "min" | "max"
): ReferencePack {
  const isMin = order === "min";
  const cmp = isMin ? "<=" : ">=";
  const top = isMin ? "smallest" : "largest";
  const kind = isMin ? "min_heap" : "max_heap";

  return {
    id: kind,
    name: isMin
      ? "Min Heap / Priority Queue"
      : "Max Heap / Priority Queue",
    visualKind: kind,
    visualKinds: [kind, `${kind}_array`],

    visualContract: [
      `"${kind}" = TREE VIEW (complete tree with the array underneath). Default for priority-queue / top-k / merge-k questions.`,
      `"${kind}_array" = ARRAY VIEW (one row, parent/child arcs). Use when the question is about index arithmetic, heapify / build-heap, heap sort, or how a heap is stored.`,
      "visual.values = the heap ARRAY at the START of the scene, level order, 0-based, no \"null\", at most 12 values.",
      "visual.values must already satisfy the heap property — EXCEPT a heapify/build scene, which starts from the unordered input array.",
      `visual.operation starts with the verb: "Insert 1", "Pop ${isMin ? "min" : "max"}", or "Heapify". At most two operations per scene.`,
    ],

    sources: [
      VISUALGO(
        "heap",
        "Record with your own input. Toggle Visualization Mode to capture BOTH the tree and the compact-array view. Note: VisuAlgo is 1-based (parent = i>>1); Code Royale is 0-based like heapq."
      ),
      ALG0,
    ],

    structure: [
      "COMPLETE binary tree: every level is full except possibly the last, which fills strictly left to right.",
      "No gaps, no null holes, no node with a right child but no left child.",
      "The tree IS the array: index 0 is the root, then level by level, left to right.",
      "0-based indexing (Python heapq, Java PriorityQueue): parent(i) = (i-1)//2, left(i) = 2i+1, right(i) = 2i+2.",
    ],

    representation: [
      "TREE VIEW: nodes level by level with parent-child edges; the array sits directly underneath with index labels 0..n-1.",
      "TREE VIEW: the next free slot (index n) is a faint dashed ghost — that is where an insert lands.",
      "ARRAY VIEW: one row of cells with index labels; under the row, brackets group the levels ([0] | [1..2] | [3..6] | [7..14]).",
      "ARRAY VIEW: arcs connect the node in focus to its parent and children; a live formula shows the arithmetic, e.g. i = 5 → parent (5-1)//2 = 2.",
      "Both views: a swap makes the two values trade places along the edge/arc — nothing else moves.",
    ],

    coreProperty: [
      `parent ${cmp} children, at every node. Duplicates are allowed.`,
      `The root (index 0) is always the ${top} value.`,
      "Siblings have NO ordering between them. A heap is not sorted and not a BST.",
      "Height is O(log n), so insert and pop are O(log n); peek is O(1).",
      "Not stable: equal keys do not come out in insertion order.",
    ],

    operations: [
      {
        name: "insert / push",
        steps: [
          "Place the new value at index n, the next free slot (keeps the tree complete).",
          "Highlight the inserted node.",
          "Compare it with its parent (i-1)//2.",
          `If it breaks parent ${cmp} child, swap them.`,
          "Repeat upward until the property holds or it reaches the root (sift-up).",
          "Settle: the node turns success color; property restored.",
        ],
      },
      {
        name: `pop / extract-${order}`,
        steps: [
          "Remove the root and report it (that is the answer of the pop).",
          "Move the LAST element (index n-1) to the root.",
          `Compare it with its ${isMin ? "smaller" : "larger"} child — always that child, so the new parent beats both children.`,
          "Swap while it breaks the property (sift-down).",
          "Settle when both children satisfy the property or it is a leaf.",
        ],
      },
      {
        name: "heapify / build-heap (Floyd, O(n))",
        steps: [
          "Start from the unordered array; leaves are already heaps.",
          "Sift down every internal node, from the LAST internal node n//2 - 1 back to the root.",
          "Total cost is O(n), not O(n log n): most nodes are near the bottom and sift only a little.",
        ],
      },
      {
        name: "heap sort (explain, do not animate every step)",
        steps: [
          "Build a max-heap in O(n).",
          "Repeatedly swap the root with the last unsorted element and sift down within the shrunk heap.",
          "O(n log n), in place, not stable.",
        ],
      },
    ],

    highlightRules: [
      "The node being sifted stays highlighted wherever it moves.",
      "During a compare, highlight exactly the parent and the child and the edge/arc between them.",
      "Tree view: the same index is highlighted in the tree and the array at the same time.",
    ],

    mustShow: [
      "The structure stays visible for the entire walkthrough, including the complexity/takeaway ending.",
      "The parent-order invariant label stays visible.",
      "Every swap is between a parent and its child — nothing else moves.",
      "Array view: index labels and the parent/child formula stay visible.",
    ],

    neverShow: [
      "An arbitrary or BST-shaped binary tree.",
      "null placeholders or gaps in a heap.",
      "A fully sorted array presented as 'the heap'.",
      "Swaps between siblings or non-adjacent levels.",
      "A BFS queue panel next to the heap.",
      "1-based index formulas next to 0-based code (or the reverse).",
    ],

    directorActions: [
      "focus_index",
      "heap_insert",
      "heap_compare",
      "heap_swap",
      "heap_pop",
      "heap_settle",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: isMin
      ? {
          input: "min-heap [2, 5, 3, 9, 7], insert 1",
          sceneVisual: {
            kind: "min_heap",
            values: ["2", "5", "3", "9", "7"],
            operation: "Insert 1",
          },
          expectedBeats: [
            { action: "heap_insert", value: "1" },
            { action: "heap_compare", fromIndex: 5, toIndex: 2 },
            { action: "heap_swap", fromIndex: 5, toIndex: 2 },
            { action: "heap_compare", fromIndex: 2, toIndex: 0 },
            { action: "heap_swap", fromIndex: 2, toIndex: 0 },
            { action: "heap_settle", index: 0 },
          ],
        }
      : {
          input: "max-heap [9, 7, 8, 2, 5], insert 10",
          sceneVisual: {
            kind: "max_heap",
            values: ["9", "7", "8", "2", "5"],
            operation: "Insert 10",
          },
          expectedBeats: [
            { action: "heap_insert", value: "10" },
            { action: "heap_compare", fromIndex: 5, toIndex: 2 },
            { action: "heap_swap", fromIndex: 5, toIndex: 2 },
            { action: "heap_compare", fromIndex: 2, toIndex: 0 },
            { action: "heap_swap", fromIndex: 2, toIndex: 0 },
            { action: "heap_settle", index: 0 },
          ],
        },
  };
}

export const PACKS: Record<
  ConceptId,
  ReferencePack
> = {
  min_heap: heapPack("min"),
  max_heap: heapPack("max"),

  sliding_window: {
    id: "sliding_window",
    name: "Sliding Window",
    visualKind: "pointers",
    sources: [ALG0, ALGORITHM_VISUALIZER],

    structure: [
      "One horizontal array/string, fully visible, never re-ordered.",
      "Two boundaries: left and right. The window is every index from left through right.",
    ],

    representation: [
      "The window is drawn as one continuous band spanning left..right.",
      "Pointer labels 'left' and 'right' sit under their cells.",
      "A compact state label shows the tracked value (sum, count, best).",
    ],

    coreProperty: [
      "left and right only ever move forward (never backward).",
      "left <= right + 1 at all times.",
      "Each index enters the window once and leaves once: O(n).",
    ],

    operations: [
      {
        name: "expand",
        steps: [
          "Move right one step.",
          "The new value enters the band.",
          "Update the tracked state.",
        ],
      },
      {
        name: "shrink",
        steps: [
          "Only when the constraint is violated.",
          "Move left one step; that value leaves the band.",
          "Update the tracked state.",
        ],
      },
    ],

    highlightRules: [
      "Every index inside the window is highlighted — the band IS the highlight.",
      "The entering/leaving value gets the emphasis for the beat where it moves.",
    ],

    mustShow: [
      "The array and the window band stay visible through the final O(n) explanation.",
      "Complexity is a label on top of the window, never a replacement scene.",
    ],

    neverShow: [
      "Recomputing a whole subarray from scratch.",
      "A hashmap as the main visual.",
      "A pointer moving backward.",
      "A standalone Big-O chart.",
    ],

    directorActions: [
      "move_pointer",
      "focus_index",
      "show_equation",
      "compare_values",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "max sum of size-3 window in [2, 1, 5, 1, 3, 2]",
      sceneVisual: {
        kind: "pointers",
        values: ["2", "1", "5", "1", "3", "2"],
        activeIndices: [0, 1, 2],
        pointers: [
          { label: "left", index: 0 },
          { label: "right", index: 2 },
        ],
        operation: "Window sum = 8",
      },
      expectedBeats: [
        { action: "move_pointer", label: "right", fromIndex: 2, toIndex: 3 },
        { action: "move_pointer", label: "left", fromIndex: 0, toIndex: 1 },
        { action: "show_equation", text: "8 - 2 + 1 = 7" },
      ],
    },
  },

  two_pointers: {
    id: "two_pointers",
    name: "Two Pointers",
    visualKind: "pointers",
    sources: [ALG0, ALGORITHM_VISUALIZER],

    structure: [
      "One horizontal array, usually sorted, fully visible.",
      "left starts at index 0, right starts at the last index.",
    ],

    representation: [
      "Only the two compared cells are highlighted.",
      "Pointer labels under their cells; a compact comparison label above.",
    ],

    coreProperty: [
      "left only moves right, right only moves left.",
      "Sorted order is what makes discarding one side safe.",
    ],

    operations: [
      {
        name: "step",
        steps: [
          "Compare values at left and right.",
          "Move exactly the pointer the comparison rules out.",
        ],
      },
    ],

    highlightRules: [
      "Highlight the two cells being compared, nothing else.",
    ],

    mustShow: [
      "Both pointers visible until the answer is found.",
    ],

    neverShow: [
      "A pointer moving backward.",
      "Nested loops / all pairs.",
      "A hashmap as the main visual.",
    ],

    directorActions: [
      "move_pointer",
      "focus_index",
      "compare_values",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "pair summing to 9 in sorted [1, 2, 4, 7, 11]",
      sceneVisual: {
        kind: "pointers",
        values: ["1", "2", "4", "7", "11"],
        activeIndices: [0, 4],
        pointers: [
          { label: "left", index: 0 },
          { label: "right", index: 4 },
        ],
        operation: "1 + 11 = 12 > 9",
      },
      expectedBeats: [
        { action: "compare_values", from: "1 + 11", to: "9", text: "12 > 9 — move right" },
        { action: "move_pointer", label: "right", fromIndex: 4, toIndex: 3 },
      ],
    },
  },

  binary_search: {
    id: "binary_search",
    name: "Binary Search",
    visualKind: "pointers",
    sources: [VISUALGO("sorting", "Sorted-array reference states."), ALG0],

    structure: [
      "One sorted horizontal array.",
      "Markers: left, mid, right.",
    ],

    representation: [
      "Cells outside [left, right] are dimmed / not highlighted.",
      "mid is the focused cell.",
    ],

    coreProperty: [
      "The answer, if present, is always inside [left, right].",
      "Each step halves the range: O(log n).",
    ],

    operations: [
      {
        name: "step",
        steps: [
          "Compute mid.",
          "Compare array[mid] to the target.",
          "Discard the half that cannot contain it.",
        ],
      },
    ],

    highlightRules: [
      "Highlight the live range; focus mid.",
    ],

    mustShow: [
      "The shrinking range stays visible until the target is found.",
    ],

    neverShow: [
      "A linear scan.",
      "An unsorted array.",
    ],

    directorActions: [
      "move_pointer",
      "focus_index",
      "compare_values",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "find 7 in [1, 3, 5, 7, 9, 11]",
      sceneVisual: {
        kind: "pointers",
        values: ["1", "3", "5", "7", "9", "11"],
        activeIndices: [0, 1, 2, 3, 4, 5],
        pointers: [
          { label: "left", index: 0 },
          { label: "mid", index: 2 },
          { label: "right", index: 5 },
        ],
        operation: "5 < 7 — discard left half",
      },
      expectedBeats: [
        { action: "compare_values", from: "5", to: "7", text: "5 < 7" },
        { action: "move_pointer", label: "left", fromIndex: 0, toIndex: 3 },
        { action: "move_pointer", label: "mid", fromIndex: 2, toIndex: 4 },
      ],
    },
  },

  bfs: {
    id: "bfs",
    name: "BFS / Level Order",
    visualKind: "tree",
    sources: [
      VISUALGO("dfsbfs", "Traversal order + queue state."),
      VISUALGO("bst", "Clean tree layouts to record."),
    ],

    structure: [
      "The tree on the left (level-order values, null placeholders allowed).",
      "The queue on the right.",
    ],

    representation: [
      "visual.values = level-order tree; visual.stack = current queue (front first).",
    ],

    coreProperty: [
      "FIFO: nodes leave the queue in the order they entered.",
      "A whole level is processed before the next.",
    ],

    operations: [
      {
        name: "visit",
        steps: [
          "Dequeue the front node and highlight it.",
          "Enqueue its children left then right.",
        ],
      },
    ],

    highlightRules: [
      "Highlight the dequeued node; the queue front is marked.",
    ],

    mustShow: [
      "Tree and queue side by side for the entire walkthrough.",
    ],

    neverShow: [
      "Queue without the tree.",
      "A stack (LIFO) order.",
    ],

    directorActions: [
      "focus_index",
      "queue_enqueue",
      "queue_dequeue",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "level order of [3, 9, 20, null, null, 15, 7]",
      sceneVisual: {
        kind: "tree",
        values: ["3", "9", "20", "null", "null", "15", "7"],
        activeIndices: [0],
        stack: ["3"],
        operation: "Queue starts with root",
      },
      expectedBeats: [
        { action: "queue_dequeue", value: "3" },
        { action: "queue_enqueue", value: "9" },
        { action: "queue_enqueue", value: "20" },
      ],
    },
  },

  tree_dfs: {
    id: "tree_dfs",
    name: "Tree DFS",
    visualKind: "tree",
    sources: [
      VISUALGO("bst", "Pre/in/post-order traversal states."),
      VISUALGO("recursion", "Call-stack depth reference."),
    ],

    structure: [
      "The tree in level-order form, visible the whole time.",
    ],

    representation: [
      "The current node/path is highlighted; an explicit stack appears only for iterative DFS.",
    ],

    coreProperty: [
      "Go as deep as possible before backtracking.",
    ],

    operations: [
      {
        name: "visit",
        steps: [
          "Highlight the current node.",
          "Recurse left, then right (order depends on pre/in/post).",
        ],
      },
    ],

    highlightRules: [
      "Exactly one current node at a time.",
    ],

    mustShow: [
      "The tree stays visible through the takeaway.",
    ],

    neverShow: [
      "A queue (that is BFS).",
      "An invented helper structure for recursive DFS.",
    ],

    directorActions: [
      "focus_index",
      "stack_push",
      "stack_pop",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "preorder of [1, 2, 3, 4, 5]",
      sceneVisual: {
        kind: "tree",
        values: ["1", "2", "3", "4", "5"],
        activeIndices: [0],
        operation: "Visit root",
      },
      expectedBeats: [
        { action: "focus_index", index: 1 },
        { action: "focus_index", index: 3 },
      ],
    },
  },

  stack: {
    id: "stack",
    name: "Stack",
    visualKind: "stack",
    sources: [VISUALGO("list", "Stack push/pop states (Stack mode).")],

    structure: [
      "Source input on the left, working stack on the right.",
    ],

    representation: [
      "visual.values = original input, activeIndices = current item, visual.stack = stack bottom→top.",
    ],

    coreProperty: [
      "LIFO: only the top is touched.",
    ],

    operations: [
      {
        name: "process item",
        steps: [
          "Highlight the current input item.",
          "Decide push or pop by comparing with the top.",
          "Hold the resulting stack.",
        ],
      },
    ],

    highlightRules: [
      "One input item at a time; the stack top is emphasized.",
    ],

    mustShow: [
      "Input and stack visible together.",
    ],

    neverShow: [
      "Removing from the bottom/middle.",
      "An isolated stack with no source input.",
    ],

    directorActions: [
      "focus_index",
      "stack_push",
      "stack_pop",
      "compare_values",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "valid parentheses '{[()]}'",
      sceneVisual: {
        kind: "stack",
        values: ["{", "[", "(", ")", "]", "}"],
        activeIndices: [3],
        stack: ["{", "[", "("],
        operation: "')' matches top '(' — pop",
      },
      expectedBeats: [
        { action: "focus_index", index: 3 },
        { action: "stack_pop", value: "(" },
      ],
    },
  },

  hash_map: {
    id: "hash_map",
    name: "Hash Map / Hash Set",
    visualKind: "hash_map",
    visualKinds: ["hash_map", "hash_set"],

    visualContract: [
      '"hash_map" (key → value) or "hash_set" (keys only: membership / duplicates).',
      "visual.values = the INPUT array FROM THIS QUESTION (its real numbers/strings, at most 8). Never reuse a generic example like [2, 7, 11, 15] unless the question uses it.",
      'visual.operation names the scan pattern, verb first: "Two sum target 9" (complement lookup), "Count frequencies", or "Detect duplicate". Direct steps also work: "Insert apple:3", "Lookup banana".',
      "Leave visual.entries empty: the engine builds the table from the input while it scans.",
    ],
    sources: [VISUALGO("hashtable", "Lookup/insert states; chaining vs linear probing; DELETED tombstones.")],

    structure: [
      "Key → value table; the scanned input may sit beside it.",
    ],

    representation: [
      "visual.entries with the active entry flagged.",
    ],

    coreProperty: [
      "O(1) average lookup / insert / delete by key; O(n) worst case when everything collides.",
      "A hash function maps key → bucket index (e.g. key % M). Different keys can collide in one bucket.",
      "Load factor α = n / M. Keep α small (VisuAlgo: < 0.5 for open addressing); past the threshold the table doubles and every key is rehashed.",
      "Separate chaining: each bucket holds a list of keys. Open addressing: probe the next slot (linear / quadratic / double hashing).",
      "Open addressing deletes with a DELETED tombstone, never by emptying the slot (that would break later searches).",
    ],

    operations: [
      {
        name: "lookup then insert (interview pattern)",
        steps: [
          "Look up the complement/key.",
          "If missing, insert the current item.",
        ],
      },
      {
        name: "collision (only when the question is about hashing itself)",
        steps: [
          "Compute the bucket from the hash.",
          "Chaining: walk that bucket's list.",
          "Linear probing: try i, i+1, i+2 … (wrapping) until the key or an EMPTY slot.",
        ],
      },
    ],

    highlightRules: [
      "Highlight the key being looked up or inserted.",
    ],

    mustShow: [
      "The table stays visible through the takeaway.",
    ],

    neverShow: [
      "Nested-loop scanning as the main visual.",
      "Claiming ordered iteration from a hash map.",
    ],

    directorActions: [
      "hm_scan",
      "hm_lookup",
      "hm_insert",
      "focus_index",
      "hash_lookup",
      "hash_insert",
      "compare_values",
      "show_equation",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "(shape only — use THIS question's own data) nums = [3, 5, 1], target 6",
      sceneVisual: {
        kind: "hash_map",
        values: ["3", "5", "1"],
        operation: "Two sum target 6",
      },
      expectedBeats: [
        { action: "hm_scan", index: 0 },
        { action: "hm_lookup", key: "3", label: "miss" },
        { action: "hm_insert", key: "3", value: "0" },
        { action: "hm_scan", index: 1 },
        { action: "hm_lookup", key: "1", label: "miss" },
        { action: "hm_insert", key: "5", value: "1" },
        { action: "hm_scan", index: 2 },
        { action: "hm_lookup", key: "5", label: "hit" },
      ],
    },
  },

  prefix_sum: {
    id: "prefix_sum",
    name: "Prefix Sum",
    visualKind: "array",
    sources: [ALG0],

    structure: [
      "The input array with the running prefix totals.",
    ],

    representation: [
      "values = prefix totals; operation shows the range formula.",
    ],

    coreProperty: [
      "sum(i..j) = prefix[j+1] - prefix[i].",
    ],

    operations: [
      {
        name: "range query",
        steps: [
          "Focus the two prefix entries.",
          "Show the subtraction.",
        ],
      },
    ],

    highlightRules: [
      "Highlight only the two prefix entries used.",
    ],

    mustShow: [
      "Prefix array visible while the formula is shown.",
    ],

    neverShow: [
      "Re-summing the range element by element.",
    ],

    directorActions: [
      "focus_index",
      "move_pointer",
      "show_equation",
      "compare_values",
      "emphasize_result",
    ],

    holdStructureToEnd: true,

    example: {
      input: "sum(1..3) of [3, 1, 4, 1]",
      sceneVisual: {
        kind: "array",
        values: ["0", "3", "4", "8", "9"],
        activeIndices: [1, 4],
        operation: "9 - 3 = 6",
      },
      expectedBeats: [
        { action: "focus_index", index: 4 },
        { action: "show_equation", text: "prefix[4] - prefix[1] = 6" },
      ],
    },
  },

  /* ======================================
     LINKED LIST  (VisuAlgo /list)
  ====================================== */
  linked_list: {
    id: "linked_list",
    name: "Linked List (singly / doubly)",
    visualKind: "linked_list",
    visualKinds: ["linked_list", "doubly_linked_list"],

    visualContract: [
      "visual.values = node values from head to tail (at most 8). No null entries — the arrow after the tail points to null.",
      "visual.pointers = named references into the list, e.g. head, tail, prev, curr, slow, fast (index = node position).",
      'visual.operation starts with the verb: "Insert 5 at 2", "Insert 5 at head", "Append 5", "Remove at 2", "Remove 5" (by value), or "Reverse".',
      '"doubly_linked_list" only when the code has prev pointers.',
    ],

    sources: [VISUALGO("list", "LL / DLL mode. Record insert(i), remove(i), and a manual reverse with the same input.")],

    structure: [
      "Nodes in a left-to-right chain: each node = value + next reference. The last next is null.",
      "head points at node 0; tail (if kept) points at node n-1.",
      "Doubly linked: every node also has prev; head.prev and tail.next are null; edges are drawn two-way.",
    ],

    representation: [
      "Boxes joined by arrows; a null terminator after the tail.",
      "Named pointers (head, prev, curr, slow, fast) sit under their node as labels.",
      "During a reversal, already-reversed links point LEFT, the link being cut is drawn broken.",
    ],

    coreProperty: [
      "Access is sequential: reaching index i means walking i next-links — O(n). No random access.",
      "Insert/remove at the head is O(1); at a known node (with its predecessor) O(1); finding the spot is O(n).",
      "Singly linked: removing the tail is O(n) (need the node before it). Doubly linked: O(1) via tail.prev.",
    ],

    operations: [
      {
        name: "insert at i (1 ≤ i ≤ n-1)",
        steps: [
          "Walk pre to index i-1.",
          "aft = pre.next.",
          "new.next = aft FIRST (so nothing is lost).",
          "pre.next = new.",
        ],
      },
      {
        name: "insert at head / tail",
        steps: [
          "Head: new.next = head; head = new. (Empty list: tail = head too.)",
          "Tail: tail.next = new (link first); tail = new (update second).",
        ],
      },
      {
        name: "remove at i",
        steps: [
          "Head: head = head.next.",
          "Middle: walk pre to i-1; del = pre.next; pre.next = del.next (bypass); del is gone.",
          "Empty list: removal is illegal.",
        ],
      },
      {
        name: "reverse (iterative)",
        steps: [
          "prev = null, curr = head.",
          "Save next = curr.next.",
          "curr.next = prev (flip ONE link).",
          "prev = curr; curr = next.",
          "When curr is null, prev is the new head. O(n) time, O(1) space.",
        ],
      },
      {
        name: "fast / slow pointers",
        steps: [
          "slow moves 1 node, fast moves 2 nodes per step.",
          "Middle: when fast reaches the end, slow is at the middle.",
          "Cycle (Floyd): if fast ever meets slow, there is a cycle.",
        ],
      },
    ],

    highlightRules: [
      "Highlight the node a pointer is on; highlight the single link being rewired.",
      "The inserted node gets the accent; a removed node fades out before the list closes the gap.",
    ],

    mustShow: [
      "The whole chain stays visible, including the null terminator.",
      "Every named pointer stays labeled until it is no longer used.",
      "Reversal: exactly one link flips per step.",
    ],

    neverShow: [
      "Indexing into the list like an array (list[3]) as if it were O(1).",
      "Moving node values around instead of rewiring links.",
      "Losing the rest of the list by setting pre.next before saving next/aft.",
      "Arrays drawn as the 'linked list'.",
    ],

    directorActions: ["move_pointer", "focus_index", "ll_insert", "ll_remove", "ll_reverse_step", "ll_reverse_done", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "reverse 1 → 2 → 3 → 4",
      sceneVisual: { kind: "linked_list", values: ["1", "2", "3", "4"], pointers: [{ label: "head", index: 0 }], operation: "Reverse" },
      expectedBeats: [
        { action: "move_pointer", label: "curr", toIndex: 0 },
        { action: "ll_reverse_step", index: 0 },
        { action: "ll_reverse_step", index: 1 },
        { action: "ll_reverse_step", index: 2 },
        { action: "ll_reverse_step", index: 3 },
        { action: "ll_reverse_done" },
      ],
    },
  },

  /* ======================================
     QUEUE  (VisuAlgo /list, queue mode)
  ====================================== */
  queue: {
    id: "queue",
    name: "Queue (FIFO)",
    visualKind: "queue",

    visualContract: [
      "visual.values = items from FRONT to BACK (at most 10).",
      'visual.operation starts with the verb: "Enqueue 4", "Dequeue", or "Enqueue 4, dequeue".',
    ],

    sources: [VISUALGO("list", "Queue mode: enqueue at tail, dequeue at head.")],

    structure: [
      "A horizontal line of items with a FRONT end (left) and a BACK end (right).",
    ],

    representation: [
      "front and back labels at the two ends; new items slide in at the back, removed items slide out at the front.",
    ],

    coreProperty: [
      "FIFO: items leave in exactly the order they arrived.",
      "enqueue, dequeue and peek are all O(1) (linked list or circular buffer).",
      "In Python use collections.deque — list.pop(0) is O(n).",
    ],

    operations: [
      { name: "enqueue(v)", steps: ["Attach v at the back.", "back now points at v."] },
      { name: "dequeue()", steps: ["Remove the front item and return it.", "front moves to the next item.", "Dequeue on empty is illegal."] },
    ],

    highlightRules: ["Highlight the item entering or leaving; the front item is always marked."],
    mustShow: ["Both ends labeled at all times."],
    neverShow: ["Removing from the back or the middle.", "LIFO order (that is a stack)."],

    directorActions: ["queue_enqueue", "queue_dequeue", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "queue [3, 7], enqueue 5, dequeue",
      sceneVisual: { kind: "queue", values: ["3", "7"], operation: "Enqueue 5, dequeue" },
      expectedBeats: [
        { action: "queue_enqueue", value: "5" },
        { action: "queue_dequeue", value: "3" },
      ],
    },
  },

  /* ======================================
     DEQUE  (VisuAlgo /list, deque mode)
  ====================================== */
  deque: {
    id: "deque",
    name: "Deque / Monotonic Queue",
    visualKind: "deque",

    visualContract: [
      "visual.values = items from FRONT to BACK (at most 10). For a monotonic deque these are usually the VALUES (or indices) currently kept.",
      'visual.operation starts with the verb: "Push back 4", "Push front 1", "Pop back", "Pop front" (several allowed, comma-separated).',
      'SLIDING WINDOW MAXIMUM (the most common deque question): set visual.values = the INPUT array from the problem (not the deque) and visual.operation = "Window max k = 3". The engine animates the monotonic deque itself.',
    ],

    sources: [VISUALGO("list", "Deque mode: InsertHead / InsertTail / RemoveHead / RemoveTail.")],

    structure: ["A horizontal line of items with two open ends; the middle is never touched."],

    representation: [
      "front and back labels; items enter/leave only at the ends.",
      "Monotonic deque: values stay sorted (decreasing for sliding-window max); the front is the current answer.",
    ],

    coreProperty: [
      "push/pop at either end are O(1).",
      "Monotonic deque (sliding window maximum): before pushing x at the back, pop every back item smaller than x; pop the front when it leaves the window. Each index is pushed and popped at most once → O(n).",
    ],

    operations: [
      { name: "push_back / push_front", steps: ["Attach at that end."] },
      { name: "pop_back / pop_front", steps: ["Remove from that end and return it."] },
      {
        name: "monotonic push (window max)",
        steps: [
          "While back < x: pop back (it can never be the max again).",
          "Push x at the back.",
          "If the front has left the window: pop front.",
          "The front is the window maximum.",
        ],
      },
    ],

    highlightRules: ["Highlight the item entering/leaving; mark the front as the current answer for monotonic problems."],
    mustShow: ["Both ends labeled.", "For window problems, keep the source array visible in an earlier/later scene."],
    neverShow: ["Removing from the middle.", "Re-sorting the deque."],

    directorActions: ["deque_push_front", "deque_push_back", "deque_pop_front", "deque_pop_back", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "window max, deque [5, 3], next value 4",
      sceneVisual: { kind: "deque", values: ["5", "3"], operation: "Pop back, push back 4" },
      expectedBeats: [
        { action: "deque_pop_back", value: "3" },
        { action: "deque_push_back", value: "4" },
      ],
    },
  },

  /* ======================================
     BINARY SEARCH TREE / AVL  (VisuAlgo /bst)
  ====================================== */
  bst: {
    id: "bst",
    name: "Binary Search Tree (and AVL)",
    visualKind: "bst",

    visualContract: [
      'visual.values = LEVEL-ORDER array with "null" holes: left child of i is 2i+1, right child 2i+2 (at most 15 slots, depth ≤ 4).',
      "The values must already be a valid BST (left subtree < node < right subtree).",
      'visual.operation starts with the verb: "Search 6", "Insert 6", or "Delete 6".',
    ],

    sources: [VISUALGO("bst", "Record Search, Insert, and Remove for each of the 3 cases (leaf, one child, two children). AVL mode for rotations.")],

    structure: [
      "Binary tree where every key in the LEFT subtree of X is strictly smaller than X and every key in the RIGHT subtree is strictly larger.",
      "Keys are distinct (VisuAlgo counts duplicates with a frequency instead of a second node).",
      "Height: empty tree -1, leaf 0, otherwise max(child heights) + 1.",
    ],

    representation: [
      "Tree drawn level by level; the search path lights up node by node with the comparison (6 < 8 → left).",
      "No queue panel; no array underneath (a BST is not stored as a complete array).",
    ],

    coreProperty: [
      "Inorder traversal (left, node, right) visits keys in sorted order.",
      "Search / insert / delete cost O(h): O(log n) when balanced, O(n) when skewed (sorted inserts make a line).",
      "AVL keeps |height(left) − height(right)| ≤ 1 at every node, so h < 2·log2 n.",
    ],

    operations: [
      { name: "search(v)", steps: ["Start at the root.", "Equal → found. Smaller → go left. Larger → go right.", "Empty slot reached → not present."] },
      { name: "insert(v)", steps: ["Follow the search path.", "Attach v as a NEW LEAF at the empty slot where the search ended."] },
      {
        name: "delete(v)",
        steps: [
          "Search for v.",
          "Leaf: just remove it.",
          "One child: the child (with its whole subtree) takes v's place.",
          "Two children: find the successor (go right once, then left as far as possible), copy it into v's node, then delete the successor (which has at most one child).",
        ],
      },
      {
        name: "AVL rebalance (explain; rotations are shown as before/after)",
        steps: [
          "Balance factor bf = height(left) − height(right); |bf| = 2 means out of balance.",
          "LL (bf +2, left child +1): rotate right. RR (bf −2, right child −1): rotate left.",
          "LR: rotate left at the child, then right. RL: rotate right at the child, then left.",
          "Insert needs at most one fix; delete may need several on the way up.",
        ],
      },
    ],

    highlightRules: ["Highlight every node on the search path in order; the comparison text explains each turn."],
    mustShow: ["The full tree stays visible while the path is traced.", "The BST property label (left < node < right)."],
    neverShow: ["Inserting anywhere other than a leaf.", "A heap-ordered tree called a BST.", "Re-sorting the tree to delete."],

    directorActions: ["bst_visit", "bst_insert", "bst_remove", "bst_replace", "bst_promote", "bst_found", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "BST [8, 3, 10, 1, 6], insert 7",
      sceneVisual: { kind: "bst", values: ["8", "3", "10", "1", "6"], operation: "Insert 7" },
      expectedBeats: [
        { action: "bst_visit", index: 0, text: "7 < 8 → left" },
        { action: "bst_visit", index: 1, text: "7 > 3 → right" },
        { action: "bst_visit", index: 4, text: "7 > 6 → right" },
        { action: "bst_insert", index: 10, value: "7" },
      ],
    },
  },

  /* ======================================
     TRIE  (Princeton COS 226)
  ====================================== */
  trie: {
    id: "trie",
    name: "Trie (Prefix Tree)",
    visualKind: "trie",

    visualContract: [
      "visual.values = the WORDS already stored (lowercase, at most 8 words of ≤ 8 letters). The engine draws the trie from them.",
      'visual.operation starts with the verb: "Insert car", "Search ca", or "StartsWith ca".',
    ],

    sources: [PRINCETON_TRIES],

    structure: [
      "A root that holds no character; each edge/child is one character.",
      "A path from the root spells a prefix; shared prefixes share nodes.",
      "A key ENDS at the node of its last character, which carries an end-of-word mark (a value).",
    ],

    representation: [
      "Tree with the root on top, children in alphabetical order, each node labeled with its character.",
      "End-of-word nodes are drawn with a double ring.",
      "The current path lights up one character at a time.",
    ],

    coreProperty: [
      "Search and insert cost O(L) for a key of length L — independent of how many keys are stored.",
      "A search that ends on a node WITHOUT the end mark is a miss (e.g. \"she\" when only \"shells\" is stored).",
      "A search that hits a missing child is a miss.",
    ],

    operations: [
      { name: "insert(word)", steps: ["Follow the child for each character.", "Create a node wherever the child is missing.", "Mark the last character's node as end-of-word."] },
      { name: "search(word)", steps: ["Follow each character.", "Missing child → miss.", "End at a marked node → hit; unmarked → miss (only a prefix)."] },
      { name: "startsWith(prefix)", steps: ["Follow each character.", "If every child exists, the prefix is present (no end mark needed)."] },
    ],

    highlightRules: ["Highlight the node for each character as it is consumed; new nodes get the accent."],
    mustShow: ["The whole trie and the end-of-word marks stay visible."],
    neverShow: ["Whole words stored in single nodes.", "A hash set drawn as the trie.", "Treating a prefix as a stored word."],

    directorActions: ["trie_step", "trie_create", "trie_end", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "trie {car, cat}, insert cap",
      sceneVisual: { kind: "trie", values: ["car", "cat"], operation: "Insert cap" },
      expectedBeats: [
        { action: "trie_step", text: "c" },
        { action: "trie_step", text: "ca" },
        { action: "trie_create", text: "cap" },
        { action: "trie_end", text: "cap" },
      ],
    },
  },

  /* ======================================
     GRAPH TRAVERSAL  (VisuAlgo /graphds, /dfsbfs)
  ====================================== */
  graph_traversal: {
    id: "graph_traversal",
    name: "Graph BFS / DFS",
    visualKind: "graph",
    visualKinds: ["graph", "digraph"],

    visualContract: [
      'visual.entries = the ADJACENCY LIST: one entry per vertex, { "key": "A", "value": "B,C", "active": false }. At most 10 vertices, labels of 1-3 characters.',
      '"graph" = undirected (each edge listed once is enough; the engine mirrors it). "digraph" = directed (list outgoing neighbors only).',
      'visual.operation starts with the verb: "BFS from A" or "DFS from A".',
    ],

    sources: [
      VISUALGO("graphds", "Adjacency list / matrix / edge list for the same small graph."),
      VISUALGO("dfsbfs", "DFS (explored → visited colors, back edges) and BFS (queue order) from the same source."),
    ],

    structure: [
      "Vertices with edges. Undirected: every edge appears in BOTH endpoints' adjacency lists. Directed: only in the source's list.",
      "Simple graph: no self-loops, no parallel edges. Neighbors are tried in ascending label order.",
    ],

    representation: [
      "Vertices on a circle (or left-to-right layers for a DAG); arrows for directed edges.",
      "Tree edges of the traversal are drawn in the accent color; discovered order is listed under the graph.",
      "BFS shows the QUEUE; DFS shows the recursion STACK.",
    ],

    coreProperty: [
      "BFS explores by distance layers using a FIFO queue; on an unweighted graph it finds shortest paths (in edges).",
      "DFS goes as deep as possible, then backtracks. States: unvisited → explored (on the stack) → visited (finished).",
      "A directed graph has a cycle iff DFS finds a back edge to an explored (on-stack) vertex.",
      "Both run in O(V + E) with an adjacency list (O(V²) with a matrix).",
      "Mark a vertex visited when it is DISCOVERED (enqueued), not when it is dequeued, or it may be queued twice.",
    ],

    operations: [
      { name: "BFS(s)", steps: ["Mark s, enqueue s.", "Dequeue u.", "For each unvisited neighbor v (ascending): mark v, enqueue v, record tree edge u→v.", "Repeat until the queue is empty."] },
      { name: "DFS(s)", steps: ["Mark s explored.", "For each unvisited neighbor v: tree edge s→v, recurse DFS(v).", "When no unvisited neighbors remain, mark s visited (finished) and backtrack."] },
      { name: "connected components", steps: ["For each unvisited vertex: count += 1, run BFS/DFS from it.", "Total still O(V + E)."] },
    ],

    highlightRules: ["Current vertex in the accent; finished vertices dimmed; the single edge being explored highlighted."],
    mustShow: ["The whole graph stays visible.", "The frontier (queue or stack) is always visible."],
    neverShow: ["A tree drawn instead of a graph with cycles.", "Visiting a vertex twice.", "BFS with a stack or DFS with a queue."],

    directorActions: ["graph_frontier", "graph_visit", "graph_edge", "graph_done", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "undirected A-B, A-C, B-D, C-D; BFS from A",
      sceneVisual: {
        kind: "graph",
        entries: [
          { key: "A", value: "B,C", active: false },
          { key: "B", value: "D", active: false },
          { key: "C", value: "D", active: false },
        ],
        operation: "BFS from A",
      },
      expectedBeats: [
        { action: "graph_frontier", key: "A" },
        { action: "graph_visit", key: "A" },
        { action: "graph_edge", from: "A", to: "B" },
        { action: "graph_edge", from: "A", to: "C" },
        { action: "graph_visit", key: "B" },
        { action: "graph_edge", from: "B", to: "D" },
      ],
    },
  },

  /* ======================================
     TOPOLOGICAL SORT  (Kahn)
  ====================================== */
  topological_sort: {
    id: "topological_sort",
    name: "Topological Sort (Kahn's algorithm)",
    visualKind: "digraph",

    visualContract: [
      'visual.entries = DIRECTED adjacency list (u → its successors), e.g. { "key": "0", "value": "1,2" } for prerequisites 0→1, 0→2.',
      'visual.operation = "Topological sort".',
    ],

    sources: [KAHN_TEMPLATE, VISUALGO("dfsbfs", "Toposort modes (DFS post-order and Kahn).")],

    structure: ["A DIRECTED graph. Only a DAG (no directed cycle) has a topological order."],

    representation: [
      "Vertices in left-to-right layers; each vertex shows its current in-degree.",
      "Processed edges fade out as they are removed; the output order grows underneath; the zero-in-degree queue is visible.",
    ],

    coreProperty: [
      "Every edge u→v puts u before v in the order.",
      "If the output has fewer than V vertices, the graph has a cycle (course schedule impossible).",
      "O(V + E).",
    ],

    operations: [
      {
        name: "Kahn",
        steps: [
          "Compute in-degree of every vertex.",
          "Enqueue every vertex with in-degree 0.",
          "Dequeue u, append it to the order.",
          "For each edge u→v: remove it (in-degree[v] − 1); if it hits 0, enqueue v.",
          "Order length < V ⇒ cycle.",
        ],
      },
      {
        name: "DFS variant",
        steps: ["3 states: unvisited / visiting / visited.", "Append a vertex AFTER all its successors finish (post-order).", "Reverse the post-order. A visiting→visiting edge means a cycle."],
      },
    ],

    highlightRules: ["Highlight the dequeued vertex and each outgoing edge as it is removed; in-degree labels update live."],
    mustShow: ["In-degree labels, the queue, and the output order stay visible."],
    neverShow: ["Undirected edges.", "Sorting vertices by label and calling it topological."],

    directorActions: ["graph_frontier", "graph_visit", "graph_edge", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "prerequisites 0→1, 0→2, 1→3, 2→3",
      sceneVisual: {
        kind: "digraph",
        entries: [
          { key: "0", value: "1,2", active: false },
          { key: "1", value: "3", active: false },
          { key: "2", value: "3", active: false },
        ],
        operation: "Topological sort",
      },
      expectedBeats: [
        { action: "graph_frontier", text: "0" },
        { action: "graph_visit", key: "0" },
        { action: "graph_edge", from: "0", to: "1", label: "removed" },
        { action: "graph_edge", from: "0", to: "2", label: "removed" },
      ],
    },
  },

  /* ======================================
     SHORTEST PATH  (Dijkstra)
  ====================================== */
  shortest_path: {
    id: "shortest_path",
    name: "Shortest Path (Dijkstra)",
    visualKind: "graph",
    visualKinds: ["graph", "digraph"],

    visualContract: [
      'visual.entries = WEIGHTED adjacency list: { "key": "A", "value": "B:4,C:1" } (non-negative weights).',
      'visual.operation = "Dijkstra from A".',
    ],

    sources: [VISUALGO("sssp", "Dijkstra on a small weighted graph; record the distance labels.")],

    structure: ["A weighted graph with NON-NEGATIVE edge weights and a source vertex."],

    representation: [
      "Each vertex shows its current best distance (∞ until reached).",
      "The min-priority queue of (distance, vertex) is visible; the shortest-path tree edges are drawn in the accent.",
    ],

    coreProperty: [
      "Pop the vertex with the SMALLEST tentative distance; its distance is then final.",
      "Relax edge u→v: if dist[u] + w < dist[v], update dist[v] and push it.",
      "O((V + E) log V) with a binary heap. Negative weights break it (use Bellman-Ford).",
      "Unweighted graph? BFS is enough.",
    ],

    operations: [
      {
        name: "Dijkstra(s)",
        steps: [
          "dist[s] = 0, everything else ∞; push (0, s).",
          "Pop the minimum (d, u); skip it if already finalized.",
          "Finalize u.",
          "Relax each edge u→v.",
          "Repeat until the queue is empty.",
        ],
      },
    ],

    highlightRules: ["Highlight the popped vertex and the edge being relaxed; distance labels change only on a successful relax."],
    mustShow: ["Distance labels and the priority queue stay visible."],
    neverShow: ["Negative weights.", "Finalizing a vertex before it is the minimum.", "BFS order presented as Dijkstra on a weighted graph."],

    directorActions: ["graph_dist", "graph_visit", "graph_edge", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "A-B:4, A-C:1, C-B:2; Dijkstra from A",
      sceneVisual: {
        kind: "graph",
        entries: [
          { key: "A", value: "B:4,C:1", active: false },
          { key: "C", value: "B:2", active: false },
        ],
        operation: "Dijkstra from A",
      },
      expectedBeats: [
        { action: "graph_dist", key: "A", value: "0" },
        { action: "graph_visit", key: "A" },
        { action: "graph_edge", from: "A", to: "B", label: "relax", value: "4" },
        { action: "graph_edge", from: "A", to: "C", label: "relax", value: "1" },
        { action: "graph_visit", key: "C" },
        { action: "graph_edge", from: "C", to: "B", label: "relax", value: "3" },
      ],
    },
  },

  /* ======================================
     UNION-FIND  (VisuAlgo /ufds)
  ====================================== */
  union_find: {
    id: "union_find",
    name: "Union-Find (Disjoint Sets)",
    visualKind: "union_find",

    visualContract: [
      "visual.values = the PARENT ARRAY p as strings (index = item, value = its parent; a root has p[i] = i). At most 12 items.",
      'visual.operation starts with the verb: "union(1, 4)", "find(3)", or "connected(2, 5)".',
    ],

    sources: [VISUALGO("ufds", "Record FindSet with path compression and UnionSet by rank on the same small forest.")],

    structure: [
      "A FOREST: each tree is one set; its root is the set's representative.",
      "Stored as a parent array p; a root satisfies p[i] = i.",
    ],

    representation: [
      "Each tree drawn with the root on top and children below; the parent array sits underneath with index labels.",
      "During find, the path up to the root lights up; compression re-draws those nodes directly under the root.",
    ],

    coreProperty: [
      "find(x): follow p until p[r] = r. Two items are in the same set iff they have the same root.",
      "Path compression: after find, every node on the path points straight at the root.",
      "Union by rank/height: the root of the SHORTER tree goes under the root of the taller one; equal ranks → rank grows by 1.",
      "With both heuristics each operation is O(α(n)) — effectively constant.",
    ],

    operations: [
      { name: "find(x)", steps: ["Walk x → p[x] → … until the root.", "Compress: point every node on the path at the root."] },
      { name: "union(a, b)", steps: ["ra = find(a), rb = find(b).", "Same root → nothing to do (they are already connected; in cycle detection this edge closes a cycle).", "Otherwise link the shorter tree's root under the taller tree's root."] },
    ],

    highlightRules: ["Highlight the find path node by node; the root in the accent; the new parent link on union."],
    mustShow: ["The forest and the parent array stay visible together."],
    neverShow: ["Merging by relabeling every member of a set (that is O(n) quick-find).", "Splitting a set (union-find cannot undo)."],

    directorActions: ["uf_visit", "uf_root", "uf_link", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "p = [0, 0, 1, 3, 3], union(2, 4)",
      sceneVisual: { kind: "union_find", values: ["0", "0", "1", "3", "3"], operation: "union(2, 4)" },
      expectedBeats: [
        { action: "uf_visit", index: 2 },
        { action: "uf_visit", index: 1 },
        { action: "uf_root", index: 0 },
        { action: "uf_link", fromIndex: 2, toIndex: 0, label: "compress" },
        { action: "uf_visit", index: 4 },
        { action: "uf_root", index: 3 },
        { action: "uf_link", fromIndex: 3, toIndex: 0, label: "union" },
      ],
    },
  },

  /* ======================================
     SEGMENT TREE  (VisuAlgo /segmenttree)
  ====================================== */
  segment_tree: {
    id: "segment_tree",
    name: "Segment Tree",
    visualKind: "segment_tree_sum",
    visualKinds: ["segment_tree_sum", "segment_tree_min", "segment_tree_max"],

    visualContract: [
      "visual.values = the underlying ARRAY A (numbers, at most 8). The engine builds the tree from it.",
      "Kind picks the aggregate: segment_tree_sum, segment_tree_min, or segment_tree_max.",
      'visual.operation starts with the verb: "Query [2, 5]" or "Update 3 = 10" (0-based indices).',
    ],

    sources: [VISUALGO("segmenttree", "Range labels p:[L,R] under each node; record a query and a point update."), HACKEREARTH_SEGTREE],

    structure: [
      "Node 1 is the root covering [0, n-1]; node p has children 2p and 2p+1 that split its range at mid = (L+R)//2.",
      "Leaves are single elements; each internal node stores the aggregate (sum / min / max) of its range.",
      "About 2n-1 nodes; arrays are usually sized 4n.",
    ],

    representation: [
      "Tree of nodes, each labeled with its range [L,R] and its aggregate; the array A sits underneath.",
      "Query coloring: inside = accent (used whole), partial = outline (split), outside = dimmed (skipped).",
    ],

    coreProperty: [
      "Build O(n); range query and point update O(log n).",
      "Query cases: completely outside → return identity (0 / +∞ / −∞); completely inside → return the node; partial → combine both children.",
      "Lazy propagation (range update): store a pending update on a fully covered node and push it to the children only when they are visited.",
    ],

    operations: [
      { name: "query(l, r)", steps: ["Start at the root.", "Outside → skip.", "Inside → take the node's value.", "Partial → recurse left and right, combine."] },
      { name: "update(i, v)", steps: ["Walk from the root down to the leaf for i.", "Set the leaf.", "Recompute every ancestor on the way back up."] },
    ],

    highlightRules: ["Color each visited node by its case; the leaf-to-root path on update."],
    mustShow: ["Range labels on every node.", "The array underneath."],
    neverShow: ["Recomputing the whole tree on an update.", "Scanning A[l..r] directly as 'the query'."],

    directorActions: ["seg_visit", "seg_set", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "sum tree over [5, 8, 6, 3, 2], query [1, 3]",
      sceneVisual: { kind: "segment_tree_sum", values: ["5", "8", "6", "3", "2"], operation: "Query [1, 3]" },
      expectedBeats: [
        { action: "seg_visit", index: 1, label: "partial" },
        { action: "seg_visit", index: 2, label: "partial" },
        { action: "seg_visit", index: 4, label: "partial" },
        { action: "emphasize_result", text: "sum[1..3] = 17" },
      ],
    },
  },

  /* ======================================
     FENWICK TREE  (VisuAlgo /fenwicktree)
  ====================================== */
  fenwick_tree: {
    id: "fenwick_tree",
    name: "Fenwick Tree (Binary Indexed Tree)",
    visualKind: "fenwick_tree",

    visualContract: [
      "visual.values = the frequency/value array f[1..n] (numbers, at most 12). Index 1 is the FIRST value — Fenwick trees are 1-based.",
      'visual.operation starts with the verb: "Prefix 6", "Query [4, 6]", or "Update 3 +2".',
    ],

    sources: [VISUALGO("fenwicktree", "Record rsq(j) (interrogation tree) and update(i, v) (updating tree) separately.")],

    structure: [
      "Array ft[1..n]; index 0 is unused.",
      "LSOne(i) = i & -i (the lowest set bit).",
      "ft[i] stores the sum of f over [i − LSOne(i) + 1 .. i].",
    ],

    representation: [
      "Two rows: f (values) and ft (Fenwick cells), with each ft cell's responsibility range drawn as a bar.",
      "Index labels show binary (e.g. 6 = 110) so the lowest set bit is visible.",
    ],

    coreProperty: [
      "prefix(j): add ft[j], then j −= LSOne(j), until j = 0.",
      "update(i, v): add v to ft[i], then i += LSOne(i), while i ≤ n.",
      "range(i, j) = prefix(j) − prefix(i − 1).",
      "Each walk touches O(log n) cells.",
    ],

    operations: [
      { name: "prefix(j)", steps: ["Take ft[j].", "Drop the lowest set bit: j −= LSOne(j).", "Repeat until j = 0; the sum is the answer."] },
      { name: "update(i, v)", steps: ["Add v to f[i].", "Add v to ft[i].", "i += LSOne(i) (climb to the next cell whose range covers i).", "Stop past n."] },
    ],

    highlightRules: ["Highlight each visited ft cell together with its range bar; show the bit arithmetic for each hop."],
    mustShow: ["Both rows and the range bars stay visible.", "1-based index labels."],
    neverShow: ["0-based Fenwick indexing (LSOne(0) = 0 loops forever).", "Summing f directly as 'the query'."],

    directorActions: ["fw_visit", "fw_add", "fw_update", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "f[1..6] = [0, 1, 0, 1, 2, 3], prefix 6",
      sceneVisual: { kind: "fenwick_tree", values: ["0", "1", "0", "1", "2", "3"], operation: "Prefix 6" },
      expectedBeats: [
        { action: "fw_visit", index: 6 },
        { action: "fw_visit", index: 4 },
        { action: "emphasize_result", text: "rsq(6) = 7" },
      ],
    },
  },

  /* ======================================
     GRAPH REPRESENTATION  (VisuAlgo /graphds)
  ====================================== */
  graph_representation: {
    id: "graph_representation",
    name: "Graph Representation (Adjacency List)",
    visualKind: "graph",
    visualKinds: ["graph", "digraph"],

    visualContract: [
      'visual.entries = the ADJACENCY LIST built from THIS question\'s graph: one entry per vertex, { "key": "0", "value": "1,2", "active": false }. Use the question\'s own vertices/edges (e.g. edges = [[0,1],[0,2]] → key "0" value "1,2").',
      '"graph" = undirected (the engine mirrors each edge into both lists), "digraph" = directed (out-neighbors only).',
      'visual.operation, verb first: "Build adjacency list" (adds the edges one by one) or "Neighbors of 2" (reads one list).',
    ],

    sources: [VISUALGO("graphds", "Adjacency matrix vs adjacency list vs edge list for the same small graph.")],

    structure: [
      "Vertices + edges. The adjacency list is an array/map of V lists: list[u] holds u's neighbors.",
      "Undirected: every edge appears in BOTH endpoints' lists. Directed: only in the source's list.",
      "Adjacency matrix: V×V grid, M[u][v] = 1 (or the weight) when the edge exists; symmetric if undirected.",
    ],

    representation: [
      "The graph drawing on top; the adjacency list (vertex → neighbors) next to it, filling in as edges are added.",
      "When reading one vertex's neighbors, its row and its edges light up together.",
    ],

    coreProperty: [
      "Adjacency list: O(V + E) space, neighbors of u in O(deg(u)); checking one specific edge is O(deg(u)).",
      "Adjacency matrix: O(V²) space even for sparse graphs, edge check O(1), listing neighbors O(V).",
      "Edge list: O(E) space; good for Kruskal / sorting edges, poor for neighbor queries.",
      "Most interview graphs are sparse (E ≪ V²) → use an adjacency list.",
    ],

    operations: [
      { name: "build", steps: ["Start with an empty list per vertex.", "For each edge (u, v): append v to list[u]; if undirected also append u to list[v]."] },
      { name: "neighbors(u)", steps: ["Go straight to list[u].", "Iterate it: cost is the degree of u, not V."] },
    ],

    highlightRules: ["Highlight the edge being added and the list entries it creates (two entries when undirected)."],
    mustShow: ["The graph and its adjacency list together.", "Real neighbor values in every list — never an empty table."],
    neverShow: ["An empty key/value table with no neighbors.", "A hash map of unrelated values standing in for the graph.", "A matrix for a sparse graph presented as optimal."],

    directorActions: ["graph_add_edge", "graph_visit", "graph_edge", "focus_index", "show_equation", "emphasize_result"],
    holdStructureToEnd: true,

    example: {
      input: "(shape only — use THIS question's graph) edges = [[0,1],[0,2],[1,2],[2,3]]",
      sceneVisual: {
        kind: "graph",
        entries: [
          { key: "0", value: "1,2", active: false },
          { key: "1", value: "2", active: false },
          { key: "2", value: "3", active: false },
        ],
        operation: "Build adjacency list",
      },
      expectedBeats: [
        { action: "graph_add_edge", from: "0", to: "1" },
        { action: "graph_add_edge", from: "0", to: "2" },
        { action: "graph_add_edge", from: "1", to: "2" },
        { action: "graph_add_edge", from: "2", to: "3" },
      ],
    },
  },
};

