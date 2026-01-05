/* =====================================================
   FOLLOW ME WHOLESALE — LIST STACKER UI
   WHOP-SAFE + EXPORT ENABLED (v1.0 Temple Build)
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
  let currentPage = 1;
  let pageSize = 25;

  /* ============================
     DOM ELEMENTS
  ============================ */
  const listsContainer   = document.getElementById("lists-container");
  const addListBtn       = document.getElementById("add-list-btn");
  const runStackBtn      = document.getElementById("run-stack-btn");
  const resultsContainer = document.getElementById("results");
  const enterToolBtn     = document.querySelector(".hero-actions .primary");
  const appShell         = document.querySelector(".app-shell");

  if (!listsContainer || !addListBtn || !runStackBtn || !resultsContainer) {
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

  /* ============================
     RENDER LIST BLOCK
  ============================ */
  function renderListBlock(index) {
    const block = document.createElement("div");
    block.className = "list-block";
    block.dataset.list = index;

    block.innerHTML = `
      <h3>List ${index}</h3>
      <label>
        Upload CSV / XLSX
        <input type="file" accept=".csv,.xlsx" class="file-input" data-list="${index}">
      </label>
    `;

    listsContainer.appendChild(block);
  }

  /* ============================
     EVENT BINDINGS
  ============================ */
  addListBtn.addEventListener("click", () => {
    if (listCount >= MAX_LISTS) {
      alert("Maximum of 6 lists allowed.");
      return;
    }
    listCount++;
    renderListBlock(listCount);
  });

  runStackBtn.addEventListener("click", () => {
    if (typeof buildEngineInputFromUI !== "function") {
      alert("Stacker engine not ready.");
      return;
    }

    const engineInput = buildEngineInputFromUI();
    if (!engineInput || engineInput.length < 2) {
      alert("Upload and map at least 2 lists before stacking.");
      return;
    }

    let results;
    try {
      results = window.stackLists(engineInput);
    } catch (err) {
      console.error("Stack error:", err);
      alert("Stack failed. Check console.");
      return;
    }

    ALL_RESULTS = results || [];
    FILTERED_RESULTS = [...ALL_RESULTS];
    currentPage = 1;
    renderResultsUI();
  });

  /* ============================
     RESULTS UI + EXPORTS
  ============================ */
  function renderResultsUI() {
    if (!FILTERED_RESULTS.length) {
      resultsContainer.innerHTML = `
        <h2>No Results</h2>
        <p style="color:#9ca3af;">No overlapping records detected.</p>
      `;
      return;
    }

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
      btn.addEventListener("click", () => {
        exportCSV(btn.dataset.export);
      });
    });

    renderTable();
  }

  function renderTable() {
    const rows = FILTERED_RESULTS;
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    let html = `<table class="results-table"><thead><tr>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;

    rows.forEach(r => {
      html += `<tr>`;
      headers.forEach(h => html += `<td>${r[h] ?? ""}</td>`);
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById("table-wrap").innerHTML = html;
  }

  /* ============================
     CSV EXPORT LOGIC (WHOP SAFE)
  ============================ */
  function exportCSV(mode) {
    let rows = [...ALL_RESULTS];
    if (!rows.length) {
      alert("No rows to export.");
      return;
    }

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
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

});
