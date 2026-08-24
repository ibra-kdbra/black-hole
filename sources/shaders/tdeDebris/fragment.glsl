varying vec3 vColor;
varying float vAlpha;

void main() {
  float distanceToCenter = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, distanceToCenter);
  gl_FragColor = vec4(vColor, alpha * vAlpha * 0.85);
}
