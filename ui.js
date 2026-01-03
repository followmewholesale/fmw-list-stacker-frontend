/* =====================================================
   FOLLOW ME WHOLESALE — LIST STACKER UI
   SAFE FRONTEND VERSION (NETLIFY + WHOP COMPATIBLE)
===================================================== */

/* ============================
   ACCESS CHECK (NON-BLOCKING)
   - Allows Netlify direct usage
   - Allows Whop iframe usage
   - Preserves login.html for future
============================ */
(function accessGate() {
  const isInsideWhop = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  // Phase 1 access rule:
  // - If inside Whop → allow
  // - If direct Netlify → allow
  // - No backend yet
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

  /* ============================
     SAFETY CHECK (NO BLACK SCREEN)
  ============================ */
  if (!listsContainer || !runStackBtn || !resultsContainer) {
    console.warn(
      "List Stacker UI did not initialize — missing DOM elements.",
      {
        listsContainer,
        runStackBtn,
        resultsContainer
      }
    );
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
    "Code Violations",
    "Tax Delinquent",
    "Probate",
    "Water Shutoff",
    "Evictions",
    "Utility Liens",
    "HOA Liens",
    "Other"
  ];

  const STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY"
  ];

  /* ============================
     EVENT BINDINGS
  ============================ */
  addListBtn.addEventListener("click", () => {
    if (listCount >= MAX_LISTS) {
      alert("Maximum of 6 lists allowed.");
      return;
    }
    listCount++;
    if (typeof renderListBlock === "function") {
      renderListBlock(listCount);
    } else {
      console.error("renderListBlock() is not defined");
    }
  });

  runStackBtn.addEventListener("click", () => {
    if (typeof buildEngineInputFromUI !== "function") {
      alert("Stacker engine not ready.");
      return;
    }

    const engineInput = buildEngineInputFromUI();
    if (engineInput.length < 2) {
      alert("Upload and map at least 2 lists before stacking.");
      return;
    }

    let results;
    try {
      results = window.stackLists(engineInput);
    } catch (err) {
      console.error("Stack error:", err);
      alert("Stack failed. Check console for details.");
      return;
    }

    ALL_RESULTS = results || [];
    FILTERED_RESULTS = [...ALL_RESULTS];
    currentPage = 1;
    renderResultsUI();
  });

  /* ============================
     RESULTS UI
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

        <label>
          Rows:
          <select id="pageSize">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="99999">All</option>
          </select>
        </label>
      </div>

      <div id="table-wrap"></div>

      <div class="pagination">
        <button id="prevPage">Prev</button>
        <span id="pageInfo"></span>
        <button id="nextPage">Next</button>
      </div>
    `;

    document.getElementById("pageSize").value = pageSize;
    document.getElementById("pageSize").onchange = e => {
      pageSize = Number(e.target.value);
      currentPage = 1;
      renderTable();
    };

    document.querySelectorAll("[data-export]").forEach(btn => {
      btn.onclick = () => exportCSV(btn.dataset.export);
    });

    document.getElementById("prevPage").onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    };

    document.getElementById("nextPage").onclick = () => {
      const maxPage = Math.ceil(FILTERED_RESULTS.length / pageSize);
      if (currentPage < maxPage) {
        currentPage++;
        renderTable();
      }
    };

    renderTable();
  }

  function renderTable() {
    const start = (currentPage - 1) * pageSize;
    const end = pageSize === 99999 ? FILTERED_RESULTS.length : start + pageSize;
    const pageRows = FILTERED_RESULTS.slice(start, end);
    if (!pageRows.length) return;

    const headers = Object.keys(pageRows[0]);
    let html = `<table class="results-table"><thead><tr>`;
    headers.forEach(h => (html += `<th>${h}</th>`));
    html += `</tr></thead><tbody>`;

    pageRows.forEach(r => {
      html += `<tr>`;
      headers.forEach(h => {
        html += `<td>${r[h] ?? ""}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById("table-wrap").innerHTML = html;

    const maxPage = Math.ceil(FILTERED_RESULTS.length / pageSize);
    document.getElementById("pageInfo").textContent =
      `Page ${currentPage} of ${maxPage}`;
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