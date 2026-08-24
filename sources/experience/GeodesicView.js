import * as THREE from 'three'
import geodesicVertex from '../shaders/geodesic/vertex.glsl'
import geodesicFragment from '../shaders/geodesic/fragment.glsl'

/**
 * Photo mode: a fullscreen quad whose fragment shader integrates real
 * Schwarzschild null geodesics backwards from the camera. It replaces the
 * raster scene + screen-space lensing when enabled; bloom and the film
 * pass still run on top, and supersampled screenshots capture it too.
 */
export default class GeodesicView
{
    constructor(experience)
    {
        this.experience = experience
        const physics = experience.physics

        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        this.camera.position.set(0, 0, 5)
        this.scene.add(this.camera)

        this.material = new THREE.ShaderMaterial({
            vertexShader: geodesicVertex,
            fragmentShader: geodesicFragment,
            uniforms: {
                uTime: { value: 0 },
                uCameraPosition: { value: new THREE.Vector3() },
                uCameraBasis: { value: new THREE.Matrix3() },
                uTanHalfFov: { value: 1 },
                uAspect: { value: 1 },
                uRs: { value: physics.schwarzschildRadius },
                uSpinA: { value: 0 },
                uInnerRadius: { value: physics.iscoRadius },
                uOuterRadius: { value: physics.discOuterRadius },
                uEscapeRadius: { value: 45 },
                uGradientTexture: { value: experience.disc.gradient.texture },
                uNoisesTexture: { value: experience.noises.texture },
                uFlowSpeed: { value: 1 },
                uDoppler: { value: 1 },
                uRedshift: { value: 1 },
                uTurbulence: { value: 1 },
                uBrightness: { value: 1 }
            }
        })

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
        this.scene.add(this.mesh)
    }

    update(time)
    {
        const experience = this.experience
        const params = experience.params
        const camera = experience.cameraRig.camera
        const uniforms = this.material.uniforms

        uniforms.uTime.value = time
        camera.getWorldPosition(uniforms.uCameraPosition.value)
        uniforms.uCameraBasis.value.setFromMatrix4(camera.matrixWorld)
        uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
        uniforms.uAspect.value = camera.aspect

        uniforms.uInnerRadius.value = experience.physics.iscoRadius

        // Kerr parameter in length units: a = spin * M, capped just under
        // extremal so the horizon square root stays real
        uniforms.uSpinA.value = Math.min(params.spin, 0.998) * experience.physics.schwarzschildRadius / 2
        uniforms.uEscapeRadius.value = Math.max(45, uniforms.uCameraPosition.value.length() + 10)

        uniforms.uFlowSpeed.value = params.discSpeed
        uniforms.uDoppler.value = params.doppler
        uniforms.uRedshift.value = params.redshift
        uniforms.uTurbulence.value = params.turbulence
        uniforms.uBrightness.value = params.brightness * (1 + (experience.tidal?.flare ?? 0) * 1.2)
    }
}
