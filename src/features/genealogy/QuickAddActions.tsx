export type RelativeKind = 'parent' | 'spouse' | 'child';

export function QuickAddActions({ onAdd }: { onAdd: (kind: RelativeKind) => void }) {
  return (
    <div className="button-row" aria-label="Thêm người thân theo ngữ cảnh">
      {(
        [
          ['parent', 'Thêm cha / mẹ'],
          ['spouse', 'Thêm vợ / chồng'],
          ['child', 'Thêm con'],
        ] as const
      ).map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          className="button secondary"
          data-testid={`quick-add-${kind}`}
          onClick={() => onAdd(kind)}
        >
          + {label}
        </button>
      ))}
    </div>
  );
}
