uniform float uTime;
uniform sampler2D uDefaultTexture;
uniform sampler2D uDistortionTexture;
uniform vec2 uConvergencePosition;

varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl
#include ../partials/random2d.glsl

void main() {
  float distortionStrength = texture(uDistortionTexture, vUv).r;
  vec2 convergencePoint = vec2(0.5);
  vec2 toConvergence = uConvergencePosition - vUv;
  vec2 distoredUv = vUv + toConvergence * distortionStrength;

  // vec4 color = texture(uDefaultTexture, distoredUv);

  // Vignette
  float distanceToCenter = length(vUv - 0.5);
  float vignetteStrength = remap(distanceToCenter, 0.3, 0.7, 0.0, 1.0);
  vignetteStrength = smoothstep(0.0, 1.0, vignetteStrength);
  // color.rgb = mix(color.rgb, vec3(0.0), vignetteStrength);

  // RGB Shift
  float r = texture(uDefaultTexture, distoredUv + vec2(sin(0.0), cos(0.0)) * 0.02 * vignetteStrength).r;
  float g = texture(uDefaultTexture, distoredUv + vec2(sin(2.1), cos(2.1)) * 0.02 * vignetteStrength).g;
  float b = texture(uDefaultTexture, distoredUv + vec2(sin(-2.1), cos(-2.1)) * 0.02 * vignetteStrength).b;
  vec4 color = vec4(r, g, b, 1.0);

  // Noise
  float noise = random2d(vUv + uTime);
  noise = noise - 0.5;

  float grayscale = r * 0.299 + g * 0.587 + b * 0.114;
  noise *= grayscale;

  color += noise * 0.5;

  gl_FragColor = color;
}
