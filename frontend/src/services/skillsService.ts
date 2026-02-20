import api from './api';

export interface SystemSkill {
  name: string;
  description?: string;
  type?: string;
  path?: string;
}

export const skillsService = {
  list: () =>
    api.get<{ skills: SystemSkill[] }>('/skills').then((r) => r.data.skills),
};
