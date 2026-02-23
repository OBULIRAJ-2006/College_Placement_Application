import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
const API_BASE = process.env.REACT_APP_API_BASE;
import toast from 'react-hot-toast';
import { numberInputProps } from '../utils/inputHelpers';

const JobDrives = () => {
  const { user } = useAuth();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const departments = [
    "Computer Science and Engineering",
    "Information Technology",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Production Engineering",
    "Industrial Biotechnology",
    "Electronic and Instrumentation Engineering",
  ];

  useEffect(() => {
    fetchDrives();
  }, [departmentFilter]);


  const fetchDrives = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login first');
        return;
      }

      console.log('=== JOB DRIVES FETCH ===');
      console.log('User role:', user?.role);

      // Use role-specific endpoints
      let endpoint;
      if (user?.role === 'student') {
        endpoint = `${API_BASE}/api/job-drives/student-drives`;
      } else if (user?.role === 'placement_representative' || user?.role === 'pr') {
        endpoint = `${API_BASE}/api/job-drives/pr-drives`;
      } else {
        // For PO/admin, use all drives
        endpoint = `${API_BASE}/api/job-drives/all`;
      }

      // Add department filter if selected
      if (departmentFilter) {
        endpoint += `?department=${encodeURIComponent(departmentFilter)}`;
      }

      console.log('Using endpoint:', endpoint);

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Fetch drives response:', response.data);
      
      // Handle different response formats
      let fetchedDrives;
      if (user?.role === 'student' || user?.role === 'placement_representative' || user?.role === 'pr') {
        // These endpoints return arrays directly or wrapped in drives property
        fetchedDrives = response.data.drives || response.data || [];
      } else {
        // Admin/PO endpoints return wrapped objects
        fetchedDrives = response.data.jobDrives || response.data.drives || [];
      }
      
      console.log('Fetched drives count:', fetchedDrives.length);
      setDrives(fetchedDrives);
      
    } catch (error) {
      console.error('Fetch drives error:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        toast.error('Failed to fetch job drives');
      }
      setDrives([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentSelect = (department) => {
    setSelectedDepartment(department);
    setDepartmentFilter(department);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Job Drives</h1>
          <p className="mt-2 text-gray-600">Manage all job drives</p>
        </div>

        {/* Department Filter Section - Only for PO */}
        {(user?.role === "po" || user?.role === "placement_officer") && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                View Drives by Department
              </h2>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                List of Departments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((department) => (
                  <button
                    key={department}
                    onClick={() => handleDepartmentSelect(department)}
                    className={`p-4 text-left border rounded-lg hover:bg-blue-50 transition-colors ${
                      selectedDepartment === department
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="font-medium text-gray-900">{department}</div>
                  </button>
                ))}
              </div>
              {selectedDepartment && (
                <button
                  onClick={() => {
                    setSelectedDepartment("");
                    setDepartmentFilter("");
                  }}
                  className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg font-medium"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {drives.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No job drives found</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {drives.map((drive) => (
              <div key={drive._id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {drive.companyName} - {drive.role}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {drive.type || drive.jobType || 'Not specified'} • {drive.location || 'Not specified'} • ₹{drive.ctc || 'Not specified'} LPA
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Drive Date: {new Date(drive.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    drive.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {drive.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {drive.description && (
                  <p className="text-gray-700 mt-4">{drive.description}</p>
                )}
                
                <div className="mt-4 text-sm text-gray-600">
                  <p>Applications: {drive.applications?.length || 0}</p>
                  <p>Min CGPA: {drive.eligibility?.minCGPA || 0}</p>
                  <p>Max Backlogs: {drive.eligibility?.maxBacklogs || 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDrives;















