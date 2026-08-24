import * as THREE from 'three'
import debrisVertex from '../shaders/tdeDebris/vertex.glsl'
import debrisFragment from '../shaders/tdeDebris/fragment.glsl'

/**
 * Tidal disruption event. A star falls in on a parabolic orbit; when it
 * crosses the tidal radius it is torn into a debris cloud whose particles
 * are integrated with real (Newtonian) gravity: roughly half gain energy
 * and escape, the rest rain back, circularize into the disc plane and are
 * swallowed - each absorbed particle feeding an accretion flare that
 * brightens the disc, the jets and the bloom before decaying away.
 *
 * Gravity for the event uses a cinematic GM (stronger than the disc's
 * geometric value) so the whole arc plays out in ~half a minute.
 */
export default class TidalDisruption
{
    constructor(experience)
    {
        this.experience = experience

        this.GM = 2.5
        this.spawnRadius = 8
        this.periapsis = 2.0
        this.tidalRadius = 3.4
        this.absorbRadius = experience.physics.shadowRadius * 1.05
        this.escapeRadius = 90
        this.count = 4500

        this.flare = 0
        this.active = false
        this.starAlive = false
        this.birthTime = 0

        // The doomed star: a plain bright sphere - the bloom pass gives it
        // its glow, tidal stretching gives it its death
        this.star = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            new THREE.MeshBasicMaterial({ color: '#fff6e5' })
        )
        this.star.visible = false
        this.experience.scene.add(this.star)

        this.starPosition = new THREE.Vector3()
        this.starVelocity = new THREE.Vector3()

        // Debris cloud
        this.positions = new Float32Array(this.count * 3)
        this.velocities = new Float32Array(this.count * 3)
        this.alive = new Uint8Array(this.count)

        const seeds = new Float32Array(this.count)
        for(let i = 0; i < this.count; i++)
        {
            seeds[i] = Math.random()
            this.positions[i * 3 + 1] = 99999
        }

        this.geometry = new THREE.BufferGeometry()
        // BufferAttribute (not Float32BufferAttribute) wraps the array
        // without copying, so the physics loop writes straight into what
        // the GPU uploads
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
        this.geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: debrisVertex,
            fragmentShader: debrisFragment,
            uniforms: {
                uTime: { value: 0 },
                uBirth: { value: 0 }
            }
        })

        this.points = new THREE.Points(this.geometry, this.material)
        this.points.frustumCulled = false
        this.points.visible = false
        this.experience.scene.add(this.points)
    }

    /**
     * Send a star in. Restarts the event if one is already running.
     */
    trigger()
    {
        const azimuth = Math.random() * Math.PI * 2
        const inclination = (0.55 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1)

        const direction = new THREE.Vector3(
            Math.cos(inclination) * Math.cos(azimuth),
            Math.sin(inclination),
            Math.cos(inclination) * Math.sin(azimuth)
        )
        this.starPosition.copy(direction).multiplyScalar(this.spawnRadius)

        // Parabolic orbit with angular momentum chosen for the periapsis:
        // v = sqrt(2GM/r), L = sqrt(2 GM rp), prograde with the disc
        const speed = Math.sqrt(2 * this.GM / this.spawnRadius)
        const tangentialSpeed = Math.sqrt(2 * this.GM * this.periapsis) / this.spawnRadius
        const radialSpeed = -Math.sqrt(Math.max(0, speed * speed - tangentialSpeed * tangentialSpeed))

        const radial = this.starPosition.clone().normalize()
        const tangential = new THREE.Vector3(radial.z, 0, -radial.x).normalize()

        this.starVelocity
            .copy(radial).multiplyScalar(radialSpeed)
            .addScaledVector(tangential, tangentialSpeed)

        // Reset any previous debris
        for(let i = 0; i < this.count; i++)
        {
            this.alive[i] = 0
            this.positions[i * 3 + 0] = 0
            this.positions[i * 3 + 1] = 99999
            this.positions[i * 3 + 2] = 0
        }
        this.geometry.attributes.position.needsUpdate = true
        this.points.visible = false

        this.active = true
        this.starAlive = true
        this.star.visible = true
        this.star.scale.set(1, 1, 1)
    }

    /**
     * Spaghettification: the star becomes a debris cloud spread along its
     * velocity, with an energy spread that leaves about half of it bound
     */
    disrupt(time)
    {
        this.starAlive = false
        this.star.visible = false
        this.birthTime = time
        this.material.uniforms.uBirth.value = time
        this.points.visible = true

        const velocityDirection = this.starVelocity.clone().normalize()

        for(let i = 0; i < this.count; i++)
        {
            const i3 = i * 3
            this.alive[i] = 1

            // Elongated cloud along the orbit
            const along = (Math.random() + Math.random() + Math.random()) / 3 - 0.5
            this.positions[i3 + 0] = this.starPosition.x + velocityDirection.x * along * 0.9 + (Math.random() - 0.5) * 0.12
            this.positions[i3 + 1] = this.starPosition.y + velocityDirection.y * along * 0.9 + (Math.random() - 0.5) * 0.12
            this.positions[i3 + 2] = this.starPosition.z + velocityDirection.z * along * 0.9 + (Math.random() - 0.5) * 0.12

            // Tidal energy spread: leading debris is unbound, trailing
            // debris falls back
            const energySpread = 1 + along * 0.55 + (Math.random() - 0.5) * 0.08
            this.velocities[i3 + 0] = this.starVelocity.x * energySpread + (Math.random() - 0.5) * 0.05
            this.velocities[i3 + 1] = this.starVelocity.y * energySpread + (Math.random() - 0.5) * 0.05
            this.velocities[i3 + 2] = this.starVelocity.z * energySpread + (Math.random() - 0.5) * 0.05
        }

        this.geometry.attributes.position.needsUpdate = true
    }

    update(delta, time)
    {
        this.flare *= Math.exp(-delta / 9)
        this.material.uniforms.uTime.value = time

        if(!this.active) return

        // Substepped integration: real elapsed simulation time in stable
        // slices, so the event runs at the same pace on any frame rate and
        // honors the time-scale slider
        let remaining = Math.min(delta * this.experience.params.timeScale, 0.4)
        while(remaining > 1e-6 && this.active)
        {
            const h = Math.min(0.03, remaining)
            remaining -= h

            if(this.starAlive) this.integrateStar(h, time)
            else this.integrateDebris(h)
        }

        if(this.starAlive)
        {
            this.star.position.copy(this.starPosition)

            // Tidal stretching along the velocity as the star nears doom
            const stretch = Math.min(6, Math.pow(this.tidalRadius / this.starPosition.length(), 3))
            if(stretch > 1)
            {
                const direction = this.starVelocity.clone().normalize()
                this.star.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)
                this.star.scale.set(stretch, 1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch))
            }
        }
        else
        {
            this.geometry.attributes.position.needsUpdate = true

            // The stream fades out in the shader after ~40s; wind the event
            // down once everything is swallowed, escaped or faded
            if(this.aliveCount === 0 || time - this.birthTime > 45)
            {
                this.active = false
                this.points.visible = false
            }
        }
    }

    integrateStar(h, time)
    {
        const r = this.starPosition.length()
        const pull = -this.GM / (r * r * r)
        this.starVelocity.addScaledVector(this.starPosition, pull * h)
        this.starPosition.addScaledVector(this.starVelocity, h)

        if(this.starPosition.length() < this.tidalRadius)
            this.disrupt(time)
    }

    integrateDebris(h)
    {
        const positions = this.positions
        const velocities = this.velocities
        let aliveCount = 0

        for(let i = 0; i < this.count; i++)
        {
            if(!this.alive[i]) continue

            const i3 = i * 3
            const px = positions[i3], py = positions[i3 + 1], pz = positions[i3 + 2]
            const r = Math.sqrt(px * px + py * py + pz * pz)

            if(r < this.absorbRadius)
            {
                // Swallowed: stoke the flare
                this.alive[i] = 0
                positions[i3 + 1] = 99999
                this.flare = Math.min(1.5, this.flare + 0.0035)
                continue
            }
            if(r > this.escapeRadius)
            {
                this.alive[i] = 0
                positions[i3 + 1] = 99999
                continue
            }

            aliveCount++

            // Gravity
            const pull = -this.GM / (r * r * r)
            let ax = px * pull
            let ay = py * pull
            let az = pz * pull

            // Inside the disc region, dissipation settles debris into the
            // plane and nudges it toward the local circular orbit
            if(r < 7)
            {
                ay += -py * 0.5 - velocities[i3 + 1] * 0.7

                const circularSpeed = Math.sqrt(this.GM / r)
                const tx = pz / r, tz = -px / r
                ax += (tx * circularSpeed - velocities[i3]) * 0.12
                az += (tz * circularSpeed - velocities[i3 + 2]) * 0.12
            }

            velocities[i3 + 0] += ax * h
            velocities[i3 + 1] += ay * h
            velocities[i3 + 2] += az * h
            positions[i3 + 0] += velocities[i3 + 0] * h
            positions[i3 + 1] += velocities[i3 + 1] * h
            positions[i3 + 2] += velocities[i3 + 2] * h
        }

        this.aliveCount = aliveCount
    }
}
