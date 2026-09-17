import API from './axios';

export const submitWithdrawal = async (data) => {
  return API.post('/withdrawals', data);
};

export const getMyWithdrawals = async () => {
  return API.get('/withdrawals/my-requests');
};

export const getAllWithdrawals = async () => {
  return API.get('/withdrawals/all');
};

export const reviewWithdrawal = async (id, data) => {
  // data: { status: 'Approved' | 'Rejected', reviewNotes?: string }
  return API.put(`/withdrawals/${id}/review`, data);
};

export const markWithdrawalAsPaid = async (id) => {
  return API.post(`/withdrawals/${id}/pay`);
};
