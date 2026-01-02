import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiDatabase, FiBriefcase, FiPlus, FiEdit, FiTrash2, FiX, FiSave } from 'react-icons/fi';
import { useResizableColumns } from '../hooks/useResizableColumns';
import './Metadata.css';

const Metadata = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('roles');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });

  // Fetch job roles
  const { data: jobRoles = [], isLoading: isLoadingRoles } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then(res => res.data),
    {
      enabled: user?.role === 'admin'
    }
  );

  const createRoleMutation = useMutation(
    async (data) => {
      return api.post('/job-roles', data).then(res => res.data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-roles');
        setShowRoleModal(false);
        setRoleFormData({ name: '', description: '', is_active: true });
        setEditingRole(null);
      },
      onError: (error) => {
        alert('Failed to create job role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  const updateRoleMutation = useMutation(
    async ({ id, data }) => {
      return api.put(`/job-roles/${id}`, data).then(res => res.data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-roles');
        setShowRoleModal(false);
        setRoleFormData({ name: '', description: '', is_active: true });
        setEditingRole(null);
      },
      onError: (error) => {
        alert('Failed to update job role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  const deleteRoleMutation = useMutation(
    async (id) => {
      return api.delete(`/job-roles/${id}`).then(res => res.data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-roles');
      },
      onError: (error) => {
        alert('Failed to delete job role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  const handleAddRole = () => {
    setEditingRole(null);
    setRoleFormData({ name: '', description: '', is_active: true });
    setShowRoleModal(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      description: role.description || '',
      is_active: role.is_active === 1 || role.is_active === true
    });
    setShowRoleModal(true);
  };

  const handleDeleteRole = (role) => {
    if (window.confirm(`Are you sure you want to delete "${role.name}"?`)) {
      deleteRoleMutation.mutate(role.id);
    }
  };

  // Initialize resizable columns hook
  const { getColumnProps, ResizeHandle, tableRef } = useResizableColumns(
    [200, 300, 100, 150], // Initial widths in pixels
    'metadata-roles-column-widths'
  );

  const handleRoleSubmit = (e) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        data: roleFormData
      });
    } else {
      createRoleMutation.mutate(roleFormData);
    }
  };

  const tabs = [
    { id: 'roles', label: 'Job Roles', icon: FiBriefcase, roles: ['admin'] },
  ];

  const filteredTabs = tabs.filter(tab => tab.roles.includes(user?.role));

  if (user?.role !== 'admin') {
    return (
      <div className="metadata-page">
        <div className="metadata-header">
          <h1><FiDatabase /> Metadata</h1>
        </div>
        <div className="access-denied">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metadata-page">
      <div className="metadata-header">
        <h1><FiDatabase /> Metadata</h1>
      </div>

      <div className="metadata-container">
        <div className="metadata-sidebar">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`metadata-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="metadata-content">
          {activeTab === 'roles' && (
            <div className="metadata-section">
              <div className="section-header-with-action">
                <h2><FiBriefcase /> Job Roles</h2>
                <button className="btn btn-primary" onClick={handleAddRole}>
                  <FiPlus /> Add Job Role
                </button>
              </div>

              <p className="section-description">
                Manage standard job roles that will appear as options in the candidate profile dropdown.
              </p>

              {isLoadingRoles ? (
                <div className="loading">Loading job roles...</div>
              ) : jobRoles.length === 0 ? (
                <div className="empty-state">
                  <p>No job roles found. Click "Add Job Role" to create one.</p>
                </div>
              ) : (
                <div className="roles-table-container">
                  <table ref={tableRef} className="roles-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th {...getColumnProps(0)}>Name<ResizeHandle index={0} /></th>
                        <th {...getColumnProps(1)}>Description<ResizeHandle index={1} /></th>
                        <th {...getColumnProps(2)}>Status<ResizeHandle index={2} /></th>
                        <th {...getColumnProps(3)}>Actions<ResizeHandle index={3} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobRoles.map((role) => (
                        <tr key={role.id} className="role-row">
                          <td><strong>{role.name}</strong></td>
                          <td>{role.description || '-'}</td>
                          <td>
                            <span className={`status-badge ${role.is_active === 1 || role.is_active === true ? 'active' : 'inactive'}`}>
                              {role.is_active === 1 || role.is_active === true ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-icon btn-edit"
                                onClick={() => handleEditRole(role)}
                                title="Edit"
                              >
                                <FiEdit />
                              </button>
                              <button
                                className="btn-icon btn-delete"
                                onClick={() => handleDeleteRole(role)}
                                title="Delete"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Role Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRole ? 'Edit Job Role' : 'Add Job Role'}</h2>
              <button className="btn-close-modal" onClick={() => setShowRoleModal(false)}>
                <FiX />
              </button>
            </div>

            <form onSubmit={handleRoleSubmit} className="role-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  placeholder="e.g., Software Engineer"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  placeholder="Optional description for this job role"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={roleFormData.is_active ? 'true' : 'false'}
                  onChange={(e) => setRoleFormData({ ...roleFormData, is_active: e.target.value === 'true' })}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createRoleMutation.isLoading || updateRoleMutation.isLoading}>
                  <FiSave /> {editingRole ? 'Update' : 'Create'} Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metadata;

