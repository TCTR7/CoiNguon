import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { PersonForm } from './PersonForm';
import { blankPerson, type FamilyPerson } from '../../shared/domain/genealogy';
import { genealogyMutation } from './service';
vi.mock('./service', () => ({
  genealogyMutation: vi.fn(),
  GenealogyError: class extends Error {},
}));
const target: FamilyPerson = {
  ...blankPerson(),
  id: 'target',
  name: 'Người mẫu',
  version: 2,
  archived: false,
};
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(genealogyMutation).mockReset();
});
it.each(['parent', 'spouse', 'child'] as const)(
  'creates a %s with only a name and the correct relationship',
  async (kind) => {
    vi.mocked(genealogyMutation).mockResolvedValue({ id: 'new' });
    const onSaved = vi.fn();
    render(
      <PersonForm
        clanId="clan"
        personId="new"
        version={null}
        existingPeople={[target]}
        relative={{ kind, personId: target.id }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('person-details')).not.toHaveAttribute('open');
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), {
      target: { value: 'Người thân mẫu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('new'));
    expect(genealogyMutation).toHaveBeenCalledWith(
      'clan',
      'createPerson',
      expect.objectContaining({
        targetVersion: 2,
        person: { ...blankPerson(), name: 'Người thân mẫu' },
        relationship: {
          from: kind === 'child' ? 'target' : 'new',
          to: kind === 'child' ? 'new' : 'target',
          kind: kind === 'spouse' ? 'spouse' : 'parent',
          parentType: 'biological',
          status: 'current',
          source: '',
          verified: false,
        },
      }),
    );
  },
);
it('changes the link target, blocks duplicate submits and preserves the draft on failure', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(genealogyMutation).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const onSaved = vi.fn();
  render(
    <PersonForm
      clanId="clan"
      personId="new"
      version={null}
      existingPeople={[target, { ...target, id: 'other', name: 'Người mẫu khác', version: 3 }]}
      relative={{ kind: 'child', personId: target.id }}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Bản nháp mẫu' } });
  fireEvent.change(screen.getByLabelText('Người liên kết'), { target: { value: 'other' } });
  const form = screen.getByRole('button', { name: 'Lưu hồ sơ' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(genealogyMutation).toHaveBeenCalledTimes(1);
  expect(genealogyMutation).toHaveBeenCalledWith(
    'clan',
    'createPerson',
    expect.objectContaining({
      targetVersion: 3,
      relationship: expect.objectContaining({ from: 'other', to: 'new' }),
    }),
  );
  expect(screen.getByLabelText('Tên hiển thị')).toBeDisabled();
  reject(new Error('Lỗi kết nối thử nghiệm'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Tên hiển thị')).toHaveValue('Bản nháp mẫu');
  expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeEnabled();
  expect(onSaved).not.toHaveBeenCalled();
});

it('shows optional birth fields in the main form and opens extra fields when editing', () => {
  const props = {
    clanId: 'clan',
    personId: 'new',
    version: null,
    existingPeople: [],
    onSaved: vi.fn(),
    onCancel: vi.fn(),
  };
  const { rerender } = render(<PersonForm {...props} />);
  expect(screen.getByLabelText('Tên hiển thị')).toHaveFocus();
  expect(screen.getByLabelText('Năm sinh')).toBeVisible();
  expect(screen.getByText('Ngày sinh không bắt buộc.')).toBeVisible();
  expect(screen.queryByLabelText('Ngày mất')).not.toBeInTheDocument();
  expect(screen.getByTestId('person-details')).not.toHaveAttribute('open');
  rerender(<PersonForm {...props} initial={target} version={target.version} />);
  expect(screen.getByTestId('person-details')).toHaveAttribute('open');
  expect(screen.getByLabelText('Tên khác / tên thường gọi')).toBeVisible();
});
it.each(['unknown', 'living'] as const)(
  'clears the entire death date when changing from deceased to %s',
  async (lifeStatus) => {
    const initial: FamilyPerson = {
      ...target,
      lifeStatus: 'deceased',
      death: { calendar: 'lunar', day: 1, month: 4, year: 2020, leapMonth: true },
    };
    vi.mocked(genealogyMutation).mockResolvedValue({ id: initial.id });
    const onSaved = vi.fn();
    render(
      <PersonForm
        clanId="clan"
        initial={initial}
        personId={initial.id}
        version={initial.version}
        existingPeople={[]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Năm mất')).toHaveValue(2020);
    fireEvent.change(screen.getByLabelText('Tình trạng'), { target: { value: lifeStatus } });
    expect(screen.queryByLabelText('Ngày mất')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tình trạng'), { target: { value: 'deceased' } });
    expect(screen.getByLabelText('Năm mất')).toHaveValue(null);
    expect(screen.getByLabelText('Lịch ngày mất')).toHaveValue('solar');
    fireEvent.change(screen.getByLabelText('Tình trạng'), { target: { value: lifeStatus } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(initial.id));
    expect(genealogyMutation).toHaveBeenCalledWith(
      'clan',
      'updatePerson',
      expect.objectContaining({
        person: expect.objectContaining({ lifeStatus, death: blankPerson().death }),
      }),
    );
  },
);

it.each(['parent', 'child', 'spouse'] as const)(
  'uses presetRelation for the new %s role',
  async (role) => {
    vi.mocked(genealogyMutation).mockResolvedValue({ id: 'new' });
    render(
      <PersonForm
        clanId="clan"
        personId="new"
        version={null}
        existingPeople={[target]}
        presetRelation={{ targetId: target.id, role }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Liên kết quan hệ ngay (không bắt buộc)')).toBeVisible();
    expect(screen.getByLabelText('Mối quan hệ')).toHaveValue(role);
    expect(screen.getByLabelText('Người liên kết')).toHaveValue('target');
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Hồ sơ mẫu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() =>
      expect(genealogyMutation).toHaveBeenCalledWith(
        'clan',
        'createPerson',
        expect.objectContaining({
          initialRelation: { targetId: 'target', role },
          targetVersion: 2,
        }),
      ),
    );
  },
);
it('allows optional linking from ordinary creation and clearing the preset', async () => {
  vi.mocked(genealogyMutation).mockResolvedValue({ id: 'new' });
  render(
    <PersonForm
      clanId="clan"
      personId="new"
      version={null}
      existingPeople={[target]}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByTestId('quick-add-context')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Người liên kết'), { target: { value: 'target' } });
  fireEvent.change(screen.getByLabelText('Người liên kết'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Hồ sơ mẫu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  await waitFor(() => expect(genealogyMutation).toHaveBeenCalledTimes(1));
  expect(vi.mocked(genealogyMutation).mock.calls[0][2]).not.toHaveProperty('initialRelation');
});
