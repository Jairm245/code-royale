# Code Royale reference library

The AI director learns from **reference packs**, not from a pile of random
DSA videos. Each pack answers two separate questions:

1. **What should this data structure look like?** (structure reference)
2. **How should this specific operation move?** (operation reference)

Keeping them separate is what stops a heap from rendering as an arbitrary
binary tree, and stops a sliding window from disappearing before the point
lands.

## How the pieces fit

| Layer | File | Job |
| --- | --- | --- |
| Rules the model reads | `convex/referencePackLibrary.ts` | One pack per concept: structure, representation, core property, operations, highlight / must-show / never-show rules, worked example |
| Detection + prompt rendering | `convex/referencePacks.ts` | Which pack applies to a question, which visual kind to use (e.g. heap tree view vs array view) |
| Correctness | `convex/structureEngines.ts` | One engine per structure: repairs the starting state and computes the exact event list for each operation |
| Picture | `src/components/StructureVisuals.tsx` | One view per structure; folds the same engine events, so picture = algorithm |
| Your clips | `references/<concept>/` | Recordings you study to write and refine the rules (the model never sees them) |

The model picks the example and the narration timing. **The steps on screen
come from the engines**, so a model mistake (wrong swap, wrong BST branch,
skipped path compression) cannot reach the screen.

## Best way to get the rules (what we did, and how to add more)

1. **Primary source for structure + operation steps: VisuAlgo's printable
   e-lectures** (`https://visualgo.net/en/<module>/print`). Each one states the
   representation, the invariants, and the step order of every operation
   (for example "link `tail.next` first, update `tail` second"). These are
   the most precise, citation-ready rules available.
2. **Invariants VisuAlgo doesn't cover:** university lecture notes
   (Princeton COS 226 for tries) and well-known implementation notes
   (segment-tree query cases, lazy propagation).
3. **Interview conventions:** the LeetCode-standard templates (Kahn's
   in-degree queue, 0-based `heapq` indexing), because the explanation has to
   match the code players will write. VisuAlgo's heap is **1-based**
   (`parent = i >> 1`), but Code Royale uses 0-based (`(i-1)//2`) to match
   Python and Java.
4. **Record clips with the same input as the pack's `example`**, so the clip,
   the rules, and the expected events all describe one case.
5. **Turn every checkable rule into engine code.** Text rules guide the model.
   Engine rules guarantee the result.

## Sources used

| Concept | Source |
| --- | --- |
| Linked list, queue, deque, stack | [VisuAlgo — LL, Stack, Queue, DLL, Deque](https://visualgo.net/en/list/print) |
| Heap (tree + compact array) | [VisuAlgo — Binary Heap](https://visualgo.net/en/heap/print) |
| BST / AVL | [VisuAlgo — BST](https://visualgo.net/en/bst/print) |
| Union-find | [VisuAlgo — UFDS](https://visualgo.net/en/ufds/print) |
| Fenwick tree | [VisuAlgo — Fenwick Tree](https://visualgo.net/en/fenwicktree/print) |
| Segment tree | [VisuAlgo — Segment Tree](https://visualgo.net/en/segmenttree), [HackerEarth — segment tree & lazy propagation](https://www.hackerearth.com/practice/notes/segment-tree-and-lazy-propagation/) |
| Graph representations | [VisuAlgo — Graph DS](https://visualgo.net/en/graphds/print) |
| BFS / DFS / toposort / cycles | [VisuAlgo — DFS/BFS](https://visualgo.net/en/dfsbfs/print), [LeetCode topological sort templates](https://leetcode.com/discuss/post/6125954/patterntemplate-topological-sorting-patt-6vwh) |
| Hash table internals | [VisuAlgo — Hash Table](https://visualgo.net/en/hashtable/print) |
| Trie | [Princeton COS 226 — Tries](https://www.cs.princeton.edu/courses/archive/fall21/cos226/lectures/52Tries.pdf) |
| Sync of code + animation | [alg0.dev](https://alg0.dev), [Algorithm Visualizer](https://algorithm-visualizer.org) |

## Concepts and what the engine guarantees

| Concept | Visual kind(s) | Coach supplies | Engine guarantees |
| --- | --- | --- | --- |
| Min / max heap | `min_heap` (tree + array), `min_heap_array` (array only); same for max | `values` = heap array, `operation` = `Insert 1` / `Pop min` / `Heapify` | complete tree, valid heap, correct sift-up/down, Floyd build |
| BST | `bst` | level-order `values` with `null`, `Search 6` / `Insert 6` / `Delete 6` | valid BST, correct path, leaf insert, all 3 delete cases |
| Trie | `trie` | `values` = stored words, `Insert cap` / `Search ca` / `StartsWith ca` | shared prefixes, end-of-word marks, hit vs. prefix-only miss |
| Graph BFS / DFS | `graph`, `digraph` | `entries` = adjacency list, `BFS from A` / `DFS from A` | symmetric undirected lists, queue/stack order, tree edges |
| Topological sort | `digraph` | adjacency list, `Topological sort` | Kahn order, live in-degrees, cycle detection |
| Shortest path | `graph`, `digraph` | weighted list `B:4,C:1`, `Dijkstra from A` | min-distance pops, relaxations, final distances |
| Union-find | `union_find` | `values` = parent array, `union(1, 4)` / `find(3)` | acyclic forest, path compression, union by rank |
| Segment tree | `segment_tree_sum` / `_min` / `_max` | `values` = array, `Query [2, 5]` / `Update 3 = 10` | built tree, outside/inside/partial cases, update path |
| Fenwick tree | `fenwick_tree` | `values` = f[1..n], `Prefix 6` / `Query [4, 6]` / `Update 3 +2` | 1-based LSOne walks, ft ranges |
| Linked list | `linked_list`, `doubly_linked_list` | `values` + `pointers`, `Insert 5 at 2` / `Remove at 2` / `Reverse` | pre-walk, link order, one link flipped per reverse step |
| Queue / deque | `queue`, `deque` | `values` front→back, `Enqueue 4` / `Pop back, push back 4` | FIFO / both-ends only; pops remove the real end |
| Sliding window, two pointers, binary search, tree BFS/DFS, stack, hash map, prefix sum | existing kinds | — | pointer monotonicity (window/two pointers), structure held to the end |

**Heap: tree vs array view.** The array view is chosen automatically when the
question is about index arithmetic, heapify / build-heap, heap sort, or how
a heap is stored. Otherwise the tree view (with the array underneath) is
used. The Coach can also pick `min_heap_array` itself.

## Folder per concept

```
references/<concept>/
  structure.png        # the resting structure, nothing happening
  op-<name>.mp4        # one clip per operation (insert, pop, union, query…)
  notes.md             # source URL, the exact input you used, what you noticed
```

## Recording checklist

| Concept | Where to record | Input (matches the pack example) | Clips |
| --- | --- | --- | --- |
| min-heap | [VisuAlgo heap](https://visualgo.net/en/heap), toggle tree **and** compact array | `[2, 5, 3, 9, 7]`, insert 1, extract | structure (both views), op-insert, op-pop, op-heapify |
| max-heap | [VisuAlgo heap](https://visualgo.net/en/heap) | `[9, 7, 8, 2, 5]`, insert 10 | structure, op-insert, op-pop |
| bst | [VisuAlgo BST](https://visualgo.net/en/bst) | `[8, 3, 10, 1, 6]`, insert 7, delete 3 | op-search, op-insert, op-delete (×3 cases) |
| trie | any trie visualizer | `{car, cat}`, insert cap, search ca | op-insert, op-search-miss |
| graph-traversal | [VisuAlgo DFS/BFS](https://visualgo.net/en/dfsbfs) | A–B, A–C, B–D, C–D | op-bfs, op-dfs |
| topological-sort | [VisuAlgo DFS/BFS](https://visualgo.net/en/dfsbfs) (toposort) | 0→1, 0→2, 1→3, 2→3 | op-kahn |
| shortest-path | [VisuAlgo SSSP](https://visualgo.net/en/sssp) | A–B:4, A–C:1, C–B:2 | op-dijkstra |
| union-find | [VisuAlgo UFDS](https://visualgo.net/en/ufds) | p = `[0, 0, 1, 3, 3]`, union(2, 4) | op-find, op-union |
| segment-tree | [VisuAlgo segment tree](https://visualgo.net/en/segmenttree) | `[5, 8, 6, 3, 2]`, query [1, 3] | op-query, op-update |
| fenwick-tree | [VisuAlgo Fenwick](https://visualgo.net/en/fenwicktree) | f = `[0, 1, 0, 1, 2, 3]`, prefix 6 | op-query, op-update |
| linked-list | [VisuAlgo list](https://visualgo.net/en/list) | `1→2→3→4`, insert 5 at 2, reverse | op-insert, op-remove, op-reverse |
| queue / deque | [VisuAlgo list](https://visualgo.net/en/list) (queue / deque mode) | `[3, 7]`, enqueue 5, dequeue | op-enqueue, op-dequeue |
| sliding-window | [alg0.dev](https://alg0.dev) | `[2, 1, 5, 1, 3, 2]`, k = 3 | op-expand, op-shrink |
| two-pointers | [alg0.dev](https://alg0.dev) | sorted `[1, 2, 4, 7, 11]`, target 9 | op-step |
| binary-search | [alg0.dev](https://alg0.dev) | `[1, 3, 5, 7, 9, 11]`, find 7 | op-step |
| stack | [VisuAlgo list](https://visualgo.net/en/list) (stack mode) | `{[()]}` | op-push, op-pop |
| hash-map | [VisuAlgo hash table](https://visualgo.net/en/hashtable) | two-sum `[2, 7, 11, 15]`, 9 | op-lookup, op-insert |

## Adding a new concept

1. Read its VisuAlgo print page (or the best lecture notes). Write down the
   representation, the invariants, and the exact step order of each operation.
2. Record structure and operation clips into `references/<concept>/`.
3. Add a `ConceptId`, a pack in `referencePackLibrary.ts`, and detection
   phrases in `detectConcept()`.
4. If the structure has rules that can be checked: add an engine in
   `structureEngines.ts` (`normalize` + `plan` + an `apply` function) and a
   view in `StructureVisuals.tsx` that folds the same events.
5. Run a simulated explanation through the pipeline and look at it before
   shipping.

**Not yet engine-backed (rules only, or not covered):** AVL rotations
(rules are in the BST pack; the view shows a plain BST), lazy segment-tree
range updates (rules only), heap sort (explained, not animated step by step),
2D grids (islands / flood fill), and Bellman-Ford.
