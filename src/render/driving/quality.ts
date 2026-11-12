/**
 * Render tiers for the city. Low, Medium and High follow Settings; Ultra
 * is only reachable through ?quality=ultra, for screenshots. Every tier has
 * the same city and the same cars; cheaper tiers drop pixels, shadows and
 * post effects first, then fine geometry.
 */
export type DrivingTier = 'low' | 'medium' | 'high' | 'ultra';

export interface TierLook {
  /** Pixel ratio range. */
  dpr: [number, number];
  shadows: boolean;
  shadowMap: number;
  /** Half size of the sun's shadow box, m. */
  shadowBox: number;
  /** The post chain: ambient occlusion, bloom, tone mapping, grade and edge smoothing. */
  post: boolean;
  ao: boolean;
  /** Cloud detail in the sky. */
  skyOctaves: number;
  envResolution: number;
  /** Glow cards behind lit lamps: tiers without bloom need them, tiers with bloom just add a touch. */
  glowCards: number;
  /** Window detail on the buildings: lit rooms, frames and sills. */
  facadeDetail: number;
  /** Pedestrians drawn with full limbs and faces, or a lighter build. */
  fineCrowd: boolean;
  antialias: boolean;
}

export const TIERS: Record<DrivingTier, TierLook> = {
  low: { dpr: [1, 1], shadows: false, shadowMap: 1024, shadowBox: 50, post: false, ao: false, skyOctaves: 3, envResolution: 128, glowCards: 1, facadeDetail: 0, fineCrowd: false, antialias: false },
  medium: { dpr: [1, 1.5], shadows: true, shadowMap: 1024, shadowBox: 60, post: true, ao: true, skyOctaves: 5, envResolution: 256, glowCards: 0.8, facadeDetail: 1, fineCrowd: true, antialias: false },
  high: { dpr: [1, 2], shadows: true, shadowMap: 2048, shadowBox: 75, post: true, ao: true, skyOctaves: 6, envResolution: 512, glowCards: 0.45, facadeDetail: 2, fineCrowd: true, antialias: false },
  ultra: { dpr: [1, 2], shadows: true, shadowMap: 4096, shadowBox: 90, post: true, ao: true, skyOctaves: 6, envResolution: 1024, glowCards: 0.45, facadeDetail: 2, fineCrowd: true, antialias: false },
};

/** The car and paint detail a tier builds: Ultra shares High's geometry. */
export function detailTier(tier: DrivingTier): 'low' | 'medium' | 'high' {
  return tier === 'ultra' ? 'high' : tier;
}
