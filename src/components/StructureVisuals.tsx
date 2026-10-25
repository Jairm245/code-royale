/*
  Structure visuals for every engine-backed reference pack.

  Each view folds the SAME engine events the director planned
  (convex/structureEngines.ts), so what is drawn always matches the
  algorithm: a heap swap only ever happens between a parent and child,
  a BST insert only lands at the empty slot the search reached, etc.

  Visual language follows the reference style: near-black canvas, thin
  white geometry, blue = active/traversal, orange = change, green =
  success, dim = finished/skipped.
*/

import type { ReactNode } from "react";

import {
  applyBstEvent,
  applyFenwickEvents,
  applyGraphEvents,
  applyHashEvents,
  applyHeapEvents,
  applyListEvents,
  applyQueueEvent,
  applySegmentEvent,
  applyTrieEvents,
  applyUnionFindEvent,
  buildSegmentTree,
  cleanWords,
  edgeId,
  graphEdges,
  heapOrderOf,
  heapParent,
  lsOne,
  parseGraph,
  parseDequeWindow,
  parseParents,
  segmentAggregate,
  type EngineEvent,
  type StructureVisual,
} from "../../convex/structureEngines";

import "./StructureVisuals.css";

type Beat = EngineEvent;

/* ========================================
   SHARED PIECES
======================================== */

const CANVAS_WIDTH = 760;
const NODE_RADIUS = 19;

type CanvasNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  sub?: string;
  state?: string;
  ring?: boolean;
  ghost?: boolean;
};

type CanvasEdge = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  state?: string;
  directed?: boolean;
  label?: string;
};

function lastBeat(beats: Beat[], actions: string[]) {
  for (let i = beats.length - 1; i >= 0; i -= 1) {
    if (actions.includes(beats[i].action)) {
      return beats[i];
    }
  }

  return undefined;
}

function shorten(
  from: { x: number; y: number },
  to: { x: number; y: number },
  by: number
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x1: from.x + (dx / length) * by,
    y1: from.y + (dy / length) * by,
    x2: to.x - (dx / length) * by,
    y2: to.y - (dy / length) * by,
  };
}

/*
  SVG canvas in fixed units so circles stay round and arrowheads are not
  distorted. Nodes are positioned with CSS transforms, so when a node's
  position changes (heap swap, union-find re-parent) it glides.
*/
function NodeCanvas({
  nodes,
  edges,
  height,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  height: number;
}) {
  return (
    <svg
      className="sv-canvas"
      viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <defs>
        <marker id="sv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="sv-arrowhead" />
        </marker>
        <marker id="sv-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="sv-arrowhead-active" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const line = shorten(edge.from, edge.to, edge.directed ? NODE_RADIUS + 2 : NODE_RADIUS);
        const active = edge.state === "tree" || edge.state === "active" || edge.state === "swap";

        return (
          <g key={edge.id} className={`sv-edge ${edge.state ? `sv-edge-${edge.state}` : ""}`}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              markerEnd={edge.directed ? (active ? "url(#sv-arrow-active)" : "url(#sv-arrow)") : undefined}
            />
            {edge.label && (() => {
              /* offset the weight perpendicular to the edge so it never sits on a node label */
              const dx = edge.to.x - edge.from.x;
              const dy = edge.to.y - edge.from.y;
              const length = Math.hypot(dx, dy) || 1;
              const nx = (-dy / length) * 11;
              const ny = (dx / length) * 11;
              return (
                <text
                  x={(edge.from.x + edge.to.x) / 2 + (ny > 0 ? -nx : nx)}
                  y={(edge.from.y + edge.to.y) / 2 + (ny > 0 ? -ny : ny) + 4}
                  className="sv-edge-label"
                >
                  {edge.label}
                </text>
              );
            })()}
          </g>
        );
      })}

      {nodes.map((node) => (
        <g
          key={node.id}
          className={`sv-node ${node.state ? `sv-${node.state}` : ""} ${node.ghost ? "sv-ghost" : ""}`}
          style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
        >
          {node.ring && <circle r={NODE_RADIUS + 4} className="sv-ring" />}
          <circle r={NODE_RADIUS} />
          <text className="sv-node-label" dy="0.35em">
            {node.label}
          </text>
          {node.sub && (
            <text className="sv-node-sub" y={NODE_RADIUS + 14}>
              {node.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* level-order slot i → position (complete-tree layout) */
function slotPosition(index: number, top = 30, gap = 62) {
  const level = Math.floor(Math.log2(index + 1));
  const first = 2 ** level - 1;
  const count = 2 ** level;

  return {
    x: ((index - first + 0.5) / count) * CANVAS_WIDTH,
    y: top + level * gap,
  };
}

function Header({ title, invariant }: { title: string; invariant?: string }) {
  return (
    <div className="sv-header">
      <span className="ref-structure-label">{title}</span>
      {invariant && <span className="sv-invariant">{invariant}</span>}
    </div>
  );
}

function Footer({
  operation,
  step,
  result,
}: {
  operation?: string;
  step?: string;
  result?: string;
}) {
  return (
    <div className="sv-footer">
      {operation && <span className="sv-operation">{operation}</span>}
      {step && <span className="sv-step">{step}</span>}
      {result && <span className="sv-result">{result}</span>}
    </div>
  );
}

function ArrayRow({
  cells,
  indexLabels,
  caption,
}: {
  cells: Array<{ key: string; value: string; state?: string }>;
  indexLabels?: string[];
  caption?: string;
}) {
  return (
    <div className="sv-array">
      {caption && <span className="sv-array-caption">{caption}</span>}
      <div className="sv-array-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, cells.length)}, var(--sv-cell, 46px))` }}>
        {indexLabels &&
          indexLabels.map((label, index) => (
            <span key={`i-${index}`} className="sv-index">
              {label}
            </span>
          ))}
        {cells.map((cell) => (
          <div key={cell.key} className={`sv-cell ${cell.state ? `sv-${cell.state}` : ""}`}>
            {cell.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function stepText(beats: Beat[]) {
  return [...beats].reverse().find((beat) => beat.text && beat.action !== "emphasize_result")?.text;
}

function resultText(beats: Beat[]) {
  return lastBeat(beats, ["emphasize_result"])?.text;
}

/* ========================================
   HEAP — TREE VIEW and ARRAY VIEW
======================================== */

function useHeapState(values: string[], beats: Beat[]) {
  const { nodes, trackedId, popped } = applyHeapEvents(values, beats);
  const last = lastBeat(beats, ["heap_insert", "heap_compare", "heap_swap", "heap_pop", "heap_settle", "focus_index"]);

  const pair =
    (last?.action === "heap_compare" || last?.action === "heap_swap") &&
    last.fromIndex !== undefined &&
    last.toIndex !== undefined
      ? [last.fromIndex, last.toIndex]
      : [];

  const settled = last?.action === "heap_settle";
  const focusIndex = last?.action === "focus_index" ? last.index : undefined;

  const stateOf = (id: string, index: number) => {
    if (settled && (id === trackedId || (!trackedId && index === last?.index))) return "success";
    if (pair.includes(index)) return last?.action === "heap_swap" ? "swap" : "compare";
    if (id === trackedId || index === focusIndex) return "active";
    return undefined;
  };

  return { nodes, popped, pair, last, stateOf, trackedId };
}

function HeapTreeView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const isMin = heapOrderOf(visual.kind) === "min";
  const { nodes, popped, pair, last, stateOf } = useHeapState(visual.values ?? [], beats);
  const ghost = nodes.length < 15 ? nodes.length : undefined;
  const slots = ghost !== undefined ? nodes.length + 1 : nodes.length;
  const levels = Math.floor(Math.log2(Math.max(1, slots))) + 1;

  const canvasNodes: CanvasNode[] = nodes.map((node, index) => ({
    id: node.id,
    ...slotPosition(index),
    label: node.value,
    state: stateOf(node.id, index),
  }));

  if (ghost !== undefined) {
    canvasNodes.push({ id: "ghost", ...slotPosition(ghost), label: "", ghost: true });
  }

  const edges: CanvasEdge[] = [];

  for (let child = 1; child < slots; child += 1) {
    const parent = heapParent(child);
    const inPair = pair.includes(child) && pair.includes(parent);

    edges.push({
      id: `e${child}`,
      from: slotPosition(parent),
      to: slotPosition(child),
      state: child === ghost ? "ghost" : inPair ? (last?.action === "heap_swap" ? "swap" : "active") : undefined,
    });
  }

  return (
    <div className="sv-scene">
      <Header title={isMin ? "min-heap" : "max-heap"} invariant={`parent ${isMin ? "≤" : "≥"} children`} />
      <NodeCanvas nodes={canvasNodes} edges={edges} height={30 + levels * 62} />
      <ArrayRow
        indexLabels={nodes.map((_, index) => String(index))}
        cells={nodes.map((node, index) => ({ key: `c${index}`, value: node.value, state: stateOf(node.id, index) }))}
      />
      <Footer
        operation={visual.operation}
        step={popped !== undefined ? `popped ${popped}` : undefined}
        result={resultText(beats)}
      />
    </div>
  );
}

const ARRAY_CELL = 52;

function childrenText(index: number, size: number) {
  const kids = [2 * index + 1, 2 * index + 2].filter((child) => child < size);
  return kids.length === 0 ? `leaf (2·${index}+1 = ${2 * index + 1} ≥ n)` : `children ${kids.join(", ")}`;
}

function HeapArrayView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const isMin = heapOrderOf(visual.kind) === "min";
  const { nodes, popped, pair, last, stateOf, trackedId } = useHeapState(visual.values ?? [], beats);
  const width = Math.max(1, nodes.length) * ARRAY_CELL;

  /* the index the arcs and the formula describe */
  const trackedIndex = nodes.findIndex((node) => node.id === trackedId);
  const focus =
    pair.length === 2
      ? Math.max(pair[0], pair[1])
      : last?.action === "focus_index" && last.index !== undefined
        ? last.index
        : trackedIndex >= 0
          ? trackedIndex
          : undefined;

  const arcs: Array<{ from: number; to: number; state?: string }> = [];

  if (focus !== undefined) {
    if (focus > 0) {
      const parent = heapParent(focus);
      const inPair = pair.includes(focus) && pair.includes(parent);
      arcs.push({ from: parent, to: focus, state: inPair ? (last?.action === "heap_swap" ? "swap" : "active") : "active" });
    }

    for (const child of [2 * focus + 1, 2 * focus + 2]) {
      if (child < nodes.length) {
        const inPair = pair.includes(child) && pair.includes(focus);
        arcs.push({ from: focus, to: child, state: inPair ? (last?.action === "heap_swap" ? "swap" : "active") : "faint" });
      }
    }
  }

  const levels: Array<{ level: number; start: number; end: number }> = [];

  for (let level = 0; 2 ** level - 1 < nodes.length; level += 1) {
    levels.push({ level, start: 2 ** level - 1, end: Math.min(2 ** (level + 1) - 2, nodes.length - 1) });
  }

  const centerX = (index: number) => index * ARRAY_CELL + ARRAY_CELL / 2;

  const formula =
    focus === undefined
      ? "parent(i) = (i − 1) // 2   ·   children 2i + 1, 2i + 2"
      : focus === 0
        ? `i = 0 is the root   ·   ${childrenText(0, nodes.length)}`
        : `i = ${focus} → parent (${focus} − 1) // 2 = ${heapParent(focus)}   ·   ${childrenText(focus, nodes.length)}`;

  return (
    <div className="sv-scene">
      <Header title={`${isMin ? "min" : "max"}-heap · array`} invariant={`A[parent(i)] ${isMin ? "≤" : "≥"} A[i]`} />

      <div className="sv-scroll">
      <div className="sv-heap-array" style={{ width }}>
        <svg className="sv-arcs" viewBox={`0 0 ${width} 70`} width={width} height={70}>
          {arcs.map((arc) => {
            const x1 = centerX(arc.from);
            const x2 = centerX(arc.to);
            const lift = Math.min(64, 18 + Math.abs(x2 - x1) * 0.28);

            return (
              <path
                key={`${arc.from}-${arc.to}`}
                className={`sv-arc sv-arc-${arc.state ?? "faint"}`}
                d={`M ${x1} 68 Q ${(x1 + x2) / 2} ${68 - lift * 2} ${x2} 68`}
              />
            );
          })}
        </svg>

        <div className="sv-heap-cells" style={{ height: 46 }}>
          {nodes.map((node, index) => (
            <div
              key={node.id}
              className={`sv-cell sv-floating ${stateOf(node.id, index) ? `sv-${stateOf(node.id, index)}` : ""}`}
              style={{ transform: `translateX(${index * ARRAY_CELL}px)`, width: ARRAY_CELL - 6 }}
            >
              {node.value}
            </div>
          ))}
        </div>

        <div className="sv-heap-indices">
          {nodes.map((_, index) => (
            <span key={index} style={{ left: index * ARRAY_CELL, width: ARRAY_CELL - 6 }}>
              {index}
            </span>
          ))}
        </div>

        <div className="sv-levels">
          {levels.map((level) => (
            <span
              key={level.level}
              style={{ left: level.start * ARRAY_CELL, width: (level.end - level.start + 1) * ARRAY_CELL - 6 }}
            >
              level {level.level}
            </span>
          ))}
        </div>
      </div>
      </div>

      <div className="sv-formula">{formula}</div>

      <Footer
        operation={visual.operation}
        step={popped !== undefined ? `popped ${popped}` : last?.text}
        result={resultText(beats)}
      />
    </div>
  );
}

/* ========================================
   BINARY SEARCH TREE
======================================== */

function BstView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  let values = [...(visual.values ?? [])];

  for (const beat of beats) {
    values = applyBstEvent(values, beat);
  }

  const path = beats.filter((beat) => beat.action === "bst_visit").map((beat) => beat.index);
  const last = lastBeat(beats, ["bst_visit", "bst_insert", "bst_remove", "bst_replace", "bst_promote", "bst_found"]);
  const filled = values.map((value, index) => ({ value, index })).filter((slot) => slot.value && slot.value !== "null");
  const depth = Math.floor(Math.log2(Math.max(1, ...filled.map((slot) => slot.index + 1)))) + 1;

  const stateOf = (index: number) => {
    if (last?.action === "bst_found" && last.index === index) return "success";
    if (last?.action === "bst_insert" && last.index === index) return "new";
    if (last?.action === "bst_replace" && last.index === index) return "swap";
    if (last?.index === index) return "active";
    if (path.includes(index)) return "path";
    return undefined;
  };

  const nodes: CanvasNode[] = filled.map((slot) => ({
    id: `b${slot.index}`,
    ...slotPosition(slot.index),
    label: slot.value,
    state: stateOf(slot.index),
  }));

  const edges: CanvasEdge[] = filled
    .filter((slot) => slot.index > 0)
    .map((slot) => {
      const parent = Math.floor((slot.index - 1) / 2);
      return {
        id: `e${slot.index}`,
        from: slotPosition(parent),
        to: slotPosition(slot.index),
        state: path.includes(parent) && (path.includes(slot.index) || last?.index === slot.index) ? "active" : undefined,
      };
    });

  return (
    <div className="sv-scene">
      <Header title="binary search tree" invariant="left < node < right" />
      <NodeCanvas nodes={nodes} edges={edges} height={30 + depth * 62} />
      <Footer operation={visual.operation} step={stepText(beats)} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   UNION-FIND (forest + parent array)
======================================== */

function forestLayout(parents: number[]) {
  const children = parents.map(() => [] as number[]);
  const roots: number[] = [];

  parents.forEach((parent, node) => {
    if (parent === node) roots.push(node);
    else children[parent].push(node);
  });

  const leaves = (node: number): number =>
    children[node].length === 0 ? 1 : children[node].reduce((sum, child) => sum + leaves(child), 0);

  const total = roots.reduce((sum, root) => sum + leaves(root), 0);
  const unit = CANVAS_WIDTH / Math.max(1, total);
  const positions = new Map<number, { x: number; y: number }>();
  let maxDepth = 0;

  const place = (node: number, start: number, depth: number) => {
    maxDepth = Math.max(maxDepth, depth);
    const width = leaves(node);
    positions.set(node, { x: (start + width / 2) * unit, y: 30 + depth * 62 });
    let offset = start;

    for (const child of children[node]) {
      place(child, offset, depth + 1);
      offset += leaves(child);
    }
  };

  let offset = 0;

  for (const root of roots) {
    place(root, offset, 0);
    offset += leaves(root);
  }

  return { positions, height: 30 + (maxDepth + 1) * 62 };
}

function UnionFindView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  let parents = parseParents(visual.values);

  for (const beat of beats) {
    parents = applyUnionFindEvent(parents, beat);
  }

  const { positions, height } = forestLayout(parents);
  const path = beats.filter((beat) => beat.action === "uf_visit").map((beat) => beat.index);
  const roots = beats.filter((beat) => beat.action === "uf_root").map((beat) => beat.index);
  const last = lastBeat(beats, ["uf_visit", "uf_root", "uf_link"]);

  const stateOf = (node: number) => {
    if (last?.action === "uf_link" && last.fromIndex === node) return "swap";
    if (last?.index === node) return last.action === "uf_root" ? "success" : "active";
    if (roots.includes(node)) return "success";
    if (path.includes(node)) return "path";
    return undefined;
  };

  const nodes: CanvasNode[] = parents.map((_, node) => ({
    id: `u${node}`,
    ...(positions.get(node) ?? { x: 0, y: 0 }),
    label: String(node),
    state: stateOf(node),
  }));

  const edges: CanvasEdge[] = parents
    .map((parent, node) => ({ parent, node }))
    .filter((item) => item.parent !== item.node)
    .map((item) => ({
      id: `e${item.node}`,
      from: positions.get(item.parent)!,
      to: positions.get(item.node)!,
      state: last?.action === "uf_link" && last.fromIndex === item.node ? "swap" : undefined,
    }));

  return (
    <div className="sv-scene">
      <Header title="union-find forest" invariant="root: p[i] = i" />
      <NodeCanvas nodes={nodes} edges={edges} height={height} />
      <ArrayRow
        caption="p"
        indexLabels={parents.map((_, index) => String(index))}
        cells={parents.map((parent, index) => ({ key: `p${index}`, value: String(parent), state: stateOf(index) }))}
      />
      <Footer operation={visual.operation} step={stepText(beats)} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   SEGMENT TREE
======================================== */

function SegmentTreeView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  let values = (visual.values ?? []).map(Number);

  for (const beat of beats) {
    values = applySegmentEvent(values, beat);
  }

  const tree = buildSegmentTree(values, visual.kind);
  const visits = new Map<number, string>();

  for (const beat of beats) {
    if (beat.action === "seg_visit" && beat.index !== undefined) {
      visits.set(beat.index, beat.label ?? "path");
    }
  }

  const last = lastBeat(beats, ["seg_visit", "seg_set"]);
  const labelState: Record<string, string> = {
    inside: "success",
    partial: "compare",
    outside: "dim",
    path: "path",
    recompute: "swap",
  };

  const nodes: CanvasNode[] = [...tree.values()].map((node) => {
    const visit = visits.get(node.p);
    return {
      id: `s${node.p}`,
      ...slotPosition(node.p - 1, 30, 70),
      label: String(node.value),
      sub: node.left === node.right ? `${node.left}` : `[${node.left},${node.right}]`,
      state: last?.action === "seg_visit" && last.index === node.p ? "active" : visit ? labelState[visit] : undefined,
    };
  });

  const edges: CanvasEdge[] = [...tree.values()]
    .filter((node) => node.p > 1)
    .map((node) => ({
      id: `e${node.p}`,
      from: slotPosition(Math.floor(node.p / 2) - 1, 30, 70),
      to: slotPosition(node.p - 1, 30, 70),
    }));

  const depth = Math.floor(Math.log2(Math.max(1, ...[...tree.keys()]))) + 1;
  const setIndex = beats.find((beat) => beat.action === "seg_set")?.fromIndex;

  return (
    <div className="sv-scene">
      <Header title={`segment tree · ${segmentAggregate(visual.kind)}`} invariant="node = combine(left, right)" />
      <NodeCanvas nodes={nodes} edges={edges} height={44 + depth * 70} />
      <ArrayRow
        caption="A"
        indexLabels={values.map((_, index) => String(index))}
        cells={values.map((value, index) => ({ key: `a${index}`, value: String(value), state: index === setIndex ? "swap" : undefined }))}
      />
      <div className="sv-legend">
        <span className="sv-legend-success">inside — use whole node</span>
        <span className="sv-legend-compare">partial — split</span>
        <span className="sv-legend-dim">outside — skip</span>
      </div>
      <Footer operation={visual.operation} step={stepText(beats)} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   FENWICK TREE
======================================== */

function FenwickView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const f = [0, ...(visual.values ?? []).map(Number)];
  const n = f.length - 1;
  const { freq, ft } = applyFenwickEvents(f, beats);
  const visited = new Map<number, string>();

  for (const beat of beats) {
    if ((beat.action === "fw_visit" || beat.action === "fw_update") && beat.index !== undefined) {
      visited.set(beat.index, beat.action === "fw_update" ? "swap" : beat.label === "subtract" ? "compare" : "success");
    }
  }

  const last = lastBeat(beats, ["fw_visit", "fw_update", "fw_add"]);
  const addIndex = beats.find((beat) => beat.action === "fw_add")?.index;
  const indices = Array.from({ length: n }, (_, k) => k + 1);
  const maxLevel = Math.max(0, ...indices.map((i) => Math.log2(lsOne(i))));

  const stateOf = (i: number) => (last?.index === i && last.action !== "fw_add" ? "active" : visited.get(i));

  return (
    <div className="sv-scene">
      <Header title="fenwick tree · 1-based" invariant="ft[i] = sum f[i − LSOne(i) + 1 .. i]" />

      <div className="sv-fenwick" style={{ gridTemplateColumns: `56px repeat(${n}, var(--sv-cell, 46px))` }}>
        {Array.from({ length: maxLevel + 1 }, (_, row) => {
          const level = maxLevel - row;
          return [
            <span key={`lbl-${level}`} className="sv-fenwick-label" style={{ gridRow: row + 1, gridColumn: 1 }}>
              {row === 0 ? "ranges" : ""}
            </span>,
            ...indices
              .filter((i) => Math.log2(lsOne(i)) === level)
              .map((i) => (
                <div
                  key={`bar-${i}`}
                  className={`sv-range ${stateOf(i) ? `sv-${stateOf(i)}` : ""}`}
                  style={{ gridColumn: `${i - lsOne(i) + 2} / ${i + 2}`, gridRow: row + 1 }}
                >
                  ft[{i}]
                </div>
              )),
          ];
        })}

        <span className="sv-fenwick-label" style={{ gridRow: maxLevel + 2, gridColumn: 1 }}>
          ft
        </span>
        {indices.map((i) => (
          <div key={`ft-${i}`} className={`sv-cell ${stateOf(i) ? `sv-${stateOf(i)}` : ""}`} style={{ gridRow: maxLevel + 2, gridColumn: i + 1 }}>
            {ft[i]}
          </div>
        ))}

        <span className="sv-fenwick-label" style={{ gridRow: maxLevel + 3, gridColumn: 1 }}>
          f
        </span>
        {indices.map((i) => (
          <div key={`f-${i}`} className={`sv-cell sv-cell-soft ${i === addIndex ? "sv-swap" : ""}`} style={{ gridRow: maxLevel + 3, gridColumn: i + 1 }}>
            {freq[i]}
          </div>
        ))}

        <span className="sv-fenwick-label" style={{ gridRow: maxLevel + 4, gridColumn: 1 }}>
          i
        </span>
        {indices.map((i) => (
          <span key={`idx-${i}`} className="sv-index sv-index-binary" style={{ gridRow: maxLevel + 4, gridColumn: i + 1 }}>
            {i}
            <small>{i.toString(2)}</small>
          </span>
        ))}
      </div>

      <Footer operation={visual.operation} step={stepText(beats)} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   TRIE
======================================== */

function TrieView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const { words, created } = applyTrieEvents(cleanWords(visual.values), beats);
  const prefixes = new Set<string>([""]);

  for (const word of [...words, ...created]) {
    for (let i = 1; i <= word.length; i += 1) {
      prefixes.add(word.slice(0, i));
    }
  }

  const children = (prefix: string) =>
    [...prefixes].filter((p) => p.length === prefix.length + 1 && p.startsWith(prefix)).sort();

  const leaves = (prefix: string): number => {
    const kids = children(prefix);
    return kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + leaves(kid), 0);
  };

  const total = leaves("");
  const unit = CANVAS_WIDTH / Math.max(1, total);
  const positions = new Map<string, { x: number; y: number }>();
  const maxDepth = Math.max(0, ...[...prefixes].map((p) => p.length));
  const gap = Math.min(52, 220 / Math.max(1, maxDepth));

  const place = (prefix: string, start: number) => {
    positions.set(prefix, { x: (start + leaves(prefix) / 2) * unit, y: 26 + prefix.length * gap });
    let offset = start;

    for (const kid of children(prefix)) {
      place(kid, offset);
      offset += leaves(kid);
    }
  };

  place("", 0);

  const path = beats.filter((beat) => beat.action === "trie_step" || beat.action === "trie_create").map((beat) => beat.text ?? "");
  const createdSet = new Set(created);
  const last = lastBeat(beats, ["trie_step", "trie_create", "trie_end"]);
  const ends = new Set(words);

  const nodes: CanvasNode[] = [...prefixes].map((prefix) => ({
    id: `t-${prefix || "root"}`,
    ...positions.get(prefix)!,
    label: prefix === "" ? "·" : prefix[prefix.length - 1],
    ring: ends.has(prefix),
    state:
      last?.text === prefix
        ? last.action === "trie_end"
          ? "success"
          : "active"
        : createdSet.has(prefix)
          ? "new"
          : path.includes(prefix)
            ? "path"
            : undefined,
  }));

  const edges: CanvasEdge[] = [...prefixes]
    .filter((prefix) => prefix !== "")
    .map((prefix) => ({
      id: `e-${prefix}`,
      from: positions.get(prefix.slice(0, -1))!,
      to: positions.get(prefix)!,
      state: path.includes(prefix) ? "active" : undefined,
    }));

  return (
    <div className="sv-scene">
      <Header title="trie" invariant="◎ = end of word" />
      <NodeCanvas nodes={nodes} edges={edges} height={52 + maxDepth * gap} />
      <Footer operation={visual.operation} step={last?.text ? `"${last.text}"` : undefined} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   GRAPH (BFS / DFS / Kahn / Dijkstra)
======================================== */

/*
  Layout:
  - DAG (directed, acyclic) → left-to-right layers by longest path, so every
    edge points right (the topological picture).
  - Any graph with a traversal source → left-to-right BFS layers from the
    source, which is exactly the "distance rings" BFS/Dijkstra explore.
  - Otherwise → circle.
  Within a layer, vertices are ordered by the average position of their
  neighbors in the previous layer (barycenter) to reduce crossings.
*/
function graphLayout(
  vertices: string[],
  edges: Array<{ from: string; to: string }>,
  directed: boolean,
  source: string | undefined
) {
  const height = 250;
  const positions = new Map<string, { x: number; y: number }>();
  let layerOf: Map<string, number> | undefined;

  if (directed) {
    const depth = new Map(vertices.map((vertex) => [vertex, 0]));
    let changed = true;

    for (let round = 0; changed && round <= vertices.length; round += 1) {
      changed = false;

      for (const edge of edges) {
        if ((depth.get(edge.to) ?? 0) < (depth.get(edge.from) ?? 0) + 1) {
          depth.set(edge.to, (depth.get(edge.from) ?? 0) + 1);
          changed = true;
        }
      }
    }

    if (!changed) {
      layerOf = depth;
    }
  }

  if (!layerOf && source && vertices.includes(source)) {
    const neighbors = new Map(vertices.map((vertex) => [vertex, [] as string[]]));

    for (const edge of edges) {
      neighbors.get(edge.from)?.push(edge.to);
      if (!directed) neighbors.get(edge.to)?.push(edge.from);
    }

    const distance = new Map([[source, 0]]);
    const queue = [source];

    while (queue.length > 0) {
      const vertex = queue.shift()!;

      for (const next of neighbors.get(vertex) ?? []) {
        if (!distance.has(next)) {
          distance.set(next, (distance.get(vertex) ?? 0) + 1);
          queue.push(next);
        }
      }
    }

    const unreachable = Math.max(...distance.values()) + 1;
    layerOf = new Map(vertices.map((vertex) => [vertex, distance.get(vertex) ?? unreachable]));
  }

  if (layerOf) {
    const layers = new Map<number, string[]>();

    for (const vertex of vertices) {
      const layer = layerOf.get(vertex) ?? 0;
      layers.set(layer, [...(layers.get(layer) ?? []), vertex]);
    }

    const layerIds = [...layers.keys()].sort((a, b) => a - b);
    const rank = new Map<string, number>();

    for (const layer of layerIds) {
      const members = layers.get(layer)!;
      const score = (vertex: string) => {
        const linked = edges
          .filter((edge) => edge.to === vertex || (!directed && edge.from === vertex))
          .map((edge) => rank.get(edge.to === vertex ? edge.from : edge.to))
          .filter((value): value is number => value !== undefined);
        return linked.length ? linked.reduce((a, b) => a + b, 0) / linked.length : 0.5;
      };

      members.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
      members.forEach((vertex, index) => rank.set(vertex, (index + 0.5) / members.length));
    }

    layerIds.forEach((layer, column) => {
      for (const vertex of layers.get(layer)!) {
        positions.set(vertex, {
          x: ((column + 0.5) / layerIds.length) * CANVAS_WIDTH,
          y: rank.get(vertex)! * (height - 30) + 10,
        });
      }
    });

    return { positions, height };
  }

  vertices.forEach((vertex, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / vertices.length;
    positions.set(vertex, {
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * 200,
      y: height / 2 + Math.sin(angle) * 100,
    });
  });

  return { positions, height };
}

function GraphView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const graph = parseGraph(visual);

  if (!graph) {
    return null;
  }

  const op = (visual.operation ?? "").toLowerCase();
  const mode = op.startsWith("dfs") || op.startsWith("depth")
    ? "dfs"
    : op.startsWith("topo") || op.startsWith("kahn")
      ? "topo"
      : op.startsWith("dijkstra") || op.startsWith("shortest")
        ? "dijkstra"
        : op.startsWith("bfs") || op.startsWith("breadth")
          ? "bfs"
          : /^(build|construct|add\s+edges|list\s+edges)/.test(op)
            ? "build"
            : /^(neighbou?rs|adjacent|list\s+neighbou?rs)/.test(op)
              ? "neighbors"
              : "none";

  const edges = graphEdges(graph);
  const source =
    (visual.operation ?? "").match(/\bfrom\s+([A-Za-z0-9]{1,3})\b/i)?.[1] ??
    (mode === "none" || mode === "topo" ? undefined : graph.vertices[0]);
  const { positions, height } = graphLayout(graph.vertices, edges, graph.directed, source);
  const state = applyGraphEvents(beats);
  const finalBeat = beats[beats.length - 1];
  const lastEdgeLive = finalBeat?.action === "graph_edge" || finalBeat?.action === "graph_add_edge";

  const indegree = new Map(graph.vertices.map((vertex) => [vertex, 0]));

  for (const edge of edges) {
    if (!state.removedEdges.has(edgeId(edge.from, edge.to))) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }
  }

  const isTreeEdge = (from: string, to: string) =>
    state.treeEdges.get(to) === from || (!graph.directed && state.treeEdges.get(from) === to);

  const nodes: CanvasNode[] = graph.vertices.map((vertex) => ({
    id: `g-${vertex}`,
    ...positions.get(vertex)!,
    label: vertex,
    sub:
      mode === "dijkstra"
        ? state.dist.get(vertex) ?? "∞"
        : mode === "topo"
          ? `in ${indegree.get(vertex)}`
          : undefined,
    state:
      state.current === vertex && !state.done.has(vertex)
        ? "active"
        : state.done.has(vertex)
          ? "dim"
          : state.order.includes(vertex)
            ? "success"
            : state.frontier?.split(/\s+/).some((token) => token.replace(/[()\d,]/g, "") === vertex || token === vertex)
              ? "path"
              : undefined,
  }));

  /* build mode: only edges added so far exist */
  const added = new Set(state.addedEdges.map((edge) => edgeId(edge.from, edge.to)));
  const visibleEdges = mode === "build" ? edges.filter((edge) => added.has(edgeId(edge.from, edge.to))) : edges;

  const canvasEdges: CanvasEdge[] = visibleEdges.map((edge) => {
    const removed = state.removedEdges.has(edgeId(edge.from, edge.to));
    const isLast =
      lastEdgeLive &&
      ((state.lastEdge?.from === edge.from && state.lastEdge?.to === edge.to) ||
        (!graph.directed && state.lastEdge?.from === edge.to && state.lastEdge?.to === edge.from));

    return {
      id: `e-${edge.from}-${edge.to}`,
      from: positions.get(edge.from)!,
      to: positions.get(edge.to)!,
      directed: graph.directed,
      label: graph.weighted && edge.weight !== undefined ? String(edge.weight) : undefined,
      state: removed ? "removed" : isLast ? "swap" : isTreeEdge(edge.from, edge.to) ? "tree" : undefined,
    };
  });

  /* adjacency list panel (representation modes): built from the edges shown */
  const showAdjacency = mode === "build" || mode === "neighbors" || mode === "none";
  const adjacencyRows = graph.vertices.map((vertex) => {
    const neighbors: string[] = [];

    for (const edge of visibleEdges) {
      if (edge.from === vertex) neighbors.push(edge.weight !== undefined ? `${edge.to}:${edge.weight}` : edge.to);
      else if (!graph.directed && edge.to === vertex) neighbors.push(edge.weight !== undefined ? `${edge.from}:${edge.weight}` : edge.from);
    }

    return { vertex, neighbors };
  });
  const lastAdded = mode === "build" ? state.addedEdges[state.addedEdges.length - 1] : undefined;
  const isFreshEntry = (vertex: string, neighbor: string) =>
    lastAdded !== undefined &&
    lastEdgeLive &&
    ((lastAdded.from === vertex && neighbor.split(":")[0] === lastAdded.to) ||
      (!graph.directed && lastAdded.to === vertex && neighbor.split(":")[0] === lastAdded.from));
  const focusVertex = mode === "neighbors" ? state.current : undefined;

  const frontierName =
    mode === "dfs" ? "stack" : mode === "dijkstra" ? "min-heap (dist, v)" : mode === "topo" ? "queue (in-degree 0)" : "queue";

  return (
    <div className="sv-scene">
      <Header
        title={graph.directed ? "directed graph" : "graph"}
        invariant={mode === "topo" ? "u → v ⇒ u before v" : mode === "dijkstra" ? "pop the smallest distance" : graph.directed ? "adjacency list (out-edges)" : "adjacency list"}
      />
      <NodeCanvas nodes={nodes} edges={canvasEdges} height={height} />

      {showAdjacency && (
        <div className="sv-adjacency">
          <span className="ref-structure-label">adjacency list</span>
          {adjacencyRows.map((row) => (
            <div key={row.vertex} className={`sv-adjacency-row ${row.vertex === focusVertex ? "sv-adjacency-focus" : ""}`}>
              <span className="sv-adjacency-key">{row.vertex}</span>
              <span className="sv-adjacency-arrow">→</span>
              <div className="sv-chips">
                {row.neighbors.map((neighbor) => (
                  <span key={neighbor} className={isFreshEntry(row.vertex, neighbor) ? "sv-chip-new" : row.vertex === focusVertex ? "sv-chip-hit" : ""}>
                    {neighbor}
                  </span>
                ))}
                {row.neighbors.length === 0 && <em>[ ]</em>}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode !== "none" && mode !== "build" && mode !== "neighbors" && (
        <div className="sv-panels">
          <div>
            <span className="ref-structure-label">{frontierName}</span>
            <div className="sv-chips">
              {(state.frontier ?? "").split(/\s+/).filter(Boolean).map((item, index) => (
                <span key={`${item}-${index}`} className={index === 0 && mode !== "dfs" ? "sv-chip-front" : ""}>
                  {item}
                </span>
              ))}
              {!state.frontier && <em>empty</em>}
            </div>
          </div>
          <div>
            <span className="ref-structure-label">{mode === "topo" ? "order" : "visited"}</span>
            <div className="sv-chips">
              {state.order.map((vertex) => (
                <span key={vertex}>{vertex}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer operation={visual.operation} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   LINKED LIST
======================================== */

function LinkedListView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const values = visual.values ?? [];
  const state = applyListEvents(values, beats);
  const doubly = visual.kind === "doubly_linked_list";
  const reverseSteps = beats.filter((beat) => beat.action === "ll_reverse_step").length;
  const reversalDone = beats.some((beat) => beat.action === "ll_reverse_done");

  const pointers = new Map<string, number>();

  for (const pointer of visual.pointers ?? []) {
    pointers.set(pointer.label, pointer.index);
  }

  if (reverseSteps > 0 || reversalDone) {
    pointers.clear();
  }

  for (const [label, index] of state.pointers) {
    pointers.set(label, index);
  }

  if (!pointers.size && !reverseSteps) {
    pointers.set("head", 0);
  }

  const labelsAt = (index: number) => [...pointers.entries()].filter(([, at]) => at === index).map(([label]) => label);
  const last = lastBeat(beats, ["ll_insert", "ll_remove", "ll_reverse_step", "move_pointer"]);

  return (
    <div className="sv-scene">
      <Header title={doubly ? "doubly linked list" : "linked list"} invariant={doubly ? "prev ← node → next" : "node → next"} />

      <div className="sv-list">
        {reverseSteps > 0 && (
          <>
            <span className="sv-null">null</span>
            <span className="sv-link sv-link-back">←</span>
          </>
        )}

        {state.nodes.map((node, index) => {
          const edge = state.edges[index];
          const active = pointers.get("curr") === index || pointers.get("pre") === index;

          return (
            <div key={node.id} className="sv-list-item">
              <div className="sv-list-node-wrap">
                <div
                  className={`sv-list-node ${node.id === state.inserted ? "sv-new" : ""} ${active ? "sv-active" : ""} ${pointers.get("prev") === index ? "sv-path" : ""}`}
                >
                  {node.value}
                </div>
                <div className="sv-list-pointers">
                  {labelsAt(index).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>

              {edge && (
                <span
                  className={`sv-link sv-link-${edge} ${last?.action === "ll_reverse_step" && (last.index === index || last.index === index + 1) ? "sv-link-active" : ""}`}
                >
                  {edge === "back" ? "←" : edge === "cut" ? "╳" : doubly ? "⇄" : "→"}
                </span>
              )}
            </div>
          );
        })}

        {reverseSteps < state.nodes.length && (
          <>
            <span className="sv-link">→</span>
            <span className="sv-null">null</span>
          </>
        )}
      </div>

      <Footer
        operation={visual.operation}
        step={state.removed ? `removed ${state.removed}` : last?.text}
        result={resultText(beats)}
      />
    </div>
  );
}

/* ========================================
   QUEUE / DEQUE
======================================== */

function QueueView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const window = parseDequeWindow(visual);
  const input = visual.values ?? [];

  /* window-max mode: values are the INPUT; the deque starts empty */
  let items = window ? [] : [...input];

  for (const beat of beats) {
    items = applyQueueEvent(items, beat);
  }

  const last = lastBeat(beats, ["queue_enqueue", "queue_dequeue", "deque_push_front", "deque_push_back", "deque_pop_front", "deque_pop_back"]);
  const isDeque = visual.kind === "deque";
  const entered =
    last?.action === "queue_enqueue" || last?.action === "deque_push_back"
      ? items.length - 1
      : last?.action === "deque_push_front"
        ? 0
        : undefined;
  const left = last && (last.action.includes("pop") || last.action === "queue_dequeue") ? last.value : undefined;
  const lastIndexed = lastBeat(beats, ["deque_push_back", "deque_pop_back", "deque_pop_front", "dq_window"]);
  const current = lastIndexed?.index;
  const answers = beats.filter((beat) => beat.action === "dq_window").map((beat) => beat.value ?? "");
  const step = lastBeat(beats, ["deque_push_back", "deque_pop_back", "deque_pop_front", "dq_window"])?.text;

  return (
    <div className="sv-scene">
      <Header
        title={isDeque ? (window ? `monotonic deque · window k = ${window.k}` : "deque") : "queue"}
        invariant={window ? "decreasing front → back · front = window max" : isDeque ? "push / pop at both ends" : "FIFO: in at back, out at front"}
      />

      {window && (
        <ArrayRow
          caption="nums"
          indexLabels={input.map((_, index) => String(index))}
          cells={input.map((value, index) => ({
            key: `in${index}`,
            value,
            state:
              index === current
                ? "active"
                : current !== undefined && index <= current && index > current - window.k
                  ? "path"
                  : current !== undefined && index < current
                    ? "dim"
                    : undefined,
          }))}
        />
      )}

      <div className="sv-queue">
        <span className="sv-queue-end">front</span>
        <div className="sv-queue-row">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className={`sv-cell ${index === entered ? "sv-new" : index === 0 ? (window ? "sv-success" : "sv-active") : ""}`}
            >
              {item}
            </div>
          ))}
          {items.length === 0 && <em className="sv-empty">empty</em>}
        </div>
        <span className="sv-queue-end">back</span>
      </div>

      {window && (
        <div className="sv-panels">
          <div>
            <span className="ref-structure-label">window maxima</span>
            <div className="sv-chips">
              {answers.map((value, index) => (
                <span key={`ans${index}`} className="sv-chip-front">
                  {value}
                </span>
              ))}
              {answers.length === 0 && <em>—</em>}
            </div>
          </div>
        </div>
      )}

      <Footer
        operation={visual.operation}
        step={window ? step : left !== undefined ? `${left} left the ${last?.action.includes("back") ? "back" : "front"}` : undefined}
        result={resultText(beats)}
      />
    </div>
  );
}

/* ========================================
   HASH MAP / HASH SET (scan patterns)
======================================== */

function HashView({ visual, beats }: { visual: StructureVisual; beats: Beat[] }) {
  const isSet = visual.kind === "hash_set";
  const input = visual.values ?? [];
  const { table, current, lookup, inserted } = applyHashEvents(visual, beats);
  const rows = [...table.entries()];
  const step = stepText(beats);
  const lookupMissing = lookup && !lookup.hit && !table.has(lookup.key);

  return (
    <div className="sv-scene">
      <Header title={isSet ? "hash set" : "hash map"} invariant={isSet ? "O(1) average membership" : "key → value · O(1) average lookup"} />

      {input.length > 0 && (
        <ArrayRow
          caption="input"
          indexLabels={input.map((_, index) => String(index))}
          cells={input.map((value, index) => ({
            key: `in${index}`,
            value,
            state: index === current ? "active" : current !== undefined && index < current ? "dim" : undefined,
          }))}
        />
      )}

      <div className="sv-hash">
        {isSet ? (
          <div className="sv-chips sv-hash-set">
            {rows.map(([key]) => (
              <span
                key={key}
                className={
                  lookup?.key === key
                    ? lookup.hit
                      ? "sv-chip-hit"
                      : "sv-chip-new"
                    : key === inserted
                      ? "sv-chip-new"
                      : ""
                }
              >
                {key}
              </span>
            ))}
            {rows.length === 0 && <em>empty set</em>}
          </div>
        ) : (
          <div className="sv-hash-table">
            <div className="sv-hash-head">
              <span>key</span>
              <span>value</span>
            </div>
            {rows.map(([key, value]) => (
              <div
                key={key}
                className={`sv-hash-row ${
                  lookup?.key === key ? (lookup.hit ? "sv-hash-hit" : "") : key === inserted ? "sv-hash-new" : ""
                }`}
              >
                <span>{key}</span>
                <span>{value}</span>
              </div>
            ))}
            {rows.length === 0 && <div className="sv-hash-empty">empty map</div>}
          </div>
        )}

        {lookup && (
          <div className={`sv-hash-lookup ${lookup.hit ? "sv-hash-lookup-hit" : "sv-hash-lookup-miss"}`}>
            lookup {lookup.key} → {lookup.hit ? "found" : lookupMissing ? "not there" : "miss"}
          </div>
        )}
      </div>

      <Footer operation={visual.operation} step={step} result={resultText(beats)} />
    </div>
  );
}

/* ========================================
   DISPATCH
======================================== */

export function StructureView({
  visual,
  beats,
}: {
  visual: StructureVisual;
  beats: Beat[];
}): ReactNode {
  switch (visual.kind) {
    case "min_heap":
    case "max_heap":
      return <HeapTreeView visual={visual} beats={beats} />;
    case "min_heap_array":
    case "max_heap_array":
      return <HeapArrayView visual={visual} beats={beats} />;
    case "bst":
      return <BstView visual={visual} beats={beats} />;
    case "union_find":
      return <UnionFindView visual={visual} beats={beats} />;
    case "segment_tree_sum":
    case "segment_tree_min":
    case "segment_tree_max":
      return <SegmentTreeView visual={visual} beats={beats} />;
    case "fenwick_tree":
      return <FenwickView visual={visual} beats={beats} />;
    case "trie":
      return <TrieView visual={visual} beats={beats} />;
    case "graph":
    case "digraph":
      return <GraphView visual={visual} beats={beats} />;
    case "linked_list":
    case "doubly_linked_list":
      return <LinkedListView visual={visual} beats={beats} />;
    case "queue":
    case "deque":
      return <QueueView visual={visual} beats={beats} />;
    case "hash_map":
    case "hash_set":
      return <HashView visual={visual} beats={beats} />;
    default:
      return null;
  }
}
