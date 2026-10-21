/* Agent Rise Medicare Minute: owner publishing, notification playback, and Fresh Pour archive. */
(() => {
  const DEFAULT_PHRASES = ["I smell opportunity.", "Stay in the game.", "Don't leave money on the table."];
  const $m = id => document.getElementById(id);
  let previewUrl = "";
  let latestRecord = null;
  let archiveRecords = [];
  let archiveShowOlder = false;

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
  function readerDate(value) {
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(date);
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
    const intro = `Here's your latest Medicare Brief for ${readerDate(fields.date)}.`;
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
        const result = await response.json(); status.textContent = `Published ${displayDate(result.date)} · ${Number(result.characterCount || script.length).toLocaleString()} characters via ${result.modelId || "eleven_turbo_v2_5"}.`; await loadBriefs(); return;
      }
      const sentCharacters = Number(response.headers.get("X-Script-Characters") || script.length);
      const modelId = response.headers.get("X-ElevenLabs-Model") || "eleven_turbo_v2_5";
      const blob = await response.blob(); if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob);
      const audio = $m("minutePreviewAudio");
      audio.onloadedmetadata = () => { const seconds = Math.round(audio.duration || 0), warning = $m("minuteDurationWarning"); warning.hidden = seconds >= 50 && seconds <= 60; warning.textContent = `Target is 56 seconds. Current: ${seconds}s.`; };
      audio.src = previewUrl; await audio.play().catch(() => undefined);
      status.textContent = `Preview ready · ${sentCharacters.toLocaleString()} characters via ${modelId}. Listen before publishing.`;
    } catch (error) { status.textContent = error.message || String(error); reportError("Medicare Minute generation failed", error); }
    finally { generate.disabled = publishButton.disabled = false; }
  }
  function playerMarkup(record, compact = false, shownDate = record?.date, options = {}) {
    if (!record?.audioUrl && !record?.audioPath) return "";
    const url = record.audioUrl || storageUrl(record.audioPath), id = `minute-player-${generateUUID()}`;
    const date = new Date(`${shownDate}T12:00:00`), label = aepActive(date) ? "🎙 AEP Daily Briefing" : "🎙 Medicare brief";
    const labelMarkup = options.label === false ? "" : `<strong>${html(options.label || `${label} for ${displayDate(shownDate)}`)}</strong>`;
    const fullLink = options.fullLinkVisible ? `<button class="auth-link minute-full-link is-visible" type="button" data-open-daily-brief>${html(options.fullLinkText || "Read the full brief in Fresh Pour →")}</button>` : `<button class="auth-link minute-full-link" type="button" data-open-daily-brief hidden>Full brief available in Fresh Pour →</button>`;
    return `<div class="minute-player ${compact ? "is-compact" : ""}" data-minute-player>${labelMarkup}<audio id="${id}" preload="metadata" src="${html(url)}"></audio><div class="minute-player-controls"><button class="button button-secondary" type="button" data-minute-play>▶ Play</button><input data-minute-seek type="range" min="0" max="100" value="0" aria-label="Seek Medicare brief"><span data-minute-time>0:00 / 0:00</span></div>${fullLink}</div>`;
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
      audio.onended = () => { if (link) { link.hidden = false; requestAnimationFrame(() => link.classList.add("is-visible")); } };
      if (link) link.onclick = openDailyBrief;
    });
  }
  async function fetchJson(path) {
    if (!config.supabaseUrl) return null;
    const response = await fetch(storageUrl(path), { cache: "no-store" });
    if (!response.ok) return null;
    return response.json();
  }
  function archiveEntries(manifest) {
    const listed = Array.isArray(manifest) ? manifest
      : Array.isArray(manifest?.dates) ? manifest.dates
      : Array.isArray(manifest?.archive) ? manifest.archive
      : Array.isArray(manifest?.archiveDates) ? manifest.archiveDates
      : Array.isArray(manifest?.medicareMinute?.dates) ? manifest.medicareMinute.dates
      : manifest?.medicareMinute?.date ? [manifest.medicareMinute.date]
      : manifest?.date ? [manifest.date]
      : [];
    return listed.map(entry => {
      if (entry && typeof entry === "object") {
        const date = String(entry.date || "").trim();
        const path = String(entry.path || entry.file || entry.url || "").trim();
        return date && path ? { date, path } : date ? { date, path: `public/${date}.json` } : null;
      }
      const value = String(entry || "").trim();
      if (!value) return null;
      if (/^https?:\/\//i.test(value)) return { date: value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "", url: value };
      if (value.endsWith(".json")) return { date: value.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "", path: value };
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? { date: value, path: `daily/${value}.json` } : null;
    }).filter(entry => entry?.date);
  }
  async function fetchArchiveRecord(entry) {
    const response = entry.url
      ? await fetch(entry.url, { cache: "no-store" })
      : await fetch(storageUrl(entry.path), { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    const record = data.medicareMinute || data;
    return record && typeof record === "object" ? { ...record, date: record.date || entry.date } : null;
  }
  async function storageArchiveEntries() {
    if (!pilot.db?.storage) return [];
    const { data, error } = await pilot.db.storage.from("medicare-minute").list("daily", { limit: 100, offset: 0, sortBy: { column: "name", order: "desc" } });
    if (error) { console.warn("Medicare Minute Storage archive list unavailable:", error.message); return []; }
    return (data || []).map(item => String(item.name || "").match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1]).filter(Boolean).map(date => ({ date, path: `daily/${date}.json` }));
  }
  async function localNewsData() {
    try { const response = await fetch("assets/data/news.json", { cache: "no-store" }); return response.ok ? response.json() : null; }
    catch { return null; }
  }
  function embeddedRecords(data) {
    if (!data || typeof data !== "object") return [];
    const records = [data.medicareMinute, ...(Array.isArray(data.archive) ? data.archive : [])];
    return records.filter(record => record && typeof record === "object" && record.date && (record.script || record.fullText || record.text || record.audioPath || record.audioUrl));
  }
  function uniqueBriefRecords(records) {
    const byDate = new Map();
    records.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach(record => { if (!byDate.has(record.date)) byDate.set(record.date, record); });
    return [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  async function loadBriefs() {
    try {
      const [manifest, listedEntries, localNews] = await Promise.all([fetchJson("latest.json").then(value => value || fetchJson("public/latest.json")), storageArchiveEntries(), localNewsData()]);
      const directRecord = manifest?.medicareMinute || (manifest?.date && (manifest?.script || manifest?.audioPath || manifest?.audioUrl) ? manifest : null);
      const entriesByDate = new Map([...archiveEntries(manifest), ...archiveEntries(localNews), ...listedEntries].map(entry => [entry.date, entry]));
      const fetched = (await Promise.all([...entriesByDate.values()].map(fetchArchiveRecord))).filter(Boolean);
      archiveRecords = uniqueBriefRecords([directRecord, ...embeddedRecords(localNews), ...fetched]);
      latestRecord = directRecord || archiveRecords[0] || null;
      archiveShowOlder = false;
      renderNotificationBrief();
    } catch (err) {
      console.warn("Medicare Minute archive failed to load:", err);
      latestRecord = null;
      archiveRecords = [];
      try {
        renderNotificationBrief();
      } catch (renderErr) {
        console.warn("Medicare Minute empty state failed to render:", renderErr);
      }
    }
    return archiveRecords;
  }
  function renderNotificationBrief() {
    const host = $m("medicareMinuteNotification"); if (!host) return;
    host.hidden = false;
    const record = latestRecord;
    if (!record) { host.innerHTML = '<p class="notification-empty">No Daily Brief has been posted yet.</p>'; return; }
    host.innerHTML = `<section class="minute-notification minute-notification-audio"><p><strong>Latest Daily Brief — ${html(displayDate(record.date || localDate()))}</strong></p>${playerMarkup(record, true, record.date || localDate(), { label: false, fullLinkVisible: true, fullLinkText: "Read the full brief in Fresh Pour →" })}</section>`; bindPlayers(host);
  }
  function contextMarkup(record) {
    const sections = [[record.headline1, record.context1], [record.headline2, record.context2], [record.headline3, record.context3]].filter(([headline]) => headline);
    return sections.map(([headline, context]) => `<section><h4>${html(headline)}</h4>${context ? `<p>${html(context)}</p>` : ""}</section>`).join("");
  }
  function recordText(record) { return String(record?.script || record?.fullText || record?.text || "").trim(); }
  function recordPreview(record) { const first = String(record?.headline1 || recordText(record).split(/\n+/).find(line => line.trim()) || "Daily Brief").trim(); return first.length > 130 ? `${first.slice(0, 127)}…` : first; }
  function recordAudioUrl(record) { return record?.audioUrl || (record?.audioPath ? storageUrl(record.audioPath) : ""); }
  function archiveItemMarkup(record) {
    const text = recordText(record), audioUrl = recordAudioUrl(record), key = html(record.date || generateUUID());
    return `<article class="daily-brief-archive-item" data-brief-archive-item="${key}"><div class="daily-brief-archive-summary"><div><strong>${html(displayDate(record.date))}</strong><p>${html(recordPreview(record))}</p></div><div class="daily-brief-archive-actions">${audioUrl ? '<button class="button button-secondary" type="button" data-archive-play>▶ Play</button>' : ''}<button class="button button-secondary" type="button" data-archive-read aria-expanded="false">Read</button></div></div>${audioUrl ? `<audio preload="metadata" src="${html(audioUrl)}"></audio>` : ''}<div class="daily-brief-archive-body" hidden><p class="minute-script-text">${html(text || "No text is available for this brief.")}</p><div class="daily-brief-downloads">${audioUrl ? `<a class="button button-secondary" href="${html(audioUrl)}" download="daily-brief-${key}.mp3">Download MP3</a>` : ''}${text ? `<button class="button button-secondary" type="button" data-archive-text-download data-archive-date="${key}">Download text</button>` : ''}</div></div></article>`;
  }
  function filteredArchive(query = "") {
    const latestDate = String(latestRecord?.date || ""), needle = String(query).trim().toLowerCase();
    return archiveRecords.filter(record => String(record.date) !== latestDate).filter(record => !needle || `${record.date} ${displayDate(record.date)} ${recordPreview(record)} ${recordText(record)}`.toLowerCase().includes(needle));
  }
  function renderArchiveList(root, query = "") {
    const list = root.querySelector("[data-brief-archive-list]"), olderButton = root.querySelector("[data-load-older-briefs]"); if (!list) return;
    const all = filteredArchive(query), cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 29); cutoff.setHours(0, 0, 0, 0);
    const recent = all.filter(record => Date.parse(`${record.date}T23:59:59`) >= cutoff.getTime()), shown = archiveShowOlder || query ? all : recent, hasOlder = all.length > recent.length;
    list.innerHTML = shown.length ? shown.map(archiveItemMarkup).join("") : '<p class="notification-empty">No previous briefs match this view.</p>';
    if (olderButton) { olderButton.hidden = !hasOlder || archiveShowOlder || Boolean(query); olderButton.textContent = "Load older"; }
    bindArchiveControls(root);
  }
  function bindArchiveControls(root) {
    root.querySelectorAll("[data-brief-archive-item]").forEach(item => {
      const audio = item.querySelector("audio"), play = item.querySelector("[data-archive-play]"), read = item.querySelector("[data-archive-read]"), body = item.querySelector(".daily-brief-archive-body"), download = item.querySelector("[data-archive-text-download]");
      if (play && audio) { play.onclick = () => { root.querySelectorAll("audio").forEach(other => { if (other !== audio) other.pause(); }); if (audio.paused) audio.play().catch(() => undefined); else audio.pause(); }; audio.onplay = () => play.textContent = "❚❚ Pause"; audio.onpause = () => play.textContent = "▶ Play"; }
      if (read && body) read.onclick = () => { const open = body.hidden; body.hidden = !open; read.setAttribute("aria-expanded", String(open)); read.textContent = open ? "Hide" : "Read"; };
      if (download) download.onclick = () => { const record = archiveRecords.find(entry => entry.date === download.dataset.archiveDate), blob = new Blob([recordText(record)], { type: "text/plain;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `daily-brief-${download.dataset.archiveDate}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    });
  }
  function archiveMarkup() { return `<section class="daily-brief-archive" aria-labelledby="previousBriefsTitle"><h3 id="previousBriefsTitle">Previous Briefs</h3><label class="daily-brief-search">Search briefs<input type="search" data-brief-archive-search placeholder="Search by text or date"></label><div data-brief-archive-list></div><button class="button button-secondary" type="button" data-load-older-briefs>Load older</button></section>`; }
  function bindArchive(root) {
    const search = root.querySelector("[data-brief-archive-search]"), older = root.querySelector("[data-load-older-briefs]");
    if (search) search.oninput = () => renderArchiveList(root, search.value);
    if (older) older.onclick = () => { archiveShowOlder = true; renderArchiveList(root, search?.value || ""); };
    renderArchiveList(root, "");
  }
  function renderInto(host) {
    if (!host) return;
    if (!latestRecord) { host.innerHTML = "<p>No Medicare Minute archive yet.</p>"; return; }
    const today = localDate(), sources = Array.isArray(latestRecord.sources) ? latestRecord.sources : [];
    host.innerHTML = `<article class="discipline-brief-card"><h3>Daily Brief</h3><p class="daily-brief-date">${html(displayDate(today))}</p>${playerMarkup(latestRecord, false, today, { label: `🎙 Daily Brief for ${displayDate(today)}` })}${contextMarkup(latestRecord)}${latestRecord.fieldTip ? `<p><strong>Field Tip:</strong> ${html(latestRecord.fieldTip)}</p>` : ""}<details><summary>Full brief text</summary><p class="minute-script-text">${html(recordText(latestRecord))}</p></details><div class="fresh-brief-links"><a href="#fresh-library" data-fresh-brief-target="library"><strong>Explore More with ARP Library</strong></a><a href="#fresh-library" data-fresh-brief-target="library">Library</a><a href="#fresh-blueprint" data-fresh-brief-target="blueprint">Medicare Blueprint</a><a href="#fresh-carriers" data-fresh-brief-target="jit">JIT Carriers</a></div>${sources.length ? `<ul>${sources.map(source => `<li><a href="${html(source.url)}" target="_blank" rel="noopener noreferrer">${html(source.label || source.url)}</a></li>`).join("")}</ul>` : ""}</article>${archiveMarkup()}`;
    bindPlayers(host); bindExploreLinks(host); bindArchive(host);
  }
  async function openDailyBrief() {
    $m("openBreakroomButton")?.click();
    setTimeout(() => {
      if ($m("breakroomPanel")?.classList.contains("is-hidden")) $m("toggleBreakroomMenuButton")?.click();
      if ($m("freshPourBriefPanel")?.hidden) $m("potButton")?.click();
    }, 250);
  }
  function bindStaticControls() {
    const dailyBriefButton = $m("freshDailyBriefButton");
    if (dailyBriefButton) dailyBriefButton.onclick = openDailyBrief;
  }
  function bindExploreLinks(root = document) { root.querySelectorAll("[data-fresh-brief-target]").forEach(link => { if (link.dataset.bound) return; link.dataset.bound = "true"; link.addEventListener("click", event => { event.preventDefault(); window.AgentRiseOpenFreshBriefTarget?.(link.dataset.freshBriefTarget); }); }); }
  function syncAccess() { syncOwnerPanel(); renderNotificationBrief(); }
  function init() { bindStaticControls(); bindExploreLinks(document); syncAccess(); }
  window.AgentRiseMedicareMinute = { init, syncAccess, loadBriefs, briefTitle, renderInto };
  init();
})();

