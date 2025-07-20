
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AirtableStatusWidget from '../AirtableStatusWidget';
import { useAirtableStatus } from '@/hooks/useAirtableStatus';

// Mock the hook
vi.mock('@/hooks/useAirtableStatus');

const mockUseAirtableStatus = vi.mocked(useAirtableStatus);

describe('AirtableStatusWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onSecretsConfigured when secrets become OK', async () => {
    const mockOnSecretsConfigured = vi.fn();
    const mockCheckStatus = vi.fn();

    // First render: secrets not OK
    mockUseAirtableStatus.mockReturnValue({
      status: {
        secretsOk: false,
        missing: ['AIRTABLE_PAT'],
        testsOk: false,
        dedupOk: false,
        buttonsActive: false
      },
      isLoading: false,
      checkStatus: mockCheckStatus
    });

    const { rerender } = render(
      <AirtableStatusWidget onSecretsConfigured={mockOnSecretsConfigured} />
    );

    // Second render: secrets become OK
    mockUseAirtableStatus.mockReturnValue({
      status: {
        secretsOk: true,
        testsOk: true,
        dedupOk: true,
        buttonsActive: true
      },
      isLoading: false,
      checkStatus: mockCheckStatus
    });

    rerender(<AirtableStatusWidget onSecretsConfigured={mockOnSecretsConfigured} />);

    await waitFor(() => {
      expect(mockOnSecretsConfigured).toHaveBeenCalledTimes(1);
    });
  });

  it('should display missing variables instructions when secrets are not OK', () => {
    mockUseAirtableStatus.mockReturnValue({
      status: {
        secretsOk: false,
        missing: ['AIRTABLE_PAT', 'AIRTABLE_BASE_ID'],
        testsOk: false,
        dedupOk: false,
        buttonsActive: false
      },
      isLoading: false,
      checkStatus: vi.fn()
    });

    render(<AirtableStatusWidget />);

    expect(screen.getByText(/Variables manquantes:/)).toBeInTheDocument();
    expect(screen.getByText(/AIRTABLE_PAT, AIRTABLE_BASE_ID/)).toBeInTheDocument();
    expect(screen.getByText(/supabase functions deploy --all/)).toBeInTheDocument();
  });

  it('should show success state when all checks pass', () => {
    mockUseAirtableStatus.mockReturnValue({
      status: {
        secretsOk: true,
        testsOk: true,
        dedupOk: true,
        buttonsActive: true
      },
      isLoading: false,
      checkStatus: vi.fn()
    });

    render(<AirtableStatusWidget />);

    expect(screen.getByText('🟢 Tout fonctionne')).toBeInTheDocument();
    expect(screen.getByText('✅ OK')).toBeInTheDocument();
    expect(screen.getByText('✅ Actifs')).toBeInTheDocument();
  });
});
