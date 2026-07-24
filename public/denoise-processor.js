/**
 * CalmClip spectral noise reduction: AudioWorklet processor.
 *
 * Algorithm: spectral subtraction with minimum-statistics noise floor tracking.
 *
 * Analysis:  Hann-windowed STFT, 512-point FFT, 128-sample hop (4x overlap).
 * Noise est: per-bin running minimum over a 90-frame (~260 ms) sliding window.
 * Subtract:  magnitude reduced by noise estimate; floored at SPECTRAL_FLOOR to
 *            avoid musical-noise artifacts in noise-only regions.
 * Synthesis: IFFT, Hann synthesis window, overlap-add, COLA normalization (1.5).
 *
 * A/V sync: analysis-synthesis delay is 384 samples (~8.7 ms at 44100 Hz),
 * which is well below the perceptible threshold (~45 ms).
 *
 * Privacy: all processing runs locally. No audio data leaves the browser.
 *
 * Browser support: Chrome 66+, Firefox 76+, Safari 14.1+ (AudioWorklet).
 * Falls back to a simple high-pass filter if addModule() fails (see canvasExporter.ts).
 */

/* global AudioWorkletProcessor, registerProcessor */

const FFT_SIZE       = 512;
const HOP_SIZE       = 128;   // must equal the AudioWorklet render quantum (128 samples)
const BINS           = FFT_SIZE / 2 + 1;   // 257 unique complex bins
const NOISE_FRAMES   = 90;    // sliding window depth (~260 ms at 44100 Hz)
const OVER_SUBTRACT  = 1.5;   // multiply noise estimate before subtracting (reduces under-cancellation)
const SPECTRAL_FLOOR = 0.05;  // minimum per-bin gain (prevents complete silence, reduces musical noise)
const COLA_NORM      = 1.5;   // Hann window overlap-add normalization for 4x overlap

/**
 * Cooley-Tukey in-place complex FFT.
 * re, im: Float32Array of length n (n must be a power of 2).
 * inverse: if true, performs IFFT normalized by 1/n.
 */
function fft(re, im, inverse) {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t;
      t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterfly passes
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang  = (inverse ? 1.0 : -1.0) * 2.0 * Math.PI / len;
    const wRe  = Math.cos(ang);
    const wIm  = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1.0, cIm = 0.0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * cRe - im[i + k + half] * cIm;
        const vIm = re[i + k + half] * cIm + im[i + k + half] * cRe;
        re[i + k]        = uRe + vRe;
        im[i + k]        = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nr = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

/**
 * Allocate and return per-channel processing state.
 * Separated from the class so the constructor stays trivial.
 */
function makeChannelState() {
  // Hann window used for both analysis and synthesis
  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    win[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / (FFT_SIZE - 1)));
  }

  // Noise magnitude history ring buffer: NOISE_FRAMES rows of BINS values.
  // Initialised to 1e-9 so cold-start frames pass through without reduction
  // until the noise floor estimate converges (after ~260 ms).
  const magHistory = [];
  for (let h = 0; h < NOISE_FRAMES; h++) {
    magHistory.push(new Float32Array(BINS).fill(1e-9));
  }

  return {
    win,
    inBuf:    new Float32Array(FFT_SIZE).fill(0), // input sample FIFO (newest at end)
    outBuf:   new Float32Array(FFT_SIZE).fill(0), // overlap-add accumulator
    re:       new Float32Array(FFT_SIZE),          // FFT real buffer
    im:       new Float32Array(FFT_SIZE),          // FFT imaginary buffer
    magHistory,
    histIdx:  0,                                   // next write slot in magHistory
    noiseMin: new Float32Array(BINS).fill(1e-9),   // per-bin minimum over magHistory
  };
}

class DenoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._states = []; // one state object per channel, allocated on first process()
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || inp.length === 0) return true;

    const numCh = inp.length;
    while (this._states.length < numCh) this._states.push(makeChannelState());

    for (let c = 0; c < numCh; c++) {
      if (inp[c] && out[c]) this._processCh(inp[c], out[c], this._states[c]);
    }
    return true;
  }

  _processCh(input, output, s) {
    const { win, inBuf, outBuf, re, im, magHistory, noiseMin } = s;

    // Shift input FIFO left by HOP_SIZE and fill the tail with the new block
    inBuf.copyWithin(0, HOP_SIZE);
    inBuf.set(input, FFT_SIZE - HOP_SIZE);

    // Apply Hann analysis window and copy to FFT real buffer
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = inBuf[i] * win[i];
      im[i] = 0.0;
    }

    // Forward FFT
    fft(re, im, false);

    // Compute and store magnitude spectrum for positive frequencies (bins 0..BINS-1)
    const curSlot = magHistory[s.histIdx];
    for (let k = 0; k < BINS; k++) {
      curSlot[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }

    // Advance ring-buffer write index (oldest slot is now at s.histIdx)
    s.histIdx = (s.histIdx + 1) % NOISE_FRAMES;

    // Recompute per-bin minimum across the full history.
    // The minimum tracks the noise floor: noise is always present whereas
    // speech is intermittent, so the minimum over ~260 ms converges to the
    // noise magnitude even during speech activity.
    for (let k = 0; k < BINS; k++) {
      let mn = magHistory[0][k];
      for (let h = 1; h < NOISE_FRAMES; h++) {
        if (magHistory[h][k] < mn) mn = magHistory[h][k];
      }
      noiseMin[k] = mn;
    }

    // Spectral subtraction: reduce each bin by its estimated noise magnitude
    for (let k = 0; k < BINS; k++) {
      const sigMag   = curSlot[k];
      const noiseEst = noiseMin[k] * OVER_SUBTRACT;
      // Subtract noise, clamped to SPECTRAL_FLOOR * signal to prevent musical noise
      const reduced  = Math.max(sigMag - noiseEst, sigMag * SPECTRAL_FLOOR);
      const gain     = sigMag > 1e-10 ? reduced / sigMag : 1.0;
      re[k] *= gain;
      im[k] *= gain;
    }

    // Restore conjugate symmetry for a real-valued IFFT output
    for (let k = 1; k < FFT_SIZE / 2; k++) {
      re[FFT_SIZE - k] =  re[k];
      im[FFT_SIZE - k] = -im[k];
    }

    // Inverse FFT
    fft(re, im, true);

    // Apply Hann synthesis window and accumulate into overlap-add buffer
    for (let i = 0; i < FFT_SIZE; i++) {
      outBuf[i] += re[i] * win[i];
    }

    // Output the first HOP_SIZE samples, normalized by the COLA constant
    for (let i = 0; i < HOP_SIZE; i++) {
      output[i] = outBuf[i] / COLA_NORM;
    }

    // Shift the overlap-add accumulator left and zero the vacated tail
    outBuf.copyWithin(0, HOP_SIZE);
    outBuf.fill(0.0, FFT_SIZE - HOP_SIZE);
  }
}

registerProcessor('calmclip-denoise', DenoiseProcessor);
