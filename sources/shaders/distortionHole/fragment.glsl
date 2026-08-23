varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  float distanceToCenter = length(vUv - 0.5);
  float strength = remap(distanceToCenter, 0.2, 0.5, 1.0, 0.0);
  strength = smoothstep(0.0, 1.0, strength);

  // Keep the deflection moderate at the shadow edge so the lensing bends
  // the star field without over-magnifying the silhouette
  strength *= 0.35;

  gl_FragColor = vec4(vec3(strength), 1.0);
}
