import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Cinematic camera system: damped orbit controls with sane limits, named
 * viewpoints with eased flights between them, an autonomous cinematic mode,
 * adjustable FOV / roll, and the handheld micro-shake of the original scene.
 */
export default class CameraRig
{
    static PRESETS = {
        overview: { radius: 10.5, phi: 1.28, theta: 0.0, roll: 0.2, fov: 35 },
        edge:     { radius: 9.0,  phi: 1.53, theta: 0.4, roll: 0.05, fov: 30 },
        top:      { radius: 13.0, phi: 0.12, theta: 0.0, roll: 0.0, fov: 40 },
        close:    { radius: 5.8,  phi: 1.18, theta: 2.4, roll: 0.32, fov: 42 }
    }

    constructor(experience)
    {
        this.experience = experience
        const sizes = experience.sizes

        this.group = new THREE.Group()
        experience.scene.add(this.group)

        this.camera = new THREE.PerspectiveCamera(experience.params.fov, sizes.width / sizes.height, 0.1, 1000)
        this.camera.position.set(0, 3, 10)
        this.group.add(this.camera)

        this.controls = new OrbitControls(this.camera, experience.canvas)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.06
        this.controls.zoomSpeed = 0.4
        this.controls.rotateSpeed = 0.6
        this.controls.enablePan = false
        this.controls.minDistance = 2.0
        this.controls.maxDistance = 80

        this.flight = null
        this.spherical = new THREE.Spherical()

        // Any manual interaction interrupts flights and cinematic mode
        experience.canvas.addEventListener('pointerdown', () =>
        {
            this.flight = null
            this.experience.params.cinematic = false
            if(this.experience.ui) this.experience.ui.syncControls()
        })
    }

    get distanceToSingularity()
    {
        return this.camera.position.length()
    }

    /**
     * Fly smoothly to a named preset
     */
    flyTo(name)
    {
        const preset = CameraRig.PRESETS[name]
        if(!preset) return

        const from = new THREE.Spherical().setFromVector3(this.camera.position)

        // Take the short way around
        let deltaTheta = preset.theta - from.theta
        deltaTheta = Math.atan2(Math.sin(deltaTheta), Math.cos(deltaTheta))

        this.flight = {
            progress: 0,
            duration: 2.2,
            from: { radius: from.radius, phi: from.phi, theta: from.theta, roll: this.experience.params.roll, fov: this.experience.params.fov },
            to: { ...preset, theta: from.theta + deltaTheta }
        }
    }

    static easeInOutCubic(x)
    {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
    }

    update(delta, time)
    {
        const params = this.experience.params

        if(this.flight)
        {
            // Preset flight overrides the controls
            this.flight.progress = Math.min(1, this.flight.progress + delta / this.flight.duration)
            const t = CameraRig.easeInOutCubic(this.flight.progress)
            const from = this.flight.from
            const to = this.flight.to

            this.spherical.set(
                THREE.MathUtils.lerp(from.radius, to.radius, t),
                THREE.MathUtils.clamp(THREE.MathUtils.lerp(from.phi, to.phi, t), 0.001, Math.PI - 0.001),
                THREE.MathUtils.lerp(from.theta, to.theta, t)
            )
            this.camera.position.setFromSpherical(this.spherical)
            this.camera.lookAt(0, 0, 0)

            params.roll = THREE.MathUtils.lerp(from.roll, to.roll, t)
            params.fov = THREE.MathUtils.lerp(from.fov, to.fov, t)

            if(this.flight.progress >= 1)
            {
                this.flight = null
                if(this.experience.ui) this.experience.ui.syncControls()
            }
        }
        else if(params.cinematic)
        {
            // Slow autonomous drift around the hole
            this.spherical.setFromVector3(this.camera.position)
            this.spherical.theta += delta * 0.06
            this.spherical.phi = THREE.MathUtils.lerp(this.spherical.phi, 1.35 + Math.sin(time * 0.045) * 0.22, delta * 0.3)
            this.spherical.radius = THREE.MathUtils.lerp(this.spherical.radius, 9 + Math.sin(time * 0.03) * 2.5, delta * 0.3)
            this.camera.position.setFromSpherical(this.spherical)
            this.camera.lookAt(0, 0, 0)
        }
        else
        {
            this.controls.update()
        }

        // Roll and FOV
        this.camera.rotateZ(params.roll)
        if(this.camera.fov !== params.fov)
        {
            this.camera.fov = params.fov
            this.camera.updateProjectionMatrix()
        }

        // Handheld micro-shake
        if(params.shake)
        {
            const cameraTime = time * 0.2
            const amplitude = params.shakeAmplitude
            this.group.position.x = amplitude * Math.sin(cameraTime) * Math.sin(cameraTime * 2.1) * Math.sin(cameraTime * 4.3)
            this.group.position.y = amplitude * Math.sin(cameraTime * 1.23) * Math.sin(cameraTime * 4.56) * Math.sin(cameraTime * 7.89)
            this.group.position.z = amplitude * Math.sin(cameraTime * 3.45) * Math.sin(cameraTime * 6.78) * Math.sin(cameraTime * 9.01)
        }
        else
        {
            this.group.position.set(0, 0, 0)
        }

        this.camera.updateWorldMatrix(true, false)
    }

    resize()
    {
        this.camera.aspect = this.experience.sizes.width / this.experience.sizes.height
        this.camera.updateProjectionMatrix()
    }
}
