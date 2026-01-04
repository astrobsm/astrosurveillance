/**
 * ASTROSURVEILLANCE - Timer Utility
 * 
 * Hardware-backed timers for precise timing operations.
 * Avoids drift issues with setInterval for critical operations.
 */

class PreciseTimer {
  constructor() {
    this.timers = new Map();
  }
  
  /**
   * Start a precise timer
   * @param {string} id - Unique timer identifier
   * @param {number} durationMs - Duration in milliseconds
   * @param {Function} callback - Callback when timer completes
   * @returns {string} Timer ID
   */
  start(id, durationMs, callback) {
    // Clear existing timer if any
    this.stop(id);
    
    const startTime = process.hrtime.bigint();
    const endTime = startTime + BigInt(durationMs * 1000000); // Convert to nanoseconds
    
    const timer = {
      id,
      startTime,
      endTime,
      durationMs,
      callback,
      timeoutId: null
    };
    
    // Use setTimeout for the actual callback
    timer.timeoutId = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, durationMs);
    
    this.timers.set(id, timer);
    return id;
  }
  
  /**
   * Stop a timer
   * @param {string} id - Timer ID
   * @returns {boolean} True if timer was stopped
   */
  stop(id) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      this.timers.delete(id);
      return true;
    }
    return false;
  }
  
  /**
   * Get remaining time for a timer
   * @param {string} id - Timer ID
   * @returns {number} Remaining time in milliseconds, or -1 if not found
   */
  getRemaining(id) {
    const timer = this.timers.get(id);
    if (!timer) return -1;
    
    const now = process.hrtime.bigint();
    const remaining = Number(timer.endTime - now) / 1000000; // Convert from nanoseconds
    return Math.max(0, remaining);
  }
  
  /**
   * Check if a timer is active
   * @param {string} id - Timer ID
   * @returns {boolean}
   */
  isActive(id) {
    return this.timers.has(id);
  }
  
  /**
   * Stop all timers
   */
  stopAll() {
    for (const [id, timer] of this.timers) {
      clearTimeout(timer.timeoutId);
    }
    this.timers.clear();
  }
}

// Singleton instance
const timerInstance = new PreciseTimer();

module.exports = timerInstance;
