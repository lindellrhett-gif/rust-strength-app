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
   * Milliseconds the phone was seen standing still since the previous clean
   * fix: from that fix to the last fix dropped as jitter. Auto-pause uses it.
   */
  stillMs?: number;
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
