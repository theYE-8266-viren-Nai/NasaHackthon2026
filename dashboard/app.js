const state = { experiments: [], selected: new Set(), filters: { search: "", investigation: "all", material: "all", measurement: "all" } };
const $ = (id) => document.getElementById(id);

async function load() {
  const response = await fetch("./data/experiments.json");
  state.experiments = await response.json();
  populateFilters();
  renderMetrics();
  renderList();
}

function populateFilters() {
  const unique = (key) => [...new Set(state.experiments.map((item) => item[key]).filter(Boolean))].sort();
  for (const pair of [["investigation", unique("investigation")], ["material", unique("material")]]) {
    for (const value of pair[1]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      $(pair[0]).append(option);
    }
  }
  const measurements = [...new Set(state.experiments.flatMap((item) => item.measurements))].sort();
  for (const value of measurements) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    $("measurement").append(option);
  }
  for (const id of ["search", "investigation", "material", "measurement"]) {
    $(id).addEventListener("input", () => { state.filters[id] = $(id).value; renderList(); });
  }
  $("clear-selection").addEventListener("click", () => { state.selected.clear(); renderList(); renderComparison(); });
}

function renderMetrics() {
  const materials = new Set(state.experiments.map((item) => item.material));
  const findings = state.experiments.filter((item) => item.finding).length;
  const metrics = [["Experiments indexed", state.experiments.length, "Curated NASA records"], ["Materials / groups", materials.size, "Distinct catalog categories"], ["Source-backed findings", findings, "Every record links to NASA PSI"]];
  $("metrics").innerHTML = metrics.map((metric) => "<div class=\"metric\"><span class=\"metric-label\">" + metric[0] + "</span><strong class=\"metric-value\">" + metric[1] + "</strong><span class=\"metric-note\">" + metric[2] + "</span></div>").join("");
}

function filtered() {
  const f = state.filters;
  return state.experiments.filter((item) => {
    const haystack = [item.id, item.title, item.investigation, item.material, item.condition, item.finding].join(" ").toLowerCase();
    return (!f.search || haystack.includes(f.search.toLowerCase())) && (f.investigation === "all" || item.investigation === f.investigation) && (f.material === "all" || item.material === f.material) && (f.measurement === "all" || item.measurements.includes(f.measurement));
  });
}

function renderList() {
  const items = filtered();
  $("result-count").textContent = items.length + " shown";
  if (!items.length) { $("experiment-list").innerHTML = "<div class=\"empty-state\">No experiments match these filters.</div>"; return; }
  $("experiment-list").innerHTML = items.map((item) => {
    const selected = state.selected.has(item.id);
    return "<article class=\"experiment-card " + (selected ? "selected" : "") + "\" data-id=\"" + item.id + "\"><div class=\"card-row\"><span class=\"badge\">" + item.investigation + "</span><input class=\"check\" type=\"checkbox\" " + (selected ? "checked" : "") + " aria-label=\"Select " + item.title + "\"></div><h3>" + item.title + "</h3><p>" + item.condition + "</p><div class=\"tags\">" + item.measurements.map((m) => "<span class=\"tag\">" + m + "</span>").join("") + "</div></article>";
  }).join("");
  document.querySelectorAll(".experiment-card").forEach((card) => card.addEventListener("click", (event) => { if (event.target.tagName !== "INPUT") showDetail(card.dataset.id); else toggleSelection(card.dataset.id, card.querySelector("input").checked); }));
}

function toggleSelection(id, checked) {
  if (checked && state.selected.size >= 3) { alert("Select up to 3 experiments."); renderList(); return; }
  if (checked) state.selected.add(id); else state.selected.delete(id);
  renderList(); renderComparison();
}

function showDetail(id) {
  const item = state.experiments.find((experiment) => experiment.id === id);
  $("insight-text").textContent = item.finding + " Available measurements: " + item.measurements.join(", ") + ". Missing measurements remain unfilled in this prototype.";
  $("insight-sources").innerHTML = "<a href=\"" + item.sourceUrl + "\" target=\"_blank\" rel=\"noreferrer\">" + item.sourceLabel + " ↗</a>" + (item.videoPath ? "<a href=\"" + item.videoPath + "\" target=\"_blank\" rel=\"noreferrer\">Local video ↗</a>" : "");
  document.querySelector(".insight").scrollIntoView({ behavior: "smooth", block: "center" });
}

function score(item) {
  const oxygenChange = item.initialOxygenPct == null || item.finalOxygenPct == null ? null : Math.abs(item.finalOxygenPct - item.initialOxygenPct);
  const coChange = item.initialCoPpm == null || item.finalCoPpm == null ? null : Math.max(0, item.finalCoPpm - item.initialCoPpm);
  const pieces = [oxygenChange == null ? null : Math.min(50, oxygenChange * 20), coChange == null ? null : Math.min(50, coChange / 2)].filter((value) => value != null);
  return pieces.length ? Math.round(pieces.reduce((a, b) => a + b, 0) / pieces.length) : null;
}

function bars(items, metric, formatter) {
  const available = items.map((item) => ({ item, value: metric(item) })).filter((row) => row.value != null);
  if (!available.length) return "<div class=\"missing\">NASA does not provide this measurement for the selected experiments.</div>";
  const max = Math.max(...available.map((row) => Math.abs(row.value)), 1);
  return available.map((row) => "<div class=\"bar-row\"><span>" + row.item.investigation + " · " + row.item.id + "</span><span class=\"bar-track\"><span class=\"bar\" style=\"width:" + Math.max(4, Math.abs(row.value) / max * 100) + "%\"></span></span><strong>" + formatter(row.value) + "</strong></div>").join("");
}

function renderComparison() {
  const items = state.experiments.filter((item) => state.selected.has(item.id));
  $("comparison-empty").classList.toggle("hidden", items.length > 0); $("comparison-content").classList.toggle("hidden", items.length === 0);
  if (!items.length) return;
  $("score-cards").innerHTML = items.map((item) => {
    const value = score(item);
    return "<div class=\"score-card\"><h3>" + item.investigation + " · " + item.id + "</h3><div class=\"score-number\">" + (value == null ? "—" : value) + "</div><div class=\"score-reason\">" + (value == null ? "No comparable numeric measurements" : "Uses available O₂ and CO changes only") + "</div></div>";
  }).join("");
  $("oxygen-chart").innerHTML = bars(items, (item) => item.initialOxygenPct == null || item.finalOxygenPct == null ? null : item.finalOxygenPct - item.initialOxygenPct, (value) => value.toFixed(1));
  $("co-chart").innerHTML = bars(items, (item) => item.finalCoPpm, (value) => value + " ppm");
}

load().catch((error) => { $("experiment-list").innerHTML = "<div class=\"empty-state\">Could not load curated experiment data: " + error.message + "</div>"; });
