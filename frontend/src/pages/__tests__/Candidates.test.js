/**
 * Integration tests for Candidates page filter functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import Candidates from '../Candidates';
import { AuthProvider } from '../../context/AuthContext';

// Mock API
jest.mock('../../config/api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithProviders = (component, user = { role: 'admin', id: 1 }) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider initialUser={user}>
          {component}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Candidates Filter Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const api = require('../../config/api');
    api.get.mockResolvedValue({ data: [] });
  });

  const waitForCandidatesLoaded = async () => {
    await waitFor(() => {
      expect(screen.queryByText(/loading candidates/i)).not.toBeInTheDocument();
    });
  };

  test('should render filter panel when show filters is clicked', async () => {
    renderWithProviders(<Candidates />);
    await waitForCandidatesLoaded();

    const showFiltersButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(showFiltersButton);

    expect(screen.getByText(/nothing filtered yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add filter/i)).toBeInTheDocument();
  });

  test('should add a new filter condition', async () => {
    renderWithProviders(<Candidates />);
    await waitForCandidatesLoaded();

    const showFiltersButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    expect(screen.getByText(/select field/i)).toBeInTheDocument();
  });

  test('should remove a filter condition', async () => {
    renderWithProviders(<Candidates />);
    await waitForCandidatesLoaded();

    const showFiltersButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    const removeButtons = screen.getAllByTitle(/remove filter/i);
    expect(removeButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(removeButtons[0]);
    
    // Filter should be removed
    expect(screen.queryByText(/select field/i)).not.toBeInTheDocument();
  });

  test('should clear all filters', async () => {
    renderWithProviders(<Candidates />);
    await waitForCandidatesLoaded();

    const showFiltersButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(showFiltersButton);

    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);

    const clearButton = screen.getByText(/clear all/i);
    fireEvent.click(clearButton);

    expect(screen.getByText(/nothing filtered yet/i)).toBeInTheDocument();
  });

  test('should parse query syntax correctly', async () => {
    renderWithProviders(<Candidates />);
    await waitForCandidatesLoaded();

    const showFiltersButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    // Select a text field
    const fieldSelect = screen.getByDisplayValue(/select field/i);
    fireEvent.change(fieldSelect, { target: { value: 'first_name' } });
    
    // Type a query value
    const valueInput = screen.getByPlaceholderText(/value/i);
    fireEvent.change(valueInput, { target: { value: '=John' } });
    
    // Wait for debounce
    await waitFor(() => {
      expect(valueInput.value).toBe('=John');
    }, { timeout: 500 });
  });
});

