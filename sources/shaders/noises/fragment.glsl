varying vec2 vUv;

#include ../partials/perlin3dPeriodic.glsl;

void main() {
  float perlin1 = perlin3dPeriodic(vec3(vUv.xy * 5.0, 12.34), vec3(5.0));
  float perlin2 = perlin3dPeriodic(vec3(vUv.xy * 10.0, 34.56), vec3(10.0));
  float perlin3 = perlin3dPeriodic(vec3(vUv.xy * 20.0, 56.78), vec3(20.0));
  float perlin4 = perlin3dPeriodic(vec3(vUv.xy * 40.0, 56.78), vec3(40.0));
  gl_FragColor = vec4(perlin1, perlin2, perlin3, perlin4);
}
