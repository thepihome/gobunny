import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiArrowUp, FiArrowDown, FiSearch, FiFilter, FiX } from 'react-icons/fi';
import IconButton from '../components/IconButton';
import './Candidates.css';

const COLUMN_CONFIG = [
  { key: 'sr', label: 'Sr No', sortable: false },
  { key: 'fname', label: 'First Name', sortable: true },
  { key: 'lname', label: 'Last Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'phone', label: 'Phone', sortable: true },
  { key: 'position', label: 'Position', sortable: true },
  { key: 'start_date', label: 'Start Date', sortable: true },
  { key: 'price', label: 'Price', sortable: true },
  { key: 'ref', label: 'Ref', sortable: true },
];

const RegisterCandidates = () => {
  const { user, loading } = useAuth();

  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: rows = [], isLoading, isError, error } = useQuery(
    ['register-candidates'],
    () => api.get('/register-candidates').then(res => res.data),
    { refetchOnWindowFocus: false, staleTime: 30000, enabled: user?.role === 'admin' }
  );

  const filteredAndSorted = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const lowerSearch = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (!lowerSearch) return true;
      const fieldsToSearch = [
        row.fname,
        row.lname,
        row.email,
        row.phone,
        row.position,
        row.ref,
      ];
      return fieldsToSearch
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(lowerSearch));
    });

    const sorted = [...filtered].sort((a, b) => {
      let aVal;
      let bVal;

      if (sortColumn === 'sr') {
        return 0;
      }

      if (sortColumn === 'start_date') {
        aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
        bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
      } else if (sortColumn === 'price') {
        aVal = a.price != null ? parseFloat(a.price) : 0;
        bVal = b.price != null ? parseFloat(b.price) : 0;
      } else if (sortColumn === 'created_at') {
        aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else {
        aVal = a[sortColumn] ?? '';
        bVal = b[sortColumn] ?? '';
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Default sort by created_at desc if no explicit sort on other column
    if (sortColumn === 'created_at') {
      return sorted;
    }

    return sorted;
  }, [rows, search, sortColumn, sortDirection]);

  const handleSort = (columnKey) => {
    if (!COLUMN_CONFIG.find(c => c.key === columnKey)?.sortable) return;
    if (sortColumn === columnKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <div className="loading">Loading register candidates...</div>;
  }

  if (isError) {
    return (
      <div className="loading">
        Failed to load register candidates: {error?.response?.data?.error || error?.message}
      </div>
    );
  }

  const hasSearch = Boolean(search.trim());

  return (
    <div className="candidates-page list-page">
      <div className="page-header">
        <h1>Register</h1>
        <div className="list-page-header-actions page-toolbar">
          <IconButton
            icon={FiFilter}
            label={showFilters ? 'Hide filters' : 'Show filters'}
            active={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          />
        </div>
      </div>

      {showFilters && (
        <div className="list-filters-panel">
          <div className="filter-row">
            <div className="filter-group filter-group--wide">
              <label htmlFor="register-filter-search">Search</label>
              <div className="list-filter-input-icon">
                <FiSearch aria-hidden />
                <input
                  id="register-filter-search"
                  type="text"
                  placeholder="Name, email, phone, position, ref…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {hasSearch && (
              <button type="button" className="btn btn-secondary" onClick={() => setSearch('')}>
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="candidates-table-container">
        {filteredAndSorted.length === 0 ? (
          <div className="empty-state">No records found in register_candidates</div>
        ) : (
          <table
            className="table candidates-table"
            style={{ tableLayout: 'auto', minWidth: '900px' }}
          >
            <thead>
              <tr>
                {COLUMN_CONFIG.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ cursor: col.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {col.sortable && sortColumn === col.key && (
                        sortDirection === 'asc'
                          ? <FiArrowUp style={{ fontSize: 14 }} />
                          : <FiArrowDown style={{ fontSize: 14 }} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((row, index) => (
                <tr key={row.id || `${row.email}-${index}`}>
                  {COLUMN_CONFIG.map(col => {
                    if (col.key === 'sr') {
                      return <td key="sr">{index + 1}</td>;
                    }

                    let value = row[col.key];
                    if (col.key === 'start_date' && value) {
                      try {
                        const d = new Date(value);
                        if (!isNaN(d.getTime())) {
                          value = d.toISOString().slice(0, 10);
                        }
                      } catch {
                        // leave as-is
                      }
                    }

                    return (
                      <td key={col.key}>
                        {value === null || typeof value === 'undefined'
                          ? ''
                          : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegisterCandidates;

