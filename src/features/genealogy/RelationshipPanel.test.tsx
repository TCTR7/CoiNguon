import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { RelationshipPanel } from './RelationshipPanel';
import { blankPerson, type FamilyPerson } from '../../shared/domain/genealogy';
import { genealogyMutation } from './service';
vi.mock('./service', () => ({ genealogyMutation: vi.fn() }));
const person: FamilyPerson = {
  ...blankPerson(),
  id: 'person',
  name: 'Người mẫu A',
  version: 1,
  archived: false,
};
const target: FamilyPerson = { ...person, id: 'target', name: 'Người mẫu B' };
beforeEach(() => vi.mocked(genealogyMutation).mockReset());
function openForm() {
  render(
    <RelationshipPanel
      clanId="clan"
      person={person}
      people={[person, target]}
      relations={[]}
      canEdit
      onError={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText('Thêm quan hệ gia đình'));
  return screen.getByLabelText('Mối quan hệ với Người mẫu A');
}
it('requires an explicit relationship and shows both names before saving', async () => {
  const direction = openForm();
  expect(direction).toHaveValue('');
  expect(screen.getByRole('option', { name: 'Chọn mối quan hệ…' })).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Người được liên kết'), { target: { value: target.id } });
  expect(
    screen.getByRole('option', { name: 'Người mẫu A là CHA / MẸ của Người mẫu B' }),
  ).toHaveValue('parent');
  expect(screen.getByRole('option', { name: 'Người mẫu A là CON của Người mẫu B' })).toHaveValue(
    'child',
  );
  expect(
    screen.getByRole('option', { name: 'Người mẫu A và Người mẫu B là VỢ / CHỒNG' }),
  ).toHaveValue('spouse');
  fireEvent.click(screen.getByRole('button', { name: 'Ghi quan hệ' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chọn mối quan hệ trước khi ghi quan hệ.',
  );
  expect(genealogyMutation).not.toHaveBeenCalled();
});
it.each(['parent', 'child', 'spouse'] as const)(
  'saves %s in the chosen direction and resets the choice',
  async (direction) => {
    vi.mocked(genealogyMutation).mockResolvedValue({ id: 'relation' });
    const select = openForm();
    fireEvent.change(screen.getByLabelText('Người được liên kết'), {
      target: { value: target.id },
    });
    fireEvent.change(select, { target: { value: direction } });
    const form = screen.getByRole('button', { name: 'Ghi quan hệ' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(genealogyMutation).toHaveBeenCalledTimes(1);
    expect(genealogyMutation).toHaveBeenCalledWith('clan', 'saveRelation', {
      version: null,
      relationship: {
        from: direction === 'child' ? target.id : person.id,
        to: direction === 'child' ? person.id : target.id,
        kind: direction === 'spouse' ? 'spouse' : 'parent',
        parentType: 'biological',
        status: 'current',
        source: '',
        verified: false,
      },
    });
    await waitFor(() => expect(select).toHaveValue(''));
    expect(screen.getByLabelText('Người được liên kết')).toHaveValue('');
  },
);
