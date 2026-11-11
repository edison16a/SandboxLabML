/** Secondary buttons drawn over the viewport, matching the HUD's glass controls. */
export const glassButton = 'border-white/10 bg-white/10 text-white hover:bg-white/20';

/** Small caps heading for a group inside the Sandbox panel. */
export const sectionLabel = 'text-[11px] font-semibold tracking-wide text-white/55 uppercase';

/** A tile or row in the panel: lit when picked, quiet otherwise. */
export const pickable = (on: boolean) =>
  on ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white';
