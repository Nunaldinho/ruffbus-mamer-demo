/* Staff screen: call centre (dispatcher), commune (viewer, anonymous data only) and administrator. */
"use strict";
(() => {
const {$, $$, esc, parse, addDays, fmtDay, fmtPhone, hm, pct, api, debounce, toast, getPref, setPref, groupDests} = RB;
const TL0 = 510, TL1 = 1110, SPAN = TL1 - TL0;                  // timeline from 8:30 to 18:30
const RAMP = ["#EAF5F0", "#C3E6D6", "#8FCFB2", "#4FAE86", "#1C8A62", "#0A5E44"];  // one hue, light to dark
const NEEDS = ["seat", "stroller", "wheel", "bags"];
const REFRESH_MS = 20000;

let lang = "fr", CFG = null, ME = null, tab = "day", day = null, DAY = null, CHIPS = [], sel = null, loadedAt = 0;
let pb = null, pbSeq = 0;                                         // phone booking form

const t = (k, ...a) => { const v = TS[lang][k] ?? T[lang][k] ?? TS.en[k] ?? T.en[k]; return typeof v === "function" ? v(...a) : (v ?? k); };
const known = k => k && (TS.en[k] !== undefined || T.en[k] !== undefined);
const errText = e => t(known(e && e.error) ? e.error : "server");
const ops = () => !!ME && (ME.role === "admin" || ME.role === "dispatcher");
const isAdmin = () => !!ME && ME.role === "admin";
const ACTIVE = s => s === "requested" || s === "confirmed";
const nowMin = () => +CFG.now.slice(11, 13) * 60 + +CFG.now.slice(14, 16) + Math.floor((Date.now() - loadedAt) / 60000);
const dayLabel = d => {
  const i = Math.round((parse(d) - parse(CFG.today)) / 864e5);
  return i === 0 ? t("todayShort") : i === 1 ? t("tomorrow") : fmtDay(d, lang, {weekday: "short"});
};
const longDay = d => fmtDay(d, lang, {weekday: "long", day: "numeric", month: "long"});
const stamp = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + " " + iso.slice(11, 16);   // server sends Luxembourg time
const endpoint = e => e.mode === "commune" ? {mode: "commune", locality: e.locality, street: e.street.trim() || null} : {mode: "dest", dest: e.dest || null};

async function call(path, opt) {
  try { return await api(path, opt); }
  catch (e) { if (e.status === 401 && ME) { ME = null; renderAcct(); showLogin(); toast(t("login"), true); } throw e; }
}

/* ---------- sign-in ---------- */
async function showLogin() {
  ["day", "week", "sms", "audit", "data"].forEach(v => { $("#v-" + v).hidden = true; });
  $("#tabs").hidden = true; $("#v-login").hidden = false;
  let demo = [];
  if (CFG.demo) { try { demo = (await api("/api/staff/demo-accounts")).accounts; } catch (e) { /* not in demo mode */ } }
  $("#v-login").innerHTML = `<div class="loginwrap"><form class="card" id="loginform" novalidate><h1>${esc(t("loginTitle"))}</h1>
    <div class="field"><label class="lab" for="u">${esc(t("username"))}</label><input type="text" id="u" autocomplete="username" maxlength="60"></div>
    <div class="field"><label class="lab" for="p">${esc(t("password"))}</label><input type="password" id="p" autocomplete="current-password" maxlength="200"></div>
    <p class="errmsg" id="loginerr"></p>
    <div class="btnrow"><button class="primary" type="submit">${esc(t("signIn"))}</button></div>
    ${demo.length ? `<div class="demoacc"><b>${esc(t("demoAccounts"))}</b><table>${demo.map(a => `<tr>
      <td><b>${esc(t("role_" + a.role))}</b><br><span class="muted">${esc(t("roleNote_" + a.role))}</span></td>
      <td><code>${esc(a.username)}</code><br><code>${esc(a.password)}</code></td>
      <td><button type="button" class="mini" data-fill="${esc(a.username)}" data-pw="${esc(a.password)}">${esc(t("useAcc"))}</button></td></tr>`).join("")}</table></div>` : ""}
  </form></div>`;
}
async function doLogin(ev) {
  ev.preventDefault();
  try {
    ME = await api("/api/staff/login", {method: "POST", body: {username: $("#u").value.trim(), password: $("#p").value}});
    tab = "day"; day = CFG.today; sel = null;
    renderAcct(); buildDayShell(); go("day");
  } catch (e) { $("#loginerr").textContent = errText(e); }
}
async function logout() {
  try { await api("/api/staff/logout", {method: "POST"}); } catch (e) { /* session ends anyway */ }
  ME = null; pb = null; renderAcct(); showLogin();
}
function renderAcct() {
  $("#acct").innerHTML = ME ? `<b>${esc(ME.name)}</b><span class="rolechip ${ME.role}">${esc(t("role_" + ME.role))}</span><button type="button" class="linkish" data-act="logout">${esc(t("signOut"))}</button>` : "";
}

/* ---------- navigation ---------- */
function setTabs() {
  const list = [["day", "tDay"], ["week", "tWeek"]];
  if (ops()) list.push(["sms", "tSms"]);
  if (isAdmin()) list.push(["audit", "tAudit"], ["data", "tData"]);
  $("#tabs").innerHTML = list.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${esc(t(l))}</button>`).join("");
  $("#tabs").hidden = false;
}
function go(name) {
  tab = name;
  ["login", "day", "week", "sms", "audit", "data"].forEach(v => { $("#v-" + v).hidden = v !== name; });
  setTabs(); refresh();
}
async function refresh(quiet = false) {
  if (!ME) return;
  try {
    if (tab === "day") await loadDay();
    else if (tab === "week") await loadWeek();
    else if (tab === "sms") await loadSms();
    else if (tab === "audit") await loadAudit();
    else if (tab === "data") await loadData();
  } catch (e) { if (!quiet && e.status !== 401) toast(errText(e), true); }
}

/* ---------- day ---------- */
function buildDayShell() {
  $("#v-day").innerHTML = `
    <div class="toolbar"><h1 id="daytitle"></h1>${ops() ? `<button type="button" class="primary" id="newbooking">${esc(t("newBooking"))}</button>` : ""}</div>
    ${ME.role === "viewer" ? `<p class="privnote">${esc(t("viewerNote"))}</p>` : ""}
    <div class="panel" id="phonepanel" hidden></div>
    <div class="days dchips" id="ddays" role="group"></div>
    <div class="kpis" id="kpis"></div>
    <div class="panel"><div class="phead"><div><h2>${esc(t("timeline"))}</h2><p class="hint">${esc(t("refreshed"))}</p></div><div class="svc" id="svc"></div></div>
      <div class="tlkey"><span><i style="background:var(--green)"></i>${esc(t("keyConfirmed"))}</span><span><i style="background:var(--ticket)"></i>${esc(t("keyRequested"))}</span><span><i style="background:var(--err)"></i>${esc(t("waitRow"))}</span></div>
      <div class="tl" id="tl"></div><div class="detail" id="detail" aria-live="polite"></div></div>
    <div class="panel"><div class="phead"><h2>${esc(t("ridesDay"))}</h2><span id="csvbox"></span></div><div class="tblwrap"><table class="data" id="dtable"></table></div></div>
    <p class="hint note">${esc(t("usageNote"))}</p>`;
  if (pb) { renderPhone(); $("#phonepanel").hidden = false; }
}
async function loadDay() {
  const [d, w] = await Promise.all([call(`/api/staff/day?date=${day}`), call(`/api/staff/week?start=${addDays(CFG.today, -1)}&days=9`)]);
  DAY = d; CHIPS = w.days;
  if (sel && !DAY.rides.some(r => r.id === sel)) sel = null;
  renderDay();
}
function renderDay() {
  const st = DAY.stats;
  $("#daytitle").textContent = longDay(day);
  $("#ddays").innerHTML = CHIPS.map(c => `<button type="button" class="day" data-day="${c.date}" aria-pressed="${c.date === day}">
    <span>${esc(dayLabel(c.date))}</span><b>${parse(c.date).getDate()}</b><span>${esc(c.holiday ? t("holiday") : pct(c.use))}</span>
    <i class="ubar"><i style="width:${Math.round((c.use || 0) * 100)}%"></i></i></button>`).join("");
  const peak = st.peak && st.peak.use > 0 ? st.peak : null;
  $("#kpis").innerHTML = [
    [t("kpiRides"), st.rides], [t("kpiPax"), st.passengers], [t("kpiUse"), pct(st.use)],
    [t("kpiAway"), st.turned_away],
    [peak ? `${t("kpiPeak")}, ${pct(peak.use)}` : t("kpiPeak"), peak ? `${peak.hour}h–${peak.hour + 1}h` : "–"],
    [t("kpiWait"), st.waiting, st.waiting > 0],
  ].map(([l, v, alert]) => `<div class="kpi ${alert ? "alert" : ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
  $("#svc").innerHTML = st.buses.map(b => `<button type="button" class="chip svc" ${ops() ? `data-svc="${b.id}"` : "disabled"} aria-pressed="${b.in_service}">${esc(b.label)}, ${esc(t(b.in_service ? "inService" : "outService"))}</button>`).join("")
    + (ops() ? `<p class="hint">${esc(t("serviceHint"))}</p>` : "");
  $("#csvbox").innerHTML = ops() ? `<a class="ghost" href="/api/staff/day.csv?date=${day}" download>${esc(t("exportCsv"))}</a>` : "";
  renderTimeline(); renderDetail(); renderTable();
}
function tip(r) {
  return DAY.personal ? `${r.time}, ${r.name}, ${r.from} → ${r.to}, ${t("pax", r.adults, r.children)}`
                      : `${r.time}, ${r.from_area} → ${r.to_area}, ${r.passengers}`;
}
function renderTimeline() {
  const L = m => ((Math.max(TL0, Math.min(TL1, m)) - TL0) / SPAN * 100).toFixed(3) + "%";
  const W = (s, e) => ((Math.min(e, TL1) - Math.max(s, TL0)) / SPAN * 100).toFixed(3) + "%";
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const grid = hours.map(h => `<span class="grid" style="left:${L(h * 60)}"></span>`).join("");
  const now = day === CFG.today && nowMin() > TL0 && nowMin() < TL1 ? `<span class="now" style="left:${L(nowMin())}" title="${esc(t("nowLine"))}"></span>` : "";
  const block = (r, lane) => `<button type="button" class="blk ${r.status} ${sel === r.id ? "sel" : ""}" data-ride="${r.id}" style="left:${L(r.start_min)};width:${W(r.start_min, r.end_min)};top:${7 + lane * 38}px" title="${esc(tip(r))}" aria-label="${esc(tip(r))}">${esc(r.time)}</button>`;
  const row = (head, items, cls) => {
    const ends = [];
    const placed = items.map(r => { let l = ends.findIndex(e => e <= r.start_min); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = r.end_min; return [r, l]; });
    return `<div class="tlrow ${cls}"><div class="tlh">${head}</div><div class="tlt" style="height:${Math.max(1, ends.length) * 38 + 8}px">${grid}${now}${placed.map(([r, l]) => block(r, l)).join("")}</div></div>`;
  };
  const act = DAY.rides.filter(r => ACTIVE(r.status));
  const waiting = act.filter(r => !r.bus);
  $("#tl").innerHTML = `<div class="tlrow head"><div class="tlh"></div><div class="tlt hours" style="height:24px">${hours.map(h => `<span style="left:${L(h * 60)}">${h}h</span>`).join("")}</div></div>`
    + DAY.stats.buses.map(b => row(`<b>${esc(b.label)}</b><small>${esc(b.in_service ? pct(b.use) : t("outService"))}</small>`, act.filter(r => r.bus === b.id), b.in_service ? "" : "off")).join("")
    + (waiting.length ? row(`<b>${esc(t("waitRow"))}</b><small>${waiting.length}</small>${ops() ? `<button type="button" class="mini ok" data-act="autoassign">${esc(t("autoAssign"))}</button>` : ""}`, waiting, "wait") : "");
}
function freeBusesFor(r) {
  return DAY.stats.buses.filter(b => b.in_service && b.id !== r.bus && !DAY.rides.some(q =>
    q.id !== r.id && ACTIVE(q.status) && q.bus === b.id && q.start_min < r.end_min && r.start_min < q.end_min)).map(b => b.id);
}
function renderDetail() {
  const box = $("#detail");
  const r = sel && DAY.rides.find(x => x.id === sel);
  if (!r) { box.innerHTML = `<p class="muted" style="margin:0">${esc(t("pickTrip"))}</p>`; return; }
  const rows = DAY.personal
    ? [[t("colFrom"), r.from], [t("colTo"), r.to], [t("colPax"), t("pax", r.adults, r.children)],
       [t("colNeeds"), r.needs.map(n => t("need_" + n)).join(", ") || "–"], [t("colPhone"), fmtPhone(r.phone) || "–"],
       [t("colRef"), `${r.ref}, ${t("ch_" + r.channel)}`]]
    : [[t("colFrom"), r.from_area], [t("colTo"), r.to_area], [t("colPax"), String(r.passengers)], [t("colChannel"), t("ch_" + r.channel)]];
  rows.push([t("estRide"), `${t("minN", r.ride_minutes)} (${hm(r.start_min)}–${hm(r.end_min)})`], [t("colBus"), r.bus ? "Bus " + r.bus : t("waitRow")]);
  let actions = "";
  if (ops() && ACTIVE(r.status)) {
    const free = freeBusesFor(r);
    actions = `<div class="dact">${r.status === "requested"
        ? `<button type="button" class="mini ok" data-status="confirmed" ${r.bus ? "" : "disabled"}>${esc(t("confirm"))}</button><button type="button" class="mini no" data-status="declined">${esc(t("decline"))}</button>`
        : `<button type="button" class="mini no" data-status="cancelled">${esc(t("cancel"))}</button>`}
      <label>${esc(t("moveTo"))} <select id="movebus">${free.length ? `<option value=""></option>` + free.map(b => `<option value="${b}">Bus ${b}</option>`).join("") : `<option value="">${esc(t("noBusFree"))}</option>`}</select></label></div>`;
  }
  box.innerHTML = `<div class="dtop"><h3>${esc(r.time)}, ${esc(DAY.personal ? r.name : t(r.kind === "out" ? "out" : "ret"))} <span class="badge b-${r.status}">${esc(t("st_" + r.status))}</span></h3><button type="button" class="ghost" data-act="closedetail">${esc(t("close"))}</button></div>
    <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${DAY.personal ? "" : `<p class="hint" style="margin:0 0 .6rem">${esc(t("anon"))}</p>`}${actions}`;
}
function renderTable() {
  const rs = DAY.rides, p = DAY.personal;
  if (!rs.length) { $("#dtable").innerHTML = `<tbody><tr><td class="muted">${esc(DAY.stats.holiday ? t("holidayNote") : t("dispEmpty"))}</td></tr></tbody>`; return; }
  const head = p ? ["colTime", "colBus", "colName", "colFrom", "colTo", "colPax", "colNeeds", "colStatus"] : ["colTime", "colBus", "colFrom", "colTo", "colPax", "colStatus"];
  $("#dtable").innerHTML = `<thead><tr>${head.map(h => `<th>${esc(t(h))}</th>`).join("")}</tr></thead><tbody>` + rs.map(r => {
    const cells = p
      ? [r.bus || "–", `${esc(r.name)}<br><span class="chan">${esc(t("ch_" + r.channel))}, ${esc(r.ref)}</span>`, esc(r.from), esc(r.to), r.passengers, esc(r.needs.map(n => t("need_" + n)).join(", ") || "–")]
      : [r.bus || "–", esc(r.from_area), esc(r.to_area), r.passengers];
    const status = `<span class="badge b-${r.status}">${esc(t("st_" + r.status))}</span>${ACTIVE(r.status) && !r.bus ? ` <span class="badge b-wait">${esc(t("waitRow"))}</span>` : ""}`;
    return `<tr class="${sel === r.id ? "selrow" : ""} ${ACTIVE(r.status) ? "" : "gone"}"><td class="t"><button type="button" class="linkish" data-ride="${r.id}">${esc(r.time)}</button></td>${cells.map(c => `<td>${c}</td>`).join("")}<td>${status}</td></tr>`;
  }).join("") + "</tbody>";
}
async function act(fn, okMsg) {
  try { const r = await fn(); toast(typeof okMsg === "function" ? okMsg(r) : okMsg); }
  catch (e) { if (e.status !== 401) toast(errText(e), true); }
  await refresh(true);
}
function setStatus(status) {
  if (status === "declined" && !confirm(t("declineAsk"))) return;
  if (status === "cancelled" && !confirm(t("cancelAsk"))) return;
  act(() => call(`/api/staff/rides/${sel}/status`, {method: "POST", body: {status}}), t("saved"));
}
function toggleService(busId) {
  const b = DAY.stats.buses.find(x => x.id === busId);
  if (b.in_service) {
    if (!confirm(t("outAsk", b.label, longDay(day)))) return;
    act(() => call(`/api/staff/buses/${busId}/out-of-service`, {method: "POST", body: {date: day}}), r => t("outDone", r.rides_unassigned));
  } else act(() => call(`/api/staff/buses/${busId}/in-service`, {method: "POST", body: {date: day}}), t("saved"));
}

/* ---------- phone booking ---------- */
function openPhone() {
  const bookable = CFG.days.filter(d => !d.holiday).map(d => d.date);
  pb = {pickup: {mode: "commune", locality: "Mamer", street: "", dest: ""}, dropoff: {mode: "dest", locality: "Mamer", street: "", dest: ""},
        date: bookable.includes(day) ? day : bookable[0], time: null, return_time: null, adults: 1, children: 0, needs: [],
        name: "", phone: "", lang: "fr", resident: true, sms: true, av: null, avr: null};
  renderPhone(); $("#phonepanel").hidden = false; $("#pb-name").focus();
}
function pbEndpoint(which) {
  const e = pb[which];
  const opts = groupDests(CFG.destinations).map(([c, list]) => `<optgroup label="${esc(c)}">${list.map(d => `<option value="${d.id}" ${e.dest === d.id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</optgroup>`).join("");
  return `<div class="seg" role="group"><button type="button" data-pbmode="commune" data-end="${which}" aria-pressed="${e.mode === "commune"}">${esc(t("inCommune"))}</button><button type="button" data-pbmode="dest" data-end="${which}" aria-pressed="${e.mode === "dest"}">${esc(t("listedDest"))}</button></div>
  ${e.mode === "commune"
    ? `<div class="row2"><div><label class="lab" for="pb-${which}-loc">${esc(t("locality"))}</label><select id="pb-${which}-loc" data-pb="locality" data-end="${which}">${CFG.localities.map(l => `<option ${e.locality === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
       <div><label class="lab" for="pb-${which}-street">${esc(t("street"))}</label><input type="text" id="pb-${which}-street" data-pb="street" data-end="${which}" value="${esc(e.street)}" maxlength="120" autocomplete="off"></div></div>`
    : `<label class="lab" for="pb-${which}-dest">${esc(t("destination"))}</label><select id="pb-${which}-dest" data-pb="dest" data-end="${which}"><option value="">${esc(t("chooseDest"))}</option>${opts}</select>`}`;
}
function renderPhone() {
  const days = CFG.days.filter(d => !d.holiday);
  const num = (id, max, v) => `<select id="${id}">${Array.from({length: max + 1}, (_, n) => `<option ${n === v ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  $("#phonepanel").innerHTML = `<div class="phead"><div><h2>${esc(t("newBooking"))}</h2><p class="hint">${esc(t("newBookingSub"))}</p></div><button type="button" class="ghost" data-act="closephone">${esc(t("close"))}</button></div>
  <form class="phoneform" id="pbform" novalidate>
    <div class="grid2">
      <fieldset><legend>${esc(t("fPickup"))}</legend><div id="pb-pickup">${pbEndpoint("pickup")}</div></fieldset>
      <fieldset><legend>${esc(t("fDropoff"))}</legend><div id="pb-dropoff">${pbEndpoint("dropoff")}</div></fieldset>
    </div>
    <div class="grid3" style="margin-top:.8rem">
      <fieldset><legend>${esc(t("fWhen"))}</legend>
        <label class="lab" for="pb-date">${esc(t("date"))}</label><select id="pb-date">${days.map(d => `<option value="${d.date}" ${pb.date === d.date ? "selected" : ""}>${esc(fmtDay(d.date, lang, {weekday: "short", day: "numeric", month: "short"}))}</option>`).join("")}</select>
        <div class="field"><label class="lab" for="pb-time">${esc(t("time"))}</label><select id="pb-time"></select></div>
        <div class="field"><label class="lab" for="pb-ret">${esc(t("returnOpt"))}</label><select id="pb-ret"></select></div>
      </fieldset>
      <fieldset><legend>${esc(t("stopWho"))}</legend>
        <div class="row2" style="grid-template-columns:1fr 1fr"><div><label class="lab" for="pb-adults">${esc(t("adults"))}</label>${num("pb-adults", 8, pb.adults)}</div>
          <div><label class="lab" for="pb-children">${esc(t("childrenShort"))}</label>${num("pb-children", 7, pb.children)}</div></div>
        <div class="field"><span class="lab">${esc(t("colNeeds"))}</span>${NEEDS.map(n => `<label class="check"><input type="checkbox" data-pbneed="${n}" ${pb.needs.includes(n) ? "checked" : ""}><span>${esc(t("need_" + n))}</span></label>`).join("")}</div>
      </fieldset>
      <fieldset><legend>${esc(t("fWho"))}</legend>
        <label class="lab" for="pb-name">${esc(t("name"))}</label><input type="text" id="pb-name" value="${esc(pb.name)}" maxlength="80" autocomplete="off">
        <div class="field"><label class="lab" for="pb-phone">${esc(t("phone"))}</label><input type="tel" id="pb-phone" value="${esc(pb.phone)}" maxlength="24" autocomplete="off"></div>
        <div class="field"><label class="lab" for="pb-lang">${esc(t("lang"))}</label><select id="pb-lang">${[["fr", "Français"], ["de", "Deutsch"], ["en", "English"], ["pt", "Português"]].map(([v, l]) => `<option value="${v}" ${pb.lang === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <label class="check"><input type="checkbox" id="pb-resident" ${pb.resident ? "checked" : ""}><span>${esc(t("pbResident"))}</span></label>
        <label class="check"><input type="checkbox" id="pb-sms" ${pb.sms ? "checked" : ""}><span>${esc(t("smsPassenger"))}</span></label>
      </fieldset>
    </div>
    <p class="errmsg" id="pb-err"></p>
    <div class="btnrow"><button class="primary" type="submit" id="pb-save">${esc(t("saveBooking"))}</button></div>
  </form>`;
  renderPbTimes(); pbAvail();
}
function pbTrip() {
  return {pickup: endpoint(pb.pickup), dropoff: endpoint(pb.dropoff), date: pb.date, time: pb.time, return_time: pb.return_time,
          repeat_weekdays: [], repeat_weeks: 1, adults: pb.adults, children: pb.children, needs: pb.needs, resident_declared: pb.resident};
}
function renderPbTimes() {
  const opt = (s, chosen) => `<option value="${s.time}" ${chosen === s.time ? "selected" : ""} ${!s.free && chosen !== s.time ? "disabled" : ""}>${esc(s.time + " – " + (s.free ? t("slotFree", s.free) : t("slotFull")))}</option>`;
  $("#pb-time").innerHTML = pb.av ? `<option value="">${esc(t("chooseTime"))}</option>` + pb.av.slots.map(s => opt(s, pb.time)).join("") : `<option value="">${esc(t("loadingTimes"))}</option>`;
  $("#pb-ret").innerHTML = `<option value="">${esc(t("none"))}</option>` + (pb.avr ? pb.avr.slots.map(s => opt(s, pb.return_time)).join("") : "");
  $("#pb-ret").disabled = !pb.time;
}
const pbAvail = debounce(async () => {
  if (!pb) return;
  const seq = ++pbSeq, base = pbTrip();
  try {
    const av = await call("/api/availability", {method: "POST", body: {...base, kind: "out"}});
    const avr = pb.time ? await call("/api/availability", {method: "POST", body: {...base, kind: "return"}}) : null;
    if (!pb || seq !== pbSeq) return;
    pb.av = av; pb.avr = avr;
    if (pb.time && !av.slots.some(s => s.time === pb.time)) pb.time = null;
    if (pb.return_time && !(avr && avr.slots.some(s => s.time === pb.return_time))) pb.return_time = null;
    renderPbTimes();
  } catch (e) { if (e.status !== 401) toast(errText(e), true); }
}, 150);
async function savePhone(ev) {
  ev.preventDefault();
  const btn = $("#pb-save"); btn.disabled = true;
  try {
    const r = await call("/api/staff/bookings", {method: "POST", body: {...pbTrip(), name: pb.name, phone: pb.phone, sms_updates: pb.sms, accept_partial: true, lang: pb.lang}});
    toast(r.failed.length ? t("partialBooked", r.ref, r.failed.length) : t("booked", r.ref));
    day = pb.date; sel = r.rides.length ? r.rides[0].ride_id : null; pb = null;
    $("#phonepanel").hidden = true;
    await refresh();
  } catch (e) {
    $("#pb-err").textContent = e.error === "invalid" && e.errors ? Object.values(e.errors).map(k => t(k)).join(" ") : errText(e);
    if (e.error === "errFull") pbAvail();
  } finally { if (btn.isConnected) btn.disabled = false; }
}

/* ---------- week ---------- */
async function loadWeek() {
  const w = await call(`/api/staff/week?start=${CFG.today}&days=8`);
  const H = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  const step = x => Math.min(RAMP.length - 1, Math.floor((x || 0) * RAMP.length));
  const rows = w.days.map(d => {
    const lab = esc(dayLabel(d.date) + " " + parse(d.date).getDate());
    if (d.holiday) return `<tr><th scope="row">${lab}</th><td colspan="${H.length + 2}" class="muted">${esc(t("holidayNote"))}</td></tr>`;
    const cells = d.hourly.map(c => `<td class="hc" style="background:${RAMP[step(c.use)]};color:${step(c.use) >= 4 ? "#fff" : "var(--ink)"}" title="${lab}, ${c.hour}h–${c.hour + 1}h: ${pct(c.use)}">${Math.round(c.use * 100)}</td>`).join("");
    return `<tr><th scope="row"><button type="button" class="linkish" data-gotoday="${d.date}">${lab}</button></th>${cells}<td><b>${pct(d.use)}</b></td><td>${d.turned_away}</td></tr>`;
  }).join("");
  $("#v-week").innerHTML = `<div class="toolbar"><h1>${esc(t("weekTitle"))}</h1></div>
    <div class="panel"><div class="phead"><p class="hint" style="margin:0">${esc(t("weekSub"))}</p>
      <div class="legend"><span>0 %</span>${RAMP.map(c => `<i style="background:${c}"></i>`).join("")}<span>100 %</span></div></div>
      <div class="tblwrap"><table class="data heat"><thead><tr><th>${esc(t("colDay"))}</th>${H.map(h => `<th>${h}h</th>`).join("")}<th>${esc(t("colAll"))}</th><th>${esc(t("colAway"))}</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="panel"><div class="phead"><h2>${esc(t("perBus"))}</h2></div><div class="perbus">${w.buses.map(b => `<div class="pb"><span>${esc(b.label)}</span><div class="pbbar"><i style="width:${Math.round((b.use || 0) * 100)}%"></i></div><b>${pct(b.use)}</b></div>`).join("")}</div></div>
    <p class="hint note">${esc(t("usageNote"))}</p>`;
}

/* ---------- text messages, audit log, data protection ---------- */
async function loadSms() {
  const r = await call("/api/staff/sms");
  $("#v-sms").innerHTML = `<div class="toolbar"><h1>${esc(t("smsTitle"))}</h1></div><p class="hint note" style="margin:0 0 1rem">${esc(t("smsSub"))}</p>
    <div class="panel"><div class="tblwrap"><table class="data"><thead><tr><th>${esc(t("colWhen"))}</th><th>${esc(t("colTo2"))}</th><th>${esc(t("colPurpose"))}</th><th>${esc(t("colText"))}</th></tr></thead>
    <tbody>${r.messages.map(m => `<tr><td class="t">${esc(stamp(m.at))}</td><td>${esc(m.to)}</td><td>${esc(t("p_" + m.purpose))}</td><td>${esc(m.body)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">–</td></tr>`}</tbody></table></div></div>`;
}
async function loadAudit() {
  const r = await call("/api/staff/audit");
  const who = e => e.actor_type === "staff" ? e.actor_name : e.actor_type === "resident" ? t("who_resident", e.actor_id) : (e.actor_name || t("who_system"));
  const detail = d => Object.entries(d || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
  $("#v-audit").innerHTML = `<div class="toolbar"><h1>${esc(t("auditTitle"))}</h1></div><p class="hint note" style="margin:0 0 1rem">${esc(t("auditSub"))}</p>
    <div class="panel"><div class="tblwrap"><table class="data"><thead><tr><th>${esc(t("colWhen"))}</th><th>${esc(t("colWho"))}</th><th>${esc(t("colAction"))}</th><th>${esc(t("colObject"))}</th><th>${esc(t("colDetail"))}</th></tr></thead>
    <tbody>${r.entries.map(e => `<tr><td class="t">${esc(stamp(e.at))}</td><td>${esc(who(e))}</td><td><b>${esc(e.action)}</b></td><td>${esc(e.entity ? e.entity + (e.entity_id ? " #" + e.entity_id : "") : "–")}</td><td><span class="muted">${esc(detail(e.detail))}</span></td></tr>`).join("")}</tbody></table></div></div>`;
}
async function loadData() {
  const o = await call("/api/staff/privacy");
  const keys = ["bookings_with_personal_data", "due_for_anonymisation", "bookings_anonymised", "bookings_with_needs", "accounts", "messages_kept", "audit_entries", "oldest_personal_data"];
  const val = k => k === "oldest_personal_data" ? (o[k] ? fmtDay(o[k].slice(0, 10), lang, {day: "numeric", month: "short", year: "numeric"}) : "–") : o[k];
  $("#v-data").innerHTML = `<div class="toolbar"><h1>${esc(t("dataTitle"))}</h1><button type="button" class="primary" data-act="retention">${esc(t("runRetention"))}</button></div>
    <p class="hint note" style="margin:0 0 1rem">${esc(t("dataSub"))}</p>
    <div class="stats">${keys.map(k => `<div class="kpi ${k === "due_for_anonymisation" && o[k] ? "alert" : ""}"><b>${esc(val(k))}</b><span>${esc(t("d_" + k))}</span></div>`).join("")}</div>
    <div class="panel"><div class="phead"><h2>${esc(t("retTitle"))}</h2></div><ul style="margin:0;padding:0 1rem 1rem 2.2rem">
      <li>${esc(t("ret_bookings", o.retention_days))}</li><li>${esc(t("ret_sms", o.sms_retention_days))}</li><li>${esc(t("ret_audit", o.audit_retention_days))}</li><li>${esc(t("ret_codes"))}</li></ul></div>
    <div class="panel"><div class="phead"><h2>${esc(t("rolesTitle"))}</h2></div><p style="margin:0;padding:0 1rem 1rem;max-width:80ch">${esc(t("rolesBody"))}</p></div>`;
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.lang) { lang = d.lang; setPref("rb-staff-lang", lang); applyLang(); return; }
  if (d.tab) { go(d.tab); return; }
  if (d.fill) { $("#u").value = d.fill; $("#p").value = d.pw; $("#loginform").requestSubmit(); return; }
  if (d.day) { day = d.day; sel = null; refresh(); return; }
  if (d.gotoday) { day = d.gotoday; sel = null; go("day"); return; }
  if (d.ride) {
    sel = +d.ride; renderTimeline(); renderDetail(); renderTable();
    const box = $("#detail").getBoundingClientRect();
    if (box.top > innerHeight || box.bottom < 0) $("#detail").scrollIntoView({block: "nearest"});
    return;
  }
  if (d.status) { setStatus(d.status); return; }
  if (d.svc) { toggleService(+d.svc); return; }
  if (d.pbmode) { pb[d.end].mode = d.pbmode; $("#pb-" + d.end).innerHTML = pbEndpoint(d.end); pbAvail(); return; }
  if (d.act === "logout") { logout(); return; }
  if (d.act === "closedetail") { sel = null; renderTimeline(); renderDetail(); renderTable(); return; }
  if (d.act === "autoassign") { act(() => call("/api/staff/auto-assign", {method: "POST", body: {date: day}}), r => t("assigned", r.assigned, r.waiting)); return; }
  if (d.act === "closephone") { pb = null; $("#phonepanel").hidden = true; return; }
  if (d.act === "retention") { act(() => call("/api/staff/privacy/retention", {method: "POST"}), r => t("ranRetention", r)); return; }
  if (b.id === "newbooking") { if (pb) $("#phonepanel").scrollIntoView({block: "start"}); else openPhone(); return; }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.id === "movebus" && el.value) { act(() => call(`/api/staff/rides/${sel}/bus`, {method: "POST", body: {bus_id: +el.value}}), t("saved")); return; }
  if (!pb) return;
  if (el.dataset.pb === "locality" || el.dataset.pb === "dest") { pb[el.dataset.end][el.dataset.pb] = el.value; pbAvail(); }
  else if (el.id === "pb-date") { pb.date = el.value; pb.time = null; pb.return_time = null; pb.av = null; pb.avr = null; renderPbTimes(); pbAvail(); }
  else if (el.id === "pb-time") { pb.time = el.value || null; pb.return_time = null; pb.avr = null; renderPbTimes(); pbAvail(); }
  else if (el.id === "pb-ret") { pb.return_time = el.value || null; }
  else if (el.id === "pb-adults" || el.id === "pb-children") { pb[el.id.slice(3)] = +el.value; }
  else if (el.dataset.pbneed) { const n = el.dataset.pbneed; pb.needs = el.checked ? [...pb.needs, n] : pb.needs.filter(x => x !== n); }
  else if (el.id === "pb-lang") { pb.lang = el.value; }
  else if (el.id === "pb-resident") { pb.resident = el.checked; }
  else if (el.id === "pb-sms") { pb.sms = el.checked; }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (!pb) return;
  if (el.dataset.pb === "street") pb[el.dataset.end].street = el.value;
  else if (el.id === "pb-name") pb.name = el.value;
  else if (el.id === "pb-phone") pb.phone = el.value;
});
document.addEventListener("submit", e => {
  if (e.target.id === "loginform") doLogin(e);
  if (e.target.id === "pbform") savePhone(e);
});

/* ---------- start ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.title = "Ruffbus Mamer – " + t("appTitle") + " (" + t("demoTag").replace(".", "") + ")";
  $("#apptitle").textContent = t("appTitle");
  $("#demotag").textContent = t("demoTag");
  $("#bannertext").textContent = t("banner") + (CFG.demo ? " " + t("bannerDemo") + (CFG.demo_daily_reset ? " " + t("bannerReset") : "") : "");
  $$(".langs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  $("#foot").innerHTML = `${esc(t("footer"))} <a href="/">${esc(t("bookingPage"))}</a>`;
  renderAcct();
  if (ME) { buildDayShell(); go(tab); } else showLogin();
}
async function start() {
  const pref = getPref("rb-staff-lang", "");
  lang = ["fr", "en"].includes(pref) ? pref : "fr";
  try { CFG = await api("/api/config"); }
  catch (e) { $("#main").innerHTML = `<div class="empty">${esc(t("unavailable"))}</div>`; return; }
  loadedAt = Date.now(); day = CFG.today;
  try { ME = (await api("/api/staff/session")).staff; } catch (e) { ME = null; }
  applyLang();
  setInterval(() => { if (document.visibilityState === "visible" && ME && !pb && (tab === "day" || tab === "week")) refresh(true); }, REFRESH_MS);
}
start();
})();
