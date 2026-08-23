import * as THREE from 'three'
import photonRingVertex from '../shaders/photonRing/vertex.glsl'
import photonRingFragment from '../shaders/photonRing/fragment.glsl'

/**
 * The hole itself: an event-horizon shadow of the correct apparent size
 * (sqrt(27)/2 rs, the gravitationally lensed silhouette) and the bright
 * photon ring hugging it - light that orbited the hole before escaping.
 */
export default class BlackHole
{
    constructor(experience)
    {
        this.experience = experience
        const physics = experience.physics

        // Shadow: an opaque black sphere occludes stars and the far side of
        // the disc, giving the silhouette a real depth footprint. Unit
        // radius, scaled each frame so spin can shrink it.
        this.shadow = new THREE.Mesh(
            new THREE.SphereGeometry(1, 48, 48),
            new THREE.MeshBasicMaterial({ color: '#000000' })
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
                    uIntensity: { value: 1 }
                }
            })
        )
        this.ring.renderOrder = 10
        this.experience.scene.add(this.ring)
    }

    update(camera)
    {
        const physics = this.experience.physics

        this.shadow.scale.setScalar(physics.shadowRadius)
        this.ring.material.uniforms.uRadius.value = physics.shadowRadius
        this.ring.lookAt(camera.position)
    }
}
