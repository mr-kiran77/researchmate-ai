const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.detail) msg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
    } catch {
      // ignore parse failure
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  getHealth: () => request('/health'),
  getPreferences: () => request('/preferences'),
  updatePreferences: (prefs) => request('/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),

  createPlan: (payload) => request('/research/plan', { method: 'POST', body: JSON.stringify(payload) }),
  getRelatedImages: (q, limit = 8) =>
    request(`/research/images?q=${encodeURIComponent(q)}&limit=${limit}`),
  quickTopicSearch: (q, limit = 8) =>
    request(`/research/quick?q=${encodeURIComponent(q)}&limit=${limit}`),
  runResearchSync: (payload) => request('/research/run', { method: 'POST', body: JSON.stringify(payload) }),

  async runResearchStream(payload, handlers = {}) {
    const res = await fetch(`${API_BASE}/research/run/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Failed to start research stream (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalReport = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        let eventType = 'message';
        const dataLines = [];
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) continue;
        const parsed = JSON.parse(dataLines.join('\n'));
        if (eventType === 'progress' && handlers.onProgress) handlers.onProgress(parsed);
        else if (eventType === 'plan' && handlers.onPlan) handlers.onPlan(parsed);
        else if (eventType === 'sources_found' && handlers.onSourcesFound) handlers.onSourcesFound(parsed);
        else if (eventType === 'images_found' && handlers.onImagesFound) handlers.onImagesFound(parsed);
        else if (eventType === 'verification' && handlers.onVerification) handlers.onVerification(parsed);
        else if (eventType === 'complete') {
          finalReport = parsed;
          if (handlers.onComplete) handlers.onComplete(parsed);
        } else if (eventType === 'error') {
          throw new Error(parsed.message || 'Research pipeline failed');
        }
      }
    }
    return finalReport;
  },

  listReports: (q = '') => request(`/reports${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getReport: (id) => request(`/reports/${id}`),
  toggleStarReport: (id) => request(`/reports/${id}/star`, { method: 'POST' }),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
  getExportPdfUrl: (id) => `${API_BASE}/reports/${id}/export/pdf`,

  getChatMessages: (reportId) => request(`/reports/${reportId}/chat`),
  sendChatMessage: (reportId, message) =>
    request(`/reports/${reportId}/chat`, { method: 'POST', body: JSON.stringify({ message }) }),
  clearChatMessages: (reportId) => request(`/reports/${reportId}/chat`, { method: 'DELETE' }),

  uploadPdf: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/pdfs/upload', { method: 'POST', body: fd });
  },
  listPdfs: () => request('/pdfs'),
  getPdfDetail: (id) => request(`/pdfs/${id}`),
  comparePdfWithWeb: (id, payload) =>
    request(`/pdfs/${id}/compare-web`, { method: 'POST', body: JSON.stringify(payload) }),
  deletePdf: (id) => request(`/pdfs/${id}`, { method: 'DELETE' }),

  listKbDocs: () => request('/knowledge-base'),
  createKbDoc: (payload) => request('/knowledge-base', { method: 'POST', body: JSON.stringify(payload) }),
  deleteKbDoc: (id) => request(`/knowledge-base/${id}`, { method: 'DELETE' }),

  // Authentication endpoints (Sign Up & Log In)
  authSignup: (payload) => request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  authLogin: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  // User Profile, Real Activity, Scheduled Content & Problem Reports
  getProfile: (userId = 'guest-demo', username = '') =>
    request(`/profile?user_id=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`),
  updateProfile: (userId, payload) =>
    request(`/profile?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateProfileSettings: (userId, payload) =>
    request(`/profile/settings?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createProfilePost: (userId, payload) =>
    request(`/profile/posts?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  toggleProfileItemLike: (itemId) =>
    request(`/profile/items/${encodeURIComponent(itemId)}/like`, { method: 'POST' }),
  toggleProfileItemSave: (itemId, kind = 'post') =>
    request(`/profile/items/${encodeURIComponent(itemId)}/save?kind=${encodeURIComponent(kind)}`, {
      method: 'POST',
    }),
  listSavedImages: (userId = 'guest-demo') =>
    request(`/profile/saved-images?user_id=${encodeURIComponent(userId)}`),
  toggleSavedImage: (userId, payload) =>
    request(`/profile/saved-images/toggle?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteSavedImage: (imageId) =>
    request(`/profile/saved-images/${encodeURIComponent(imageId)}`, { method: 'DELETE' }),
  createScheduledPost: (userId, payload) =>
    request(`/profile/scheduled?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteScheduledPost: (schedId) =>
    request(`/profile/scheduled/${encodeURIComponent(schedId)}`, { method: 'DELETE' }),
  sendActivityHeartbeat: (userId, seconds = 15) =>
    request(`/profile/heartbeat?user_id=${encodeURIComponent(userId)}&seconds=${seconds}`, {
      method: 'POST',
    }),
  submitProblemReport: (userId, description, screenshotFile = null) => {
    const fd = new FormData();
    fd.append('user_id', userId);
    fd.append('description', description);
    if (screenshotFile) fd.append('screenshot', screenshotFile);
    return request('/profile/problem-reports', { method: 'POST', body: fd });
  },
};
