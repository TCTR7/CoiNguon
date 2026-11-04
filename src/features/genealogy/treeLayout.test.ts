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
  it('opens arbitrary branches and collapses without losing shared records or data', () => {
    const people = ['a', 'b', 'c', 'd'].map(person),
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
    expect(index.people.size).toBe(4);
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
    expect(layout.byId.has('e')).toBe(false);
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
