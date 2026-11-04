import {
  descendantLayers,
  type FamilyPerson,
  type FamilyRelationship,
} from '../../shared/domain/genealogy';

export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 180;
export const COLUMN_GAP = 36;
export const ROW_GAP = 92;
export interface TreeNode {
  id: string;
  person: FamilyPerson;
  x: number;
  y: number;
  row: number;
  generation: number | null;
  children: number;
  expanded: boolean;
}
export interface TreeEdge {
  relationship: FamilyRelationship;
  from: TreeNode;
  to: TreeNode;
}
export interface TreeIndex {
  people: Map<string, FamilyPerson>;
  children: Map<string, FamilyRelationship[]>;
  spouses: Map<string, FamilyRelationship[]>;
  relationships: FamilyRelationship[];
  defaultRoot: string;
}
export function indexFamily(
  people: FamilyPerson[],
  relationships: FamilyRelationship[],
): TreeIndex {
  const byId = new Map(people.filter((p) => !p.archived).map((p) => [p.id, p]));
  const children = new Map<string, FamilyRelationship[]>(),
    spouses = new Map<string, FamilyRelationship[]>();
  const edges = relationships.filter((e) => !e.archived && byId.has(e.from) && byId.has(e.to));
  const hasParent = new Set<string>();
  const append = (map: Map<string, FamilyRelationship[]>, id: string, edge: FamilyRelationship) => {
    const row = map.get(id) || [];
    row.push(edge);
    map.set(id, row);
  };
  for (const e of edges) {
    if (e.kind === 'parent') {
      append(children, e.from, e);
      if (e.verified) hasParent.add(e.to);
    } else {
      append(spouses, e.from, e);
      append(spouses, e.to, e);
    }
  }
  const root =
    people.find((p) => byId.has(p.id) && !hasParent.has(p.id))?.id ||
    byId.keys().next().value ||
    '';
  return { people: byId, children, spouses, relationships: edges, defaultRoot: root };
}
export interface TreeLayout {
  nodes: TreeNode[];
  byId: Map<string, TreeNode>;
  edges: TreeEdge[];
  rows: TreeNode[][];
  width: number;
  height: number;
}
export function layoutFamily(
  index: TreeIndex,
  root: string,
  depth: number,
  expanded: Set<string>,
  collapsed: Set<string>,
): TreeLayout {
  if (!index.people.has(root))
    return { nodes: [], byId: new Map(), edges: [], rows: [], width: 0, height: 0 };
  const levels = descendantLayers(root, index.relationships);
  const rows: string[][] = [],
    placed = new Map<string, number>(),
    processed = new Set<string>();
  const queue: [string, number][] = [[root, 0]];
  const place = (id: string, row: number) => {
    if (!placed.has(id)) {
      placed.set(id, row);
      (rows[row] ||= []).push(id);
    }
  };
  for (let i = 0; i < queue.length; i++) {
    const [id, row] = queue[i];
    if (processed.has(id)) continue;
    processed.add(id);
    place(id, row);
    for (const edge of index.spouses.get(id) || []) {
      const spouse = edge.from === id ? edge.to : edge.from;
      place(spouse, row);
      // A displayed spouse does not imply parenthood or automatically include their other children.
      if (expanded.has(spouse) && !processed.has(spouse)) queue.push([spouse, placed.get(spouse)!]);
    }
    if (collapsed.has(id) || (row >= depth && !expanded.has(id))) continue;
    for (const edge of index.children.get(id) || []) queue.push([edge.to, row + 1]);
  }
  const width =
    rows.reduce(
      (max, row) => Math.max(max, row.length * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP),
      0,
    ) + 64;
  const nodes: TreeNode[] = [],
    byId = new Map<string, TreeNode>();
  const resultRows = rows.map((ids, row) =>
    ids.map((id, column) => {
      const values = levels.get(id),
        generation = values?.size === 1 ? [...values][0] + 1 : null;
      const node: TreeNode = {
        id,
        person: index.people.get(id)!,
        x:
          (width - (ids.length * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP)) / 2 +
          column * (CARD_WIDTH + COLUMN_GAP),
        y: 48 + row * (CARD_HEIGHT + ROW_GAP),
        row,
        generation,
        children: (index.children.get(id) || []).length,
        expanded: !collapsed.has(id) && (row < depth || expanded.has(id)),
      };
      nodes.push(node);
      byId.set(id, node);
      return node;
    }),
  );
  const edges: TreeEdge[] = [];
  for (const e of index.relationships) {
    const from = byId.get(e.from),
      to = byId.get(e.to);
    if (from && to) edges.push({ relationship: e, from, to });
  }
  return {
    nodes,
    byId,
    edges,
    rows: resultRows,
    width,
    height: 48 + rows.length * (CARD_HEIGHT + ROW_GAP),
  };
}
export interface TreeViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
// Uniform row spacing lets the viewport address visible columns directly.
export function visibleTreeNodes(layout: TreeLayout, viewport: TreeViewport, padding = 60) {
  const nodes: TreeNode[] = [];
  const rowStart = Math.max(
    0,
    Math.floor((viewport.y - padding - 48 - CARD_HEIGHT) / (CARD_HEIGHT + ROW_GAP)),
  );
  const rowEnd = Math.min(
    layout.rows.length - 1,
    Math.ceil((viewport.y + viewport.height + padding - 48) / (CARD_HEIGHT + ROW_GAP)),
  );
  for (let row = rowStart; row <= rowEnd; row++) {
    const items = layout.rows[row];
    if (!items?.length) continue;
    const firstX = items[0].x,
      step = CARD_WIDTH + COLUMN_GAP;
    const start = Math.max(0, Math.floor((viewport.x - padding - CARD_WIDTH - firstX) / step));
    const end = Math.min(
      items.length - 1,
      Math.ceil((viewport.x + viewport.width + padding - firstX) / step),
    );
    for (let i = start; i <= end; i++) nodes.push(items[i]);
  }
  return nodes;
}
