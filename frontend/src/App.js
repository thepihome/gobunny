import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Resumes from './pages/Resumes';
import Matches from './pages/Matches';
import Candidates from './pages/Candidates';
import CandidateDetails from './pages/CandidateDetails';
import Timesheets from './pages/Timesheets';
import CRM from './pages/CRM';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/jobs" element={<Jobs />} />
                      <Route path="/jobs/:id" element={<JobDetails />} />
                      <Route path="/resumes" element={<Resumes />} />
                      <Route path="/matches" element={<Matches />} />
                      <Route path="/candidates" element={<Candidates />} />
                      <Route path="/candidates/:id" element={<CandidateDetails />} />
                          <Route path="/timesheets" element={<Timesheets />} />
                          <Route path="/crm" element={<CRM />} />
                          <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

