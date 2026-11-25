import { useState } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { HiOutlineX, HiOutlineStar, HiStar } from 'react-icons/hi';

const ReviewModal = ({ isOpen, onClose, onReviewSubmitted }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !comment) {
      toast.error('Please enter your name and review');
      return;
    }

    setLoading(true);
    try {
      const { data } = await API.post('/landing/submit-review', {
        name,
        role,
        company,
        rating,
        comment,
      });

      toast.success(data.message || 'Thank you for your feedback! ⭐');
      if (onReviewSubmitted) onReviewSubmitted(data.review);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border border-surface-700 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100 transition-colors"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="text-3xl mb-2">⭐</div>
          <h3 className="text-xl font-display font-extrabold text-surface-100">
            Share Your Experience
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            Let other enterprise organizations know how Employee Tracker transformed your HR workflows
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
              Your Name <span className="text-teal-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Das"
              required
              className="input-field text-sm h-10 bg-surface-900/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                Your Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. HR Manager"
                className="input-field text-sm h-10 bg-surface-900/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Alpha Tech"
                className="input-field text-sm h-10 bg-surface-900/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
              Overall Rating
            </label>
            <div className="flex items-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 text-2xl transition-transform hover:scale-110"
                >
                  {star <= rating ? (
                    <HiStar className="text-amber-400" />
                  ) : (
                    <HiOutlineStar className="text-surface-600" />
                  )}
                </button>
              ))}
              <span className="text-xs font-bold text-amber-300 ml-2">
                {rating} out of 5 stars
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
              Your Review / Feedback <span className="text-teal-400">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what features your team likes the most..."
              required
              rows={3}
              className="input-field text-sm p-3 bg-surface-900/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 btn-primary rounded-full shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'Submit Verified Review ⭐'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
