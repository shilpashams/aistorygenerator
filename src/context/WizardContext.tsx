import { createContext, useContext, useState, ReactNode } from 'react';
import type { WizardData } from '../lib/types';

const defaultWizardData: WizardData = {
  photos: [],
  photoPreviewUrls: [],
  name: '',
  age: 5,
  interests: [],
  favorite_things: '',
  themes_to_avoid: '',
  reading_level: 'beginner',
  theme: '',
  illustration_style: 'cartoon',
  favorite_toy: '',
  nickname: '',
  proud_of: '',
  currently_learning: '',
  story_mood: '',
  family_phrase: '',
};

interface WizardContextType {
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WizardData>(defaultWizardData);

  function updateData(partial: Partial<WizardData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  function reset() {
    setData(defaultWizardData);
  }

  return (
    <WizardContext.Provider value={{ data, updateData, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}
