import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

import Physics from './Physics.js'
import Noises from './Noises.js'
import Stars from './Stars.js'
import Disc from './Disc.js'
import BlackHole from './BlackHole.js'
import Jets from './Jets.js'
import Distortion from './Distortion.js'
import CameraRig from './CameraRig.js'
import UI from './UI.js'

import compositionVertex from '../shaders/composition/vertex.glsl'
import compositionFragment from '../shaders/composition/fragment.glsl'
import filmVertex from '../shaders/film/vertex.glsl'
import filmFragment from '../shaders/film/fragment.glsl'

export default class Experience
{
    constructor(canvas)
    {
        this.canvas = canvas

        this.params = {
            // Physics
            massSolar: 4.3e6,          // Sagittarius A*
            discSpeed: 1,              // Keplerian flow multiplier
            doppler: 1,                // relativistic beaming strength
            redshift: 1,               // gravitational redshift strength
            turbulence: 1,             // disc noise displacement
            brightness: 1,             // disc emission multiplier
            jets: true,
            jetIntensity: 0.7,

            // Lensing / post
            lensing: 1,
            aberration: 0.8,
            bloomStrength: 0.5,
            bloomRadius: 0.8,
            bloomThreshold: 0.68,
            grain: 0.65,
            vignette: 0.5,

            // Camera
            fov: 35,
            roll: 0.2,
            shake: true,
            shakeAmplitude: 0.1,
            cinematic: false,

            // Runtime
            paused: false,
            timeScale: 1,
            quality: 'high'
        }

        this.sizes = { width: window.innerWidth, height: window.innerHeight }
        this.time = 0
        this.clock = new THREE.Clock()
        this.screenshotRequested = false

        this.physics = new Physics(this.params)

        this.setScene()
        this.setRenderer()

        this.noises = new Noises(this)
        this.stars = new Stars(this)
        this.disc = new Disc(this)
        this.blackHole = new BlackHole(this)
        this.jets = new Jets(this)
        this.distortion = new Distortion(this)
        this.cameraRig = new CameraRig(this)

        this.setComposition()
        this.setPostProcessing()

        this.ui = new UI(this)

        // Console access for tinkerers
        window.experience = this

        window.addEventListener('resize', () => this.resize())

        this.tick = this.tick.bind(this)
        this.tick()
    }

    setScene()
    {
        this.scene = new THREE.Scene()
    }

    setRenderer()
    {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        })
        this.renderer.setClearColor('#130e16')
        this.renderer.setPixelRatio(this.pixelRatio)
        this.renderer.setSize(this.sizes.width, this.sizes.height)
    }

    get pixelRatio()
    {
        const cap = { low: 1, medium: 1.5, high: 2 }[this.params.quality] ?? 2
        return Math.min(cap, window.devicePixelRatio)
    }

    setComposition()
    {
        const composition = {}

        composition.defaultRenderTarget = new THREE.WebGLRenderTarget(
            this.sizes.width * this.renderer.getPixelRatio(),
            this.sizes.height * this.renderer.getPixelRatio(),
            { generateMipmaps: false }
        )

        composition.distortionRenderTarget = new THREE.WebGLRenderTarget(
            this.sizes.width * this.renderer.getPixelRatio(),
            this.sizes.height * this.renderer.getPixelRatio(),
            { generateMipmaps: false, format: THREE.RedFormat }
        )

        composition.scene = new THREE.Scene()
        composition.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        composition.camera.position.set(0, 0, 5)
        composition.scene.add(composition.camera)

        composition.plane = {}
        composition.plane.geometry = new THREE.PlaneGeometry(2, 2)
        composition.plane.material = new THREE.ShaderMaterial({
            vertexShader: compositionVertex,
            fragmentShader: compositionFragment,
            uniforms: {
                uDefaultTexture: { value: composition.defaultRenderTarget.texture },
                uDistortionTexture: { value: composition.distortionRenderTarget.texture },
                uConvergencePosition: { value: new THREE.Vector2() },
                uLensing: { value: this.params.lensing },
                uAberration: { value: this.params.aberration }
            }
        })
        composition.plane.mesh = new THREE.Mesh(composition.plane.geometry, composition.plane.material)
        composition.scene.add(composition.plane.mesh)

        this.composition = composition
    }

    setPostProcessing()
    {
        this.composer = new EffectComposer(this.renderer)
        this.composer.setPixelRatio(this.renderer.getPixelRatio())
        this.composer.setSize(this.sizes.width, this.sizes.height)

        this.renderPass = new RenderPass(this.composition.scene, this.composition.camera)
        this.composer.addPass(this.renderPass)

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.sizes.width, this.sizes.height),
            this.params.bloomStrength,
            this.params.bloomRadius,
            this.params.bloomThreshold
        )
        this.composer.addPass(this.bloomPass)

        this.filmPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                uTime: { value: 0 },
                uGrain: { value: this.params.grain },
                uVignette: { value: this.params.vignette }
            },
            vertexShader: filmVertex,
            fragmentShader: filmFragment
        })
        this.composer.addPass(this.filmPass)
    }

    resize()
    {
        this.sizes.width = window.innerWidth
        this.sizes.height = window.innerHeight

        this.cameraRig.resize()

        this.renderer.setPixelRatio(this.pixelRatio)
        this.renderer.setSize(this.sizes.width, this.sizes.height)

        const ratio = this.renderer.getPixelRatio()
        this.composition.defaultRenderTarget.setSize(this.sizes.width * ratio, this.sizes.height * ratio)
        this.composition.distortionRenderTarget.setSize(this.sizes.width * ratio, this.sizes.height * ratio)

        this.composer.setPixelRatio(ratio)
        this.composer.setSize(this.sizes.width, this.sizes.height)
    }

    requestScreenshot()
    {
        this.screenshotRequested = true
    }

    saveScreenshot()
    {
        this.canvas.toBlob((blob) =>
        {
            if(!blob) return
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `black-hole-${Date.now()}.png`
            link.click()
            URL.revokeObjectURL(link.href)
        })
    }

    tick()
    {
        const delta = Math.min(this.clock.getDelta(), 0.1)

        if(!this.params.paused)
            this.time += delta * this.params.timeScale

        const camera = this.cameraRig.camera

        // Update world
        this.cameraRig.update(delta, this.time)
        this.stars.update(this.time)
        this.disc.update(this.time)
        this.blackHole.update(camera)
        this.jets.update(this.time)
        this.distortion.update(camera)

        // Project the singularity to screen space for the lensing convergence
        const screenPosition = new THREE.Vector3(0, 0, 0)
        screenPosition.project(camera)
        screenPosition.x = screenPosition.x * 0.5 + 0.5
        screenPosition.y = screenPosition.y * 0.5 + 0.5
        this.composition.plane.material.uniforms.uConvergencePosition.value.set(screenPosition.x, screenPosition.y)
        this.composition.plane.material.uniforms.uLensing.value = this.params.lensing
        this.composition.plane.material.uniforms.uAberration.value = this.params.aberration

        this.bloomPass.strength = this.params.bloomStrength
        this.bloomPass.radius = this.params.bloomRadius
        this.bloomPass.threshold = this.params.bloomThreshold
        this.filmPass.uniforms.uTime.value = this.time
        this.filmPass.uniforms.uGrain.value = this.params.grain
        this.filmPass.uniforms.uVignette.value = this.params.vignette

        // Render default scene
        this.renderer.setRenderTarget(this.composition.defaultRenderTarget)
        this.renderer.setClearColor('#130e16')
        this.renderer.render(this.scene, camera)
        this.renderer.setRenderTarget(null)

        // Render distortion scene
        this.renderer.setRenderTarget(this.composition.distortionRenderTarget)
        this.renderer.setClearColor('#000000')
        this.renderer.render(this.distortion.scene, camera)
        this.renderer.setRenderTarget(null)

        // Render composition + post
        this.composer.render()

        if(this.screenshotRequested)
        {
            this.screenshotRequested = false
            this.saveScreenshot()
        }

        this.ui.update(delta)

        window.requestAnimationFrame(this.tick)
    }
}
