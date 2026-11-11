/** Secondary buttons drawn over the viewport, matching the HUD's glass controls. */
export const overlayButton = 'border-white/10 bg-white/10 text-white hover:bg-white/20';

/** Small caps heading for a group inside a viewport card. */
export const sectionLabel = 'text-[11px] font-semibold tracking-wide text-white/55 uppercase';

/** A choice tile over the viewport: lit when picked. */
export const overlayTile = (on: boolean) =>
  `flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] font-medium transition-colors ${on ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white'}`;
