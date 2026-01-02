import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiUser, FiMail, FiPhone, FiTrash2, FiX, FiSave, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import './Candidates.css';

const Candidates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  // Removed showFilters state - filters are now always visible in compact form
  const [showSaveKpiModal, setShowSaveKpiModal] = useState(false);
  const [kpiName, setKpiName] = useState('');
  
  // Sort state
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  
  // Dynamic filter state - array of filter conditions
  const [filterConditions, setFilterConditions] = useState([]);
  // Local state for input values (to prevent re-renders on every keystroke)
  const [localFilterValues, setLocalFilterValues] = useState({});
  
  // Available filter fields with their types
  const filterFields = [
    { value: 'first_name', label: 'First Name', type: 'text' },
    { value: 'last_name', label: 'Last Name', type: 'text' },
    { value: 'email', label: 'Email', type: 'text' },
    { value: 'phone', label: 'Phone', type: 'text' },
    { value: 'city', label: 'City', type: 'text' },
    { value: 'state', label: 'State', type: 'text' },
    { value: 'country', label: 'Country', type: 'text' },
    { value: 'current_job_title', label: 'Job Title', type: 'text' },
    { value: 'current_company', label: 'Company', type: 'text' },
    { value: 'years_of_experience', label: 'Years of Experience', type: 'number' },
    { value: 'availability', label: 'Availability', type: 'select', options: ['available', 'not-available', 'available-soon', 'contract-only'] },
    { value: 'work_authorization', label: 'Work Authorization', type: 'text' },
    { value: 'willing_to_relocate', label: 'Willing to Relocate', type: 'boolean' },
    { value: 'is_active', label: 'Status', type: 'boolean' },
  ];
  const [candidateFormData, setCandidateFormData] = useState({
    // User fields
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    // Profile fields
    date_of_birth: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zip_code: '',
    linkedin_url: '',
    portfolio_url: '',
    github_url: '',
      current_job_title: '',
    current_company: '',
    years_of_experience: '',
    availability: 'available',
    expected_salary_min: '',
    expected_salary_max: '',
    work_authorization: '',
    willing_to_relocate: false,
    preferred_locations: '',
    summary: '',
    additional_notes: '',
  });
  const [resumeFiles, setResumeFiles] = useState([]);
  const [resumeData, setResumeData] = useState([
    { skills: '', experience_years: '', education: '', summary: '' },
    { skills: '', experience_years: '', education: '', summary: '' },
    { skills: '', experience_years: '', education: '', summary: '' },
  ]);

  // Track if we've initialized from URL params
  const initializedFromUrl = useRef(false);

  // Initialize filters from URL params (only on mount)
  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;
    
    const queryParam = searchParams.get('query');
    if (queryParam) {
      try {
        const conditions = JSON.parse(decodeURIComponent(queryParam));
        setFilterConditions(conditions);
        setLocalFilterValues({}); // Clear any local values when initializing from URL
      } catch (e) {
        console.error('Error parsing filter conditions from URL:', e);
      }
    }
  }, [searchParams]);

  // Parse query syntax (e.g., "name=test", "role like Data%", "year>1")
  const parseQueryValue = (value) => {
    if (!value || !value.trim()) return null;
    
    const trimmed = value.trim();
    
    // Check for LIKE pattern first (before comparison operators): "like Data%"
    const likeMatch = trimmed.match(/^like\s+(.+)$/i);
    if (likeMatch) {
      return {
        operator: 'like',
        value: likeMatch[1].trim()
      };
    }
    
    // Check for exact match: "=value"
    const exactMatch = trimmed.match(/^=\s*(.+)$/);
    if (exactMatch) {
      return {
        operator: '=',
        value: exactMatch[1].trim()
      };
    }
    
    // Check for comparison operators at the start: ">1", "<5", ">=10", "<=20"
    const comparisonMatch = trimmed.match(/^(>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      return {
        operator: comparisonMatch[1],
        value: comparisonMatch[2].trim()
      };
    }
    
    // Default: LIKE for text fields (contains search)
    return {
      operator: 'like', // Default to LIKE for text fields
      value: trimmed
    };
  };

  // Debounced filter params for API calls (prevents refetch on every keystroke)
  const [debouncedFilterParams, setDebouncedFilterParams] = useState('');
  const filterParamsTimeout = useRef(null);

  useEffect(() => {
    // Clear existing timeout
    if (filterParamsTimeout.current) {
      clearTimeout(filterParamsTimeout.current);
    }
    
    // Build filter params
    const params = new URLSearchParams();
    if (filterConditions.length > 0 && filterConditions.some(f => f.field && f.value)) {
      params.append('query', encodeURIComponent(JSON.stringify(filterConditions)));
    }
    const paramsString = params.toString();
    
    // Debounce the API call by 500ms
    filterParamsTimeout.current = setTimeout(() => {
      setDebouncedFilterParams(paramsString);
    }, 500);
    
    return () => {
      if (filterParamsTimeout.current) {
        clearTimeout(filterParamsTimeout.current);
      }
    };
  }, [filterConditions]);

  // Get candidates based on role with filters
  const { data: candidates, isLoading } = useQuery(
    ['candidates', user?.role, debouncedFilterParams],
    () => {
      const endpoint = user?.role === 'admin' ? '/candidates' : '/candidates/assigned';
      const url = debouncedFilterParams ? `${endpoint}?${debouncedFilterParams}` : endpoint;
      console.log('Fetching candidates with URL:', url);
      return api.get(url).then(res => {
        console.log('Candidates response:', res.data);
        return res.data;
      });
    },
    {
      enabled: !!user?.role,
      refetchOnWindowFocus: false,
      staleTime: 30000 // Consider data fresh for 30 seconds
    }
  );

  // Fetch job roles for dropdown
  const { data: jobRoles = [] } = useQuery(
    ['job-roles'],
    () => api.get('/job-roles').then(res => res.data),
    {
      enabled: showAddModal || showEditModal
    }
  );

  // Fetch consultants for assignment (admin only)
  const { data: consultants = [] } = useQuery(
    ['consultants'],
    () => api.get('/users').then(res => res.data.filter(u => u.role === 'consultant' || u.role === 'admin')),
    {
      enabled: user?.role === 'admin'
    }
  );

  // Assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCandidate, setAssigningCandidate] = useState(null);
  const [selectedConsultant, setSelectedConsultant] = useState('');

  // Assign candidate mutation
  const assignMutation = useMutation(
    ({ candidateId, consultantId }) => api.post(`/candidates/${candidateId}/assign`, { consultant_id: consultantId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['candidates', user?.role]);
        setShowAssignModal(false);
        setAssigningCandidate(null);
        setSelectedConsultant('');
      },
    }
  );

  const handleAssignClick = (candidate) => {
    setAssigningCandidate(candidate);
    setShowAssignModal(true);
    setSelectedConsultant('');
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (assigningCandidate && selectedConsultant) {
      assignMutation.mutate({
        candidateId: assigningCandidate.id,
        consultantId: parseInt(selectedConsultant)
      });
    }
  };

  // Debounce URL updates to prevent page refresh on every keystroke
  const isInitialMount = useRef(true);
  const urlUpdateTimeout = useRef(null);
  
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Clear existing timeout
    if (urlUpdateTimeout.current) {
      clearTimeout(urlUpdateTimeout.current);
    }
    
    // Debounce URL update by 500ms
    urlUpdateTimeout.current = setTimeout(() => {
      const newParams = new URLSearchParams();
      if (filterConditions.length > 0 && filterConditions.some(f => f.field && f.value)) {
        newParams.set('query', encodeURIComponent(JSON.stringify(filterConditions)));
      }
      setSearchParams(newParams, { replace: true });
    }, 500);
    
    // Cleanup timeout on unmount
    return () => {
      if (urlUpdateTimeout.current) {
        clearTimeout(urlUpdateTimeout.current);
      }
    };
  }, [filterConditions, setSearchParams]);

  const handleAddFilter = () => {
    setFilterConditions(prev => [...prev, { field: '', value: '', operator: 'like' }]);
  };

  const handleRemoveFilter = (index) => {
    // Clean up local value for this filter
    const inputKey = `filter-${index}-value`;
    if (filterValueTimeout.current[inputKey]) {
      clearTimeout(filterValueTimeout.current[inputKey]);
      delete filterValueTimeout.current[inputKey];
    }
    setLocalFilterValues(prev => {
      const newVals = { ...prev };
      delete newVals[inputKey];
      return newVals;
    });
    setFilterConditions(prev => prev.filter((_, i) => i !== index));
  };

  // Debounce timer for filter value updates
  const filterValueTimeout = useRef({});
  
  const handleFilterChange = (index, field, value) => {
    // For value field, use local state and debounce the update
    if (field === 'value') {
      const inputKey = `filter-${index}-value`;
      setLocalFilterValues(prev => ({ ...prev, [inputKey]: value }));
      
      // Clear existing timeout for this input
      if (filterValueTimeout.current[inputKey]) {
        clearTimeout(filterValueTimeout.current[inputKey]);
      }
      
      // Debounce the actual filter condition update
      filterValueTimeout.current[inputKey] = setTimeout(() => {
        setFilterConditions(prev => {
          const updated = [...prev];
          const fieldDef = filterFields.find(f => f.value === updated[index].field);
          
          if (fieldDef && fieldDef.type === 'text') {
            const parsed = parseQueryValue(value);
            if (parsed) {
              updated[index] = { 
                ...updated[index], 
                operator: parsed.operator,
                value: parsed.value
              };
            } else {
              updated[index] = { ...updated[index], value };
            }
          } else {
            updated[index] = { ...updated[index], value };
          }
          
          return updated;
        });
      }, 300);
    } else {
      // For non-value fields (field selection, operator), update immediately
      setFilterConditions(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        
        // Reset value when field changes
        if (field === 'field') {
          updated[index].value = '';
          updated[index].operator = 'like';
          // Clear local value for this input
          const inputKey = `filter-${index}-value`;
          setLocalFilterValues(prev => {
            const newVals = { ...prev };
            delete newVals[inputKey];
            return newVals;
          });
        }
        
        return updated;
      });
    }
  };
  
  // Get local value for input (or use actual value if no local value)
  const getFilterValue = (index, actualValue) => {
    const inputKey = `filter-${index}-value`;
    return localFilterValues[inputKey] !== undefined ? localFilterValues[inputKey] : (actualValue || '');
  };

  const handleClearFilters = () => {
    // Clean up all timeout refs
    Object.keys(filterValueTimeout.current).forEach(key => {
      if (filterValueTimeout.current[key]) {
        clearTimeout(filterValueTimeout.current[key]);
      }
    });
    filterValueTimeout.current = {};
    setLocalFilterValues({});
    setFilterConditions([]);
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = filterConditions.length > 0 && filterConditions.some(f => f.field && f.value);

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort candidates
  const sortedCandidates = useMemo(() => {
    if (!candidates || !sortColumn) return candidates;
    
    return [...candidates].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];
      
      // Handle nested properties
      if (sortColumn === 'name') {
        aValue = `${a.first_name || ''} ${a.last_name || ''}`.trim();
        bValue = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      } else if (sortColumn === 'current_position') {
        aValue = a.current_job_title || '';
        bValue = b.current_job_title || '';
      } else if (sortColumn === 'experience') {
        aValue = a.years_of_experience || 0;
        bValue = b.years_of_experience || 0;
      } else if (sortColumn === 'resumes') {
        aValue = a.resume_count || 0;
        bValue = b.resume_count || 0;
      } else if (sortColumn === 'matches') {
        aValue = a.match_count || 0;
        bValue = b.match_count || 0;
      } else if (sortColumn === 'status') {
        aValue = a.is_active === 1 || a.is_active === true ? 'Active' : 'Inactive';
        bValue = b.is_active === 1 || b.is_active === true ? 'Active' : 'Inactive';
      }
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' });
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [candidates, sortColumn, sortDirection]);

  const handleSaveAsKpi = () => {
    if (!kpiName.trim()) {
      alert('Please enter a name for the KPI');
      return;
    }
    // Save KPI with filter configuration
    const kpiData = {
      name: kpiName,
      description: `Filtered candidates: ${filterConditions.filter(f => f.field && f.value).map(f => `${f.field}=${f.value}`).join(', ')}`,
      metric_type: 'custom_filter',
      display_order: 0,
      query_config: JSON.stringify({ type: 'candidate_filter', conditions: filterConditions })
    };
    
    api.post('/kpis', kpiData)
      .then(() => {
        setShowSaveKpiModal(false);
        setKpiName('');
        alert('KPI saved successfully!');
      })
      .catch(err => {
        console.error('Error saving KPI:', err);
        alert('Failed to save KPI');
      });
  };

  const updateCandidateMutation = useMutation(
    async ({ candidateId, candidateData, resumes, existingResumeIds }) => {
      // Update the user
      await api.put(`/users/${candidateId}`, {
        email: candidateData.email,
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        role: 'candidate',
        phone: candidateData.phone,
      });

      // Update password if provided
      if (candidateData.password) {
        await api.put(`/users/${candidateId}/password`, {
          password: candidateData.password,
        });
      }

      const userId = candidateId;

      // Update or create the profile
      const profileData = {
        user_id: userId,
        date_of_birth: candidateData.date_of_birth || null,
        address: candidateData.address || null,
        city: candidateData.city || null,
        state: candidateData.state || null,
        country: candidateData.country || null,
        zip_code: candidateData.zip_code || null,
        linkedin_url: candidateData.linkedin_url || null,
        portfolio_url: candidateData.portfolio_url || null,
        github_url: candidateData.github_url || null,
        job_classification: candidateData.job_classification ? parseInt(candidateData.job_classification) : null,
        current_job_title: candidateData.current_job_title || null,
        current_company: candidateData.current_company || null,
        years_of_experience: candidateData.years_of_experience ? parseInt(candidateData.years_of_experience) : null,
        availability: candidateData.availability || null,
        expected_salary_min: candidateData.expected_salary_min ? parseInt(candidateData.expected_salary_min) : null,
        expected_salary_max: candidateData.expected_salary_max ? parseInt(candidateData.expected_salary_max) : null,
        work_authorization: candidateData.work_authorization || null,
        willing_to_relocate: candidateData.willing_to_relocate || false,
        preferred_locations: candidateData.preferred_locations ? candidateData.preferred_locations.split(',').map(l => l.trim()).filter(l => l) : [],
        summary: candidateData.summary || null,
        additional_notes: candidateData.additional_notes || null,
      };

      // The endpoint handles both create and update
      await api.post('/candidate-profiles', profileData);

      // Handle resumes
      for (let i = 0; i < resumes.length; i++) {
        const resume = resumes[i];
        
        if (resume.id && resume.file) {
          // Replace existing resume: delete old one and upload new one
          await api.delete(`/resumes/${resume.id}`);
          const formData = new FormData();
          formData.append('resume', resume.file);
          formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
          formData.append('experience_years', resume.experience_years || '');
          formData.append('education', resume.education || '');
          formData.append('summary', resume.summary || '');

          await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else if (resume.id && !resume.file) {
          // Update existing resume metadata only
          await api.put(`/resumes/${resume.id}`, {
            skills: resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : [],
            experience_years: resume.experience_years ? parseInt(resume.experience_years) : null,
            education: resume.education || '',
            summary: resume.summary || '',
          });
        } else if (!resume.id && resume.file) {
          // Upload new resume
          const formData = new FormData();
          formData.append('resume', resume.file);
          formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
          formData.append('experience_years', resume.experience_years || '');
          formData.append('education', resume.education || '');
          formData.append('summary', resume.summary || '');

          await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      return { id: userId };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('candidates');
        setShowEditModal(false);
        setEditingCandidate(null);
        resetForm();
      },
    }
  );

  const createCandidateMutation = useMutation(
    async ({ candidateData, resumes }) => {
      // First create the user
      const userResponse = await api.post('/users', {
        email: candidateData.email,
        password: candidateData.password,
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        role: 'candidate',
        phone: candidateData.phone,
      });

      const userId = userResponse.data.id;

      // Then create the profile if there's any profile data
      const profileData = {
        user_id: userId,
        date_of_birth: candidateData.date_of_birth || null,
        address: candidateData.address || null,
        city: candidateData.city || null,
        state: candidateData.state || null,
        country: candidateData.country || null,
        zip_code: candidateData.zip_code || null,
        linkedin_url: candidateData.linkedin_url || null,
        portfolio_url: candidateData.portfolio_url || null,
        github_url: candidateData.github_url || null,
        job_classification: candidateData.job_classification ? parseInt(candidateData.job_classification) : null,
        current_job_title: candidateData.current_job_title || null,
        current_company: candidateData.current_company || null,
        years_of_experience: candidateData.years_of_experience ? parseInt(candidateData.years_of_experience) : null,
        availability: candidateData.availability || null,
        expected_salary_min: candidateData.expected_salary_min ? parseInt(candidateData.expected_salary_min) : null,
        expected_salary_max: candidateData.expected_salary_max ? parseInt(candidateData.expected_salary_max) : null,
        work_authorization: candidateData.work_authorization || null,
        willing_to_relocate: candidateData.willing_to_relocate || false,
        preferred_locations: candidateData.preferred_locations ? candidateData.preferred_locations.split(',').map(l => l.trim()).filter(l => l) : [],
        summary: candidateData.summary || null,
        additional_notes: candidateData.additional_notes || null,
      };

      // Only create profile if there's at least one field filled
      const hasProfileData = Object.values(profileData).some((val, idx) => {
        if (idx === 0) return false; // Skip user_id
        return val !== null && val !== false && val !== '';
      });

      if (hasProfileData) {
        await api.post('/candidate-profiles', profileData);
      }

      // Upload resumes if any
      if (resumes && resumes.length > 0) {
        for (let i = 0; i < resumes.length; i++) {
          const resume = resumes[i];
          if (resume.file) {
            const formData = new FormData();
            formData.append('resume', resume.file);
            formData.append('skills', JSON.stringify(resume.skills ? resume.skills.split(',').map(s => s.trim()).filter(s => s) : []));
            formData.append('experience_years', resume.experience_years || '');
            formData.append('education', resume.education || '');
            formData.append('summary', resume.summary || '');

            await api.post(`/resumes/upload-for-candidate/${userId}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          }
        }
      }

      return userResponse.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('candidates');
        setShowAddModal(false);
        resetForm();
      },
    }
  );

  const resetForm = () => {
    setCandidateFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      date_of_birth: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zip_code: '',
      linkedin_url: '',
      portfolio_url: '',
      github_url: '',
      job_classification: '',
      current_job_title: '',
      current_company: '',
      years_of_experience: '',
      availability: 'available',
      expected_salary_min: '',
      expected_salary_max: '',
      work_authorization: '',
      willing_to_relocate: false,
      preferred_locations: '',
      summary: '',
      additional_notes: '',
    });
    setResumeFiles([]);
    setResumeData([
      { skills: '', experience_years: '', education: '', summary: '' },
      { skills: '', experience_years: '', education: '', summary: '' },
      { skills: '', experience_years: '', education: '', summary: '' },
    ]);
  };

  const handleAddCandidate = (e) => {
    e.preventDefault();
    
    // Prepare resume data - only include resumes with files
    const resumes = resumeFiles
      .map((file, index) => file ? {
        file: file,
        ...resumeData[index],
      } : null)
      .filter(resume => resume !== null);

    createCandidateMutation.mutate({
      candidateData: candidateFormData,
      resumes: resumes,
    });
  };

  const handleUpdateCandidate = (e) => {
    e.preventDefault();
    
    // Prepare resume data
    const resumes = resumeFiles.map((file, index) => {
      const data = resumeData[index];
      return {
        id: data.id, // Existing resume ID if editing
        file: file, // New file if replacing
        ...data,
      };
    }).filter(resume => resume.file || resume.id); // Include if has file or is existing

    const existingResumeIds = resumes.filter(r => r.id && !r.file).map(r => r.id);

    updateCandidateMutation.mutate({
      candidateId: editingCandidate.id,
      candidateData: candidateFormData,
      resumes: resumes,
      existingResumeIds: existingResumeIds,
    });
  };

  const handleResumeFileChange = (index, file) => {
    const newFiles = [...resumeFiles];
    newFiles[index] = file;
    setResumeFiles(newFiles);
  };

  const handleResumeDataChange = (index, field, value) => {
    const newResumeData = [...resumeData];
    newResumeData[index] = {
      ...newResumeData[index],
      [field]: value,
    };
    setResumeData(newResumeData);
  };

  const removeResume = (index) => {
    const newFiles = [...resumeFiles];
    const newResumeData = [...resumeData];
    newFiles[index] = null;
    newResumeData[index] = { skills: '', experience_years: '', education: '', summary: '' };
    setResumeFiles(newFiles);
    setResumeData(newResumeData);
  };

  const handleCandidateClick = (candidate) => {
    navigate(`/candidates/${candidate.id}`);
  };

  if (isLoading) {
    return <div className="loading">Loading candidates...</div>;
  }

  return (
    <div className="candidates-page">
      <div className="page-header">
        <h1>{user?.role === 'admin' ? 'All Candidates' : 'Assigned Candidates'}</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasActiveFilters && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowSaveKpiModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FiSave /> Save as KPI
            </button>
          )}
        {user?.role === 'admin' && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FiPlus /> Add Candidate
          </button>
        )}
        </div>
      </div>

      {/* Compact Inline Filter Section */}
      <div className="compact-filters-bar">
        <div className="compact-filters-content">
          {filterConditions.length === 0 ? (
            <div className="compact-filter-row">
              <select
                className="compact-filter-field"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const fieldDef = filterFields.find(f => f.value === e.target.value);
                    setFilterConditions([{ 
                      field: e.target.value, 
                      value: '', 
                      operator: fieldDef?.type === 'number' ? '=' : 'like' 
                    }]);
                  }
                }}
              >
                <option value="">Quick Filter: Select Field</option>
                {filterFields.map(field => (
                  <option key={field.value} value={field.value}>{field.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="compact-filter-conditions">
              {filterConditions.map((condition, index) => {
                const fieldDef = filterFields.find(f => f.value === condition.field);
                return (
                  <div key={index} className="compact-filter-row">
                    <select
                      className="compact-filter-field"
                      value={condition.field}
                      onChange={(e) => handleFilterChange(index, 'field', e.target.value)}
                    >
                      <option value="">Field</option>
                      {filterFields.map(field => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>
                    
                    {fieldDef && (
                      <>
                        {fieldDef.type === 'number' && (
                          <select
                            className="compact-filter-operator"
                            value={condition.operator || '='}
                            onChange={(e) => handleFilterChange(index, 'operator', e.target.value)}
                          >
                            <option value="=">=</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                          </select>
                        )}
                        {fieldDef.type === 'select' ? (
                          <select
                            className="compact-filter-value"
                            value={condition.value}
                            onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                          >
                            <option value="">All</option>
                            {fieldDef.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : fieldDef.type === 'boolean' ? (
                          <select
                            className="compact-filter-value"
                            value={condition.value}
                            onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                          >
                            <option value="">All</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <input
                            type={fieldDef.type === 'number' ? 'number' : 'text'}
                            className="compact-filter-value"
                            placeholder={fieldDef.type === 'number' ? 'Value' : 'Value (e.g., test, =exact, like Data%)'}
                            value={getFilterValue(index, condition.value)}
                            onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                          />
                        )}
                      </>
                    )}
                    <button
                      className="btn-icon btn-delete compact-filter-remove"
                      onClick={() => handleRemoveFilter(index)}
                      title="Remove"
                    >
                      <FiX />
                    </button>
                  </div>
                );
              })}
              <button
                className="btn btn-sm btn-primary compact-filter-add"
                onClick={handleAddFilter}
                title="Add Filter"
              >
                <FiPlus />
              </button>
              {hasActiveFilters && (
                <button
                  className="btn btn-sm btn-secondary compact-filter-clear"
                  onClick={handleClearFilters}
                  title="Clear All"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        {hasActiveFilters && (
          <div className="compact-filters-info">
            {sortedCandidates?.length || 0} result(s)
          </div>
        )}
      </div>

      {/* Save as KPI Modal */}
      {showSaveKpiModal && (
        <div className="modal-overlay" onClick={() => setShowSaveKpiModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Save Filter as KPI</h2>
            <div className="form-group">
              <label>KPI Name</label>
              <input
                type="text"
                placeholder="e.g., Available Candidates in SF"
                value={kpiName}
                onChange={(e) => setKpiName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowSaveKpiModal(false);
                  setKpiName('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveAsKpi}
              >
                Save KPI
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="candidates-table-container">
        <table className="table candidates-table">
          <thead>
            <tr>
              <th 
                className="sortable" 
                onClick={() => handleSort('name')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Name
                {sortColumn === 'name' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('email')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Email
                {sortColumn === 'email' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('phone')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Phone
                {sortColumn === 'phone' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('current_position')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Current Position
                {sortColumn === 'current_position' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('experience')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Experience
                {sortColumn === 'experience' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('resumes')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Resumes
                {sortColumn === 'resumes' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('matches')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Matches
                {sortColumn === 'matches' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              <th 
                className="sortable" 
                onClick={() => handleSort('status')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                Status
                {sortColumn === 'status' && (
                  sortDirection === 'asc' ? <FiArrowUp style={{ marginLeft: '5px', display: 'inline' }} /> : <FiArrowDown style={{ marginLeft: '5px', display: 'inline' }} />
                )}
              </th>
              {user?.role === 'admin' && (
                <th>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedCandidates && sortedCandidates.length > 0 ? (
              sortedCandidates.map((candidate) => (
                <tr 
                  key={candidate.id} 
                  className="candidate-row"
                  onClick={() => handleCandidateClick(candidate)}
                >
                  <td>
                    <div className="candidate-name-cell">
                      <FiUser className="candidate-icon" />
                      <strong>{candidate.first_name} {candidate.last_name}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="candidate-email-inline">
                      <FiMail /> {candidate.email}
                    </span>
                  </td>
                  <td>
                    {candidate.phone ? (
                      <span className="candidate-phone-inline">
                        <FiPhone /> {candidate.phone}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {candidate.current_job_title || candidate.job_classification_name ? (
                      <div className="candidate-position">
                        <div>
                          {candidate.current_job_title && <strong>{candidate.current_job_title}</strong>}
                          {candidate.current_job_title && candidate.job_classification_name && <span> • </span>}
                          {candidate.job_classification_name && <span className="text-muted">({candidate.job_classification_name})</span>}
                        </div>
                        {candidate.current_company && (
                          <div className="candidate-company">{candidate.current_company}</div>
                        )}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    {candidate.years_of_experience ? (
                      <span>{candidate.years_of_experience} years</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td>
                    <span className="candidate-stat">{candidate.resume_count || 0}</span>
                  </td>
                  <td>
                    <span 
                      className="candidate-stat"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/matches?candidate=${candidate.id}`);
                      }}
                      style={{ cursor: 'pointer' }}
                      title="View matched jobs"
                    >
                      {candidate.match_count || 0}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge badge-${candidate.is_active ? 'success' : 'danger'}`}>
                        {candidate.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {candidate.assignment_status && (
                        <span className={`badge badge-info`}>
                          {candidate.assignment_status}
                        </span>
                      )}
                    </div>
                  </td>
                  {user?.role === 'admin' && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAssignClick(candidate)}
                        title="Assign to consultant"
                      >
                        Assign
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={user?.role === 'admin' ? 9 : 8} className="empty-state">
                  {user?.role === 'admin' ? 'No candidates found' : 'No candidates assigned'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content add-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> Add New Candidate
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => setShowAddModal(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleAddCandidate} className="add-candidate-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.first_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.last_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={candidateFormData.email}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={candidateFormData.phone}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={candidateFormData.password}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={candidateFormData.date_of_birth}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={candidateFormData.address}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, address: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={candidateFormData.city}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={candidateFormData.state}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={candidateFormData.country}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Zip/Postal Code</label>
                    <input
                      type="text"
                      value={candidateFormData.zip_code}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Professional Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Job Classification</label>
                    <select
                      value={candidateFormData.job_classification || ''}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, job_classification: e.target.value })}
                    >
                      <option value="">Select a job classification</option>
                      {jobRoles
                        .filter(role => role.is_active === 1 || role.is_active === true)
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Job Title</label>
                    <input
                      type="text"
                      value={candidateFormData.current_job_title || ''}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_job_title: e.target.value })}
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Company</label>
                    <input
                      type="text"
                      value={candidateFormData.current_company}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_company: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Years of Experience</label>
                    <input
                      type="number"
                      value={candidateFormData.years_of_experience}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, years_of_experience: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Availability</label>
                    <select
                      value={candidateFormData.availability}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, availability: e.target.value })}
                    >
                      <option value="available">Available Immediately</option>
                      <option value="2-weeks">Available in 2 Weeks</option>
                      <option value="1-month">Available in 1 Month</option>
                      <option value="2-months">Available in 2 Months</option>
                      <option value="3-months">Available in 3+ Months</option>
                      <option value="not-available">Not Available</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Professional Summary</label>
                  <textarea
                    value={candidateFormData.summary}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, summary: e.target.value })}
                    rows="4"
                    placeholder="Brief professional summary..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Online Presence</h3>
                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    value={candidateFormData.linkedin_url}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Portfolio/Website URL</label>
                    <input
                      type="url"
                      value={candidateFormData.portfolio_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, portfolio_url: e.target.value })}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>GitHub URL</label>
                    <input
                      type="url"
                      value={candidateFormData.github_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, github_url: e.target.value })}
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Job Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expected Salary Min</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_min}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_min: e.target.value })}
                      min="0"
                      placeholder="e.g., 80000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Salary Max</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_max}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_max: e.target.value })}
                      min="0"
                      placeholder="e.g., 120000"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Work Authorization</label>
                    <input
                      type="text"
                      value={candidateFormData.work_authorization}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, work_authorization: e.target.value })}
                      placeholder="e.g., US Citizen, H1B, Green Card"
                    />
                  </div>
                  <div className="form-group">
                    <label>Willing to Relocate</label>
                    <select
                      value={candidateFormData.willing_to_relocate ? 'yes' : 'no'}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, willing_to_relocate: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Preferred Locations</label>
                  <input
                    type="text"
                    value={candidateFormData.preferred_locations}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, preferred_locations: e.target.value })}
                    placeholder="Comma-separated: San Francisco, CA, New York, NY"
                  />
                  <p className="form-hint">Separate multiple locations with commas</p>
                </div>
              </div>

              <div className="form-section">
                <h3>Additional Notes</h3>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={candidateFormData.additional_notes}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, additional_notes: e.target.value })}
                    rows="3"
                    placeholder="Any additional notes about the candidate..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Resumes (Maximum 3)</h3>
                <p className="form-hint">You can upload up to 3 resumes for this candidate. Each resume can have additional details.</p>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="resume-upload-item">
                    <div className="resume-upload-header">
                      <h4>Resume {index + 1}</h4>
                      {resumeFiles[index] && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeResume(index)}
                        >
                          <FiTrash2 /> Remove
                        </button>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Resume File (PDF, DOC, DOCX)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handleResumeFileChange(index, e.target.files[0]);
                          }
                        }}
                      />
                      {resumeFiles[index] && (
                        <p className="form-hint">Selected: {resumeFiles[index].name}</p>
                      )}
                    </div>
                    {resumeFiles[index] && (
                      <>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Skills (comma-separated)</label>
                            <input
                              type="text"
                              value={resumeData[index].skills}
                              onChange={(e) => handleResumeDataChange(index, 'skills', e.target.value)}
                              placeholder="JavaScript, React, Node.js"
                            />
                          </div>
                          <div className="form-group">
                            <label>Years of Experience</label>
                            <input
                              type="number"
                              value={resumeData[index].experience_years}
                              onChange={(e) => handleResumeDataChange(index, 'experience_years', e.target.value)}
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Education</label>
                          <input
                            type="text"
                            value={resumeData[index].education}
                            onChange={(e) => handleResumeDataChange(index, 'education', e.target.value)}
                            placeholder="Bachelor's in Computer Science"
                          />
                        </div>
                        <div className="form-group">
                          <label>Summary</label>
                          <textarea
                            value={resumeData[index].summary}
                            onChange={(e) => handleResumeDataChange(index, 'summary', e.target.value)}
                            rows="2"
                            placeholder="Brief summary of this resume..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {resumeFiles.filter(f => f !== null && f !== undefined).length >= 3 && (
                  <p className="form-hint" style={{ color: '#28a745', fontWeight: 'bold' }}>
                    Maximum of 3 resumes reached
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createCandidateMutation.isLoading}
                >
                  {createCandidateMutation.isLoading ? 'Creating...' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {showEditModal && editingCandidate && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}>
          <div className="modal-content add-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <FiUser /> Edit Candidate: {editingCandidate.first_name} {editingCandidate.last_name}
              </h2>
              <button
                className="btn-close-modal"
                onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpdateCandidate} className="add-candidate-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.first_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={candidateFormData.last_name}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={candidateFormData.email}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={candidateFormData.phone}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={candidateFormData.password}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, password: e.target.value })}
                      placeholder="Leave blank to keep current password"
                    />
                    <p className="form-hint">Leave blank to keep current password</p>
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={candidateFormData.date_of_birth}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Address</h3>
                <div className="form-group">
                  <label>Street Address</label>
                  <input
                    type="text"
                    value={candidateFormData.address}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, address: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={candidateFormData.city}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={candidateFormData.state}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={candidateFormData.country}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Zip/Postal Code</label>
                    <input
                      type="text"
                      value={candidateFormData.zip_code}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Professional Information</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Job Classification</label>
                    <select
                      value={candidateFormData.job_classification || ''}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, job_classification: e.target.value })}
                    >
                      <option value="">Select a job classification</option>
                      {jobRoles
                        .filter(role => role.is_active === 1 || role.is_active === true)
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Job Title</label>
                    <input
                      type="text"
                      value={candidateFormData.current_job_title || ''}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_job_title: e.target.value })}
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Company</label>
                    <input
                      type="text"
                      value={candidateFormData.current_company}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, current_company: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Years of Experience</label>
                    <input
                      type="number"
                      value={candidateFormData.years_of_experience}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, years_of_experience: e.target.value })}
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Availability</label>
                    <select
                      value={candidateFormData.availability}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, availability: e.target.value })}
                    >
                      <option value="available">Available Immediately</option>
                      <option value="2-weeks">Available in 2 Weeks</option>
                      <option value="1-month">Available in 1 Month</option>
                      <option value="2-months">Available in 2 Months</option>
                      <option value="3-months">Available in 3+ Months</option>
                      <option value="not-available">Not Available</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Professional Summary</label>
                  <textarea
                    value={candidateFormData.summary}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, summary: e.target.value })}
                    rows="4"
                    placeholder="Brief professional summary..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Online Presence</h3>
                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    value={candidateFormData.linkedin_url}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Portfolio/Website URL</label>
                    <input
                      type="url"
                      value={candidateFormData.portfolio_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, portfolio_url: e.target.value })}
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>GitHub URL</label>
                    <input
                      type="url"
                      value={candidateFormData.github_url}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, github_url: e.target.value })}
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Job Preferences</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expected Salary Min</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_min}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_min: e.target.value })}
                      min="0"
                      placeholder="e.g., 80000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Salary Max</label>
                    <input
                      type="number"
                      value={candidateFormData.expected_salary_max}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, expected_salary_max: e.target.value })}
                      min="0"
                      placeholder="e.g., 120000"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Work Authorization</label>
                    <input
                      type="text"
                      value={candidateFormData.work_authorization}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, work_authorization: e.target.value })}
                      placeholder="e.g., US Citizen, H1B, Green Card"
                    />
                  </div>
                  <div className="form-group">
                    <label>Willing to Relocate</label>
                    <select
                      value={candidateFormData.willing_to_relocate ? 'yes' : 'no'}
                      onChange={(e) => setCandidateFormData({ ...candidateFormData, willing_to_relocate: e.target.value === 'yes' })}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Preferred Locations</label>
                  <input
                    type="text"
                    value={candidateFormData.preferred_locations}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, preferred_locations: e.target.value })}
                    placeholder="Comma-separated: San Francisco, CA, New York, NY"
                  />
                  <p className="form-hint">Separate multiple locations with commas</p>
                </div>
              </div>

              <div className="form-section">
                <h3>Additional Notes</h3>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={candidateFormData.additional_notes}
                    onChange={(e) => setCandidateFormData({ ...candidateFormData, additional_notes: e.target.value })}
                    rows="3"
                    placeholder="Any additional notes about the candidate..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Resumes (Maximum 3)</h3>
                <p className="form-hint">You can update existing resumes or add new ones. Upload a new file to replace an existing resume.</p>
                {[0, 1, 2].map((index) => {
                  const existingResume = resumeData[index]?.id;
                  return (
                    <div key={index} className="resume-upload-item">
                      <div className="resume-upload-header">
                        <h4>Resume {index + 1} {existingResume && <span style={{ fontSize: '12px', color: '#666' }}>(Existing)</span>}</h4>
                        {resumeFiles[index] && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeResume(index)}
                          >
                            <FiTrash2 /> Remove
                          </button>
                        )}
                        {existingResume && !resumeFiles[index] && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this resume?')) {
                                try {
                                  await api.delete(`/resumes/${existingResume}`);
                                  const newResumeData = [...resumeData];
                                  const newResumeFiles = [...resumeFiles];
                                  newResumeData[index] = { skills: '', experience_years: '', education: '', summary: '' };
                                  newResumeFiles[index] = null;
                                  setResumeData(newResumeData);
                                  setResumeFiles(newResumeFiles);
                                  queryClient.invalidateQueries('candidates');
                                } catch (error) {
                                  alert('Failed to delete resume');
                                }
                              }
                            }}
                          >
                            <FiTrash2 /> Delete
                          </button>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Resume File (PDF, DOC, DOCX) {existingResume && <span style={{ fontSize: '12px', color: '#666' }}>- Leave empty to keep current file</span>}</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleResumeFileChange(index, e.target.files[0]);
                            }
                          }}
                        />
                        {resumeFiles[index] && (
                          <p className="form-hint">Selected: {resumeFiles[index].name}</p>
                        )}
                      </div>
                      {(resumeFiles[index] || existingResume) && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Skills (comma-separated)</label>
                              <input
                                type="text"
                                value={resumeData[index].skills}
                                onChange={(e) => handleResumeDataChange(index, 'skills', e.target.value)}
                                placeholder="JavaScript, React, Node.js"
                              />
                            </div>
                            <div className="form-group">
                              <label>Years of Experience</label>
                              <input
                                type="number"
                                value={resumeData[index].experience_years}
                                onChange={(e) => handleResumeDataChange(index, 'experience_years', e.target.value)}
                                min="0"
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Education</label>
                            <input
                              type="text"
                              value={resumeData[index].education}
                              onChange={(e) => handleResumeDataChange(index, 'education', e.target.value)}
                              placeholder="Bachelor's in Computer Science"
                            />
                          </div>
                          <div className="form-group">
                            <label>Summary</label>
                            <textarea
                              value={resumeData[index].summary}
                              onChange={(e) => handleResumeDataChange(index, 'summary', e.target.value)}
                              rows="2"
                              placeholder="Brief summary of this resume..."
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {resumeFiles.filter(f => f !== null && f !== undefined).length >= 3 && (
                  <p className="form-hint" style={{ color: '#28a745', fontWeight: 'bold' }}>
                    Maximum of 3 resumes reached
                  </p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowEditModal(false); setEditingCandidate(null); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateCandidateMutation.isLoading}
                >
                  {updateCandidateMutation.isLoading ? 'Updating...' : 'Update Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Candidate Modal */}
      {showAssignModal && assigningCandidate && user?.role === 'admin' && (
        <div className="modal-overlay" onClick={() => {
          setShowAssignModal(false);
          setAssigningCandidate(null);
          setSelectedConsultant('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Assign Candidate to Consultant</h2>
            <p>
              Assign <strong>{assigningCandidate.first_name} {assigningCandidate.last_name}</strong> to a consultant
            </p>
            <form onSubmit={handleAssignSubmit}>
              <div className="form-group">
                <label>Select Consultant</label>
                <select
                  value={selectedConsultant}
                  onChange={(e) => setSelectedConsultant(e.target.value)}
                  required
                >
                  <option value="">Choose a consultant...</option>
                  {consultants.map((consultant) => (
                    <option key={consultant.id} value={consultant.id}>
                      {consultant.first_name} {consultant.last_name} ({consultant.email}) - {consultant.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigningCandidate(null);
                    setSelectedConsultant('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={assignMutation.isLoading || !selectedConsultant}
                >
                  {assignMutation.isLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Candidates;

