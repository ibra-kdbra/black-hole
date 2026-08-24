import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

import Physics from './Physics.js'
import Noises from './Noises.js'
import Stars from './Stars.js'
import Nebula from './Nebula.js'
import Disc from './Disc.js'
import BlackHole from './BlackHole.js'
import Jets from './Jets.js'
import Distortion from './Distortion.js'
import TidalDisruption from './TidalDisruption.js'
import GeodesicView from './GeodesicView.js'
import CameraRig from './CameraRig.js'
import AmbientAudio from './AmbientAudio.js'
import Inspector from './Inspector.js'
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
            spin: 0,                   // Kerr parameter a (0..0.998)
            discSpeed: 1,              // Keplerian flow multiplier
            doppler: 1,                // relativistic beaming strength
            redshift: 1,               // gravitational redshift strength
            turbulence: 1,             // disc noise displacement
            brightness: 1,             // disc emission multiplier
            hotSpot: 0,                // orbiting flare strength
            palette: 'quasar',         // disc gradient theme
            jets: true,
            jetIntensity: 0.7,
            nebula: 0.6,               // background dust strength
            audio: false,              // procedural soundscape
            audioVolume: 0.5,

            // Lensing / post
            geodesic: false,           // ray-marched photo mode
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
            inspect: true,             // hover tooltips with live physics

            // Runtime
            paused: false,
            timeScale: 1,
            quality: 'auto'
        }

        // Snapshot for the reset action
        this.defaults = JSON.parse(JSON.stringify(this.params))

        // Accessibility: start calm for users who prefer reduced motion
        if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
            this.params.shake = false

        this.sizes = { width: window.innerWidth, height: window.innerHeight }
        this.time = 0
        this.clock = new THREE.Clock()
        this.screenshotRequested = false

        // Adaptive quality state ('auto' lowers the pixel-ratio cap when the
        // frame rate stays low)
        this.autoPixelCap = 2
        this.lowFpsStreak = 0

        this.physics = new Physics(this.params)

        this.setScene()
        this.setRenderer()

        this.noises = new Noises(this)
        this.stars = new Stars(this)
        this.nebula = new Nebula(this)
        this.disc = new Disc(this)
        this.blackHole = new BlackHole(this)
        this.jets = new Jets(this)
        this.distortion = new Distortion(this)
        this.tidal = new TidalDisruption(this)
        this.cameraRig = new CameraRig(this)
        this.geodesic = new GeodesicView(this)
        this.audio = new AmbientAudio(this)

        this.setComposition()
        this.setPostProcessing()

        this.ui = new UI(this)
        this.inspector = new Inspector(this)

        this.applyShareState()

        // Console access for tinkerers
        window.experience = this

        // Reused across frames - the render loop allocates nothing
        this.screenPosition = new THREE.Vector3()
        this.rafId = 0
        this.resizeQueued = false

        this.onResize = () =>
        {
            // Coalesce bursts of resize events into one reallocation per frame
            if(this.resizeQueued) return
            this.resizeQueued = true
            window.requestAnimationFrame(() =>
            {
                this.resizeQueued = false
                this.resize()
            })
        }
        window.addEventListener('resize', this.onResize)

        this.onVisibilityChange = () =>
        {
            if(document.hidden)
            {
                // rAF already stops in background tabs; also quiet the audio
                if(this.audio.context?.state === 'running') this.audio.context.suspend()
            }
            else
            {
                // Flush the hidden interval so nothing jumps on return
                this.clock.getDelta()
                if(this.params.audio) this.audio.setEnabled(true)
            }
        }
        document.addEventListener('visibilitychange', this.onVisibilityChange)

        // If the GPU evicts us (driver reset, tab pressure), recover instead
        // of freezing on a dead canvas
        this.onContextLost = (event) =>
        {
            event.preventDefault()
            this.ui.toast('Graphics context lost, recovering…')
        }
        this.onContextRestored = () =>
        {
            this.warmup()
            this.resize()
            this.ui.toast('Graphics context restored')
        }
        this.canvas.addEventListener('webglcontextlost', this.onContextLost)
        this.canvas.addEventListener('webglcontextrestored', this.onContextRestored)

        this.warmup()

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
            antialias: true,
            powerPreference: 'high-performance'
        })
        this.renderer.setClearColor('#130e16')
        this.renderer.setPixelRatio(this.pixelRatio)
        this.renderer.setSize(this.sizes.width, this.sizes.height)
    }

    get pixelRatio()
    {
        if(this.forcedPixelRatio) return this.forcedPixelRatio

        const cap = this.params.quality === 'auto'
            ? this.autoPixelCap
            : ({ low: 1, medium: 1.5, high: 2 }[this.params.quality] ?? 2)
        return Math.min(cap, window.devicePixelRatio)
    }

    /**
     * Fed by the UI's FPS meter. In 'auto' quality, three consecutive slow
     * samples lower the pixel-ratio cap a notch (never raised back within
     * the session, to avoid oscillation).
     */
    reportFps(fps)
    {
        if(this.params.quality !== 'auto' || !fps) return

        this.lowFpsStreak = fps < 28 ? this.lowFpsStreak + 1 : 0

        if(this.lowFpsStreak >= 3 && this.autoPixelCap > 1)
        {
            this.autoPixelCap = Math.max(1, this.autoPixelCap - 0.5)
            this.lowFpsStreak = 0
            this.resize()
        }
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

    /**
     * Compile every shader program up front, while the intro overlay still
     * covers the canvas. Materials otherwise compile lazily on their first
     * draw - which used to mean a visible stall the first time a tidal
     * disruption fired or geodesic mode was toggled (and mid-tour hitches).
     */
    warmup()
    {
        const camera = this.cameraRig.camera

        this.tidal.points.visible = true
        this.tidal.star.visible = true

        this.renderer.compile(this.scene, camera)
        this.renderer.compile(this.distortion.scene, camera)
        this.renderer.compile(this.geodesic.scene, this.geodesic.camera)
        this.renderer.compile(this.composition.scene, this.composition.camera)

        this.tidal.points.visible = false
        this.tidal.star.visible = false
    }

    /**
     * Full teardown: stop the loop, release every GPU resource and remove
     * all listeners. Makes the experience embeddable and hot-reload safe.
     */
    destroy()
    {
        window.cancelAnimationFrame(this.rafId)
        window.removeEventListener('resize', this.onResize)
        document.removeEventListener('visibilitychange', this.onVisibilityChange)
        this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
        this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)

        this.cameraRig.controls.dispose()
        this.audio.context?.close()

        for(const scene of [this.scene, this.distortion.scene, this.geodesic.scene, this.composition.scene, this.noises.scene])
        {
            scene.traverse((node) =>
            {
                node.geometry?.dispose()
                if(node.material)
                {
                    for(const value of Object.values(node.material.uniforms ?? {}))
                        value.value?.isTexture && value.value.dispose()
                    node.material.dispose()
                }
            })
        }

        this.composition.defaultRenderTarget.dispose()
        this.composition.distortionRenderTarget.dispose()
        this.noises.renderTarget.dispose()
        this.composer.renderTarget1.dispose()
        this.composer.renderTarget2.dispose()
        this.bloomPass.dispose?.()

        this.renderer.dispose()
        this.inspector.destroy()
        this.ui.root.remove()

        if(window.experience === this) delete window.experience
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

    /**
     * Restore every parameter to its default and rebuild what depends on it
     */
    reset()
    {
        Object.assign(this.params, JSON.parse(JSON.stringify(this.defaults)))
        this.disc.setGradient(this.params.palette)
        this.disc.rebuild()
        this.audio.setEnabled(this.params.audio)
        this.autoPixelCap = 2
        this.resize()
        this.ui.syncControls()
    }

    /* ------------------------------------------------------------------ */
    /* Shareable state                                                     */
    /* ------------------------------------------------------------------ */

    shareableState()
    {
        const camera = this.cameraRig.camera
        const spherical = new THREE.Spherical().setFromVector3(camera.position)

        return {
            v: 1,
            p: this.params,
            cam: [
                Number(spherical.radius.toFixed(3)),
                Number(spherical.phi.toFixed(4)),
                Number(spherical.theta.toFixed(4))
            ]
        }
    }

    copyShareLink()
    {
        const encoded = btoa(encodeURIComponent(JSON.stringify(this.shareableState())))
        const url = `${location.origin}${location.pathname}#s=${encoded}`
        history.replaceState(null, '', `#s=${encoded}`)

        if(navigator.clipboard?.writeText)
        {
            navigator.clipboard.writeText(url)
                .then(() => this.ui.toast('View link copied'))
                .catch(() => this.ui.toast('Link is in the address bar'))
        }
        else
        {
            this.ui.toast('Link is in the address bar')
        }
    }

    applyShareState()
    {
        const match = location.hash.match(/^#s=(.+)$/)
        if(!match) return

        try
        {
            const state = JSON.parse(decodeURIComponent(atob(match[1])))

            // Only known keys, so a crafted link can't inject anything
            for(const key of Object.keys(this.defaults))
            {
                if(state.p?.[key] !== undefined && typeof state.p[key] === typeof this.defaults[key])
                    this.params[key] = state.p[key]
            }
            this.params.audio = false // sound stays opt-in per visit

            if(Array.isArray(state.cam) && state.cam.length === 3)
            {
                const [radius, phi, theta] = state.cam.map(Number)
                const spherical = new THREE.Spherical(
                    THREE.MathUtils.clamp(radius, 2, 30),
                    THREE.MathUtils.clamp(phi, 0.001, Math.PI - 0.001),
                    theta
                )
                this.cameraRig.camera.position.setFromSpherical(spherical)
                this.cameraRig.camera.lookAt(0, 0, 0)
            }

            this.disc.setGradient(this.params.palette)
            this.disc.rebuild()
            this.resize()
            this.ui.syncControls()
        }
        catch(error)
        {
            console.warn('Ignored malformed share link', error)
        }
    }

    requestScreenshot()
    {
        this.screenshotRequested = true
    }

    /**
     * Supersampled capture: re-render one frame at double the pixel ratio
     * (up to 3x), read it synchronously, then restore
     */
    saveScreenshot()
    {
        this.forcedPixelRatio = Math.min(3, this.renderer.getPixelRatio() * 2)
        this.resize()
        this.renderPipeline()
        const dataUrl = this.canvas.toDataURL('image/png')
        this.forcedPixelRatio = null
        this.resize()

        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `black-hole-${Date.now()}.png`
        link.click()
    }

    /**
     * The full frame: world into the default target, deflection field into
     * the distortion target, then composition + post to the canvas
     */
    renderPipeline()
    {
        if(this.params.geodesic)
        {
            // Photo mode: the ray marcher replaces the raster scene and the
            // screen-space lensing; bloom and the film pass still apply
            this.geodesic.update(this.time)
            this.renderPass.scene = this.geodesic.scene
            this.renderPass.camera = this.geodesic.camera
            this.composer.render()
            return
        }

        this.renderPass.scene = this.composition.scene
        this.renderPass.camera = this.composition.camera

        const camera = this.cameraRig.camera

        this.renderer.setRenderTarget(this.composition.defaultRenderTarget)
        this.renderer.setClearColor('#130e16')
        this.renderer.render(this.scene, camera)
        this.renderer.setRenderTarget(null)

        this.renderer.setRenderTarget(this.composition.distortionRenderTarget)
        this.renderer.setClearColor('#000000')
        this.renderer.render(this.distortion.scene, camera)
        this.renderer.setRenderTarget(null)

        this.composer.render()
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
        this.nebula.update(this.time)
        this.tidal.update(this.params.paused ? 0 : delta, this.time)
        this.disc.update(this.time)
        this.blackHole.update(camera, this.time)
        this.jets.update(this.time)
        this.distortion.update(camera)
        this.audio.update(delta, this.cameraRig.distanceToSingularity)

        // Project the singularity to screen space for the lensing convergence
        const screenPosition = this.screenPosition.set(0, 0, 0)
        screenPosition.project(camera)
        screenPosition.x = screenPosition.x * 0.5 + 0.5
        screenPosition.y = screenPosition.y * 0.5 + 0.5
        this.composition.plane.material.uniforms.uConvergencePosition.value.set(screenPosition.x, screenPosition.y)
        this.composition.plane.material.uniforms.uLensing.value = this.params.lensing
        this.composition.plane.material.uniforms.uAberration.value = this.params.aberration

        this.bloomPass.strength = this.params.bloomStrength + this.tidal.flare * 0.25
        this.bloomPass.radius = this.params.bloomRadius
        this.bloomPass.threshold = this.params.bloomThreshold
        this.filmPass.uniforms.uTime.value = this.time
        this.filmPass.uniforms.uGrain.value = this.params.grain
        this.filmPass.uniforms.uVignette.value = this.params.vignette

        this.renderPipeline()

        if(this.screenshotRequested)
        {
            this.screenshotRequested = false
            this.saveScreenshot()
        }

        this.ui.update(delta)
        this.inspector.update(delta)

        this.rafId = window.requestAnimationFrame(this.tick)
    }
}
