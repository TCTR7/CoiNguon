import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import {
  Minus,
  Plus,
  LocateFixed,
  Maximize2,
  Maximize,
  Minimize,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FamilyPerson, FamilyRelationship } from '../../shared/domain/genealogy';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  indexFamily,
  layoutFamily,
  visibleTreeNodes,
  type TreeNode,
} from './treeLayout';
import './family-tree.css';
import { QuickAddActions, type RelativeKind } from './QuickAddActions';

type Pose = { x: number; y: number; scale: number };
const boundedScale = (value: number) => Math.max(0.00001, Math.min(2, value));
export function FamilyTree({
  people,
  relationships,
  results,
  selectedId,
  onChoose,
  onAddRelative,
}: {
  people: FamilyPerson[];
  relationships: FamilyRelationship[];
  results: FamilyPerson[];
  selectedId: string;
  onChoose: (id: string) => void;
  onAddRelative?: (personId: string, kind: RelativeKind) => void;
}) {
  const index = useMemo(() => indexFamily(people, relationships), [people, relationships]);
  const [chosenRoot, setChosenRoot] = useState('');
  const root = index.people.has(chosenRoot) ? chosenRoot : index.defaultRoot;
  if (root && chosenRoot !== root) setChosenRoot(root);
  const rootName = index.people.get(root)?.name;
  const [depth, setDepth] = useState(2);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [resultPage, setResultPage] = useState(0);
  const layout = useMemo(
    () => layoutFamily(index, root, depth, expanded, collapsed),
    [index, root, depth, expanded, collapsed],
  );
  const container = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [fullscreenMode, setFullscreenMode] = useState<'none' | 'native' | 'fallback'>('none');
  const isFullscreen = fullscreenMode !== 'none';
  const [fullscreenPending, setFullscreenPending] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const fullscreenBusy = useRef(false);
  const mounted = useRef(false);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const restoreFullscreenFocus = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pose, setPose] = useState<Pose>({ x: 0, y: 0, scale: 1 });
  const poseRef = useRef(pose);
  useLayoutEffect(() => {
    poseRef.current = pose;
  }, [pose]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    x: number;
    y: number;
    distance: number;
    pose: Pose;
    moved: boolean;
  } | null>(null);
  const initialized = useRef('');
  const pendingFocus = useRef('');
  const previousNodeCount = useRef(0);
  const anchor = useRef<{ root: string; x: number; y: number } | null>(null);
  const page = Math.min(resultPage, Math.max(0, Math.ceil(results.length / 20) - 1));
  const rootChoices = [
    ...new Map(
      [
        index.people.get(root),
        index.people.get(selectedId),
        ...results.slice(page * 20, page * 20 + 20),
      ]
        .filter((p): p is FamilyPerson => !!p)
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const world = {
    x: -pose.x / pose.scale,
    y: -pose.y / pose.scale,
    width: size.width / pose.scale,
    height: size.height / pose.scale,
  };
  const visible = visibleTreeNodes(layout, world);
  const overview = pose.scale < 0.85 && layout.nodes.length > 60;
  const centerNode = (node: TreeNode) =>
    setPose({ scale: 1, x: size.width / 2 - node.x - CARD_WIDTH / 2, y: 55 - node.y });
  const focusPerson = (id: string) => {
    onChoose(id);
    const node = layout.byId.get(id);
    if (node) centerNode(node);
    else {
      pendingFocus.current = id;
      changeRoot(id);
    }
  };
  function changeRoot(id: string) {
    onChoose(id);
    setChosenRoot(id);
    setExpanded(new Set());
    setCollapsed(new Set());
    setDepth(2);
    initialized.current = '';
  }
  function toggle(node: TreeNode) {
    if (node.expanded) {
      setCollapsed((previous) => new Set([...previous, node.id]));
    } else {
      setCollapsed((previous) => {
        const next = new Set(previous);
        next.delete(node.id);
        return next;
      });
      setExpanded((previous) => new Set([...previous, node.id]));
    }
  }
  function zoom(factor: number, anchorX = size.width / 2, anchorY = size.height / 2) {
    setPose((previous) => {
      const scale = boundedScale(previous.scale * factor),
        ratio = scale / previous.scale;
      return {
        scale,
        x: anchorX - (anchorX - previous.x) * ratio,
        y: anchorY - (anchorY - previous.y) * ratio,
      };
    });
  }
  function fit() {
    const scale = boundedScale(
      Math.min(
        (size.width - 40) / Math.max(1, layout.width),
        (size.height - 40) / Math.max(1, layout.height),
        1,
      ),
    );
    setPose({
      scale,
      x: (size.width - layout.width * scale) / 2,
      y: (size.height - layout.height * scale) / 2,
    });
  }
  useEffect(() => {
    mounted.current = true;
    const onFullscreenChange = () => {
      setFullscreenMode((mode) =>
        document.fullscreenElement === container.current
          ? 'native'
          : mode === 'native'
            ? 'none'
            : mode,
      );
      setFullscreenError('');
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      mounted.current = false;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);
  useEffect(() => {
    if (!isFullscreen) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    restoreFullscreenFocus.current = true;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    viewport.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [isFullscreen]);
  useEffect(() => {
    if (!isFullscreen && !fullscreenPending && restoreFullscreenFocus.current) {
      fullscreenButton.current?.focus({ preventScroll: true });
      restoreFullscreenFocus.current = false;
    }
  }, [isFullscreen, fullscreenPending]);
  useEffect(() => {
    if (fullscreenMode !== 'fallback') return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenMode('none');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenMode]);
  async function toggleFullscreen() {
    const element = container.current;
    if (!element || fullscreenBusy.current) return false;
    fullscreenBusy.current = true;
    setFullscreenPending(true);
    setFullscreenError('');
    try {
      if (!isFullscreen) {
        if (element.requestFullscreen) {
          try {
            await element.requestFullscreen();
            if (mounted.current) {
              setFullscreenMode(document.fullscreenElement === element ? 'native' : 'none');
            }
            return true;
          } catch {
            // Browsers without fullscreen permission still get an expanded workspace.
          }
        }
        if (mounted.current) setFullscreenMode('fallback');
      } else {
        if (document.fullscreenElement === element) await document.exitFullscreen();
        if (mounted.current) setFullscreenMode('none');
      }
      return true;
    } catch {
      if (mounted.current) {
        setFullscreenError('Chưa thể thu nhỏ toàn màn hình. Hãy thử lại hoặc nhấn Esc.');
      }
      return false;
    } finally {
      fullscreenBusy.current = false;
      if (mounted.current) setFullscreenPending(false);
    }
  }
  async function openOutsideTree(action: () => void) {
    if (isFullscreen && !(await toggleFullscreen())) return;
    action();
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let previousSize: { width: number; height: number } | undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      if (!box.width || !box.height) return;
      if (previousSize) {
        const dx = (box.width - previousSize.width) / 2;
        const dy = (box.height - previousSize.height) / 2;
        setPose((previous) => ({ ...previous, x: previous.x + dx, y: previous.y + dy }));
      }
      previousSize = { width: box.width, height: box.height };
      pointers.current.clear();
      gesture.current = null;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect(),
          x = event.clientX - bounds.left,
          y = event.clientY - bounds.top;
        setPose((previous) => {
          const scale = boundedScale(previous.scale * Math.exp(-event.deltaY * 0.004)),
            ratio = scale / previous.scale;
          return { scale, x: x - (x - previous.x) * ratio, y: y - (y - previous.y) * ratio };
        });
      } else {
        setPose((previous) => ({
          ...previous,
          x: previous.x - (event.shiftKey ? event.deltaY : event.deltaX),
          y: previous.y - (event.shiftKey ? 0 : event.deltaY),
        }));
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', wheel);
    };
  }, []);
  useEffect(() => {
    if (!root || !size.width || !size.height) return;
    const node = layout.byId.get(root);
    if (!node) return;
    if (initialized.current !== root) {
      const scale = boundedScale(
        Math.min(
          (size.width - 40) / Math.max(1, layout.width),
          (size.height - 40) / Math.max(1, layout.height),
          1,
        ),
      );
      if (pendingFocus.current === root) {
        setPose({ scale: 1, x: size.width / 2 - node.x - CARD_WIDTH / 2, y: 55 - node.y });
        pendingFocus.current = '';
      } else {
        setPose({
          scale,
          x: (size.width - layout.width * scale) / 2,
          y: (size.height - layout.height * scale) / 2,
        });
      }
      initialized.current = root;
    } else if (
      index.people.size <= 100 &&
      layout.nodes.length > previousNodeCount.current &&
      layout.width * poseRef.current.scale > size.width &&
      !pendingFocus.current
    ) {
      fit();
    } else if (anchor.current?.root === root) {
      const dx = anchor.current.x - node.x,
        dy = anchor.current.y - node.y;
      if (dx || dy)
        setPose((previous) => ({
          ...previous,
          x: previous.x + dx * previous.scale,
          y: previous.y + dy * previous.scale,
        }));
    }
    previousNodeCount.current = layout.nodes.length;
    anchor.current = { root, x: node.x, y: node.y };
  }, [root, layout, size.width, size.height]);
  useEffect(() => {
    const element = canvas.current,
      context = element?.getContext('2d');
    if (!element || !context) return;
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.round(size.width * dpr);
    element.height = Math.round(size.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.translate(pose.x, pose.y);
    context.scale(pose.scale, pose.scale);
    for (const edge of layout.edges) {
      const { from, to, relationship: e } = edge;
      if (
        Math.max(from.x, to.x) + CARD_WIDTH < world.x ||
        Math.min(from.x, to.x) > world.x + world.width ||
        Math.max(from.y, to.y) + CARD_HEIGHT < world.y ||
        Math.min(from.y, to.y) > world.y + world.height
      )
        continue;
      const spouse = e.kind === 'spouse';
      let x1 = from.x + CARD_WIDTH / 2,
        y1 = from.y + CARD_HEIGHT,
        x2 = to.x + CARD_WIDTH / 2,
        y2 = to.y;
      if (spouse) {
        const left = from.x < to.x ? from : to,
          right = left === from ? to : from;
        x1 = left.x + CARD_WIDTH;
        y1 = left.y + CARD_HEIGHT / 2;
        x2 = right.x;
        y2 = right.y + CARD_HEIGHT / 2;
      }
      context.strokeStyle = e.verified
        ? spouse && e.status === 'former'
          ? '#776a60'
          : '#4c6245'
        : '#876021';
      context.lineWidth = 2 / Math.max(0.4, pose.scale);
      context.setLineDash(
        e.verified ? [] : [7 / Math.max(0.4, pose.scale), 5 / Math.max(0.4, pose.scale)],
      );
      const draw = (offset: number) => {
        context.beginPath();
        context.moveTo(x1 + offset, y1);
        if (spouse) context.lineTo(x2 + offset, y2);
        else {
          const middle = (y1 + y2) / 2;
          context.lineTo(x1 + offset, middle);
          context.lineTo(x2 + offset, middle);
          context.lineTo(x2 + offset, y2);
        }
        context.stroke();
      };
      draw(0);
      if (!spouse && e.parentType === 'adoptive') draw(5);
      if (
        !overview &&
        (!e.verified ||
          (spouse && e.status === 'former') ||
          (!spouse && e.parentType === 'adoptive'))
      ) {
        const label = [
          !e.verified ? 'Chưa xác minh' : '',
          spouse && e.status === 'former' ? 'Trước đây' : '',
          !spouse && e.parentType === 'adoptive' ? 'Con nuôi' : '',
        ]
          .filter(Boolean)
          .join(' · ');
        context.font = '13px "Be Vietnam Pro", sans-serif';
        context.setLineDash([]);
        const width = context.measureText(label).width,
          labelX = spouse ? (x1 + x2) / 2 : x2,
          labelY = spouse ? y1 - 15 : y2 - 20;
        context.fillStyle = '#fffdf7';
        context.fillRect(labelX - width / 2 - 5, labelY - 13, width + 10, 20);
        context.fillStyle = '#60512d';
        context.textAlign = 'center';
        context.fillText(label, labelX, labelY);
      }
    }
    if (overview) {
      context.setLineDash([]);
      for (const node of visible) {
        context.fillStyle = node.id === selectedId ? '#8e3d2f' : '#dbe3cf';
        context.fillRect(node.x, node.y, CARD_WIDTH, CARD_HEIGHT);
        context.strokeStyle = '#4c6245';
        context.lineWidth = 1 / pose.scale;
        context.strokeRect(node.x, node.y, CARD_WIDTH, CARD_HEIGHT);
        if (pose.scale >= 0.3) {
          context.fillStyle = node.id === selectedId ? '#fffdf7' : '#273324';
          context.font = '600 17px "Be Vietnam Pro", sans-serif';
          context.textAlign = 'left';
          context.fillText(node.person.name, node.x + 12, node.y + 34, CARD_WIDTH - 24);
        }
      }
    }
    // Visible/world are derived from the dependencies below, not independent inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, pose, size, selectedId, overview]);
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, input, select, a')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointers.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    startGesture();
  }
  function startGesture() {
    const values = [...pointers.current.values()];
    if (!values.length) {
      gesture.current = null;
      return;
    }
    const a = values[0],
      b = values[1] || a;
    gesture.current = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      pose: poseRef.current,
      moved: false,
    };
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointers.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    const values = [...pointers.current.values()],
      a = values[0],
      b = values[1] || a,
      initial = gesture.current;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2;
    const scale = boundedScale(
      initial.pose.scale *
        (initial.distance > 0 && values.length > 1
          ? Math.hypot(a.x - b.x, a.y - b.y) / initial.distance
          : 1),
    );
    if (Math.hypot(x - initial.x, y - initial.y) > 4 || values.length > 1) initial.moved = true;
    setPose({
      scale,
      x: x - ((initial.x - initial.pose.x) * scale) / initial.pose.scale,
      y: y - ((initial.y - initial.pose.y) * scale) / initial.pose.scale,
    });
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      overview &&
      event.type !== 'pointercancel' &&
      gesture.current &&
      !gesture.current.moved &&
      pointers.current.size === 1
    ) {
      const point = pointers.current.get(event.pointerId),
        current = poseRef.current;
      if (point) {
        const x = (point.x - current.x) / current.scale,
          y = (point.y - current.y) / current.scale;
        const node = visible.find(
          (n) => x >= n.x && x <= n.x + CARD_WIDTH && y >= n.y && y <= n.y + CARD_HEIGHT,
        );
        if (node) focusPerson(node.id);
      }
    }
    pointers.current.delete(event.pointerId);
    startGesture();
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '=', '-', 'Home'].includes(event.key)
    )
      event.preventDefault();
    if (event.key === '+' || event.key === '=') zoom(1.25);
    else if (event.key === '-') zoom(0.8);
    else if (event.key === 'Home') {
      const node = layout.byId.get(root);
      if (node) centerNode(node);
    } else {
      const delta = {
        ArrowUp: [0, 100],
        ArrowDown: [0, -100],
        ArrowLeft: [100, 0],
        ArrowRight: [-100, 0],
      }[event.key];
      if (delta) setPose((p) => ({ ...p, x: p.x + delta[0], y: p.y + delta[1] }));
    }
  }
  if (!root) return <p className="notice">Thêm hồ sơ để bắt đầu xem sơ đồ nhánh.</p>;
  return (
    <div
      ref={container}
      className={'family-tree-workspace' + (isFullscreen ? ' is-fullscreen' : '')}
    >
      <aside className="tree-directory" aria-label="Danh sách định vị trong cây">
        <h3>Người trong gia phả</h3>
        <p className="subtle">
          {results.length.toLocaleString('vi')} kết quả theo tìm kiếm và chi.
        </p>
        <div className="tree-search-results">
          {results.slice(page * 20, page * 20 + 20).map((person) => (
            <button
              key={person.id}
              aria-label={'Định vị ' + person.name}
              aria-pressed={person.id === selectedId}
              onClick={() => focusPerson(person.id)}
            >
              <strong>{person.name}</strong>
              <span>{person.birth.year ?? 'Chưa rõ năm sinh'}</span>
            </button>
          ))}
        </div>
        {!results.length && <p role="status">Không có hồ sơ phù hợp.</p>}
        {results.length > 20 && (
          <div className="tree-pagination">
            <button
              disabled={page === 0}
              onClick={() => setResultPage(page - 1)}
              aria-label="Trang hồ sơ trước"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page + 1}/{Math.ceil(results.length / 20)}
            </span>
            <button
              disabled={(page + 1) * 20 >= results.length}
              onClick={() => setResultPage(page + 1)}
              aria-label="Trang hồ sơ tiếp"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </aside>
      <section className="tree-stage" aria-label="Cây gia phả tương tác">
        {onAddRelative && index.people.has(selectedId) && (
          <div className="tree-control-bar">
            <span>Thêm người thân của {index.people.get(selectedId)!.name}</span>
            <QuickAddActions
              onAdd={(kind) => void openOutsideTree(() => onAddRelative(selectedId, kind))}
            />
          </div>
        )}
        <div className="tree-control-bar">
          <label>
            Gốc nhánh đang xem
            <select
              aria-label="Gốc nhánh đang xem"
              value={root}
              onChange={(event) => changeRoot(event.target.value)}
            >
              {rootChoices.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <div className="tree-actions">
            <button type="button" onClick={fit}>
              <Maximize2 size={17} /> Vừa khung
            </button>
            <button type="button" onClick={() => focusPerson(selectedId || root)}>
              <LocateFixed size={17} /> Về người đang chọn
            </button>
            <button
              ref={fullscreenButton}
              type="button"
              onClick={() => void toggleFullscreen()}
              disabled={fullscreenPending}
              aria-busy={fullscreenPending}
              aria-label={isFullscreen ? 'Thu nhỏ toàn màn hình' : 'Mở toàn màn hình'}
              aria-pressed={isFullscreen}
              data-testid="tree-fullscreen-button"
            >
              {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
              {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            </button>
          </div>
        </div>
        {fullscreenError && (
          <p role="alert" className="notice">
            {fullscreenError}
          </p>
        )}
        <p className="tree-caption">
          Nhánh {rootName} · {layout.nodes.length.toLocaleString('vi')}/
          {index.people.size.toLocaleString('vi')} hồ sơ.
        </p>
        <div
          ref={viewport}
          className="family-tree-viewport"
          role="region"
          aria-label="Vùng sơ đồ gia phả, có thể kéo và phóng to"
          tabIndex={0}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={keyDown}
          data-rendered-nodes={overview ? 0 : visible.length}
        >
          <canvas ref={canvas} aria-hidden="true" />
          {!overview &&
            visible.map((node) => (
              <div
                key={node.id}
                className={'family-tree-card' + (node.id === selectedId ? ' selected' : '')}
                style={{
                  left: pose.x + node.x * pose.scale,
                  top: pose.y + node.y * pose.scale,
                  transform: 'scale(' + pose.scale + ')',
                }}
              >
                <button
                  className="family-tree-person"
                  aria-label={'Xem hồ sơ ' + node.person.name}
                  aria-pressed={node.id === selectedId}
                  onClick={() => void openOutsideTree(() => onChoose(node.id))}
                >
                  <span className="avatar">{node.person.name.charAt(0)}</span>
                  <strong title={node.person.name}>{node.person.name}</strong>
                  <span>
                    {node.person.birth.year ?? 'Chưa rõ năm sinh'} ·{' '}
                    {node.person.lifeStatus === 'deceased'
                      ? 'Đã mất'
                      : node.person.lifeStatus === 'living'
                        ? 'Còn sống'
                        : 'Chưa rõ'}
                  </span>
                  <small>
                    {node.generation === null
                      ? 'Chưa xác định thế hệ'
                      : 'Thế hệ tương đối ' + node.generation}
                  </small>
                </button>
                {node.children > 0 && (
                  <button
                    className="family-tree-expand"
                    aria-label={(node.expanded ? 'Thu nhánh ' : 'Mở nhánh ') + node.person.name}
                    aria-expanded={node.expanded}
                    onClick={() => toggle(node)}
                  >
                    {node.expanded ? '− Thu nhánh' : '+ Mở nhánh'} · {node.children} con
                  </button>
                )}
              </div>
            ))}
        </div>
        <div className="tree-bottom-bar">
          <div className="tree-zoom">
            <button onClick={() => zoom(0.8)} aria-label="Thu nhỏ sơ đồ">
              <Minus size={18} />
            </button>
            <output aria-label="Mức phóng sơ đồ">
              {pose.scale < 0.01 ? '< 1' : Math.round(pose.scale * 100)}%
            </output>
            <button onClick={() => zoom(1.25)} aria-label="Phóng to sơ đồ">
              <Plus size={18} />
            </button>
          </div>
          <button
            onClick={() => {
              setDepth((value) => value + 1);
              setCollapsed(new Set());
            }}
          >
            <ArrowDown size={17} /> Thêm một thế hệ
          </button>
          <button
            onClick={() => {
              setDepth(1);
              setExpanded(new Set());
              setCollapsed(new Set());
              const node = layout.byId.get(root);
              if (node) centerNode(node);
            }}
          >
            Thu về nhánh gần
          </button>
        </div>
      </section>
    </div>
  );
}
