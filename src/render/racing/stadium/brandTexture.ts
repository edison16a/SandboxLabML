import * as THREE from 'three';

/** Board styles: the app's dark navy with the mark, or a plain light panel with the mark in color. */
export type BoardStyle = 'dark' | 'light' | 'blue';

const BG: Record<BoardStyle, string> = { dark: '#0b0e14', light: '#eef0f2', blue: '#1d4f9c' };
const TEXT: Record<BoardStyle, string> = { dark: '#e8ecf2', light: '#121722', blue: '#ffffff' };

/**
 * Draws the SandboxLab mark (one bent molecule of three atoms) at (x, y),
 * `s` pixels per unit of its 28 unit design, exactly as the header logo.
 */
function drawMark(g: CanvasRenderingContext2D, x: number, y: number, s: number, mono: string | null): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineCap = 'round';
  g.lineWidth = 2;
  g.strokeStyle = mono ?? '#4C9AFF';
  g.beginPath();
  g.moveTo(6, 20);
  g.lineTo(14, 8);
  g.lineTo(22, 20);
  g.stroke();
  g.fillStyle = mono ?? '#4C9AFF';
  for (const cx of [6, 22]) {
    g.beginPath();
    g.arc(cx, 20, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = mono ?? '#FF9F43';
  g.beginPath();
  g.arc(14, 8, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * A trackside board with the app's own mark and name, drawn into a canvas.
 * No outside brands anywhere: circuit boards carry the lab's logo or
 * nothing at all. `aspect` is width over height.
 */
export function brandTexture(style: BoardStyle, aspect: number, withName = true): THREE.CanvasTexture {
  const h = 128;
  const w = Math.round(h * aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = BG[style];
  g.fillRect(0, 0, w, h);
  const mono = style === 'blue' ? '#ffffff' : null;
  const s = (h * 0.78) / 28;
  if (!withName) {
    drawMark(g, w / 2 - 14 * s, h / 2 - 14.5 * s, s, mono);
  } else {
    g.font = `600 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
    const name = 'SandboxLab';
    const ml = 'ML';
    const total = 30 * s + g.measureText(name + ml).width;
    let x = (w - total) / 2;
    drawMark(g, x, h / 2 - 14.5 * s, s, mono);
    x += 30 * s;
    g.textBaseline = 'middle';
    g.fillStyle = TEXT[style];
    g.fillText(name, x, h / 2 + h * 0.03);
    g.fillStyle = style === 'dark' ? '#4C9AFF' : TEXT[style];
    g.fillText(ml, x + g.measureText(name).width, h / 2 + h * 0.03);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
