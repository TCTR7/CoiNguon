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
