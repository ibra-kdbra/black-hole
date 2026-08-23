import * as THREE from 'three'
import distortionHoleVertex from '../shaders/distortionHole/vertex.glsl'
import distortionHoleFragment from '../shaders/distortionHole/fragment.glsl'
import distortionDiscVertex from '../shaders/distortionDisc/vertex.glsl'
import distortionDiscFragment from '../shaders/distortionDisc/fragment.glsl'

/**
 * Screen-space gravitational lensing mask. A camera-facing plane around the
 * hole and a plane lying in the disc encode a deflection-strength field that
 * the composition pass uses to bend the background toward the singularity,
 * approximating Schwarzschild light deflection (stronger for rays passing
 * closer to the photon sphere).
 */
export default class Distortion
{
    constructor(experience)
    {
        this.experience = experience

        this.scene = new THREE.Scene()

        // Spherically symmetric deflection around the hole
        this.hole = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 4),
            new THREE.ShaderMaterial({
                vertexShader: distortionHoleVertex,
                fragmentShader: distortionHoleFragment
            })
        )
        this.scene.add(this.hole)

        // Extra deflection in the disc plane
        this.disc = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 12),
            new THREE.ShaderMaterial({
                transparent: true,
                side: THREE.DoubleSide,
                vertexShader: distortionDiscVertex,
                fragmentShader: distortionDiscFragment,
                uniforms: {
                    uFade: { value: 1 }
                }
            })
        )
        this.disc.rotation.x = -Math.PI * 0.5
        this.scene.add(this.disc)
    }

    update(camera)
    {
        this.hole.lookAt(camera.position)

        // The in-plane field projects to a hard-edged sliver when the camera
        // grazes the disc plane - fade it out at shallow elevations
        const elevation = Math.abs(camera.position.clone().normalize().y)
        this.disc.material.uniforms.uFade.value = THREE.MathUtils.smoothstep(elevation, 0.06, 0.22)
    }
}
