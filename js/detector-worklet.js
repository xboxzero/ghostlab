// AudioWorklet: watches the analog input for sharp rising edges (sync pulses, note-ons)
// and reports their exact time, plus a smoothed envelope level for modulation.
class GhostDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.env = 0;
    this.armed = true;
    this.threshold = 0.25;
    this.lastOnset = -1;
    this.counter = 0;
    this.port.onmessage = e => { if (e.data.threshold != null) this.threshold = e.data.threshold; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      this.env = v > this.env ? v : this.env * 0.9992;          // fast attack, ~30 ms release
      if (this.armed && this.env > this.threshold) {
        const t = currentTime + i / sampleRate;
        if (t - this.lastOnset > 0.03) {                           // ignore re-triggers inside 30 ms
          this.port.postMessage({ type: 'onset', time: t, level: this.env });
          this.lastOnset = t;
        }
        this.armed = false;
      } else if (!this.armed && this.env < this.threshold * 0.5) this.armed = true;
    }
    if (++this.counter % 8 === 0) this.port.postMessage({ type: 'env', level: this.env });
    return true;
  }
}
registerProcessor('ghost-detector', GhostDetector);
