import * as THREE from 'three'
import noisesVertex from '../shaders/noises/vertex.glsl'
import noisesFragment from '../shaders/noises/fragment.glsl'

/**
 * Renders four octaves of periodic perlin noise into a float render target,
 * baked once at startup and reused by the disc and the jets.
 */
export default class Noises
{
    constructor(experience)
    {
        this.experience = experience

        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
        this.camera.position.set(0, 0, 5)
        this.scene.add(this.camera)

        this.plane = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                vertexShader: noisesVertex,
                fragmentShader: noisesFragment
            })
        )
        this.scene.add(this.plane)

        this.renderTarget = new THREE.WebGLRenderTarget(
            256,
            256,
            {
                generateMipmaps: false,
                type: THREE.FloatType,
                wrapS: THREE.RepeatWrapping,
                wrapT: THREE.RepeatWrapping
            }
        )

        const renderer = this.experience.renderer
        renderer.setRenderTarget(this.renderTarget)
        renderer.render(this.scene, this.camera)
        renderer.setRenderTarget(null)

        this.texture = this.renderTarget.texture
    }
}
