import {
  documentId,
  endAt,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
// A page size bounds transport work, never the total number of documents.
export function watchPagedCollection<T>(
  source: Query<DocumentData>,
  onData: (rows: T[]) => void,
  onError: (error: Error) => void,
  pageSize = 500,
) {
  type Range = {
    after?: string;
    until?: string;
    ready: boolean;
    dirty: boolean;
    active: boolean;
    rows: T[];
    stop?: () => void;
    next?: Range;
  };
  const ranges = new Set<Range>();
  let active = true;
  const make = (after?: string, until?: string): Range => ({
    after,
    until,
    ready: false,
    dirty: false,
    active: true,
    rows: [],
  });
  const publish = () => {
    if (active && [...ranges].every((range) => range.ready))
      onData([...ranges].flatMap((range) => range.rows));
  };
  const stopAll = () => {
    active = false;
    for (const range of ranges) {
      range.active = false;
      range.stop?.();
      range.rows = [];
    }
    ranges.clear();
  };
  const listen = (range: Range) => {
    if (!active || !range.active) return;
    range.stop = onSnapshot(
      query(
        source,
        orderBy(documentId()),
        ...(range.after ? [startAfter(range.after)] : []),
        ...(range.until ? [endAt(range.until)] : []),
        limit(pageSize + 1),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active || !range.active) return;
        if (snapshot.metadata.fromCache) {
          range.dirty = true;
          return;
        }
        if (snapshot.docs.length > pageSize) {
          // Immutable, disjoint ID intervals preserve inserts/deletes across page boundaries.
          const boundary = snapshot.docs[pageSize - 1].id;
          const lower = make(range.after, boundary),
            upper = make(boundary, range.until);
          lower.next = upper;
          // Keep a deferred sibling when a range splits again before initial loading finishes.
          upper.next = range.next;
          range.active = false;
          range.stop?.();
          ranges.delete(range);
          ranges.add(lower);
          ranges.add(upper);
          listen(lower);
          return;
        }
        const first = !range.ready;
        if (!first && !range.dirty && !snapshot.docChanges().length) return;
        range.dirty = false;
        range.rows = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
        range.ready = true;
        if (first && range.next) {
          const next = range.next;
          range.next = undefined;
          listen(next);
        }
        publish();
      },
      (error) => {
        if (!active || !range.active) return;
        stopAll();
        onError(error);
      },
    );
  };
  const first = make();
  ranges.add(first);
  listen(first);
  return stopAll;
}
