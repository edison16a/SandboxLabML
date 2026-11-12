import * as THREE from 'three';

/** The pill's size as a sprite that keeps its size on screen: a share of the view, under the chase camera's lens. */
export const LABEL_SIZE = { w: 0.075, h: 0.03 };

/**
 * A small text pill drawn into a canvas and shown as a sprite that keeps
 * its size on screen, for the overlay's distance label. The canvas is only
 * redrawn when the text or color changes, which for a whole number of
 * meters is a few times a second at most. It is depth tested, nudged a
 * little toward the camera, so a building in front hides it rather than a
 * pill floating over the roofs.
 */
export class TextLabel {
  readonly sprite: THREE.Sprite;
  private readonly canvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.SpriteMaterial;
  private meters = -1;
  private color = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 64;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      sizeAttenuation: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(LABEL_SIZE.w, LABEL_SIZE.h, 1);
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
  }

  /** Shows a whole number of meters; the text is only built when the number or color changes. */
  setMeters(meters: number, color: string): void {
    if (meters === this.meters && color === this.color) return;
    this.meters = meters;
    this.color = color;
    const text = `${meters} m`;
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10, 13, 19, 0.82)';
    g.beginPath();
    g.roundRect(4, 8, w - 8, h - 16, 10);
    g.fill();
    g.fillStyle = color;
    g.font = '600 30px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}
