varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  float distanceToCenter = length(vUv - 0.5);
  float strength = remap(distanceToCenter, 0.2 / 3.0, 0.5 / 3.0, 1.0, 0.0);
  strength = smoothstep(0.0, 1.0, strength);

  float alpha = remap(distanceToCenter, 0.4, 0.5, 1.0, 0.0);
  alpha = smoothstep(0.0, 1.0, alpha);

  gl_FragColor = vec4(vec3(strength), 1.0);
}
