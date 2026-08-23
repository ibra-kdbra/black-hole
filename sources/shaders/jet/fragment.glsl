uniform float uTime;
uniform sampler2D uNoisesTexture;
uniform float uIntensity;

varying vec2 vUv;

void main() {
  // vUv.y runs 0 at the base (near the hole) -> 1 at the tip
  float along = vUv.y;

  // Plasma blobs racing outward
  float noise1 = texture(uNoisesTexture, vec2(vUv.x * 2.0, along * 1.6 - uTime * 0.55)).g;
  float noise2 = texture(uNoisesTexture, vec2(vUv.x * 4.0 + 0.35, along * 3.0 - uTime * 0.9)).b;
  float plasma = 0.55 + noise1 * 0.6 + noise2 * 0.35;

  // Bright, collimated core near the launch point, fading with distance
  float lengthFalloff = pow(1.0 - along, 2.2);
  float baseFade = smoothstep(0.0, 0.03, along);

  // Soft cylindrical edge (uv.x wraps around the cone)
  float edge = sin(vUv.x * 3.1415926 * 2.0) * 0.5 + 0.5;
  edge = 0.55 + edge * 0.45;

  float strength = lengthFalloff * baseFade * plasma * uIntensity;

  // Synchrotron blue-white
  vec3 color = mix(vec3(0.45, 0.62, 1.0), vec3(0.92, 0.96, 1.0), lengthFalloff);

  gl_FragColor = vec4(color, strength * 0.38);
}
