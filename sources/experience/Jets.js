import * as THREE from 'three'
import jetVertex from '../shaders/jet/vertex.glsl'
import jetFragment from '../shaders/jet/fragment.glsl'

/**
 * Relativistic polar jets - collimated plasma launched along the spin axis,
 * rendered as two open cones of scrolling noise with a slow precession.
 */
export default class Jets
{
    constructor(experience)
    {
        this.experience = experience

        this.group = new THREE.Group()
        this.experience.scene.add(this.group)

        this.length = 11
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: jetVertex,
            fragmentShader: jetFragment,
            uniforms: {
                uTime: { value: 0 },
                uNoisesTexture: { value: experience.noises.texture },
                uIntensity: { value: experience.params.jetIntensity }
            }
        })

        const geometry = new THREE.CylinderGeometry(0.5, 0.07, this.length, 32, 24, true)
        geometry.translate(0, this.length / 2, 0)

        this.up = new THREE.Mesh(geometry, this.material)
        this.group.add(this.up)

        this.down = new THREE.Mesh(geometry, this.material)
        this.down.rotation.z = Math.PI
        this.group.add(this.down)
    }

    update(time)
    {
        const params = this.experience.params

        this.group.visible = params.jets
        this.material.uniforms.uTime.value = time

        // Fade the jets out when the camera looks down their axis, so the
        // cone doesn't read as a smudge over the shadow
        const camera = this.experience.cameraRig.camera
        const alongAxis = Math.abs(camera.position.clone().normalize().y)
        const axisFade = 1 - THREE.MathUtils.smoothstep(alongAxis, 0.72, 0.95)
        this.material.uniforms.uIntensity.value = params.jetIntensity * axisFade

        // Slow jet precession
        this.group.rotation.x = Math.sin(time * 0.05) * 0.06
        this.group.rotation.z = Math.cos(time * 0.04) * 0.06
    }
}
