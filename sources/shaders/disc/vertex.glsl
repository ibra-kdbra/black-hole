varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;

  vUv = uv;
  vWorldPosition = worldPosition.xyz;
}
