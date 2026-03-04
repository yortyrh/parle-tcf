import { APP_CONFIG_DEFAULTS } from '@/app-config';
import type { AppConfig } from '@/app-config';

export const TEF_APP_CONFIG: AppConfig = {
  ...APP_CONFIG_DEFAULTS,
  companyName: 'TEF Canada Agent',
  pageTitle: 'TEF Canada – Expression Orale',
  pageDescription: "Pratique de l'expression orale pour le TEF Canada",
  startButtonText: 'Commencer',
  tasks: [
    {
      id: 'A',
      title: 'Section A',
      description: 'Vous avez lu une annonce. Téléphonez pour obtenir des informations (~5 min)',
      taskType: 'tef-section-a',
    },
    {
      id: 'B',
      title: 'Section B',
      description:
        'Vous avez lu une annonce. Présentez-la à un(e) ami(e) et convainquez-le/la (~10 min)',
      taskType: 'tef-section-b',
    },
  ],
};
