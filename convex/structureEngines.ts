/*
  Code Royale Structure Engines

  One deterministic engine per data structure. Each engine:

    normalize(visual)  -> repairs the starting state so it obeys the
                          structure's invariants (complete heap, valid BST,
                          acyclic parent array, symmetric undirected graph…)
    plan(visual)       -> reads visual.operation ("Insert 7", "union(1, 4)",
                          "bfs from A"…) and returns the exact event list for
                          that operation plus the end state
    apply*(state, ev)  -> folds events into state; the RENDERER uses the same
                          functions, so the picture can never disagree with
                          the algorithm

  The AI only chooses the example and the narration timing. The steps that
  appear on screen come from here.

  Rules are taken from the VisuAlgo e-lectures, Princeton COS 226 (tries) and
  standard interview templates (Kahn's algorithm, 0-based heapq indexing).
  See references/README.md for the source list.

  Plain TypeScript (no Convex imports) so both Convex actions and the React
  renderer can import it.
*/

/* ========================================
   SHARED TYPES
======================================== */

export type StructureVisual = {
  kind: string;
  values?: string[];
  activeIndices?: number[];
  pointers?: Array<{ label: string; index: number }>;
  entries?: Array<{ key: string; value: string; active: boolean }>;
  stack?: string[];
  operation?: string;
  reasoningSteps?: string[];
};

export type EngineEvent = {
  action: string;
  index?: number;
  fromIndex?: number;
  toIndex?: number;
  value?: string;
  text?: string;
  key?: string;
  label?: string;
  from?: string;
  to?: string;
};

export type EnginePlan = {
  events: EngineEvent[];
  end: StructureVisual;
};

export type StructureEngine = {
  kinds: string[];
  /* director actions this engine owns (used only for timing) */
  actions: string[];
  normalize: (visual: StructureVisual) => StructureVisual | null;
  plan: (visual: StructureVisual) => EnginePlan;
  /*
    Optional: when the scene has no parseable operation,
    re-check the Director's own beats for this structure
    and return a corrected, legal version (or []).
  */
  replay?: (visual: StructureVisual, beats: EngineEvent[]) => EngineEvent[];
};

/* Upper bound on events per scene, so a scene stays watchable. */
export const MAX_ENGINE_EVENTS = 24;

/* ========================================
   SHARED HELPERS
======================================== */

function isNumeric(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

function compareKeys(a: string, b: string) {
  if (isNumeric(a) && isNumeric(b)) {
    return Number(a) - Number(b);
  }

  return a.localeCompare(b);
}

function cleanValues(values: string[] | undefined) {
  return (values ?? [])
    .map((value) => String(value).trim())
    .filter(
      (value) =>
        value !== "" &&
        value.toLowerCase() !== "null" &&
        value.toLowerCase() !== "none"
    );
}

/*
  An operation label only counts when it STARTS with a known verb, and never
  when it is a complexity label ("Pop is O(log n)"). This keeps takeaway
  captions from triggering operations.
*/
function operationText(
  visual: StructureVisual,
  verbs: string[]
) {
  const label = visual.operation?.trim() ?? "";

  if (!label || /\bO\s*\(/.test(label)) {
    return "";
  }

  const pattern = new RegExp(`^(${verbs.join("|")})\\b`, "i");

  return pattern.test(label) ? label : "";
}

function numbersIn(text: string) {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function capEvents(events: EngineEvent[]) {
  if (events.length <= MAX_ENGINE_EVENTS) {
    return events;
  }

  return [
    ...events.slice(0, MAX_ENGINE_EVENTS - 1),
    { action: "emphasize_result", text: "…continues the same way" },
  ];
}

function levelOf(index: number) {
  return Math.floor(Math.log2(index + 1));
}

/* ========================================
   HEAP  (min_heap, max_heap, *_array)
   0-based like Python heapq / Java PriorityQueue:
   parent(i) = (i-1)//2, children 2i+1, 2i+2.
   (VisuAlgo uses 1-based: parent = i>>1.)
======================================== */

export const HEAP_TREE_KINDS = ["min_heap", "max_heap"];
export const HEAP_ARRAY_KINDS = ["min_heap_array", "max_heap_array"];
export const HEAP_KIND_LIST = [...HEAP_TREE_KINDS, ...HEAP_ARRAY_KINDS];
export const MAX_HEAP_NODES = 15;

export type HeapOrder = "min" | "max";

export function heapOrderOf(kind: string): HeapOrder {
  return kind.startsWith("max") ? "max" : "min";
}

export function heapParent(index: number) {
  return Math.floor((index - 1) / 2);
}

function heapInOrder(parent: string, child: string, order: HeapOrder) {
  const diff = compareKeys(parent, child);
  return order === "min" ? diff <= 0 : diff >= 0;
}

export function isValidHeap(values: string[], order: HeapOrder) {
  for (let i = 1; i < values.length; i += 1) {
    if (!heapInOrder(values[heapParent(i)], values[i], order)) {
      return false;
    }
  }

  return true;
}

function heapSiftUp(
  values: string[],
  start: number,
  order: HeapOrder,
  events: EngineEvent[]
) {
  let index = start;

  while (index > 0) {
    const parent = heapParent(index);

    events.push({ action: "heap_compare", fromIndex: index, toIndex: parent });

    if (heapInOrder(values[parent], values[index], order)) {
      break;
    }

    events.push({ action: "heap_swap", fromIndex: index, toIndex: parent });
    [values[parent], values[index]] = [values[index], values[parent]];
    index = parent;
  }

  return index;
}

function heapSiftDown(
  values: string[],
  start: number,
  order: HeapOrder,
  events: EngineEvent[]
) {
  let index = start;

  for (;;) {
    const left = 2 * index + 1;
    const right = left + 1;

    if (left >= values.length) {
      break;
    }

    /* the child that belongs on top: smaller (min) / larger (max) */
    let best = left;

    if (right < values.length && !heapInOrder(values[left], values[right], order)) {
      best = right;
    }

    events.push({ action: "heap_compare", fromIndex: index, toIndex: best });

    if (heapInOrder(values[index], values[best], order)) {
      break;
    }

    events.push({ action: "heap_swap", fromIndex: index, toIndex: best });
    [values[index], values[best]] = [values[best], values[index]];
    index = best;
  }

  return index;
}

export function heapify(values: string[], order: HeapOrder) {
  const next = [...values];

  for (let i = Math.floor(next.length / 2) - 1; i >= 0; i -= 1) {
    heapSiftDown(next, i, order, []);
  }

  return next;
}

type HeapOp =
  | { type: "insert"; value: string }
  | { type: "pop" }
  | { type: "heapify" };

export function parseHeapOperations(label: string | undefined): HeapOp[] {
  const text = operationText(
    { kind: "", operation: label },
    ["insert", "push", "heappush", "add", "offer", "pop", "heappop", "extract", "poll", "remove", "heapify", "build"]
  );

  if (!text) {
    return [];
  }

  const ops: HeapOp[] = [];
  const pattern =
    /\b(insert|push|heappush|add|offer)\b\s*\(?\s*(-?\d+(?:\.\d+)?)|\b(heapify|build)\b|\b(pop|heappop|extract|poll|remove)\b/gi;

  for (const match of text.matchAll(pattern)) {
    if (match[2] !== undefined) {
      ops.push({ type: "insert", value: match[2] });
    } else if (match[3] !== undefined) {
      ops.push({ type: "heapify" });
    } else {
      ops.push({ type: "pop" });
    }

    if (ops.length >= 2) {
      break;
    }
  }

  return ops;
}

export function planHeap(
  start: string[],
  ops: HeapOp[],
  order: HeapOrder
) {
  const values = [...start];
  const events: EngineEvent[] = [];

  for (const op of ops) {
    if (op.type === "heapify") {
      /* Floyd: sift down every internal node, last internal node first */
      for (let i = Math.floor(values.length / 2) - 1; i >= 0; i -= 1) {
        events.push({ action: "focus_index", index: i, text: `siftDown(${i})` });
        heapSiftDown(values, i, order, events);
      }

      events.push({ action: "heap_settle", index: 0 });
      continue;
    }

    if (op.type === "insert") {
      if (values.length >= MAX_HEAP_NODES) {
        continue;
      }

      values.push(op.value);
      events.push({ action: "heap_insert", value: op.value, index: values.length - 1 });
      const settledAt = heapSiftUp(values, values.length - 1, order, events);
      events.push({ action: "heap_settle", index: settledAt });
      continue;
    }

    if (values.length === 0) {
      continue;
    }

    const removed = values[0];
    const last = values.pop() as string;
    events.push({ action: "heap_pop", value: removed, index: 0 });

    if (values.length === 0) {
      continue;
    }

    values[0] = last;
    const settledAt = heapSiftDown(values, 0, order, events);
    events.push({ action: "heap_settle", index: settledAt });
  }

  return { values, events: capEvents(events) };
}

export type HeapNode = { id: string; value: string };

export function applyHeapEvents(values: string[], events: EngineEvent[]) {
  const nodes: HeapNode[] = values.map((value, index) => ({ id: `h${index}`, value }));
  let trackedId: string | undefined;
  let popped: string | undefined;
  let inserts = 0;

  for (const event of events) {
    if (event.action === "heap_insert" && event.value !== undefined) {
      inserts += 1;
      const node = { id: `ins${inserts}`, value: event.value };
      nodes.push(node);
      trackedId = node.id;
    } else if (
      event.action === "heap_swap" &&
      event.fromIndex !== undefined &&
      event.toIndex !== undefined &&
      nodes[event.fromIndex] &&
      nodes[event.toIndex]
    ) {
      [nodes[event.fromIndex], nodes[event.toIndex]] = [nodes[event.toIndex], nodes[event.fromIndex]];
    } else if (event.action === "heap_pop" && nodes.length > 0) {
      popped = nodes[0].value;
      const last = nodes.pop() as HeapNode;

      if (nodes.length > 0) {
        nodes[0] = last;
        trackedId = last.id;
      } else {
        trackedId = undefined;
      }
    }
  }

  return { nodes, trackedId, popped };
}

const heapEngine: StructureEngine = {
  kinds: HEAP_KIND_LIST,
  actions: ["heap_insert", "heap_compare", "heap_swap", "heap_pop", "heap_settle", "focus_index"],

  normalize(visual) {
    const order = heapOrderOf(visual.kind);
    const ops = parseHeapOperations(visual.operation);
    const inserts = ops.filter((op) => op.type === "insert").length;
    let values = cleanValues(visual.values).slice(0, Math.max(1, MAX_HEAP_NODES - inserts));

    if (values.length === 0) {
      return null;
    }

    /* a heapify scene deliberately starts from an unordered array */
    const isBuild = ops.some((op) => op.type === "heapify");

    if (!isBuild && !isValidHeap(values, order)) {
      values = heapify(values, order);
    }

    return { kind: visual.kind, values, operation: visual.operation };
  },

  plan(visual) {
    const order = heapOrderOf(visual.kind);
    const { values, events } = planHeap(
      visual.values ?? [],
      parseHeapOperations(visual.operation),
      order
    );

    return { events, end: { kind: visual.kind, values } };
  },
};

/* ========================================
   BINARY SEARCH TREE
   Level-order array with "null" holes:
   left = 2i+1, right = 2i+2. Strict BST
   property (left < node < right), keys distinct.
   Remove: leaf / one child / two children
   (replace with inorder successor).
======================================== */

export const MAX_TREE_SLOTS = 15;

function isEmptySlot(values: string[], index: number) {
  const value = values[index];
  return value === undefined || value === "" || value.toLowerCase() === "null";
}

function ensureSlot(values: string[], index: number) {
  while (values.length <= index) {
    values.push("null");
  }
}

function trimTrailingNulls(values: string[]) {
  const next = [...values];

  while (next.length > 0 && isEmptySlot(next, next.length - 1)) {
    next.pop();
  }

  return next;
}

export function isValidBst(values: string[]) {
  function check(index: number, low?: string, high?: string): boolean {
    if (index >= values.length || isEmptySlot(values, index)) {
      return true;
    }

    const value = values[index];

    if (
      (low !== undefined && compareKeys(value, low) <= 0) ||
      (high !== undefined && compareKeys(value, high) >= 0)
    ) {
      return false;
    }

    return check(2 * index + 1, low, value) && check(2 * index + 2, value, high);
  }

  /* no orphan nodes: every non-empty slot has a non-empty parent */
  for (let i = 1; i < values.length; i += 1) {
    if (!isEmptySlot(values, i) && isEmptySlot(values, Math.floor((i - 1) / 2))) {
      return false;
    }
  }

  return check(0);
}

function bstInsertIndex(values: string[], key: string) {
  let index = 0;

  while (index < MAX_TREE_SLOTS && !isEmptySlot(values, index)) {
    const diff = compareKeys(key, values[index]);

    if (diff === 0) {
      return -1;
    }

    index = diff < 0 ? 2 * index + 1 : 2 * index + 2;
  }

  return index < MAX_TREE_SLOTS ? index : -1;
}

export function buildBst(keys: string[]) {
  const values: string[] = [];

  for (const key of keys) {
    if (values.length === 0) {
      values.push(key);
      continue;
    }

    const index = bstInsertIndex(values, key);

    if (index >= 0) {
      ensureSlot(values, index);
      values[index] = key;
    }
  }

  return trimTrailingNulls(values);
}

/* Move the subtree rooted at `from` so it is rooted at `to` (an ancestor slot). */
export function moveSubtree(values: string[], from: number, to: number) {
  const snapshot: Array<{ path: number[]; value: string }> = [];

  function collect(index: number, path: number[]) {
    if (index >= values.length || isEmptySlot(values, index)) {
      return;
    }

    snapshot.push({ path, value: values[index] });
    collect(2 * index + 1, [...path, 1]);
    collect(2 * index + 2, [...path, 2]);
  }

  function clear(index: number) {
    if (index >= values.length) {
      return;
    }

    values[index] = "null";
    clear(2 * index + 1);
    clear(2 * index + 2);
  }

  collect(from, []);
  clear(to);

  for (const item of snapshot) {
    let index = to;

    for (const step of item.path) {
      index = 2 * index + step;
    }

    if (index < MAX_TREE_SLOTS) {
      ensureSlot(values, index);
      values[index] = item.value;
    }
  }
}

export function applyBstEvent(values: string[], event: EngineEvent) {
  const next = [...values];

  if (event.action === "bst_insert" && event.index !== undefined && event.value !== undefined) {
    ensureSlot(next, event.index);
    next[event.index] = event.value;
  } else if (event.action === "bst_remove" && event.index !== undefined) {
    if (event.index < next.length) {
      next[event.index] = "null";
    }
  } else if (event.action === "bst_replace" && event.index !== undefined && event.value !== undefined) {
    next[event.index] = event.value;
  } else if (event.action === "bst_promote" && event.fromIndex !== undefined && event.toIndex !== undefined) {
    moveSubtree(next, event.fromIndex, event.toIndex);
  }

  return trimTrailingNulls(next);
}

type BstOp = { type: "insert" | "search" | "remove"; key: string };

function parseBstOperations(visual: StructureVisual): BstOp[] {
  const text = operationText(visual, ["insert", "add", "search", "find", "contains", "lookup", "remove", "delete"]);
  const ops: BstOp[] = [];

  for (const match of text.matchAll(/\b(insert|add|search|find|contains|lookup|remove|delete)\b\s*\(?\s*(-?\d+(?:\.\d+)?|\w+)/gi)) {
    const verb = match[1].toLowerCase();
    const type = verb === "insert" || verb === "add" ? "insert" : verb === "remove" || verb === "delete" ? "remove" : "search";
    ops.push({ type, key: match[2] });

    if (ops.length >= 2) {
      break;
    }
  }

  return ops;
}

function bstWalk(values: string[], key: string, events: EngineEvent[]) {
  let index = 0;

  while (index < MAX_TREE_SLOTS && !isEmptySlot(values, index)) {
    const current = values[index];
    const diff = compareKeys(key, current);

    if (diff === 0) {
      events.push({ action: "bst_visit", index, text: `${key} = ${current}` });
      return { index, found: true };
    }

    events.push({
      action: "bst_visit",
      index,
      text: diff < 0 ? `${key} < ${current} → left` : `${key} > ${current} → right`,
    });

    index = diff < 0 ? 2 * index + 1 : 2 * index + 2;
  }

  return { index, found: false };
}

function planBst(start: string[], ops: BstOp[]) {
  let values = [...start];
  const events: EngineEvent[] = [];

  const push = (event: EngineEvent) => {
    events.push(event);
    values = applyBstEvent(values, event);
  };

  for (const op of ops) {
    const walk = bstWalk(values, op.key, events);

    if (op.type === "search") {
      events.push(
        walk.found
          ? { action: "bst_found", index: walk.index, text: `found ${op.key}` }
          : { action: "emphasize_result", text: `${op.key} not found — empty slot reached` }
      );
      continue;
    }

    if (op.type === "insert") {
      if (walk.found) {
        events.push({ action: "emphasize_result", text: `${op.key} already present` });
      } else if (walk.index < MAX_TREE_SLOTS) {
        push({ action: "bst_insert", index: walk.index, value: op.key, text: `empty slot — attach ${op.key} as a new leaf` });
      }
      continue;
    }

    /* remove */
    if (!walk.found) {
      events.push({ action: "emphasize_result", text: `${op.key} not found` });
      continue;
    }

    const index = walk.index;
    const left = 2 * index + 1;
    const right = 2 * index + 2;
    const hasLeft = !isEmptySlot(values, left);
    const hasRight = !isEmptySlot(values, right);

    if (!hasLeft && !hasRight) {
      push({ action: "bst_remove", index, text: "leaf — just remove" });
    } else if (hasLeft !== hasRight) {
      push({
        action: "bst_promote",
        fromIndex: hasLeft ? left : right,
        toIndex: index,
        text: "one child — child takes its place",
      });
    } else {
      /* two children: successor = minimum of the right subtree */
      let successor = right;
      events.push({ action: "bst_visit", index: successor, text: "successor: go right once" });

      while (!isEmptySlot(values, 2 * successor + 1)) {
        successor = 2 * successor + 1;
        events.push({ action: "bst_visit", index: successor, text: "then left as far as possible" });
      }

      const successorValue = values[successor];
      push({ action: "bst_replace", index, value: successorValue, text: `replace with successor ${successorValue}` });

      const successorRight = 2 * successor + 2;

      if (isEmptySlot(values, successorRight)) {
        push({ action: "bst_remove", index: successor, text: "remove old successor (leaf)" });
      } else {
        push({ action: "bst_promote", fromIndex: successorRight, toIndex: successor, text: "successor's right child moves up" });
      }
    }
  }

  return { values, events: capEvents(events) };
}

const bstEngine: StructureEngine = {
  kinds: ["bst"],
  actions: ["bst_visit", "bst_insert", "bst_remove", "bst_replace", "bst_promote", "bst_found", "focus_index"],

  normalize(visual) {
    const raw = (visual.values ?? []).map((value) => String(value).trim()).slice(0, MAX_TREE_SLOTS);

    if (cleanValues(raw).length === 0) {
      return null;
    }

    const values = isValidBst(raw) ? trimTrailingNulls(raw) : buildBst(cleanValues(raw));
    return { kind: "bst", values, operation: visual.operation };
  },

  plan(visual) {
    const { values, events } = planBst(visual.values ?? [], parseBstOperations(visual));
    return { events, end: { kind: "bst", values } };
  },
};

/* ========================================
   UNION-FIND (disjoint sets)
   values = parent array p; a root has p[i] = i.
   find: follow p to the root, then path
   compression re-points the path to the root.
   union: link the shorter tree's root under the
   taller tree's root (rank = height); ties link
   the second root under the first.
======================================== */

export const MAX_UF_ITEMS = 12;

export function parseParents(values: string[] | undefined) {
  const parents = cleanValues(values).slice(0, MAX_UF_ITEMS).map((value) => Math.trunc(Number(value)));

  const valid =
    parents.length > 0 &&
    parents.every((parent) => Number.isFinite(parent) && parent >= 0 && parent < parents.length);

  if (!valid) {
    return parents.length > 0 ? parents.map((_, index) => index) : [];
  }

  /* no cycles other than self-loops at roots */
  for (let start = 0; start < parents.length; start += 1) {
    let node = start;

    for (let steps = 0; parents[node] !== node; steps += 1) {
      if (steps > parents.length) {
        return parents.map((_, index) => index);
      }

      node = parents[node];
    }
  }

  return parents;
}

export function ufRoot(parents: number[], node: number) {
  let current = node;

  while (parents[current] !== current) {
    current = parents[current];
  }

  return current;
}

export function ufHeights(parents: number[]) {
  const heights = parents.map(() => 0);

  parents.forEach((_, node) => {
    let depth = 0;
    let current = node;

    while (parents[current] !== current) {
      current = parents[current];
      depth += 1;
    }

    heights[current] = Math.max(heights[current], depth);
  });

  return heights;
}

export function applyUnionFindEvent(parents: number[], event: EngineEvent) {
  if (
    event.action === "uf_link" &&
    event.fromIndex !== undefined &&
    event.toIndex !== undefined &&
    event.fromIndex < parents.length &&
    event.toIndex < parents.length
  ) {
    const next = [...parents];
    next[event.fromIndex] = event.toIndex;
    return next;
  }

  return parents;
}

type UfOp = { type: "find"; a: number } | { type: "union" | "connected"; a: number; b: number };

function parseUnionFindOperations(visual: StructureVisual): UfOp[] {
  const text = operationText(visual, ["union", "find", "connected", "same", "issameset", "unite"]);
  const ops: UfOp[] = [];

  for (const match of text.matchAll(/\b(union|unite|find|connected|same(?:\s*set)?|issameset)\b[^0-9]*(\d+)(?:[^0-9]+(\d+))?/gi)) {
    const verb = match[1].toLowerCase();
    const a = Number(match[2]);
    const b = match[3] !== undefined ? Number(match[3]) : undefined;

    if (verb === "find" || b === undefined) {
      ops.push({ type: "find", a });
    } else {
      ops.push({ type: verb === "union" || verb === "unite" ? "union" : "connected", a, b });
    }

    if (ops.length >= 2) {
      break;
    }
  }

  return ops;
}

function planUnionFind(start: number[], ops: UfOp[]) {
  let parents = [...start];
  const events: EngineEvent[] = [];

  function find(node: number) {
    const path: number[] = [];
    let current = node;

    while (parents[current] !== current) {
      events.push({ action: "uf_visit", index: current, text: `p[${current}] = ${parents[current]}` });
      path.push(current);
      current = parents[current];
    }

    events.push({ action: "uf_root", index: current, text: `root = ${current}` });

    for (const item of path) {
      if (parents[item] !== current) {
        const event = { action: "uf_link", fromIndex: item, toIndex: current, label: "compress", text: `path compression: p[${item}] = ${current}` };
        events.push(event);
        parents = applyUnionFindEvent(parents, event);
      }
    }

    return current;
  }

  for (const op of ops) {
    if (op.a >= parents.length || ("b" in op && op.b >= parents.length)) {
      continue;
    }

    if (op.type === "find") {
      find(op.a);
      continue;
    }

    const rootA = find(op.a);
    const rootB = find(op.b);

    if (rootA === rootB) {
      events.push({ action: "emphasize_result", text: op.type === "union" ? "already in the same set" : `connected: both reach ${rootA}` });
      continue;
    }

    if (op.type === "connected") {
      events.push({ action: "emphasize_result", text: `not connected: roots ${rootA} ≠ ${rootB}` });
      continue;
    }

    const heights = ufHeights(parents);
    const [child, root] = heights[rootA] < heights[rootB] ? [rootA, rootB] : [rootB, rootA];
    const event = {
      action: "uf_link",
      fromIndex: child,
      toIndex: root,
      label: "union",
      text: heights[rootA] === heights[rootB] ? `equal rank — ${child} under ${root}, rank grows` : `shorter tree ${child} goes under ${root}`,
    };
    events.push(event);
    parents = applyUnionFindEvent(parents, event);
  }

  return { parents, events: capEvents(events) };
}

const unionFindEngine: StructureEngine = {
  kinds: ["union_find"],
  actions: ["uf_visit", "uf_root", "uf_link", "focus_index"],

  normalize(visual) {
    const parents = parseParents(visual.values);
    return parents.length === 0 ? null : { kind: "union_find", values: parents.map(String), operation: visual.operation };
  },

  plan(visual) {
    const { parents, events } = planUnionFind(parseParents(visual.values), parseUnionFindOperations(visual));
    return { events, end: { kind: "union_find", values: parents.map(String) } };
  },
};

/* ========================================
   SEGMENT TREE  (sum / min / max)
   Node p (1-based): children 2p, 2p+1. Each node
   stores the aggregate of its range [L, R].
   Query: outside → identity, inside → node value,
   partial → recurse both children.
======================================== */

export const SEGMENT_KINDS = ["segment_tree_sum", "segment_tree_min", "segment_tree_max"];
export const MAX_SEGMENT_ITEMS = 8;

export type SegmentNode = { p: number; left: number; right: number; value: number };

export function segmentAggregate(kind: string) {
  return kind.endsWith("min") ? "min" : kind.endsWith("max") ? "max" : "sum";
}

function combine(kind: string, a: number, b: number) {
  const aggregate = segmentAggregate(kind);
  return aggregate === "min" ? Math.min(a, b) : aggregate === "max" ? Math.max(a, b) : a + b;
}

export function buildSegmentTree(values: number[], kind: string) {
  const nodes = new Map<number, SegmentNode>();

  function build(p: number, left: number, right: number): number {
    if (left === right) {
      nodes.set(p, { p, left, right, value: values[left] });
      return values[left];
    }

    const mid = Math.floor((left + right) / 2);
    const value = combine(kind, build(2 * p, left, mid), build(2 * p + 1, mid + 1, right));
    nodes.set(p, { p, left, right, value });
    return value;
  }

  if (values.length > 0) {
    build(1, 0, values.length - 1);
  }

  return nodes;
}

function parseSegmentOperations(visual: StructureVisual) {
  const text = operationText(visual, ["query", "sum", "min", "max", "range", "update", "set", "assign"]);

  if (!text) {
    return [];
  }

  const numbers = numbersIn(text);
  const isUpdate = /^(update|set|assign)\b/i.test(text);

  if (numbers.length < 2) {
    return [];
  }

  return [{ type: isUpdate ? ("update" as const) : ("query" as const), a: numbers[0], b: numbers[1] }];
}

function planSegment(start: number[], kind: string, op: { type: "query" | "update"; a: number; b: number } | undefined) {
  const values = [...start];
  const events: EngineEvent[] = [];
  const nodes = buildSegmentTree(values, kind);
  const aggregate = segmentAggregate(kind);

  if (!op || values.length === 0) {
    return { values, events };
  }

  if (op.type === "query") {
    const l = Math.max(0, Math.min(op.a, op.b));
    const r = Math.min(values.length - 1, Math.max(op.a, op.b));

    const query = (p: number): number | undefined => {
      const node = nodes.get(p);

      if (!node) {
        return undefined;
      }

      if (node.right < l || node.left > r) {
        events.push({ action: "seg_visit", index: p, label: "outside", text: `[${node.left},${node.right}] outside — skip` });
        return undefined;
      }

      if (l <= node.left && node.right <= r) {
        events.push({ action: "seg_visit", index: p, label: "inside", text: `[${node.left},${node.right}] inside — use ${node.value}` });
        return node.value;
      }

      events.push({ action: "seg_visit", index: p, label: "partial", text: `[${node.left},${node.right}] partial — split` });
      const a = query(2 * p);
      const b = query(2 * p + 1);

      if (a === undefined) return b;
      if (b === undefined) return a;
      return combine(kind, a, b);
    };

    const result = query(1);
    events.push({ action: "emphasize_result", text: `${aggregate}[${l}..${r}] = ${result ?? "—"}` });
    return { values, events: capEvents(events) };
  }

  /* point update: index a gets value b */
  const index = op.a;

  if (index < 0 || index >= values.length) {
    return { values, events };
  }

  const path: number[] = [];
  let p = 1;

  for (;;) {
    const node = nodes.get(p);

    if (!node) break;

    path.push(p);
    events.push({ action: "seg_visit", index: p, label: "path", text: `[${node.left},${node.right}] contains ${index}` });

    if (node.left === node.right) break;

    const mid = Math.floor((node.left + node.right) / 2);
    p = index <= mid ? 2 * p : 2 * p + 1;
  }

  events.push({ action: "seg_set", fromIndex: index, value: String(op.b), text: `A[${index}] = ${op.b}` });
  values[index] = op.b;

  for (const ancestor of path.slice(0, -1).reverse()) {
    events.push({ action: "seg_visit", index: ancestor, label: "recompute", text: `recompute node ${ancestor}` });
  }

  return { values, events: capEvents(events) };
}

export function applySegmentEvent(values: number[], event: EngineEvent) {
  if (event.action === "seg_set" && event.fromIndex !== undefined && event.value !== undefined) {
    const next = [...values];
    next[event.fromIndex] = Number(event.value);
    return next;
  }

  return values;
}

function numericValues(values: string[] | undefined, cap: number) {
  return cleanValues(values).filter(isNumeric).slice(0, cap).map(Number);
}

const segmentEngine: StructureEngine = {
  kinds: SEGMENT_KINDS,
  actions: ["seg_visit", "seg_set", "focus_index"],

  normalize(visual) {
    const values = numericValues(visual.values, MAX_SEGMENT_ITEMS);
    return values.length === 0 ? null : { kind: visual.kind, values: values.map(String), operation: visual.operation };
  },

  plan(visual) {
    const start = numericValues(visual.values, MAX_SEGMENT_ITEMS);
    const { values, events } = planSegment(start, visual.kind, parseSegmentOperations(visual)[0]);
    return { events, end: { kind: visual.kind, values: values.map(String) } };
  },
};

/* ========================================
   FENWICK TREE (Binary Indexed Tree)
   1-based. LSOne(i) = i & -i.
   ft[i] = sum of f[i-LSOne(i)+1 .. i].
   prefix(j): j -= LSOne(j) until 0.
   update(i, v): i += LSOne(i) while i <= n.
======================================== */

export const MAX_FENWICK_ITEMS = 12;

export function lsOne(i: number) {
  return i & -i;
}

/* f is 1-based: f[0] unused */
export function buildFenwick(f: number[]) {
  const ft = f.map(() => 0);

  for (let i = 1; i < f.length; i += 1) {
    for (let j = i; j < f.length; j += lsOne(j)) {
      ft[j] += f[i];
    }
  }

  return ft;
}

function parseFenwickOperations(visual: StructureVisual) {
  const text = operationText(visual, ["prefix", "query", "rsq", "sum", "range", "update", "add"]);

  if (!text) {
    return undefined;
  }

  const numbers = numbersIn(text);

  if (/^(update|add)\b/i.test(text)) {
    if (numbers.length < 2) return undefined;

    /* "add 2 at 3" → value 2 at index 3; "update 3 +2" / "update(3, 2)" → index 3, value 2 */
    const addAt = /^add\b.*\b(at|to)\b/i.test(text);
    return {
      type: "update" as const,
      index: addAt ? numbers[1] : numbers[0],
      delta: addAt ? numbers[0] : numbers[1],
    };
  }

  if (numbers.length >= 2) {
    return { type: "range" as const, i: numbers[0], j: numbers[1] };
  }

  if (numbers.length === 1) {
    return { type: "prefix" as const, j: numbers[0] };
  }

  return undefined;
}

function planFenwick(f: number[], op: ReturnType<typeof parseFenwickOperations>) {
  const next = [...f];
  const events: EngineEvent[] = [];
  const n = f.length - 1;
  const ft = buildFenwick(f);

  if (!op) {
    return { f: next, events };
  }

  const prefix = (j: number, label: string) => {
    let sum = 0;

    for (let i = Math.min(j, n); i > 0; i -= lsOne(i)) {
      sum += ft[i];
      events.push({
        action: "fw_visit",
        index: i,
        label,
        text: `ft[${i}] covers [${i - lsOne(i) + 1}..${i}] → ${i} − ${lsOne(i)} = ${i - lsOne(i)}`,
      });
    }

    return sum;
  };

  if (op.type === "prefix") {
    const result = prefix(op.j, "query");
    events.push({ action: "emphasize_result", text: `rsq(${op.j}) = ${result}` });
  } else if (op.type === "range") {
    const i = Math.min(op.i, op.j);
    const j = Math.max(op.i, op.j);
    const right = prefix(j, "query");
    const left = i > 1 ? prefix(i - 1, "subtract") : 0;
    events.push({ action: "emphasize_result", text: `rsq(${i},${j}) = ${right} − ${left} = ${right - left}` });
  } else if (op.index >= 1 && op.index <= n) {
    events.push({ action: "fw_add", index: op.index, value: String(op.delta), text: `f[${op.index}] += ${op.delta}` });
    next[op.index] += op.delta;

    for (let i = op.index; i <= n; i += lsOne(i)) {
      events.push({
        action: "fw_update",
        index: i,
        value: String(op.delta),
        text: `ft[${i}] += ${op.delta} → next ${i} + ${lsOne(i)} = ${i + lsOne(i)}`,
      });
    }
  }

  return { f: next, events: capEvents(events) };
}

/* Renderer state: frequencies and ft deltas applied cell by cell. */
export function applyFenwickEvents(f: number[], events: EngineEvent[]) {
  const freq = [...f];
  const ft = buildFenwick(f);

  for (const event of events) {
    if (event.action === "fw_add" && event.index !== undefined) {
      freq[event.index] += Number(event.value ?? 0);
    } else if (event.action === "fw_update" && event.index !== undefined) {
      ft[event.index] += Number(event.value ?? 0);
    }
  }

  return { freq, ft };
}

/* visual.values are f[1..n]; internally we prepend the unused f[0] */
function fenwickArray(values: string[] | undefined) {
  return [0, ...numericValues(values, MAX_FENWICK_ITEMS)];
}

const fenwickEngine: StructureEngine = {
  kinds: ["fenwick_tree"],
  actions: ["fw_visit", "fw_add", "fw_update", "focus_index"],

  normalize(visual) {
    const f = fenwickArray(visual.values);
    return f.length <= 1 ? null : { kind: "fenwick_tree", values: f.slice(1).map(String), operation: visual.operation };
  },

  plan(visual) {
    const { f, events } = planFenwick(fenwickArray(visual.values), parseFenwickOperations(visual));
    return { events, end: { kind: "fenwick_tree", values: f.slice(1).map(String) } };
  },
};

/* ========================================
   TRIE (R-way, Princeton COS 226 style)
   Characters live on edges/nodes along the path;
   the root holds no character. A key ends at the
   node of its last character, marked end-of-word.
   A search that ends on an unmarked node is a MISS
   ("she" stored only as a prefix of "shells").
======================================== */

export const MAX_TRIE_WORDS = 8;

export function cleanWords(values: string[] | undefined) {
  const words = cleanValues(values)
    .map((value) => value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8))
    .filter(Boolean);

  return [...new Set(words)].slice(0, MAX_TRIE_WORDS);
}

export function applyTrieEvents(words: string[], events: EngineEvent[]) {
  const ended = new Set(words);
  const created = new Set<string>();

  for (const event of events) {
    if (event.action === "trie_create" && event.text) {
      created.add(event.text);
    } else if (event.action === "trie_end" && event.text) {
      ended.add(event.text);
    }
  }

  return { words: [...ended], created: [...created] };
}

function parseTrieOperations(visual: StructureVisual) {
  const text = operationText(visual, ["insert", "add", "search", "find", "startswith", "starts", "prefix"]);
  const match = text.match(/^(insert|add|search|find|startswith|starts\s*with|prefix)\b\W*([a-z]+)/i);

  if (!match) {
    return undefined;
  }

  const verb = match[1].toLowerCase().replace(/\s+/g, "");
  const type = verb === "insert" || verb === "add" ? "insert" : verb === "search" || verb === "find" ? "search" : "prefix";
  return { type: type as "insert" | "search" | "prefix", word: match[2].toLowerCase().slice(0, 8) };
}

function planTrie(words: string[], op: ReturnType<typeof parseTrieOperations>) {
  const events: EngineEvent[] = [];
  const next = [...words];

  if (!op) {
    return { words: next, events };
  }

  const exists = (prefix: string) => next.some((word) => word.startsWith(prefix));

  for (let i = 1; i <= op.word.length; i += 1) {
    const prefix = op.word.slice(0, i);
    const char = op.word[i - 1];

    if (exists(prefix)) {
      events.push({ action: "trie_step", text: prefix, value: char });
      continue;
    }

    if (op.type !== "insert") {
      events.push({ action: "emphasize_result", text: `miss — no '${char}' child under "${prefix.slice(0, -1) || "root"}"` });
      return { words: next, events };
    }

    events.push({ action: "trie_create", text: prefix, value: char });
  }

  if (op.type === "insert") {
    events.push({ action: "trie_end", text: op.word });

    if (!next.includes(op.word)) {
      next.push(op.word);
    }
  } else if (op.type === "search") {
    events.push({
      action: "emphasize_result",
      text: next.includes(op.word) ? `hit — "${op.word}" is marked as a word` : `miss — "${op.word}" is only a prefix`,
    });
  } else {
    events.push({ action: "emphasize_result", text: `prefix "${op.word}" found` });
  }

  return { words: next, events: capEvents(events) };
}

const trieEngine: StructureEngine = {
  kinds: ["trie"],
  actions: ["trie_step", "trie_create", "trie_end", "focus_index"],

  normalize(visual) {
    const words = cleanWords(visual.values);
    return words.length === 0 ? null : { kind: "trie", values: words, operation: visual.operation };
  },

  plan(visual) {
    const { words, events } = planTrie(cleanWords(visual.values), parseTrieOperations(visual));
    return { events, end: { kind: "trie", values: words } };
  },
};

/* ========================================
   GRAPH  (graph = undirected, digraph = directed)
   visual.entries is the ADJACENCY LIST:
     { key: "A", value: "B,C" }  or weighted  { key: "A", value: "B:4,C:1" }
   Undirected lists are made symmetric (each edge
   appears in both endpoints' lists). Neighbors
   are visited in ascending label order.
   BFS: FIFO queue. DFS: recursion stack, vertices
   go explored → visited (done). Kahn: in-degree-0
   queue; order shorter than V ⇒ cycle. Dijkstra:
   min-priority queue, relax dist[u] + w < dist[v].
======================================== */

export const GRAPH_KINDS = ["graph", "digraph"];
export const MAX_GRAPH_VERTICES = 10;

export type GraphEdge = { from: string; to: string; weight?: number };

export type Graph = {
  directed: boolean;
  vertices: string[];
  adjacency: Map<string, Array<{ to: string; weight?: number }>>;
  weighted: boolean;
};

function sortLabels(labels: string[]) {
  return [...labels].sort(compareKeys);
}

export function parseGraph(visual: StructureVisual): Graph | null {
  const directed = visual.kind === "digraph";
  const adjacency = new Map<string, Array<{ to: string; weight?: number }>>();
  let weighted = false;

  const addVertex = (label: string) => {
    if (!adjacency.has(label) && adjacency.size < MAX_GRAPH_VERTICES) {
      adjacency.set(label, []);
    }

    return adjacency.has(label);
  };

  const addEdge = (from: string, to: string, weight?: number) => {
    if (from === to || !addVertex(from) || !addVertex(to)) {
      return;
    }

    const list = adjacency.get(from)!;

    if (!list.some((edge) => edge.to === to)) {
      list.push({ to, weight });
    }
  };

  for (const entry of visual.entries ?? []) {
    const from = String(entry.key).trim().slice(0, 3);

    if (!from) {
      continue;
    }

    addVertex(from);

    /* tolerate "[B, C]", "['B','C']", "{B, C}" */
    for (const token of String(entry.value).replace(/[\[\]{}'"]/g, " ").split(/[,;\s]+/)) {
      const match = token.trim().match(/^([A-Za-z0-9]{1,3})(?:[:=(](-?\d+(?:\.\d+)?)\)?)?$/);

      if (!match) {
        continue;
      }

      const weight = match[2] !== undefined ? Number(match[2]) : undefined;
      weighted ||= weight !== undefined;
      addEdge(from, match[1], weight);

      if (!directed) {
        addEdge(match[1], from, weight);
      }
    }
  }

  if (adjacency.size === 0) {
    return null;
  }

  for (const list of adjacency.values()) {
    list.sort((a, b) => compareKeys(a.to, b.to));
  }

  return { directed, vertices: sortLabels([...adjacency.keys()]), adjacency, weighted };
}

/*
  Read edges written in the QUESTION itself:
    edges = [[0,1],[1,2]]   edges = [(0, 1), (1, 2)]   A-B, B->C, A→D
  Returns adjacency entries, or undefined if none found.
*/
export function extractProblemEdges(text: string) {
  const pairs: Array<[string, string, string?]> = [];

  for (const match of text.matchAll(/[[(]\s*['"]?([A-Za-z0-9]{1,3})['"]?\s*,\s*['"]?([A-Za-z0-9]{1,3})['"]?\s*(?:,\s*(-?\d+)\s*)?[\])]/g)) {
    pairs.push([match[1], match[2], match[3]]);
  }

  if (pairs.length < 2) {
    pairs.length = 0;

    for (const match of text.matchAll(/\b([A-Z0-9]{1,2})\s*(?:-|->|→|—|–)\s*([A-Z0-9]{1,2})\b/g)) {
      pairs.push([match[1], match[2]]);
    }
  }

  if (pairs.length < 2) {
    return undefined;
  }

  const lists = new Map<string, string[]>();

  for (const [from, to, weight] of pairs.slice(0, 14)) {
    lists.set(from, [...(lists.get(from) ?? []), weight !== undefined ? `${to}:${weight}` : to]);

    if (!lists.has(to)) {
      lists.set(to, []);
    }
  }

  return [...lists.entries()].map(([key, neighbors]) => ({ key, value: neighbors.join(","), active: false }));
}

export function graphEdges(graph: Graph): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const from of graph.vertices) {
    for (const edge of graph.adjacency.get(from) ?? []) {
      if (graph.directed || compareKeys(from, edge.to) < 0) {
        edges.push({ from, to: edge.to, weight: edge.weight });
      }
    }
  }

  return edges;
}

function serializeGraph(graph: Graph) {
  return graph.vertices.map((vertex) => ({
    key: vertex,
    value: (graph.adjacency.get(vertex) ?? [])
      .map((edge) => (graph.weighted && edge.weight !== undefined ? `${edge.to}:${edge.weight}` : edge.to))
      .join(","),
    active: false,
  }));
}

type GraphOp =
  | { type: "bfs" | "dfs" | "dijkstra"; source: string }
  | { type: "topo" }
  | { type: "build" }
  | { type: "neighbors"; source: string };

function parseGraphOperation(visual: StructureVisual, graph: Graph): GraphOp | undefined {
  const text = operationText(visual, [
    "bfs", "dfs", "breadth", "depth", "topological", "topo", "kahn", "dijkstra", "shortest",
    "build", "construct", "add", "neighbors", "neighbours", "adjacent", "list",
  ]);

  if (!text) {
    return undefined;
  }

  /* representation: build the adjacency list edge by edge */
  if (/^(build|construct|add\s+edges|list\s+edges)/i.test(text)) {
    return { type: "build" };
  }

  /* representation: read one vertex's neighbor list */
  if (/^(neighbou?rs|adjacent|list\s+neighbou?rs)/i.test(text)) {
    const named = text.match(/\b(?:of|for)\s+([A-Za-z0-9]{1,3})\b/i)?.[1] ?? text.match(/\(\s*([A-Za-z0-9]{1,3})\s*\)/)?.[1];
    return { type: "neighbors", source: named && graph.adjacency.has(named) ? named : graph.vertices[0] };
  }

  if (/^(topological|topo|kahn)/i.test(text)) {
    return { type: "topo" };
  }

  const type = /^(dfs|depth)/i.test(text) ? "dfs" : /^(dijkstra|shortest)/i.test(text) ? "dijkstra" : "bfs";
  const named = text.match(/\bfrom\s+([A-Za-z0-9]{1,3})\b/i)?.[1] ?? text.match(/\(\s*([A-Za-z0-9]{1,3})\s*\)/)?.[1];
  const source = named && graph.adjacency.has(named) ? named : graph.vertices[0];
  return { type, source };
}

function planGraph(graph: Graph, op: GraphOp | undefined) {
  const events: EngineEvent[] = [];

  if (!op) {
    return events;
  }

  if (op.type === "build") {
    for (const edge of graphEdges(graph)) {
      events.push({
        action: "graph_add_edge",
        from: edge.from,
        to: edge.to,
        value: edge.weight !== undefined ? String(edge.weight) : undefined,
        text: graph.directed
          ? `edge ${edge.from}→${edge.to}: append ${edge.to} to list[${edge.from}]`
          : `edge ${edge.from}–${edge.to}: append to BOTH list[${edge.from}] and list[${edge.to}]`,
      });
    }

    const total = graphEdges(graph).length;
    events.push({
      action: "emphasize_result",
      text: `${graph.vertices.length} lists, ${graph.directed ? total : 2 * total} entries → O(V + E) space`,
    });
    return capEvents(events);
  }

  if (op.type === "neighbors") {
    const list = graph.adjacency.get(op.source) ?? [];
    events.push({ action: "graph_visit", key: op.source, text: `look up list[${op.source}]` });

    for (const edge of list) {
      events.push({ action: "graph_edge", from: op.source, to: edge.to, label: "tree", text: `${op.source} → ${edge.to}` });
    }

    events.push({
      action: "emphasize_result",
      text: `neighbors(${op.source}) = ${list.map((edge) => edge.to).join(", ") || "none"} — O(degree)`,
    });
    return capEvents(events);
  }

  const neighbors = (vertex: string) => graph.adjacency.get(vertex) ?? [];

  if (op.type === "bfs") {
    const queue = [op.source];
    const discovered = new Set([op.source]);
    events.push({ action: "graph_frontier", key: op.source, text: queue.join(" ") });

    while (queue.length > 0) {
      const vertex = queue.shift()!;
      events.push({ action: "graph_visit", key: vertex, text: queue.join(" ") });

      for (const edge of neighbors(vertex)) {
        if (!discovered.has(edge.to)) {
          discovered.add(edge.to);
          queue.push(edge.to);
          events.push({ action: "graph_edge", from: vertex, to: edge.to, label: "tree", text: queue.join(" ") });
        }
      }
    }
  } else if (op.type === "dfs") {
    const seen = new Set<string>();
    const stack: string[] = [];

    const visit = (vertex: string) => {
      seen.add(vertex);
      stack.push(vertex);
      events.push({ action: "graph_visit", key: vertex, text: stack.join(" ") });

      for (const edge of neighbors(vertex)) {
        if (!seen.has(edge.to)) {
          events.push({ action: "graph_edge", from: vertex, to: edge.to, label: "tree", text: stack.join(" ") });
          visit(edge.to);
        }
      }

      stack.pop();
      events.push({ action: "graph_done", key: vertex, text: stack.join(" ") });
    };

    visit(op.source);
  } else if (op.type === "topo") {
    const indegree = new Map(graph.vertices.map((vertex) => [vertex, 0]));

    for (const edge of graphEdges(graph)) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }

    const queue = graph.vertices.filter((vertex) => indegree.get(vertex) === 0);
    const order: string[] = [];
    events.push({ action: "graph_frontier", text: queue.join(" ") });

    while (queue.length > 0) {
      const vertex = queue.shift()!;
      order.push(vertex);
      events.push({ action: "graph_visit", key: vertex, text: queue.join(" ") });

      for (const edge of neighbors(vertex)) {
        const remaining = (indegree.get(edge.to) ?? 1) - 1;
        indegree.set(edge.to, remaining);

        if (remaining === 0) {
          queue.push(edge.to);
        }

        events.push({ action: "graph_edge", from: vertex, to: edge.to, label: "removed", text: queue.join(" ") });
      }
    }

    events.push({
      action: "emphasize_result",
      text: order.length < graph.vertices.length ? "cycle — no topological order exists" : `order: ${order.join(" → ")}`,
    });
  } else {
    const dist = new Map<string, number>([[op.source, 0]]);
    const done = new Set<string>();
    const pq = () =>
      [...dist.entries()]
        .filter(([vertex]) => !done.has(vertex))
        .sort((a, b) => a[1] - b[1] || compareKeys(a[0], b[0]))
        .map(([vertex, d]) => `(${d},${vertex})`)
        .join(" ");

    events.push({ action: "graph_dist", key: op.source, value: "0", text: pq() });

    for (;;) {
      const next = [...dist.entries()]
        .filter(([vertex]) => !done.has(vertex))
        .sort((a, b) => a[1] - b[1] || compareKeys(a[0], b[0]))[0];

      if (!next) break;

      const [vertex, d] = next;
      done.add(vertex);
      events.push({ action: "graph_visit", key: vertex, text: pq() });

      for (const edge of neighbors(vertex)) {
        const candidate = d + (edge.weight ?? 1);

        if (!done.has(edge.to) && candidate < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, candidate);
          events.push({ action: "graph_edge", from: vertex, to: edge.to, label: "relax", value: String(candidate), text: pq() });
        }
      }
    }
  }

  return capEvents(events);
}

export type GraphRenderState = {
  /* build mode: edges added so far, in order */
  addedEdges: Array<{ from: string; to: string }>;
  order: string[];
  done: Set<string>;
  treeEdges: Map<string, string>; /* child → parent */
  removedEdges: Set<string>; /* "from>to" */
  dist: Map<string, string>;
  frontier?: string;
  current?: string;
  lastEdge?: { from: string; to: string };
};

export function edgeId(from: string, to: string) {
  return `${from}>${to}`;
}

export function applyGraphEvents(events: EngineEvent[]): GraphRenderState {
  const state: GraphRenderState = {
    addedEdges: [],
    order: [],
    done: new Set(),
    treeEdges: new Map(),
    removedEdges: new Set(),
    dist: new Map(),
  };

  for (const event of events) {
    if (event.text !== undefined && event.action.startsWith("graph_")) {
      state.frontier = event.text;
    }

    if (event.action === "graph_add_edge" && event.from && event.to) {
      state.addedEdges.push({ from: event.from, to: event.to });
      state.lastEdge = { from: event.from, to: event.to };
    } else if (event.action === "graph_visit" && event.key) {
      if (!state.order.includes(event.key)) state.order.push(event.key);
      state.current = event.key;
    } else if (event.action === "graph_done" && event.key) {
      state.done.add(event.key);
    } else if (event.action === "graph_dist" && event.key && event.value !== undefined) {
      state.dist.set(event.key, event.value);
    } else if (event.action === "graph_edge" && event.from && event.to) {
      state.lastEdge = { from: event.from, to: event.to };

      if (event.label === "removed") {
        state.removedEdges.add(edgeId(event.from, event.to));
      } else {
        state.treeEdges.set(event.to, event.from);
      }

      if (event.label === "relax" && event.value !== undefined) {
        state.dist.set(event.to, event.value);
      }
    }
  }

  return state;
}

const graphEngine: StructureEngine = {
  kinds: GRAPH_KINDS,
  actions: ["graph_frontier", "graph_visit", "graph_edge", "graph_done", "graph_dist", "graph_add_edge", "focus_index"],

  normalize(visual) {
    const graph = parseGraph(visual);
    return graph ? { kind: visual.kind, entries: serializeGraph(graph), operation: visual.operation } : null;
  },

  plan(visual) {
    const graph = parseGraph(visual);

    if (!graph) {
      return { events: [], end: visual };
    }

    return {
      events: planGraph(graph, parseGraphOperation(visual, graph)),
      end: { kind: visual.kind, entries: serializeGraph(graph) },
    };
  },
};

/* ========================================
   LINKED LIST (singly / doubly)
   values = node values head → tail.
   Insert at i: walk pre to i-1, new.next = aft,
   pre.next = new. Remove at i: pre.next = del.next.
   Reverse (iterative): each step sets
   curr.next = prev, then prev = curr, curr = next.
======================================== */

export const LINKED_LIST_KINDS = ["linked_list", "doubly_linked_list"];
export const MAX_LIST_NODES = 8;

type ListOp =
  | { type: "insert"; index: number | "head" | "tail"; value: string }
  | { type: "remove"; index: number | "head" | "tail" }
  | { type: "delete"; value: string }
  | { type: "reverse" };

function parseListOperations(visual: StructureVisual): ListOp[] {
  const text = operationText(visual, ["insert", "add", "append", "prepend", "push", "remove", "delete", "pop", "reverse"]);

  if (!text) {
    return [];
  }

  if (/^reverse/i.test(text)) {
    return [{ type: "reverse" }];
  }

  const insert = text.match(/^(insert|add|append|prepend|push)\w*\s+(-?\w+)(?:\s+(?:at|to)\s+(head|tail|front|back|index\s+\d+|\d+))?/i);

  if (insert) {
    const verb = insert[1].toLowerCase();
    const where = insert[3]?.toLowerCase();
    const index: number | "head" | "tail" =
      verb === "prepend" || where === "head" || where === "front"
        ? "head"
        : verb === "append" || where === "tail" || where === "back" || !where
          ? "tail"
          : Number(where.replace(/\D/g, ""));
    return [{ type: "insert", index, value: insert[2] }];
  }

  /* "remove 5" = by value; "remove at 2" / "remove index 2" = by position */
  const removeAt = text.match(/^(remove|delete|pop)\w*\s*(?:at\s+)?(head|tail|front|back|(?:index\s+)?\d+)?/i);
  const removeValue = text.match(/^(remove|delete)\s+(?:value\s+)?(-?\w+)$/i);

  if (removeValue && !/^(head|tail|front|back|at)$/i.test(removeValue[2])) {
    return [{ type: "delete", value: removeValue[2] }];
  }

  if (removeAt) {
    const where = removeAt[2]?.toLowerCase();
    const index: number | "head" | "tail" =
      !where || where === "head" || where === "front" ? "head" : where === "tail" || where === "back" ? "tail" : Number(where.replace(/\D/g, ""));
    return [{ type: "remove", index }];
  }

  return [];
}

export type ListNode = { id: string; value: string };
export type ListEdge = "fwd" | "cut" | "back";

export type ListRenderState = {
  nodes: ListNode[];
  edges: ListEdge[]; /* edges[i] sits between nodes[i] and nodes[i+1] */
  pointers: Map<string, number>;
  removed?: string;
  inserted?: string;
};

export function applyListEvents(values: string[], events: EngineEvent[]): ListRenderState {
  const state: ListRenderState = {
    nodes: values.map((value, index) => ({ id: `n${index}`, value })),
    edges: values.slice(1).map(() => "fwd" as ListEdge),
    pointers: new Map(),
  };
  let created = 0;

  for (const event of events) {
    if (event.action === "move_pointer" && event.label && event.toIndex !== undefined) {
      state.pointers.set(event.label, event.toIndex);
    } else if (event.action === "ll_insert" && event.index !== undefined && event.value !== undefined) {
      created += 1;
      const node = { id: `new${created}`, value: event.value };
      const index = Math.max(0, Math.min(event.index, state.nodes.length));
      state.nodes.splice(index, 0, node);
      state.edges = state.nodes.slice(1).map(() => "fwd");
      state.inserted = node.id;
      state.pointers.delete("pre");
    } else if (event.action === "ll_remove" && event.index !== undefined && state.nodes[event.index]) {
      state.removed = state.nodes[event.index].value;
      state.nodes.splice(event.index, 1);
      state.edges = state.nodes.slice(1).map(() => "fwd");
      state.pointers.delete("pre");
    } else if (event.action === "ll_reverse_step" && event.index !== undefined) {
      const k = event.index;

      if (k >= 1) state.edges[k - 1] = "back";
      if (k < state.edges.length) state.edges[k] = "cut";

      state.pointers.set("prev", k);

      if (k + 1 < state.nodes.length) {
        state.pointers.set("curr", k + 1);
      } else {
        state.pointers.delete("curr");
      }
    } else if (event.action === "ll_reverse_done") {
      state.pointers.clear();
      state.pointers.set("head", state.nodes.length - 1);
    }
  }

  return state;
}

function planList(start: string[], ops: ListOp[]) {
  let values = [...start];
  const events: EngineEvent[] = [];

  for (const op of ops) {
    if (op.type === "reverse") {
      events.push({ action: "move_pointer", label: "curr", toIndex: 0, text: "prev = null, curr = head" });

      for (let k = 0; k < values.length; k += 1) {
        events.push({
          action: "ll_reverse_step",
          index: k,
          text: k === 0 ? `${values[0]}.next = null` : `${values[k]}.next = ${values[k - 1]}`,
        });
      }

      events.push({ action: "ll_reverse_done", text: "prev is the new head" });
      values = [...values].reverse();
      continue;
    }

    if (op.type === "insert") {
      if (values.length >= MAX_LIST_NODES) continue;

      const index = op.index === "head" ? 0 : op.index === "tail" ? values.length : Math.max(0, Math.min(op.index, values.length));

      if (index > 0) {
        events.push({ action: "move_pointer", label: "pre", toIndex: index - 1, text: `walk pre to index ${index - 1}` });
      }

      events.push({
        action: "ll_insert",
        index,
        value: op.value,
        text: index === 0 ? `new.next = head; head = new` : `new.next = pre.next; pre.next = new`,
      });
      values.splice(index, 0, op.value);
      continue;
    }

    const index =
      op.type === "delete"
        ? values.indexOf(op.value)
        : op.index === "head"
          ? 0
          : op.index === "tail"
            ? values.length - 1
            : op.index;

    if (index < 0 || index >= values.length) {
      events.push({ action: "emphasize_result", text: "nothing to remove" });
      continue;
    }

    if (index > 0) {
      events.push({ action: "move_pointer", label: "pre", toIndex: index - 1, text: `walk pre to index ${index - 1}` });
    }

    events.push({
      action: "ll_remove",
      index,
      value: values[index],
      text: index === 0 ? "head = head.next" : "pre.next = pre.next.next",
    });
    values.splice(index, 1);
  }

  return { values, events: capEvents(events) };
}

const linkedListEngine: StructureEngine = {
  kinds: LINKED_LIST_KINDS,
  actions: ["move_pointer", "focus_index", "ll_insert", "ll_remove", "ll_reverse_step", "ll_reverse_done"],

  normalize(visual) {
    const values = cleanValues(visual.values).slice(0, MAX_LIST_NODES);

    if (values.length === 0) {
      return null;
    }

    const pointers = (visual.pointers ?? []).filter((pointer) => pointer.index >= 0 && pointer.index < values.length);
    return { kind: visual.kind, values, pointers, operation: visual.operation };
  },

  plan(visual) {
    const ops = parseListOperations(visual);
    const { values, events } = planList(visual.values ?? [], ops);
    return { events, end: { kind: visual.kind, values } };
  },
};

/* ========================================
   QUEUE / DEQUE
   values = front → back.
   Queue: enqueue at back, dequeue from front (FIFO).
   Deque: push/pop at both ends, never the middle.
======================================== */

export const QUEUE_KINDS = ["queue", "deque"];
export const MAX_QUEUE_ITEMS = 10;

function parseQueueOperations(visual: StructureVisual) {
  const text = operationText(visual, [
    "enqueue", "offer", "push_back", "push_front", "pushback", "pushfront", "append", "appendleft",
    "add", "push", "dequeue", "poll", "pop_front", "pop_back", "popfront", "popback", "popleft", "pop",
  ]);
  const ops: Array<{ action: string; value?: string }> = [];

  /* "push back 4", "push_back(4)", "pushBack 4", "appendleft 2", "dequeue" */
  const stopWords = new Set(["back", "front", "then", "and", "left", "right", "the"]);

  for (const match of text.matchAll(/\b(enqueue|offer|push[_\s]?back|push[_\s]?front|appendleft|append|add|push|dequeue|poll|pop[_\s]?front|pop[_\s]?back|popleft|pop)\b\s*\(?\s*(-?\w+)?/gi)) {
    const verb = match[1].toLowerCase().replace(/[_\s]/g, "");
    const rawValue = match[2] && !stopWords.has(match[2].toLowerCase()) ? match[2] : undefined;
    const isDeque = visual.kind === "deque";
    let action: string;

    if (verb === "pushfront" || verb === "appendleft") action = "deque_push_front";
    else if (verb === "popfront" || verb === "popleft" || verb === "dequeue" || verb === "poll") action = isDeque ? "deque_pop_front" : "queue_dequeue";
    else if (verb === "popback" || verb === "pop") action = isDeque ? "deque_pop_back" : "queue_dequeue";
    else action = isDeque ? "deque_push_back" : "queue_enqueue";

    const needsValue = action.includes("push") || action === "queue_enqueue";

    if (needsValue && !rawValue) continue;

    ops.push({ action, value: needsValue ? rawValue : undefined });

    if (ops.length >= 3) break;
  }

  return ops;
}

export function applyQueueEvent(items: string[], event: EngineEvent) {
  const next = [...items];

  if ((event.action === "queue_enqueue" || event.action === "deque_push_back") && event.value !== undefined) {
    next.push(event.value);
  } else if (event.action === "deque_push_front" && event.value !== undefined) {
    next.unshift(event.value);
  } else if (event.action === "queue_dequeue" || event.action === "deque_pop_front") {
    next.shift();
  } else if (event.action === "deque_pop_back") {
    next.pop();
  }

  return next;
}

/*
  Monotonic deque, the classic deque interview pattern
  (sliding window maximum). visual.values is the INPUT
  array; the deque holds candidates in decreasing order:
    - pop back while the back is smaller than the new value
    - push the new value at the back
    - pop front when it has left the window
    - the front is the window maximum
*/
export function parseDequeWindow(visual: StructureVisual) {
  if (visual.kind !== "deque") {
    return undefined;
  }

  const label = visual.operation?.trim() ?? "";

  if (!/(window\s*max|max(imum)?\s+(of|in)\s+(each|every)\s+window|sliding\s+window|monotonic)/i.test(label)) {
    return undefined;
  }

  const k = Number(label.match(/\bk\s*=\s*(\d+)/i)?.[1] ?? label.match(/(\d+)/)?.[1] ?? 3);
  return { k: Math.max(1, Math.min(k, 6)) };
}

function planDequeWindow(input: string[], k: number) {
  const events: EngineEvent[] = [];
  const indices: number[] = [];
  const values = input.slice(0, 10);

  for (let i = 0; i < values.length; i += 1) {
    if (indices.length > 0 && indices[0] <= i - k) {
      const out = indices.shift()!;
      events.push({ action: "deque_pop_front", value: values[out], index: i, text: `${values[out]} left the window` });
    }

    while (indices.length > 0 && compareKeys(values[indices[indices.length - 1]], values[i]) < 0) {
      const smaller = indices.pop()!;
      events.push({ action: "deque_pop_back", value: values[smaller], index: i, text: `${values[smaller]} < ${values[i]} — can never be the max` });
    }

    indices.push(i);
    events.push({ action: "deque_push_back", value: values[i], index: i, text: `push ${values[i]}` });

    if (i >= k - 1) {
      events.push({
        action: "dq_window",
        index: i,
        value: values[indices[0]],
        text: `window [${i - k + 1}..${i}] max = ${values[indices[0]]}`,
      });
    }
  }

  return capEvents(events);
}

const queueEngine: StructureEngine = {
  kinds: QUEUE_KINDS,
  actions: ["queue_enqueue", "queue_dequeue", "deque_push_front", "deque_push_back", "deque_pop_front", "deque_pop_back", "dq_window", "focus_index"],

  normalize(visual) {
    return { kind: visual.kind, values: cleanValues(visual.values).slice(0, MAX_QUEUE_ITEMS), operation: visual.operation };
  },

  plan(visual) {
    const window = parseDequeWindow(visual);

    if (window) {
      return {
        events: planDequeWindow(visual.values ?? [], window.k),
        end: { kind: visual.kind, values: visual.values ?? [] },
      };
    }

    let items = [...(visual.values ?? [])];
    const events: EngineEvent[] = [];

    for (const op of parseQueueOperations(visual)) {
      const isPop = op.action.includes("pop") || op.action === "queue_dequeue";

      if (isPop && items.length === 0) continue;

      /* a pop always removes the REAL front/back, whatever the model said */
      const value = isPop ? (op.action === "deque_pop_back" ? items[items.length - 1] : items[0]) : op.value;
      const event = { action: op.action, value };
      events.push(event);
      items = applyQueueEvent(items, event);
    }

    return { events, end: { kind: visual.kind, values: items } };
  },

  /* the Director's own push/pop beats, made legal */
  replay(visual, beats) {
    let items = [...(visual.values ?? [])];
    const allowed = visual.kind === "deque"
      ? ["deque_push_front", "deque_push_back", "deque_pop_front", "deque_pop_back"]
      : ["queue_enqueue", "queue_dequeue"];
    const events: EngineEvent[] = [];

    for (const beat of beats) {
      if (!allowed.includes(beat.action)) continue;

      const isPop = beat.action.includes("pop") || beat.action === "queue_dequeue";

      if (isPop && items.length === 0) continue;
      if (!isPop && (!beat.value || items.length >= MAX_QUEUE_ITEMS)) continue;

      const value = isPop ? (beat.action === "deque_pop_back" ? items[items.length - 1] : items[0]) : beat.value;
      const event = { ...beat, value };
      events.push(event);
      items = applyQueueEvent(items, event);
    }

    return events.slice(0, 8);
  },
};

/* ========================================
   HASH MAP / HASH SET (scan patterns)
   values = the problem's INPUT array; the table is
   built while scanning it:
   - complement (two sum): need = target − x; lookup
     need; hit → answer, miss → store x → index
   - count: map[x] += 1
   - duplicate (set): x already in set → found; else add
======================================== */

export const HASH_KINDS = ["hash_map", "hash_set"];
export const MAX_HASH_INPUT = 8;

type HashOp =
  | { type: "complement"; target: number }
  | { type: "count" }
  | { type: "duplicate" }
  | { type: "direct"; steps: Array<{ verb: "insert" | "lookup"; key: string; value?: string }> };

export function parseHashOperation(visual: StructureVisual): HashOp | undefined {
  const label = visual.operation?.trim() ?? "";

  if (!label || /\bO\s*\(/.test(label)) {
    return undefined;
  }

  if (/^(two\s*sum|find\s+(a\s+)?pair|complement|check\s+(the\s+)?complement|pair\s+sum)/i.test(label)) {
    const target = label.match(/(?:target|sum(?:s)?\s+(?:to|of)|=)\s*(-?\d+)/i)?.[1] ?? label.match(/(-?\d+)/)?.[1];
    return target !== undefined ? { type: "complement", target: Number(target) } : undefined;
  }

  if (/^(count|frequenc|tally)/i.test(label)) {
    return { type: "count" };
  }

  if (/^((detect|find|check|contains)\s+(a\s+)?duplicate|duplicate|seen|first\s+repeat)/i.test(label)) {
    return { type: "duplicate" };
  }

  const steps: Array<{ verb: "insert" | "lookup"; key: string; value?: string }> = [];

  for (const match of label.matchAll(/\b(insert|put|add|set|lookup|get|contains|check|find)\b\s*\(?\s*([\w-]+)(?:\s*[:=,]\s*([\w-]+))?/gi)) {
    const verb = /^(insert|put|add|set)$/i.test(match[1]) ? "insert" : "lookup";
    steps.push({ verb, key: match[2], value: match[3] });

    if (steps.length >= 3) break;
  }

  /* direct steps need real keys, not prose ("check whether …") */
  const prose = /^(whether|if|the|a|an|for|is|that|current|target|each|every|it|its|all)$/i;
  const realSteps = steps.length > 0 && steps.every((step) => !prose.test(step.key) && step.key.length <= 12);

  return realSteps && label.length <= 40 && /^(insert|put|add|set|lookup|get|contains|check|find)\b/i.test(label)
    ? { type: "direct", steps }
    : undefined;
}

function planHash(visual: StructureVisual, op: HashOp | undefined) {
  const input = (visual.values ?? []).slice(0, MAX_HASH_INPUT);
  const isSet = visual.kind === "hash_set";
  const table = new Map<string, string>((visual.entries ?? []).map((entry) => [entry.key, entry.value]));
  const events: EngineEvent[] = [];

  if (!op) {
    return { events, table };
  }

  if (op.type === "direct") {
    for (const step of op.steps) {
      if (step.verb === "insert") {
        const value = isSet ? "" : step.value ?? "1";
        table.set(step.key, value);
        events.push({ action: "hm_insert", key: step.key, value, text: isSet ? `add ${step.key}` : `${step.key} → ${value}` });
      } else {
        const hit = table.has(step.key);
        events.push({ action: "hm_lookup", key: step.key, label: hit ? "hit" : "miss", text: hit ? `${step.key} found` : `${step.key} not found` });
      }
    }

    return { events, table };
  }

  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];

    if (op.type === "complement") {
      const need = String(op.target - Number(x));
      events.push({ action: "hm_scan", index: i, text: `x = ${x}, need ${op.target} − ${x} = ${need}` });

      if (table.has(need)) {
        events.push({ action: "hm_lookup", key: need, label: "hit", text: `${need} is stored at index ${table.get(need)}` });
        events.push({ action: "emphasize_result", text: `answer: [${table.get(need)}, ${i}]` });
        break;
      }

      events.push({ action: "hm_lookup", key: need, label: "miss", text: `${need} not seen yet` });
      table.set(x, String(i));
      events.push({ action: "hm_insert", key: x, value: String(i), text: `store ${x} → ${i}` });
      continue;
    }

    if (op.type === "count") {
      const next = String(Number(table.get(x) ?? "0") + 1);
      events.push({ action: "hm_scan", index: i, text: `x = ${x}` });
      table.set(x, next);
      events.push({ action: "hm_insert", key: x, value: next, text: `count[${x}] = ${next}` });
      continue;
    }

    /* duplicate */
    events.push({ action: "hm_scan", index: i, text: `x = ${x}` });

    if (table.has(x)) {
      events.push({ action: "hm_lookup", key: x, label: "hit", text: `${x} already seen` });
      events.push({ action: "emphasize_result", text: `duplicate: ${x}` });
      break;
    }

    events.push({ action: "hm_lookup", key: x, label: "miss", text: `${x} is new` });
    table.set(x, "");
    events.push({ action: "hm_insert", key: x, value: "", text: `add ${x}` });
  }

  if (op.type === "count") {
    events.push({ action: "emphasize_result", text: `${table.size} distinct keys counted in one pass` });
  } else if (!events.some((event) => event.action === "emphasize_result")) {
    events.push({ action: "emphasize_result", text: op.type === "complement" ? "no pair found" : "no duplicates" });
  }

  return { events: capEvents(events), table };
}

export function applyHashEvents(visual: StructureVisual, events: EngineEvent[]) {
  const table = new Map<string, string>((visual.entries ?? []).map((entry) => [entry.key, entry.value]));
  let current: number | undefined;
  let lookup: { key: string; hit: boolean } | undefined;
  let inserted: string | undefined;

  for (const event of events) {
    if (event.action === "hm_scan") {
      current = event.index;
      lookup = undefined;
      inserted = undefined;
    } else if (event.action === "hm_lookup" && event.key !== undefined) {
      lookup = { key: event.key, hit: event.label === "hit" };
    } else if (event.action === "hm_insert" && event.key !== undefined) {
      table.set(event.key, event.value ?? "");
      inserted = event.key;
    }
  }

  return { table, current, lookup, inserted };
}

const hashEngine: StructureEngine = {
  kinds: HASH_KINDS,
  actions: ["hm_scan", "hm_lookup", "hm_insert", "focus_index"],

  normalize(visual) {
    const values = cleanValues(visual.values).slice(0, MAX_HASH_INPUT);
    const entries = (visual.entries ?? []).slice(0, 10);

    if (values.length === 0 && entries.length === 0) {
      return null;
    }

    return { kind: visual.kind, values, entries, operation: visual.operation };
  },

  plan(visual) {
    const { events, table } = planHash(visual, parseHashOperation(visual));

    return {
      events,
      end: {
        kind: visual.kind,
        values: visual.values,
        entries: [...table.entries()].map(([key, value]) => ({ key, value, active: false })),
      },
    };
  },
};

/* ========================================
   REGISTRY
======================================== */

const ENGINES: StructureEngine[] = [
  heapEngine,
  bstEngine,
  unionFindEngine,
  segmentEngine,
  fenwickEngine,
  trieEngine,
  graphEngine,
  linkedListEngine,
  queueEngine,
  hashEngine,
];

export const ENGINE_KINDS = new Set(ENGINES.flatMap((engine) => engine.kinds));

export function getEngineForKind(kind: string | undefined) {
  return kind ? ENGINES.find((engine) => engine.kinds.includes(kind)) : undefined;
}

export function isEngineKind(kind: string | undefined) {
  return kind !== undefined && ENGINE_KINDS.has(kind);
}

/* convenient for level-order layouts in the renderer */
export function treeLevel(index: number) {
  return levelOf(index);
}
