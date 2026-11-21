export function createShowAudio() {
  // Keep this element through TV renders so Safari retains its playback permission.
  const audio = new Audio();
  let enabled = false;
  let currentCue = '';

  return {
    get enabled() { return enabled; },
    async toggle() {
      if (enabled) {
        audio.pause();
        enabled = false;
        currentCue = '';
        return;
      }
      audio.src = 'assets/juleloop.wav';
      audio.muted = true;
      try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        enabled = true;
      } finally {
        audio.muted = false;
      }
    },
    sync(show, winnerDelay, musicRound) {
      if (!enabled) return;
      let cue = musicRound ? '' : 'juleloop';
      let offset = 0;
      if (show.phase === 'finale' && show.finaleStart) {
        const elapsed = Date.now() - show.finaleStart;
        if (elapsed < winnerDelay) {
          cue = `drumroll:${show.finaleStart}`;
          offset = elapsed / 1000 % 5;
        } else if (elapsed < winnerDelay + 4700) {
          cue = `fanfare:${show.finaleStart}`;
          offset = (elapsed - winnerDelay) / 1000;
        }
      }
      if (cue === currentCue) return;
      currentCue = cue;
      audio.pause();
      if (!cue) return;
      const [name] = cue.split(':');
      audio.src = `assets/${name}.wav`;
      audio.loop = name === 'drumroll' || name === 'juleloop';
      audio.currentTime = Math.max(0, offset);
      audio.play().catch(() => {});
    }
  };
}
