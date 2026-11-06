import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FamilyTree } from './FamilyTree';
import { CARD_WIDTH } from './treeLayout';
import {
  blankPerson,
  type FamilyPerson,
  type FamilyRelationship,
} from '../../shared/domain/genealogy';

const person = (id: string): FamilyPerson => ({
  ...blankPerson(),
  id,
  name: 'Mẫu ' + id,
  archived: false,
  version: 1,
});
const relationship = (to: string): FamilyRelationship => ({
  id: 'father_' + to,
  from: 'father',
  to,
  kind: 'parent',
  parentType: 'biological',
  status: 'current',
  source: 'Dữ liệu giả',
  verified: false,
  archived: false,
  version: 1,
});
let resizeViewport: (width: number, height: number) => void;
const fullscreenProperties = [
  [document, 'fullscreenElement'],
  [document, 'exitFullscreen'],
  [HTMLElement.prototype, 'requestFullscreen'],
] as const;
const fullscreenDescriptors = fullscreenProperties.map(([target, key]) =>
  Object.getOwnPropertyDescriptor(target, key),
);
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        resizeViewport = (width, height) =>
          this.callback(
            [{ target, contentRect: { width, height } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        resizeViewport(360, 640);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

function renderTree() {
  const root = person('root');
  return render(
    <FamilyTree
      people={[root]}
      relationships={[]}
      results={[root]}
      selectedId={root.id}
      onChoose={vi.fn()}
    />,
  );
}

function mockFullscreen() {
  let element: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
  const change = (next: Element | null) => {
    element = next;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const request = vi.fn(function (this: HTMLElement) {
    change(this);
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    change(null);
    return Promise.resolve();
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: request,
  });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
  return { request, exit, change };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fullscreenProperties.forEach(([target, key], i) => {
    const descriptor = fullscreenDescriptors[i];
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  });
});

it('refits a second unverified child inside a narrow viewport without changing the root', () => {
  const father = person('father'),
    child1 = person('child1'),
    child2 = person('child2');
  const props = { results: [father, child1, child2], selectedId: father.id, onChoose: vi.fn() };
  const { rerender, container } = render(
    <FamilyTree {...props} people={[father, child1]} relationships={[relationship('child1')]} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Định vị Mẫu father' }));
  expect(screen.getByLabelText('Mức phóng sơ đồ')).toHaveTextContent('100%');
  rerender(
    <FamilyTree
      {...props}
      people={[father, child1, child2]}
      relationships={[relationship('child1'), relationship('child2')]}
    />,
  );
  expect(screen.getByLabelText('Gốc nhánh đang xem')).toHaveValue('father');
  expect(screen.getByLabelText('Mức phóng sơ đồ')).not.toHaveTextContent('100%');
  const cards = container.querySelectorAll<HTMLElement>('.family-tree-card');
  expect(cards).toHaveLength(3);
  for (const card of cards) {
    const left = parseFloat(card.style.left);
    const scale = Number(card.style.transform.match(/^scale\(([^)]+)\)$/)?.[1]);
    const width = CARD_WIDTH * scale;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(360);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Định vị Mẫu child2' }));
  expect(screen.getByLabelText('Mức phóng sơ đồ')).toHaveTextContent('100%');
});

it('preserves explicit pending focus when a large-tree selection changes the root', () => {
  const people = Array.from({ length: 101 }, (_, i) => person('p' + i));
  render(
    <FamilyTree
      people={people}
      relationships={[]}
      results={people.slice(0, 2)}
      selectedId="p0"
      onChoose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Định vị Mẫu p1' }));
  expect(screen.getByLabelText('Gốc nhánh đang xem')).toHaveValue('p1');
  expect(screen.getByLabelText('Mức phóng sơ đồ')).toHaveTextContent('100%');
  expect(screen.getByRole('button', { name: 'Xem hồ sơ Mẫu p1' })).toBeVisible();
});

it('toggles fullscreen mode, updating button label to Thu nhỏ and keeping zoom controls active', () => {
  const rootPerson = person('root');
  const { container } = render(
    <FamilyTree
      people={[rootPerson]}
      relationships={[]}
      results={[rootPerson]}
      selectedId={rootPerson.id}
      onChoose={vi.fn()}
    />,
  );
  const fullscreenButton = screen.getByTestId('tree-fullscreen-button');
  expect(fullscreenButton).toHaveTextContent('Toàn màn hình');
  expect(fullscreenButton).toHaveAttribute('aria-label', 'Mở toàn màn hình');
  expect(fullscreenButton).toHaveAttribute('aria-pressed', 'false');

  const workspace = container.querySelector('.family-tree-workspace');
  expect(workspace).not.toHaveClass('is-fullscreen');

  // Click to open fullscreen
  fireEvent.click(fullscreenButton);
  expect(fullscreenButton).toHaveTextContent('Thu nhỏ');
  expect(fullscreenButton).toHaveAttribute('aria-label', 'Thu nhỏ toàn màn hình');
  expect(fullscreenButton).toHaveAttribute('aria-pressed', 'true');
  expect(workspace).toHaveClass('is-fullscreen');

  // Verify zoom controls work while in fullscreen
  const zoomIn = screen.getByRole('button', { name: 'Phóng to sơ đồ' });
  const zoomOut = screen.getByRole('button', { name: 'Thu nhỏ sơ đồ' });
  const initialZoom = screen.getByLabelText('Mức phóng sơ đồ').textContent;

  fireEvent.click(zoomIn);
  expect(screen.getByLabelText('Mức phóng sơ đồ').textContent).not.toBe(initialZoom);

  fireEvent.click(zoomOut);
  expect(screen.getByLabelText('Mức phóng sơ đồ').textContent).toBe(initialZoom);

  // Click to exit fullscreen (Thu nhỏ)
  fireEvent.click(fullscreenButton);
  expect(fullscreenButton).toHaveTextContent('Toàn màn hình');
  expect(fullscreenButton).toHaveAttribute('aria-label', 'Mở toàn màn hình');
  expect(fullscreenButton).toHaveAttribute('aria-pressed', 'false');
  expect(workspace).not.toHaveClass('is-fullscreen');

  // Test Escape key exit
  fireEvent.click(fullscreenButton);
  expect(workspace).toHaveClass('is-fullscreen');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(workspace).not.toHaveClass('is-fullscreen');
  expect(fullscreenButton).toHaveTextContent('Toàn màn hình');
});

it('synchronizes native fullscreen, guards repeated clicks and restores focus and scrolling', async () => {
  const native = mockFullscreen();
  const { container } = renderTree();
  const button = screen.getByTestId('tree-fullscreen-button');
  button.focus();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(native.request).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await waitFor(() => expect(button).toBeEnabled());
  expect(container.firstChild).toHaveClass('is-fullscreen');
  expect(screen.getByRole('region', { name: /Vùng sơ đồ/ })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
  expect(native.exit).toHaveBeenCalledTimes(1);
  expect(button).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

it('does not reenter fullscreen if the browser exits before the entry promise resolves', async () => {
  const native = mockFullscreen();
  let resolve!: () => void;
  native.request.mockImplementation(function (this: HTMLElement) {
    native.change(this);
    return new Promise<void>((done) => {
      resolve = done;
    });
  });
  const { container } = renderTree();
  fireEvent.click(screen.getByTestId('tree-fullscreen-button'));
  act(() => native.change(null));
  await act(async () => resolve());
  expect(container.firstChild).not.toHaveClass('is-fullscreen');
  expect(document.body.style.overflow).toBe('');
});

it('falls back after denied fullscreen, keeps wheel and keyboard navigation, and cleans up on unmount', async () => {
  const native = mockFullscreen();
  native.request.mockRejectedValue(new Error('denied'));
  const { container, unmount } = renderTree();
  fireEvent.click(screen.getByTestId('tree-fullscreen-button'));
  await waitFor(() => expect(container.firstChild).toHaveClass('is-fullscreen'));
  act(() => native.change(null));
  expect(container.firstChild).toHaveClass('is-fullscreen');
  const viewport = screen.getByRole('region', { name: /Vùng sơ đồ/ });
  const card = container.querySelector<HTMLElement>('.family-tree-card')!;
  const left = parseFloat(card.style.left),
    top = parseFloat(card.style.top);
  fireEvent.wheel(viewport, { deltaX: 20, deltaY: 30 });
  expect(parseFloat(card.style.left)).toBeCloseTo(left - 20);
  expect(parseFloat(card.style.top)).toBeCloseTo(top - 30);
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' });
  expect(parseFloat(card.style.left)).toBeCloseTo(left + 80);
  const zoom = screen.getByLabelText('Mức phóng sơ đồ').textContent;
  fireEvent.wheel(viewport, { deltaY: -30, ctrlKey: true, clientX: 180, clientY: 320 });
  expect(screen.getByLabelText('Mức phóng sơ đồ').textContent).not.toBe(zoom);
  unmount();
  expect(document.body.style.overflow).toBe('');
  expect(document.documentElement.style.overflow).toBe('');
});

it('keeps the fullscreen exit available if the browser rejects exiting', async () => {
  const native = mockFullscreen();
  native.exit.mockRejectedValueOnce(new Error('blocked'));
  const { container } = renderTree();
  const button = screen.getByTestId('tree-fullscreen-button');
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Chưa thể thu nhỏ'));
  expect(container.firstChild).toHaveClass('is-fullscreen');
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toBeEnabled();
  act(() => native.change(null));
  expect(container.firstChild).not.toHaveClass('is-fullscreen');
});

it('preserves zoom and the world point at the viewport center across fullscreen resize and return', () => {
  const { container } = renderTree();
  const viewport = screen.getByRole('region', { name: /Vùng sơ đồ/ });
  fireEvent.click(screen.getByRole('button', { name: 'Phóng to sơ đồ' }));
  fireEvent.wheel(viewport, { deltaX: 35, deltaY: 25 });
  const card = container.querySelector<HTMLElement>('.family-tree-card')!;
  const left = parseFloat(card.style.left),
    top = parseFloat(card.style.top);
  const transform = card.style.transform;
  fireEvent.click(screen.getByTestId('tree-fullscreen-button'));
  act(() => resizeViewport(1000, 800));
  expect(card.style.transform).toBe(transform);
  expect(parseFloat(card.style.left) - 500).toBeCloseTo(left - 180);
  expect(parseFloat(card.style.top) - 400).toBeCloseTo(top - 320);
  fireEvent.click(screen.getByTestId('tree-fullscreen-button'));
  act(() => resizeViewport(360, 640));
  expect(card.style.transform).toBe(transform);
  expect(parseFloat(card.style.left)).toBeCloseTo(left);
  expect(parseFloat(card.style.top)).toBeCloseTo(top);
});
