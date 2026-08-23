import * as THREE from 'three'
import starsVertex from '../shaders/stars/vertex.glsl'
import starsFragment from '../shaders/stars/fragment.glsl'

/**
 * Celestial sphere of 12000 stars. Colors follow a blackbody temperature
 * distribution (2500K red dwarfs up to 25000K blue giants) instead of
 * arbitrary hues, and each star twinkles with its own phase.
 */
export default class Stars
{
    constructor(experience)
    {
        this.experience = experience
        this.count = 12000

        const positionsArray = new Float32Array(this.count * 3)
        const sizesArray = new Float32Array(this.count)
        const colorsArray = new Float32Array(this.count * 3)
        const twinklesArray = new Float32Array(this.count)

        for(let i = 0; i < this.count; i++)
        {
            const i3 = i * 3

            // Uniform distribution on the sphere
            const theta = 2 * Math.PI * Math.random()
            const phi = Math.acos(2 * Math.random() - 1.0)

            positionsArray[i3 + 0] = Math.cos(theta) * Math.sin(phi) * 400
            positionsArray[i3 + 1] = Math.sin(theta) * Math.sin(phi) * 400
            positionsArray[i3 + 2] = Math.cos(phi) * 400

            // Power-law sizes: many faint stars, few bright ones
            sizesArray[i] = 0.5 + Math.pow(Math.random(), 3.0) * 30

            // Blackbody temperature, weighted toward cool stars like a real
            // stellar population
            const temperature = 2500 + Math.pow(Math.random(), 2.5) * 22500
            const color = Stars.blackbodyColor(temperature)

            colorsArray[i3 + 0] = color.r
            colorsArray[i3 + 1] = color.g
            colorsArray[i3 + 2] = color.b

            twinklesArray[i] = Math.random() * Math.PI * 2
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsArray, 3))
        this.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizesArray, 1))
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsArray, 3))
        this.geometry.setAttribute('twinkle', new THREE.Float32BufferAttribute(twinklesArray, 1))

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            vertexShader: starsVertex,
            fragmentShader: starsFragment,
            uniforms: {
                uTime: { value: 0 }
            }
        })

        this.points = new THREE.Points(this.geometry, this.material)
        this.experience.scene.add(this.points)
    }

    /**
     * Planckian locus approximation (Tanner Helland style fit), normalized
     */
    static blackbodyColor(kelvin)
    {
        const t = kelvin / 100
        let r, g, b

        if(t <= 66)
        {
            r = 255
            g = 99.47 * Math.log(t) - 161.12
        }
        else
        {
            r = 329.7 * Math.pow(t - 60, -0.1332)
            g = 288.12 * Math.pow(t - 60, -0.0755)
        }

        if(t >= 66)
            b = 255
        else if(t <= 19)
            b = 0
        else
            b = 138.52 * Math.log(t - 10) - 305.04

        const clamp = (x) => Math.min(255, Math.max(0, x)) / 255
        return { r: clamp(r), g: clamp(g), b: clamp(b) }
    }

    update(time)
    {
        this.material.uniforms.uTime.value = time
    }
}
