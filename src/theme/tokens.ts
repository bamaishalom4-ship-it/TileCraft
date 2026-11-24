import type { FrameThemeId } from '../types/puzzle';

export interface FrameTheme {
  id: FrameThemeId;
  label: string;
  frameOuter: string;
  frameBevelLight: string;
  frameBevelDark: string;
  cavityBg: string;
  cavityBorder: string;
  accent: string;
}

/**
 * Molded physical frame palettes inspired by classic vintage sliding puzzles.
 */
export const FRAME_THEMES: Record<FrameThemeId, FrameTheme> = {
  'classic-black': {
    id: 'classic-black',
    label: 'Obsidian',
    frameOuter: '#1F232B',
    frameBevelLight: '#383E4C',
    frameBevelDark: '#0D0F14',
    cavityBg: '#0E1016',
    cavityBorder: '#050608',
    accent: '#F59E0B',
  },
  'arcade-red': {
    id: 'arcade-red',
    label: 'Crimson',
    frameOuter: '#B91C1C',
    frameBevelLight: '#DC2626',
    frameBevelDark: '#7F1D1D',
    cavityBg: '#5C1111',
    cavityBorder: '#3B0A0A',
    accent: '#FBBF24',
  },
  'retro-yellow': {
    id: 'retro-yellow',
    label: 'Sunburst',
    frameOuter: '#D97706',
    frameBevelLight: '#F59E0B',
    frameBevelDark: '#92400E',
    cavityBg: '#6B3408',
    cavityBorder: '#451E04',
    accent: '#1E293B',
  },
  'cobalt-blue': {
    id: 'cobalt-blue',
    label: 'Cobalt',
    frameOuter: '#1D4ED8',
    frameBevelLight: '#3B82F6',
    frameBevelDark: '#1E3A8A',
    cavityBg: '#102154',
    cavityBorder: '#0A1538',
    accent: '#38BDF8',
  },
};

export const COLORS = {
  background: '#0F131D',
  surface: '#181E2E',
  surfaceElevated: '#232B40',
  border: '#2D3752',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  tileFace: '#F7F5EE',
  tileHighlight: '#FFFFFF',
  tileShadow: '#CFC9B8',
  tileCorrectBg: '#ECFDF5',
  tileCorrectBorder: '#34D399',
  tileHintBg: '#FEF3C7',
  tileHintBorder: '#F59E0B',
  tileText: '#1E2430',
  success: '#10B981',
  gold: '#F59E0B',
} as const;
