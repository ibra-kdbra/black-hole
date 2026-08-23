import * as THREE from 'three'
import nebulaVertex from '../shaders/nebula/vertex.glsl'
import nebulaFragment from '../shaders/nebula/fragment.glsl'

/**
 * Faint procedural nebula on the celestial sphere, drifting slowly behind
 * the stars. Reuses the baked perlin octaves - still zero texture files.
 */
export default class Nebula
{
    constructor(experience)
    {
        this.experience = experience

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.BackSide,
            vertexShader: nebulaVertex,
            fragmentShader: nebulaFragment,
            uniforms: {
                uTime: { value: 0 },
                uNoisesTexture: { value: experience.noises.texture },
                uIntensity: { value: experience.params.nebula }
            }
        })

        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(460, 32, 32), this.material)
        this.mesh.renderOrder = -1
        this.experience.scene.add(this.mesh)
    }

    update(time)
    {
        this.material.uniforms.uTime.value = time
        this.material.uniforms.uIntensity.value = this.experience.params.nebula
    }
}
