import { create } from 'zustand'

export const useStore = create((set) => ({
  entered: false,
  active: null, // id of the focused section
  hovered: null,
  neon: true,
  music: false,
  enter: (music) => set({ entered: true, music }),
  toggleMusic: () => set((s) => ({ music: !s.music })),
  focus: (id) => set({ active: id, hovered: null, peek: null }),
  close: () => set({ active: null, peek: null }),
  // a light zoom towards something (e.g. the developer) without opening a panel
  peek: null,
  setPeek: (peek) => set({ peek }),
  // bumping this sends the camera back to the default studio view
  resetTick: 0,
  resetView: () => set((s) => ({ active: null, peek: null, resetTick: s.resetTick + 1 })),
  setHovered: (hovered) => set({ hovered }),
  toggleNeon: () => set((s) => ({ neon: !s.neon })),
  // 'warm' (amber evening, the default) or 'night' (dim blue, pink and black)
  theme: 'warm',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'warm' ? 'night' : 'warm' })),
}))
