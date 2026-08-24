/**
 * Geodesic photo mode: every pixel integrates a null geodesic backwards
 * from the camera.
 *
 * Schwarzschild (a = 0) uses the compact form
 *
 *   d2x/dl2 = -3/2 rs h^2 x / r^5,   h = |x x v|  (conserved)
 *
 * A spinning hole uses the Kerr metric in Kerr-Schild coordinates,
 * g_uv = eta_uv + f l_u l_v, integrated as a Hamiltonian system
 *
 *   H = 1/2 [ p.p - E^2 - f (l.p + E)^2 ],  dx/dl = dH/dp,  dp/dl = -dH/dx
 *
 * with the spatial gradient taken by central differences. Frame dragging,
 * the displaced D-shaped shadow and the tightened prograde photon orbits
 * all emerge from the metric. The spin axis is +y, matching the disc.
 */

uniform float uTime;
uniform vec3 uCameraPosition;
uniform mat3 uCameraBasis;
uniform float uTanHalfFov;
uniform float uAspect;

uniform float uRs;
uniform float uSpinA;          // Kerr a, in world length units (0..M)
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
#define KERR_STEPS 260

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
 * (bounded Keplerian shear, radial inflow, Doppler beaming with the
 * photon's true arrival direction, redshift)
 */
vec4 discSample(vec3 point, vec3 photonDirection) {
  float radius = length(point.xz);
  float v = clamp((uOuterRadius - radius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);

  float M = 0.5 * uRs;
  float r3 = radius * radius * radius;
  float omega = sqrt(M / r3) + 2.0 * uSpinA * M / r3;
  float azimuth = atan(point.x, point.z) / 6.2831853;

  float rRef = mix(uInnerRadius, uOuterRadius, 0.3);
  float r3Ref = rRef * rRef * rRef;
  float omegaRef = sqrt(M / r3Ref) + 2.0 * uSpinA * M / r3Ref;
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
    texture(uNoisesTexture, vec2((azimuth - shiftA) * 1.0, v - inflow * 0.050)).r,
    texture(uNoisesTexture, vec2((azimuth - shiftA) * 2.0, v - inflow * 0.040)).g,
    texture(uNoisesTexture, vec2((azimuth - shiftA) * 1.0, v - inflow * 0.030)).b,
    texture(uNoisesTexture, vec2((azimuth - shiftA) * 2.0, v - inflow * 0.020)).a);
  vec4 noiseB = vec4(
    texture(uNoisesTexture, vec2((azimuth - shiftB) * 1.0, v - inflow * 0.050)).r,
    texture(uNoisesTexture, vec2((azimuth - shiftB) * 2.0, v - inflow * 0.040)).g,
    texture(uNoisesTexture, vec2((azimuth - shiftB) * 1.0, v - inflow * 0.030)).b,
    texture(uNoisesTexture, vec2((azimuth - shiftB) * 2.0, v - inflow * 0.020)).a);
  float noiseLength = length(mix(noiseA, noiseB, weightB));

  float outerFalloff = remap(v, 0.4, 0.0, 1.0, 0.0);
  float innerFalloff = remap(v, 1.0, 0.95, 0.0, 1.0);
  float falloff = smoothstep(0.0, 1.0, min(outerFalloff, innerFalloff));

  float y = v + noiseLength * 0.4 * uTurbulence;
  y *= falloff;

  vec4 color = texture(uGradientTexture, vec2(0.5, y));
  color.a = clamp(y, 0.0, 1.0);

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

/* ---------------------------------------------------------------------- */
/* Kerr-Schild machinery. The formulas put spin along +z, so world (x,y,z) */
/* maps to (x, z, y) and back.                                            */
/* ---------------------------------------------------------------------- */

float kerrHamiltonian(vec3 worldPos, vec3 worldP, float energy) {
  vec3 q = vec3(worldPos.x, worldPos.z, worldPos.y);
  vec3 pq = vec3(worldP.x, worldP.z, worldP.y);
  float a = uSpinA;
  float M = 0.5 * uRs;

  float rho2 = dot(q, q);
  float b = 0.5 * (rho2 - a * a);
  float r2 = b + sqrt(max(b * b + a * a * q.z * q.z, 1e-8));
  float r = sqrt(max(r2, 1e-6));

  float f = 2.0 * M * r2 * r / max(r2 * r2 + a * a * q.z * q.z, 1e-8);
  float ra2 = r2 + a * a;
  vec3 l = vec3((r * q.x + a * q.y) / ra2, (r * q.y - a * q.x) / ra2, q.z / r);
  float lp = dot(l, pq);

  return 0.5 * (dot(pq, pq) - energy * energy - f * (lp + energy) * (lp + energy));
}

float kerrRadius(vec3 worldPos) {
  vec3 q = vec3(worldPos.x, worldPos.z, worldPos.y);
  float a = uSpinA;
  float rho2 = dot(q, q);
  float b = 0.5 * (rho2 - a * a);
  return sqrt(max(b + sqrt(max(b * b + a * a * q.z * q.z, 1e-8)), 1e-6));
}

vec3 kerrVelocity(vec3 worldPos, vec3 worldP, float energy) {
  vec3 q = vec3(worldPos.x, worldPos.z, worldPos.y);
  vec3 pq = vec3(worldP.x, worldP.z, worldP.y);
  float a = uSpinA;
  float M = 0.5 * uRs;

  float rho2 = dot(q, q);
  float b = 0.5 * (rho2 - a * a);
  float r2 = b + sqrt(max(b * b + a * a * q.z * q.z, 1e-8));
  float r = sqrt(max(r2, 1e-6));
  float f = 2.0 * M * r2 * r / max(r2 * r2 + a * a * q.z * q.z, 1e-8);
  float ra2 = r2 + a * a;
  vec3 l = vec3((r * q.x + a * q.y) / ra2, (r * q.y - a * q.x) / ra2, q.z / r);
  float lp = dot(l, pq);

  vec3 vq = pq - f * l * (lp + energy);
  return vec3(vq.x, vq.z, vq.y);
}

/**
 * Conserved energy E = -p_t from the null condition H = 0, a quadratic in E
 */
float kerrEnergy(vec3 worldPos, vec3 worldP) {
  vec3 q = vec3(worldPos.x, worldPos.z, worldPos.y);
  vec3 pq = vec3(worldP.x, worldP.z, worldP.y);
  float a = uSpinA;
  float M = 0.5 * uRs;

  float rho2 = dot(q, q);
  float b = 0.5 * (rho2 - a * a);
  float r2 = b + sqrt(max(b * b + a * a * q.z * q.z, 1e-8));
  float r = sqrt(max(r2, 1e-6));
  float f = 2.0 * M * r2 * r / max(r2 * r2 + a * a * q.z * q.z, 1e-8);
  float ra2 = r2 + a * a;
  vec3 l = vec3((r * q.x + a * q.y) / ra2, (r * q.y - a * q.x) / ra2, q.z / r);
  float lp = dot(l, pq);

  float qa = 1.0 + f;
  float qb = 2.0 * f * lp;
  float qc = f * lp * lp - dot(pq, pq);
  return (-qb + sqrt(max(qb * qb - 4.0 * qa * qc, 0.0))) / (2.0 * qa);
}

vec4 marchKerr(vec3 position, vec3 direction) {
  float M = 0.5 * uRs;
  float horizon = M + sqrt(max(M * M - uSpinA * uSpinA, 0.0));

  vec3 p = direction;
  float energy = kerrEnergy(position, p);

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;
  bool escaped = false;
  vec3 velocity = kerrVelocity(position, p, energy);
  float previousY = position.y;
  vec3 previousPosition = position;

  const float eps = 2e-3;

  for(int i = 0; i < KERR_STEPS; i++) {
    float r = kerrRadius(position);

    if(r < horizon * 1.02) break;

    if(r > uEscapeRadius) {
      escaped = true;
      break;
    }

    float dl = clamp(r * 0.09, 0.02, 0.5);

    // dp/dl = -dH/dx by central differences
    vec3 gradient = vec3(
      kerrHamiltonian(position + vec3(eps, 0.0, 0.0), p, energy) - kerrHamiltonian(position - vec3(eps, 0.0, 0.0), p, energy),
      kerrHamiltonian(position + vec3(0.0, eps, 0.0), p, energy) - kerrHamiltonian(position - vec3(0.0, eps, 0.0), p, energy),
      kerrHamiltonian(position + vec3(0.0, 0.0, eps), p, energy) - kerrHamiltonian(position - vec3(0.0, 0.0, eps), p, energy)
    ) / (2.0 * eps);

    p -= gradient * dl;
    velocity = kerrVelocity(position, p, energy);
    previousPosition = position;
    previousY = position.y;
    position += velocity * dl;

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

  return vec4(accumulated, 1.0);
}

vec4 marchSchwarzschild(vec3 position, vec3 velocity) {
  vec3 angular = cross(position, velocity);
  float h2 = dot(angular, angular);

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;
  bool escaped = false;
  float previousY = position.y;
  vec3 previousPosition = position;

  for(int i = 0; i < MAX_STEPS; i++) {
    float r = length(position);

    if(r < uRs) break;

    if(r > uEscapeRadius) {
      escaped = true;
      break;
    }

    float dl = clamp(r * 0.08, 0.025, 0.55);

    vec3 acceleration = -1.5 * uRs * h2 * position / pow(r * r, 2.5);
    velocity += acceleration * dl;
    previousPosition = position;
    previousY = position.y;
    position += velocity * dl;

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

  return vec4(accumulated, 1.0);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rayCamera = normalize(vec3(ndc.x * uTanHalfFov * uAspect, ndc.y * uTanHalfFov, -1.0));
  vec3 direction = normalize(uCameraBasis * rayCamera);

  if(uSpinA > 0.002)
    gl_FragColor = marchKerr(uCameraPosition, direction);
  else
    gl_FragColor = marchSchwarzschild(uCameraPosition, direction);
}
