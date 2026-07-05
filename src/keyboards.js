// Inline-keyboard builders for the tap-to-select model picker.
// Callback data: "pk|<provider>|<index>" to select a model.
// Categories are now provider-based: gemini, groq, openrouter, mistral.

import { CATEGORIES, labelOfModel } from "./catalog.js";

const PAGE = 8; // models per page

// Top-level: pick a provider.
export function categoriesKeyboard() {
  const keys = Object.keys(CATEGORIES).filter(k => CATEGORIES[k].models.length);
  const rows = [];
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    rows.push([{ text: `${CATEGORIES[k].label} (${CATEGORIES[k].models.length})`, callback_data: `cat|${k}` }]);
  }
  rows.push([{ text: "🤖 خودکار (بهترین مدل خودم انتخاب کنم)", callback_data: "auto|1" }]);
  rows.push([{ text: "⚙️ عمق فکر (low/medium/high)", callback_data: "rzmenu|1" }]);
  return rows;
}

// Models inside one provider, paginated.
export function modelsKeyboard(catKey, page = 0) {
  const cat = CATEGORIES[catKey];
  const models = cat.models;
  const start = page * PAGE;
  const slice = models.slice(start, start + PAGE);
  const rows = [];
  for (const id of slice) {
    const label = labelOfModel(id) || id;
    rows.push([{ text: label, callback_data: `pk|${catKey}|${models.indexOf(id)}` }]);
  }
  const nav = [];
  if (page > 0) nav.push({ text: "◀️ قبلی", callback_data: `pg|${catKey}|${page - 1}` });
  if (start + PAGE < models.length) nav.push({ text: "بعدی ▶️", callback_data: `pg|${catKey}|${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "🤖 خودکار در این دسته", callback_data: `autocat|${catKey}` }]);
  rows.push([{ text: "⬅️ دسته‌ها", callback_data: "cats|1" }]);
  return rows;
}

export function reasoningKeyboard(current = "auto") {
  const mk = (lvl, txt) => ({ text: (lvl === current ? "✅ " : "") + txt, callback_data: `rz|${lvl}` });
  return [
    [mk("auto", "🤖 خودکار")],
    [mk("low", "🟢 کم"), mk("medium", "🟡 متوسط"), mk("high", "🔴 زیاد")],
    [{ text: "⬅️ دسته‌ها", callback_data: "cats|1" }],
  ];
}

// Resolve a "pk|<cat>|<index>" selection back to a real model id.
export function resolvePick(catKey, index) {
  const cat = CATEGORIES[catKey];
  if (!cat) return null;
  const id = cat.models[Number(index)];
  return id ? { id, kind: cat.kind, category: catKey, provider: cat.provider || null } : null;
}
