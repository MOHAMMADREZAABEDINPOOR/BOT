// Model catalog — organized by provider and tier.
// Cloudflare Workers AI models have been REMOVED entirely.
// Only real external providers: Gemini, Groq, OpenRouter, Mistral.

// ──────────────────────────────────────────────
// TEXT MODELS (with strength tier for auto-selection)
// ──────────────────────────────────────────────
export const TEXT_MODELS = [
  // ── Bynara (custom OpenAI-compatible endpoint) ──
  { id: "bynara:gpt-5.5",                    tier: "strong",  label: "GPT-5.5 (Bynara)" },
  { id: "bynara:gpt-5.4",                    tier: "strong",  label: "GPT-5.4 (Bynara)" },
  { id: "bynara:claude-sonnet-4.6",          tier: "strong",  label: "Claude Sonnet 4.6 (Bynara)" },
  { id: "bynara:claude-sonnet-4.5",          tier: "strong",  label: "Claude Sonnet 4.5 (Bynara)" },
  { id: "bynara:deepseek-v4-pro",            tier: "strong",  label: "DeepSeek V4 Pro (Bynara)" },
  { id: "bynara:deepseek-v4-flash",          tier: "medium",  label: "DeepSeek V4 Flash (Bynara)" },
  { id: "bynara:qwen3.7-max",                tier: "strong",  label: "Qwen3.7 Max (Bynara)" },
  { id: "bynara:kimi-k2.7-code",             tier: "strong",  label: "Kimi K2.7 Code (Bynara)" },
  { id: "bynara:kimi-k2.6",                  tier: "strong",  label: "Kimi K2.6 (Bynara)" },
  { id: "bynara:glm-5.2",                    tier: "strong",  label: "GLM 5.2 (Bynara)" },
  { id: "bynara:glm-5.2-plan",               tier: "medium",  label: "GLM 5.2 Plan (Bynara)" },
  { id: "bynara:glm-5.1",                    tier: "medium",  label: "GLM 5.1 (Bynara)" },
  { id: "bynara:mistral-large",              tier: "strong",  label: "Mistral Large (Bynara)" },
  { id: "bynara:mistral-medium-3-5",         tier: "medium",  label: "Mistral Medium 3.5 (Bynara)" },
  { id: "bynara:mimo-v2.5-pro-ultraspeed",   tier: "medium",  label: "MiMo V2.5 Pro Ultra (Bynara)" },
  { id: "bynara:mimo-v2.5-pro",              tier: "medium",  label: "MiMo V2.5 Pro (Bynara)" },
  { id: "bynara:mimo-v2.5",                  tier: "medium",  label: "MiMo V2.5 (Bynara)" },

  // ── Gemini (Google) ──
  { id: "gemini:gemini-3.5-flash",                tier: "strong",  label: "Gemini 3.5 Flash" },
  { id: "gemini:gemini-3.1-pro-preview",          tier: "strong",  label: "Gemini 3.1 Pro" },
  { id: "gemini:gemini-3.1-flash-lite-preview",   tier: "medium",  label: "Gemini 3.1 Flash Lite" },
  { id: "gemini:gemini-3-flash-preview",          tier: "medium",  label: "Gemini 3 Flash" },
  { id: "gemini:gemini-2.5-pro",                  tier: "strong",  label: "Gemini 2.5 Pro" },
  { id: "gemini:gemini-2.5-flash",                tier: "strong",  label: "Gemini 2.5 Flash" },
  { id: "gemini:gemini-2.5-flash-lite",           tier: "medium",  label: "Gemini 2.5 Flash Lite" },
  { id: "gemini:gemma-4-31b-it",                  tier: "medium",  label: "Gemma 4 31B" },

  // ── Groq (ultra-fast inference) ──
  { id: "groq:llama-3.3-70b-versatile",                       tier: "strong",  label: "Llama 3.3 70B (Groq)" },
  { id: "groq:meta-llama/llama-4-maverick-17b-128e-instruct",  tier: "strong",  label: "Llama 4 Maverick (Groq)" },
  { id: "groq:qwen/qwen3-32b",                                 tier: "medium",  label: "Qwen3 32B (Groq)" },
  { id: "groq:openai/gpt-oss-120b",                            tier: "strong",  label: "GPT-OSS 120B (Groq)" },

  // ── OpenRouter (free models) ──
  { id: "openrouter:qwen/qwen3-coder:free",                               tier: "medium",  label: "Qwen3 Coder (Free)" },
  { id: "openrouter:cohere/north-mini-code:free",                         tier: "medium",  label: "North Mini Code (Free)" },
  { id: "openrouter:nousresearch/hermes-3-llama-3.1-405b:free",           tier: "strong",  label: "Hermes 3 405B (Free)" },
  { id: "openrouter:meta-llama/llama-3.3-70b-instruct:free",              tier: "strong",  label: "Llama 3.3 70B (Free)" },
  { id: "openrouter:meta-llama/llama-3.2-3b-instruct:free",               tier: "weak",    label: "Llama 3.2 3B (Free)" },
  { id: "openrouter:cognitivecomputations/dolphin-mistral-24b-venice-edition:free", tier: "medium", label: "Dolphin Mistral 24B (Free)" },
  { id: "openrouter:qwen/qwen3-next-80b-a3b-instruct:free",               tier: "strong",  label: "Qwen3 Next 80B (Free)" },
  { id: "openrouter:liquid/lfm-2.5-1.2b-thinking:free",                   tier: "weak",    label: "LFM 2.5 1.2B Thinking (Free)" },
  { id: "openrouter:google/gemma-4-26b-a4b-it:free",                      tier: "medium",  label: "Gemma 4 26B (Free)" },
  { id: "openrouter:google/gemma-4-31b-it:free",                          tier: "medium",  label: "Gemma 4 31B (Free)" },
  { id: "openrouter:nvidia/nemotron-nano-12b-v2-vl:free",                 tier: "weak",    label: "Nemotron Nano 12B (Free)" },
  { id: "openrouter:nvidia/nemotron-nano-9b-v2:free",                     tier: "weak",    label: "Nemotron Nano 9B (Free)" },
  { id: "openrouter:openai/gpt-oss-20b:free",                             tier: "medium",  label: "GPT-OSS 20B (Free)" },
  { id: "openrouter:openai/gpt-oss-120b:free",                            tier: "strong",  label: "GPT-OSS 120B (Free)" },
  { id: "openrouter:poolside/laguna-xs-2.1:free",                         tier: "weak",    label: "Laguna XS 2.1 (Free)" },
  { id: "openrouter:poolside/laguna-xs.2:free",                           tier: "weak",    label: "Laguna XS.2 (Free)" },
  { id: "openrouter:poolside/laguna-m.1:free",                            tier: "weak",    label: "Laguna M.1 (Free)" },
  { id: "openrouter:nvidia/nemotron-3-super-120b-a12b:free",              tier: "strong",  label: "Nemotron 3 Super 120B (Free)" },
  { id: "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",              tier: "strong",  label: "Nemotron 3 Ultra 550B (Free)" },

  // ── Mistral (direct API) ──
  { id: "mistral:mistral-large-latest",       tier: "strong",  label: "Mistral Large" },
  { id: "mistral:codestral-latest",           tier: "medium",  label: "Codestral" },
  { id: "mistral:mistral-medium-latest",      tier: "medium",  label: "Mistral Medium" },
];

// ──────────────────────────────────────────────
// PROVIDER GROUPS (for keyboard display)
// ──────────────────────────────────────────────
export const PROVIDER_GROUPS = [
  {
    key: "gemini",
    label: "✨ Gemini (Google)",
    description: "مدل‌های گوگل — سریع و دقیق",
    models: TEXT_MODELS.filter(m => m.id.startsWith("gemini:")),
  },
  {
    key: "groq",
    label: "⚡ Groq (Ultra Fast)",
    description: "سریع‌ترین inference — عالی برای چت",
    models: TEXT_MODELS.filter(m => m.id.startsWith("groq:")),
  },
  {
    key: "openrouter",
    label: "🔍 OpenRouter (Free)",
    description: "مدل‌های رایگان متنوع — DeepSeek, Qwen, Llama, Nemotron",
    models: TEXT_MODELS.filter(m => m.id.startsWith("openrouter:")),
  },
  {
    key: "mistral",
    label: "🌀 Mistral (Direct)",
    description: "مدل‌های Mistral AI اروپا",
    models: TEXT_MODELS.filter(m => m.id.startsWith("mistral:")),
  },
];

// ──────────────────────────────────────────────
// CATEGORY REGISTRY (for the model picker keyboard)
// ──────────────────────────────────────────────
export const CATEGORIES = {
  bynara:     { label: "🌟 Bynara (Custom)",   kind: "text_ext", provider: "bynara",
                models: TEXT_MODELS.filter(m => m.id.startsWith("bynara:")).map(m => m.id) },
  gemini:     { label: "✨ Gemini (Google)",      kind: "text_ext", provider: "gemini",
                models: TEXT_MODELS.filter(m => m.id.startsWith("gemini:")).map(m => m.id) },
  groq:       { label: "⚡ Groq (Ultra Fast)",    kind: "text_ext", provider: "groq",
                models: TEXT_MODELS.filter(m => m.id.startsWith("groq:")).map(m => m.id) },
  openrouter: { label: "🔍 OpenRouter (Free)",    kind: "text_ext", provider: "openrouter",
                models: TEXT_MODELS.filter(m => m.id.startsWith("openrouter:")).map(m => m.id) },
  mistral:    { label: "🌀 Mistral (Direct)",     kind: "text_ext", provider: "mistral",
                models: TEXT_MODELS.filter(m => m.id.startsWith("mistral:")).map(m => m.id) },
};

// External provider ids used with the "provider:model" selection format.
export const EXTERNAL_PROVIDERS = new Set(["bynara", "gemini", "groq", "openrouter", "mistral"]);

// True if a stored selection routes through a direct external provider.
export function isExternalSelection(sel) {
  if (!sel) return false;
  const i = sel.indexOf(":");
  return i > 0 && EXTERNAL_PROVIDERS.has(sel.slice(0, i));
}

// Default model per category (first = best/priority).
export function defaultModel(category) {
  const c = CATEGORIES[category];
  return c && c.models.length ? c.models[0] : null;
}

// Find which category a raw model id belongs to.
export function categoryOfModel(modelId) {
  for (const [key, c] of Object.entries(CATEGORIES)) {
    if (c.models.includes(modelId)) return key;
  }
  return null;
}

// Look up the strength tier of a text model.
export function tierOfModel(modelId) {
  const t = TEXT_MODELS.find(m => m.id === modelId);
  return t ? t.tier : null;
}

// Get label for a model id.
export function labelOfModel(modelId) {
  const t = TEXT_MODELS.find(m => m.id === modelId);
  return t ? t.label : modelId;
}

// Best text model of a given tier.
export function bestTextModel(tier = "strong") {
  const m = TEXT_MODELS.find(x => x.tier === tier);
  return (m || TEXT_MODELS[0]).id;
}

// Models that support reasoning effort control.
const REASONING_IDS = new Set([
  "openrouter:qwen/qwen3-coder:free",
  "openrouter:qwen/qwen3-next-80b-a3b-instruct:free",
  "openrouter:liquid/lfm-2.5-1.2b-thinking:free",
  "groq:qwen/qwen3-32b",
]);
export function supportsReasoning(modelId) {
  if (REASONING_IDS.has(modelId)) return true;
  return /deepseek-r1|qwen3|gpt-oss|hermes-3|nemotron-3|lfm.*thinking/.test(modelId);
}
