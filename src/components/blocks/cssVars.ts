import type { CSSProperties } from 'react';

// Style object that also accepts CSS custom properties (--span, --pair-ratio…).
// Use instead of `as CSSProperties` casts so Block components keep type safety.
export type VarStyle = CSSProperties & Record<`--${string}`, string | number>;
