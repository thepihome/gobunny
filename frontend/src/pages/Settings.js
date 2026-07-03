import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiSettings, FiUser, FiDroplet, FiUsers, FiShield, FiSave, FiX, FiPlus, FiEdit, FiTrash2, FiMail, FiCalendar, FiEdit2, FiUserPlus, FiUserMinus, FiInfo, FiZap } from 'react-icons/fi';
import AiMatchingSettings from '../components/AiMatchingSettings';
import EmailSettings from '../components/EmailSettings';
import LoadingButton from '../components/LoadingButton';
import ThemeToggle from '../components/ThemeToggle';
import './Settings.css';

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const { accentTheme, accentThemes, themeMode, changeAccentTheme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    confirmPassword: '',
  });

  // Fetch user details
  useQuery(
    ['user-details', user?.id],
    () => api.get(`/users/${user?.id}`).then(res => res.data),
    {
      enabled: !!user?.id,
      onSuccess: (data) => {
        setProfileData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: data.phone || '',
          password: '',
          confirmPassword: '',
        });
      },
    }
  );

  const updateProfileMutation = useMutation(
    async (data) => {
      // All users can update their own profile
      const updateData = {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
      };
      
      // Only include role and is_active if user is admin
      if (user?.role === 'admin') {
        // Admin can update all fields, but for own profile we don't need role/is_active
        // They can manage other users from Users page
      }
      
      await api.put(`/users/${user.id}`, updateData);
      
      if (data.password) {
        await api.put(`/users/${user.id}/password`, { password: data.password });
      }
    },
    {
      onSuccess: async () => {
        queryClient.invalidateQueries(['user-details', user?.id]);
        queryClient.invalidateQueries('user');
        // Refresh user context
        await refreshUser();
        alert('Profile updated successfully');
        setProfileData({ ...profileData, password: '', confirmPassword: '' });
      },
      onError: (error) => {
        alert('Failed to update profile: ' + (error.response?.data?.error || error.message));
      },
    }
  );

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    
    if (profileData.password && profileData.password !== profileData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (profileData.password && profileData.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    updateProfileMutation.mutate(profileData);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser, roles: ['candidate', 'consultant', 'admin'] },
    { id: 'theme', label: 'Theme', icon: FiDroplet, roles: ['candidate', 'consultant', 'admin'] },
    ...(user?.role === 'admin' ? [
      { id: 'users', label: 'Users', icon: FiUsers, roles: ['admin'] },
      { id: 'groups', label: 'Groups', icon: FiUsers, roles: ['admin'] },
      { id: 'permissions', label: 'Permissions', icon: FiShield, roles: ['admin'] },
      { id: 'ai-matching', label: 'AI matching', icon: FiZap, roles: ['admin'] },
      { id: 'email', label: 'Email', icon: FiMail, roles: ['admin'] },
    ] : []),
  ];

  const filteredTabs = tabs.filter(tab => tab.roles.includes(user?.role));

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>
          <FiSettings /> Settings
        </h1>
      </div>

      <div className="settings-container">
        <div className="settings-sidebar">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="settings-content">
          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>
                <FiUser /> Profile Settings
              </h2>
              <form onSubmit={handleProfileSubmit} className="settings-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={profileData.password}
                      onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                      placeholder="Leave blank to keep current password"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      value={profileData.confirmPassword}
                      onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <LoadingButton
                    type="submit"
                    className="btn btn-primary"
                    icon={FiSave}
                    loading={updateProfileMutation.isLoading}
                    loadingLabel="Saving..."
                  >
                    Save Changes
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="settings-section">
              <h2>
                <FiDroplet /> Theme Settings
              </h2>
              <div className="theme-selector">
                <h3 className="theme-section-label">Appearance</h3>
                <p>Choose light, dark, or match your system preference.</p>
                <ThemeToggle />
                <h3 className="theme-section-label">Accent color</h3>
                <p>
                  {isDark
                    ? 'Accent colors apply in light mode. Switch to light to preview brand palettes.'
                    : 'Choose a brand accent for the light theme.'}
                </p>
                <div className={`theme-grid ${isDark ? 'theme-grid--disabled' : ''}`}>
                  {Object.entries(accentThemes).map(([key, theme]) => (
                    <button
                      key={key}
                      type="button"
                      className={`theme-card ${accentTheme === key ? 'active' : ''}`}
                      onClick={() => !isDark && changeAccentTheme(key)}
                      disabled={isDark}
                      aria-pressed={accentTheme === key}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                        }}
                      >
                        <div className="theme-preview-content">
                          <div
                            className="theme-preview-chip"
                            style={{ backgroundColor: theme.surface, color: theme.text }}
                          >
                            Preview
                          </div>
                        </div>
                      </div>
                      <div className="theme-info">
                        <h3>{theme.name}</h3>
                        {accentTheme === key && !isDark && (
                          <span className="theme-active-badge">Active</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="theme-mode-note">
                  Current mode: <strong>{themeMode === 'system' ? 'System' : themeMode}</strong>
                  {themeMode === 'system' && ' (follows OS preference)'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'admin' && <UsersManagement />}

          {activeTab === 'groups' && user?.role === 'admin' && <GroupsManagement />}

          {activeTab === 'permissions' && user?.role === 'admin' && <PermissionsManagement />}

          {activeTab === 'ai-matching' && user?.role === 'admin' && <AiMatchingSettings />}
          {activeTab === 'email' && user?.role === 'admin' && <EmailSettings />}
        </div>
      </div>
    </div>
  );
};

// Users Management Component (embedded in Settings)
const UsersManagement = () => {
  const queryClient = useQueryClient();
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

  const { data: users, isLoading } = useQuery(
    'users',
    () => api.get('/users').then(res => res.data)
  );

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

  const handleUserClick = (user) => {
    setSelectedUser(user);
    setShowUserDetails(true);
    setIsEditing(false);
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
    
    updateMutation.mutate({ id: selectedUser.id, data: userData });
    
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

  if (isLoading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="settings-section">
      <div className="section-header-with-action">
        <h2>
          <FiUsers /> User Management
        </h2>
        <button className="btn btn-primary" onClick={() => {
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
        }}>
          <FiPlus /> Add User
        </button>
      </div>

      <div className="users-table-container">
        <table className="table users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users && users.length > 0 ? (
              users.map((user) => (
                <tr 
                  key={user.id} 
                  className="user-row"
                  onClick={() => handleUserClick(user)}
                >
                  <td>
                    <div className="user-name-cell">
                      <FiUser className="user-icon" />
                      <span>{user.first_name} {user.last_name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td><span className="badge badge-info">{user.role}</span></td>
                  <td>{user.phone || 'N/A'}</td>
                  <td>
                    <span className={`badge badge-${user.is_active ? 'success' : 'danger'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) {
                          deleteMutation.mutate(user.id);
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

      {showUserDetails && selectedUser && (
        <div className="modal-overlay" onClick={() => {
          setShowUserDetails(false);
          setSelectedUser(null);
          setIsEditing(false);
        }}>
          <div className="modal-content user-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> User Details
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

            {loadingDetails ? (
              <div className="loading">Loading user details...</div>
            ) : userDetails ? (
              <>
                {!isEditing ? (
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

// Groups Management Component (embedded in Settings) - Simplified version
const GroupsManagement = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: groups, isLoading } = useQuery(
    'groups',
    () => api.get('/groups').then(res => res.data)
  );

  const { data: users } = useQuery(
    'users',
    () => api.get('/users').then(res => res.data)
  );

  const { data: groupDetails, isLoading: loadingDetails } = useQuery(
    ['group-details', selectedGroup?.id],
    () => api.get(`/groups/${selectedGroup.id}`).then(res => res.data),
    {
      enabled: !!selectedGroup && showGroupDetails,
    }
  );

  const createMutation = useMutation(
    (data) => api.post('/groups', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groups');
        setShowModal(false);
        setFormData({ name: '', description: '' });
      },
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => api.put(`/groups/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groups');
        setShowModal(false);
        setFormData({ name: '', description: '' });
      },
    }
  );

  const deleteMutation = useMutation(
    (id) => api.delete(`/groups/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('groups');
      },
    }
  );

  const addUserMutation = useMutation(
    ({ groupId, userId }) => api.post(`/groups/${groupId}/users/${userId}`),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries('groups');
        queryClient.invalidateQueries(['group-details', variables.groupId]);
        setShowUserModal(false);
      },
    }
  );

  const removeUserMutation = useMutation(
    ({ groupId, userId }) => api.delete(`/groups/${groupId}/users/${userId}`),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries('groups');
        queryClient.invalidateQueries(['group-details', variables.groupId]);
      },
    }
  );

  const handleViewGroup = (group) => {
    setSelectedGroup(group);
    setShowGroupDetails(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading groups...</div>;
  }

  return (
    <div className="settings-section">
      <div className="section-header-with-action">
        <h2>
          <FiUsers /> Group Management
        </h2>
        <button className="btn btn-primary" onClick={() => {
          setSelectedGroup(null);
          setFormData({ name: '', description: '' });
          setShowModal(true);
        }}>
          <FiPlus /> Add Group
        </button>
      </div>

      <div className="groups-list">
        {groups && groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="group-card" onClick={() => handleViewGroup(group)}>
              <div className="group-header">
                <div className="group-info">
                  <div className="group-title-section">
                    <h3>{group.name}</h3>
                    <button
                      className="btn-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewGroup(group);
                      }}
                      title="View group details"
                    >
                      <FiInfo /> View Details
                    </button>
                  </div>
                  {group.description && <p className="group-description">{group.description}</p>}
                  <div className="group-meta-info">
                    <span className="group-meta">
                      <FiUsers /> {group.user_count || 0} {group.user_count === 1 ? 'Member' : 'Members'}
                    </span>
                    {group.created_at && (
                      <span className="group-date">
                        <FiCalendar /> Created {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="group-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setSelectedGroup(group);
                      setFormData({ name: group.name, description: group.description || '' });
                      setShowModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <FiEdit /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowUserModal(true);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <FiUserPlus /> Manage Users
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(group.id)}
                    className="btn btn-danger btn-sm"
                  >
                    <FiTrash2 /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No groups found</div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedGroup ? 'Edit Group' : 'Add Group'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
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
                  {selectedGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUserModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Manage Users - {selectedGroup.name}</h2>
            <div className="users-list-modal">
              {users && users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="user-item-modal">
                    <span>{user.first_name} {user.last_name} ({user.email})</span>
                    <button
                      onClick={() => addUserMutation.mutate({ groupId: selectedGroup.id, userId: user.id })}
                      className="btn btn-success btn-sm"
                    >
                      <FiUserPlus /> Add
                    </button>
                  </div>
                ))
              ) : (
                <p>No users available</p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowUserModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupDetails && selectedGroup && (
        <div className="modal-overlay" onClick={() => {
          setShowGroupDetails(false);
          setSelectedGroup(null);
        }}>
          <div className="modal-content group-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiInfo /> {selectedGroup.name}
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => {
                  setShowGroupDetails(false);
                  setSelectedGroup(null);
                }}
              >
                <FiX />
              </button>
            </div>

            {loadingDetails ? (
              <div className="loading">Loading group details...</div>
            ) : groupDetails ? (
              <>
                <div className="group-details-info">
                  <div className="detail-section">
                    <h3>Group Information</h3>
                    {groupDetails.description && (
                      <p className="detail-description">{groupDetails.description}</p>
                    )}
                    <div className="detail-meta">
                      <div className="detail-item">
                        <strong>Created:</strong> {new Date(groupDetails.created_at).toLocaleString()}
                      </div>
                      {groupDetails.updated_at && (
                        <div className="detail-item">
                          <strong>Last Updated:</strong> {new Date(groupDetails.updated_at).toLocaleString()}
                        </div>
                      )}
                      <div className="detail-item">
                        <strong>Total Members:</strong> {groupDetails.users?.length || 0}
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <div className="section-header">
                      <h3>
                        <FiUsers /> Group Members ({groupDetails.users?.length || 0})
                      </h3>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setShowUserModal(true);
                          setShowGroupDetails(false);
                        }}
                      >
                        <FiUserPlus /> Add Members
                      </button>
                    </div>

                    {groupDetails.users && groupDetails.users.length > 0 ? (
                      <div className="members-list">
                        {groupDetails.users.map((user) => (
                          <div key={user.id} className="member-item">
                            <div className="member-info">
                              <div className="member-name">
                                {user.first_name} {user.last_name}
                              </div>
                              <div className="member-email">{user.email}</div>
                              <div className="member-role">
                                <span className={`badge badge-info`}>{user.role}</span>
                              </div>
                              {user.assigned_at && (
                                <div className="member-date">
                                  Joined: {new Date(user.assigned_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (window.confirm(`Remove ${user.first_name} ${user.last_name} from this group?`)) {
                                  removeUserMutation.mutate({
                                    groupId: selectedGroup.id,
                                    userId: user.id,
                                  });
                                }
                              }}
                            >
                              <FiUserMinus /> Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-members">
                        <p>No members in this group yet.</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setShowUserModal(true);
                            setShowGroupDetails(false);
                          }}
                        >
                          <FiUserPlus /> Add Members
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedGroup(groupDetails);
                      setFormData({ name: groupDetails.name, description: groupDetails.description || '' });
                      setShowModal(true);
                      setShowGroupDetails(false);
                    }}
                  >
                    <FiEdit /> Edit Group
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowGroupDetails(false);
                      setSelectedGroup(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="error">Failed to load group details</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PERMISSION_RESOURCE_LABELS = {
  tab: 'Navigation — tabs & sections (visibility)',
  job: 'Jobs — listings and postings',
  user: 'User accounts',
  candidate: 'Candidate profiles',
  timesheet: 'Timesheets',
  group: 'Groups',
  kpi: 'KPIs',
  system: 'System',
};

const PERMISSION_RESOURCE_ORDER = ['tab', 'job', 'candidate', 'user', 'timesheet', 'group', 'kpi', 'system'];

const PERMISSION_ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'assign', 'approve', 'manage'];

const ACTION_DISPLAY = {
  view: 'View / access',
  create: 'Create',
  edit: 'Edit / modify',
  delete: 'Delete',
  assign: 'Assign',
  approve: 'Approve',
  manage: 'Manage',
};

// Permissions Management Component
const PermissionsManagement = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [permissionType, setPermissionType] = useState('user');

  const {
    data: permissions,
    isLoading: loadingPermissions,
    isError: permissionsQueryError,
    error: permissionsQueryErr,
  } = useQuery('permissions', () => api.get('/permissions').then(res => res.data));

  const { data: users } = useQuery(
    'users',
    () => api.get('/users').then(res => res.data)
  );

  const { data: groups } = useQuery(
    'groups',
    () => api.get('/groups').then(res => res.data)
  );

  const {
    data: userPermsData,
    isLoading: loadingUserPerms,
    isError: userPermsError,
  } = useQuery(
    ['user-permissions', selectedUser?.id],
    () => api.get(`/permissions/user/${selectedUser.id}`).then(res => res.data),
    {
      enabled: !!selectedUser && permissionType === 'user',
    }
  );

  const { data: baselineRolePerms = [] } = useQuery(
    ['role-permissions', 'baseline', userPermsData?.role],
    () => api.get(`/permissions/role/${userPermsData.role}`).then(res => res.data),
    {
      enabled: !!userPermsData?.role && permissionType === 'user' && !!selectedUser,
    }
  );

  const {
    data: groupPermsData,
    isLoading: loadingGroupPerms,
    isError: groupPermsError,
  } = useQuery(
    ['group-permissions', selectedGroup?.id],
    () => api.get(`/permissions/group/${selectedGroup.id}`).then(res => res.data),
    {
      enabled: !!selectedGroup && permissionType === 'group',
    }
  );

  const { data: rolePermsData, isLoading: loadingRolePerms } = useQuery(
    ['role-permissions', selectedRole],
    () => api.get(`/permissions/role/${selectedRole}`).then(res => res.data),
    {
      enabled: !!selectedRole && permissionType === 'role',
    }
  );

  const updateUserPermissionsMutation = useMutation(
    ({ userId, permissions: permPayload }) => api.post(`/permissions/user/${userId}`, { permissions: permPayload }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['user-permissions', selectedUser?.id]);
        alert('User permissions updated successfully');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const updateGroupPermissionsMutation = useMutation(
    ({ groupId, permissions: permPayload }) => api.post(`/permissions/group/${groupId}`, { permissions: permPayload }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['group-permissions', selectedGroup?.id]);
        alert('Group permissions updated successfully');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const updateRolePermissionsMutation = useMutation(
    ({ role, permissions: permPayload }) => api.post(`/permissions/role/${role}`, { permissions: permPayload }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['role-permissions']);
        queryClient.invalidateQueries('user-permissions');
        alert('Role default permissions updated successfully');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const permissionsByResource = useMemo(() => {
    const acc = {};
    (permissions || []).forEach(perm => {
      if (!acc[perm.resource_type]) acc[perm.resource_type] = [];
      acc[perm.resource_type].push(perm);
    });
    Object.keys(acc).forEach(key => {
      acc[key].sort((a, b) => {
        const ia = PERMISSION_ACTION_ORDER.indexOf(a.action);
        const ib = PERMISSION_ACTION_ORDER.indexOf(b.action);
        if (ia !== -1 || ib !== -1) {
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          if (ia !== ib) return ia - ib;
        }
        return String(a.name).localeCompare(String(b.name));
      });
    });
    return acc;
  }, [permissions]);

  const sortedResourceEntries = useMemo(() => {
    return Object.entries(permissionsByResource).sort(([a], [b]) => {
      const ia = PERMISSION_RESOURCE_ORDER.indexOf(a);
      const ib = PERMISSION_RESOURCE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [permissionsByResource]);

  const baselineRoleIds = useMemo(() => new Set((baselineRolePerms || []).map(p => p.id)), [baselineRolePerms]);

  const getEffectivePermissions = () => {
    if (!permissions?.length) return {};

    if (permissionType === 'user' && userPermsData) {
      const perms = {};
      (userPermsData.permissions || []).forEach(p => {
        perms[p.id] = { ...p, effective: p.granted !== false, source: p.source || 'user' };
      });
      permissions.forEach(perm => {
        if (!perms[perm.id]) {
          const hasRolePerm = baselineRoleIds.has(perm.id);
          perms[perm.id] = { ...perm, effective: hasRolePerm, source: 'role' };
        }
      });
      return perms;
    }

    if (permissionType === 'group' && selectedGroup && Array.isArray(groupPermsData)) {
      const perms = {};
      groupPermsData.forEach(p => {
        perms[p.id] = { ...p, effective: p.granted !== false, source: 'group' };
      });
      permissions.forEach(perm => {
        if (!perms[perm.id]) {
          perms[perm.id] = { ...perm, effective: false, source: 'none' };
        }
      });
      return perms;
    }

    if (permissionType === 'role' && selectedRole && Array.isArray(rolePermsData)) {
      const grantedIds = new Set(rolePermsData.map(p => p.id));
      const perms = {};
      permissions.forEach(perm => {
        const granted = grantedIds.has(perm.id);
        perms[perm.id] = { ...perm, effective: granted, source: granted ? 'role' : 'none' };
      });
      return perms;
    }

    return {};
  };

  const effectivePermissions = getEffectivePermissions();

  const handlePermissionChange = (permissionId, granted) => {
    if (permissionType === 'user' && selectedUser) {
      const currentPerms = Object.values(effectivePermissions).map(p => ({
        permission_id: p.id,
        granted: p.id === permissionId ? granted : p.effective !== false,
      }));
      updateUserPermissionsMutation.mutate({
        userId: selectedUser.id,
        permissions: currentPerms,
      });
    } else if (permissionType === 'group' && selectedGroup) {
      const currentPerms = Object.values(effectivePermissions).map(p => ({
        permission_id: p.id,
        granted: p.id === permissionId ? granted : p.effective !== false,
      }));
      updateGroupPermissionsMutation.mutate({
        groupId: selectedGroup.id,
        permissions: currentPerms,
      });
    } else if (permissionType === 'role' && selectedRole) {
      const currentPerms = Object.values(effectivePermissions).map(p => ({
        permission_id: p.id,
        granted: p.id === permissionId ? granted : p.effective !== false,
      }));
      updateRolePermissionsMutation.mutate({
        role: selectedRole,
        permissions: currentPerms,
      });
    }
  };

  const clearSelection = (type) => {
    setPermissionType(type);
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedRole('');
  };

  const hasPermissionCatalog = permissions && permissions.length > 0;

  const editorActive =
    hasPermissionCatalog &&
    ((permissionType === 'user' && selectedUser && userPermsData && !userPermsError) ||
      (permissionType === 'group' && selectedGroup && !loadingGroupPerms && !groupPermsError) ||
      (permissionType === 'role' && selectedRole && !loadingRolePerms));

  return (
    <div className="settings-section">
      <h2>
        <FiShield /> Permissions & Access Control
      </h2>

      <div className="permissions-container">
        <div className="permissions-selector">
          <div className="permission-type-selector">
            <button
              type="button"
              className={`btn ${permissionType === 'user' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => clearSelection('user')}
            >
              By user
            </button>
            <button
              type="button"
              className={`btn ${permissionType === 'group' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => clearSelection('group')}
            >
              By group
            </button>
            <button
              type="button"
              className={`btn ${permissionType === 'role' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => clearSelection('role')}
            >
              Role defaults
            </button>
          </div>

          {permissionType === 'user' && (
            <div className="entity-selector">
              <label htmlFor="perm-select-user">User</label>
              <select
                id="perm-select-user"
                value={selectedUser?.id || ''}
                onChange={(e) => {
                  const userId = parseInt(e.target.value, 10);
                  const u = users?.find(x => x.id === userId);
                  setSelectedUser(u || null);
                }}
              >
                <option value="">— Select a user —</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email}) — {u.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          {permissionType === 'group' && (
            <div className="entity-selector">
              <label htmlFor="perm-select-group">Group</label>
              <select
                id="perm-select-group"
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const groupId = parseInt(e.target.value, 10);
                  const g = groups?.find(x => x.id === groupId);
                  setSelectedGroup(g || null);
                }}
              >
                <option value="">— Select a group —</option>
                {groups?.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {permissionType === 'role' && (
            <div className="entity-selector">
              <label htmlFor="perm-select-role">Role template</label>
              <select
                id="perm-select-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">— Select role —</option>
                <option value="admin">Administrator</option>
                <option value="consultant">Consultant</option>
                <option value="candidate">Candidate</option>
              </select>
            </div>
          )}
        </div>

        {permissionsQueryError ? (
          <div className="error">
            Could not load permission definitions:{' '}
            {permissionsQueryErr?.response?.data?.error || permissionsQueryErr?.message || 'Request failed'}
          </div>
        ) : loadingPermissions ? (
          <div className="loading">Loading permissions...</div>
        ) : !hasPermissionCatalog ? (
          <div className="permissions-seed-missing">
            <p>
              <strong>No permission definitions in the database.</strong> The catalog is empty, so there is nothing to
              assign to users or groups.
            </p>
            <p>
              For Cloudflare D1, run the seed migration once (from the <code>backend</code> folder), replacing{' '}
              <code>YOUR_DB_NAME</code> with your D1 database name from <code>wrangler.toml</code>:
            </p>
            <pre className="permissions-cli-hint">
              npx wrangler d1 execute YOUR_DB_NAME --remote --file=./database/migrations/seed_permissions_d1.sql
            </pre>
            <p className="permissions-seed-note">Use <code>--local</code> instead of <code>--remote</code> for local dev.</p>
          </div>
        ) : permissionType === 'user' && selectedUser && loadingUserPerms ? (
          <div className="loading">Loading user permissions...</div>
        ) : permissionType === 'user' && selectedUser && userPermsError ? (
          <div className="error">Could not load effective permissions for this user.</div>
        ) : permissionType === 'group' && selectedGroup && loadingGroupPerms ? (
          <div className="loading">Loading group permissions...</div>
        ) : permissionType === 'group' && selectedGroup && groupPermsError ? (
          <div className="error">Could not load permissions for this group.</div>
        ) : permissionType === 'role' && selectedRole && loadingRolePerms ? (
          <div className="loading">Loading role permissions...</div>
        ) : editorActive ? (
          <div className="permissions-editor">
            <div className="permissions-info-header">
              <h3>
                {permissionType === 'user' &&
                  `User: ${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.role})`}
                {permissionType === 'group' && `Group: ${selectedGroup.name}`}
                {permissionType === 'role' && `Role defaults: ${selectedRole}`}
              </h3>
              {permissionType === 'user' && userPermsData && (
                <p className="permission-note">
                  Effective access is <strong>user</strong> overrides → <strong>group</strong> → <strong>role</strong>.
                  Toggles here write <strong>user-specific</strong> rows (full matrix). Role baseline is loaded from the
                  database for <strong>{userPermsData.role}</strong>.
                </p>
              )}
              {permissionType === 'group' && (
                <p className="permission-note">
                  Group grants apply to every member and override their role defaults. Deny explicitly where needed.
                </p>
              )}
              {permissionType === 'role' && (
                <p className="permission-note role-defaults-warning">
                  This updates the default permission set for <strong>all</strong> accounts with the{' '}
                  <strong>{selectedRole}</strong> role (unless overridden by group or user). Use carefully.
                </p>
              )}
            </div>

            <p className="permissions-section-hint">
              <strong>Tabs</strong> control which areas appear; other rows control viewing vs creating, editing, or
              deleting content where the API enforces them.
            </p>

            {sortedResourceEntries.map(([resourceType, perms]) => (
              <div key={resourceType} className="permission-resource-group">
                <h4 className="resource-type-header">
                  {PERMISSION_RESOURCE_LABELS[resourceType] ||
                    `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} — permissions`}
                </h4>
                <div className="permissions-grid">
                  {perms.map(perm => {
                    const effective = effectivePermissions[perm.id];
                    const isGranted = effective?.effective !== false;
                    const source = effective?.source;

                    return (
                      <div key={perm.id} className="permission-item">
                        <div className="permission-info">
                          <div className="permission-name">
                            <strong>{perm.name}</strong>
                            {source === 'role' && <span className="permission-source-badge">Role</span>}
                            {source === 'user' && <span className="permission-source-badge user">User</span>}
                            {source === 'group' && <span className="permission-source-badge group">Group</span>}
                            {source === 'none' && permissionType === 'role' && (
                              <span className="permission-source-badge off">Off</span>
                            )}
                          </div>
                          <div className="permission-description">{perm.description}</div>
                          <div className="permission-action">
                            <span className="action-badge">
                              {ACTION_DISPLAY[perm.action] || perm.action}
                            </span>
                          </div>
                        </div>
                        <div className="permission-toggle">
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={(e) => handlePermissionChange(perm.id, e.target.checked)}
                            />
                            <span className="toggle-slider" />
                          </label>
                          <span className="toggle-label">{isGranted ? 'Granted' : 'Denied'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="permissions-placeholder">
            <p>
              {permissionType === 'user' && 'Select a user to view and edit their permission matrix.'}
              {permissionType === 'group' && 'Select a group to define overrides for all members.'}
              {permissionType === 'role' && 'Select Administrator, Consultant, or Candidate to edit default role permissions.'}
            </p>
          </div>
        )}
      </div>

      <div className="permissions-help">
        <h3>How access is resolved</h3>
        <div className="permission-help-content">
          <div className="help-section">
            <h4>Priority order</h4>
            <ul>
              <li>
                <strong>User-specific</strong> (this screen, &quot;By user&quot;) — highest priority
              </li>
              <li>
                <strong>Group</strong> — applies to all members of the group
              </li>
              <li>
                <strong>Role defaults</strong> (&quot;Role defaults&quot; tab) — baseline for admin, consultant, and
                candidate
              </li>
            </ul>
          </div>
          <div className="help-section">
            <h4>What you can control</h4>
            <ul>
              <li>
                <strong>Navigation (tab_*)</strong> — which sections users can access in the app (where the UI checks
                these flags).
              </li>
              <li>
                <strong>View / create / edit / delete</strong> — content actions for jobs, candidates, users, and
                timesheets (enforced on the server for protected routes).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

