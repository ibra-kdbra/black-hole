uniform float uTime;
uniform sampler2D uNoisesTexture;
uniform sampler2D uGradientTexture;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

/**
 * The shadow itself stays void-black, but its silhouette simmers: a thin
 * fresnel rim of turbulent, palette-tinted light - the innermost lensed
 * glow clinging to the shadow edge - brighter toward the disc plane where
 * the plasma actually is.
 */
void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 6.0);

  // Turbulence crawling along the silhouette
  float azimuth = atan(vWorldPosition.x, vWorldPosition.z) / 6.2831853;
  float height = vWorldPosition.y;
  float noise1 = texture(uNoisesTexture, vec2(azimuth * 2.0 - uTime * 0.020, height * 0.35 + uTime * 0.012)).r;
  float noise2 = texture(uNoisesTexture, vec2(azimuth * 4.0 + uTime * 0.014, height * 0.6)).g;
  float turbulence = 0.35 + 0.5 * noise1 + 0.35 * noise2;

  // The captured glow concentrates toward the disc plane
  float planeGlow = 1.0 - smoothstep(0.0, 0.9, abs(normalize(vWorldPosition).y));
  planeGlow = 0.35 + 0.65 * planeGlow;

  vec3 rimColor = texture(uGradientTexture, vec2(0.5, 0.82)).rgb;
  vec3 color = rimColor * fresnel * turbulence * planeGlow * 0.9;

  gl_FragColor = vec4(color, 1.0);
}
