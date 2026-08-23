uniform float uTime;
uniform sampler2D uGradientTexture;
uniform sampler2D uNoisesTexture;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uSchwarzschildRadius;
uniform float uFlowSpeed;
uniform float uDoppler;
uniform float uRedshift;
uniform float uTurbulence;
uniform float uBrightness;

varying vec2 vUv;
varying vec3 vWorldPosition;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  // Radius of this fragment: uv.y goes 0 (outer edge) -> 1 (inner edge)
  float radius = mix(uOuterRadius, uInnerRadius, vUv.y);

  // Keplerian angular velocity: omega = sqrt(GM / r^3), with GM = rs / 2
  // (c = 1). Inner plasma laps the outer disc, shearing the noise field.
  float omega = sqrt(uSchwarzschildRadius / (2.0 * radius * radius * radius));
  float azimuthShift = omega * uTime * uFlowSpeed / 6.2831853;

  vec2 flowUv = vec2(vUv.x - azimuthShift, vUv.y);
  float noise1 = texture(uNoisesTexture, vec2(flowUv.x * 1.0, flowUv.y - uTime * 0.010)).r;
  float noise2 = texture(uNoisesTexture, vec2(flowUv.x * 2.0, flowUv.y - uTime * 0.008)).g;
  float noise3 = texture(uNoisesTexture, vec2(flowUv.x * 1.0, flowUv.y - uTime * 0.006)).b;
  float noise4 = texture(uNoisesTexture, vec2(flowUv.x * 2.0, flowUv.y - uTime * 0.004)).a;
  vec4 noiseVector = vec4(noise1, noise2, noise3, noise4);
  float noiseLength = length(noiseVector);

  // Radial falloffs (soft outer fade, sharp truncation at the ISCO)
  float outerFalloff = remap(vUv.y, 0.4, 0.0, 1.0, 0.0);
  float innerFalloff = remap(vUv.y, 1.0, 0.95, 0.0, 1.0);
  float falloff = min(outerFalloff, innerFalloff);
  falloff = smoothstep(0.0, 1.0, falloff);

  vec2 uv = vUv;
  uv.y += noiseLength * 0.4 * uTurbulence;
  uv.y *= falloff;

  vec4 color = texture(uGradientTexture, uv);
  color.a = uv.y;

  // --- Relativistic Doppler beaming --------------------------------------
  // Circular geodesic speed: beta = sqrt(rs / (2 r)); direction follows
  // increasing azimuth, matching the texture flow.
  float beta = sqrt(uSchwarzschildRadius / (2.0 * radius));
  vec3 tangential = normalize(vec3(vWorldPosition.z, 0.0, -vWorldPosition.x));
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  float gammaFactor = 1.0 / sqrt(1.0 - beta * beta);
  float doppler = 1.0 / (gammaFactor * (1.0 - beta * dot(tangential, viewDirection)));

  // Relativistic beaming: observed intensity scales as delta^3. The
  // approaching limb flares, the receding limb fades. Clamped so the bright
  // limb saturates gracefully instead of blowing out.
  float beaming = clamp(pow(doppler, 3.0), 0.0, 2.2);
  color.rgb *= mix(1.0, beaming, uDoppler);

  // Spectral shift: blueshift the approaching side, redden the receding one
  vec3 spectralShift = vec3(pow(doppler, -1.2), 1.0, pow(doppler, 1.2));
  color.rgb *= mix(vec3(1.0), spectralShift, uDoppler * 0.7);

  // --- Gravitational redshift --------------------------------------------
  // Combined gravitational + orbital time dilation for a circular geodesic:
  // nu_obs / nu_emit = sqrt(1 - 3 rs / (2 r)) -> 1/sqrt(2) at the ISCO.
  // Emission dims and drifts toward the red near the inner edge (softened
  // from the full g^3 so the innermost plasma still glows on screen).
  float gravitational = sqrt(max(0.0, 1.0 - 1.5 * uSchwarzschildRadius / radius));
  color.rgb *= mix(1.0, pow(gravitational, 1.5), uRedshift);
  color.r *= mix(1.0, 1.0 / max(gravitational, 0.5), uRedshift * 0.4);

  color.rgb *= uBrightness;

  gl_FragColor = color;
}
