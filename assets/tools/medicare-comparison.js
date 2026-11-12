// Set today's date.
document.getElementById("compDate").value = new Date().toISOString().slice(0, 10);

// Sync plan names to note labels.
["plan1name", "plan2name", "plan3name"].forEach((id, index) => {
  document.getElementById(id).addEventListener("input", function () {
    document.getElementById(`note${index + 1}label`).textContent =
      (this.value || `Plan ${index + 1}`) + " Notes";
  });
});

function num(field, plan) {
  const element = document.querySelector(`[data-field="${field}"][data-plan="${plan}"]`);
  const value = ((element && element.value) || "").replace(/[^0-9.]/g, "");
  return value === "" ? null : Number.parseFloat(value);
}

function pickWinner() {
  const names = [1, 2, 3].map(index =>
    document.getElementById(`plan${index}name`).value || `Plan ${index}`
  );
  const plans = [1, 2, 3]
    .map(plan => ({
      index: plan - 1,
      premium: num("premium", plan),
      maximum: num("moop", plan),
    }))
    .filter(plan => plan.premium !== null && plan.maximum !== null);

  document.querySelectorAll(".data-cell").forEach(cell => cell.classList.remove("best"));
  if (plans.length < 2) {
    document.getElementById("winnerText").textContent =
      "Enter premium and out-of-pocket max for at least two plans";
    return;
  }

  plans.forEach(plan => { plan.cost = plan.premium * 12 + plan.maximum; });
  const best = plans.reduce((current, plan) => plan.cost < current.cost ? plan : current);
  document.getElementById("winnerText").textContent =
    `⭐ Lowest worst-case yearly cost: ${names[best.index]} ($${best.cost.toLocaleString()})`;
  document.querySelectorAll(`[data-plan="${best.index + 1}"]`).forEach(element => {
    element.closest(".data-cell")?.classList.add("best");
  });
}

function collectRows() {
  const rows = [];
  document.querySelectorAll("#compGrid .row-label:not(.category)").forEach(label => {
    const values = [];
    let next = label.nextElementSibling;
    for (let index = 0; index < 3 && next; index += 1, next = next.nextElementSibling) {
      const field = next.querySelector("input,select");
      values.push(field ? field.value : "");
    }
    rows.push({ label: label.textContent.trim(), values });
  });
  return rows;
}

function buildSummary(data) {
  const names = data.plans.map((plan, index) =>
    (plan.name || `Plan ${index + 1}`) + (plan.carrier ? ` (${plan.carrier})` : "")
  );
  let text = `Medicare Plan Comparison\n${data.clientName || "Client"} — ${data.zip} ${data.county} ${data.state} — ${data.date}\nPlan type: ${data.planType}\n\n`;
  text += `Plans: ${names.join(" | ")}\n\n`;
  data.rows.filter(row => row.values.some(Boolean)).forEach(row => {
    text += `${row.label}: ${row.values.map(value => value || "—").join(" | ")}\n`;
  });
  data.notes.forEach((note, index) => {
    if (note) text += `\nNotes — ${names[index]}: ${note}`;
  });
  if (data.recommendation) text += `\n\nRecommendation: ${data.recommendation}`;
  return text;
}

function saveComparison() {
  const data = {
    clientName: document.getElementById("clientName").value,
    dob: document.getElementById("clientDOB").value,
    zip: document.getElementById("clientZip").value,
    county: document.getElementById("clientCounty").value,
    state: document.getElementById("clientState").value,
    planType: document.getElementById("planType").value,
    date: document.getElementById("compDate").value,
    plans: [1, 2, 3].map(plan => ({
      name: document.getElementById(`plan${plan}name`).value,
      carrier: document.getElementById(`plan${plan}carrier`).value,
    })),
    rows: collectRows(),
    notes: [1, 2, 3].map(plan => document.getElementById(`note${plan}`).value),
    recommendation: document.getElementById("agentRec").value,
  };
  data.summary = buildSummary(data);

  if (typeof window.agentRiseSaveComparison === "function") {
    window.agentRiseSaveComparison(data);
    window.alert("Comparison saved to the prospect record.");
    return;
  }

  const download = () => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([data.summary], { type: "text/plain" }));
    link.href = url;
    link.download = `plan-comparison-${(data.clientName || "client").replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    window.alert("Summary downloaded. Paste it into the prospect's notes in Agent Rise Pro.");
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(data.summary)
      .then(() => window.alert("Full summary copied. Paste it into the prospect's notes in Agent Rise Pro."))
      .catch(download);
  } else {
    download();
  }
}

function exitComparison() {
  window.close();
  setTimeout(() => {
    if (window.closed) return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.replace(new URL("../../", window.location.href).href);
  }, 120);
}

function clearAll() {
  if (!window.confirm("Clear all comparison data?")) return;
  document.querySelectorAll("input, textarea").forEach(element => { element.value = ""; });
  document.querySelectorAll("#compGrid select").forEach(element => { element.selectedIndex = 0; });
  document.getElementById("planType").selectedIndex = 0;
  document.querySelectorAll(".data-cell").forEach(cell => cell.classList.remove("best"));
  document.getElementById("winnerText").textContent = "Complete the comparison to see recommendation";
  document.getElementById("compDate").value = new Date().toISOString().slice(0, 10);
  [1, 2, 3].forEach(index => {
    document.getElementById(`note${index}label`).textContent = `Plan ${index} Notes`;
  });
}

const comparisonActions = {
  save: saveComparison,
  print: () => window.print(),
  clear: clearAll,
  exit: exitComparison,
  recommend: pickWinner,
};

document.querySelectorAll("[data-comparison-action]").forEach(button => {
  button.addEventListener("click", () => comparisonActions[button.dataset.comparisonAction]?.());
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") exitComparison();
});

const params = new URLSearchParams(window.location.search);
const name = params.get("clientName") || "";
const dob = params.get("clientDOB") || "";
const state = params.get("clientState") || "";
const county = params.get("clientCounty") || "";
if (name) document.getElementById("clientName").value = name;
if (dob) document.getElementById("clientDOB").value = dob;
if (state) document.getElementById("clientState").value = state;
if (county) document.getElementById("clientCounty").value = county;

