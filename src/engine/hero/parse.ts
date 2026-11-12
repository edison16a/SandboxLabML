/** Small type guards for reading the hero files, which arrive as untyped JSON. */
export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
