uniform float uRadius;
uniform float uPlaneSize;
uniform float uIntensity;
uniform float uTime;
uniform sampler2D uNoisesTexture;

varying vec2 vUv;

void main() {
  // Distance from the singularity in world units
  float d = length(vUv - 0.5) * uPlaneSize;

  // The ring simmers: photons on their last orbits arrive in uneven bursts
  float azimuth = atan(vUv.y - 0.5, vUv.x - 0.5) / 6.2831853;
  float shimmer = texture(uNoisesTexture, vec2(azimuth * 3.0 - uTime * 0.015, 0.3 + uTime * 0.006)).b;

  // Sharp, bright ring right at the shadow edge: photons that circled the
  // hole on the photon sphere before escaping to the camera
  float ring = exp(-pow((d - uRadius) / 0.035, 2.0));

  // Faint halo of increasingly bent light outside the ring
  float halo = smoothstep(uRadius - 0.02, uRadius + 0.05, d)
             * exp(-(d - uRadius) / 0.45) * 0.16;

  float strength = (ring * 1.6 + max(halo, 0.0)) * uIntensity * (0.78 + 0.45 * shimmer);

  vec3 color = mix(vec3(1.0, 0.74, 0.41), vec3(1.0, 0.98, 0.95), ring);

  gl_FragColor = vec4(color * strength, strength);
}
