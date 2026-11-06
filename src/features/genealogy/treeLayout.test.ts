import { describe, it, expect } from 'vitest';
import {
  blankPerson,
  descendantLayers,
  type FamilyPerson,
  type FamilyRelationship,
} from '../../shared/domain/genealogy';
import { CARD_HEIGHT, CARD_WIDTH, indexFamily, layoutFamily, visibleTreeNodes } from './treeLayout';
const person = (id: string): FamilyPerson => ({
  ...blankPerson(),
  id,
  name: 'Người mẫu ' + id,
  archived: false,
  version: 1,
});
const edge = (
  from: string,
  to: string,
  extra: Partial<FamilyRelationship> = {},
): FamilyRelationship => ({
  id: from + '_' + to,
  from,
  to,
  kind: 'parent',
  parentType: 'biological',
  status: 'current',
  source: 'Dữ liệu giả',
  verified: true,
  archived: false,
  version: 1,
  ...extra,
});
describe('dynamic family layout', () => {
  it('chooses the father before two unverified children and shows the family from a child', () => {
    const index = indexFamily(['child1', 'child2', 'father'].map(person), [
      edge('father', 'child1', { verified: false }),
      edge('father', 'child2', { verified: false }),
    ]);
    expect(index.defaultRoot).toBe('father');
    expect(index.parents.get('child1')).toEqual([index.relationships[0]]);
    for (const root of ['father', 'child1']) {
      const layout = layoutFamily(index, root, 2, new Set(), new Set());
      expect(layout.nodes).toHaveLength(3);
      expect(layout.byId.get('child1')?.row).toBe(layout.byId.get('child2')?.row);
      expect(layout.byId.get('father')!.row + 1).toBe(layout.byId.get('child1')?.row);
      expect(layout.byId.get('child2')?.generation).toBeNull();
      expect(layout.edges).toHaveLength(2);
    }
  });
  it('shows ancestors, siblings, spouses, descendants and disconnected active families in small trees', () => {
    const ids = [
      'child',
      'sibling',
      'father',
      'mother',
      'grandfather',
      'grandmother',
      'spouse',
      'son',
      'grandchild',
      'other',
      'otherChild',
      'alone',
    ];
    const index = indexFamily(
      [...ids.map(person), { ...person('archived'), archived: true }],
      [
        edge('father', 'child'),
        edge('mother', 'child'),
        edge('father', 'sibling'),
        edge('mother', 'sibling'),
        edge('grandfather', 'father'),
        edge('grandmother', 'father'),
        edge('child', 'spouse', { kind: 'spouse' }),
        edge('child', 'son'),
        edge('son', 'grandchild'),
        edge('other', 'otherChild'),
        edge('child', 'archived'),
      ],
    );
    const layout = layoutFamily(index, 'child', 0, new Set(), new Set(['child', 'father']));
    expect(new Set(layout.nodes.map((node) => node.id))).toEqual(new Set(ids));
    expect(layout.byId.get('grandfather')!.row + 1).toBe(layout.byId.get('father')?.row);
    expect(layout.byId.get('father')!.row + 1).toBe(layout.byId.get('child')?.row);
    expect(layout.byId.get('child')?.row).toBe(layout.byId.get('sibling')?.row);
    expect(layout.byId.get('child')?.row).toBe(layout.byId.get('spouse')?.row);
    expect(layout.byId.get('grandchild')?.generation).toBe(3);
    expect(layout.byId.get('father')?.generation).toBeNull();
  });
  it('terminates with a deterministic fallback for unverified parent cycles', () => {
    const index = indexFamily(['a', 'b'].map(person), [
      edge('a', 'b', { verified: false }),
      edge('b', 'a', { verified: false }),
    ]);
    expect(index.defaultRoot).toBe('a');
    const layout = layoutFamily(index, index.defaultRoot, 2, new Set(), new Set());
    expect(layout.nodes).toHaveLength(2);
    expect(layout.byId.get('b')?.generation).toBeNull();
    expect(Number.isFinite(layout.height)).toBe(true);
  });
  it.each([100, 101])('limits the full family overview to 100 active profiles (%i)', (count) => {
    const index = indexFamily(
      Array.from({ length: count }, (_, i) => person('p' + i)),
      [edge('p0', 'p1')],
    );
    const layout = layoutFamily(index, 'p1', 0, new Set(), new Set());
    expect(layout.nodes).toHaveLength(count === 100 ? 100 : 1);
  });
  it.each([250, 5000, 20000])(
    'keeps all %i profiles reachable and bounds DOM candidates to the viewport',
    (count) => {
      const people = Array.from({ length: count }, (_, i) => person('p' + i));
      const relations = people.slice(1).map((p, i) => edge('p' + Math.floor(i / 4), p.id));
      const start = performance.now();
      const index = indexFamily(people, relations);
      const layout = layoutFamily(index, 'p0', count, new Set(), new Set());
      expect(layout.nodes).toHaveLength(count);
      const root = layout.byId.get('p0')!;
      const inView = visibleTreeNodes(layout, { x: root.x - 350, y: 0, width: 900, height: 640 });
      expect(inView.length).toBeLessThan(40);
      expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(count);
      const last = layout.byId.get('p' + (count - 1))!;
      expect(
        visibleTreeNodes(layout, {
          x: last.x,
          y: last.y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        }).map((n) => n.id),
      ).toContain(last.id);
      console.log(
        'Family layout ' +
          count +
          ': ' +
          Math.round(performance.now() - start) +
          'ms, viewport ' +
          inView.length +
          ' nodes',
      );
    },
  );
  it('handles thousands of generations iteratively, without a depth cap', () => {
    const people = Array.from({ length: 5000 }, (_, i) => person('p' + i));
    const relations = people.slice(1).map((p, i) => edge('p' + i, p.id));
    const layout = layoutFamily(indexFamily(people, relations), 'p0', 5001, new Set(), new Set());
    expect(layout.byId.get('p4999')?.generation).toBe(5000);
    expect(descendantLayers('p0', relations).get('p4999')).toEqual(new Set([4999]));
  });
  it('opens arbitrary branches and collapses in large trees without losing shared records or data', () => {
    const people = [
        ...['a', 'b', 'c', 'd'].map(person),
        ...Array.from({ length: 97 }, (_, i) => person('extra' + i)),
      ],
      relations = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')];
    const index = indexFamily(people, relations);
    expect(layoutFamily(index, 'a', 1, new Set(), new Set()).nodes.map((n) => n.id)).toEqual([
      'a',
      'b',
    ]);
    expect(layoutFamily(index, 'a', 1, new Set(['b']), new Set()).byId.has('c')).toBe(true);
    expect(layoutFamily(index, 'a', 4, new Set(), new Set(['b'])).nodes.map((n) => n.id)).toEqual([
      'a',
      'b',
    ]);
    expect(index.people.size).toBe(101);
  });
  it('never infers a parent edge from a marriage, keeps former spouses/adoption and marks unknown depths', () => {
    const people = ['a', 'b', 'c', 'd', 'e'].map(person);
    const relations = [
      edge('a', 'b', { kind: 'spouse', status: 'former' }),
      edge('a', 'c', { parentType: 'adoptive' }),
      edge('a', 'd', { verified: false }),
      edge('b', 'e'),
    ];
    const layout = layoutFamily(indexFamily(people, relations), 'a', 3, new Set(), new Set());
    expect(layout.byId.has('b')).toBe(true);
    expect(layout.byId.has('e')).toBe(true);
    expect(layout.byId.get('e')?.generation).toBeNull();
    expect(layout.byId.get('b')?.generation).toBeNull();
    expect(layout.byId.get('d')?.generation).toBeNull();
    expect(layout.edges.some((e) => e.relationship.from === 'b' && e.relationship.to === 'c')).toBe(
      false,
    );
    expect(layout.edges.find((e) => e.to.id === 'c')?.relationship.parentType).toBe('adoptive');
  });
  it('does not assert a generation for conflicting paths, cycles, or archived endpoints', () => {
    const relations = [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')];
    expect(
      layoutFamily(
        indexFamily(['a', 'b', 'c'].map(person), relations),
        'a',
        3,
        new Set(),
        new Set(),
      ).byId.get('c')?.generation,
    ).toBeNull();
    expect(descendantLayers('a', [edge('a', 'b'), edge('b', 'a')]).get('b')?.size).toBe(0);
    expect(
      indexFamily([person('a'), { ...person('b'), archived: true }], [edge('a', 'b')])
        .relationships,
    ).toHaveLength(0);
  });
});
