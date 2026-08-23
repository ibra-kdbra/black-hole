uniform float uRadius;
uniform float uPlaneSize;
uniform float uIntensity;

varying vec2 vUv;

void main() {
  // Distance from the singularity in world units
  float d = length(vUv - 0.5) * uPlaneSize;

  // Sharp, bright ring right at the shadow edge: photons that circled the
  // hole on the photon sphere before escaping to the camera
  float ring = exp(-pow((d - uRadius) / 0.035, 2.0));

  // Faint halo of increasingly bent light outside the ring
  float halo = smoothstep(uRadius - 0.02, uRadius + 0.05, d)
             * exp(-(d - uRadius) / 0.45) * 0.16;

  float strength = (ring * 1.6 + max(halo, 0.0)) * uIntensity;

  vec3 color = mix(vec3(1.0, 0.74, 0.41), vec3(1.0, 0.98, 0.95), ring);

  gl_FragColor = vec4(color * strength, strength);
}
