export async function generateFree(request, providers, options = {}) {
  if (!request?.text?.trim()) throw new Error("请输入文案");
  const errors = [];
  for (const provider of providers) {
    if (!provider.allowed || (provider.publicDemo && !options.allowPublicDemo)) continue;
    const controller = new AbortController();
    const ms = Math.min(120000, Math.max(100, provider.timeoutMs || 45000));
    let timer;
    try {
      options.onStatus?.(provider.id);
      const result = await Promise.race([
        Promise.resolve().then(() => provider.generate(request, controller.signal)),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, ms); })
      ]);
      if (!(result?.audio instanceof Blob) || result.audio.size < 128 || !result.audio.type.startsWith("audio/")) throw new Error("invalid audio");
      return { ...result, engine: provider.id, fallback: errors.length > 0, errors };
    } catch (e) {
      errors.push({engine: provider.id, reason: String(e.message || e)});
      if (options.signal?.aborted) throw new Error("cancelled");
    } finally { clearTimeout(timer); controller.abort(); }
  }
  throw Object.assign(new Error("免费引擎暂不可用，文案已保留"), {errors});
}
