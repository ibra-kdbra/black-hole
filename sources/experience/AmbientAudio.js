/**
 * Procedural ambient soundscape - no audio files. A brown-noise rumble
 * through a low-pass filter plus three detuned drones. The mix deepens and
 * swells as the camera falls toward the horizon. Built lazily on the first
 * enable (a user gesture), as autoplay policies require.
 */
export default class AmbientAudio
{
    constructor(experience)
    {
        this.experience = experience
        this.context = null
        this.throttle = 0
    }

    setEnabled(enabled)
    {
        if(enabled)
        {
            if(!this.context) this.build()
            this.context.resume()
        }
        else if(this.context)
        {
            this.context.suspend()
        }
    }

    build()
    {
        const Context = window.AudioContext || window.webkitAudioContext
        this.context = new Context()

        this.master = this.context.createGain()
        this.master.gain.value = 0
        this.master.connect(this.context.destination)

        // Brown-noise rumble
        const length = this.context.sampleRate * 4
        const buffer = this.context.createBuffer(1, length, this.context.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for(let i = 0; i < length; i++)
        {
            const white = Math.random() * 2 - 1
            last = (last + 0.02 * white) / 1.02
            data[i] = last * 3.5
        }

        const noise = this.context.createBufferSource()
        noise.buffer = buffer
        noise.loop = true

        this.rumbleFilter = this.context.createBiquadFilter()
        this.rumbleFilter.type = 'lowpass'
        this.rumbleFilter.frequency.value = 90
        this.rumbleFilter.Q.value = 0.8

        const rumbleGain = this.context.createGain()
        rumbleGain.gain.value = 0.6

        noise.connect(this.rumbleFilter)
        this.rumbleFilter.connect(rumbleGain)
        rumbleGain.connect(this.master)
        noise.start()

        // Detuned drones: a slow beating chord around the fundamental
        for(const [frequency, level] of [[55, 0.05], [55.6, 0.04], [36.7, 0.07]])
        {
            const oscillator = this.context.createOscillator()
            oscillator.type = 'sine'
            oscillator.frequency.value = frequency

            const gain = this.context.createGain()
            gain.gain.value = level

            oscillator.connect(gain)
            gain.connect(this.master)
            oscillator.start()
        }
    }

    update(delta, distanceToSingularity)
    {
        if(!this.context || this.context.state !== 'running') return

        this.throttle += delta
        if(this.throttle < 0.1) return
        this.throttle = 0

        // The closer to the horizon, the deeper and louder the well sounds
        const proximity = Math.min(1.6, 3.5 / Math.max(distanceToSingularity, 2))
        const volume = this.experience.params.audioVolume * (0.25 + proximity) * 0.5
        const now = this.context.currentTime

        this.master.gain.setTargetAtTime(volume, now, 0.4)
        this.rumbleFilter.frequency.setTargetAtTime(60 + proximity * 160, now, 0.6)
    }
}
