import api from './api';

export const dataManagementService = {
  export: () => api.get('/data/export').then((r) => r.data),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/data/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  rebuildIndexes: () => api.post('/data/rebuild-indexes').then((r) => r.data),
};
