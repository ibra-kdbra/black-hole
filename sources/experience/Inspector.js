import * as THREE from 'three'
import UI from './UI.js'

const _toCamera = new THREE.Vector3()

/**
 * Hover inspector: raycasts whatever the pointer rests on and shows live
 * physics for that exact spot - the disc's local radius, orbital speed,
 * temperature and Doppler state, the shadow's real size, the photon ring,
 * the jets, a doomed star mid-plunge. The tour teaches once; this serves
 * curiosity forever. Mouse only (touch drags orbit), raster mode only
 * (in geodesic mode the image no longer matches the geometry).
 */
export default class Inspector
{
    constructor(experience)
    {
        this.experience = experience

        this.raycaster = new THREE.Raycaster()
        this.pointer = new THREE.Vector2()
        this.clientX = 0
        this.clientY = 0
        this.hasPointer = false
        this.dragging = false
        this.castTimer = 0

        this.node = document.createElement('div')
        this.node.className = 'ui-inspect'
        this.titleNode = document.createElement('div')
        this.titleNode.className = 'ui-inspect-title'
        this.bodyNode = document.createElement('div')
        this.bodyNode.className = 'ui-inspect-body'
        this.node.append(this.titleNode, this.bodyNode)
        experience.ui.root.appendChild(this.node)

        const canvas = experience.canvas

        this.onPointerMove = (event) =>
        {
            if(event.pointerType !== 'mouse') return
            this.hasPointer = true
            this.clientX = event.clientX
            this.clientY = event.clientY
            this.pointer.set(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            )
        }
        this.onPointerDown = () => { this.dragging = true }
        this.onPointerUp = () => { this.dragging = false }
        this.onPointerLeave = () => { this.hasPointer = false }

        canvas.addEventListener('pointermove', this.onPointerMove)
        canvas.addEventListener('pointerdown', this.onPointerDown)
        window.addEventListener('pointerup', this.onPointerUp)
        canvas.addEventListener('pointerleave', this.onPointerLeave)
    }

    hide()
    {
        this.node.classList.remove('is-visible')
    }

    show(title, lines)
    {
        this.titleNode.textContent = title
        this.bodyNode.innerHTML = lines.map((l) => `<span>${l}</span>`).join('')

        // Follow the cursor, staying inside the viewport
        const x = Math.min(this.clientX + 18, window.innerWidth - 240)
        const y = Math.min(this.clientY + 16, window.innerHeight - 90)
        this.node.style.transform = `translate(${x}px, ${y}px)`
        this.node.classList.add('is-visible')
    }

    update(delta)
    {
        const experience = this.experience
        const params = experience.params

        if(!params.inspect || params.geodesic || this.dragging || !this.hasPointer)
        {
            this.hide()
            return
        }

        // ~12 casts per second is plenty for a tooltip
        this.castTimer += delta
        if(this.castTimer < 0.08) return
        this.castTimer = 0

        const physics = experience.physics
        this.raycaster.setFromCamera(this.pointer, experience.cameraRig.camera)

        const targets = [experience.blackHole.shadow, experience.disc.mesh, experience.blackHole.ring]
        if(params.jets) targets.push(experience.jets.up, experience.jets.down)
        if(experience.tidal.star.visible) targets.push(experience.tidal.star)

        const rs = physics.schwarzschildRadius

        for(const hit of this.raycaster.intersectObjects(targets, false))
        {
            const object = hit.object

            if(object === experience.blackHole.ring)
            {
                // The ring billboard is a full plane - only its bright band counts
                const d = hit.point.length()
                if(d < physics.shadowRadius * 0.82 || d > physics.shadowRadius * 1.45) continue
                this.show('Photon ring', [
                    'light that orbited the hole before reaching you',
                    `photon sphere at 1.5 rₛ · ring at ${(physics.shadowRadius / rs).toFixed(1)} rₛ`
                ])
                return
            }

            if(object === experience.blackHole.shadow)
            {
                this.show('Event-horizon shadow', [
                    `apparent Ø ${UI.sci(physics.shadowDiameterKm)} km at ${UI.sci(this.experience.params.massSolar)} M☉`,
                    'inside, every path leads to the singularity'
                ])
                return
            }

            if(object === experience.disc.mesh)
            {
                const radius = Math.hypot(hit.point.x, hit.point.z)
                const beta = physics.orbitalBeta(radius)
                const temperature = physics.discTemperatureK * Math.pow(radius / physics.iscoRadius, -0.75)

                // Doppler state of this limb, from the local flow direction
                _toCamera.copy(experience.cameraRig.camera.position).sub(hit.point).normalize()
                const approach = (hit.point.z * _toCamera.x - hit.point.x * _toCamera.z) / radius
                const side = approach > 0.25 ? 'approaching, beamed toward you'
                    : approach < -0.25 ? 'receding, Doppler-dimmed'
                    : 'transverse flow'

                this.show('Accretion disc', [
                    `r = ${(radius / rs).toFixed(1)} rₛ · plasma at ${(beta * 100).toFixed(0)}% c`,
                    `≈ ${UI.sci(temperature)} K · ${side}`
                ])
                return
            }

            if(object === experience.jets.up || object === experience.jets.down)
            {
                const flare = experience.tidal.flare
                const lines = ['spin energy flung out magnetically (Blandford-Znajek)']
                if(flare > 0.05) lines.push(`flaring ×${(1 + flare).toFixed(2)} on infalling debris`)
                this.show('Relativistic jet', lines)
                return
            }

            if(object === experience.tidal.star)
            {
                const r = experience.tidal.starPosition.length()
                const stretch = Math.min(6, Math.pow(experience.tidal.tidalRadius / r, 3))
                this.show('Doomed star', [
                    `r = ${(r / rs).toFixed(1)} rₛ · tidal stretching ×${stretch.toFixed(1)}`,
                    stretch > 1 ? 'spaghettification in progress' : 'falling toward the tidal radius'
                ])
                return
            }
        }

        this.hide()
    }

    destroy()
    {
        const canvas = this.experience.canvas
        canvas.removeEventListener('pointermove', this.onPointerMove)
        canvas.removeEventListener('pointerdown', this.onPointerDown)
        window.removeEventListener('pointerup', this.onPointerUp)
        canvas.removeEventListener('pointerleave', this.onPointerLeave)
        this.node.remove()
    }
}
