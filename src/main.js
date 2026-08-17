import { formatParticipantLabel, listCabangs, parseParticipantsCsv, sortParticipants, summarizeParticipants } from "./csv.js";
import { eligibleParticipants, genderModeLabel, normalizeGenderMode } from "./teams.js";
import { formatPicLine, getGame } from "./games.js";
import { memberIdFromPerson } from "./draws.js";
import { api } from "./api.js";
import {
  RIGHTS,
  ROLE_PRESETS,
  firstAllowedView,
  hasRight,
  rightsForRole,
  viewForRight,
} from "./auth.js";

const VIEWS = {
  peserta: { eyebrow: "Peserta", title: "Data peserta" },
  daftar: { eyebrow: "Daftar", title: "Seluruh peserta" },
  dashboard: { eyebrow: "Dashboard", title: "Beranda" },
  permainan: { eyebrow: "Permainan", title: "Jenis permainan" },
  pembagian: { eyebrow: "Pembagian", title: "Bagi grup & hasil" },
  pengguna: { eyebrow: "Pengguna", title: "Hak akses" },
};

const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const fileStatus = document.querySelector("#file-status");
const fileName = document.querySelector("#file-name");
const dataPanel = document.querySelector("#data-panel");
const resultPanel = document.querySelector("#result-panel");
const resultEmpty = document.querySelector("#result-empty");
const drawEmpty = document.querySelector("#draw-empty");
const statsEl = document.querySelector("#stats");
const rowsEl = document.querySelector("#participant-rows");
const participantSortSelect = document.querySelector("#participant-sort");
const directorySortSelect = document.querySelector("#directory-sort");
const directoryRows = document.querySelector("#directory-rows");
const directoryCount = document.querySelector("#directory-count");
const drawInfo = document.querySelector("#draw-info");
const drawPoolHint = document.querySelector("#draw-pool-hint");
const drawLockedHint = document.querySelector("#draw-locked-hint");
const drawGameSelect = document.querySelector("#draw-game");
const drawSubmit = document.querySelector("#draw-submit");
const reshuffleBtn = document.querySelector("#reshuffle");
const resetDrawBtn = document.querySelector("#reset-draw");
const gameGrid = document.querySelector("#game-grid");
const gamesEmpty = document.querySelector("#games-empty");
const gameEditor = document.querySelector("#game-editor");
const gameEditId = document.querySelector("#game-edit-id");
const gameNameInput = document.querySelector("#game-name");
const gameTeamCountInput = document.querySelector("#game-team-count");
const gameMembersInput = document.querySelector("#game-members");
const gameGroupsPerSessionInput = document.querySelector("#game-groups-per-session");
const gameGenderModeInput = document.querySelector("#game-gender-mode");
const gamePic1Cabang = document.querySelector("#game-pic-1-cabang");
const gamePic2Cabang = document.querySelector("#game-pic-2-cabang");
const gamePic1Input = document.querySelector("#game-pic-1");
const gamePic2Input = document.querySelector("#game-pic-2");
const gameDescriptionInput = document.querySelector("#game-description");
const participantEditor = document.querySelector("#participant-editor");
const participantCards = document.querySelector("#participant-cards");
const gameError = document.querySelector("#game-error");
const configForm = document.querySelector("#config-form");
const configError = document.querySelector("#config-error");
const tourneyBoard = document.querySelector("#tourney-board");
const editTeamsBtn = document.querySelector("#edit-teams");
const teamEditorPanel = document.querySelector("#team-editor-panel");
const teamEditorGrid = document.querySelector("#team-editor-grid");
const teamEditorError = document.querySelector("#team-editor-error");
const teamEditorSave = document.querySelector("#team-editor-save");
const teamEditorCancel = document.querySelector("#team-editor-cancel");
const cloudStatus = document.querySelector("#cloud-status");
const clearBtn = document.querySelector("#clear-cloud");
const dashboardGames = document.querySelector("#dashboard-games");
const dashboardTop = document.querySelector("#dashboard-top");
const sidebar = document.querySelector("#sidebar");
const navBackdrop = document.querySelector("#nav-backdrop");
const viewEyebrow = document.querySelector("#view-eyebrow");
const viewTitle = document.querySelector("#view-title");
const appShell = document.querySelector("#app-shell");
const authScreen = document.querySelector("#auth-screen");
const setupForm = document.querySelector("#setup-form");
const loginForm = document.querySelector("#login-form");
const userList = document.querySelector("#user-list");
const userEditor = document.querySelector("#user-editor");
const userRights = document.querySelector("#user-rights");
const userRole = document.querySelector("#user-role");

let participants = [];
let games = [];
let lastResult = null;
let selectedGameId = "";
let currentView = "dashboard";
let draws = [];
let currentUser = null;
let users = [];
let participantSort = "nama-asc";
let directorySort = "nama-asc";
let teamEditorOpen = false;

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
}

function setCloudStatus(message, kind = "ok") {
  cloudStatus.textContent = message;
  cloudStatus.dataset.kind = kind;
  show(cloudStatus);
}

function selectedGame() {
  return getGame(selectedGameId, games);
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function drawForGame(gameId) {
  return draws.find((draw) => draw.gameId === gameId);
}

function poolForGame(game) {
  if (!game) return [];
  return eligibleParticipants(participants, {
    genderMode: game.genderMode || "campur",
    picIds: [game.pic1Id, game.pic2Id],
  });
}

function closeSidebar() {
  sidebar.classList.remove("is-open");
  hide(navBackdrop);
}

function openSidebar() {
  sidebar.classList.add("is-open");
  show(navBackdrop);
}

function can(right) {
  return hasRight(currentUser, right);
}

function canOpenView(name) {
  if (name === "dashboard") return can("pembagian") || can("hasil") || can("permainan");
  if (name === "daftar") return can("daftar");
  const view = viewForRight(name);
  if (view === "pembagian") return can("pembagian") || can("hasil");
  return can(view);
}

function showView(name) {
  const view = viewForRight(name);
  if (!VIEWS[view]) return;
  if (!canOpenView(view)) {
    const fallback = firstAllowedView(currentUser);
    if (fallback && fallback !== view) {
      showView(fallback);
    }
    return;
  }
  currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("hidden", section.id !== `view-${view}`);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", viewForRight(button.dataset.view) === view);
  });
  viewEyebrow.textContent = VIEWS[view].eyebrow;
  viewTitle.textContent =
    view === "pembagian" && lastResult?.gameName ? lastResult.gameName : VIEWS[view].title;
  closeSidebar();
  if (view === "pembagian") {
    updateDrawPanel();
    loadDrawForSelectedGame();
  }
  if (view === "dashboard") loadDashboard();
  if (view === "daftar") renderParticipantDirectory(participants);
  if (view === "permainan" && !games.length && can("permainan")) openGameEditor();
  if (view === "pengguna") loadUsers();
}

function applyAccessUi() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("hidden", !canOpenView(button.dataset.view));
  });
  const name = currentUser?.displayName || currentUser?.username || "Pengguna";
  const role = currentUser?.role || "";
  document.querySelectorAll(".user-chip").forEach((el) => {
    el.textContent = role ? `${name} · ${role}` : name;
  });
  document.querySelector("#clear-cloud")?.classList.toggle("hidden", !(isAdmin() && participants.length));
  document.querySelector("#add-game")?.classList.toggle("hidden", !can("permainan"));
  document.querySelector("#add-participant")?.classList.toggle("hidden", !can("peserta"));
  document.body.classList.toggle("can-edit-peserta", can("peserta"));
  document.querySelector("#upload-panel")?.classList.toggle("hidden", !can("peserta"));
  document.querySelector("#draw-panel")?.classList.toggle("hidden", !can("pembagian"));
  updateDrawPanel();
}

function selectedRights() {
  return [...userRights.querySelectorAll("input:checked")].map((input) => input.value);
}

function setGames(list, { keepSelection = true } = {}) {
  games = Array.isArray(list) ? list : [];
  if (!games.length) {
    selectedGameId = "";
  } else if (!keepSelection || !games.some((game) => game.id === selectedGameId)) {
    selectedGameId = games[0].id;
  }
  renderGamePicker();
  updateDrawPanel();
}

function renderDrawInfo(game, existingDraw) {
  if (!game) {
    hide(drawInfo);
    drawInfo.innerHTML = "";
    return;
  }

  const needed = game.teamCount * game.members;
  const pool = poolForGame(game);
  const enough = pool.length >= needed;
  const firstRoundSessions = Math.max(1, Math.ceil(game.teamCount / game.groupsPerSession));
  const pic1 = formatPicLine(game.pic1Name, game.pic1Cabang);
  const pic2 = formatPicLine(game.pic2Name, game.pic2Cabang);
  const drawDone = Boolean(existingDraw);
  let drawMeta = "Belum diacak";
  if (drawDone && lastResult?.gameId === game.id && lastResult?.bracket?.champion) {
    drawMeta = `Selesai · Juara ${lastResult.bracket.champion.name}`;
  } else if (drawDone && lastResult?.gameId === game.id) {
    drawMeta = `Berjalan · ${bracketProgressLabel(lastResult.bracket)}`;
  } else if (drawDone) {
    drawMeta = "Sudah diacak";
  }

  show(drawInfo);
  drawInfo.innerHTML = `
    <header class="draw-info-head">
      <div>
        <h3>${escapeHtml(game.name)}</h3>
        ${game.description ? `<p class="draw-info-desc">${escapeHtml(game.description)}</p>` : ""}
      </div>
      <span class="draw-info-status${drawDone ? " is-done" : ""}${enough ? "" : " is-warn"}">${escapeHtml(drawMeta)}</span>
    </header>
    <dl class="draw-info-grid">
      <div><dt>Komposisi</dt><dd>${escapeHtml(genderModeLabel(game.genderMode))}</dd></div>
      <div><dt>Struktur grup</dt><dd>${game.teamCount} grup × ${game.members} org</dd></div>
      <div><dt>Kebutuhan peserta</dt><dd>${needed} org</dd></div>
      <div><dt>Grup per sesi</dt><dd>${game.groupsPerSession} tim (${firstRoundSessions} sesi babak awal)</dd></div>
      <div><dt>Peserta siap</dt><dd class="${enough ? "" : "is-warn"}">${pool.length} / ${needed}</dd></div>
      <div><dt>PIC</dt><dd>${escapeHtml(pic1 || "—")}<br />${escapeHtml(pic2 || "—")}</dd></div>
    </dl>`;
  const hasOtherDraws = draws.some((draw) => draw.gameId && draw.gameId !== game.id);
  drawPoolHint.textContent = enough
    ? drawDone
      ? "Hasil undian dan bagan gugur tampil di bawah."
      : hasOtherDraws
        ? "Parameter dari menu Permainan. Peserta yang belum pernah main di permainan lain diprioritaskan saat acak."
        : "Parameter dari menu Permainan. Klik Acak grup untuk memulai."
    : `Peserta tidak cukup (${pool.length}/${needed} setelah PIC & exclude).`;
  drawPoolHint.classList.toggle("is-warn", !enough);
}

function bracketProgressLabel(bracket) {
  if (!bracket?.rounds?.length) return "0% sesi";
  let total = 0;
  let done = 0;
  for (const round of bracket.rounds) {
    for (const match of round.matches || []) {
      const teams = (match.teams || []).filter((team) => team && !team.pending);
      if (teams.length < 1) continue;
      total += 1;
      if (match.winnerNumber) done += 1;
    }
  }
  if (!total) return bracket?.champion ? "100% sesi" : "0% sesi";
  return `${Math.round((done / total) * 100)}% sesi`;
}

function chartWidth(value, max) {
  const safeMax = Math.max(1, max);
  return Math.max(4, Math.round((Number(value) / safeMax) * 100));
}

function renderGameProgressChart(games) {
  if (!games.length) {
    return `<p class="hint">Belum ada permainan.</p>`;
  }
  return games
    .map(
      (game) => `
    <div class="chart-row">
      <div class="chart-label">
        <strong>${escapeHtml(game.name)}</strong>
        <small>${dashboardStatusLabel(game.status)}${
          game.champion ? ` · ${escapeHtml(game.champion)}` : game.hasDraw ? ` · ${game.progress || 0}%` : ""
        }</small>
      </div>
      <div class="chart-track" role="img" aria-label="${escapeHtml(game.name)} ${game.progress || 0}%">
        <div class="chart-bar is-progress is-${escapeHtml(game.status)}" style="width:${game.progress || 0}%">
          <span>${game.progress || 0}%</span>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function renderParticipantChart(people) {
  if (!people.length) {
    return `<p class="hint">Belum ada peserta yang ikut permainan.</p>`;
  }
  const maxGames = Math.max(1, ...people.map((person) => person.games || 0));
  const maxWins = Math.max(1, ...people.map((person) => person.wins || 0));
  return people
    .map(
      (person, index) => `
    <div class="chart-row">
      <div class="chart-label">
        <span class="chart-rank">${index + 1}</span>
        <div>
          <strong>${escapeHtml(formatParticipantLabel(person.nama, person.cabang))}</strong>
          <small>${person.games || 0} permainan · ${person.wins || 0} menang</small>
        </div>
      </div>
      <div class="chart-track chart-track-dual">
        <div class="chart-bar is-games" style="width:${chartWidth(person.games, maxGames)}%" title="${person.games || 0} permainan">
          <span>${person.games || 0}</span>
        </div>
        <div class="chart-bar is-wins" style="width:${chartWidth(person.wins, maxWins)}%" title="${person.wins || 0} menang">
          <span>${person.wins || 0}</span>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function renderDrawSummary(game) {
  renderDrawInfo(game, drawForGame(selectedGameId));
}

function updateDrawPanel() {
  renderGameSelect();
  const game = selectedGame();
  const existing = drawForGame(selectedGameId);
  renderDrawSummary(game);
  const ready = Boolean(participants.length && games.length && game);
  const canDraw = can("pembagian");
  configForm.classList.toggle("hidden", !canDraw || !ready);
  drawEmpty.classList.toggle("hidden", !canDraw || ready);
  if (canDraw && !ready) {
    drawEmpty.textContent = !participants.length
      ? "Unggah peserta dulu di menu Peserta."
      : "Tambah permainan di menu Permainan.";
  }
  const locked = Boolean(existing);
  drawSubmit.classList.toggle("hidden", locked);
  drawLockedHint.classList.toggle("hidden", !locked);
  reshuffleBtn.classList.toggle("hidden", !locked || !isAdmin());
  resetDrawBtn.classList.toggle("hidden", !locked || !isAdmin());
  drawSubmit.disabled = !game || poolForGame(game).length < (game?.teamCount || 0) * (game?.members || 0);
}

function dashboardStatusLabel(status) {
  if (status === "selesai") return "Selesai";
  if (status === "berjalan") return "Berjalan";
  return "Belum diacak";
}

async function loadDashboard() {
  if (!canOpenView("dashboard")) return;
  try {
    renderDashboard(await api("/api/dashboard"));
  } catch (error) {
    dashboardGames.innerHTML = `<p class="hint">${escapeHtml(error.message)}</p>`;
    dashboardTop.innerHTML = "";
  }
}

function renderDashboard(data) {
  const gameRows = data?.games || [];
  dashboardGames.innerHTML = renderGameProgressChart(gameRows);
  dashboardTop.innerHTML = renderParticipantChart(data?.topParticipants || []);
}

async function loadDrawForSelectedGame() {
  const existing = drawForGame(selectedGameId);
  if (!existing || !(can("pembagian") || can("hasil"))) {
    lastResult = null;
    hide(resultPanel);
    show(resultEmpty);
    return;
  }
  try {
    renderResult(await api(`/api/draws/${existing.id}`));
  } catch {
    lastResult = null;
    hide(resultPanel);
    show(resultEmpty);
  }
}

function renderGamePicker() {
  if (!games.length) {
    show(gamesEmpty);
    hide(gameGrid);
    gameGrid.innerHTML = "";
    return;
  }

  hide(gamesEmpty);
  show(gameGrid);
  gameGrid.innerHTML = games
    .map(
      (game) => `
      <article class="game-card" data-game-id="${escapeHtml(game.id)}">
        <div class="game-card-body">
          <span class="game-card-name">${escapeHtml(game.name)}</span>
          <span class="game-card-size">${game.teamCount} grup · ${game.members} org · ${game.groupsPerSession} /sesi · ${escapeHtml(genderModeLabel(game.genderMode))}</span>
          <span class="game-card-size">PIC 1: ${escapeHtml(formatPicLine(game.pic1Name, game.pic1Cabang) || "belum dipilih")}</span>
          <span class="game-card-size">PIC 2: ${escapeHtml(formatPicLine(game.pic2Name, game.pic2Cabang) || "belum dipilih")}</span>
          <span class="game-card-desc">${escapeHtml(game.description || "Tidak ada penjelasan.")}</span>
        </div>
        <div class="game-card-actions">
          <button type="button" class="text-btn" data-game-action="edit" data-game-id="${escapeHtml(game.id)}">Ubah</button>
          <button type="button" class="text-btn danger-text" data-game-action="delete" data-game-id="${escapeHtml(game.id)}">Hapus</button>
        </div>
      </article>
    `,
    )
    .join("");
}

function renderGameSelect() {
  const current = selectedGameId;
  drawGameSelect.innerHTML = [
    `<option value="">Pilih permainan</option>`,
    ...games.map(
      (game) =>
        `<option value="${escapeHtml(game.id)}" ${game.id === current ? "selected" : ""}>${escapeHtml(game.name)}</option>`,
    ),
  ].join("");
}

function applyGame(gameId) {
  if (!gameId) {
    selectedGameId = "";
    renderGamePicker();
    updateDrawPanel();
    loadDrawForSelectedGame();
    return;
  }
  const game = games.find((item) => item.id === gameId);
  if (!game) {
    selectedGameId = "";
    renderGamePicker();
    updateDrawPanel();
    loadDrawForSelectedGame();
    return;
  }
  selectedGameId = game.id;
  renderGamePicker();
  updateDrawPanel();
  loadDrawForSelectedGame();
}

function closeGameEditor() {
  hide(gameEditor);
  hide(gameError);
  gameEditor.reset();
  gameEditId.value = "";
}

function openGameEditor(game) {
  hide(gameError);
  if (game) {
    gameEditId.value = game.id;
    gameNameInput.value = game.name;
    gameDescriptionInput.value = game.description || "";
    gameTeamCountInput.value = String(game.teamCount);
    gameMembersInput.value = String(game.members);
    gameGroupsPerSessionInput.value = String(game.groupsPerSession || 2);
    gameGenderModeInput.value = normalizeGenderMode(game.genderMode);
    fillPicSelects(game.pic1Id, game.pic2Id);
  } else {
    gameEditId.value = "";
    gameNameInput.value = "";
    gameDescriptionInput.value = "";
    gameTeamCountInput.value = "";
    gameMembersInput.value = "";
    gameGroupsPerSessionInput.value = "2";
    gameGenderModeInput.value = "campur";
    fillPicSelects("", "");
  }
  show(gameEditor);
  gameNameInput.focus();
}

function personById(id) {
  return participants.find((person) => Number(person.id) === Number(id));
}

function fillPicPair(cabangSelect, personSelect, cabang, personId) {
  const cabangs = listCabangs(participants);
  cabangSelect.innerHTML = [
    `<option value="">Pilih cabang</option>`,
    ...cabangs.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`),
  ].join("");
  const chosen = cabang && cabangs.includes(cabang) ? cabang : "";
  cabangSelect.value = chosen;
  const people = chosen ? participants.filter((person) => person.cabang === chosen) : [];
  personSelect.innerHTML = [
    `<option value="">Pilih peserta</option>`,
    ...people.map(
      (person) =>
        `<option value="${person.id}">${escapeHtml(formatParticipantLabel(person.nama, person.cabang))}</option>`,
    ),
  ].join("");
  personSelect.value =
    personId && people.some((person) => Number(person.id) === Number(personId)) ? String(personId) : "";
  personSelect.disabled = !chosen;
}

function fillPicSelects(pic1Id, pic2Id) {
  const pic1 = personById(pic1Id);
  const pic2 = personById(pic2Id);
  fillPicPair(gamePic1Cabang, gamePic1Input, pic1?.cabang, pic1Id);
  fillPicPair(gamePic2Cabang, gamePic2Input, pic2?.cabang, pic2Id);
}

function renderParticipantDirectory(list) {
  const sorted = sortParticipants(list, directorySort);
  if (directoryCount) {
    directoryCount.textContent = sorted.length ? `${sorted.length} peserta` : "Belum ada peserta.";
  }
  if (!directoryRows) return;
  directoryRows.innerHTML = sorted.length
    ? sorted
        .map(
          (person, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(person.nama)}</td>
          <td>${escapeHtml(person.cabang)}</td>
          <td>${genderBadge(person.jenisKelamin)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty-cell">Belum ada peserta.</td></tr>`;
}

function renderParticipants(list) {
  const sorted = sortParticipants(list, participantSort);
  const summary = summarizeParticipants(list);
  statsEl.innerHTML = [
    ["Total peserta", summary.total],
    ["Laki-laki", summary.laki],
    ["Perempuan", summary.perempuan],
    ["Tidak ikut", summary.excluded],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");

  rowsEl.innerHTML = sorted
    .map(
      (person, index) => `
        <tr class="${person.excluded ? "is-excluded" : ""}">
          <td>${index + 1}</td>
          <td>${escapeHtml(formatParticipantLabel(person.nama, person.cabang))}</td>
          <td>${genderBadge(person.jenisKelamin)}</td>
          <td>${person.excluded ? "Tidak ikut" : "Ikut"}</td>
          <td>
            <button type="button" class="text-btn" data-person-action="edit" data-person-id="${person.id}">Ubah</button>
            <button type="button" class="text-btn" data-person-action="exclude" data-person-id="${person.id}">${person.excluded ? "Ikutkan" : "Exclude"}</button>
            <button type="button" class="text-btn danger-text" data-person-action="delete" data-person-id="${person.id}">Hapus</button>
          </td>
        </tr>
      `,
    )
    .join("");

  participantCards.innerHTML = sorted
    .map(
      (person) => `
        <article class="person-card ${person.excluded ? "is-excluded" : ""}">
          <div>
            <strong>${escapeHtml(formatParticipantLabel(person.nama, person.cabang))}</strong>
            <span class="user-meta">${genderBadge(person.jenisKelamin)}</span>
            <span class="user-meta">${person.excluded ? "Tidak ikut permainan" : "Ikut undian"}</span>
          </div>
          <div class="game-card-actions">
            <button type="button" class="text-btn" data-person-action="edit" data-person-id="${person.id}">Ubah</button>
            <button type="button" class="text-btn" data-person-action="exclude" data-person-id="${person.id}">${person.excluded ? "Ikutkan" : "Exclude"}</button>
            <button type="button" class="text-btn danger-text" data-person-action="delete" data-person-id="${person.id}">Hapus</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function genderBadge(value) {
  const cls = value === "Laki-laki" ? "pria" : value === "Perempuan" ? "wanita" : "";
  return `<span class="gender ${cls}">${escapeHtml(value)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showParticipantData(list, name, { saved = true } = {}) {
  participants = list;
  fileStatus.textContent = `${list.length} peserta ${saved ? "tersimpan di Cloudflare D1" : "siap disimpan"}${
    name ? ` (${name})` : ""
  }.`;
  fileName.textContent = name || "Cloudflare D1";
  renderParticipants(list);
  renderParticipantDirectory(list);
  applyGame(selectedGameId);
  show(dataPanel);
  if (list.length) show(clearBtn);
  else hide(clearBtn);
  hide(configError);
}

async function persistParticipants(list, name) {
  const saved = await api("/api/participants", {
    method: "PUT",
    body: JSON.stringify({ filename: name, participants: list }),
  });
  showParticipantData(saved.participants, saved.filename || name);
  setCloudStatus(`${saved.participants.length} peserta tersimpan di Cloudflare D1`);
  hide(resultPanel);
  show(resultEmpty);
  lastResult = null;
  await refreshDrawHistory();
}

function openParticipantEditor(person) {
  hide(document.querySelector("#participant-error"));
  if (person) {
    document.querySelector("#participant-edit-id").value = String(person.id);
    document.querySelector("#participant-name").value = person.nama;
    document.querySelector("#participant-gender").value =
      person.jenisKelamin === "Perempuan" ? "Perempuan" : "Laki-laki";
    document.querySelector("#participant-cabang").value = person.cabang === "-" ? "" : person.cabang;
    document.querySelector("#participant-excluded").checked = Boolean(person.excluded);
  } else {
    document.querySelector("#participant-edit-id").value = "";
    participantEditor.reset();
    document.querySelector("#participant-excluded").checked = false;
  }
  show(participantEditor);
  document.querySelector("#participant-name").focus();
}

function closeParticipantEditor() {
  hide(participantEditor);
  hide(document.querySelector("#participant-error"));
  participantEditor.reset();
}

function participantPayload() {
  return {
    nama: document.querySelector("#participant-name").value,
    jenisKelamin: document.querySelector("#participant-gender").value,
    cabang: document.querySelector("#participant-cabang").value,
    excluded: document.querySelector("#participant-excluded").checked,
  };
}

async function saveParticipant(event) {
  event.preventDefault();
  const errorEl = document.querySelector("#participant-error");
  hide(errorEl);
  const editingId = document.querySelector("#participant-edit-id").value;
  try {
    const saved = editingId
      ? await api(`/api/participants/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(participantPayload()),
        })
      : await api("/api/participants", {
          method: "POST",
          body: JSON.stringify(participantPayload()),
        });
    showParticipantData(saved.participants, saved.filename || "Cloudflare D1");
    closeParticipantEditor();
    setCloudStatus(editingId ? "Peserta diperbarui" : "Peserta ditambahkan");
  } catch (error) {
    errorEl.textContent = error.message;
    show(errorEl);
  }
}

async function toggleExclude(id) {
  const person = participants.find((item) => String(item.id) === String(id));
  if (!person) return;
  try {
    const saved = await api(`/api/participants/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...person, excluded: !person.excluded }),
    });
    showParticipantData(saved.participants, "Cloudflare D1");
    setCloudStatus(
      person.excluded
        ? `${formatParticipantLabel(person.nama, person.cabang)} diikutkan lagi`
        : `${formatParticipantLabel(person.nama, person.cabang)} di-exclude dari permainan`,
    );
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

async function removeParticipant(id) {
  const person = participants.find((item) => String(item.id) === String(id));
  if (!person || !confirm(`Hapus peserta “${formatParticipantLabel(person.nama, person.cabang)}”?`)) return;
  try {
    const saved = await api(`/api/participants/${id}`, { method: "DELETE" });
    showParticipantData(saved.participants, "Cloudflare D1");
    setCloudStatus(`Peserta ${formatParticipantLabel(person.nama, person.cabang)} dihapus`);
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

async function readFile(file) {
  const text = await file.text();
  const parsed = parseParticipantsCsv(text);
  fileStatus.textContent = `Menyimpan ${parsed.participants.length} peserta ke Cloudflare…`;
  await persistParticipants(parsed.participants, file.name);
}

function renderResult(result) {
  lastResult = result;
  renderTourneyBoard(result);
  editTeamsBtn?.classList.toggle("hidden", !isAdmin() || !result?.teams?.length);
  if (teamEditorOpen && isAdmin()) {
    renderTeamEditor(result);
  } else {
    closeTeamEditor();
  }

  if (result.gameId) {
    selectedGameId = games.some((game) => game.id === result.gameId) ? result.gameId : selectedGameId;
    renderGamePicker();
    updateDrawPanel();
  }

  show(resultPanel);
  hide(resultEmpty);
}

function renderCompactSlot(slot, match) {
  const winner = match.winnerNumber === slot.number;
  if (can("hasil") && !slot.pending) {
    return `<button type="button" class="session-slot team-pick${winner ? " is-winner" : ""}" data-match-id="${escapeHtml(match.id)}" data-winner="${slot.number}">${escapeHtml(slot.name)}</button>`;
  }
  return `<div class="session-slot${winner ? " is-winner" : ""}">${escapeHtml(slot.name)}</div>`;
}

function renderSessionTeamCard(team, match) {
  const winner = match.winnerNumber === team.number;
  const title = can("hasil")
    ? `<button type="button" class="team-pick${winner ? " is-winner" : ""}" data-match-id="${escapeHtml(match.id)}" data-winner="${team.number}">${escapeHtml(team.name)}</button>`
    : `<strong>${escapeHtml(team.name)}</strong>`;
  return `
    <article class="session-team${winner ? " is-winner" : ""}">
      <header>${title}<span>${team.members.length} org</span></header>
      <ol class="team-roster">
        ${team.members
          .map(
            (member) =>
              `<li><span>${escapeHtml(formatParticipantLabel(member.nama, member.cabang))}</span><small>${genderBadge(member.jenisKelamin)}</small></li>`,
          )
          .join("")}
      </ol>
    </article>`;
}

function renderTourneyBoard(result) {
  const bracket = result?.bracket;
  const teamsMap = new Map((result?.teams || []).map((team) => [team.number, team]));

  if (!bracket?.rounds?.length) {
    tourneyBoard.innerHTML = (result?.teams || [])
      .map(
        (team) => `
          <article class="session-team">
            <header><strong>${escapeHtml(team.name)}</strong><span>${team.members.length} org</span></header>
            <ol class="team-roster">
              ${team.members
                .map(
                  (member) =>
                    `<li><span>${escapeHtml(formatParticipantLabel(member.nama, member.cabang))}</span><small>${genderBadge(member.jenisKelamin)}</small></li>`,
                )
                .join("")}
            </ol>
          </article>`,
      )
      .join("");
    return;
  }

  const champion = bracket.champion;
  let html = champion
    ? `<div class="tourney-champion"><span>Juara</span><strong>${escapeHtml(champion.name)}</strong></div>`
    : "";

  html += `<div class="tourney-flow">`;
  bracket.rounds.forEach((round, roundIndex) => {
    const showRoster = roundIndex === 0;
    html += `<section class="tourney-round">
      <h3 class="tourney-round-title">${escapeHtml(round.name)}</h3>
      <div class="tourney-sessions">`;

    for (const match of round.matches || []) {
      const done = Boolean(match.winnerNumber);
      html += `<article class="session-card${done ? " is-done" : ""}">
        <header class="session-head">
          <span class="session-label">Sesi ${match.session}</span>
          ${done ? `<span class="session-badge">Selesai</span>` : ""}
        </header>
        <div class="session-body${showRoster ? "" : " is-compact"}">`;

      const slots = match.teams || [];
      slots.forEach((slot, index) => {
        if (index > 0 && slots.length === 2) html += `<span class="session-vs">vs</span>`;
        if (!slot || slot.pending) {
          html += `<div class="session-slot is-pending">${escapeHtml(slot?.label || "Menunggu")}</div>`;
        } else if (showRoster) {
          const full = teamsMap.get(slot.number);
          html += full ? renderSessionTeamCard(full, match) : renderCompactSlot(slot, match);
        } else {
          html += renderCompactSlot(slot, match);
        }
      });

      html += `</div></article>`;
    }

    if (round.byeTeams?.length) {
      html += `<p class="session-bye">Lolos otomatis: ${round.byeTeams.map((team) => escapeHtml(team.name)).join(", ")}</p>`;
    }

    html += `</div></section>`;
    if (roundIndex < bracket.rounds.length - 1) {
      html += `<div class="tourney-connector" aria-hidden="true">↓</div>`;
    }
  });
  html += `</div>`;
  tourneyBoard.innerHTML = html;
}

function closeTeamEditor(resetOpen = true) {
  if (resetOpen) teamEditorOpen = false;
  hide(teamEditorPanel);
  hide(teamEditorError);
  if (teamEditorGrid) teamEditorGrid.innerHTML = "";
}

function openTeamEditor() {
  if (!lastResult || !isAdmin()) return;
  teamEditorOpen = true;
  show(teamEditorPanel);
  hide(teamEditorError);
  renderTeamEditor(lastResult);
}

function renderTeamEditor(result) {
  const game = getGame(result.gameId, games);
  if (!game || !teamEditorGrid) return;
  const pool = poolForGame(game);
  const size = Number(result.membersPerTeam) || game.members;

  teamEditorGrid.innerHTML = (result.teams || [])
    .map((team) => {
      const slots = Array.from({ length: size }, (_, index) => {
        const currentId = memberIdFromPerson(participants, team.members[index]) || "";
        const options = pool
          .map(
            (person) =>
              `<option value="${person.id}"${String(person.id) === String(currentId) ? " selected" : ""}>${escapeHtml(formatParticipantLabel(person.nama, person.cabang))}</option>`,
          )
          .join("");
        return `
          <label>
            Anggota ${index + 1}
            <select data-team-number="${team.number}" required>
              <option value="">Pilih peserta</option>
              ${options}
            </select>
          </label>`;
      }).join("");

      return `
        <article class="team-edit-card">
          <h3>${escapeHtml(team.name)}</h3>
          <div class="team-edit-slots">${slots}</div>
        </article>`;
    })
    .join("");
}

function collectTeamEditorPayload() {
  const teams = (lastResult?.teams || []).map((team) => ({
    number: team.number,
    memberIds: [...teamEditorGrid.querySelectorAll(`select[data-team-number="${team.number}"]`)].map(
      (select) => Number(select.value),
    ),
  }));
  return teams;
}

function validateTeamEditorPayload(teams) {
  const ids = teams.flatMap((team) => team.memberIds);
  if (ids.some((id) => !id)) {
    return "Semua slot anggota wajib diisi.";
  }
  if (new Set(ids).size !== ids.length) {
    return "Satu peserta tidak boleh masuk lebih dari satu tim.";
  }
  return "";
}

async function saveTeamEditor() {
  if (!lastResult?.id || !isAdmin()) return;
  hide(teamEditorError);
  const teams = collectTeamEditorPayload();
  const message = validateTeamEditorPayload(teams);
  if (message) {
    teamEditorError.textContent = message;
    show(teamEditorError);
    return;
  }
  if (!confirm("Simpan perubahan komposisi tim?")) return;
  try {
    const updated = await api(`/api/draws/${lastResult.id}/teams`, {
      method: "PUT",
      body: JSON.stringify({ teams }),
    });
    teamEditorOpen = false;
    closeTeamEditor();
    renderResult(updated);
    setCloudStatus(`Komposisi tim ${updated.gameName || "permainan"} diperbarui`);
    if (canOpenView("dashboard")) await loadDashboard();
  } catch (error) {
    teamEditorError.textContent = error.message;
    show(teamEditorError);
    setCloudStatus(error.message, "warn");
  }
}

function gamePayload() {
  return {
    name: gameNameInput.value,
    description: gameDescriptionInput.value,
    teamCount: Number(gameTeamCountInput.value),
    members: Number(gameMembersInput.value),
    groupsPerSession: Number(gameGroupsPerSessionInput.value),
    genderMode: gameGenderModeInput.value,
    pic1Id: Number(gamePic1Input.value) || null,
    pic2Id: Number(gamePic2Input.value) || null,
  };
}

async function saveGame(event) {
  event.preventDefault();
  hide(gameError);
  const editingId = gameEditId.value;
  try {
    const result = editingId
      ? await api(`/api/games/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify(gamePayload()),
        })
      : await api("/api/games", {
          method: "POST",
          body: JSON.stringify(gamePayload()),
        });
    setGames(result.games);
    applyGame(result.game.id);
    closeGameEditor();
    setCloudStatus(editingId ? `Permainan ${result.game.name} diperbarui` : `Permainan ${result.game.name} ditambahkan`);
  } catch (error) {
    gameError.textContent = error.message;
    show(gameError);
  }
}

async function removeGame(id) {
  const game = getGame(id, games);
  if (!game) return;
  if (!confirm(`Hapus permainan “${game.name}”?`)) return;
  try {
    const result = await api(`/api/games/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (lastResult?.gameId === id) {
      lastResult = null;
      hide(resultPanel);
      show(resultEmpty);
    }
    setGames(result.games, { keepSelection: selectedGameId !== id });
    applyGame(selectedGameId);
    closeGameEditor();
    setCloudStatus(`Permainan ${game.name} dihapus`);
    await refreshDrawHistory();
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

async function refreshDrawHistory(selectedId) {
  const data = await api("/api/draws");
  draws = data.draws || [];
  updateDrawPanel();
  if (selectedId) {
    const draw = draws.find((item) => String(item.id) === String(selectedId));
    if (draw?.gameId) selectedGameId = draw.gameId;
    renderGameSelect();
  }
  loadDashboard();
}

async function runDraw({ replace = false } = {}) {
  hide(configError);
  const game = selectedGame();
  if (!game) {
    configError.textContent = "Pilih permainan.";
    show(configError);
    return;
  }
  if (!participants.length) {
    configError.textContent = "Unggah peserta dulu.";
    show(configError);
    showView("peserta");
    return;
  }
  const existing = drawForGame(selectedGameId);
  if (existing && !replace) {
    configError.textContent = "Hasil acak sudah ada. Hanya admin yang bisa mengacak ulang.";
    show(configError);
    return;
  }
  if (replace && !isAdmin()) {
    configError.textContent = "Hanya admin yang bisa mengacak ulang.";
    show(configError);
    return;
  }
  if (replace && !confirm(`Acak ulang grup untuk “${game.name}”? Hasil lama akan diganti.`)) {
    return;
  }
  try {
    const result = await api("/api/draws", {
      method: "POST",
      body: JSON.stringify({
        gameId: selectedGameId,
        replace,
      }),
    });
    renderResult(result);
    setCloudStatus(
      result.replaced
        ? `Hasil ${result.gameName} diganti dengan acakan baru`
        : `Grup ${result.gameName} tersimpan`,
    );
    await refreshDrawHistory(result.id);
    showView("pembagian");
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
  }
}

async function loadGamesFromCloud() {
  const data = await api("/api/games");
  setGames(data.games);
}

async function loadFromCloud() {
  try {
    if (can("permainan") || can("pembagian") || can("hasil")) {
      await loadGamesFromCloud();
    }
    if (can("peserta") || can("permainan") || can("pembagian") || can("daftar")) {
      const data = await api("/api/participants");
      if (data.participants.length) {
        showParticipantData(data.participants, data.filename || "Cloudflare D1");
        setCloudStatus(`${data.participants.length} peserta dimuat dari Cloudflare D1`);
      } else {
        showParticipantData([], data.filename || "Cloudflare D1");
        setCloudStatus("Belum ada data peserta. Unggah CSV atau tambah satu per satu.", "muted");
        hide(clearBtn);
        updateDrawPanel();
      }
    } else {
      hide(clearBtn);
      updateDrawPanel();
    }

    if (can("pembagian") || can("hasil")) {
      const { draws: history } = await api("/api/draws");
      await refreshDrawHistory(history[0]?.id);
      if (selectedGameId && drawForGame(selectedGameId)) {
        await loadDrawForSelectedGame();
      } else if (history[0]) {
        selectedGameId = history[0].gameId || selectedGameId;
        renderGameSelect();
        await loadDrawForSelectedGame();
      }
    }
    if (canOpenView("dashboard")) await loadDashboard();
    applyAccessUi();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    setCloudStatus(
      `Cloudflare belum terhubung: ${error.message}. Jalankan npm run dev atau deploy Worker.`,
      "warn",
    );
  }
}

function renderUserRights(selected = [], { locked = false } = {}) {
  userRights.innerHTML = `<legend>Hak akses</legend>${RIGHTS.map(
    (right) => `
      <label class="right-option">
        <input type="checkbox" value="${right.id}" ${selected.includes(right.id) ? "checked" : ""} ${locked ? "disabled" : ""} />
        <span>
          <strong>${right.label}</strong>
          <small>${right.description}</small>
        </span>
      </label>
    `,
  ).join("")}`;
}

function openUserEditor(user) {
  hide(document.querySelector("#user-error"));
  if (user) {
    document.querySelector("#user-edit-id").value = String(user.id);
    document.querySelector("#user-display-name").value = user.displayName;
    document.querySelector("#user-username").value = user.username;
    document.querySelector("#user-password").value = "";
    document.querySelector("#user-password").required = false;
    userRole.value = user.role;
    renderUserRights(user.rights, { locked: user.role === "admin" });
  } else {
    document.querySelector("#user-edit-id").value = "";
    document.querySelector("#user-display-name").value = "";
    document.querySelector("#user-username").value = "";
    document.querySelector("#user-password").value = "";
    document.querySelector("#user-password").required = true;
    userRole.value = "panitia";
    renderUserRights(ROLE_PRESETS.panitia);
  }
  show(userEditor);
}

function closeUserEditor() {
  hide(userEditor);
  hide(document.querySelector("#user-error"));
  userEditor.reset();
}

function renderUsers() {
  userList.innerHTML = users
    .map(
      (user) => `
        <article class="user-card">
          <div>
            <strong>${escapeHtml(user.displayName)}</strong>
            <span class="user-meta">${escapeHtml(user.username)} · ${escapeHtml(user.role)}</span>
            <span class="user-meta">${user.rights.map((right) => RIGHTS.find((item) => item.id === right)?.label || right).join(" · ")}</span>
          </div>
          <div class="game-card-actions">
            <button type="button" class="text-btn" data-user-action="edit" data-user-id="${user.id}">Ubah</button>
            <button type="button" class="text-btn danger-text" data-user-action="delete" data-user-id="${user.id}">Hapus</button>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadUsers() {
  if (!can("pengguna")) return;
  const data = await api("/api/users");
  users = data.users || [];
  renderUsers();
}

async function saveUser(event) {
  event.preventDefault();
  const errorEl = document.querySelector("#user-error");
  hide(errorEl);
  const editingId = document.querySelector("#user-edit-id").value;
  const payload = {
    displayName: document.querySelector("#user-display-name").value,
    username: document.querySelector("#user-username").value,
    password: document.querySelector("#user-password").value,
    role: userRole.value,
    rights: selectedRights(),
  };
  try {
    const result = editingId
      ? await api(`/api/users/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
    users = result.users || [];
    renderUsers();
    closeUserEditor();
    setCloudStatus(editingId ? "Pengguna diperbarui" : `Pengguna ${result.user.username} ditambahkan`);
    if (result.user.id === currentUser?.id) {
      currentUser = result.user;
      applyAccessUi();
    }
  } catch (error) {
    errorEl.textContent = error.message;
    show(errorEl);
  }
}

async function removeUser(id) {
  if (!confirm("Hapus pengguna ini?")) return;
  try {
    const result = await api(`/api/users/${id}`, { method: "DELETE" });
    users = result.users || [];
    renderUsers();
    setCloudStatus("Pengguna dihapus");
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

function showLogin() {
  hide(setupForm);
  show(loginForm);
  show(authScreen);
  hide(appShell);
}

function showSetup() {
  show(setupForm);
  hide(loginForm);
  show(authScreen);
  hide(appShell);
}

async function enterApp(user, defaultView) {
  currentUser = user;
  hide(authScreen);
  show(appShell);
  applyAccessUi();
  await loadFromCloud();
  showView(defaultView || firstAllowedView(currentUser) || "dashboard");
}

async function boot() {
  renderUserRights(ROLE_PRESETS.panitia);
  try {
    const me = await api("/api/auth/me");
    if (me.needsSetup) {
      showSetup();
      return;
    }
    if (!me.user) {
      showLogin();
      return;
    }
    await enterApp(me.user, me.defaultView);
  } catch (error) {
    showLogin();
    document.querySelector("#login-error").textContent = error.message;
    show(document.querySelector("#login-error"));
  }
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer.files[0];
  if (file) {
    readFile(file).catch((error) => {
      fileStatus.textContent = error.message;
      setCloudStatus(error.message, "warn");
    });
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    readFile(file).catch((error) => {
      fileStatus.textContent = error.message;
      setCloudStatus(error.message, "warn");
    });
  }
});

gameGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-game-action]");
  if (!(button instanceof HTMLButtonElement)) return;
  event.preventDefault();
  event.stopPropagation();
  const id = button.dataset.gameId;
  if (button.dataset.gameAction === "edit") {
    openGameEditor(getGame(id, games));
  }
  if (button.dataset.gameAction === "delete") {
    removeGame(id);
  }
});

document.querySelector("#add-game").addEventListener("click", () => openGameEditor());
document.querySelector("#game-cancel").addEventListener("click", closeGameEditor);
gameEditor.addEventListener("submit", saveGame);
gamePic1Cabang.addEventListener("change", () => {
  fillPicPair(gamePic1Cabang, gamePic1Input, gamePic1Cabang.value, "");
});
gamePic2Cabang.addEventListener("change", () => {
  fillPicPair(gamePic2Cabang, gamePic2Input, gamePic2Cabang.value, "");
});

drawGameSelect.addEventListener("change", () => {
  applyGame(drawGameSelect.value);
});

participantSortSelect.addEventListener("change", () => {
  participantSort = participantSortSelect.value;
  renderParticipants(participants);
});

directorySortSelect?.addEventListener("change", () => {
  directorySort = directorySortSelect.value;
  renderParticipantDirectory(participants);
});

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runDraw();
});

reshuffleBtn.addEventListener("click", () => {
  runDraw({ replace: true });
});

resetDrawBtn.addEventListener("click", () => {
  resetDrawDivision();
});

async function resetDrawDivision() {
  hide(configError);
  const game = selectedGame();
  const existing = drawForGame(selectedGameId);
  if (!game || !existing || !isAdmin()) return;
  if (
    !confirm(
      `Reset pembagian “${game.name}”?\n\nSemua tim, bagan gugur, dan progress akan dihapus. Anda bisa mengacak ulang dari awal.`,
    )
  ) {
    return;
  }
  try {
    await api(`/api/draws/${existing.id}`, { method: "DELETE" });
    lastResult = null;
    closeTeamEditor();
    hide(resultPanel);
    show(resultEmpty);
    tourneyBoard.innerHTML = "";
    await refreshDrawHistory();
    updateDrawPanel();
    setCloudStatus(`Pembagian ${game.name} direset`, "muted");
    if (canOpenView("dashboard")) await loadDashboard();
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
    setCloudStatus(error.message, "warn");
  }
}

document.querySelector("#add-participant").addEventListener("click", () => openParticipantEditor());
document.querySelector("#participant-cancel").addEventListener("click", closeParticipantEditor);
participantEditor.addEventListener("submit", saveParticipant);
dataPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-person-action]");
  if (!(button instanceof HTMLButtonElement)) return;
  const id = button.dataset.personId;
  const person = participants.find((item) => String(item.id) === String(id));
  if (button.dataset.personAction === "edit" && person) openParticipantEditor(person);
  if (button.dataset.personAction === "exclude") toggleExclude(id);
  if (button.dataset.personAction === "delete") removeParticipant(id);
});

editTeamsBtn?.addEventListener("click", openTeamEditor);
teamEditorCancel?.addEventListener("click", () => closeTeamEditor());
teamEditorSave?.addEventListener("click", saveTeamEditor);

tourneyBoard.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-match-id]");
  if (!(button instanceof HTMLButtonElement) || !lastResult?.id) return;
  const teamName = button.textContent?.trim() || "tim ini";
  const isWinner = button.classList.contains("is-winner");
  const message = isWinner
    ? `Batalkan pemenang "${teamName}"?`
    : `Jadikan "${teamName}" pemenang sesi ini?`;
  if (!confirm(message)) return;
  try {
    const updated = await api(`/api/draws/${lastResult.id}`, {
      method: "PUT",
      body: JSON.stringify({
        matchId: button.dataset.matchId,
        winnerNumber: Number(button.dataset.winner),
      }),
    });
    renderResult(updated);
    setCloudStatus(
      updated.bracket?.champion
        ? `Juara: ${updated.bracket.champion.name}`
        : "Pemenang sesi disimpan",
    );
    loadDashboard();
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Hapus semua peserta dan hasil undian dari Cloudflare D1? Jenis permainan tetap disimpan.")) return;
  try {
    await api("/api/participants", { method: "DELETE" });
    participants = [];
    lastResult = null;
    draws = [];
    hide(resultPanel);
    show(resultEmpty);
    showParticipantData([], "");
    fileStatus.textContent = "Data Cloudflare D1 sudah dikosongkan.";
    setCloudStatus("Peserta dan undian dihapus. Jenis permainan tetap ada.", "muted");
    updateDrawPanel();
    loadDashboard();
    showView("peserta");
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
});

document.querySelector("#side-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) showView(button.dataset.view);
});

document.querySelector("#bottom-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) showView(button.dataset.view);
});

document.querySelectorAll(".logout-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie cleared server-side when possible */
    }
    currentUser = null;
    showLogin();
  });
});

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.querySelector("#setup-error");
  hide(errorEl);
  try {
    const result = await api("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({
        displayName: document.querySelector("#setup-name").value,
        username: document.querySelector("#setup-username").value,
        password: document.querySelector("#setup-password").value,
        role: "admin",
      }),
    });
    await enterApp(result.user, result.defaultView);
  } catch (error) {
    errorEl.textContent = error.message;
    show(errorEl);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.querySelector("#login-error");
  hide(errorEl);
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.querySelector("#login-username").value,
        password: document.querySelector("#login-password").value,
      }),
    });
    await enterApp(result.user, result.defaultView);
  } catch (error) {
    errorEl.textContent = error.message;
    show(errorEl);
  }
});

userRole.addEventListener("change", () => {
  const role = userRole.value;
  renderUserRights(rightsForRole(role, selectedRights()), { locked: role === "admin" });
});

document.querySelector("#add-user").addEventListener("click", () => openUserEditor());
document.querySelector("#user-cancel").addEventListener("click", closeUserEditor);
userEditor.addEventListener("submit", saveUser);
userList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-action]");
  if (!(button instanceof HTMLButtonElement)) return;
  const id = Number(button.dataset.userId);
  const user = users.find((item) => item.id === id);
  if (button.dataset.userAction === "edit" && user) openUserEditor(user);
  if (button.dataset.userAction === "delete") removeUser(id);
});

navBackdrop.addEventListener("click", closeSidebar);

renderGamePicker();
updateDrawPanel();
boot();
