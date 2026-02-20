import api from './api';

export interface SiteSettingsData {
  siteName: string;
  siteSubtitle: string;
  logoUrl: string;
  navIcons: Record<string, string>;
  showDashboardHero: boolean;
}

export const siteSettingsService = {
  get: () => api.get<SiteSettingsData>('/site-settings').then((r) => r.data),
  update: (data: Partial<SiteSettingsData>) =>
    api.put('/site-settings', data).then((r) => r.data),
};
