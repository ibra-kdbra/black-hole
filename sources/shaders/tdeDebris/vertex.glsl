uniform float uTime;
uniform float uBirth;

attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float radius = length(position);
  float age = uTime - uBirth;

  // Debris heats up as it falls deeper into the well
  float heat = smoothstep(6.0, 1.8, radius);
  vColor = mix(vec3(1.0, 0.58, 0.24), vec3(1.0, 0.97, 0.9), heat);

  // Quick ignition, slow dissolve
  vAlpha = smoothstep(0.0, 0.4, age) * (1.0 - smoothstep(28.0, 40.0, age));

  gl_PointSize = (7.0 + aSeed * 10.0) * (1.0 + heat) * (12.0 / max(1.0, -mvPosition.z));
}
