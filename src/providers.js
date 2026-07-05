// AI providers with per-provider MODEL LISTS and two-level automatic fallback:
//   1) across providers (PROVIDER_ORDER)
//   2) across models within each provider (MODELS[provider] = [ ... ])
// Any model that errors or returns empty is silently skipped -> next model -> next provider.
//
// Cloudflare Workers AI has been REMOVED entirely.
// Only external API providers remain: Gemini, Groq, OpenRouter, Mistral.

// First model in each list = highest priority. Put known-good models first.
const MODELS = {
  bynara: [
    "gpt-5.5",
    "gpt-5.4",
    "claude-sonnet-4.6",
    "claude-sonnet-4.5",
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "qwen3.7-max",
    "kimi-k2.7-code",
    "kimi-k2.6",
    "glm-5.2",
    "glm-5.2-plan",
    "glm-5.1",
    "mistral-large",
    "mistral-medium-3-5",
    "mimo-v2.5-pro-ultraspeed",
    "mimo-v2.5-pro",
    "mimo-v2.5",
  ],
  gemini: [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemma-4-31b-it",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen/qwen3-32b",
    "openai/gpt-oss-120b",
  ],
  openrouter: [
    "qwen/qwen3-coder:free",
    "cohere/north-mini-code:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
    "poolside/laguna-xs-2.1:free",
    "poolside/laguna-xs.2:free",
    "poolside/laguna-m.1:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
  ],
  mistral: [
    "mistral-large-latest",
    "codestral-latest",
    "mistral-medium-latest",
  ],
};

const PROVIDER_ORDER = ["bynara", "gemini", "groq", "openrouter", "mistral"];

// Safety cap: max model attempts per message.
const MAX_ATTEMPTS = 25;

function toOpenAIMessages(system, history) {
  const msgs = [];
  if (system) msgs.push({ role: "system", content: system });
  for (const m of history) msgs.push({ role: m.role, content: m.content });
  return msgs;
}

// Normalize any usage shape into { prompt_tokens, completion_tokens, total_tokens }.
function normUsage(prompt, completion, total) {
  const p = prompt || 0;
  const c = completion || 0;
  return { prompt_tokens: p, completion_tokens: c, total_tokens: total || p + c };
}

async function callOpenAICompatible(url, apiKey, model, system, history, extraHeaders = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model, messages: toOpenAIMessages(system, history), temperature: 0.7 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 140)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty response");
  const u = data?.usage || {};
  return { text, usage: normUsage(u.prompt_tokens, u.completion_tokens, u.total_tokens) };
}

async function callGemini(apiKey, model, system, history) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 140)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
  if (!text) throw new Error("empty response");
  const u = data?.usageMetadata || {};
  return { text, usage: normUsage(u.promptTokenCount, u.candidatesTokenCount, u.totalTokenCount) };
}

function providerAvailable(name, env) {
  switch (name) {
    case "bynara": return !!env.BYNARA_API_KEY;
    case "gemini": return !!env.GEMINI_API_KEY;
    case "openrouter": return !!env.OPENROUTER_API_KEY;
    case "groq": return !!env.GROQ_API_KEY;
    case "mistral": return !!env.MISTRAL_API_KEY;
    default: return false;
  }
}

async function callModel(name, env, model, system, history) {
  switch (name) {
    case "bynara": return callOpenAICompatible("https://router.bynara.id/v1/chat/completions", env.BYNARA_API_KEY, model, system, history, { "HTTP-Referer": "https://workers.dev", "X-Title": "TG Bot" });
    case "gemini": return callGemini(env.GEMINI_API_KEY, model, system, history);
    case "openrouter": return callOpenAICompatible("https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY, model, system, history, { "HTTP-Referer": "https://workers.dev", "X-Title": "TG Bot" });
    case "groq": return callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY, model, system, history);
    case "mistral": return callOpenAICompatible("https://api.mistral.ai/v1/chat/completions", env.MISTRAL_API_KEY, model, system, history);
    default: throw new Error("unknown provider");
  }
}

// preferred can be "" | "groq" | "groq:qwen/qwen3-32b"
// Returns { text, provider, model } or throws only if EVERYTHING failed.
async function generateWithFallback(env, system, history, preferred) {
  let prefProvider = "", prefModel = "";
  if (preferred) {
    const i = preferred.indexOf(":");
    if (i === -1) { prefProvider = preferred; }
    else { prefProvider = preferred.slice(0, i); prefModel = preferred.slice(i + 1); }
  }

  const order = [];
  if (prefProvider && PROVIDER_ORDER.includes(prefProvider)) order.push(prefProvider);
  for (const p of PROVIDER_ORDER) if (!order.includes(p)) order.push(p);

  const errors = [];
  let attempts = 0;
  for (const name of order) {
    if (!providerAvailable(name, env)) continue;
    let models = MODELS[name] || [];
    if (name === prefProvider && prefModel) {
      models = [prefModel, ...models.filter((m) => m !== prefModel)];
    }
    for (const model of models) {
      if (attempts >= MAX_ATTEMPTS) break;
      attempts++;
      try {
        const { text, usage } = await callModel(name, env, model, system, history);
        return { text, provider: name, model, usage };
      } catch (e) {
        errors.push(`${name}/${model}: ${e.message}`);
      }
    }
    if (attempts >= MAX_ATTEMPTS) break;
  }
  throw new Error("all failed -> " + errors.join(" | "));
}

export { MODELS, PROVIDER_ORDER, providerAvailable, generateWithFallback, callSingle };

// Call EXACTLY one external provider+model ("provider:model"). Throws the real
// error (incl. HTTP status/body) if it fails -- no silent fallback. Used when
// the user pins a specific model from the menu so they get honest feedback.
async function callSingle(env, sel, system, history) {
  const i = sel.indexOf(":");
  const name = i === -1 ? sel : sel.slice(0, i);
  const model = i === -1 ? "" : sel.slice(i + 1);
  if (!PROVIDER_ORDER.includes(name)) throw new Error(`unknown provider: ${name}`);
  if (!providerAvailable(name, env)) throw new Error(`\u06a9\u0644\u06cc\u062f ${name.toUpperCase()}_API_KEY \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647`);
  const { text, usage } = await callModel(name, env, model, system, history);
  return { text, usage, provider: name, model };
}
