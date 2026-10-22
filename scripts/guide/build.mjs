#!/usr/bin/env node
// The guide (SMART_PLAN step 11): every screen, everything that can happen on
// it, and step-by-step tasks for each role, as one searchable page.
//
//   node scripts/guide/build.mjs            # → $GUIDE_OUT (default /tmp/sixties-guide/out)
//
// Reads docs/guide/src/screens/*.json (the screen reference, written from the
// code; docs/guide/src/BRIEF.md), docs/guide/src/tasks.json (the tasks) and the
// pictures in $GUIDE_OUT/shots (scripts/guide/shots.mjs). The page filters by
// role (#owner, #cashier…); scripts/guide/pdf.mjs prints one PDF per role.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pageName } from "./shot-list.mjs";
import { ROLES } from "./roles.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SRC = join(ROOT, "docs", "guide", "src");
const OUT = process.env.GUIDE_OUT || "/tmp/sixties-guide/out";
mkdirSync(join(OUT, "shots"), { recursive: true });


const ROLE_KEYS = ROLES.map((r) => r[0]);
const ALIAS = {
  gm: "general_manager", "general manager": "general_manager", generalmanager: "general_manager",
  manager: "branch_manager", "branch manager": "branch_manager", branchmanager: "branch_manager",
  counter: "inventory_counter", "inventory counter": "inventory_counter", inventorycounter: "inventory_counter",
  buyer: "purchasing", purchaser: "purchasing",
};
function roleKey(r) {
  const k = String(r || "").trim().toLowerCase().replace(/[-]/g, "_");
  if (ROLE_KEYS.includes(k)) return k;
  return ALIAS[k.replace(/_/g, " ")] || ALIAS[k] || null;
}
function rolesOf(entry) {
  const out = new Set();
  for (const w of entry.who || []) {
    const raw = String(w.role || "");
    // A row saying who cannot open the screen does not give it to them.
    if (/^\s*(nothing|none|no access|not this screen|cannot open|they cannot|—|-)?\s*$/i.test(String(w.can ?? "")) ||
        /^\s*(nothing|none|no access|cannot|not shown|sent (away|to))/i.test(String(w.can ?? ""))) continue;
    if (/every|anyone|all roles|all signed/i.test(raw)) ROLE_KEYS.forEach((k) => out.add(k));
    for (const part of raw.split(/[,/&]| and /)) {
      const k = roleKey(part);
      if (k) out.add(k);
    }
  }
  return out.size ? [...out] : ROLE_KEYS;
}

const AREAS = [
  ["setup", "Getting around and setting up"],
  ["selling", "Selling"],
  ["stock", "Kitchen and stock"],
  ["buying", "Buying and spending"],
  ["people", "People and pay"],
  ["books", "The books and checks"],
  ["reports-a", "Reports"],
  ["reports-b", "The Dashboard and more reports"],
];

const e = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Light formatting: `code`, **bold**, and {placeholders} shown as such.
const fmt = (s) =>
  e(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\{([a-zA-Z0-9_ ]+)\}/g, '<span class="ph">$1</span>');
const slug = (s) =>
  String(s).toLowerCase().replace(/\[[^\]]+\]/g, "x").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";

// ------------------------------------------------------------------ the content
const screens = [];
for (const [key, title] of AREAS) {
  const f = join(SRC, "screens", `${key}.json`);
  if (!existsSync(f)) continue;
  const list = JSON.parse(readFileSync(f, "utf8"));
  list.forEach((s, i) =>
    screens.push({
      ...s,
      title: s.section && !String(s.title).includes(s.section) ? `${s.title} — ${s.section}` : s.title,
      areaKey: key,
      areaTitle: title,
      id: `s-${slug(s.path)}-${i}-${key}`,
    }),
  );
}
const tasks = existsSync(join(SRC, "tasks.json")) ? JSON.parse(readFileSync(join(SRC, "tasks.json"), "utf8")) : [];
const shotFiles = new Set(existsSync(join(OUT, "shots")) ? readdirSync(join(OUT, "shots")) : []);
const shot = (name) => [`${name}.jpg`, `${name}.png`].find((f) => shotFiles.has(f));

// Every message, A–Z, with where it is said.
const messages = new Map();
for (const s of screens) {
  for (const m of s.messages || []) {
    const k = String(m.text || "").trim();
    if (!k) continue;
    if (!messages.has(k)) messages.set(k, { ...m, screens: [] });
    messages.get(k).screens.push(s);
  }
}

// ------------------------------------------------------------------ the page
const KIND = { error: "Refused", warning: "Warning", confirm: "Asks first", info: "Says", success: "Done" };

function figure(names, caption) {
  const imgs = (names || []).map((n) => [n, shot(n.name || n)]).filter(([, f]) => f);
  if (!imgs.length) return "";
  return imgs
    .map(
      ([n, f]) =>
        `<figure class="shot"><img loading="lazy" src="shots/${e(f)}" alt="${e(n.state || caption || "")}">${
          n.state ? `<figcaption>${fmt(n.state)}${n.role ? ` <span class="as">as ${e(roleName(n.role))}</span>` : ""}</figcaption>` : ""
        }</figure>`,
    )
    .join("");
}
function roleName(r) {
  return String(r ?? "")
    .split(/\s*,\s*/)
    .map((part) => {
      const k = roleKey(part);
      return k ? ROLES.find((x) => x[0] === k)[1] : part;
    })
    .join(", ");
}

// A screen told in several entries shows its opening picture once.
const firstOfPath = (s) => screens.find((x) => x.path.split("#")[0] === s.path.split("#")[0]) === s;

function screenHtml(s) {
  const roles = rolesOf(s);
  const parts = (s.parts || [])
    .map(
      (p) => `
      <div class="part">
        <h4>${fmt(p.name)}</h4>
        ${p.shows ? `<p>${fmt(p.shows)}</p>` : ""}
        ${
          (p.controls || []).length
            ? `<div class="tbl"><table class="controls"><thead><tr><th>Control</th><th>What it does</th><th>Rules</th><th>Afterwards</th></tr></thead><tbody>${p.controls
                .map(
                  (c) => `<tr><td class="ctl"><span class="label">${fmt(c.label)}</span>${
                    c.kind ? `<span class="kind">${e(c.kind)}</span>` : ""
                  }${c.who ? `<span class="who">${fmt(c.who)}</span>` : ""}</td><td>${fmt(c.does)}</td><td>${fmt(
                    c.rules || "",
                  )}</td><td>${fmt(c.after || "")}</td></tr>`,
                )
                .join("")}</tbody></table></div>`
            : ""
        }
      </div>`,
    )
    .join("");
  const list = (items, a, b) =>
    (items || []).length
      ? `<dl class="pairs">${items.map((x) => `<div><dt>${fmt(x[a])}</dt><dd>${fmt(x[b])}</dd></div>`).join("")}</dl>`
      : "";
  const msgs = (s.messages || []).length
    ? `<div class="tbl"><table class="msgs"><thead><tr><th>The screen says</th><th>When</th><th>What to do</th></tr></thead><tbody>${s.messages
        .map(
          (m) =>
            `<tr class="k-${e(m.kind)}"><td><span class="kindtag">${e(KIND[m.kind] || m.kind || "")}</span><q>${fmt(
              m.text,
            )}</q></td><td>${fmt(m.when)}</td><td>${fmt(m.do)}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : "";
  const who = (s.who || []).length
    ? `<div class="tbl"><table class="whotbl"><thead><tr><th>Who</th><th>Can</th><th>Cannot</th></tr></thead><tbody>${s.who
        .map((w) => `<tr><td>${fmt(roleName(w.role))}</td><td>${fmt(w.can || "")}</td><td>${fmt(w.cannot || "")}</td></tr>`)
        .join("")}</tbody></table></div>`
    : "";
  return `
  <article class="screen" id="${s.id}" data-roles="${roles.join(" ")}" data-area="${s.areaKey}">
    <header>
      <h3>${fmt(s.title)}</h3>
      <code class="path">${e(s.path)}</code>
    </header>
    <p class="summary">${fmt(s.summary)}</p>
    <div class="meta">
      ${s.get_there ? `<p><b>Get there:</b> ${fmt(s.get_there)}</p>` : ""}
      ${(s.before || []).length ? `<p><b>First:</b> ${s.before.map(fmt).join(" ")}</p>` : ""}
    </div>
    ${figure(s.shots) || (firstOfPath(s) ? figure([{ name: pageName(s.path.split("#")[0]), state: "The screen as it opens" }]) : "")}
    ${who ? `<details open><summary>Who can use it</summary>${who}</details>` : ""}
    ${parts ? `<details open><summary>Every part of the screen</summary>${parts}</details>` : ""}
    ${(s.states || []).length ? `<details open><summary>How it can look</summary>${list(s.states, "state", "looks")}</details>` : ""}
    ${msgs ? `<details open><summary>Every message (${s.messages.length})</summary>${msgs}</details>` : ""}
    ${(s.what_if || []).length ? `<details open><summary>What if…</summary>${list(s.what_if, "case", "do")}</details>` : ""}
    ${(s.tips || []).length ? `<details open><summary>Tips</summary><ul class="tips">${s.tips.map((t) => `<li>${fmt(t)}</li>`).join("")}</ul></details>` : ""}
    ${
      (s.related || []).length
        ? `<p class="related">See also: ${s.related
            .map((r) => {
              const t = screens.find((x) => x.path === r);
              return t ? `<a href="#${t.id}">${fmt(t.title)}</a>` : `<code>${e(r)}</code>`;
            })
            .join(" · ")}</p>`
        : ""
    }
  </article>`;
}

function taskHtml(t, i) {
  const roles = (t.roles || []).map(roleKey).filter(Boolean);
  return `
  <article class="task" id="t-${i}" data-roles="${(roles.length ? roles : ROLE_KEYS).join(" ")}">
    <h3>${fmt(t.title)}</h3>
    ${t.why ? `<p class="summary">${fmt(t.why)}</p>` : ""}
    ${(t.before || []).length ? `<p><b>First:</b> ${t.before.map(fmt).join(" ")}</p>` : ""}
    <ol class="steps">${(t.steps || [])
      .map(
        (st) =>
          `<li><p>${fmt(st.do || st)}</p>${st.see ? `<p class="see">${fmt(st.see)}</p>` : ""}${
            st.shot ? figure([{ name: st.shot }]) : ""
          }</li>`,
      )
      .join("")}</ol>
    ${(t.if || []).length ? `<dl class="pairs">${t.if.map((x) => `<div><dt>${fmt(x.case)}</dt><dd>${fmt(x.do)}</dd></div>`).join("")}</dl>` : ""}
    ${(t.screens || []).length ? `<p class="related">Screens: ${t.screens
      .map((p) => {
        const s = screens.find((x) => x.path === p);
        return s ? `<a href="#${s.id}">${fmt(s.title)}</a>` : `<code>${e(p)}</code>`;
      })
      .join(" · ")}</p>` : ""}
  </article>`;
}

const countControls = screens.reduce((n, s) => n + (s.parts || []).reduce((m, p) => m + (p.controls || []).length, 0), 0);
const countStates = screens.reduce((n, s) => n + (s.states || []).length, 0);

const roleTable = `
  <div class="tbl"><table class="roles"><thead><tr><th>Role</th><th>Does</th><th>Screens</th></tr></thead><tbody>${ROLES.map(
    ([k, name, does]) =>
      `<tr><td><a href="#${k}" class="rolelink" data-role="${k}">${name}</a></td><td>${e(does)}</td><td class="num">${
        screens.filter((s) => rolesOf(s).includes(k)).length
      }</td></tr>`,
  ).join("")}</tbody></table></div>`;

const nav = AREAS.filter(([k]) => screens.some((s) => s.areaKey === k))
  .map(
    ([k, title]) =>
      `<li><a href="#area-${k}">${e(title)}</a><ul>${screens
        .filter((s) => s.areaKey === k)
        .map((s) => `<li data-roles="${rolesOf(s).join(" ")}"><a href="#${s.id}">${fmt(s.title)}</a></li>`)
        .join("")}</ul></li>`,
  )
  .join("");

const msgIndex = [...messages.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(
    ([text, m]) =>
      `<tr data-roles="${[...new Set(m.screens.flatMap(rolesOf))].join(" ")}"><td><q>${fmt(text)}</q></td><td>${fmt(m.do)}</td><td>${m.screens
        .map((s) => `<a href="#${s.id}">${fmt(s.title)}</a>`)
        .join(", ")}</td></tr>`,
  )
  .join("");

const css = readFileSync(join(ROOT, "scripts", "guide", "guide.css"), "utf8");
const js = readFileSync(join(ROOT, "scripts", "guide", "guide.js"), "utf8");
const today = new Date().toISOString().slice(0, 10);

const html = `<title>The Sixty's Guide</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap">
<style>${css}</style>
<div class="top" id="top">
  <div class="topin">
    <a class="brand" href="#start"><span class="mark" aria-hidden="true">60</span><span>The Sixty's Guide</span></a>
    <label class="search"><span class="sr">Search the guide</span><input id="q" type="search" placeholder="Search a screen, a button or a message…" autocomplete="off"></label>
    <label class="rolepick"><span class="sr">Show for</span><select id="role"><option value="">Every role</option>${ROLES.map(
      ([k, n]) => `<option value="${k}">${n}</option>`,
    ).join("")}</select></label>
  </div>
  <p class="found" id="found" hidden></p>
</div>
<div class="wrap">
  <aside class="toc" aria-label="Contents">
    <p class="tochead">Contents</p>
    <ul>
      <li><a href="#start">Start here</a></li>
      <li><a href="#tasks">How do I…</a></li>
      ${nav}
      <li><a href="#messages">Every message, A–Z</a></li>
    </ul>
  </aside>
  <main>
    <section id="start" class="intro">
      <p class="eyebrow">The Sixty's Gelato &amp; Café · the guide · ${today}</p>
      <h1>How every screen works, and what to do when something happens</h1>
      <p class="lede">Each screen is described from top to bottom: every button and box, what pressing it does to the stock, the money and the books, every way the screen can look, and every message it can show, with what to do about it. Pick your role above to see only your screens.</p>
      <div class="stats">
        <div><b>${screens.length}</b><span>screens and parts</span></div>
        <div><b>${countControls}</b><span>buttons, boxes and links</span></div>
        <div><b>${countStates}</b><span>ways a screen can look</span></div>
        <div><b>${messages.size}</b><span>messages explained</span></div>
        <div><b>${tasks.length}</b><span>step-by-step tasks</span></div>
      </div>
      <h2>Who sees what</h2>
      <p>The menu shows each person only the screens their role opens. The database checks every action again, so a screen reached by typing its address still shows and does nothing it should not.</p>
      ${roleTable}
      <h2>How to read a screen's entry</h2>
      <ul class="how">
        <li><b>Every part of the screen</b>: each button, box and link, what it does, its limits, and what changes afterwards (stock, the till, the safe, the bank, the books).</li>
        <li><b>How it can look</b>: empty, busy, offline, before something is set up, and so on.</li>
        <li><b>Every message</b>: the exact words, when they appear, and what to do. <span class="kindtag">Refused</span> nothing was saved; <span class="kindtag">Warning</span> look before going on; <span class="kindtag">Asks first</span> it waits for you to confirm.</li>
        <li><b>What if…</b>: real situations, step by step.</li>
      </ul>
      <p>Saw a message and don't know where it came from? Search for a few of its words, or open <a href="#messages">Every message, A–Z</a>.</p>
    </section>

    <section id="tasks">
      <h2 class="area">How do I…</h2>
      <p class="areanote">Step-by-step tasks, grouped by who does them.</p>
      ${tasks.map(taskHtml).join("")}
    </section>

    ${AREAS.filter(([k]) => screens.some((s) => s.areaKey === k))
      .map(
        ([k, title]) =>
          `<section id="area-${k}"><h2 class="area">${e(title)}</h2>${screens
            .filter((s) => s.areaKey === k)
            .map(screenHtml)
            .join("")}</section>`,
      )
      .join("")}

    <section id="messages">
      <h2 class="area">Every message, A–Z</h2>
      <p class="areanote">The exact words a screen can show, what to do, and where it is said. <span class="ph">name</span> is where the screen puts a value.</p>
      <div class="tbl"><table class="msgs all"><thead><tr><th>The screen says</th><th>What to do</th><th>Where</th></tr></thead><tbody>${msgIndex}</tbody></table></div>
    </section>
    <p class="foot">Written from the app's own code and checked against it; the pictures are of a café with a simulated year behind it, not real figures.</p>
  </main>
</div>
<script>${js}</script>`;

writeFileSync(join(OUT, "index.html"), html);
console.log(
  `guide: ${screens.length} entries, ${countControls} controls, ${countStates} states, ${messages.size} messages, ${tasks.length} tasks, ${
    [...shotFiles].length
  } pictures → ${join(OUT, "index.html")} (${Math.round(html.length / 1024)} KB)`,
);
