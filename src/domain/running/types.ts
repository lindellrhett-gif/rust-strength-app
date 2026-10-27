/**
 * Shapes shared by the running modules. Pure data, no behaviour.
 */

/** One location fix as the phone reported it. */
export interface GpsFix {
  lat: number;
  lon: number;
  /** Metres above sea level, when the phone knows. */
  alt: number | null;
  /** When the fix was taken, in milliseconds since the epoch. */
  t: number;
  /** Horizontal accuracy radius in metres, when known. Smaller is better. */
  accuracy: number | null;
  /** Vertical accuracy in metres, when known. */
  altAccuracy?: number | null;
  /**
   * Ground speed in m/s as the phone measured it (from the Doppler shift of
   * the GPS signal), or null when it doesn't know. Far steadier than speed
   * worked out from positions, so auto-pause trusts it first.
   */
  speed?: number | null;
  /**
   * Recording segment. Starts at 0 and goes up by one after every manual
   * pause, so no distance is counted for wherever you went while paused.
   */
  seg: number;
}

/** A fix that survived filtering. */
export interface CleanFix extends GpsFix {
  /**
   * False when there is no trustworthy line from the previous fix: the first
   * fix, the first fix after a manual pause, or the first fix after the track
   * jumped somewhere it could not have run to.
   */
  joined: boolean;
  /**
   * True when the phone's speed reading covered every fix since the previous
   * clean fix, with no gap in the signal. Auto-pause then trusts the motion
   * samples for this stretch rather than its average speed.
   */
  measured?: boolean;
}

/**
 * What one usable fix says about whether the runner is moving, for
 * auto-pause. 'unsure' is evidence of neither.
 */
export interface MotionSample {
  t: number;
  seg: number;
  state: 'still' | 'moving' | 'unsure';
  /** True when the phone's own speed reading decided it. */
  measured: boolean;
}

/** A point on the finished track, with running totals. */
export interface TrackPoint {
  lat: number;
  lon: number;
  alt: number | null;
  t: number;
  /** Metres covered from the start up to this point. */
  d: number;
  /** Moving seconds from the start up to this point. */
  mt: number;
}
