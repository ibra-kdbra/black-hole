import * as THREE from 'three'
import discVertex from '../shaders/disc/vertex.glsl'
import discFragment from '../shaders/disc/fragment.glsl'

/**
 * Accretion disc. The inner edge sits exactly on the (spin-dependent) ISCO
 * and the shader advects the plasma with a real Keplerian velocity field
 * plus Lense-Thirring frame dragging: material closer to the horizon orbits
 * visibly faster, gets beamed by relativistic Doppler boosting and dimmed
 * by gravitational redshift. An optional hot spot - a magnetic
 * reconnection flare like the ones GRAVITY tracked around Sgr A* - rides
 * the flow just outside the inner edge.
 */
export default class Disc
{
    static PALETTES = {
        quasar: [[0, '#fffbf9'], [0.1, '#ffbc68'], [0.2, '#ff5600'], [0.4, '#ff0053'], [0.8, '#cc00ff']],
        gargantua: [[0, '#ffffff'], [0.15, '#ffe9c4'], [0.3, '#ffc46b'], [0.55, '#e08a35'], [0.9, '#6b3a14']],
        xray: [[0, '#f4fdff'], [0.12, '#a8e8ff'], [0.3, '#4fb8ff'], [0.55, '#3c63ff'], [0.85, '#8a2be2']],
        ember: [[0, '#fff3e0'], [0.12, '#ffcf7d'], [0.3, '#ff8c3b'], [0.55, '#e6392f'], [0.85, '#7a0e3c']]
    }

    constructor(experience)
    {
        this.experience = experience
        const physics = experience.physics

        this.outerRadius = physics.discOuterRadius

        this.setGradient(experience.params.palette)

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
                uInnerRadius: { value: physics.iscoRadius },
                uOuterRadius: { value: this.outerRadius },
                uSchwarzschildRadius: { value: physics.schwarzschildRadius },
                uSpin: { value: experience.params.spin },
                uFlowSpeed: { value: experience.params.discSpeed },
                uDoppler: { value: experience.params.doppler },
                uRedshift: { value: experience.params.redshift },
                uTurbulence: { value: experience.params.turbulence },
                uBrightness: { value: experience.params.brightness },
                uHotSpot: { value: 0 },
                uHotSpotPhase: { value: 0 },
                uHotSpotRadius: { value: physics.iscoRadius * 1.15 }
            }
        })

        this.mesh = new THREE.Mesh(this.buildGeometry(), this.material)
        this.experience.scene.add(this.mesh)
    }

    buildGeometry()
    {
        return new THREE.CylinderGeometry(this.experience.physics.iscoRadius, this.outerRadius, 0, 64, 10, true)
    }

    /**
     * Called when the spin slider moves the ISCO
     */
    rebuild()
    {
        this.mesh.geometry.dispose()
        this.mesh.geometry = this.buildGeometry()
        this.material.uniforms.uInnerRadius.value = this.experience.physics.iscoRadius
    }

    setGradient(paletteName)
    {
        const stops = Disc.PALETTES[paletteName] ?? Disc.PALETTES.quasar

        if(!this.gradient)
        {
            this.gradient = {}
            this.gradient.canvas = document.createElement('canvas')
            this.gradient.canvas.width = 1
            this.gradient.canvas.height = 128
            this.gradient.context = this.gradient.canvas.getContext('2d')
        }

        const context = this.gradient.context
        const style = context.createLinearGradient(0, 0, 0, this.gradient.canvas.height)
        for(const [offset, color] of stops)
            style.addColorStop(offset, color)
        context.fillStyle = style
        context.fillRect(0, 0, this.gradient.canvas.width, this.gradient.canvas.height)

        if(this.gradient.texture)
            this.gradient.texture.needsUpdate = true
        else
            this.gradient.texture = new THREE.CanvasTexture(this.gradient.canvas)

        if(this.material)
            this.material.uniforms.uGradientTexture.value = this.gradient.texture
    }

    update(time)
    {
        const uniforms = this.material.uniforms
        const params = this.experience.params
        const physics = this.experience.physics

        uniforms.uTime.value = time
        uniforms.uSpin.value = params.spin
        uniforms.uFlowSpeed.value = params.discSpeed
        uniforms.uDoppler.value = params.doppler
        uniforms.uRedshift.value = params.redshift
        uniforms.uTurbulence.value = params.turbulence

        // A tidal disruption flare stokes the whole disc
        const flare = this.experience.tidal?.flare ?? 0
        uniforms.uBrightness.value = params.brightness * (1 + flare * 1.2)

        // Hot spot: ride the (Kepler + frame dragging) flow just outside the
        // inner edge, kept clear of the shadow, breathing slowly
        const spotRadius = Math.max(physics.iscoRadius * 1.15, physics.shadowRadius * 1.2)
        const M = physics.schwarzschildRadius / 2
        const r3 = spotRadius * spotRadius * spotRadius
        const omega = Math.sqrt(M / r3) + params.spin * 2 * M * M / r3
        const pulse = 0.7 + 0.3 * Math.sin(time * 1.3)

        uniforms.uHotSpotRadius.value = spotRadius
        uniforms.uHotSpotPhase.value = (omega * time * params.discSpeed / (2 * Math.PI)) % 1
        uniforms.uHotSpot.value = params.hotSpot * pulse
    }
}
