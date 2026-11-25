/* Booking page for residents. All rules are checked again on the server; this only guides the user. */
"use strict";
(() => {
const {$, $$, esc, parse, fmtDay, fmtPhone, api, debounce, toast, getPref, setPref, groupDests} = RB;
const LANGS = ["fr", "de", "en", "pt"];
const STEPS = ["pickup", "dropoff", "when", "who", "me"];
const NEEDS = ["seat", "stroller", "wheel", "bags"];

let lang = "fr", CFG = null, DEST = {}, ME = null, tab = "book", loadedAt = 0;
const S = {
  pickup: {mode: "commune", locality: "Holzem", street: "", dest: ""},
  dropoff: {mode: "commune", locality: "Mamer", street: "", dest: ""},
  dates: [], date: null, multi: false,     // chosen days in order; date = the first one
  time: null, ret: false, return_time: null,
  adults: 1, children: 0, needs: [], name: "", phone: "", sms: true, resident: false,
};
let AV = {out: null, ret: null}, availSeq = 0;
let PV = null, pvSeq = 0;                 // exact preview from the server
let SERVER = {};                          // step errors returned when submitting
let triedSubmit = false, pending = null, busy = false;
const login = {};                          // sign-in boxes on "My rides" and "Your data"

const t = (k, ...a) => { const v = T[lang][k] ?? T.en[k]; return typeof v === "function" ? v(...a) : (v ?? k); };
const errText = e => t(e && e.error && (T.en[e.error] !== undefined) ? e.error : "server");
const placeName = e => e.mode === "commune"
  ? (e.street.trim() ? e.street.trim() + ", " : "") + e.locality
  : (DEST[e.dest] ? DEST[e.dest].name + ", " + DEST[e.dest].commune : "");
const outside = () => S.pickup.mode === "dest" || S.dropoff.mode === "dest";

/* ---------- time in Luxembourg, from the server clock ---------- */
function nowMinutes() {
  const base = +CFG.now.slice(11, 13) * 60 + +CFG.now.slice(14, 16);
  return base + Math.floor((Date.now() - loadedAt) / 60000);
}
const todayHasSlots = () => nowMinutes() + CFG.rules.lead_min <= 17 * 60 + 45;

/* ---------- what the server receives ---------- */
const endpoint = e => e.mode === "commune"
  ? {mode: "commune", locality: e.locality, street: e.street.trim() || null}
  : {mode: "dest", dest: e.dest || null};
function trip() {
  return {
    pickup: endpoint(S.pickup), dropoff: endpoint(S.dropoff), date: S.date, more_dates: S.dates.slice(1),
    time: S.time, return_time: S.ret ? S.return_time : null,
    adults: S.adults, children: S.children, needs: S.needs, resident_declared: S.resident,
  };
}

/* ---------- availability and exact preview ---------- */
const loadAvail = debounce(async () => {
  const seq = ++availSeq;
  if (!S.date) { AV = {out: null, ret: null}; renderTimes(); return; }
  try {
    const base = trip();
    const out = await api("/api/availability", {method: "POST", body: {...base, kind: "out"}});
    const ret = S.ret && S.time ? await api("/api/availability", {method: "POST", body: {...base, kind: "return"}}) : null;
    if (seq !== availSeq) return;
    AV = {out, ret};
  } catch (e) {
    if (seq !== availSeq) return;
    AV = {out: {slots: [], ride_minutes: null}, ret: null};
    toast(errText(e), true);
  }
  renderTimes(); renderTicket(); loadPreview();
}, 180);

const loadPreview = debounce(async () => {
  const seq = ++pvSeq;
  if (!S.date || !S.time) { PV = null; renderTicket(); showErrors(); return; }
  try {
    const r = await api("/api/bookings/preview", {method: "POST", body: trip()});
    if (seq === pvSeq) PV = r;
  } catch (e) { if (seq === pvSeq) PV = null; }
  renderTicket(); showErrors();
}, 250);

function changed({avail = false, preview = true} = {}) {
  SERVER = {};
  $("#ask").hidden = true;
  if (avail) loadAvail(); else if (preview) loadPreview();
  renderTicket(); showErrors();
}

/* ---------- rendering: the form ---------- */
function endpointHTML(which) {
  const e = S[which];
  const opts = groupDests(CFG.destinations).map(([c, list]) => `<optgroup label="${esc(c)}">${list.map(d =>
    `<option value="${d.id}" ${e.dest === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</optgroup>`).join("");
  return `<div class="seg" role="group">
    <button type="button" data-mode="commune" data-end="${which}" aria-pressed="${e.mode === "commune"}">${esc(t("inCommune"))}</button>
    <button type="button" data-mode="dest" data-end="${which}" aria-pressed="${e.mode === "dest"}">${esc(t("listedDest"))}</button></div>
  ${e.mode === "commune" ? `<div class="row2">
    <div><label class="lab" for="${which}-loc">${esc(t("locality"))}</label><select id="${which}-loc" data-f="locality" data-end="${which}">${CFG.localities.map(l => `<option ${e.locality === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    <div><label class="lab" for="${which}-street">${esc(t("street"))}</label><input type="text" id="${which}-street" data-f="street" data-end="${which}" value="${esc(e.street)}" placeholder="${esc(t("streetPh"))}" maxlength="120" autocomplete="${which === "pickup" ? "street-address" : "off"}"></div>
  </div>` : `<label class="lab" for="${which}-dest">${esc(t("destination"))}</label>
    <select id="${which}-dest" data-f="dest" data-end="${which}"><option value="">${esc(t("chooseDest"))}</option>${opts}</select>
    <p class="hint">${esc(t("outsideHint"))}</p>`}
  <div class="errmsg" id="${which}-err"></div>`;
}
function renderEndpoints() { $$(".endpoint").forEach(el => { el.innerHTML = endpointHTML(el.dataset.end); }); }

function renderDays() {
  const full = S.multi && S.dates.length >= CFG.rules.days_max;
  $("#days").innerHTML = CFG.days.map((d, i) => {
    const on = S.dates.includes(d.date);
    const off = d.holiday || (i === 0 && !todayHasSlots()) || (full && !on);
    const lab = i === 0 ? t("todayShort") : i === 1 ? t("tomorrow") : fmtDay(d.date, lang, {weekday: "short"});
    return `<button type="button" class="day" data-date="${d.date}" aria-pressed="${on}" ${off ? "disabled" : ""}>
      <span>${esc(lab)}</span><b>${parse(d.date).getDate()}</b><span>${esc(d.holiday ? t("holiday") : fmtDay(d.date, lang, {month: "short"}))}</span></button>`;
  }).join("");
  $("#hourshint").textContent = t("hoursHint", CFG.rules.lead_min, CFG.rules.window_days);
  $("#multi").checked = S.multi;
  $("#multihint").hidden = !S.multi;
  $("#multihint").textContent = t("multiHint", CFG.rules.days_max);
}
/* One day by default; with "Book several days" ticked, each tap adds or removes a day, up to the maximum. */
function setDates(list) { S.dates = [...new Set(list)].sort(); S.date = S.dates[0] || null; }
function pickDay(day) {
  if (!S.multi) setDates([day]);
  else if (S.dates.includes(day)) setDates(S.dates.filter(x => x !== day));
  else if (S.dates.length < CFG.rules.days_max) setDates([...S.dates, day]);
  renderDays(); changed({avail: true});
}
const dayList = () => S.dates.length === 1
  ? fmtDay(S.date, lang, {weekday: "long", day: "numeric", month: "long"})
  : S.dates.map(d => fmtDay(d, lang, {weekday: "short", day: "numeric", month: "short"})).join(", ");

function slotLabel(s) {
  if (s.days > 1) return s.time + " – " + (s.days_ok ? t("slotDays", s.days_ok, s.days) : t("slotFull"));
  return s.time + " – " + (s.free ? t("slotFree", s.free) : t("slotFull"));
}
function fillSelect(sel, data, chosen) {
  if (!S.date || (sel.id === "rettime" && !S.time)) {
    sel.innerHTML = `<option value="">${esc(t("chooseTime"))}</option>`; sel.disabled = true; return null;
  }
  if (!data) { sel.innerHTML = `<option value="">${esc(t("loadingTimes"))}</option>`; sel.disabled = true; return chosen; }
  const keep = data.slots.some(s => s.time === chosen) ? chosen : null;
  let anyFull = false;
  sel.innerHTML = `<option value="">${esc(t("chooseTime"))}</option>` + data.slots.map(s => {
    const full = s.days > 1 ? !s.days_ok : !s.free;
    anyFull = anyFull || full;
    return `<option value="${s.time}" ${keep === s.time ? "selected" : ""} ${full && keep !== s.time ? "disabled" : ""}>${esc(slotLabel(s))}</option>`;
  }).join("");
  sel.disabled = !data.slots.length;
  sel.dataset.full = anyFull ? "1" : "";
  return keep;
}
function renderTimes() {
  const t0 = S.time;
  S.time = fillSelect($("#time"), AV.out, S.time);
  S.return_time = S.ret ? fillSelect($("#rettime"), AV.ret, S.return_time) : S.return_time;
  $("#fullhint").hidden = $("#time").dataset.full !== "1";
  if (t0 !== S.time) loadPreview();
}

function renderNeeds() {
  $("#needs").innerHTML = NEEDS.map(n => `<button type="button" class="chip" data-need="${n}" aria-pressed="${S.needs.includes(n)}">${esc(t("need_" + n))}</button>`).join("");
}
function stepperState() {
  $("#adults").value = S.adults; $("#children").value = S.children;
  $$("[data-step]").forEach(b => {
    const k = b.dataset.step, d = +b.dataset.d;
    b.disabled = d < 0 ? S[k] <= 0 : S.adults + S.children >= CFG.rules.seats;
  });
}
function renderContact() {
  $("#phonebox").hidden = !!ME;
  $("#signedbox").hidden = !ME;
  if (ME) $("#signedbox").innerHTML = `<span>${esc(t("signedInAs"))}</span> <b>${esc(fmtPhone(ME.phone))}</b> <button type="button" class="linkish" data-act="signout">${esc(t("signOut"))}</button>`;
  $("#resbox").hidden = !outside();
  $("#name").value = S.name;
  renderVerify();
}
function renderVerify() {
  const v = $("#verify");
  v.hidden = !pending;
  $("#submit").hidden = !!pending;
  if (!pending) return;
  $("#codesent").textContent = t("codeSent", fmtPhone(pending.phone));
  const demo = $("#democode");
  demo.hidden = !pending.demo;
  if (pending.demo) demo.innerHTML = `${esc(t("demoCode"))} <b>${esc(pending.demo)}</b>`;
}

/* ---------- validation (the server checks everything again) ---------- */
function errors() {
  const E = {};
  for (const w of ["pickup", "dropoff"]) {
    const e = S[w];
    if (e.mode === "commune" && !e.street.trim()) E[w] = "errStreet";
    if (e.mode === "dest" && !e.dest) E[w] = w === "pickup" ? "errPick" : "errDrop";
  }
  if (!E.pickup && !E.dropoff) {
    if (S.pickup.mode === "dest" && S.dropoff.mode === "dest") E.dropoff = "errOutside";
    else if (placeName(S.pickup).toLowerCase() === placeName(S.dropoff).toLowerCase()) E.dropoff = "errSame";
  }
  if (!S.date) E.when = "errDay";
  else if (!S.time) E.when = "errTime";
  else if (S.ret && !S.return_time) E.when = "errRet";
  else if (PV && PV.ok && PV.rides === 0) E.when = "errFull";
  if (S.adults + S.children > CFG.rules.seats || S.adults + S.children < 1) E.who = "errSeats";
  else if (S.children > 0 && S.adults < 1) E.who = "errAdult";
  if (!S.name.trim()) E.me = "errName";
  else if (!ME && S.phone.replace(/\D/g, "").length < 8) E.me = "errPhone";
  else if (outside() && !S.resident) E.me = "errRes";
  if (PV && !PV.ok) for (const [k, v] of Object.entries(PV.errors)) if (!E[k]) E[k] = v;
  return {...E, ...SERVER};
}
function showErrors() {
  const E = errors();
  STEPS.forEach(k => {
    const li = $("#s-" + k);
    const bad = triedSubmit && !!E[k];
    li.classList.toggle("bad", bad);
    li.classList.toggle("done", !E[k] && !bad);
    const m = $("#" + k + "-err");
    if (m) m.textContent = triedSubmit && E[k] ? t(E[k]) : "";
  });
  $("#formerr").textContent = triedSubmit && Object.keys(E).length ? t("errFix") : "";
  return E;
}
function scrollToBad() {
  const first = $(".stop.bad");
  if (first) first.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
}

/* ---------- the ticket ---------- */
function renderTicket() {
  const from = placeName(S.pickup), to = placeName(S.dropoff);
  const has = from || to || S.date;
  const minutes = AV.out && AV.out.ride_minutes;
  const nRides = PV && PV.ok ? PV.rides : 0, nFail = PV && PV.ok ? PV.failed.length : 0;
  $("#ticket").innerHTML = `<h3>${esc(t("yourRide"))}<span>Ruffbus Mamer</span></h3>` + (!has ? `<p class="tempty">${esc(t("fillIn"))}</p>` : `
    <div class="leg"><i></i><p>${esc(from || "…")}<small>${S.pickup.mode === "dest" ? esc(t("listedDest")) : ""}</small></p>
    <span class="stem"></span><span></span><i class="end"></i><p>${esc(to || "…")}<small>${S.dropoff.mode === "dest" ? esc(t("listedDest")) : ""}</small></p></div>
    <div class="tear"></div>
    ${S.date ? `<div class="tline"><span>${esc(dayList())}</span></div>` : ""}
    <div class="tline"><span>${esc(t("pickupAt"))}</span><b class="big">${S.time || "--:--"}</b></div>
    ${from && to && minutes ? `<div class="tline"><span>${esc(t("estRide"))}</span><b>${esc(t("minN", minutes))}</b></div>` : ""}
    ${S.ret ? `<div class="tline"><span>${esc(t("returnAt"))}</span><b>${S.return_time || "--:--"}</b></div>` : ""}
    <div class="tline"><span>${esc(t("stopWho"))}</span><b>${esc(t("pax", S.adults, S.children))}</b></div>
    ${S.needs.length ? `<div class="tline"><span>${esc(t("colNeeds"))}</span><b>${S.needs.map(x => esc(t("need_" + x))).join(", ")}</b></div>` : ""}
    ${S.dates.length > 1 && nRides ? `<div class="tline"><span>${esc(t("inAll"))}</span><b>${esc(t("rides", nRides))}</b></div>` : ""}
    ${nFail ? `<p class="warn">${esc(t("wontFit", nFail))}</p>` : ""}
    <div class="tline"><span>${esc(t("price"))}</span><b>${esc(t("free"))}</b></div>`);
}

/* ---------- submitting: verify the phone once, then book ---------- */
function setBusy(on) {
  busy = on;
  $("#submit").disabled = on; $("#verifybtn").disabled = on; $("#bookrest").disabled = on;
  $("#submit").textContent = on ? t("sending") : t("submit");
}
async function submit(ev) {
  ev.preventDefault();
  if (busy) return;
  triedSubmit = true; SERVER = {};
  if (Object.keys(showErrors()).length) { scrollToBad(); return; }
  if (!ME) await sendCode(); else await book(false);
}
async function sendCode() {
  setBusy(true);
  try {
    const r = await api("/api/auth/code", {method: "POST", body: {phone: S.phone, lang}});
    pending = {phone: r.phone, demo: r.demo_code};
    $("#code").value = ""; $("#codeerr").textContent = "";
    renderVerify(); $("#code").focus();
  } catch (e) {
    if (e.error === "errPhone") { SERVER = {me: "errPhone"}; showErrors(); scrollToBad(); }
    else toast(errText(e), true);
  } finally { setBusy(false); }
}
async function verify() {
  const code = $("#code").value.replace(/\D/g, "");
  if (code.length !== 6) { $("#codeerr").textContent = t("errCode"); return; }
  setBusy(true);
  try {
    await api("/api/auth/verify", {method: "POST", body: {phone: pending.phone, code}});
    pending = null;
    await loadMe(); renderAcct(); renderContact();
  } catch (e) {
    $("#codeerr").textContent = errText(e);
    setBusy(false);
    return;
  }
  setBusy(false);
  await book(false);
}
async function book(acceptPartial) {
  setBusy(true);
  try {
    const res = await api("/api/bookings", {method: "POST", body: {...trip(), name: S.name.trim(), sms_updates: S.sms, accept_partial: acceptPartial, lang}});
    $("#ask").hidden = true;
    showDone(res);
  } catch (e) {
    if (e.error === "partial") {
      $("#asktext").textContent = t("partialAsk", e.failed.length, e.failed.length + e.rides);
      $("#ask").hidden = false;
    } else if (e.error === "invalid" && e.errors) { SERVER = e.errors; showErrors(); scrollToBad(); }
    else if (e.error === "errFull") { SERVER = {when: "errFull"}; showErrors(); loadAvail(); scrollToBad(); }
    else if (e.status === 401) { ME = null; renderAcct(); renderContact(); toast(t("login"), true); }
    else toast(errText(e), true);
  } finally { setBusy(false); }
}

function showDone(res) {
  const chip = (d, cls) => `<li class="${cls || ""}">${esc(fmtDay(d, lang, {weekday: "short", day: "numeric", month: "short"}))}</li>`;
  const outs = res.rides.filter(r => r.kind === "out"), rets = res.rides.filter(r => r.kind === "return");
  const first = (outs[0] || rets[0] || {}).time || "";
  const dates = [...new Set(res.rides.map(r => r.date))];
  const failDates = [...new Set(res.failed.map(f => f.date))];
  $("#v-done").innerHTML = `<div class="done"><div class="ticket pop"><h3>${esc(t("doneTitle"))}<span>${esc(t("ref"))} <b>${esc(res.ref)}</b></span></h3>
    <div class="leg"><i></i><p>${esc(placeName(S.pickup))}</p><span class="stem"></span><span></span><i class="end"></i><p>${esc(placeName(S.dropoff))}</p></div>
    <div class="tear"></div>
    <div class="tline"><span>${esc(t("pickupAt"))}</span><b class="big">${esc(first)}</b></div>
    ${rets.length ? `<div class="tline"><span>${esc(t("returnAt"))}</span><b>${esc(rets[0].time)}</b></div>` : ""}
    <div class="tline"><span>${esc(t("stopWho"))}</span><b>${esc(t("pax", S.adults, S.children))}</b></div>
    <div class="tline"><span>${esc(t("rides", res.rides.length))}</span><b></b></div>
    <ul class="dates">${dates.map(d => chip(d)).join("")}</ul>
    ${failDates.length ? `<p class="warn">${esc(t("notBooked"))}: ${failDates.map(d => esc(fmtDay(d, lang, {weekday: "short", day: "numeric", month: "short"}))).join(", ")}</p>` : ""}</div>
    <p>${esc(t("doneSub"))}</p>${CFG.demo ? `<p class="hint">${esc(t("doneDemo"))}</p>` : ""}
    <div class="btnrow"><button type="button" class="primary" data-act="again">${esc(t("bookAnother"))}</button><button type="button" class="ghost" data-tab="mine">${esc(t("seeMine"))}</button></div></div>`;
  $("#v-book").hidden = true; $("#v-done").hidden = false; window.scrollTo(0, 0);
}
function resetForm() {
  Object.assign(S, {dates: [], date: null, multi: false, time: null, ret: false, return_time: null, children: 0, needs: []});
  S.pickup.street = ""; S.dropoff.street = ""; triedSubmit = false; SERVER = {}; PV = null; AV = {out: null, ret: null};
  $("#ret").checked = false; $("#retbox").hidden = true; $("#ask").hidden = true;
  renderForm();
}

/* ---------- signing in (My rides, Your data) ---------- */
function loginBox(ctx, hintKey) {
  const st = login[ctx] || (login[ctx] = {phone: "", pending: null, err: ""});
  return `<div class="box" data-login="${ctx}"><h2>${esc(t("loginTitle"))}</h2><p class="hint" style="margin:0 0 .8rem">${esc(t(hintKey))}</p>
    <label class="lab" for="lp-${ctx}">${esc(t("phone"))}</label>
    <div class="coderow"><input type="tel" id="lp-${ctx}" data-lphone="${ctx}" value="${esc(st.phone)}" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="621 123 456" style="max-width:none;letter-spacing:0;font-size:1rem;font-weight:400;text-align:left;flex:1">
    <button type="button" class="ghost" data-lsend="${ctx}">${esc(t(st.pending ? "resend" : "sendCode"))}</button></div>
    ${CFG.demo ? `<p class="hint">${esc(t("demoNumber"))}</p>` : ""}
    ${st.pending ? `<div class="field"><p class="hint" style="margin:0 0 .4rem">${esc(t("codeSent", fmtPhone(st.pending.phone)))}</p>
      <label class="lab" for="lc-${ctx}">${esc(t("codeLabel"))}</label>
      <div class="coderow"><input type="text" id="lc-${ctx}" inputmode="numeric" autocomplete="one-time-code" maxlength="6"><button type="button" class="primary" data-lverify="${ctx}">${esc(t("verify"))}</button></div>
      ${st.pending.demo ? `<p class="democode">${esc(t("demoCode"))} <b>${esc(st.pending.demo)}</b></p>` : ""}</div>` : ""}
    <p class="errmsg">${esc(st.err)}</p></div>`;
}
async function loginSend(ctx) {
  const st = login[ctx];
  try {
    const r = await api("/api/auth/code", {method: "POST", body: {phone: st.phone, lang}});
    st.pending = {phone: r.phone, demo: r.demo_code}; st.err = "";
  } catch (e) { st.err = errText(e); }
  renderTab();
  const c = $("#lc-" + ctx); if (c) c.focus();
}
async function loginVerify(ctx) {
  const st = login[ctx], code = ($("#lc-" + ctx).value || "").replace(/\D/g, "");
  try {
    await api("/api/auth/verify", {method: "POST", body: {phone: st.pending.phone, code}});
    login[ctx] = null; await loadMe(); renderAcct(); renderContact();
  } catch (e) { st.err = errText(e); }
  renderTab();
}
async function loadMe() {
  try { ME = (await api("/api/session")).resident; } catch (e) { ME = null; }
  if (ME && ME.name && !S.name) S.name = ME.name;
}
async function signOut() {
  try { await api("/api/auth/logout", {method: "POST"}); } catch (e) { /* the cookie expires anyway */ }
  ME = null; pending = null; renderAcct(); renderContact(); renderTab();
}
function renderAcct() {
  $("#acct").innerHTML = ME ? `<span>${esc(t("signedInAs"))} <b>${esc(fmtPhone(ME.phone))}</b></span><button type="button" class="linkish" data-act="signout">${esc(t("signOut"))}</button>` : "";
}

/* ---------- my rides ---------- */
async function renderMine() {
  const box = $("#minelist");
  if (!ME) { box.innerHTML = loginBox("mine", "mineLogin"); return; }
  let rides;
  try { rides = (await api("/api/me/rides")).rides; }
  catch (e) { if (e.status === 401) { ME = null; renderAcct(); return renderMine(); } box.innerHTML = `<div class="empty">${esc(errText(e))}</div>`; return; }
  if (!rides.length) { box.innerHTML = `<div class="empty">${esc(t("mineEmpty"))}</div>`; return; }
  const active = r => r.status === "requested" || r.status === "confirmed";
  const sorted = [...rides.filter(r => !r.past), ...rides.filter(r => r.past).reverse()];
  box.innerHTML = sorted.map(r => `<div class="ride ${r.past ? "past" : ""}">
      <div class="when"><span class="muted">${esc(fmtDay(r.date, lang, {weekday: "short", day: "numeric", month: "short"}))}</span><b>${esc(r.time)}</b></div>
      <div><h3>${esc(r.from)} → ${esc(r.to)}</h3><p>${esc(t(r.kind === "out" ? "out" : "ret"))}, ${esc(t("pax", r.adults, r.children))}, ${esc(r.ref)} <span class="badge b-${r.status}">${esc(t("st_" + r.status))}</span></p></div>
      <div class="actions">${active(r) && !r.past ? `<button type="button" class="ghost" data-cancel="${r.id}">${esc(t("cancel"))}</button>` : ""}</div></div>`).join("");
}
async function cancelRide(id) {
  if (!confirm(t("cancelAsk"))) return;
  try { await api(`/api/me/rides/${id}/cancel`, {method: "POST"}); toast(t("cancelledMsg")); }
  catch (e) { toast(errText(e), true); }
  renderMine();
}

/* ---------- your data ---------- */
function renderPrivacy() {
  $("#privacybody").innerHTML = PRIVACY[lang]({retention: CFG.retention_days, sms: CFG.sms_retention_days, audit: CFG.audit_retention_days});
  $("#datatools").innerHTML = ME
    ? `<div class="datatools"><a class="ghost" href="/api/me/export" download>${esc(t("download"))}</a><button type="button" class="ghost danger" data-act="erase">${esc(t("erase"))}</button></div>`
    : loginBox("priv", "loginToManage");
}
async function eraseMe() {
  if (!confirm(t("eraseAsk"))) return;
  try { await api("/api/me", {method: "DELETE"}); ME = null; S.name = ""; toast(t("erased")); }
  catch (e) { toast(errText(e), true); }
  renderAcct(); renderContact(); renderTab();
}

/* ---------- navigation and language ---------- */
function go(name) {
  tab = name;
  $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
  ["book", "mine", "privacy", "about"].forEach(n => { $("#v-" + n).hidden = n !== name; });
  $("#v-done").hidden = true;
  const url = name === "book" ? "/" : name === "privacy" ? "/privacy" : "/#" + name;
  if (location.pathname + location.hash !== url) history.replaceState(null, "", url);
  renderTab();
}
function renderTab() {
  if (tab === "book") { renderTicket(); showErrors(); }
  if (tab === "mine") renderMine();
  if (tab === "privacy") renderPrivacy();
  if (tab === "about") $("#aboutbody").innerHTML = ABOUT[lang];
}
function renderForm() {
  renderEndpoints(); renderDays(); renderNeeds(); stepperState(); renderContact();
  renderTimes(); renderTicket(); showErrors();
}
function applyLang() {
  document.documentElement.lang = lang;
  document.title = "Ruffbus Mamer – " + t("tabBook") + " (" + t("demoTag").replace(".", "") + ")";
  $$("[data-i18n]").forEach(el => { const v = T[lang][el.dataset.i18n] ?? T.en[el.dataset.i18n]; if (typeof v === "string") el.textContent = v; });
  $("#bannerextra").textContent = CFG.demo ? " " + t("bannerDemo") + (CFG.demo_daily_reset ? " " + t("bannerReset") : "") : "";
  $$(".langs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  renderAcct(); renderForm();
  if ($("#v-done").hidden) go(tab); else renderTab();
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.lang) { lang = d.lang; setPref("rb-lang", lang); applyLang(); return; }
  if (d.tab) { go(d.tab); return; }
  if (d.mode) { S[d.end].mode = d.mode; renderEndpoints(); renderContact(); changed({avail: true}); return; }
  if (d.date) { pickDay(d.date); return; }
  if (d.need) { S.needs = S.needs.includes(d.need) ? S.needs.filter(x => x !== d.need) : [...S.needs, d.need]; renderNeeds(); changed(); return; }
  if (d.step) { S[d.step] = Math.max(0, S[d.step] + (+d.d)); stepperState(); changed(); return; }
  if (d.cancel) { cancelRide(+d.cancel); return; }
  if (d.lsend) { loginSend(d.lsend); return; }
  if (d.lverify) { loginVerify(d.lverify); return; }
  if (d.act === "signout") { signOut(); return; }
  if (d.act === "erase") { eraseMe(); return; }
  if (d.act === "again") { resetForm(); go("book"); return; }
  if (b.id === "verifybtn") { verify(); return; }
  if (b.id === "resend") { sendCode(); return; }
  if (b.id === "changenum") { pending = null; renderVerify(); $("#phone").focus(); return; }
  if (b.id === "bookrest") { book(true); return; }
  if (b.id === "changetimes") { $("#ask").hidden = true; $("#s-when").scrollIntoView({block: "start"}); return; }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.f === "street") { S[el.dataset.end].street = el.value; changed(); return; }
  if (el.dataset.lphone) { (login[el.dataset.lphone] ||= {phone: "", pending: null, err: ""}).phone = el.value; return; }
  if (el.id === "name") { S.name = el.value; changed({preview: false}); }
  if (el.id === "phone") { S.phone = el.value; if (pending) { pending = null; renderVerify(); } changed({preview: false}); }
  if (el.id === "code" && el.value.replace(/\D/g, "").length === 6 && !busy) verify();
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.f === "locality" || el.dataset.f === "dest") { S[el.dataset.end][el.dataset.f] = el.value; renderContact(); changed({avail: true}); return; }
  if (el.id === "time") { S.time = el.value || null; changed({avail: S.ret}); }
  else if (el.id === "rettime") { S.return_time = el.value || null; changed(); }
  else if (el.id === "ret") { S.ret = el.checked; $("#retbox").hidden = !el.checked; if (!el.checked) S.return_time = null; changed({avail: true}); }
  else if (el.id === "multi") {
    S.multi = el.checked;
    if (!S.multi && S.dates.length > 1) setDates(S.dates.slice(0, 1));   // back to one day: keep the first
    renderDays(); changed({avail: true});
  }
  else if (el.id === "sms") { S.sms = el.checked; }
  else if (el.id === "resident") { S.resident = el.checked; changed(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.lphone) { e.preventDefault(); loginSend(e.target.dataset.lphone); }
  if (e.key === "Enter" && e.target.id && e.target.id.startsWith("lc-")) { e.preventDefault(); loginVerify(e.target.id.slice(3)); }
  if (e.key === "Enter" && e.target.id === "code") { e.preventDefault(); verify(); }
});

/* ---------- start ---------- */
async function start() {
  const pref = getPref("rb-lang", "");
  lang = LANGS.includes(pref) ? pref : (LANGS.find(l => (navigator.language || "").toLowerCase().startsWith(l)) || "fr");
  try { CFG = await api("/api/config"); }
  catch (e) { $("#main").innerHTML = `<div class="empty">${esc(t(e.error === "network" ? "network" : "unavailable"))}</div>`; return; }
  loadedAt = Date.now();
  CFG.destinations.forEach(d => { DEST[d.id] = d; });
  await loadMe();
  const h = location.hash.slice(1);
  tab = location.pathname === "/privacy" ? "privacy" : (["mine", "privacy", "about"].includes(h) ? h : "book");
  $("#form").addEventListener("submit", submit);
  applyLang();
}
start();
})();
