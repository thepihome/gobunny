import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiTrash2, FiUser, FiMail, FiCalendar, FiX, FiUsers, FiEdit2, FiSave } from 'react-icons/fi';
import LoadingButton from '../components/LoadingButton';
import UserActivityTimeline from '../components/UserActivityTimeline';
import { useResizableColumns } from '../hooks/useResizableColumns';
import './Users.css';

const ROLE_FILTERS = [
  { value: 'all', label: 'All users' },
  { value: 'consultant', label: 'Consultants' },
  { value: 'candidate', label: 'Candidates' },
  { value: 'admin', label: 'Admins' },
];

const Users = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('all');
  const [detailTab, setDetailTab] = useState('profile');
  const [showModal, setShowModal] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'candidate',
    phone: '',
    is_active: true,
  });

  const { tableRef, getColumnProps, ResizeHandle } = useResizableColumns(
    [180, 220, 110, 120, 100, 120],
    'users-table-columns',
    [100, 120, 80, 90, 80, 100]
  );

  const { data: users, isLoading } = useQuery(
    'users',
    () => api.get('/users').then(res => res.data),
    { enabled: user?.role === 'admin' }
  );

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (roleFilter === 'all') return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  // Fetch detailed user info when a user is selected
  const { data: userDetails, isLoading: loadingDetails } = useQuery(
    ['user-details', selectedUser?.id],
    () => api.get(`/users/${selectedUser.id}`).then(res => res.data),
    {
      enabled: !!selectedUser && showUserDetails,
    }
  );

  const createMutation = useMutation(
    (data) => api.post('/users', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        setShowModal(false);
        setFormData({
          email: '',
          password: '',
          first_name: '',
          last_name: '',
          role: 'candidate',
          phone: '',
          is_active: true,
        });
      },
      onError: (err) => {
        const msg = err.response?.data?.error || err.message;
        alert(msg || 'Could not create user');
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/users/${id}`, data),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries('users');
        queryClient.invalidateQueries(['user-details', variables.id]);
        setShowModal(false);
        setEditingUser(null);
        setIsEditing(false);
        setFormData({
          email: '',
          password: '',
          first_name: '',
          last_name: '',
          role: 'candidate',
          phone: '',
          is_active: true,
        });
      },
    }
  );

  const updatePasswordMutation = useMutation(
    ({ id, password }) => api.put(`/users/${id}/password`, { password }),
    {
      onSuccess: (data, variables) => {
        setFormData({ ...formData, password: '' });
        queryClient.invalidateQueries(['user-details', variables.id]);
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => api.delete(`/users/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );

  const handleUserClick = (row) => {
    setSelectedUser(row);
    setShowUserDetails(true);
    setIsEditing(false);
    setDetailTab('profile');
  };

  const handleEditUser = () => {
    if (userDetails) {
      setFormData({
        email: userDetails.email,
        first_name: userDetails.first_name,
        last_name: userDetails.last_name,
        role: userDetails.role,
        phone: userDetails.phone || '',
        is_active: userDetails.is_active,
        password: '',
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'candidate',
      phone: '',
      is_active: true,
    });
  };

  const handleSaveUser = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    const submitData = { ...formData };
    const { password, ...userData } = submitData;
    
    // Update user info
    updateMutation.mutate({ id: selectedUser.id, data: userData });
    
    // Update password separately if provided
    if (password && password.trim() !== '') {
      updatePasswordMutation.mutate({ id: selectedUser.id, password });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (editingUser) {
      if (!submitData.password || String(submitData.password).trim() === '') {
        delete submitData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="users-page list-page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="users-page-subtitle">
            View all platform users, activity logs, and CRM interactions by user.
          </p>
        </div>
        <div className="list-page-header-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditingUser(null);
              setFormData({
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                role: 'candidate',
                phone: '',
                is_active: true,
              });
              setShowModal(true);
            }}
          >
            <FiPlus /> Add User
          </button>
        </div>
      </div>

      <div className="users-role-filters">
        {ROLE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`users-role-filter${roleFilter === value ? ' active' : ''}`}
            onClick={() => setRoleFilter(value)}
          >
            {label}
            {users && (
              <span className="users-role-filter-count">
                {value === 'all' ? users.length : users.filter((u) => u.role === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="users-table-container">
        <table ref={tableRef} className="table users-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th {...getColumnProps(0)}>Name<ResizeHandle index={0} /></th>
              <th {...getColumnProps(1)}>Email<ResizeHandle index={1} /></th>
              <th {...getColumnProps(2)}>Role<ResizeHandle index={2} /></th>
              <th {...getColumnProps(3)}>Phone<ResizeHandle index={3} /></th>
              <th {...getColumnProps(4)}>Status<ResizeHandle index={4} /></th>
              <th {...getColumnProps(5)}>Actions<ResizeHandle index={5} /></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((row) => (
                <tr 
                  key={row.id} 
                  className="user-row"
                  onClick={() => handleUserClick(row)}
                >
                  <td>
                    <div className="user-name-cell">
                      <FiUser className="user-icon" />
                      <span>{row.first_name} {row.last_name}</span>
                    </div>
                  </td>
                  <td>{row.email}</td>
                  <td><span className={`badge badge-info badge-role-${row.role}`}>{row.role}</span></td>
                  <td>{row.phone || 'N/A'}</td>
                  <td>
                    <span className={`badge badge-${row.is_active ? 'success' : 'danger'}`}>
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${row.first_name} ${row.last_name}?`)) {
                          deleteMutation.mutate(row.id);
                        }
                      }}
                      className="btn btn-danger btn-sm"
                    >
                      <FiTrash2 /> Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-state">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Add User'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              {(!editingUser || formData.password) && (
                <div className="form-group">
                  <label>Password{editingUser && ' (leave blank to keep current)'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="candidate">Candidate</option>
                  <option value="consultant">Consultant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="modal-overlay" onClick={() => {
          setShowUserDetails(false);
          setSelectedUser(null);
          setIsEditing(false);
        }}>
          <div className="modal-content user-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> {selectedUser.first_name} {selectedUser.last_name}
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => {
                  setShowUserDetails(false);
                  setSelectedUser(null);
                  setIsEditing(false);
                }}
              >
                <FiX />
              </button>
            </div>

            {!isEditing && (
              <div className="user-detail-tabs">
                <button
                  type="button"
                  className={`user-detail-tab${detailTab === 'profile' ? ' active' : ''}`}
                  onClick={() => setDetailTab('profile')}
                >
                  Profile
                </button>
                {(selectedUser.role === 'consultant' || selectedUser.role === 'candidate') && (
                  <button
                    type="button"
                    className={`user-detail-tab${detailTab === 'activity' ? ' active' : ''}`}
                    onClick={() => setDetailTab('activity')}
                  >
                    Activity &amp; CRM
                  </button>
                )}
              </div>
            )}

            {loadingDetails ? (
              <div className="loading">Loading user details...</div>
            ) : userDetails ? (
              <>
                {detailTab === 'activity' && !isEditing && (selectedUser.role === 'consultant' || selectedUser.role === 'candidate') ? (
                  <UserActivityTimeline userId={selectedUser.id} userRole={selectedUser.role} />
                ) : !isEditing ? (
                  // View Mode
                  <div className="user-details-view">
                    <div className="user-profile-header">
                      <div className="user-avatar">
                        <FiUser size={48} />
                      </div>
                      <div className="user-basic-info">
                        <h3>{userDetails.first_name} {userDetails.last_name}</h3>
                        <p className="user-email">
                          <FiMail /> {userDetails.email}
                        </p>
                        <div className="user-status-badges">
                          <span className={`badge badge-${userDetails.is_active ? 'success' : 'danger'}`}>
                            {userDetails.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="badge badge-info">{userDetails.role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="user-details-sections">
                      <div className="detail-section">
                        <h4>
                          <FiUser /> Personal Information
                        </h4>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <strong>First Name:</strong>
                            <span>{userDetails.first_name}</span>
                          </div>
                          <div className="detail-item">
                            <strong>Last Name:</strong>
                            <span>{userDetails.last_name}</span>
                          </div>
                          <div className="detail-item">
                            <strong>Email:</strong>
                            <span>{userDetails.email}</span>
                          </div>
                          <div className="detail-item">
                            <strong>Phone:</strong>
                            <span>{userDetails.phone || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <strong>Role:</strong>
                            <span className="badge badge-info">{userDetails.role}</span>
                          </div>
                          <div className="detail-item">
                            <strong>Status:</strong>
                            <span className={`badge badge-${userDetails.is_active ? 'success' : 'danger'}`}>
                              {userDetails.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="detail-section">
                        <h4>
                          <FiCalendar /> Account Information
                        </h4>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <strong>Created:</strong>
                            <span>{new Date(userDetails.created_at).toLocaleString()}</span>
                          </div>
                          {userDetails.updated_at && (
                            <div className="detail-item">
                              <strong>Last Updated:</strong>
                              <span>{new Date(userDetails.updated_at).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {userDetails.groups && userDetails.groups.length > 0 && (
                        <div className="detail-section">
                          <h4>
                            <FiUsers /> Groups ({userDetails.groups.length})
                          </h4>
                          <div className="groups-list-inline">
                            {userDetails.groups.map((group) => (
                              <span key={group.id} className="group-badge">
                                {group.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleEditUser}
                      >
                        <FiEdit2 /> Edit User
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowUserDetails(false);
                          setSelectedUser(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveUser} className="user-edit-form">
                    <div className="user-profile-header">
                      <div className="user-avatar">
                        <FiUser size={48} />
                      </div>
                      <div className="user-basic-info">
                        <h3>Edit User Profile</h3>
                        <p className="user-email">{userDetails.email}</p>
                      </div>
                    </div>

                    <div className="form-sections">
                      <div className="form-section">
                        <h4>Personal Information</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label>First Name</label>
                            <input
                              type="text"
                              value={formData.first_name}
                              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Last Name</label>
                            <input
                              type="text"
                              value={formData.last_name}
                              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Phone</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-section">
                        <h4>Account Settings</h4>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Role</label>
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                              required
                            >
                              <option value="candidate">Candidate</option>
                              <option value="consultant">Consultant</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Status</label>
                            <select
                              value={formData.is_active ? 'active' : 'inactive'}
                              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>New Password (leave blank to keep current)</label>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Enter new password"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                      <LoadingButton
                        type="submit"
                        className="btn btn-primary"
                        icon={FiSave}
                        loading={updateMutation.isLoading}
                        loadingLabel="Saving..."
                      >
                        Save Changes
                      </LoadingButton>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="error">Failed to load user details</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

