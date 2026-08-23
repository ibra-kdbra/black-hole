import * as THREE from 'three'
import discVertex from '../shaders/disc/vertex.glsl'
import discFragment from '../shaders/disc/fragment.glsl'

/**
 * Accretion disc. The inner edge sits exactly on the ISCO (3 rs) and the
 * shader advects the plasma with a real Keplerian velocity field:
 * material closer to the horizon orbits visibly faster, gets beamed by
 * relativistic Doppler boosting and dimmed by gravitational redshift.
 */
export default class Disc
{
    constructor(experience)
    {
        this.experience = experience
        const physics = experience.physics

        this.innerRadius = physics.iscoRadius
        this.outerRadius = physics.discOuterRadius

        this.setGradient()

        this.geometry = new THREE.CylinderGeometry(this.innerRadius, this.outerRadius, 0, 64, 10, true)
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            vertexShader: discVertex,
            fragmentShader: discFragment,
            uniforms: {
                uTime: { value: 0 },
                uGradientTexture: { value: this.gradient.texture },
                uNoisesTexture: { value: experience.noises.texture },
                uInnerRadius: { value: this.innerRadius },
                uOuterRadius: { value: this.outerRadius },
                uSchwarzschildRadius: { value: physics.schwarzschildRadius },
                uFlowSpeed: { value: experience.params.discSpeed },
                uDoppler: { value: experience.params.doppler },
                uRedshift: { value: experience.params.redshift },
                uTurbulence: { value: experience.params.turbulence },
                uBrightness: { value: experience.params.brightness }
            }
        })
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.experience.scene.add(this.mesh)
    }

    setGradient()
    {
        this.gradient = {}
        this.gradient.canvas = document.createElement('canvas')
        this.gradient.canvas.width = 1
        this.gradient.canvas.height = 128
        this.gradient.context = this.gradient.canvas.getContext('2d')
        this.gradient.style = this.gradient.context.createLinearGradient(0, 0, 0, this.gradient.canvas.height)
        this.gradient.style.addColorStop(0, '#fffbf9')
        this.gradient.style.addColorStop(0.1, '#ffbc68')
        this.gradient.style.addColorStop(0.2, '#ff5600')
        this.gradient.style.addColorStop(0.4, '#ff0053')
        this.gradient.style.addColorStop(0.8, '#cc00ff')
        this.gradient.context.fillStyle = this.gradient.style
        this.gradient.context.fillRect(0, 0, this.gradient.canvas.width, this.gradient.canvas.height)
        this.gradient.texture = new THREE.CanvasTexture(this.gradient.canvas)
    }

    update(time)
    {
        const uniforms = this.material.uniforms
        const params = this.experience.params

        uniforms.uTime.value = time
        uniforms.uFlowSpeed.value = params.discSpeed
        uniforms.uDoppler.value = params.doppler
        uniforms.uRedshift.value = params.redshift
        uniforms.uTurbulence.value = params.turbulence
        uniforms.uBrightness.value = params.brightness
    }
}
