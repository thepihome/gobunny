import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FiSettings, FiUser, FiDroplet, FiUsers, FiShield, FiLock, FiSave, FiX, FiPlus, FiEdit, FiTrash2, FiMail, FiPhone, FiCalendar, FiEdit2, FiUserPlus, FiUserMinus, FiInfo } from 'react-icons/fi';
import './Settings.css';

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const { currentTheme, themes, changeTheme } = useTheme();
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
  const { data: userDetails } = useQuery(
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
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateProfileMutation.isLoading}
                  >
                    <FiSave /> {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
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
                <p>Choose your preferred color theme:</p>
                <div className="theme-grid">
                  {Object.entries(themes).map(([key, theme]) => (
                    <div
                      key={key}
                      className={`theme-card ${currentTheme === key ? 'active' : ''}`}
                      onClick={() => changeTheme(key)}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                        }}
                      >
                        <div className="theme-preview-content">
                          <div style={{ backgroundColor: theme.surface, color: theme.text, padding: '10px', borderRadius: '4px' }}>
                            Preview
                          </div>
                        </div>
                      </div>
                      <div className="theme-info">
                        <h3>{theme.name}</h3>
                        {currentTheme === key && <span className="theme-active-badge">Active</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'admin' && <UsersManagement />}

          {activeTab === 'groups' && user?.role === 'admin' && <GroupsManagement />}

          {activeTab === 'permissions' && user?.role === 'admin' && <PermissionsManagement />}
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
    if (!editingUser || !submitData.password) {
      delete submitData.password;
    }
    if (editingUser) {
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
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={updateMutation.isLoading}
                      >
                        <FiSave /> {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                      </button>
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

// Permissions Management Component
const PermissionsManagement = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [permissionType, setPermissionType] = useState('user'); // 'user' or 'group'

  const { data: permissions, isLoading: loadingPermissions } = useQuery(
    'permissions',
    () => api.get('/permissions').then(res => res.data)
  );

  const { data: users } = useQuery(
    'users',
    () => api.get('/users').then(res => res.data)
  );

  const { data: groups } = useQuery(
    'groups',
    () => api.get('/groups').then(res => res.data)
  );

  const { data: userPermsData } = useQuery(
    ['user-permissions', selectedUser?.id],
    () => api.get(`/permissions/user/${selectedUser.id}`).then(res => res.data),
    {
      enabled: !!selectedUser && permissionType === 'user',
    }
  );

  const { data: groupPermsData } = useQuery(
    ['group-permissions', selectedGroup?.id],
    () => api.get(`/permissions/group/${selectedGroup.id}`).then(res => res.data),
    {
      enabled: !!selectedGroup && permissionType === 'group',
    }
  );

  const updateUserPermissionsMutation = useMutation(
    ({ userId, permissions }) => api.post(`/permissions/user/${userId}`, { permissions }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['user-permissions', selectedUser?.id]);
        alert('User permissions updated successfully');
      },
    }
  );

  const updateGroupPermissionsMutation = useMutation(
    ({ groupId, permissions }) => api.post(`/permissions/group/${groupId}`, { permissions }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['group-permissions', selectedGroup?.id]);
        alert('Group permissions updated successfully');
      },
    }
  );

  // Group permissions by resource type
  const permissionsByResource = permissions?.reduce((acc, perm) => {
    if (!acc[perm.resource_type]) {
      acc[perm.resource_type] = [];
    }
    acc[perm.resource_type].push(perm);
    return acc;
  }, {}) || {};

  // Get effective permissions for display
  const getEffectivePermissions = () => {
    if (permissionType === 'user' && userPermsData) {
      const perms = {};
      userPermsData.permissions.forEach(p => {
        perms[p.id] = { ...p, effective: p.granted !== false, source: p.source || 'user' };
      });
      // Add role permissions that aren't overridden
      permissions?.forEach(perm => {
        if (!perms[perm.id]) {
          // Check if role has this permission
          const hasRolePerm = userPermsData.role === 'admin' || 
            (userPermsData.role === 'consultant' && ['tab_dashboard', 'tab_jobs', 'tab_matches', 'tab_candidates', 'tab_timesheets', 'tab_crm', 'tab_settings', 'job_view', 'job_create', 'job_edit', 'job_delete', 'candidate_view', 'candidate_edit', 'timesheet_view', 'timesheet_create', 'kpi_manage'].includes(perm.name)) ||
            (userPermsData.role === 'candidate' && ['tab_dashboard', 'tab_jobs', 'tab_resumes', 'tab_matches', 'tab_settings', 'job_view', 'kpi_manage'].includes(perm.name));
          perms[perm.id] = { ...perm, effective: hasRolePerm, source: 'role' };
        }
      });
      return perms;
    }
    if (permissionType === 'group' && groupPermsData) {
      const perms = {};
      groupPermsData.forEach(p => {
        perms[p.id] = { ...p, effective: p.granted !== false };
      });
      permissions?.forEach(perm => {
        if (!perms[perm.id]) {
          perms[perm.id] = { ...perm, effective: false };
        }
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
        granted: p.id === permissionId ? granted : (p.effective !== false),
      }));
      updateUserPermissionsMutation.mutate({
        userId: selectedUser.id,
        permissions: currentPerms,
      });
    } else if (permissionType === 'group' && selectedGroup) {
      const currentPerms = Object.values(effectivePermissions).map(p => ({
        permission_id: p.id,
        granted: p.id === permissionId ? granted : (p.effective !== false),
      }));
      updateGroupPermissionsMutation.mutate({
        groupId: selectedGroup.id,
        permissions: currentPerms,
      });
    }
  };

  return (
    <div className="settings-section">
      <h2>
        <FiShield /> Permissions & Access Control
      </h2>

      <div className="permissions-container">
        <div className="permissions-selector">
          <div className="permission-type-selector">
            <button
              className={`btn ${permissionType === 'user' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setPermissionType('user');
                setSelectedUser(null);
                setSelectedGroup(null);
              }}
            >
              User Permissions
            </button>
            <button
              className={`btn ${permissionType === 'group' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setPermissionType('group');
                setSelectedUser(null);
                setSelectedGroup(null);
              }}
            >
              Group Permissions
            </button>
          </div>

          {permissionType === 'user' && (
            <div className="entity-selector">
              <label>Select User:</label>
              <select
                value={selectedUser?.id || ''}
                onChange={(e) => {
                  const userId = parseInt(e.target.value);
                  const user = users?.find(u => u.id === userId);
                  setSelectedUser(user || null);
                }}
              >
                <option value="">-- Select a user --</option>
                {users?.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email}) - {user.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          {permissionType === 'group' && (
            <div className="entity-selector">
              <label>Select Group:</label>
              <select
                value={selectedGroup?.id || ''}
                onChange={(e) => {
                  const groupId = parseInt(e.target.value);
                  const group = groups?.find(g => g.id === groupId);
                  setSelectedGroup(group || null);
                }}
              >
                <option value="">-- Select a group --</option>
                {groups?.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingPermissions ? (
          <div className="loading">Loading permissions...</div>
        ) : (permissionType === 'user' && selectedUser) || (permissionType === 'group' && selectedGroup) ? (
          <div className="permissions-editor">
            <div className="permissions-info-header">
              <h3>
                {permissionType === 'user' 
                  ? `Permissions for ${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.role})`
                  : `Permissions for ${selectedGroup.name} Group`}
              </h3>
              {permissionType === 'user' && userPermsData && (
                <p className="permission-note">
                  Base role: <strong>{userPermsData.role}</strong>. User-specific permissions override role permissions.
                </p>
              )}
            </div>

            {Object.entries(permissionsByResource).map(([resourceType, perms]) => (
              <div key={resourceType} className="permission-resource-group">
                <h4 className="resource-type-header">
                  {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Permissions
                </h4>
                <div className="permissions-grid">
                  {perms.map(perm => {
                    const effective = effectivePermissions[perm.id];
                    const isGranted = effective?.effective !== false;
                    const source = effective?.source || (effective?.granted !== false ? 'custom' : 'none');
                    
                    return (
                      <div key={perm.id} className="permission-item">
                        <div className="permission-info">
                          <div className="permission-name">
                            <strong>{perm.name}</strong>
                            {source === 'role' && (
                              <span className="permission-source-badge">Role</span>
                            )}
                            {source === 'user' && (
                              <span className="permission-source-badge user">User</span>
                            )}
                            {source === 'group' && (
                              <span className="permission-source-badge group">Group</span>
                            )}
                          </div>
                          <div className="permission-description">{perm.description}</div>
                          <div className="permission-action">
                            <span className="action-badge">{perm.action}</span>
                          </div>
                        </div>
                        <div className="permission-toggle">
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={(e) => handlePermissionChange(perm.id, e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                          <span className="toggle-label">
                            {isGranted ? 'Granted' : 'Denied'}
                          </span>
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
            <p>Please select a {permissionType === 'user' ? 'user' : 'group'} to manage permissions.</p>
          </div>
        )}
      </div>

      <div className="permissions-help">
        <h3>Permission System Overview</h3>
        <div className="permission-help-content">
          <div className="help-section">
            <h4>How Permissions Work</h4>
            <ul>
              <li><strong>Role Permissions:</strong> Default permissions assigned based on user role (Admin, Consultant, Candidate)</li>
              <li><strong>Group Permissions:</strong> Permissions assigned to groups override role permissions for all members</li>
              <li><strong>User Permissions:</strong> Individual user permissions override both role and group permissions</li>
              <li><strong>Priority:</strong> User &gt; Group &gt; Role</li>
            </ul>
          </div>
          <div className="help-section">
            <h4>Permission Types</h4>
            <ul>
              <li><strong>Tab Permissions:</strong> Control which navigation tabs users can see</li>
              <li><strong>Job Permissions:</strong> Control who can view, create, edit, or delete jobs</li>
              <li><strong>User Permissions:</strong> Control who can manage user accounts</li>
              <li><strong>Candidate Permissions:</strong> Control candidate profile management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

