const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function learnReference(samples, sampleRate, transcript) {
  const chars = (transcript.match(/[\p{L}\p{N}]/gu) || []).length;
  const seconds = samples.length / sampleRate;
  if (chars < 5 || seconds < 2 || seconds > 60) throw new Error('请使用 2–60 秒录音，并填写至少 5 字的对应原文');
  const step = Math.round(sampleRate / 50);
  const levels = [];
  for (let start = 0; start + step <= samples.length; start += step) {
    let energy = 0;
    for (let i = start; i < start + step; i++) energy += samples[i] ** 2;
    levels.push(Math.sqrt(energy / step));
  }
  const sorted = [...levels].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * .9)];
  if (!(loud > .001)) throw new Error('录音过轻或没有可分析的声音');
  const threshold = Math.max(.001, loud * .12);
  const first = levels.findIndex(n => n >= threshold);
  const last = levels.findLastIndex(n => n >= threshold);
  const utterance = levels.slice(first, last + 1);
  const active = utterance.filter(n => n >= threshold).sort((a, b) => a - b);
  if (active.length < 50) throw new Error('有效录音太短');
  const median = active[Math.floor(active.length / 2)];
  const peak = active[Math.floor(active.length * .9)];
  const pauseRatio = 1 - active.length / utterance.length;
  return {
    speed: clamp(chars / (active.length / 50) / 5, .9, 1.1),
    intensity: Math.round(clamp(50 + 14 * (peak / median - 1), 50, 82)),
    pauseRatio
  };
}

export function mergeReference(previous, sample) {
  const count = previous ? Math.min(previous.count, 9) : 0;
  const average = key => (count * (previous?.[key] ?? 0) + sample[key]) / (count + 1);
  return {count: count + 1, speed: average('speed'), intensity: average('intensity'), pauseRatio: average('pauseRatio')};
}

export function referenceDistance(sample, target) {
  return Math.abs(sample.speed - target.speed) / .2
    + Math.abs(sample.intensity - target.intensity) / 32
    + (Number.isFinite(target.pauseRatio) ? Math.abs(sample.pauseRatio - target.pauseRatio) : 0);
}

export const builtInReference = Object.freeze({speed:.9,intensity:59,pauseRatio:null});

export function recordReferenceResult(history, learnedWon) {
  const wins = clamp(Number(history?.wins) || 0, 0, 19);
  const losses = clamp(Number(history?.losses) || 0, 0, 19);
  const decay = wins + losses >= 19 ? .95 : 1;
  return {wins: wins * decay + Number(learnedWon), losses: losses * decay + Number(!learnedWon)};
}

export function adaptiveReference(reference, history) {
  const wins = clamp(Number(history?.wins) || 0, 0, 19);
  const losses = clamp(Number(history?.losses) || 0, 0, 19);
  const weight = .35 + .65 * (wins + 2) / (wins + losses + 2);
  return {speed: 1 + (reference.speed - 1) * weight, intensity: Math.round(68 + (reference.intensity - 68) * weight)};
}
