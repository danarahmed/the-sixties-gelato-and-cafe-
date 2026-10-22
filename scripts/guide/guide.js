// The guide's search and role filter. A role in the link (#cashier) opens the
// guide for that role; #print-<role> lays it out for printing (the PDFs).
(() => {
  const q = document.getElementById("q");
  const pick = document.getElementById("role");
  const found = document.getElementById("found");
  const roles = [...pick.options].map((o) => o.value).filter(Boolean);
  const items = [...document.querySelectorAll("[data-roles]")];
  const texts = new Map(items.map((el) => [el, el.textContent.toLowerCase()]));
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* nothing kept: fine */ } };
  const recall = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };

  function apply() {
    const role = pick.value;
    const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const el of items) {
      const okRole = !role || el.dataset.roles.split(" ").includes(role);
      const okWords = !words.length || words.every((w) => texts.get(el).includes(w));
      const show = okRole && (el.matches("article") ? okWords : el.matches("tr") ? okWords : true);
      el.hidden = !show;
      if (show && el.matches("article")) shown++;
    }
    // A table of messages with nothing left in it says so by hiding.
    if (words.length || role) {
      found.hidden = false;
      found.textContent = `${shown} ${shown === 1 ? "entry" : "entries"}${role ? ` for ${pick.selectedOptions[0].text}` : ""}${
        words.length ? ` with “${q.value.trim()}”` : ""
      }`;
    } else found.hidden = true;
    if (words.length) document.querySelectorAll("article:not([hidden]) details").forEach((d) => (d.open = true));
  }

  function fromHash() {
    const h = location.hash.replace("#", "");
    const role = h.replace(/^print-/, "");
    if (roles.includes(role)) {
      pick.value = role;
      remember("guide.role", role);
    }
    if (h.startsWith("print-")) document.documentElement.classList.add("printing");
  }

  pick.value = recall("guide.role");
  fromHash();
  pick.addEventListener("change", () => { remember("guide.role", pick.value); apply(); });
  let t;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 120); });
  window.addEventListener("hashchange", () => { fromHash(); apply(); });
  document.querySelectorAll(".rolelink").forEach((a) =>
    a.addEventListener("click", (ev) => { ev.preventDefault(); pick.value = a.dataset.role; remember("guide.role", pick.value); apply(); window.scrollTo({ top: 0 }); }),
  );
  apply();
})();
