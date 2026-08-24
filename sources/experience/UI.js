/**
 * Custom glass UI: control panel, physics HUD, playback bar, help overlay,
 * guided tour, keyboard shortcuts, FPS meter, screenshot and fullscreen
 * actions. No UI library - plain DOM, styled in style.css.
 */
export default class UI
{
    static TOUR = [
        { preset: 'overview', text: 'This is a supermassive black hole — a region of spacetime wrapped so tightly that nothing, not even light, escapes the horizon.' },
        { preset: 'close', text: 'The dark disc is the shadow: gravity lenses light around the horizon, casting a silhouette about 2.6× wider than the horizon itself.' },
        { text: 'The thin bright edge is the photon ring — light that circled the hole, sometimes more than once, before escaping to your eye.' },
        { preset: 'overview', text: 'The glowing spiral is the accretion disc: plasma sheared into million-degree streams, orbiting at almost half the speed of light near the inner edge.' },
        { preset: 'edge', text: 'One side outshines the other: relativistic Doppler beaming. The plasma racing toward you piles its light into your line of sight.' },
        { preset: 'top', text: 'The disc ends abruptly at the ISCO — the innermost stable circular orbit. Inside it, matter has no stable path and plunges in.' },
        {
            preset: 'overview',
            text: 'Spin the hole up and spacetime itself is dragged around with it: the stable orbits creep inward and the disc dives closer to the shadow.',
            action: (experience) =>
            {
                experience.params.spin = 0.9
                experience.disc.rebuild()
            }
        },
        { preset: 'edge', text: 'Magnetic fields wound up by the spinning disc launch jets of plasma along the poles at relativistic speeds.' },
        {
            text: 'And when a star wanders too close, tides tear it apart — half its debris escapes, half rains back as a blazing accretion flare.',
            action: (experience) => experience.tidal.trigger()
        },
        { preset: 'overview', text: 'Explore freely — every number in the panel is yours to bend.' }
    ]

    constructor(experience)
    {
        this.experience = experience
        this.params = experience.params
        this.inputs = []
        this.visible = true

        this.fps = { frames: 0, elapsed: 0, value: 0 }
        this.hudTimer = 0

        this.root = document.createElement('div')
        this.root.className = 'ui'
        document.body.appendChild(this.root)

        this.tourIndex = -1
        this.tourTimer = null

        this.setHeader()
        this.setActions()
        this.setPanel()
        this.setHud()
        this.setPlayback()
        this.setHelp()
        this.setScience()
        this.setTour()
        this.setIntro()
        this.setKeyboard()
        this.setFirstVisit()
    }

    /**
     * First visit: start the guided tour once the intro has faded. Any
     * interaction before it fires cancels it; localStorage remembers.
     */
    setFirstVisit()
    {
        try
        {
            if(window.localStorage.getItem('black-hole-visited')) return
            window.localStorage.setItem('black-hole-visited', '1')
        }
        catch(error)
        {
            return
        }

        this.autoTourTimer = window.setTimeout(() => this.startTour(), 3200)
        this.experience.canvas.addEventListener(
            'pointerdown',
            () => window.clearTimeout(this.autoTourTimer),
            { once: true }
        )
    }

    /* ------------------------------------------------------------------ */
    /* Element helpers                                                     */
    /* ------------------------------------------------------------------ */

    el(tag, className, parent, text)
    {
        const node = document.createElement(tag)
        if(className) node.className = className
        if(text !== undefined) node.textContent = text
        if(parent) parent.appendChild(node)
        return node
    }

    slider(parent, label, { min, max, step, get, set, format })
    {
        const row = this.el('div', 'ui-row', parent)
        this.el('label', 'ui-label', row, label)

        const input = this.el('input', 'ui-slider', row)
        input.type = 'range'
        input.min = min
        input.max = max
        input.step = step

        const value = this.el('span', 'ui-value', row)

        const refresh = () =>
        {
            input.value = get()
            value.textContent = format ? format(get()) : Number(get()).toFixed(2)
        }
        input.addEventListener('input', () =>
        {
            set(parseFloat(input.value))
            value.textContent = format ? format(get()) : Number(get()).toFixed(2)
        })

        refresh()
        this.inputs.push(refresh)
        return input
    }

    paramSlider(parent, label, key, min, max, step, format)
    {
        return this.slider(parent, label, {
            min, max, step,
            get: () => this.params[key],
            set: (v) => { this.params[key] = v },
            format
        })
    }

    toggle(parent, label, get, set)
    {
        const row = this.el('div', 'ui-row', parent)
        this.el('label', 'ui-label', row, label)

        const wrapper = this.el('label', 'ui-switch', row)
        const input = this.el('input', null, wrapper)
        input.type = 'checkbox'
        this.el('span', 'ui-switch-track', wrapper)

        const refresh = () => { input.checked = get() }
        input.addEventListener('change', () => set(input.checked))

        refresh()
        this.inputs.push(refresh)
        return input
    }

    paramToggle(parent, label, key)
    {
        return this.toggle(parent, label, () => this.params[key], (v) => { this.params[key] = v })
    }

    /**
     * Exclusive button row bound to a string parameter (palette, quality)
     */
    buttonGroup(parent, names, get, set)
    {
        const group = this.el('div', 'ui-presets', parent)
        const buttons = names.map((name) =>
        {
            const b = this.el('button', 'ui-preset', group, name)
            b.addEventListener('click', () =>
            {
                set(name)
                refresh()
            })
            return b
        })

        const refresh = () =>
        {
            for(const b of buttons)
                b.classList.toggle('is-active', b.textContent === get())
        }

        refresh()
        this.inputs.push(refresh)
        return group
    }

    section(title, open = true)
    {
        const details = this.el('details', 'ui-section', this.panel)
        details.open = open
        this.el('summary', 'ui-section-title', details, title)
        return this.el('div', 'ui-section-body', details)
    }

    static superscript(exponent)
    {
        const map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
        return String(exponent).split('').map((c) => map[c] ?? c).join('')
    }

    static sci(value, digits = 2)
    {
        if(!isFinite(value)) return '—'
        if(value === 0) return '0'
        const exponent = Math.floor(Math.log10(Math.abs(value)))
        if(exponent >= -2 && exponent < 4)
            return value.toPrecision(3).replace(/\.?0+$/, '')
        const mantissa = value / Math.pow(10, exponent)
        return `${mantissa.toFixed(digits)}×10${UI.superscript(exponent)}`
    }

    /* ------------------------------------------------------------------ */
    /* Layout                                                              */
    /* ------------------------------------------------------------------ */

    setHeader()
    {
        this.header = this.el('header', 'ui-header', this.root)
        this.el('h1', 'ui-title', this.header, 'BLACK HOLE')
        this.el('p', 'ui-subtitle', this.header, 'a relativistic visualization')
        this.fpsNode = this.el('div', 'ui-fps', this.header, '— fps')

        this.setStarLink()
    }

    /**
     * The star call-to-action anchors the empty bottom-right corner: every
     * other corner is taken (title, actions + panel, HUD, playback), so it
     * stays permanently visible without competing with the hero title.
     * Shows the live count when the GitHub API answers.
     */
    setStarLink()
    {
        this.starLink = this.el('a', 'ui-star-link', this.root)
        this.starLink.href = 'https://github.com/ibra-kdbra/black-hole'
        this.starLink.target = '_blank'
        this.starLink.rel = 'noopener'
        this.el('span', 'ui-star-link-icon', this.starLink, '★')
        this.starLabel = this.el('span', null, this.starLink, 'Star on GitHub')

        fetch('https://api.github.com/repos/ibra-kdbra/black-hole')
            .then((response) => response.ok ? response.json() : null)
            .then((data) =>
            {
                if(data?.stargazers_count !== undefined)
                    this.starLabel.textContent = `Star on GitHub · ${data.stargazers_count}`
            })
            .catch(() => {})
    }

    setActions()
    {
        this.actions = this.el('div', 'ui-actions', this.root)

        const button = (icon, title, onClick) =>
        {
            const b = this.el('button', 'ui-icon-button', this.actions, icon)
            b.title = title
            b.addEventListener('click', onClick)
            return b
        }

        button('◔', 'Cinematic mode [C]', () => this.toggleCinematic())
        button('✦', 'Screenshot [S]', () => this.experience.requestScreenshot())
        button('⧉', 'Copy a link to this exact view', () => this.experience.copyShareLink())
        button('Σ', 'The science inside [I]', () => this.scienceOverlay.classList.toggle('is-open'))
        button('↺', 'Reset all settings', () => this.experience.reset())
        button('⛶', 'Fullscreen [F]', () => this.toggleFullscreen())
        button('?', 'Help [K]', () => this.helpOverlay.classList.toggle('is-open'))
        button('◑', 'Hide interface [H]', () => this.toggleVisibility())
    }

    setPanel()
    {
        this.panel = this.el('aside', 'ui-panel', this.root)

        // --- Black hole -------------------------------------------------
        const physicsSection = this.section('Black hole')

        this.slider(physicsSection, 'Mass', {
            min: 0, max: 10, step: 0.05,
            get: () => Math.log10(this.params.massSolar),
            set: (v) => { this.params.massSolar = Math.pow(10, v) },
            format: () => `${UI.sci(this.params.massSolar)} M☉`
        })
        this.slider(physicsSection, 'Spin a', {
            min: 0, max: 0.998, step: 0.002,
            get: () => this.params.spin,
            set: (v) =>
            {
                this.params.spin = v
                this.experience.disc.requestRebuild()
            }
        })
        this.paramSlider(physicsSection, 'Disc flow', 'discSpeed', 0, 3, 0.01, (v) => `${v.toFixed(2)}×`)
        this.paramSlider(physicsSection, 'Doppler beaming', 'doppler', 0, 1, 0.01)
        this.paramSlider(physicsSection, 'Grav. redshift', 'redshift', 0, 1, 0.01)
        this.paramSlider(physicsSection, 'Turbulence', 'turbulence', 0, 2, 0.01)
        this.paramSlider(physicsSection, 'Disc brightness', 'brightness', 0.2, 2.5, 0.01)
        this.paramSlider(physicsSection, 'Hot-spot flare', 'hotSpot', 0, 2, 0.01)
        this.paramToggle(physicsSection, 'Polar jets', 'jets')
        this.paramSlider(physicsSection, 'Jet power', 'jetIntensity', 0, 1.5, 0.01)

        const feedButton = this.el('button', 'ui-preset ui-wide', physicsSection, '☄ Feed a star')
        feedButton.title = 'Send a star to its tidal disruption [T]'
        feedButton.addEventListener('click', () => this.experience.tidal.trigger())

        this.el('div', 'ui-group-label', physicsSection, 'Disc palette')
        this.buttonGroup(physicsSection, ['quasar', 'gargantua', 'xray', 'ember'],
            () => this.params.palette,
            (name) =>
            {
                this.params.palette = name
                this.experience.disc.setGradient(name)
            })

        // --- Atmosphere -------------------------------------------------
        const atmosphereSection = this.section('Atmosphere')

        this.paramSlider(atmosphereSection, 'Nebula', 'nebula', 0, 1.5, 0.01)
        this.toggle(atmosphereSection, 'Ambient sound',
            () => this.params.audio,
            (v) =>
            {
                this.params.audio = v
                this.experience.audio.setEnabled(v)
            })
        this.paramSlider(atmosphereSection, 'Volume', 'audioVolume', 0, 1, 0.01)

        // --- Camera -----------------------------------------------------
        const cameraSection = this.section('Camera')

        const presets = this.el('div', 'ui-presets', cameraSection)
        const presetButton = (label, name, key) =>
        {
            const b = this.el('button', 'ui-preset', presets, label)
            b.title = `Fly to ${label.toLowerCase()} view [${key}]`
            b.addEventListener('click', () => this.experience.cameraRig.flyTo(name))
        }
        presetButton('Overview', 'overview', '1')
        presetButton('Edge-on', 'edge', '2')
        presetButton('Top-down', 'top', '3')
        presetButton('Close-up', 'close', '4')

        const tourButton = this.el('button', 'ui-preset ui-wide', cameraSection, '✧ Guided tour')
        tourButton.title = 'A narrated flight through the physics [G]'
        tourButton.addEventListener('click', () => this.toggleTour())

        this.paramSlider(cameraSection, 'Field of view', 'fov', 20, 90, 1, (v) => `${Math.round(v)}°`)
        this.paramSlider(cameraSection, 'Camera roll', 'roll', -0.8, 0.8, 0.01, (v) => `${Math.round(v * 180 / Math.PI)}°`)
        this.paramToggle(cameraSection, 'Hover info', 'inspect')
        this.paramToggle(cameraSection, 'Handheld shake', 'shake')
        this.paramSlider(cameraSection, 'Shake amount', 'shakeAmplitude', 0, 0.4, 0.005)

        // --- Lensing & post --------------------------------------------
        const postSection = this.section('Lensing & film', false)

        this.paramToggle(postSection, 'Geodesic lens', 'geodesic')
        this.el('div', 'ui-group-label', postSection, 'ray-marched photo mode · heavy on old GPUs')

        this.paramSlider(postSection, 'Lensing', 'lensing', 0, 2, 0.01)
        this.paramSlider(postSection, 'Aberration', 'aberration', 0, 2.5, 0.01)
        this.paramSlider(postSection, 'Bloom', 'bloomStrength', 0, 2, 0.01)
        this.paramSlider(postSection, 'Bloom radius', 'bloomRadius', 0, 1.5, 0.01)
        this.paramSlider(postSection, 'Bloom threshold', 'bloomThreshold', 0, 1, 0.01)
        this.paramSlider(postSection, 'Film grain', 'grain', 0, 2, 0.01)
        this.paramSlider(postSection, 'Vignette', 'vignette', 0, 1.5, 0.01)

        // --- Quality ----------------------------------------------------
        const qualitySection = this.section('Quality', false)
        this.buttonGroup(qualitySection, ['auto', 'low', 'medium', 'high'],
            () => this.params.quality,
            (quality) =>
            {
                this.params.quality = quality
                this.experience.resize()
            })
    }

    /**
     * Transient confirmation message
     */
    toast(message)
    {
        if(this.toastNode) this.toastNode.remove()
        this.toastNode = this.el('div', 'ui-toast', this.root, message)
        window.setTimeout(() => this.toastNode.classList.add('is-visible'), 20)
        window.setTimeout(() =>
        {
            this.toastNode.classList.remove('is-visible')
            window.setTimeout(() => this.toastNode.remove(), 400)
        }, 2200)
    }

    setHud()
    {
        this.hud = this.el('div', 'ui-hud', this.root)
        this.el('div', 'ui-hud-title', this.hud, 'OBSERVATORY')
        this.hudBody = this.el('div', 'ui-hud-body', this.hud)
    }

    setPlayback()
    {
        this.playback = this.el('div', 'ui-playback', this.root)

        this.pauseButton = this.el('button', 'ui-icon-button', this.playback, '❚❚')
        this.pauseButton.title = 'Pause [Space]'
        this.pauseButton.addEventListener('click', () => this.togglePause())

        this.slider(this.playback, 'Time', {
            min: 0, max: 3, step: 0.01,
            get: () => this.params.timeScale,
            set: (v) => { this.params.timeScale = v },
            format: (v) => `${v.toFixed(2)}×`
        })
    }

    setHelp()
    {
        this.helpOverlay = this.el('div', 'ui-help', this.root)
        const card = this.el('div', 'ui-help-card', this.helpOverlay)
        this.el('h2', null, card, 'Controls')

        const shortcuts = [
            ['drag', 'orbit around the singularity'],
            ['hover', 'live physics for what you point at'],
            ['scroll', 'dolly in / out'],
            ['1 – 4', 'camera presets'],
            ['C', 'cinematic mode'],
            ['G', 'guided tour'],
            ['T', 'feed a star to the hole'],
            ['P', 'geodesic photo mode'],
            ['I', 'the science inside'],
            ['Space', 'pause time'],
            ['S', 'save screenshot'],
            ['F', 'fullscreen'],
            ['H', 'hide interface'],
            ['K', 'this panel']
        ]
        const list = this.el('div', 'ui-help-grid', card)
        for(const [key, action] of shortcuts)
        {
            this.el('kbd', null, list, key)
            this.el('span', null, list, action)
        }

        const close = this.el('button', 'ui-preset', card, 'close')
        close.addEventListener('click', () => this.helpOverlay.classList.remove('is-open'))
        this.helpOverlay.addEventListener('click', (event) =>
        {
            if(event.target === this.helpOverlay) this.helpOverlay.classList.remove('is-open')
        })
    }

    setScience()
    {
        this.scienceOverlay = this.el('div', 'ui-help ui-science', this.root)
        const card = this.el('div', 'ui-help-card ui-science-card', this.scienceOverlay)
        this.el('h2', null, card, 'The science inside')

        const equations = [
            ['Schwarzschild radius', 'r<sub>s</sub> = 2GM/c²', 'sets every scale in the scene; km readout in the HUD'],
            ['Photon sphere', 'r<sub>ph</sub> = 1.5 r<sub>s</sub>', 'unstable circular light orbits'],
            ['Shadow radius', 'r<sub>sh</sub> = (√27/2) r<sub>s</sub> ≈ 2.6 r<sub>s</sub>', 'the lensed silhouette and the photon ring'],
            ['ISCO (Kerr, prograde)', 'r = M[3 + Z₂ − √((3−Z₁)(3+Z₁+2Z₂))]', 'disc inner edge vs. spin — Bardeen, Press & Teukolsky'],
            ['Keplerian flow', 'Ω = √(GM/r³) &nbsp;·&nbsp; ω<sub>LT</sub> = 2GJ/c²r³', 'disc advection, frame dragging, hot-spot orbit'],
            ['Orbital speed', 'β = √(r<sub>s</sub>/2r) → 0.41c at 3 r<sub>s</sub>', 'plasma velocity for the Doppler terms'],
            ['Doppler beaming', 'δ = 1/[γ(1 − β cos θ)] &nbsp;·&nbsp; I ∝ δ³', 'the bright approaching limb, dim receding limb'],
            ['Gravitational redshift', 'ν<sub>obs</sub>/ν<sub>em</sub> = √(1 − 3r<sub>s</sub>/2r)', 'combined orbital + gravitational time dilation'],
            ['Disc temperature', 'T ≈ 6.3×10⁷ K · (M/M<sub>☉</sub>)<sup>−1/4</sup>', 'thin-disc peak — Shakura & Sunyaev'],
            ['Tidal radius', 'r<sub>t</sub> ≈ R<sub>★</sub> (M<sub>BH</sub>/M<sub>★</sub>)<sup>1/3</sup>', 'where a star is torn apart (press T)'],
            ['Relativistic jets', 'P<sub>jet</sub> ∝ a² Φ² (Blandford–Znajek)', 'the polar plasma columns — spin energy extracted magnetically, like M87\u2019s jet'],
            ['Null geodesics (photo mode)', 'd²x/dλ² = −(3/2) r<sub>s</sub> h² x/r⁵', 'Schwarzschild ray marching, h = |x×v| conserved'],
            ['Kerr–Schild metric (photo mode)', 'g<sub>μν</sub> = η<sub>μν</sub> + f l<sub>μ</sub>l<sub>ν</sub> &nbsp;·&nbsp; H = ½[p² − E² − f(l·p+E)²]', 'spinning-hole rays as a Hamiltonian system']
        ]

        const references = [
            'J. M. Bardeen, W. H. Press & S. A. Teukolsky (1972), ApJ 178 — rotating black holes: orbits and the ISCO',
            'N. I. Shakura & R. A. Sunyaev (1973), A&A 24 — the thin accretion-disc model',
            'J.-P. Luminet (1979), A&A 75 — the first simulated image of a black hole with a disc',
            'O. James, E. von Tunzelmann, P. Franklin & K. S. Thorne (2015), CQG 32 — gravitational lensing in Interstellar (DNGR)',
            'R. D. Blandford & R. L. Znajek (1977), MNRAS 179 — electromagnetic extraction of spin energy: the jet engine',
            'GRAVITY Collaboration (2018), A&A 618 — orbital hot spots near Sgr A*',
            'EHT Collaboration (2019), ApJL 875 — the image of M87*'
        ]

        const body = this.el('div', 'ui-science-body', card)
        body.innerHTML =
            equations.map(([name, formula, note]) =>
                `<div class="ui-eq"><span class="ui-eq-name">${name}</span><span class="ui-eq-formula">${formula}</span><span class="ui-eq-note">${note}</span></div>`
            ).join('') +
            '<div class="ui-refs-title">References</div>' +
            `<ul class="ui-refs">${references.map((r) => `<li>${r}</li>`).join('')}</ul>` +
            '<p class="ui-star-cta">This project is open source — if it taught you something, ' +
            '<a href="https://github.com/ibra-kdbra/black-hole" target="_blank" rel="noopener">★ star it on GitHub</a>.</p>'

        const close = this.el('button', 'ui-preset', card, 'close')
        close.addEventListener('click', () => this.scienceOverlay.classList.remove('is-open'))
        this.scienceOverlay.addEventListener('click', (event) =>
        {
            if(event.target === this.scienceOverlay) this.scienceOverlay.classList.remove('is-open')
        })
    }

    setTour()
    {
        this.tour = this.el('div', 'ui-tour', this.root)
        this.tourText = this.el('p', 'ui-tour-text', this.tour)

        const controls = this.el('div', 'ui-tour-controls', this.tour)
        this.tourProgress = this.el('span', 'ui-tour-progress', controls)
        const next = this.el('button', 'ui-preset', controls, 'next')
        next.addEventListener('click', () => this.nextTourStep())
        const end = this.el('button', 'ui-preset', controls, 'end tour')
        end.addEventListener('click', () => this.endTour())
    }

    get tourActive()
    {
        return this.tourIndex >= 0
    }

    toggleTour()
    {
        if(this.tourActive) this.endTour()
        else this.startTour()
    }

    startTour()
    {
        this.tourSavedSpin = this.params.spin
        this.tourIndex = -1
        this.tour.classList.add('is-open')
        this.nextTourStep()
    }

    nextTourStep()
    {
        window.clearTimeout(this.tourTimer)
        this.tourIndex++

        const step = UI.TOUR[this.tourIndex]
        if(!step)
        {
            this.endTour()
            return
        }

        if(step.preset) this.experience.cameraRig.flyTo(step.preset)
        if(step.action) step.action(this.experience)

        // Crossfade the caption instead of hard-swapping it
        this.tourText.classList.remove('is-in')
        window.setTimeout(() =>
        {
            this.tourText.textContent = step.text
            this.tourText.classList.add('is-in')
        }, 240)
        this.tourProgress.textContent = `${this.tourIndex + 1} / ${UI.TOUR.length}`
        this.syncControls()

        this.tourTimer = window.setTimeout(() => this.nextTourStep(), 9500)
    }

    endTour()
    {
        window.clearTimeout(this.tourTimer)
        if(!this.tourActive) return
        this.tourIndex = -1
        this.tour.classList.remove('is-open')

        // Undo the tour's spin demonstration
        if(this.params.spin !== this.tourSavedSpin)
        {
            this.params.spin = this.tourSavedSpin
            this.experience.disc.rebuild()
            this.syncControls()
        }
    }

    setIntro()
    {
        this.intro = this.el('div', 'ui-intro', document.body)
        this.el('h1', null, this.intro, 'BLACK HOLE')
        this.el('p', null, this.intro, 'crossing the photon sphere')

        window.setTimeout(() => this.intro.classList.add('is-hidden'), 900)
        window.setTimeout(() => this.intro.remove(), 2600)
    }

    setKeyboard()
    {
        window.addEventListener('keydown', (event) =>
        {
            if(event.target instanceof HTMLInputElement) return

            switch(event.key.toLowerCase())
            {
                case ' ': event.preventDefault(); this.togglePause(); break
                case 'h': this.toggleVisibility(); break
                case 'f': this.toggleFullscreen(); break
                case 's': this.experience.requestScreenshot(); break
                case 'c': this.toggleCinematic(); break
                case 't': this.experience.tidal.trigger(); break
                case 'p':
                    this.params.geodesic = !this.params.geodesic
                    this.syncControls()
                    break
                case 'g': this.toggleTour(); break
                case 'i': this.scienceOverlay.classList.toggle('is-open'); break
                case 'k': this.helpOverlay.classList.toggle('is-open'); break
                case '1': this.experience.cameraRig.flyTo('overview'); break
                case '2': this.experience.cameraRig.flyTo('edge'); break
                case '3': this.experience.cameraRig.flyTo('top'); break
                case '4': this.experience.cameraRig.flyTo('close'); break
            }
        })
    }

    /* ------------------------------------------------------------------ */
    /* Behaviour                                                           */
    /* ------------------------------------------------------------------ */

    togglePause()
    {
        this.params.paused = !this.params.paused
        this.pauseButton.textContent = this.params.paused ? '▶' : '❚❚'
    }

    toggleCinematic()
    {
        this.params.cinematic = !this.params.cinematic
    }

    toggleFullscreen()
    {
        if(document.fullscreenElement)
            document.exitFullscreen()
        else
            document.documentElement.requestFullscreen()
    }

    toggleVisibility()
    {
        this.visible = !this.visible
        this.root.classList.toggle('is-hidden', !this.visible)
    }

    syncControls()
    {
        for(const refresh of this.inputs)
            refresh()
    }

    /* ------------------------------------------------------------------ */
    /* Frame update                                                        */
    /* ------------------------------------------------------------------ */

    update(delta)
    {
        // FPS
        this.fps.frames++
        this.fps.elapsed += delta
        if(this.fps.elapsed >= 0.5)
        {
            this.fps.value = Math.round(this.fps.frames / this.fps.elapsed)
            this.fpsNode.textContent = `${this.fps.value} fps`
            this.fps.frames = 0
            this.fps.elapsed = 0
            this.experience.reportFps(this.fps.value)
        }

        // HUD, 4 times a second
        this.hudTimer += delta
        if(this.hudTimer < 0.25) return
        this.hudTimer = 0

        const physics = this.experience.physics
        const rig = this.experience.cameraRig
        const distance = rig.distanceToSingularity
        const distanceRs = distance / physics.schwarzschildRadius

        const iscoRs = physics.iscoRadius / physics.schwarzschildRadius

        const rows = [
            ['Schwarzschild radius', `${UI.sci(physics.schwarzschildKm)} km`],
            ['Spin', `a = ${this.params.spin.toFixed(2)}`],
            ['Shadow diameter', `${UI.sci(physics.shadowDiameterKm)} km`],
            [`ISCO · ${iscoRs.toFixed(2)} rₛ`, `${UI.sci(physics.iscoKm)} km`],
            ['Disc temperature', `${UI.sci(physics.discTemperatureK)} K`],
            ['Plasma at ISCO', `${(physics.orbitalBeta(physics.iscoRadius) * 100).toFixed(1)}% c`],
            ['Observer altitude', `${distanceRs.toFixed(1)} rₛ`],
            ['Time dilation (you)', `dτ/dt = ${physics.timeDilation(distance).toFixed(4)}`]
        ]

        const flare = this.experience.tidal.flare
        if(flare > 0.02)
            rows.push(['Accretion flare', `${(1 + flare * 1.2).toFixed(2)}× L`])

        this.hudBody.innerHTML = rows
            .map(([k, v]) => `<span class="ui-hud-key">${k}</span><span class="ui-hud-value">${v}</span>`)
            .join('')
    }
}
