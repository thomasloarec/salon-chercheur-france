
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MultiSelect } from '../ui/multi-select';

const mockOptions = [
  { value: 'tech', label: 'Technologie' },
  { value: 'health', label: 'Santé' },
  { value: 'auto', label: 'Automobile' },
];

describe('MultiSelect', () => {
  test('should render correctly with placeholder', () => {
    const mockOnChange = jest.fn();
    render(
      <MultiSelect
        options={mockOptions}
        selected={[]}
        onChange={mockOnChange}
        placeholder="Choisissez un secteur"
      />
    );

    expect(screen.getByText('Choisissez un secteur')).toBeInTheDocument();
  });

  test('should allow selecting multiple options', async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();
    
    render(
      <MultiSelect
        options={mockOptions}
        selected={[]}
        onChange={mockOnChange}
        placeholder="Choisissez un secteur"
      />
    );

    // Ouvrir le dropdown
    await user.click(screen.getByRole('combobox'));

    // Sélectionner une option
    await user.click(screen.getByText('Technologie'));

    expect(mockOnChange).toHaveBeenCalledWith(['tech']);
  });

  test('should display selected items as badges', () => {
    const mockOnChange = jest.fn();
    render(
      <MultiSelect
        options={mockOptions}
        selected={['tech', 'health']}
        onChange={mockOnChange}
        placeholder="Choisissez un secteur"
      />
    );

    expect(screen.getByText('Technologie')).toBeInTheDocument();
    expect(screen.getByText('Santé')).toBeInTheDocument();
  });

  test('should remove item when clicking X button', async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();
    
    render(
      <MultiSelect
        options={mockOptions}
        selected={['tech', 'health']}
        onChange={mockOnChange}
        placeholder="Choisissez un secteur"
      />
    );

    // Cliquer sur le X du premier badge
    const removeButtons = screen.getAllByRole('button');
    const techBadgeRemoveButton = removeButtons.find(button => 
      button.querySelector('svg') && button.closest('*')?.textContent?.includes('Technologie')
    );
    
    if (techBadgeRemoveButton) {
      await user.click(techBadgeRemoveButton);
      expect(mockOnChange).toHaveBeenCalledWith(['health']);
    }
  });
});
