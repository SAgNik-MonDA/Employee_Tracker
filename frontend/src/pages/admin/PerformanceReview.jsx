import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const PerformanceReview = () => {
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    employeeId: '',
    monthYear: '',
    kpiRating: 3,
    feedback: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [empRes, revRes] = await Promise.all([
        API.get('/auth/employees'),
        API.get('/performance/all'),
      ]);
      setEmployees(empRes.data.filter((e) => e.role === 'Employee' || e.role === 'HR'));
      setReviews(revRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.monthYear) {
      toast.error('Please select employee and month');
      return;
    }

    setSubmitting(true);
    try {
      await API.post('/performance/review', formData);
      toast.success('Review submitted! ⭐');
      setFormData({ employeeId: '', monthYear: '', kpiRating: 3, feedback: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating) => '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

  // Generate monthYear options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: val, label });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Performance Review</h1>
        <p className="text-surface-500 mt-1">Submit KPI ratings and feedback for employees</p>
      </div>

      {/* Review Form */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Submit Review</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Employee</label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="select-field"
            >
              <option value="">Select Employee</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} {e.employeeCode ? `(${e.employeeCode})` : ''} — {e.department || e.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Month</label>
            <select
              value={formData.monthYear}
              onChange={(e) => setFormData({ ...formData, monthYear: e.target.value })}
              className="select-field"
            >
              <option value="">Select Month</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">KPI Rating (1-5)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={formData.kpiRating}
                onChange={(e) => setFormData({ ...formData, kpiRating: Number(e.target.value) })}
                className="flex-1 accent-primary-500"
              />
              <span className="text-2xl min-w-[80px] text-center">{renderStars(formData.kpiRating)}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Feedback</label>
            <input
              type="text"
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              className="input-field"
              placeholder="Write feedback for the employee..."
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting...' : '⭐ Submit Review'}
            </button>
          </div>
        </form>
      </div>

      {/* Reviews List */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">All Reviews</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month</th>
                <th>Rating</th>
                <th>Feedback</th>
                <th>Reviewed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-surface-500">No reviews yet</td></tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {r.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-surface-200">{r.employeeId?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td>{r.monthYear}</td>
                    <td>{renderStars(r.kpiRating)}</td>
                    <td className="max-w-[250px] truncate text-surface-400">{r.feedback || '-'}</td>
                    <td className="text-surface-400">{r.reviewedBy?.name || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceReview;
