varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord;
  float distanceToCenter = length(uv - 0.5);
  float alpha = 0.02 / distanceToCenter;
  alpha *= 1.0 - distanceToCenter * 2.0;
  gl_FragColor = vec4(vColor, alpha);
}
