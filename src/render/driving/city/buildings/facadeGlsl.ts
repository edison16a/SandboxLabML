/**
 * The facade shader's body: per pixel, works out whether a building face
 * is wall, window frame, glass, storefront or roof, and returns albedo,
 * roughness, metalness and emission. Five styles share one program; the
 * style and a seed ride on every vertex. Every edge is filtered by its
 * screen footprint and a window grid too fine to resolve fades to its
 * average, so towers far down the street never shimmer.
 */
export const FACADE_GLSL = /* glsl */ `
struct Facade { vec3 albedo; float rough; float metal; vec3 emit; };

float aaBox(float x, float a, float b, float w) {
  return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x);
}

vec3 wallColor(float style, float seed) {
  float t = fract(seed * 7.13);
  float u = fract(seed * 3.31);
  if (style < 0.5) return mix(vec3(0.16, 0.2, 0.23), vec3(0.3, 0.31, 0.32), t);
  if (style < 1.5) return mix(mix(vec3(0.36, 0.12, 0.07), vec3(0.47, 0.22, 0.12), t), vec3(0.5, 0.36, 0.26), step(0.8, u));
  if (style < 2.5) return mix(mix(vec3(0.66, 0.64, 0.6), vec3(0.78, 0.74, 0.66), t), mix(vec3(0.72, 0.58, 0.46), vec3(0.62, 0.66, 0.66), t), step(0.65, u));
  if (style < 3.5) return mix(mix(vec3(0.72, 0.64, 0.5), vec3(0.84, 0.79, 0.69), t), vec3(0.78, 0.6, 0.48), step(0.75, u));
  return mix(vec3(0.12, 0.12, 0.13), vec3(0.26, 0.24, 0.22), t);
}

vec3 glassTint(float style, float seed) {
  float t = fract(seed * 3.71);
  if (style < 0.5) return mix(vec3(0.3, 0.44, 0.5), vec3(0.36, 0.42, 0.56), t);
  if (style > 3.5) return vec3(0.42, 0.34, 0.26);
  return vec3(0.24, 0.27, 0.3);
}

/** Floor height, window bay width, window width and height (shares of the bay and floor), lit chance. */
vec4 styleGrid(float style) {
  if (style < 0.5) return vec4(3.6, 1.6, 0.94, 0.74);
  if (style < 1.5) return vec4(3.3, 2.9, 0.46, 0.56);
  if (style < 2.5) return vec4(3.4, 3.8, 0.88, 0.48);
  if (style < 3.5) return vec4(3.8, 3.1, 0.42, 0.6);
  return vec4(3.5, 1.25, 0.66, 0.82);
}

const float SHOP_H = 4.4;

Facade facadeAt(vec2 uv, vec2 duv, vec4 f, float wallTop, float detail) {
  Facade o;
  o.emit = vec3(0.0);
  float style = floor(f.x + 0.5);
  // Quantized: a hash amplifies the smallest difference, so the seed must be exactly the same on every pixel.
  float seed = floor(f.y * 1000.0 + 0.5) / 1000.0;
  float len = f.z;
  float kind = f.w;
  vec3 wall = wallColor(style, seed);
  float grime = cityFbm(uv * vec2(0.35, 0.12) + seed * 40.0);
  if (kind > 2.5) {
    o.albedo = vec3(0.2, 0.2, 0.21) * mix(0.75, 1.15, cityFbm(uv * 0.4 + seed * 9.0));
    o.rough = 0.95;
    o.metal = 0.0;
    return o;
  }
  // Soot near the street and soft streaks down the face.
  float dirt = mix(0.82, 1.0, smoothstep(0.0, 2.5, uv.y)) * mix(0.86, 1.04, grime);
  if (kind > 1.5) {
    o.albedo = wall * dirt;
    o.rough = style < 0.5 || style > 3.5 ? 0.45 : 0.85;
    o.metal = style < 0.5 || style > 3.5 ? 0.4 : 0.0;
    return o;
  }
  vec4 grid = styleGrid(style);
  float shops = kind > 0.5 ? 1.0 : 0.0;
  float base = shops > 0.5 ? SHOP_H : 0.6;
  vec3 glass = glassTint(style, seed);
  float glassRough = style < 0.5 || style > 3.5 ? 0.04 : 0.07;
  float glassMetal = style < 0.5 ? 0.95 : style > 3.5 ? 0.85 : 0.75;
  // Storefronts: wide lit windows between pilasters, a sign band above.
  if (shops > 0.5 && uv.y < SHOP_H) {
    float nb = max(1.0, floor(len / 5.2));
    float bw = len / nb;
    float fu = uv.x / bw;
    float bay = floor(fu);
    float lu = fract(fu);
    float w = duv.x / bw * 1.2;
    float hy = duv.y * 1.2;
    float h = cityHash(vec2(bay, seed * 91.0));
    float win = aaBox(lu, 0.08, 0.92, w) * aaBox(uv.y, 0.45, 3.35, hy);
    float sign = aaBox(lu, 0.06, 0.94, w) * aaBox(uv.y, 3.55, 4.15, hy);
    vec3 signCol = mix(vec3(0.08, 0.1, 0.12), mix(vec3(0.42, 0.14, 0.1), vec3(0.12, 0.26, 0.22), step(0.5, h)), step(0.35, h));
    vec3 pilaster = style > 0.5 && style < 1.5 ? vec3(0.2, 0.19, 0.18) : wall * 0.8;
    // Inside: a lit shop floor fading up into a darker ceiling, a few shelves as soft bands.
    float shelf = 0.75 + 0.25 * step(0.5, fract(uv.y * 1.6 + h));
    vec3 inside = mix(vec3(0.42, 0.33, 0.24), vec3(0.08, 0.07, 0.06), smoothstep(0.6, 3.3, uv.y)) * shelf;
    o.albedo = mix(mix(pilaster * dirt, signCol, sign), mix(glass, inside, 0.45), win);
    o.rough = mix(mix(0.7, 0.45, sign), 0.05, win);
    o.metal = mix(0.0, 0.55, win);
    float lit = step(h, 0.8) * win;
    o.emit = vec3(1.0, 0.8, 0.56) * lit * (0.12 + 0.12 * fract(h * 13.0)) * smoothstep(3.4, 0.8, uv.y) * shelf;
    return o;
  }
  // Upper floors: a grid of windows, the bays sized to fit the wall exactly.
  float nb = max(1.0, floor(len / grid.y));
  float bw = len / nb;
  float fu = uv.x / bw;
  float fv = (uv.y - base) / grid.x;
  float lu = fract(fu);
  float lv = fract(fv);
  vec2 fw = max(duv / vec2(bw, grid.x), vec2(1e-4));
  float sill = (1.0 - grid.w) * 0.42;
  float x0 = 0.5 - grid.z * 0.5;
  float x1 = 0.5 + grid.z * 0.5;
  float win = aaBox(lu, x0, x1, fw.x) * aaBox(lv, sill, sill + grid.w, fw.y);
  float frameW = style < 0.5 ? 0.0 : 0.05;
  float framed = aaBox(lu, x0 - frameW, x1 + frameW, fw.x) * aaBox(lv, sill - frameW * 1.6, sill + grid.w + frameW, fw.y);
  // No windows below the first floor line, or in the band under the roof.
  float windowTop = base + (floor(fv) + sill + grid.w) * grid.x;
  float rows = step(0.0, fv) * step(windowTop, wallTop - 0.55);
  win *= rows;
  framed *= rows;
  // A grid finer than a couple of pixels is shown as its average, which never aliases.
  float tiny = smoothstep(0.18, 0.5, max(fw.x, fw.y));
  float cover = grid.z * grid.w * rows;
  win = mix(win, cover, tiny);
  framed = mix(framed, cover * 1.15, tiny);
  float h = cityHash(vec2(floor(fu) + seed * 57.0, floor(fv) + seed * 23.0));
  // Inside each window: a dark room, some with pale blinds part way down, a few lit.
  float blind = step(0.62, h) * step(lv, sill + grid.w * (0.35 + 0.6 * fract(h * 7.0)));
  vec3 room = mix(vec3(0.03, 0.03, 0.035), vec3(0.42, 0.4, 0.36), blind * 0.7);
  vec3 frameCol = style > 0.5 && style < 1.5 ? vec3(0.62, 0.6, 0.55) : style > 2.5 && style < 3.5 ? wall * 1.12 : vec3(0.08, 0.085, 0.09);
  // Wall texture up close: brick courses, stone joints or panel seams, faded out with distance.
  vec3 w = wall * dirt;
  if (detail > 0.5) {
    float fine = 1.0 - smoothstep(0.02, 0.06, duv.y);
    if (style > 0.5 && style < 1.5) {
      vec2 b = vec2(uv.x / 0.23 + step(1.0, mod(uv.y / 0.075, 2.0)) * 0.5, uv.y / 0.075);
      float mortar = 1.0 - aaBox(fract(b.x), 0.05, 0.95, duv.x / 0.23) * aaBox(fract(b.y), 0.12, 0.88, duv.y / 0.075);
      w *= mix(1.0, mix(0.9 + 0.2 * cityHash(floor(b)), 1.35, mortar), fine);
    } else if (style > 1.5 && style < 3.5) {
      float span = style > 2.5 ? 0.62 : grid.x;
      float joint = 1.0 - aaBox(fract(uv.y / span), 0.02, 0.98, duv.y / span * 2.0);
      w *= mix(1.0, 1.0 - joint * 0.18, fine);
    } else {
      float mull = 1.0 - aaBox(fract(fu * (style < 0.5 ? 1.0 : 2.0)), 0.04, 0.96, fw.x * 2.0);
      w = mix(w, vec3(0.32, 0.33, 0.34), mull * fine * 0.6);
    }
  }
  // The reveal: a soft shadow under each window head that gives the glass depth.
  float reveal = mix(1.0, 0.55, smoothstep(sill + grid.w - 0.18, sill + grid.w, lv) * (1.0 - tiny));
  vec3 glassCol = mix(room, glass, style < 0.5 ? 0.85 : 0.6) * reveal;
  // A cornice band under the roof and a darker plinth at the foot of the wall.
  float cornice = aaBox(uv.y, wallTop - 0.9, wallTop - 0.25, duv.y);
  float plinth = 1.0 - smoothstep(0.55, 0.62, uv.y);
  w = mix(w, w * (style > 1.5 && style < 3.5 ? 1.18 : 0.7), cornice);
  w *= mix(1.0, 0.62, plinth);
  o.albedo = mix(mix(w, frameCol * dirt, framed - win), glassCol, win);
  o.rough = mix(mix(style < 0.5 || style > 3.5 ? 0.35 : 0.82, 0.5, framed - win), mix(glassRough, 0.6, blind * 0.5), win);
  o.metal = mix(style < 0.5 || style > 3.5 ? 0.5 : 0.0, glassMetal * (1.0 - blind * 0.6), win);
  float lit = step(h, style < 0.5 ? 0.06 : 0.11) * win * (1.0 - tiny * 0.5);
  float ceiling = 0.55 + 0.45 * smoothstep(sill, sill + grid.w, lv);
  o.emit = vec3(1.0, 0.8, 0.56) * lit * (0.07 + 0.09 * fract(h * 31.0)) * ceiling;
  return o;
}
`;
