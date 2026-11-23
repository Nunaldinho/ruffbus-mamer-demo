/* Helpers shared by the booking page and the staff screen. */
"use strict";
const RB = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pad = n => String(n).padStart(2, "0");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const isoWeekday = s => parse(s).getDay() || 7;          // 1 = Monday … 7 = Sunday
  const hm = min => pad(Math.floor(min / 60)) + ":" + pad(min % 60);
  const pct = x => x == null ? "–" : Math.round(x * 100) + " %";
  const LOCALE = {fr: "fr-LU", de: "de-LU", en: "en-GB", pt: "pt-PT"};
  const fmtDay = (s, lang, opt) => parse(s).toLocaleDateString(LOCALE[lang] || "fr-LU", opt);
  const fmtPhone = p => p && p.startsWith("+352") ? "+352 " + p.slice(4).replace(/(\d{3})(?=\d)/g, "$1 ") : (p || "");

  /* Every state-changing call carries X-Ruffbus: 1; the server refuses it otherwise (CSRF guard). */
  async function api(path, {method = "GET", body} = {}) {
    const opt = {method, headers: {"X-Ruffbus": "1"}, credentials: "same-origin"};
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(path, opt); } catch (e) { throw {status: 0, error: "network"}; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw Object.assign({status: res.status}, data || {error: "server"});
    return data;
  }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  let toastTimer;
  function toast(msg, bad = false) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "toast" + (bad ? " bad" : "");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }

  function getPref(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: keep in memory */ } }

  /* Destinations grouped by commune, from /api/config. */
  function groupDests(list) {
    const out = [];
    list.forEach(d => { let g = out.find(x => x[0] === d.commune); if (!g) out.push(g = [d.commune, []]); g[1].push(d); });
    return out;
  }

  return {$, $$, esc, pad, parse, ymd, addDays, isoWeekday, hm, pct, fmtDay, fmtPhone, api, debounce, toast, getPref, setPref, groupDests};
})();
