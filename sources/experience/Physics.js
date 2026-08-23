/**
 * Physical model of a Schwarzschild black hole.
 *
 * The scene is built in geometric units where the Schwarzschild radius
 * rs = 0.5 world units. Everything scale-dependent (shadow, photon sphere,
 * ISCO, lensing, orbital velocities) is derived from it, so the rendered
 * proportions stay physically consistent:
 *
 *   photon sphere      r_ph  = 1.5 rs
 *   shadow radius      r_sh  = sqrt(27)/2 rs ~ 2.598 rs
 *   ISCO (disc inner)  r_isco = 3 rs
 *
 * The mass slider does not rescale the scene (Schwarzschild geometry is
 * scale free) - it drives the real-unit readouts in the HUD.
 */

const G = 6.674e-11
const C = 299792458
const SOLAR_MASS = 1.989e30

export default class Physics
{
    constructor(params)
    {
        this.params = params

        // Geometric units (world space)
        this.schwarzschildRadius = 0.5
        this.photonSphereRadius = 1.5 * this.schwarzschildRadius
        this.shadowRadius = Math.sqrt(27) / 2 * this.schwarzschildRadius
        this.iscoRadius = 3 * this.schwarzschildRadius
        this.discOuterRadius = 12 * this.schwarzschildRadius
    }

    /**
     * Schwarzschild radius in kilometers for the current mass
     */
    get schwarzschildKm()
    {
        return 2 * G * this.params.massSolar * SOLAR_MASS / (C * C) / 1000
    }

    get shadowDiameterKm()
    {
        return 2 * Math.sqrt(27) / 2 * this.schwarzschildKm
    }

    get iscoKm()
    {
        return 3 * this.schwarzschildKm
    }

    /**
     * Peak effective temperature of a thin (Shakura-Sunyaev) disc accreting
     * near the Eddington limit. T scales as M^(-1/4): stellar black holes
     * burn in X-rays, supermassive ones glow in optical/UV.
     */
    get discTemperatureK()
    {
        return 6.3e7 * Math.pow(this.params.massSolar, -0.25)
    }

    /**
     * Orbital velocity of a circular geodesic at radius r (world units),
     * as a fraction of the speed of light: v/c = sqrt(rs / (2r))
     */
    orbitalBeta(r)
    {
        return Math.sqrt(this.schwarzschildRadius / (2 * r))
    }

    /**
     * Gravitational time dilation factor for a static observer at radius r
     * (world units): dτ/dt = sqrt(1 - rs/r)
     */
    timeDilation(r)
    {
        const x = 1 - this.schwarzschildRadius / r
        return x > 0 ? Math.sqrt(x) : 0
    }
}
