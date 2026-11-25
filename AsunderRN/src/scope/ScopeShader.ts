import { Skia } from '@shopify/react-native-skia';

// THE TUBE: a small program that runs on the phone's graphics chip once for
// every dot on the scope's screen, every frame. It's written in SkSL, Skia's
// shader language (it looks like C). Each `uniform` is a number handed in
// from ScopeScreen.tsx; most come straight from ScopeLook and ScopeTuning.
//
// For each dot it works out, in order:
//   1. the bulge of the glass (where on the picture this dot looks),
//   2. the shake of its scanline and the roll of the picture,
//   3. the picture there, smeared sideways and with a little glow,
//   4. how much color is left, and how much snow covers it,
//   5. the dark gaps between scanlines and the dark corners,
//   6. then, if Asunder has the screen, crisp square pixels instead.

const SOURCE = `
uniform shader picture;
uniform shader override;

uniform float2 size;
uniform float time;
uniform float roll;
uniform float pictureAmount;
uniform float snow;
uniform float smear;
uniform float jitter;
uniform float color;
uniform float lines;
uniform float lineDepth;
uniform float bulge;
uniform float vignette;
uniform float glow;
uniform float snowRate;
uniform float overrideAmount;
uniform float overridePixels;

// A repeatable "random" number for a spot: the same spot always gives the same number.
// (No sin() in it: sin-based versions show patterns on some graphics chips.)
float hash(float2 p) {
  float3 q = fract(float3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// The picture as the tube shows it, at a spot on the glass (0...1 each way).
float3 tube(float2 uv) {
  float line = floor(uv.y * lines);
  float tick = floor(time * snowRate);
  float shake = (hash(float2(line, tick)) - 0.5) * 2.0 * jitter;
  float2 p = float2(uv.x + shake, fract(uv.y + roll)) * size;

  float s = smear * size.x;
  float3 c = picture.eval(p).rgb * 0.5
           + picture.eval(p - float2(s, 0.0)).rgb * 0.3
           + picture.eval(p - float2(2.0 * s, 0.0)).rgb * 0.2;

  float g = 0.01 * size.x;
  float3 bloom = (picture.eval(p + float2(g, 0.0)).rgb + picture.eval(p - float2(g, 0.0)).rgb
                + picture.eval(p + float2(0.0, g)).rgb + picture.eval(p - float2(0.0, g)).rgb) * 0.25;
  c = c + bloom * glow * 0.5;

  float luma = dot(c, float3(0.299, 0.587, 0.114));
  c = mix(float3(luma), c, color);

  float n = hash(floor(uv * size * 0.5) + float2(tick * 1.7, tick * 3.1));
  c = mix(c * pictureAmount, float3(n), snow);

  float gap = 0.5 + 0.5 * cos(uv.y * lines * 6.2831853);
  return c * (1.0 - lineDepth * gap);
}

half4 main(float2 xy) {
  float2 uv = xy / size;
  float2 cc = uv - 0.5;
  // When Asunder has the screen, even the glass stops bulging.
  float k = bulge * (1.0 - overrideAmount);
  float2 g = 0.5 + cc * (1.0 + k * dot(cc, cc) * 2.0);

  float3 crt = float3(0.0);
  if (g.x >= 0.0 && g.x <= 1.0 && g.y >= 0.0 && g.y <= 1.0) {
    crt = tube(g);
    float2 v = g * (1.0 - g);
    crt = crt * pow(clamp(v.x * v.y * 16.0, 0.0, 1.0), vignette);
  }

  // Asunder's pixels: snap each dot to the middle of its square, so every
  // square is one flat, perfectly sharp color.
  float cell = size.x / overridePixels;
  float2 snapped = (floor(xy / cell) + 0.5) * cell;
  float3 o = override.eval(snapped).rgb;

  return half4(half3(mix(crt, o, overrideAmount)), 1.0);
}
`;

// ASUNDER'S PIXELS ON THEIR OWN: the same square pixels as step 6 above, for
// drawing over the XY line drawing (which isn't a tube picture). `amount` is
// how fully she has the screen; at 0 this draws nothing.
const OVERRIDE_SOURCE = `
uniform shader override;
uniform float2 size;
uniform float overrideAmount;
uniform float overridePixels;

half4 main(float2 xy) {
  float cell = size.x / overridePixels;
  float2 snapped = (floor(xy / cell) + 0.5) * cell;
  return half4(override.eval(snapped).rgb, 1.0) * overrideAmount;
}
`;

/** The compiled override-only program. null if the phone couldn't compile it (logged). */
export const OVERRIDE_SHADER = Skia.RuntimeEffect.Make(OVERRIDE_SOURCE);
if (!OVERRIDE_SHADER) {
  console.error('[scope] the override shader failed to compile');
}

/** The compiled tube program. null if the phone couldn't compile it (logged). */
export const SCOPE_SHADER = Skia.RuntimeEffect.Make(SOURCE);
if (!SCOPE_SHADER) {
  console.error('[scope] the CRT shader failed to compile');
}
