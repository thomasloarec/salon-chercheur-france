
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('combobox'));

    // Sélectionner deux options
    await waitFor(() => {
      fireEvent.click(screen.getByText('Technologie'));
    });

    expect(mockOnChange).toHaveBeenCalledWith(['tech']);

    // Re-render avec la nouvelle sélection
    mockOnChange.mockClear();
    render(
      <MultiSelect
        options={mockOptions}
        selected={['tech']}
        onChange={mockOnChange}
        placeholder="Choisissez un secteur"
      />
    );

    fireEvent.click(screen.getByRole('combobox'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Santé'));
    });

    expect(mockOnChange).toHaveBeenCalledWith(['tech', 'health']);
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

  test('should remove item when clicking X button', () => {
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
    const badges = screen.getAllByRole('button');
    const removeButton = badges.find(button => 
      button.querySelector('svg') && button.parentElement?.textContent?.includes('Technologie')
    );
    
    if (removeButton) {
      fireEvent.click(removeButton);
      expect(mockOnChange).toHaveBeenCalledWith(['health']);
    }
  });
});
