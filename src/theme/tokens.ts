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
 * Core 16-bit City Arcade Palette.
 */
export const PALETTE = {
  ink: '#161820',
  arcadeOrange: '#FF8A16',
  arcadeOrangeDeep: '#C95E08',
  cream: '#FFF0D0',
  dustyCream: '#EAD8B4',
  cityTeal: '#257F8C',
  cityTealDark: '#1A535E',
  fadedTeal: '#2B646C',
  brickRed: '#B74A3C',
  brickRedDark: '#822F26',
  sunsetPeach: '#F3B78E',
  dustyBlue: '#486684',
  dustyMauve: '#725C76',
  nightNavy: '#1B1F30',
  nightPurple: '#312942',
  amberWindow: '#FFBE55',
} as const;

/**
 * Typography families bundled locally in `assets/fonts/` and `public/fonts/`.
 * - `display`: Silkscreen Bold — oversized wordmark / big display headings
 * - `pixel`: Pixel Operator Bold — START, mode labels, short HUD labels, card headers
 * - `body`: System sans-serif — instructions, settings, dialogs, error messages, readable copy
 */
export const FONTS = {
  display: 'SilkscreenBold',
  pixel: 'PixelOperatorBold',
  body: undefined,
} as const;

/**
 * Chunky tactile tray palettes preserving existing FrameThemeId keys & unlocks,
 * tuned to the 16-bit city / dusty gym / sunset arcade aesthetic.
 */
export const FRAME_THEMES: Record<FrameThemeId, FrameTheme> = {
  'classic-black': {
    id: 'classic-black',
    label: 'Gym Teal',
    frameOuter: '#257F8C',
    frameBevelLight: '#4CA2AE',
    frameBevelDark: '#161820',
    cavityBg: '#161820',
    cavityBorder: '#0B0D12',
    accent: '#B74A3C',
  },
  'arcade-red': {
    id: 'arcade-red',
    label: 'Brick Red',
    frameOuter: '#B74A3C',
    frameBevelLight: '#D86C5D',
    frameBevelDark: '#6B241C',
    cavityBg: '#161820',
    cavityBorder: '#0B0D12',
    accent: '#FFF0D0',
  },
  'retro-yellow': {
    id: 'retro-yellow',
    label: 'Sunset Peach',
    frameOuter: '#C47746',
    frameBevelLight: '#F3B78E',
    frameBevelDark: '#6E3C1D',
    cavityBg: '#161820',
    cavityBorder: '#0B0D12',
    accent: '#FFF0D0',
  },
  'cobalt-blue': {
    id: 'cobalt-blue',
    label: 'Dusk Mauve',
    frameOuter: '#5D4C66',
    frameBevelLight: '#8B7491',
    frameBevelDark: '#2A2130',
    cavityBg: '#161820',
    cavityBorder: '#0B0D12',
    accent: '#F3B78E',
  },
};

export const COLORS = {
  // Primary Night / City Ink Surfaces
  background: PALETTE.ink,
  surface: '#212536',
  surfaceElevated: '#2B3046',
  border: '#3C435E',
  hardBorder: PALETTE.ink,

  // Screen-specific Environment Tints (Boxing Gym Classic / Sunset Office Photo / Night Bus Stop Secondary)
  classicBg: '#1C353C',
  classicSurface: '#24464E',
  classicBorder: '#3C6D75',

  photoBg: '#32293B',
  photoSurface: '#43364E',
  photoSurfaceAlt: '#3A4B63',
  photoBorder: '#725C76',

  nightBg: '#161820',
  nightSurface: '#222538',
  nightSurfacePurple: '#302940',

  // Typography
  textPrimary: PALETTE.cream,
  textSecondary: '#C8C2BA',
  textMuted: '#9A97A2',
  textDark: PALETTE.ink,

  // Chunky Dusty Cream Tiles
  tileFace: '#FFF0D0',
  tileHighlight: '#FFF8E8',
  tileShadow: '#B9A37C',
  tileCorrectBg: '#F6E2BA',
  tileCorrectBorder: '#B74A3C',
  tileHintBg: '#FFD39E',
  tileHintBorder: '#FF8A16',
  tileText: PALETTE.ink,

  // Card Stock (Collectible Cards visual treatment)
  cardStock: '#FFF0D0',
  cardStockMuted: '#EAD8B4',

  // Accents
  success: '#38A382',
  gold: PALETTE.arcadeOrange,
  accentOrange: PALETTE.arcadeOrange,
  accentTeal: PALETTE.cityTeal,
  accentBrick: PALETTE.brickRed,
  accentPeach: PALETTE.sunsetPeach,
  accentMauve: PALETTE.dustyMauve,
  amber: PALETTE.amberWindow,
} as const;
