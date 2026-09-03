// ./src/store/useAchievementStore.ts
import { create } from 'zustand';

export type UnlockedTask =
  | { type: 'achievement'; id: string }
  | { type: 'levelUp'; config: { type: 'individual' | 'group'; from: string | number; to: string | number; name?: string } };

interface AchievementStore {
  queue: UnlockedTask[];
  activeTask: UnlockedTask | null;
  enqueue: (task: UnlockedTask) => void;
  dequeue: () => void;
}

export const useAchievementStore = create<AchievementStore>((set, get) => ({
  queue: [],
  activeTask: null,

  enqueue: (task) => {
    set((state) => {
      const isDuplicate = state.queue.some((item) => {
        if (item.type !== task.type) return false;
        if (item.type === 'achievement' && task.type === 'achievement') {
          return item.id === task.id;
        }
        if (item.type === 'levelUp' && task.type === 'levelUp') {
          return item.config.to === task.config.to && item.config.type === task.config.type;
        }
        return false;
      });

      if (isDuplicate) return {};

      const nextQueue = [...state.queue, task];
      return {
        queue: nextQueue,
        activeTask: state.activeTask ? state.activeTask : nextQueue[0],
      };
    });
  },

  dequeue: () => {
    set((state) => {
      const remaining = state.queue.slice(1);
      return {
        queue: remaining,
        activeTask: remaining.length > 0 ? remaining[0] : null,
      };
    });
  },
}));