uniform float uTime;

attribute float size;
attribute vec3 color;
attribute float twinkle;

varying vec3 vColor;
varying float vTwinkle;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size;

  vColor = color;

  // Per-star scintillation
  vTwinkle = 0.75 + 0.25 * sin(uTime * (1.5 + fract(twinkle) * 2.0) + twinkle);
}
