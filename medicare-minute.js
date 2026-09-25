/* Agent Rise Medicare Minute: owner publishing, notification playback, and Fresh Pour archive. */
(() => {
  const DEFAULT_PHRASES = ["I smell opportunity.", "Stay in the game.", "Don't leave money on the table."];
  const $m = id => document.getElementById(id);
  let previewUrl = "";
  let latestRecord = null;
  let archiveRecords = [];

  function localDate(date = new Date()) {
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 10);
  }
  function aepActive(date = new Date()) {
    const year = date.getFullYear();
    return date >= new Date(year, 9, 15, 0, 0, 0) && date <= new Date(year, 11, 7, 23, 59, 59);
  }
  function briefTitle(date = new Date()) { return aepActive(date) ? "📻 AEP Daily Briefing" : "📻 The Medicare Minute"; }
  function displayDate(value) {
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
  }
  function storageUrl(path) {
    return `${String(config.supabaseUrl || "").replace(/\/$/, "")}/storage/v1/object/public/medicare-minute/${path}`;
  }
  function phrases() {
    const value = pilot.workspaceData.signaturePhrases;
    return Array.isArray(value) && value.length ? value.map(String) : [...DEFAULT_PHRASES];
  }
  function scriptFields() {
    return {
      date: $m("minuteDate")?.value || localDate(),
      headline1: $m("minuteHeadline1")?.value.trim() || "",
      adlib1: $m("minuteAdlib1")?.value.trim() || "",
      headline2: $m("minuteHeadline2")?.value.trim() || "",
      adlib2: $m("minuteAdlib2")?.value.trim() || "",
      headline3: $m("minuteHeadline3")?.value.trim() || "",
      fieldTip: $m("minuteFieldTip")?.value.trim() || "",
      close: $m("minuteClose")?.value.trim() || "",
      bumper: $m("minuteBumper")?.value.trim() || "",
    };
  }
  function assembleScript(fields = scriptFields()) {
    const preferred = String(state.preferredAgentName || pilot.user?.user_metadata?.preferred_name || "Agent").trim();
    const intro = `Medicare brief for ${displayDate(fields.date)}. I'm ${preferred}.`;
    return [intro, fields.headline1, fields.adlib1, fields.headline2, fields.adlib2, fields.headline3, fields.fieldTip, fields.close, fields.bumper].filter(Boolean).join("\n\n");
  }
  function updatePreview() {
    const output = $m("minuteScriptPreview"), count = $m("minuteCharacterCount");
    if (!output || !count) return;
    const script = assembleScript();
    output.value = script;
    count.textContent = `${script.length.toLocaleString()} characters · target about 1,200`;
  }
  function phraseOptions(selected = "") {
    return `<option value="">Insert from Signature Phrases</option>${phrases().map(phrase => `<option value="${html(phrase)}"${phrase === selected ? " selected" : ""}>${html(phrase)}</option>`).join("")}`;
  }
  function refreshPhraseControls() {
    ["minutePhrase1", "minutePhrase2"].forEach(id => { const select = $m(id); if (select) select.innerHTML = phraseOptions(); });
    const host = $m("signaturePhraseRows");
    if (!host) return;
    host.innerHTML = phrases().map((phrase, index) => `<div class="signature-phrase-row"><input value="${html(phrase)}" aria-label="Signature phrase ${index + 1}" data-phrase-value="${index}"><button class="button button-secondary" type="button" data-phrase-save="${index}">Save</button><button class="button button-secondary" type="button" data-phrase-delete="${index}">Delete</button></div>`).join("");
  }
  async function savePhrases(next) {
    pilot.workspaceData.signaturePhrases = next.filter(Boolean).map(value => String(value).trim()).filter(Boolean);
    await persistWorkspace();
    refreshPhraseControls();
  }
  function ownerPanelMarkup() {
    return `<summary>Integrations</summary><section class="minute-owner-panel" aria-labelledby="minutePublisherTitle"><h3 id="minutePublisherTitle">${briefTitle()}</h3><p class="pilot-muted">Medicare Minute · owner publishing</p><div class="minute-form-grid"><label>Date<input id="minuteDate" type="date" value="${localDate()}"></label><label>Headline 1<input id="minuteHeadline1" required></label><label>Ad-lib 1<input id="minuteAdlib1"><select id="minutePhrase1" aria-label="Insert from Signature Phrases for ad-lib 1">${phraseOptions()}</select></label><label>Headline 2<input id="minuteHeadline2" required></label><label>Ad-lib 2<input id="minuteAdlib2"><select id="minutePhrase2" aria-label="Insert from Signature Phrases for ad-lib 2">${phraseOptions()}</select></label><label>Headline 3<input id="minuteHeadline3" required></label><label>Field Tip<textarea id="minuteFieldTip" rows="2"></textarea></label><label>Close<textarea id="minuteClose" rows="2">Keep going. Today is the day things change.</textarea></label><label>Bumper<textarea id="minuteBumper" rows="2">Full brief in Fresh Pour.</textarea></label></div><label>Live script preview<textarea id="minuteScriptPreview" rows="12" readonly></textarea></label><p id="minuteCharacterCount" class="pilot-muted"></p><div class="minute-publish-actions"><button class="button button-secondary" id="generateMedicareMinute" type="button">Generate audio</button><button class="button button-primary" id="publishMedicareMinute" type="button">Publish</button></div><audio id="minutePreviewAudio" controls preload="metadata"></audio><p id="minuteDurationWarning" class="pilot-notice" hidden></p><p id="minutePublishStatus" class="pilot-muted" role="status"></p></section><section class="signature-phrases" aria-labelledby="signaturePhrasesTitle"><h3 id="signaturePhrasesTitle">Signature Phrases</h3><div id="signaturePhraseRows"></div><div class="signature-phrase-add"><input id="newSignaturePhrase" placeholder="Add a one-liner"><button class="button button-secondary" id="addSignaturePhrase" type="button">Add phrase</button></div></section>`;
  }
  function bindOwnerPanel(details) {
    details.querySelectorAll("input,textarea").forEach(control => control.addEventListener("input", updatePreview));
    $m("minutePhrase1").onchange = event => { $m("minuteAdlib1").value = event.target.value; updatePreview(); };
    $m("minutePhrase2").onchange = event => { $m("minuteAdlib2").value = event.target.value; updatePreview(); };
    $m("generateMedicareMinute").onclick = () => generateAudio(false);
    $m("publishMedicareMinute").onclick = () => generateAudio(true);
    $m("addSignaturePhrase").onclick = async () => { const input = $m("newSignaturePhrase"), value = input.value.trim(); if (!value) return input.focus(); await savePhrases([...phrases(), value]); input.value = ""; };
    $m("signaturePhraseRows").onclick = async event => {
      const save = event.target.closest("[data-phrase-save]"), remove = event.target.closest("[data-phrase-delete]");
      if (!save && !remove) return;
      const index = Number((save || remove).dataset[save ? "phraseSave" : "phraseDelete"]), next = phrases();
      if (save) next[index] = $m("signaturePhraseRows").querySelector(`[data-phrase-value="${index}"]`).value.trim(); else next.splice(index, 1);
      await savePhrases(next);
    };
    refreshPhraseControls(); updatePreview();
  }
  function syncOwnerPanel() {
    const menu = $m("accountMenu"), allowed = Boolean(pilot.user && isOwner(pilot.user.email));
    let details = $m("medicareMinuteIntegrations");
    if (!allowed) { details?.remove(); return; }
    if (details || !menu) return;
    details = document.createElement("details"); details.id = "medicareMinuteIntegrations"; details.innerHTML = ownerPanelMarkup();
    const password = [...menu.querySelectorAll("details")].find(item => item.querySelector("summary")?.textContent.trim() === "Password Reset");
    menu.insertBefore(details, password || null); bindOwnerPanel(details);
  }
  async function ownerToken() {
    if (!pilot.user || !isOwner(pilot.user.email)) throw new Error("Owner access is required.");
    const { data, error } = await pilot.db.auth.getSession();
    if (error || !data.session) throw error || new Error("Sign in again.");
    return data.session.access_token;
  }
  async function callFunction(payload) {
    const token = await ownerToken();
    const response = await fetch(`${String(config.supabaseUrl).replace(/\/$/, "")}/functions/v1/generate-medicare-minute`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { let message = `Request failed (${response.status}).`; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
    return response;
  }
  async function generateAudio(publish) {
    const status = $m("minutePublishStatus"), generate = $m("generateMedicareMinute"), publishButton = $m("publishMedicareMinute"), fields = scriptFields();
    if (!fields.headline1 || !fields.headline2 || !fields.headline3) { status.textContent = "Add all three required headlines."; return; }
    const script = assembleScript(fields);
    generate.disabled = publishButton.disabled = true; status.textContent = publish ? "Publishing today's brief…" : "Generating voice preview…";
    try {
      const response = await callFunction({ script, date: fields.date, brief: fields, publish });
      if (publish) {
        const result = await response.json(); status.textContent = `Published ${displayDate(result.date)}.`; await loadBriefs(); return;
      }
      const blob = await response.blob(); if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob);
      const audio = $m("minutePreviewAudio");
      audio.onloadedmetadata = () => { const seconds = Math.round(audio.duration || 0), warning = $m("minuteDurationWarning"); warning.hidden = seconds >= 50 && seconds <= 60; warning.textContent = `Target is 56 seconds. Current: ${seconds}s.`; };
      audio.src = previewUrl; await audio.play().catch(() => undefined);
      status.textContent = "Preview ready. Listen before publishing.";
    } catch (error) { status.textContent = error.message || String(error); reportError("Medicare Minute generation failed", error); }
    finally { generate.disabled = publishButton.disabled = false; }
  }
  function playerMarkup(record, compact = false) {
    if (!record?.audioUrl && !record?.audioPath) return "";
    const url = record.audioUrl || storageUrl(record.audioPath), id = `minute-player-${generateUUID()}`;
    const date = new Date(`${record.date}T12:00:00`), label = aepActive(date) ? "🎙 AEP Daily Briefing" : "🎙 Medicare brief";
    return `<div class="minute-player ${compact ? "is-compact" : ""}" data-minute-player><strong>${label} for ${html(displayDate(record.date))}</strong><audio id="${id}" preload="metadata" src="${html(url)}"></audio><div class="minute-player-controls"><button class="button button-secondary" type="button" data-minute-play>▶ Play</button><input data-minute-seek type="range" min="0" max="100" value="0" aria-label="Seek Medicare brief"><span data-minute-time>0:00 / 0:00</span></div><button class="auth-link minute-full-link" type="button" data-open-daily-brief hidden>Full brief available in Fresh Pour →</button></div>`;
  }
  function bindPlayers(root = document) {
    root.querySelectorAll("[data-minute-player]").forEach(player => {
      if (player.dataset.bound) return; player.dataset.bound = "true";
      const audio = player.querySelector("audio"), play = player.querySelector("[data-minute-play]"), seek = player.querySelector("[data-minute-seek]"), time = player.querySelector("[data-minute-time]"), link = player.querySelector("[data-open-daily-brief]");
      const clock = seconds => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, "0")}`;
      play.onclick = () => audio.paused ? audio.play() : audio.pause();
      audio.onplay = () => play.textContent = "❚❚ Pause"; audio.onpause = () => play.textContent = "▶ Play";
      audio.ontimeupdate = () => { seek.value = audio.duration ? String(audio.currentTime / audio.duration * 100) : "0"; time.textContent = `${clock(audio.currentTime)} / ${clock(audio.duration)}`; };
      seek.oninput = () => { if (audio.duration) audio.currentTime = Number(seek.value) / 100 * audio.duration; };
      audio.onended = () => { link.hidden = false; requestAnimationFrame(() => link.classList.add("is-visible")); };
      link.onclick = openDailyBrief;
    });
  }
  async function fetchRecord(path) {
    if (!config.supabaseUrl) return null;
    const response = await fetch(`${storageUrl(path)}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json(); return data.medicareMinute || null;
  }
  async function loadBriefs() {
    let latest = await fetchRecord("latest.json");
    if (!latest) { try { const response = await fetch("assets/data/news.json", { cache: "no-store" }); if (response.ok) latest = (await response.json()).medicareMinute; } catch {} }
    latestRecord = latest;
    const dates = Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - index); return localDate(date); });
    archiveRecords = (await Promise.all(dates.map(date => fetchRecord(`daily/${date}.json`)))).filter(Boolean);
    renderNotificationBrief(); renderDailyBrief();
  }
  function renderNotificationBrief() {
    const host = $m("medicareMinuteNotification"); if (!host) return;
    const today = localDate(), yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1); const yesterday = localDate(yesterdayDate);
    let record = latestRecord, note = "";
    if (!record) { host.innerHTML = `<section class="minute-notification"><strong>${briefTitle()}</strong><p>No brief posted yet today.</p></section>`; return; }
    if (record.date !== today) {
      if (record.date === yesterday) note = "<p>Today's brief is coming — here's yesterday's.</p>";
      else { host.innerHTML = `<section class="minute-notification"><strong>${briefTitle()}</strong><p>No brief posted yet today.</p></section>`; return; }
    }
    host.innerHTML = `<section class="minute-notification"><h3>${briefTitle()}</h3>${note}${playerMarkup(record, true)}</section>`; bindPlayers(host);
  }
  function contextMarkup(record) {
    const sections = [[record.headline1, record.context1], [record.headline2, record.context2], [record.headline3, record.context3]].filter(([headline]) => headline);
    return sections.map(([headline, context]) => `<section><h4>${html(headline)}</h4>${context ? `<p>${html(context)}</p>` : ""}</section>`).join("");
  }
  function renderDailyBrief() {
    const host = $m("dailyBriefContent"); if (!host) return;
    if (!latestRecord) { host.innerHTML = "<p>No brief posted yet today.</p>"; return; }
    const sources = Array.isArray(latestRecord.sources) ? latestRecord.sources : [];
    const current = `<article class="daily-brief-current"><h3>${briefTitle(new Date(`${latestRecord.date}T12:00:00`))} · ${html(displayDate(latestRecord.date))}</h3>${playerMarkup(latestRecord)}${contextMarkup(latestRecord)}${latestRecord.adlib1 ? `<blockquote>${html(latestRecord.adlib1)}</blockquote>` : ""}${latestRecord.adlib2 ? `<blockquote>${html(latestRecord.adlib2)}</blockquote>` : ""}${latestRecord.fieldTip ? `<p><strong>Field Tip:</strong> ${html(latestRecord.fieldTip)}</p>` : ""}${sources.length ? `<h4>Sources</h4><ul>${sources.map(source => `<li><a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.label || source.url)}</a></li>`).join("")}</ul>` : ""}<details><summary>Full script</summary><p class="minute-script-text">${html(latestRecord.script || "")}</p></details></article>`;
    const prior = archiveRecords.filter(item => item.date !== latestRecord.date).map(item => `<details class="daily-brief-archive-item"><summary>${html(displayDate(item.date))} · ${html(item.headline1 || "Medicare brief")}</summary>${playerMarkup(item, true)}<p class="minute-script-text">${html(item.script || "")}</p></details>`).join("");
    host.innerHTML = `${current}<section class="daily-brief-archive"><h3>Previous 30 days</h3>${prior || "<p>No earlier briefs in the archive yet.</p>"}</section>`; bindPlayers(host);
  }
  function openDailyBrief() {
    renderDailyBrief(); const dialog = $m("dailyBriefDialog"); if (!dialog.open) dialog.showModal();
  }
  function ensureDailyBriefDialog() {
    if ($m("dailyBriefDialog")) return;
    dialog("dailyBriefDialog", "Daily Brief", `<div class="fresh-page-top"><button type="button" class="button fresh-get-up" data-close="dailyBriefDialog">Get Up</button></div><div id="dailyBriefContent"><p>Loading the latest brief…</p></div>${closeButton("dailyBriefDialog")}`, true);
    $m("dailyBriefDialog").addEventListener("close", returnToMainDashboard);
  }
  function bindStaticControls() {
    ensureDailyBriefDialog();
    $m("freshDailyBriefButton").onclick = openDailyBrief;
  }
  function syncAccess() { syncOwnerPanel(); renderNotificationBrief(); }
  function init() { bindStaticControls(); syncAccess(); loadBriefs().catch(error => reportError("Medicare Minute could not load", error)); }
  window.AgentRiseMedicareMinute = { init, syncAccess, loadBriefs, briefTitle };
  init();
})();
