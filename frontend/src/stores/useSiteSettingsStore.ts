import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { siteSettingsService } from '@/services/siteSettingsService';

export interface NavIconConfig {
  dashboard: string;
  knowledge: string;
  scheduler: string;
  boards: string;
  settings: string;
  aiModels: string;
  integrations: string;
  data: string;
}

interface SiteSettings {
  siteName: string;
  siteSubtitle: string;
  logoUrl: string;
  navIcons: NavIconConfig;
  showDashboardHero: boolean;
  synced: boolean;

  fetchSettings: () => Promise<void>;
  setSiteName: (name: string) => void;
  setSiteSubtitle: (subtitle: string) => void;
  setLogoUrl: (url: string) => void;
  setNavIcon: (key: keyof NavIconConfig, icon: string) => void;
  setShowDashboardHero: (show: boolean) => void;
  resetAll: () => void;
}

const DEFAULT_NAV_ICONS: NavIconConfig = {
  dashboard: 'streamline-color:dashboard-3',
  knowledge: 'streamline-color:open-book',
  scheduler: 'streamline-color:circle-clock',
  boards: 'streamline-color:paint-palette',
  settings: 'streamline-color:cog',
  aiModels: 'streamline-color:computer-chip-1',
  integrations: 'streamline-color:electric-cord-1',
  data: 'streamline-color:database',
};

const DEFAULTS = {
  siteName: 'MutiExpert',
  siteSubtitle: '知识管理平台',
  logoUrl: '/logo.svg',
  navIcons: { ...DEFAULT_NAV_ICONS },
  showDashboardHero: true,
};

/** Debounced save to API */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(data: Partial<Record<string, unknown>>) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    siteSettingsService.update(data).catch(() => {});
  }, 800);
}

export const useSiteSettingsStore = create<SiteSettings>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      synced: false,

      fetchSettings: async () => {
        try {
          const data = await siteSettingsService.get();
          set({
            siteName: data.siteName,
            siteSubtitle: data.siteSubtitle,
            logoUrl: data.logoUrl,
            navIcons: { ...DEFAULT_NAV_ICONS, ...data.navIcons } as NavIconConfig,
            synced: true,
          });
        } catch {
          // Use cached localStorage values
        }
      },

      setSiteName: (name) => {
        set({ siteName: name });
        debouncedSave({ siteName: name });
      },
      setSiteSubtitle: (subtitle) => {
        set({ siteSubtitle: subtitle });
        debouncedSave({ siteSubtitle: subtitle });
      },
      setLogoUrl: (url) => {
        set({ logoUrl: url });
        debouncedSave({ logoUrl: url });
      },
      setNavIcon: (key, icon) =>
        set((s) => {
          const navIcons = { ...s.navIcons, [key]: icon };
          debouncedSave({ navIcons });
          return { navIcons };
        }),
      setShowDashboardHero: (show) => {
        set({ showDashboardHero: show });
        debouncedSave({ showDashboardHero: show });
      },
      resetAll: () => {
        set({
          siteName: DEFAULTS.siteName,
          siteSubtitle: DEFAULTS.siteSubtitle,
          logoUrl: DEFAULTS.logoUrl,
          navIcons: { ...DEFAULT_NAV_ICONS },
          showDashboardHero: DEFAULTS.showDashboardHero,
        });
        siteSettingsService.update({
          siteName: DEFAULTS.siteName,
          siteSubtitle: DEFAULTS.siteSubtitle,
          logoUrl: DEFAULTS.logoUrl,
          navIcons: { ...DEFAULT_NAV_ICONS },
          showDashboardHero: DEFAULTS.showDashboardHero,
        }).catch(() => {});
      },
    }),
    {
      name: 'mutiexpert-site-settings',
      partialize: (state) => ({
        siteName: state.siteName,
        siteSubtitle: state.siteSubtitle,
        logoUrl: state.logoUrl,
        navIcons: state.navIcons,
        showDashboardHero: state.showDashboardHero,
      }),
    },
  ),
);
