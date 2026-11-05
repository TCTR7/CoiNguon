import { useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';

type Pose = { x: number; y: number; scale: number };
export function ZoomableTree({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<Pose>({ x: 0, y: 0, scale: 1 });
  const current = useRef(pose);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  function update(next: Pose) {
    current.current = next;
    setPose(next);
  }
  function fit() {
    const box = viewport.current,
      tree = content.current;
    if (!box || !tree) return;
    const scale = Math.min(
      1,
      (box.clientWidth - 24) / tree.offsetWidth,
      (box.clientHeight - 24) / tree.offsetHeight,
    );
    update({
      scale,
      x: (box.clientWidth - tree.offsetWidth * scale) / 2,
      y: (box.clientHeight - tree.offsetHeight * scale) / 2,
    });
  }
  useLayoutEffect(() => {
    const observer = new ResizeObserver(fit);
    observer.observe(viewport.current!);
    observer.observe(content.current!);
    fit();
    return () => observer.disconnect();
  }, []);
  function zoom(factor: number) {
    const box = viewport.current!;
    const previous = current.current;
    const scale = Math.max(0.1, Math.min(2, previous.scale * factor));
    update({
      scale,
      x: box.clientWidth / 2 - ((box.clientWidth / 2 - previous.x) * scale) / previous.scale,
      y: box.clientHeight / 2 - ((box.clientHeight / 2 - previous.y) * scale) / previous.scale,
    });
  }
  function position(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const old = points.current.get(event.pointerId);
    if (!old) return;
    const next = position(event);
    if (Math.hypot(next.x - old.x, next.y - old.y) < 3 && !moved.current) return;
    moved.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const other = [...points.current].find(([id]) => id !== event.pointerId)?.[1];
    const previous = current.current;
    if (other) {
      const distance = Math.hypot(old.x - other.x, old.y - other.y);
      const scale = Math.max(
        0.1,
        Math.min(
          2,
          (previous.scale * Math.hypot(next.x - other.x, next.y - other.y)) / Math.max(1, distance),
        ),
      );
      update({
        scale,
        x: (next.x + other.x) / 2 - (((old.x + other.x) / 2 - previous.x) * scale) / previous.scale,
        y: (next.y + other.y) / 2 - (((old.y + other.y) / 2 - previous.y) * scale) / previous.scale,
      });
    } else update({ ...previous, x: previous.x + next.x - old.x, y: previous.y + next.y - old.y });
    points.current.set(event.pointerId, next);
  }
  return (
    <section className="demo-tree-stage" aria-label="Sơ đồ gia đình mẫu">
      <div className="demo-tree-controls">
        <button onClick={() => zoom(0.8)} aria-label="Thu nhỏ sơ đồ">
          − Thu nhỏ
        </button>
        <button onClick={() => zoom(1.25)} aria-label="Phóng to sơ đồ">
          + Phóng to
        </button>
        <button onClick={fit}>Vừa màn hình</button>
        <output aria-label="Mức phóng sơ đồ">{Math.round(pose.scale * 100)}%</output>
      </div>
      <p id="demo-tree-help">
        Dùng hai ngón tay để phóng to, thu nhỏ; kéo để di chuyển. Hoặc bấm nút + / − phía trên. Chạm
        tên để xem hồ sơ.
      </p>
      <div
        ref={viewport}
        className="demo-tree-viewport"
        role="region"
        aria-label="Sơ đồ có thể kéo và phóng to"
        aria-describedby="demo-tree-help"
        tabIndex={0}
        onPointerDown={(event) => {
          if (!points.current.size) moved.current = false;
          points.current.set(event.pointerId, position(event));
        }}
        onPointerMove={move}
        onPointerUp={(event) => points.current.delete(event.pointerId)}
        onPointerCancel={(event) => points.current.delete(event.pointerId)}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (moved.current && event.detail !== 0) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (
            ['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
              event.key,
            )
          )
            event.preventDefault();
          if (event.key === '+' || event.key === '=') zoom(1.25);
          else if (event.key === '-') zoom(0.8);
          else if (event.key === 'Home') fit();
          else {
            const delta = {
              ArrowLeft: [60, 0],
              ArrowRight: [-60, 0],
              ArrowUp: [0, 60],
              ArrowDown: [0, -60],
            }[event.key];
            if (delta)
              update({
                ...current.current,
                x: current.current.x + delta[0],
                y: current.current.y + delta[1],
              });
          }
        }}
      >
        <div
          ref={content}
          className="demo-tree-content"
          style={{ transform: `translate(${pose.x}px, ${pose.y}px) scale(${pose.scale})` }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
