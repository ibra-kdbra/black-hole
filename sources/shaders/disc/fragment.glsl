uniform float uTime;
uniform sampler2D uGradientTexture;
uniform sampler2D uNoisesTexture;

varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  float noise1 = texture(uNoisesTexture, vUv - uTime * 0.1).r;
  float noise2 = texture(uNoisesTexture, vUv - uTime * 0.08).g;
  float noise3 = texture(uNoisesTexture, vUv - uTime * 0.06).b;
  float noise4 = texture(uNoisesTexture, vUv - uTime * 0.04).a;
  vec4 noiseVector = vec4(noise1, noise2, noise3, noise4);
  float noiseLength = length(noiseVector);

  float outerFalloff = remap(vUv.y, 0.4, 0.0, 1.0, 0.0);
  float innerFalloff = remap(vUv.y, 1.0, 0.95, 0.0, 1.0);
  float falloff = min(outerFalloff, innerFalloff);
  falloff = smoothstep(0.0, 1.0, falloff);

  vec2 uv = vUv;
  uv.y += noiseLength * 0.4;
  uv.y *= falloff;

  vec4 color = texture(uGradientTexture, uv);
  color.a = uv.y;
  gl_FragColor = color;
}
