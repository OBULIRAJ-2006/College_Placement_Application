import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const PRRegistrationRequest = () => {
  const [formData, setFormData] = useState({
    email: '',
    role: 'placement_representative',
    department: 'CSE',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const departments = ['CSE', 'IT', 'ECE', 'MECH', 'CIVIL', 'EEE'];
  const roles = [
    { value: 'placement_representative', label: 'Placement Representative (PR)' },
    { value: 'placement_officer', label: 'Placement Officer (PO)' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.role || !formData.department) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!formData.email.match(/@gct\.ac\.in$/)) {
      toast.error('Please use institutional email (@gct.ac.in)');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/allowlist/request', formData);
      toast.success(response.data.message);
      setSubmitted(true);
      setFormData({
        email: '',
        role: 'placement_representative',
        department: 'CSE',
        notes: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your registration request has been submitted. A Placement Officer will review and approve it soon.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 py-12">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Request Registration</h2>
        <p className="text-gray-600 mb-6">Request to register as PR or PO</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Institutional Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.name@gct.ac.in"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              required
            />
            <p className="text-xs text-gray-500 mt-1">PR/PO must use institutional email (@gct.ac.in)</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            >
              {roles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department *
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional information (optional)"
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition mt-6"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-6 text-center">
          A Placement Officer must approve your request before you can register.
        </p>
      </div>
    </div>
  );
};

export default PRRegistrationRequest;
