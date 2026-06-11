import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code !== 0 && data.code !== 200) {
        const msg = data.message || '操作失败';
        if (data.code === 403) {
          return Promise.resolve({ blocked: true, ...data });
        }
        message.error(msg);
        return Promise.resolve(data);
      }
    }
    return data;
  },
  (err) => {
    console.error('API请求错误:', err);
    message.error(err?.response?.data?.message || err.message || '网络错误');
    return Promise.reject(err);
  }
);

export const dashboardApi = {
  overview: () => api.get('/dashboard/overview'),
  init: () => api.get('/dashboard/init'),
  recycleCheck: () => api.get('/dashboard/recycle-check')
};

export const spacesApi = {
  list: (params) => api.get('/spaces', { params }),
  detail: (id) => api.get(`/spaces/${id}`),
  create: (data) => api.post('/spaces', data),
  freeze: (id, data) => api.put(`/spaces/${id}/freeze`, data),
  stats: () => api.get('/spaces/stats/overview')
};

export const tenantsApi = {
  list: (params) => api.get('/tenants', { params }),
  detail: (id) => api.get(`/tenants/${id}`),
  leases: (id) => api.get(`/tenants/${id}/leases`),
  create: (data) => api.post('/tenants', data),
  update: (id, data) => api.put(`/tenants/${id}`, data)
};

export const leasesApi = {
  list: (params) => api.get('/leases', { params }),
  detail: (id) => api.get(`/leases/${id}`),
  expiring: (days) => api.get('/leases/expiring', { params: { days } }),
  recycleExpired: () => api.get('/leases/recycle-expired'),
  create: (data) => api.post('/leases/create', data),
  submitRenewal: (data) => api.post('/leases/submit-renewal', data)
};

export const renewalsApi = {
  list: (params) => api.get('/renewals', { params }),
  detail: (id) => api.get(`/renewals/${id}`),
  approve: (id, data) => api.post(`/renewals/${id}/approve`, data),
  reject: (id, data) => api.post(`/renewals/${id}/reject`, data),
  cancel: (id) => api.post(`/renewals/${id}/cancel`)
};

export const arrearsApi = {
  list: (params) => api.get('/arrears', { params }),
  detail: (id) => api.get(`/arrears/${id}`),
  tenantUnsettled: (tenantId) => api.get(`/arrears/tenant/${tenantId}/unsettled`),
  pay: (id, data) => api.post(`/arrears/${id}/pay`, data),
  stats: () => api.get('/arrears/stats/overview')
};

export const paymentsApi = {
  list: (params) => api.get('/payments', { params }),
  detail: (id) => api.get(`/payments/${id}`),
  daily: (date) => api.get('/payments/stats/daily', { params: { date } })
};

export default api;
