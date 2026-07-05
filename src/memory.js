// Per-chat AND cross-chat memory, stored in Cloudflare KV (binding: MEMORY).
//
// Two levels of memory:
//   1) Short-term: per-chat conversation history (last N messages)
//   2) Long-term facts: per-chat facts (via /remember)
//   3) GLOBAL facts: cross-chat facts that persist across ALL chats & models
//      (stored under "global:facts" — shared by every user conversation)
//
// System prompt is also editable per-chat via /system.

const MAX_MESSAGES = 30;   // short-term conversation window
const MAX_FACTS = 50;      // per-chat long-term remembered facts
const MAX_GLOBAL_FACTS = 100; // cross-chat global facts

// ---- short-term conversation history ----
export async function getHistory(env, chatId) {
  const raw = await env.MEMORY.get(`mem:${chatId}`);
  return raw ? JSON.parse(raw) : [];
}
export async function saveHistory(env, chatId, history) {
  await env.MEMORY.put(`mem:${chatId}`, JSON.stringify(history.slice(-MAX_MESSAGES)));
}
export async function clearHistory(env, chatId) {
  await env.MEMORY.delete(`mem:${chatId}`);
}

// ---- per-chat long-term remembered facts ----
export async function getFacts(env, chatId) {
  const raw = await env.MEMORY.get(`facts:${chatId}`);
  return raw ? JSON.parse(raw) : [];
}
export async function addFact(env, chatId, fact) {
  const facts = await getFacts(env, chatId);
  facts.push(fact);
  await env.MEMORY.put(`facts:${chatId}`, JSON.stringify(facts.slice(-MAX_FACTS)));
}
export async function clearFacts(env, chatId) {
  await env.MEMORY.delete(`facts:${chatId}`);
}

// ---- GLOBAL cross-chat facts (persist across ALL chats & models) ----
// These are shared by every conversation. Use /remember global <text> to add.
export async function getGlobalFacts(env) {
  const raw = await env.MEMORY.get("global:facts");
  return raw ? JSON.parse(raw) : [];
}
export async function addGlobalFact(env, fact) {
  const facts = await getGlobalFacts(env);
  facts.push(fact);
  await env.MEMORY.put("global:facts", JSON.stringify(facts.slice(-MAX_GLOBAL_FACTS)));
}
export async function clearGlobalFacts(env) {
  await env.MEMORY.delete("global:facts");
}

// ---- system prompt (per-chat, editable via /system) ----
export async function getSystem(env, chatId) {
  return (await env.MEMORY.get(`sys:${chatId}`)) || "";
}
export async function setSystem(env, chatId, text) {
  await env.MEMORY.put(`sys:${chatId}`, text);
}

// ---- GLOBAL system prompt (applies to ALL chats if no per-chat one is set) ----
export async function getGlobalSystem(env) {
  return (await env.MEMORY.get("global:sys")) || "";
}
export async function setGlobalSystem(env, text) {
  await env.MEMORY.put("global:sys", text);
}

// ---- preferred provider/model ----
export async function getProvider(env, chatId) {
  return (await env.MEMORY.get(`prov:${chatId}`)) || "";
}
export async function setProvider(env, chatId, name) {
  await env.MEMORY.put(`prov:${chatId}`, name);
}

// ---- rich per-chat settings ----
// { auto: true, model: "provider:model" or "", reasoning: "low"|"medium"|"high" }
const DEFAULT_SETTINGS = { auto: true, model: "", reasoning: "auto", tz: "Asia/Tehran" };

export async function getSettings(env, chatId) {
  const raw = await env.MEMORY.get(`set:${chatId}`);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export async function setSettings(env, chatId, patch) {
  const cur = await getSettings(env, chatId);
  const next = { ...cur, ...patch };
  await env.MEMORY.put(`set:${chatId}`, JSON.stringify(next));
  return next;
}

// ---- dead-model cache (account-global) ----
export async function getDeadModels(env) {
  const raw = await env.MEMORY.get("deadmodels");
  if (!raw) return {};
  try {
    const o = JSON.parse(raw), now = Date.now(), alive = {};
    for (const [k, v] of Object.entries(o)) if (v > now) alive[k] = v;
    return alive;
  } catch { return {}; }
}
export async function markDeadModels(env, ids, ttlMs = 6 * 3600 * 1000) {
  if (!ids || !ids.length) return;
  const cur = await getDeadModels(env);
  const exp = Date.now() + ttlMs;
  for (const id of ids) cur[id] = exp;
  await env.MEMORY.put("deadmodels", JSON.stringify(cur));
}
export async function clearDeadModel(env, id) {
  const cur = await getDeadModels(env);
  if (cur[id]) { delete cur[id]; await env.MEMORY.put("deadmodels", JSON.stringify(cur)); }
}

// ---- REMINDERS (time-based, per-chat) ----
// Stored as: { chatId: [{ id, text, time, created }] }
export async function getReminders(env, chatId) {
  const raw = await env.MEMORY.get(`reminders:${chatId}`);
  return raw ? JSON.parse(raw) : [];
}
export async function addReminder(env, chatId, reminder) {
  const list = await getReminders(env, chatId);
  list.push(reminder);
  await env.MEMORY.put(`reminders:${chatId}`, JSON.stringify(list));
}
export async function removeReminder(env, chatId, id) {
  const list = await getReminders(env, chatId);
  const filtered = list.filter(r => r.id !== id);
  await env.MEMORY.put(`reminders:${chatId}`, JSON.stringify(filtered));
}
export async function getAllReminderChats(env) {
  // Returns list of chatIds that have reminders
  const raw = await env.MEMORY.get("reminders:chats");
  return raw ? JSON.parse(raw) : [];
}
export async function trackReminderChat(env, chatId) {
  const chats = await getAllReminderChats(env);
  if (!chats.includes(chatId)) {
    chats.push(chatId);
    await env.MEMORY.put("reminders:chats", JSON.stringify(chats));
  }
}

// ---- CRON JOBS (scheduled tasks per-chat) ----
// Each cron job: { id, label, cron, prompt, chatId, created, active }
export async function getCronJobs(env, chatId) {
  const raw = await env.MEMORY.get(`cronjobs:${chatId}`);
  return raw ? JSON.parse(raw) : [];
}
export async function addCronJob(env, chatId, job) {
  const list = await getCronJobs(env, chatId);
  list.push(job);
  await env.MEMORY.put(`cronjobs:${chatId}`, JSON.stringify(list));
}
export async function removeCronJob(env, chatId, id) {
  const list = await getCronJobs(env, chatId);
  const filtered = list.filter(j => j.id !== id);
  await env.MEMORY.put(`cronjobs:${chatId}`, JSON.stringify(filtered));
}
export async function getAllCronChats(env) {
  const raw = await env.MEMORY.get("cronjobs:chats");
  return raw ? JSON.parse(raw) : [];
}
export async function trackCronChat(env, chatId) {
  const chats = await getAllCronChats(env);
  if (!chats.includes(chatId)) {
    chats.push(chatId);
    await env.MEMORY.put("cronjobs:chats", JSON.stringify(chats));
  }
}

// ---- PENDING "remember" (waiting for user to choose this-chat vs global) ----
// When the user says "save this to memory" in natural language, we stash the
// fact here and ask them whether to store it per-chat or globally.
export async function getPendingRemember(env, chatId) {
  return (await env.MEMORY.get(`pendingrem:${chatId}`)) || "";
}
export async function setPendingRemember(env, chatId, fact) {
  await env.MEMORY.put(`pendingrem:${chatId}`, fact, { expirationTtl: 3600 });
}
export async function clearPendingRemember(env, chatId) {
  await env.MEMORY.delete(`pendingrem:${chatId}`);
}

// ---- SYSTEM PROMPT EDIT STATE (interactive editing flow) ----
// When user starts editing, we store a pending state so the next message
// is treated as the edit content, not a normal chat.
// State: { mode: "edit_system" | "edit_globalsys", original: "..." }
export async function getEditState(env, chatId) {
  const raw = await env.MEMORY.get(`editstate:${chatId}`);
  return raw ? JSON.parse(raw) : null;
}
export async function setEditState(env, chatId, state) {
  // Auto-expire after 15 minutes so a forgotten edit flow never gets "stuck"
  // and starts swallowing later messages.
  await env.MEMORY.put(`editstate:${chatId}`, JSON.stringify(state), { expirationTtl: 900 });
}
export async function clearEditState(env, chatId) {
  await env.MEMORY.delete(`editstate:${chatId}`);
}
