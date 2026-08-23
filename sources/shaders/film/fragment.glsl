uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;

varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl
#include ../partials/random2d.glsl

void main() {
  vec4 color = texture(tDiffuse, vUv);

  // Vignette
  float distanceToCenter = length(vUv - 0.5);
  float vignetteStrength = remap(distanceToCenter, 0.3, 0.75, 0.0, 1.0);
  vignetteStrength = smoothstep(0.0, 1.0, vignetteStrength);
  color.rgb = mix(color.rgb, color.rgb * 0.35, vignetteStrength * uVignette);

  // Luminance-weighted animated grain
  float noise = random2d(vUv + fract(uTime)) - 0.5;
  float grayscale = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb += noise * grayscale * 0.5 * uGrain;

  gl_FragColor = color;
}
