import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { FiPlus, FiEdit, FiTrash2, FiUserPlus, FiUserMinus, FiUsers, FiInfo, FiX, FiCalendar } from 'react-icons/fi';
import './Groups.css';

const Groups = () => {
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

  // Fetch detailed group info when a group is selected for viewing
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
    <div className="groups-page">
      <div className="page-header">
        <h1>Groups</h1>
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

      {/* Group Details Modal */}
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

export default Groups;

