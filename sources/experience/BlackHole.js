import * as THREE from 'three'
import shadowVertex from '../shaders/shadow/vertex.glsl'
import shadowFragment from '../shaders/shadow/fragment.glsl'
import photonRingVertex from '../shaders/photonRing/vertex.glsl'
import photonRingFragment from '../shaders/photonRing/fragment.glsl'

/**
 * The hole itself: an event-horizon shadow of the correct apparent size
 * (sqrt(27)/2 rs, the gravitationally lensed silhouette) and the bright
 * photon ring hugging it - light that orbited the hole before escaping.
 * The shadow's core is void-black but its silhouette simmers with
 * turbulent lensed light, and the ring's brightness crawls with the flow,
 * so the hole reads as alive rather than a matte ball.
 */
export default class BlackHole
{
    constructor(experience)
    {
        this.experience = experience
        const physics = experience.physics

        // Shadow: opaque and depth-written so it occludes stars and the far
        // side of the disc. Unit radius, scaled each frame so spin can
        // shrink it.
        this.shadow = new THREE.Mesh(
            new THREE.SphereGeometry(1, 48, 48),
            new THREE.ShaderMaterial({
                vertexShader: shadowVertex,
                fragmentShader: shadowFragment,
                uniforms: {
                    uTime: { value: 0 },
                    uNoisesTexture: { value: experience.noises.texture },
                    uGradientTexture: { value: experience.disc.gradient.texture }
                }
            })
        )
        this.shadow.scale.setScalar(physics.shadowRadius)
        this.experience.scene.add(this.shadow)

        // Photon ring: camera-facing billboard, additive glow
        this.ring = new THREE.Mesh(
            new THREE.PlaneGeometry(6, 6),
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                depthTest: false,
                blending: THREE.AdditiveBlending,
                vertexShader: photonRingVertex,
                fragmentShader: photonRingFragment,
                uniforms: {
                    uRadius: { value: physics.shadowRadius },
                    uPlaneSize: { value: 6 },
                    uIntensity: { value: 1 },
                    uTime: { value: 0 },
                    uNoisesTexture: { value: experience.noises.texture }
                }
            })
        )
        this.ring.renderOrder = 10
        this.experience.scene.add(this.ring)
    }

    update(camera, time)
    {
        const physics = this.experience.physics

        this.shadow.scale.setScalar(physics.shadowRadius)
        this.shadow.material.uniforms.uTime.value = time

        this.ring.material.uniforms.uRadius.value = physics.shadowRadius
        this.ring.material.uniforms.uTime.value = time
        this.ring.lookAt(camera.position)
    }
}
