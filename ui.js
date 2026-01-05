/* =====================================================
   FOLLOW ME WHOLESALE — LIST STACKER UI
   FINAL MERGED VERSION (WHOP SAFE + MAPPING + EXPORTS)
===================================================== */

/* ============================
   ACCESS CHECK (NON-BLOCKING)
============================ */
(function accessGate() {
  const isInsideWhop = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const HAS_ACCESS = isInsideWhop || location.protocol.startsWith("http");

  if (!HAS_ACCESS) {
    console.warn("Access denied — redirecting to login.html");
    window.location.href = "login.html";
  }
})();

/* =====================================================
   LIST STACKER UI
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* ============================
     FADE-IN ON LOAD
  ============================ */
  document.body.style.opacity = "0";
  document.body.style.transition = "opacity 0.6s ease";
  requestAnimationFrame(() => {
    document.body.style.opacity = "1";
  });

  /* ============================
     GLOBAL STATE
  ============================ */
  let ALL_RESULTS = [];
  let FILTERED_RESULTS = [];

  const parsedLists = {};
  const listConfigs = {};

  /* ============================
     DOM ELEMENTS
  ============================ */
  const listsContainer   = document.getElementById("lists-container");
  const addListBtn       = document.getElementById("add-list-btn");
  const runStackBtn      = document.getElementById("run-stack-btn");
  const resultsContainer = document.getElementById("results");
  const enterToolBtn     = document.querySelector(".hero-actions .primary");
  const appShell         = document.querySelector(".app-shell");

  if (!listsContainer || !addListBtn || !runStackBtn) {
    console.warn("List Stacker UI missing required DOM nodes.");
    return;
  }

  /* ============================
     ENTER TOOL SCROLL
  ============================ */
  if (enterToolBtn && appShell) {
    enterToolBtn.addEventListener("click", () => {
      appShell.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ============================
     LIST CONFIG
  ============================ */
  let listCount = 0;
  const MAX_LISTS = 6;

  const LIST_TYPES = [
    "Code Violations","Tax Delinquent","Probate","Water Shutoff",
    "Evictions","Utility Liens","HOA Liens","Other"
  ];

  const STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY"
  ];

  /* ============================
     RENDER LIST BLOCK
  ============================ */
  function renderListBlock(index) {
    const div = document.createElement("div");
    div.className = "list-block";
    div.dataset.list = index;

    div.innerHTML = `
      <h3>List ${index}</h3>

      <label>List Type
        <select class="list-type">
          <option value="">Select list type</option>
          ${LIST_TYPES.map(t => `<option>${t}</option>`).join("")}
        </select>
      </label>

      <label>Default Property State
        <select class="default-property-state">
          <option value="">Select state</option>
          ${STATES.map(s => `<option>${s}</option>`).join("")}
        </select>
      </label>

      <label>Upload CSV / XLSX
        <input type="file" class="file-input" data-list="${index}" accept=".csv,.xlsx">
      </label>

      <div class="column-mapper-container"></div>
    `;

    listsContainer.appendChild(div);
  }

  /* ============================
     ADD LIST
  ============================ */
  addListBtn.addEventListener("click", () => {
    if (listCount >= MAX_LISTS) {
      alert("You can only add up to 6 lists.");
      return;
    }
    listCount++;
    renderListBlock(listCount);
  });

  /* ============================
     FILE UPLOAD & PARSE
  ============================ */
  document.addEventListener("change", async e => {
    if (!e.target.classList.contains("file-input")) return;

    const idx = e.target.dataset.list;
    const file = e.target.files[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    parsedLists[idx] = { rows };
    renderColumnMappingUI(idx);
  });

  /* ============================
     COLUMN MAPPING UI
  ============================ */
  function renderColumnMappingUI(idx) {
    const block = document.querySelector(`.list-block[data-list="${idx}"]`);
    const container = block.querySelector(".column-mapper-container");
    const headers = Object.keys(parsedLists[idx].rows[0] || {});

    container.innerHTML = `
      <hr>
      ${mapSelect("Property Address", "address", headers)}
      ${mapSelect("Owner Name", "owner", headers, true)}
      ${mapSelect("Mailing Address", "mailing", headers, true)}
      ${mapSelect("Mailing City", "mailingCity", headers, true)}
      ${mapSelect("Mailing State", "mailingState", headers, true)}
      ${mapSelect("Mailing Zip", "mailingZip", headers, true)}
      ${mapSelect("Parcel / APN", "parcel", headers, true)}
    `;

    container.querySelectorAll("select").forEach(sel =>
      sel.addEventListener("change", () => saveMapping(idx))
    );
  }

  function mapSelect(label, key, headers, optional = false) {
    return `
      <label>${label}
        <select data-map="${key}">
          <option value="">${optional ? "-- None --" : "-- Select --"}</option>
          ${headers.map(h => `<option value="${h}">${h}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function saveMapping(idx) {
    const block = document.querySelector(`.list-block[data-list="${idx}"]`);
    listConfigs[idx] = {
      defaultPropertyState: block.querySelector(".default-property-state").value
    };

    block.querySelectorAll("select[data-map]").forEach(sel => {
      listConfigs[idx][sel.dataset.map] = sel.value;
    });
  }

  /* ============================
     BUILD ENGINE INPUT
  ============================ */
  function buildEngineInputFromUI() {
    const out = [];

    Object.entries(parsedLists).forEach(([i, d]) => {
      const cfg = listConfigs[i];
      if (!cfg || !cfg.address) return;

      out.push({
        name: document.querySelectorAll(".list-type")[i - 1].value || "Other",
        rows: d.rows.map(r => ({
          owner: r[cfg.owner] || "",
          property: r[cfg.address] || "",
          propertyState: cfg.defaultPropertyState || "",
          mailing: r[cfg.mailing] || "",
          mailingCity: r[cfg.mailingCity] || "",
          mailingState: r[cfg.mailingState] || "",
          mailingZip: r[cfg.mailingZip] || "",
          parcel: r[cfg.parcel] || ""
        }))
      });
    });

    return out;
  }

  /* ============================
     RUN STACK
  ============================ */
  runStackBtn.addEventListener("click", () => {
    const engineInput = buildEngineInputFromUI();
    if (engineInput.length < 2) {
      alert("Upload and map at least 2 lists.");
      return;
    }

    const results = window.stackLists(engineInput);
    ALL_RESULTS = results || [];
    FILTERED_RESULTS = [...ALL_RESULTS];
    renderResultsUI();
  });

  /* ============================
     RESULTS + EXPORTS
  ============================ */
  function renderResultsUI() {
    resultsContainer.innerHTML = `
      <h2>Results (${FILTERED_RESULTS.length})</h2>

      <div class="results-controls">
        <button data-export="all">Export All</button>
        <button data-export="unique-mailing">Unique Mailing</button>
        <button data-export="hit3">Hit ≥ 3</button>
        <button data-export="hit4">Hit ≥ 4</button>
      </div>

      <div id="table-wrap"></div>
    `;

    document.querySelectorAll("[data-export]").forEach(btn => {
      btn.addEventListener("click", () => exportCSV(btn.dataset.export));
    });

    renderTable();
  }

  function renderTable() {
    if (!FILTERED_RESULTS.length) return;

    const headers = Object.keys(FILTERED_RESULTS[0]);
    let html = `<table class="results-table"><thead><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;

    FILTERED_RESULTS.forEach(r => {
      html += `<tr>`;
      headers.forEach(h => html += `<td>${r[h] ?? ""}</td>`);
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById("table-wrap").innerHTML = html;
  }

  /* ============================
     CSV EXPORT
  ============================ */
  function exportCSV(mode) {
    let rows = [...ALL_RESULTS];
    if (!rows.length) return alert("No rows to export.");

    if (mode === "unique-mailing") {
      const seen = new Set();
      rows = rows.filter(r => {
        const key = r["Mailing Address"];
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (mode === "hit3") rows = rows.filter(r => Number(r["Hit Count"]) >= 3);
    if (mode === "hit4") rows = rows.filter(r => Number(r["Hit Count"]) >= 4);

    downloadCSV(rows);
  }

  function downloadCSV(rows) {
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map(r =>
        headers.map(h =>
          `"${String(r[h] ?? "").replace(/"/g, '""')}"`
        ).join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fmw_list_stacker_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

});
