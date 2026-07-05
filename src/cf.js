// Cloudflare Workers AI helpers have been REMOVED.
// This file is kept as a stub for backward compatibility — all functions are no-ops.
// The bot now uses only external API providers (Gemini, Groq, OpenRouter, Mistral).

export async function cfText() { throw new Error("Cloudflare Workers AI removed — use external providers"); }
export async function cfImage() { throw new Error("Cloudflare Workers AI removed — image generation not available"); }
export async function cfVideo() { throw new Error("Cloudflare Workers AI removed — video generation not available"); }
export async function cfSpeech() { throw new Error("Cloudflare Workers AI removed — TTS not available"); }
export async function refineMediaPrompt(env, model, raw) { return raw; }
