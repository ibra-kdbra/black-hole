uniform float uTime;
uniform sampler2D uNoisesTexture;
uniform float uIntensity;

varying vec2 vUv;

void main() {
  // Two drifting octaves of the baked periodic noise make slow, wispy
  // clouds on the celestial sphere
  float drift = uTime * 0.0015;
  float n1 = texture(uNoisesTexture, vUv * 3.0 + drift).r;
  float n2 = texture(uNoisesTexture, vec2(vUv.x * 5.0 - drift, vUv.y * 5.0)).g;
  float n3 = texture(uNoisesTexture, vUv * 9.0).b;

  float clouds = n1 * 0.6 + n2 * 0.3 + n3 * 0.25;
  clouds = smoothstep(0.25, 0.95, clouds);

  // Deep interstellar hues: violet dust with a teal vein
  vec3 dust = mix(vec3(0.16, 0.05, 0.24), vec3(0.05, 0.19, 0.23), n2);
  dust = mix(dust, vec3(0.35, 0.08, 0.25), n3 * 0.5);

  gl_FragColor = vec4(dust, clouds * 0.4 * uIntensity);
}
