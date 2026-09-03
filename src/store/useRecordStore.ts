// ./src/store/useRecordStore.ts
import { create } from 'zustand';

export type RecordStep = 'CAMERA' | 'PREVIEW';

interface RecordState {
  step: RecordStep;
  setStep: (step: RecordStep) => void;
}

export const useRecordStore = create<RecordState>((set) => ({
  step: 'CAMERA',
  setStep: (step) => set({ step }),
}));