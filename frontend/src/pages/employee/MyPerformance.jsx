import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MyPerformance = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const { data } = await API.get('/performance/my-reviews');
      setReviews(data);
    } catch (error) {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const chartData = reviews
    .slice()
    .reverse()
    .map((r) => ({
      month: r.monthYear,
      rating: r.kpiRating,
    }));

  const getBarColor = (rating) => {
    if (rating >= 5) return '#10b981';
    if (rating >= 4) return '#6366f1';
    if (rating >= 3) return '#f59e0b';
    return '#f43f5e';
  };

  const renderStars = (rating) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">My Performance</h1>
        <p className="text-surface-500 mt-1">View your KPI ratings and feedback over time</p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Performance Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="rating" radius={[8, 8, 0, 0]} maxBarSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.rating)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Reviews Table */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Review Details</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rating</th>
                <th>Feedback</th>
                <th>Reviewed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : reviews.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-surface-500">No reviews yet</td></tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r._id}>
                    <td className="font-medium text-surface-200">{r.monthYear}</td>
                    <td>{renderStars(r.kpiRating)}</td>
                    <td className="max-w-[300px] truncate">{r.feedback || '-'}</td>
                    <td>{r.reviewedBy?.name || '-'}</td>
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

export default MyPerformance;
