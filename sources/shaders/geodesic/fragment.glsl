/**
 * Geodesic photo mode: every pixel integrates a null geodesic of the
 * Schwarzschild metric backwards from the camera,
 *
 *   d2x/dl2 = -3/2 rs h^2 x / r^5,   h = |x x v|  (conserved)
 *
 * so the shadow, the photon ring and the lensed arcs of the disc's far
 * side above and below the hole all emerge from the geometry itself -
 * nothing here is painted on.
 */

uniform float uTime;
uniform vec3 uCameraPosition;
uniform mat3 uCameraBasis;
uniform float uTanHalfFov;
uniform float uAspect;

uniform float uRs;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uEscapeRadius;

uniform sampler2D uGradientTexture;
uniform sampler2D uNoisesTexture;
uniform float uFlowSpeed;
uniform float uDoppler;
uniform float uRedshift;
uniform float uTurbulence;
uniform float uBrightness;

varying vec2 vUv;

#include ../partials/inverseLerp.glsl
#include ../partials/remap.glsl

#define MAX_STEPS 320

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * Celestial sphere for escaped rays: hashed stars + the nebula octaves
 */
vec3 background(vec3 direction) {
  float su = atan(direction.z, direction.x) / 6.2831853 + 0.5;
  float sv = acos(clamp(direction.y, -1.0, 1.0)) / 3.1415926;

  float n1 = texture(uNoisesTexture, vec2(su, sv) * 3.0).r;
  float n2 = texture(uNoisesTexture, vec2(su, sv) * 5.0).g;
  float clouds = smoothstep(0.3, 0.95, n1 * 0.7 + n2 * 0.35);
  vec3 color = mix(vec3(0.13, 0.04, 0.19), vec3(0.04, 0.14, 0.18), n2) * clouds * 0.5;

  vec2 grid = vec2(su, sv) * vec2(700.0, 350.0);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float rnd = hash21(cell);
  if(rnd > 0.992) {
    vec2 offset = vec2(hash21(cell + 13.1), hash21(cell + 7.7)) - 0.5;
    float d = length(local - offset * 0.8);
    float star = smoothstep(0.25, 0.0, d) * (0.4 + 0.6 * hash21(cell + 3.3));
    vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.75, 0.85, 1.0), hash21(cell + 5.5));
    color += star * tint * 1.3;
  }

  return color;
}

/**
 * Disc emission at a plane crossing - the same recipe as the raster disc
 * (Keplerian noise advection, gradient, Doppler beaming, redshift), but
 * with the photon's real arrival direction
 */
vec4 discSample(vec3 point, vec3 photonDirection) {
  float radius = length(point.xz);
  float v = clamp((uOuterRadius - radius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);

  float M = 0.5 * uRs;
  float r3 = radius * radius * radius;
  float omega = sqrt(M / r3);
  float azimuth = atan(point.x, point.z) / 6.2831853;
  float flowX = azimuth - omega * uTime * uFlowSpeed / 6.2831853;

  float noise1 = texture(uNoisesTexture, vec2(flowX * 1.0, v - uTime * 0.010)).r;
  float noise2 = texture(uNoisesTexture, vec2(flowX * 2.0, v - uTime * 0.008)).g;
  float noise3 = texture(uNoisesTexture, vec2(flowX * 1.0, v - uTime * 0.006)).b;
  float noise4 = texture(uNoisesTexture, vec2(flowX * 2.0, v - uTime * 0.004)).a;
  float noiseLength = length(vec4(noise1, noise2, noise3, noise4));

  float outerFalloff = remap(v, 0.4, 0.0, 1.0, 0.0);
  float innerFalloff = remap(v, 1.0, 0.95, 0.0, 1.0);
  float falloff = smoothstep(0.0, 1.0, min(outerFalloff, innerFalloff));

  float y = v + noiseLength * 0.4 * uTurbulence;
  y *= falloff;

  vec4 color = texture(uGradientTexture, vec2(0.5, y));
  color.a = clamp(y, 0.0, 1.0);

  // Doppler beaming with the true arrival direction (-photonDirection is
  // emitter -> observer along the bent ray)
  float beta = sqrt(uRs / (2.0 * max(radius, uRs)));
  vec3 tangential = normalize(vec3(point.z, 0.0, -point.x));
  vec3 towardObserver = -photonDirection;
  float gammaFactor = 1.0 / sqrt(1.0 - beta * beta);
  float doppler = 1.0 / (gammaFactor * (1.0 - beta * dot(tangential, towardObserver)));

  float beaming = clamp(pow(doppler, 3.0), 0.0, 2.2);
  color.rgb *= mix(1.0, beaming, uDoppler);
  vec3 spectralShift = vec3(pow(doppler, -1.2), 1.0, pow(doppler, 1.2));
  color.rgb *= mix(vec3(1.0), spectralShift, uDoppler * 0.7);

  float gravitational = sqrt(max(0.0, 1.0 - 1.5 * uRs / max(radius, uRs)));
  color.rgb *= mix(1.0, pow(gravitational, 1.5), uRedshift);
  color.r *= mix(1.0, 1.0 / max(gravitational, 0.5), uRedshift * 0.4);

  color.rgb *= uBrightness;
  return color;
}

void main() {
  // Pinhole ray through this pixel
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rayCamera = normalize(vec3(ndc.x * uTanHalfFov * uAspect, ndc.y * uTanHalfFov, -1.0));
  vec3 velocity = normalize(uCameraBasis * rayCamera);
  vec3 position = uCameraPosition;

  // h^2 = |r x v|^2 is conserved along the geodesic
  vec3 angular = cross(position, velocity);
  float h2 = dot(angular, angular);

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;
  bool escaped = false;
  float previousY = position.y;
  vec3 previousPosition = position;

  for(int i = 0; i < MAX_STEPS; i++) {
    float r = length(position);

    if(r < uRs) break; // through the horizon: only darkness

    if(r > uEscapeRadius) {
      escaped = true;
      break;
    }

    // Larger steps far away, careful steps near the photon sphere
    float dl = clamp(r * 0.08, 0.025, 0.55);

    vec3 acceleration = -1.5 * uRs * h2 * position / pow(r * r, 2.5);
    velocity += acceleration * dl;
    previousPosition = position;
    previousY = position.y;
    position += velocity * dl;

    // Disc plane crossing between the previous point and this one
    if(previousY * position.y < 0.0) {
      float t = previousY / (previousY - position.y);
      vec3 crossing = mix(previousPosition, position, t);
      float crossingRadius = length(crossing.xz);

      if(crossingRadius > uInnerRadius && crossingRadius < uOuterRadius) {
        vec4 emission = discSample(crossing, normalize(velocity));
        accumulated += transmittance * emission.rgb * emission.a;
        transmittance *= 1.0 - emission.a;
        if(transmittance < 0.05) break;
      }
    }
  }

  if(escaped)
    accumulated += transmittance * background(normalize(velocity));

  gl_FragColor = vec4(accumulated, 1.0);
}
