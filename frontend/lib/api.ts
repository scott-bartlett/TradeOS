import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── JOBS ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (status?: string) =>
    api.get('/api/jobs/', { params: { status } }).then(r => r.data),
  get: (jobId: string) =>
    api.get(`/api/jobs/${jobId}`).then(r => r.data),
  create: (data: any) =>
    api.post('/api/jobs/', data).then(r => r.data),
  updateStatus: (jobId: string, status: string) =>
    api.patch(`/api/jobs/${jobId}/status`, { status }).then(r => r.data),
  setQuoteTotal: (jobId: string, data: any) =>
    api.patch(`/api/jobs/${jobId}/quote-total`, data).then(r => r.data),
  generateSupplyList: (jobId: string, dictation: string) =>
    api.post(`/api/jobs/${jobId}/supply-list`, { dictation }).then(r => r.data),
  addFieldNote: (jobId: string, data: any) =>
    api.post(`/api/jobs/${jobId}/field-note`, data).then(r => r.data),
  getSupplyItems: (jobId: string) =>
    api.get(`/api/jobs/${jobId}/supply-items`).then(r => r.data),
  getFieldNotes: (jobId: string) =>
    api.get(`/api/jobs/${jobId}/field-notes`).then(r => r.data),
  getDashboardSummary: () =>
    api.get('/api/jobs/dashboard/summary').then(r => r.data),
  generateFlags: () =>
    api.post('/api/jobs/dashboard/flags').then(r => r.data),
};

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: () =>
    api.get('/api/customers/').then(r => r.data),
  get: (customerId: string) =>
    api.get(`/api/customers/${customerId}`).then(r => r.data),
  create: (data: any) =>
    api.post('/api/customers/', data).then(r => r.data),
  addLocation: (customerId: string, data: any) =>
    api.post(`/api/customers/${customerId}/locations`, data).then(r => r.data),
};

// ── PHOTOS ────────────────────────────────────────────────────────────────────
export const photosApi = {
  upload: (jobId: string, file: File, photoType: string = 'equipment') => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/photos/upload/${jobId}?photo_type=${photoType}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  analyze: (jobId: string) =>
    api.post(`/api/photos/analyze/${jobId}`).then(r => r.data),
  list: (jobId: string) =>
    api.get(`/api/photos/${jobId}`).then(r => r.data),
  delete: (photoId: string) =>
  api.delete(`/api/photos/${photoId}`).then(r => r.data),
  analyzeAndGenerate: (jobId: string, dictation: string = '') =>
  api.post(`/api/photos/analyze-and-generate/${jobId}`, null, {
    params: { dictation }
  }).then(r => r.data),
};

// ── CHANGE ORDERS ─────────────────────────────────────────────────────────────
export const changeOrdersApi = {
  list: (jobId: string) =>
    api.get(`/api/change-orders/${jobId}`).then(r => r.data),
  create: (jobId: string, data: any) =>
    api.post(`/api/change-orders/${jobId}`, data).then(r => r.data),
  approve: (coId: string) =>
    api.post(`/api/change-orders/${coId}/approve`).then(r => r.data),
};

// ── INVOICES ──────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: () =>
    api.get('/api/invoices/').then(r => r.data),
  get: (invoiceId: string) =>
    api.get(`/api/invoices/${invoiceId}`).then(r => r.data),
  getForJob: (jobId: string) =>
    api.get(`/api/invoices/job/${jobId}`).then(r => r.data),
  build: (jobId: string) =>
    api.post(`/api/invoices/build/${jobId}`).then(r => r.data),
  updateReview: (invoiceId: string, data: any) =>
    api.patch(`/api/invoices/${invoiceId}/review`, data).then(r => r.data),
  send: (invoiceId: string) =>
    api.post(`/api/invoices/${invoiceId}/send`).then(r => r.data),
};

// ── USERS ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () =>
    api.get('/api/users/').then(r => r.data),
  getByRole: (role: string) =>
    api.get(`/api/users/role/${role}`).then(r => r.data),
};

// ── VAN INVENTORY ─────────────────────────────────────────────────────────────
export const vanInventoryApi = {
  get: (techId: string) =>
    api.get(`/api/van-inventory/${techId}`).then(r => r.data),
  getRestock: (techId: string) =>
    api.get(`/api/van-inventory/${techId}/restock`).then(r => r.data),
};

export default api;