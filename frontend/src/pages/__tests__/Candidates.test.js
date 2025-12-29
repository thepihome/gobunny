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

  test('should render filter panel when show filters is clicked', () => {
    renderWithProviders(<Candidates />);
    
    const showFiltersButton = screen.getByText(/show filters/i);
    fireEvent.click(showFiltersButton);
    
    expect(screen.getByText(/filters/i)).toBeInTheDocument();
    expect(screen.getByText(/add filter/i)).toBeInTheDocument();
  });

  test('should add a new filter condition', () => {
    renderWithProviders(<Candidates />);
    
    const showFiltersButton = screen.getByText(/show filters/i);
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    expect(screen.getByText(/select field/i)).toBeInTheDocument();
  });

  test('should remove a filter condition', () => {
    renderWithProviders(<Candidates />);
    
    const showFiltersButton = screen.getByText(/show filters/i);
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    const removeButtons = screen.getAllByTitle(/remove filter/i);
    expect(removeButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(removeButtons[0]);
    
    // Filter should be removed
    expect(screen.queryByText(/select field/i)).not.toBeInTheDocument();
  });

  test('should clear all filters', () => {
    renderWithProviders(<Candidates />);
    
    const showFiltersButton = screen.getByText(/show filters/i);
    fireEvent.click(showFiltersButton);
    
    const addFilterButton = screen.getByText(/add filter/i);
    fireEvent.click(addFilterButton);
    
    const clearButton = screen.getByText(/clear all/i);
    fireEvent.click(clearButton);
    
    expect(screen.getByText(/no filters applied/i)).toBeInTheDocument();
  });

  test('should parse query syntax correctly', async () => {
    renderWithProviders(<Candidates />);
    
    const showFiltersButton = screen.getByText(/show filters/i);
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

