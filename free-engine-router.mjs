export async function generateFree(request, providers, options = {}) {
  if (!request?.text?.trim()) throw new Error("请输入文案");
  const errors = [];
  const cancelled = () => new Error("已取消");
  for (const provider of providers) {
    if (options.signal?.aborted) throw cancelled();
    if (!provider.allowed || (provider.publicDemo && !options.allowPublicDemo)) continue;
    const controller = new AbortController();
    const ms = Math.min(120000, Math.max(100, provider.timeoutMs || 45000));
    let timer, onAbort;
    try {
      options.onStatus?.(provider.id);
      const result = await Promise.race([
        Promise.resolve().then(async () => {
          const result = await provider.generate(request, controller.signal);
          if (!(result?.audio instanceof Blob) || result.audio.size < 128 || !result.audio.type.startsWith("audio/")) throw new Error("invalid audio");
          const durationSeconds = options.validateAudio ? await options.validateAudio(result.audio, controller.signal) : undefined;
          if (options.validateAudio && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) throw new Error('invalid decoded duration');
          return { ...result, durationSeconds };
        }),
        new Promise((_, reject) => { timer = setTimeout(() => { reject(new Error("timeout")); controller.abort(); }, ms); }),
        new Promise((_, reject) => {
          onAbort = () => { reject(cancelled()); controller.abort(); };
          options.signal?.addEventListener("abort", onAbort, {once:true});
          if (options.signal?.aborted) onAbort();
        })
      ]);
      if (options.signal?.aborted) throw cancelled();
      return { ...result, engine: provider.id, fallback: errors.length > 0, errors };
    } catch (e) {
      if (options.signal?.aborted) throw cancelled();
      errors.push({engine: provider.id, reason: String(e.message || e)});
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      controller.abort();
    }
  }
  throw Object.assign(new Error("免费引擎暂不可用，文案已保留"), {errors});
}
