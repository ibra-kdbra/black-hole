import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import discVertex from './shaders/disc/vertex.glsl'
import discFragment from './shaders/disc/fragment.glsl'
import noisesVertex from './shaders/noises/vertex.glsl'
import noisesFragment from './shaders/noises/fragment.glsl'
import starsVertex from './shaders/stars/vertex.glsl'
import starsFragment from './shaders/stars/fragment.glsl'
import distortionHoleVertex from './shaders/distortionHole/vertex.glsl'
import distortionHoleFragment from './shaders/distortionHole/fragment.glsl'
import compositionVertex from './shaders/composition/vertex.glsl'
import compositionFragment from './shaders/composition/fragment.glsl'
import distortionDiscVertex from './shaders/distortionDisc/vertex.glsl'
import distortionDiscFragment from './shaders/distortionDisc/fragment.glsl'




/**
 * Setup
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()

// // Test
// const test = new THREE.Mesh(
//     new THREE.SphereGeometry(),
//     new THREE.MeshNormalMaterial({ wireframe: true }),
// )
// scene.add(test)

/**
 * Sizes
 */
const sizes = { width: window.innerWidth, height: window.innerHeight }
window.addEventListener('resize', () =>
{
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.setSize(sizes.width, sizes.height)

  composition.distortionRenderTarget.setSize(
    sizes.width * renderer.getPixelRatio(),
    sizes.height * renderer.getPixelRatio()
  )

  composition.defaultRenderTarget.setSize(
    sizes.width * renderer.getPixelRatio(),
    sizes.height * renderer.getPixelRatio()
  )
})

/**
 * Camera
 */
const cameraGroup = new THREE.Group()
scene.add(cameraGroup)

const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 500)
camera.position.set(0, 3, 10)
cameraGroup.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.zoomSpeed = 0.4

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setClearColor('#130e16')
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
renderer.setSize(sizes.width, sizes.height)

/**
 * Stars
 */
const stars = {}
stars.count = 10000

// Geometry
const positionsArray = new Float32Array(stars.count * 3)
const sizesArray = new Float32Array(stars.count)
const colorsArray = new Float32Array(stars.count * 3)

for (let i = 0; i < stars.count; i++) {
  const i3 = i * 3

  // Positions
  const theta = 2 * Math.PI * Math.random()
  const phi = Math.acos(2 * Math.random() - 1.0)

  positionsArray[i3 + 0] = Math.cos(theta) * Math.sin(phi) * 400
  positionsArray[i3 + 1] = Math.sin(theta) * Math.sin(phi) * 400
  positionsArray[i3 + 2] = Math.cos(phi) * 400

  // Sizes
  sizesArray[i] = 0.5 + Math.random() * 30

  // Colors
  const hue = Math.round(Math.random() * 360)
  const lightness = Math.round(80 + Math.random() * 20)
  const color = new THREE.Color(`hsl(${hue}, 100%, ${lightness}%)`)

  colorsArray[i3 + 0] = color.r
  colorsArray[i3 + 1] = color.g
  colorsArray[i3 + 2] = color.b
}

stars.geometry = new THREE.BufferGeometry()
stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsArray, 3))
stars.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizesArray, 1))
stars.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsArray, 3))

// Material
stars.material = new THREE.ShaderMaterial({
  transparent: true,
  vertexShader: starsVertex,
  fragmentShader: starsFragment
})

// Points
stars.points = new THREE.Points(stars.geometry, stars.material)
scene.add(stars.points)

/**
 * Noises
 */
const noises = {}
noises.scene = new THREE.Scene()
noises.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
noises.camera.position.set(0, 0, 5)
noises.scene.add(noises.camera)

// Plane
noises.plane = {}
noises.plane.geometry = new THREE.PlaneGeometry(2, 2)
noises.plane.material = new THREE.ShaderMaterial({
  vertexShader: noisesVertex,
  fragmentShader: noisesFragment
})
noises.plane.mesh = new THREE.Mesh(noises.plane.geometry, noises.plane.material)
noises.scene.add(noises.plane.mesh)

// Render Target
noises.renderTarget = new THREE.WebGLRenderTarget(
  256,
  256,
  {
    generateMipmaps: false,
    type: THREE.FloatType,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping
  }
)

// Render the noises into the render target
renderer.setRenderTarget(noises.renderTarget)
renderer.render(noises.scene, noises.camera)
renderer.setRenderTarget(null)

// // Debug Plane
// noises.debugPlane = new THREE.Mesh(
//   new THREE.PlaneGeometry(1, 1),
//   new THREE.MeshBasicMaterial({
//     map: noises.renderTarget.texture
//   })
// )
// scene.add(noises.debugPlane)


/**
 * Disc
 */
const disc = {}

// Gradient
disc.gradient = {}
disc.gradient.canvas = document.createElement('canvas')
disc.gradient.canvas.width = 1
disc.gradient.canvas.height = 128
// disc.gradient.canvas.style.position = 'absolute'
// disc.gradient.canvas.style.top = 0
// disc.gradient.canvas.style.left = 0
// disc.gradient.canvas.style.zIndex = 1
// document.body.append(disc.gradient.canvas)
disc.gradient.context = disc.gradient.canvas.getContext('2d')
disc.gradient.style = disc.gradient.context.createLinearGradient(0, 0, 0, disc.gradient.canvas.height)
disc.gradient.style.addColorStop(0, '#fffbf9')
disc.gradient.style.addColorStop(0.1, '#ffbc68')
disc.gradient.style.addColorStop(0.2, '#ff5600')
disc.gradient.style.addColorStop(0.4, '#ff0053')
disc.gradient.style.addColorStop(0.8, '#cc00ff')
disc.gradient.context.fillStyle = disc.gradient.style
disc.gradient.context.fillRect(0, 0, disc.gradient.canvas.width, disc.gradient.canvas.height)
disc.gradient.texture = new THREE.CanvasTexture(disc.gradient.canvas)


// Mesh
disc.geometry = new THREE.CylinderGeometry(1.5, 6, 0, 64, 8, true)
disc.material = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: discVertex,
  fragmentShader: discFragment,
  uniforms: {
    uTime: { value: 0 },
    uGradientTexture: { value: disc.gradient.texture },
    uNoisesTexture: { value: noises.renderTarget.texture }
  }
})
disc.mesh = new THREE.Mesh(disc.geometry, disc.material)
scene.add(disc.mesh)

/**
 * Distortion
 */
const distortion = {}
distortion.scene = new THREE.Scene()

// Hole
distortion.hole = {}
distortion.hole.geometry = new THREE.PlaneGeometry(4, 4)
distortion.hole.material = new THREE.ShaderMaterial({
  vertexShader: distortionHoleVertex,
  fragmentShader: distortionHoleFragment
})
distortion.hole.mesh = new THREE.Mesh(distortion.hole.geometry, distortion.hole.material)
distortion.scene.add(distortion.hole.mesh)

// Disc
distortion.disc = {}
distortion.disc.geometry = new THREE.PlaneGeometry(12, 12)
distortion.disc.material = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: distortionDiscVertex,
  fragmentShader: distortionDiscFragment
})
distortion.disc.mesh = new THREE.Mesh(distortion.disc.geometry, distortion.disc.material)
distortion.disc.mesh.rotation.x = - Math.PI * 0.5
distortion.scene.add(distortion.disc.mesh)

/**
 * Composition
 */
const composition = {}

composition.defaultRenderTarget = new THREE.WebGLRenderTarget(
  sizes.width * renderer.getPixelRatio(),
  sizes.height * renderer.getPixelRatio(),
  {
    generateMipmaps: false
  }
)

composition.distortionRenderTarget = new THREE.WebGLRenderTarget(
  sizes.width * renderer.getPixelRatio(),
  sizes.height * renderer.getPixelRatio(),
  {
      generateMipmaps: false,
      format: THREE.RedFormat
  }
)

// Custom scene
composition.scene = new THREE.Scene()
composition.camera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0.1, 10)
composition.camera.position.set(0, 0, 5)
composition.scene.add(composition.camera)

// Plane
composition.plane = {}
composition.plane.geometry = new THREE.PlaneGeometry(2, 2)
composition.plane.material = new THREE.ShaderMaterial({
  vertexShader: compositionVertex,
  fragmentShader: compositionFragment,
  uniforms: {
    uTime: { value: 0 },
    uDefaultTexture: { value: composition.defaultRenderTarget.texture },
    uDistortionTexture: { value: composition.distortionRenderTarget.texture },
    uConvergencePosition: { value: new THREE.Vector2() }
  }
})
composition.plane.mesh = new THREE.Mesh(composition.plane.geometry, composition.plane.material)
composition.scene.add(composition.plane.mesh)

/**
 * Tick loop
 */
const clock = new THREE.Clock()

const tick = () => {
  // Elapsed Time
  const time = clock.getElapsedTime()

  // Update Disc
  disc.material.uniforms.uTime.value = time

  // Update camera and controls
  controls.update()
  camera.rotateZ(0.2)

  const cameraTime = time * 0.2
  const shakeAmplitude = 0.1
  cameraGroup.position.x = shakeAmplitude * Math.sin(cameraTime) * Math.sin(cameraTime * 2.1) * Math.sin(cameraTime * 4.3)
  cameraGroup.position.y = shakeAmplitude * Math.sin(cameraTime * 1.23) * Math.sin(cameraTime * 4.56) * Math.sin(cameraTime * 7.89)
  cameraGroup.position.z = shakeAmplitude * Math.sin(cameraTime * 3.45) * Math.sin(cameraTime * 6.78) * Math.sin(cameraTime * 9.01)

  camera.updateWorldMatrix()

  // Update distortion
  distortion.hole.mesh.lookAt(camera.position)

  // Update composition
  const screenPosition = new THREE.Vector3(0, 0, 0)
  screenPosition.project(camera)
  screenPosition.x = screenPosition.x * 0.5 + 0.5
  screenPosition.y = screenPosition.y * 0.5 + 0.5
  composition.plane.material.uniforms.uConvergencePosition.value.set(screenPosition.x, screenPosition.y)
  composition.plane.material.uniforms.uTime.value = time

  // Render
  renderer.render(scene, camera)
  renderer.render(distortion.scene, camera)
  // renderer.render(noises.scene, noises.camera)

  // Render default scene
  renderer.setRenderTarget(composition.defaultRenderTarget)
  renderer.setClearColor('#130e16')
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)

  // Render distortion scene
  renderer.setRenderTarget(composition.distortionRenderTarget)
  renderer.setClearColor('#000000')
  renderer.render(distortion.scene, camera)
  renderer.setRenderTarget(null)

  // Render composition scene
  renderer.render(composition.scene, composition.camera)

  // Keep ticking
    window.requestAnimationFrame(tick)
}

tick()
