uniform float uTime;
uniform sampler2D uGradientTexture;
uniform sampler2D uNoisesTexture;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uSchwarzschildRadius;
uniform float uSpin;
uniform float uFlowSpeed;
uniform float uDoppler;
uniform float uRedshift;
uniform float uTurbulence;
uniform float uBrightness;
uniform float uHotSpot;
uniform float uHotSpotPhase;
uniform float uHotSpotRadius;

varying vec2 vUv;
varying vec3 vWorldPosition;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

void main() {
  // Radius of this fragment: uv.y goes 0 (outer edge) -> 1 (inner edge)
  float radius = mix(uOuterRadius, uInnerRadius, vUv.y);

  // Keplerian angular velocity omega = sqrt(GM / r^3) with GM = rs / 2
  // (c = 1), plus Lense-Thirring frame dragging (2 a M^2 / r^3) for a
  // spinning hole. Inner plasma laps the outer disc, shearing the noise.
  float M = 0.5 * uSchwarzschildRadius;
  float r3 = radius * radius * radius;
  float omega = sqrt(M / r3) + uSpin * 2.0 * M * M / r3;

  // Split the rotation into a rigid part (wraps forever, no artifacts) and
  // the differential shear. Unbounded shear would slowly wind the pattern
  // into frozen filaments, so two half-offset shear phases are crossfaded
  // flow-map style: churn stays turbulent at any runtime. The radial drift
  // keeps the plasma visibly falling inward, like the original scene.
  float rRef = mix(uInnerRadius, uOuterRadius, 0.3);
  float omegaRef = sqrt(M / (rRef * rRef * rRef)) + uSpin * 2.0 * M * M / (rRef * rRef * rRef);
  float rigid = omegaRef * uTime;
  float shear = omega - omegaRef;

  float cycle = 36.0;
  float t = uTime / cycle;
  float offsetA = (fract(t) - 0.5) * cycle;
  float offsetB = (fract(t + 0.5) - 0.5) * cycle;
  float weightB = abs(2.0 * fract(t) - 1.0);

  float shiftA = (rigid + shear * offsetA) * uFlowSpeed / 6.2831853;
  float shiftB = (rigid + shear * offsetB) * uFlowSpeed / 6.2831853;

  float inflow = uTime * uFlowSpeed;
  vec4 noiseA = vec4(
    texture(uNoisesTexture, vec2((vUv.x - shiftA) * 1.0, vUv.y - inflow * 0.050)).r,
    texture(uNoisesTexture, vec2((vUv.x - shiftA) * 2.0, vUv.y - inflow * 0.040)).g,
    texture(uNoisesTexture, vec2((vUv.x - shiftA) * 1.0, vUv.y - inflow * 0.030)).b,
    texture(uNoisesTexture, vec2((vUv.x - shiftA) * 2.0, vUv.y - inflow * 0.020)).a);
  vec4 noiseB = vec4(
    texture(uNoisesTexture, vec2((vUv.x - shiftB) * 1.0, vUv.y - inflow * 0.050)).r,
    texture(uNoisesTexture, vec2((vUv.x - shiftB) * 2.0, vUv.y - inflow * 0.040)).g,
    texture(uNoisesTexture, vec2((vUv.x - shiftB) * 1.0, vUv.y - inflow * 0.030)).b,
    texture(uNoisesTexture, vec2((vUv.x - shiftB) * 2.0, vUv.y - inflow * 0.020)).a);

  vec4 noiseVector = mix(noiseA, noiseB, weightB);
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

  // --- Orbiting hot spot --------------------------------------------------
  // A compact flare riding the flow just outside the inner edge. Added
  // before the Doppler pass so it beams and shifts like the plasma it
  // lives in.
  float spotAngle = abs(fract(vUv.x - uHotSpotPhase + 0.5) - 0.5);
  float spotRadial = (radius - uHotSpotRadius) / 0.45;
  float spot = exp(-(pow(spotAngle / 0.05, 2.0) + spotRadial * spotRadial));
  color.rgb += vec3(1.0, 0.93, 0.8) * spot * uHotSpot * falloff * 2.0;

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
