uniform sampler2D uDefaultTexture;
uniform sampler2D uDistortionTexture;
uniform vec2 uConvergencePosition;
uniform float uLensing;
uniform float uAberration;

varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  // Gravitational lensing: bend the background toward the singularity with
  // the screen-space deflection field
  float distortionStrength = texture(uDistortionTexture, vUv).r * uLensing;
  vec2 toConvergence = uConvergencePosition - vUv;
  vec2 distortedUv = vUv + toConvergence * distortionStrength;

  // Chromatic aberration, growing toward the frame edges
  float distanceToCenter = length(vUv - 0.5);
  float vignetteStrength = remap(distanceToCenter, 0.3, 0.7, 0.0, 1.0);
  vignetteStrength = smoothstep(0.0, 1.0, vignetteStrength);

  float aberration = 0.02 * vignetteStrength * uAberration;
  float r = texture(uDefaultTexture, distortedUv + vec2(sin(0.0), cos(0.0)) * aberration).r;
  float g = texture(uDefaultTexture, distortedUv + vec2(sin(2.1), cos(2.1)) * aberration).g;
  float b = texture(uDefaultTexture, distortedUv + vec2(sin(-2.1), cos(-2.1)) * aberration).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
