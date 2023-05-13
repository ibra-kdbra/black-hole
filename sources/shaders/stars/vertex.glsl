attribute float size;
attribute vec3 color;

varying vec3 vColor;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size;

  vColor = color;
}
