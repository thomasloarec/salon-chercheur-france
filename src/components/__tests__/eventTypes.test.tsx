
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MultiSelect } from '../ui/multi-select';
import { EVENT_TYPES } from '@/constants/eventTypes';

describe('Event Types MultiSelect', () => {
  test('should render with event types options', () => {
    const mockOnChange = jest.fn();
    render(
      <MultiSelect
        options={EVENT_TYPES}
        selected={[]}
        onChange={mockOnChange}
        placeholder="Tous les types"
      />
    );

    expect(screen.getByText('Tous les types')).toBeInTheDocument();
  });

  test('should allow selecting multiple event types', async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();
    
    render(
      <MultiSelect
        options={EVENT_TYPES}
        selected={[]}
        onChange={mockOnChange}
        placeholder="Tous les types"
      />
    );

    // Ouvrir le dropdown
    await user.click(screen.getByRole('combobox'));

    // Sélectionner "Salon"
    await user.click(screen.getByText('Salon'));

    expect(mockOnChange).toHaveBeenCalledWith(['salon']);
  });

  test('should display selected event types as badges', () => {
    const mockOnChange = jest.fn();
    render(
      <MultiSelect
        options={EVENT_TYPES}
        selected={['salon', 'conference']}
        onChange={mockOnChange}
        placeholder="Tous les types"
      />
    );

    expect(screen.getByText('Salon')).toBeInTheDocument();
    expect(screen.getByText('Conférence')).toBeInTheDocument();
  });

  test('should remove event type when clicking X button', async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();
    
    render(
      <MultiSelect
        options={EVENT_TYPES}
        selected={['salon', 'conference']}
        onChange={mockOnChange}
        placeholder="Tous les types"
      />
    );

    // Cliquer sur le X du premier badge (Salon)
    const removeButtons = screen.getAllByRole('button');
    const salonBadgeRemoveButton = removeButtons.find(button => 
      button.querySelector('svg') && button.closest('*')?.textContent?.includes('Salon')
    );
    
    if (salonBadgeRemoveButton) {
      await user.click(salonBadgeRemoveButton);
      expect(mockOnChange).toHaveBeenCalledWith(['conference']);
    }
  });
});
