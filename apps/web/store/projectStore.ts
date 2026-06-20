"use client";

import { create } from "zustand";

type ProjectState = {
  currentProjectId?: string;
  setCurrentProjectId: (projectId: string) => void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: undefined,
  setCurrentProjectId: (projectId) => set({ currentProjectId: projectId })
}));

