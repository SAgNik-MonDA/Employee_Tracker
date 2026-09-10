// audioUtils.js
// Singleton AudioContext to bypass Chrome's autoplay policies during async socket events.

let globalAudioCtx = null;
let isUnlocked = false;

export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  
  if (!globalAudioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      globalAudioCtx = new AC();
    }
  }
  
  if (globalAudioCtx && globalAudioCtx.state === 'suspended' && isUnlocked) {
    globalAudioCtx.resume().catch(() => {});
  }
  
  return globalAudioCtx;
};

// Unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          isUnlocked = true;
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('keydown', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
        }).catch(() => {});
      } else {
        isUnlocked = true;
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
      }
    }
  };
  
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
}

// ── Shared Sound Generators ──────────────────────────────────────────

export const playPopSound = () => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error('Pop sound failed', e);
  }
};

export const playRingSound = () => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playTone(523.25, ctx.currentTime, 0.2); // C5
    playTone(659.25, ctx.currentTime + 0.15, 0.3); // E5
  } catch (e) {
    console.error('Ring sound failed', e);
  }
};

export const playGeneralNotificationSound = () => {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error('General sound failed', e);
  }
};
