import { parseParticipantsCsv, summarizeParticipants } from "./csv.js";
import {
  filterByGender,
  genderModeLabel,
  normalizeGenderMode,
  teamsToCsv,
} from "./teams.js";
import { getGame } from "./games.js";
import { api } from "./api.js";
import {
  RIGHTS,
  ROLE_PRESETS,
  firstAllowedView,
  hasRight,
  rightsForRole,
} from "./auth.js";

const VIEWS = {
  peserta: { eyebrow: "Peserta", title: "Data peserta" },
  permainan: { eyebrow: "Permainan", title: "Jenis permainan" },
  pembagian: { eyebrow: "Pembagian", title: "Bagi grup" },
  hasil: { eyebrow: "Hasil", title: "Grup permainan" },
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
const teamCountInput = document.querySelector("#team-count");
const membersInput = document.querySelector("#members-per-team");
const genderModes = document.querySelector("#gender-modes");
const selectedGameLabel = document.querySelector("#selected-game-label");
const drawGameSelect = document.querySelector("#draw-game");
const drawReplaceHint = document.querySelector("#draw-replace-hint");
const drawSubmit = document.querySelector("#draw-submit");
const gameGrid = document.querySelector("#game-grid");
const gamesEmpty = document.querySelector("#games-empty");
const gameEditor = document.querySelector("#game-editor");
const gameEditId = document.querySelector("#game-edit-id");
const gameNameInput = document.querySelector("#game-name");
const gameTeamCountInput = document.querySelector("#game-team-count");
const gameMembersInput = document.querySelector("#game-members");
const gameGroupsPerSessionInput = document.querySelector("#game-groups-per-session");
const gameDescriptionInput = document.querySelector("#game-description");
const gameError = document.querySelector("#game-error");
const needBox = document.querySelector("#need-box");
const configForm = document.querySelector("#config-form");
const configError = document.querySelector("#config-error");
const teamsEl = document.querySelector("#teams");
const leftoverEl = document.querySelector("#leftover");
const bracketEl = document.querySelector("#bracket");
const resultMeta = document.querySelector("#result-meta");
const resultTitle = document.querySelector("#result-title");
const cloudStatus = document.querySelector("#cloud-status");
const drawHistory = document.querySelector("#draw-history");
const clearBtn = document.querySelector("#clear-cloud");
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
let currentView = "peserta";
let draws = [];
let currentUser = null;
let users = [];

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

function selectedGenderMode() {
  const checked = genderModes.querySelector("input[name='gender-mode']:checked");
  return normalizeGenderMode(checked?.value);
}

function poolParticipants() {
  return filterByGender(participants, selectedGenderMode());
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

function showView(name) {
  if (!VIEWS[name]) return;
  if (!can(name)) {
    const fallback = firstAllowedView(currentUser);
    if (fallback && fallback !== name) {
      showView(fallback);
    }
    return;
  }
  currentView = name;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== `view-${name}`);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === name);
  });
  viewEyebrow.textContent = VIEWS[name].eyebrow;
  viewTitle.textContent =
    name === "hasil" && lastResult?.gameName ? lastResult.gameName : VIEWS[name].title;
  closeSidebar();
  if (name === "pembagian") updateDrawPanel();
  if (name === "permainan" && !games.length && can("permainan")) openGameEditor();
  if (name === "pengguna") loadUsers();
}

function applyAccessUi() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("hidden", !can(button.dataset.view));
  });
  const name = currentUser?.displayName || currentUser?.username || "Pengguna";
  const role = currentUser?.role || "";
  document.querySelectorAll(".user-chip").forEach((el) => {
    el.textContent = role ? `${name} · ${role}` : name;
  });
  document.querySelector("#clear-cloud")?.classList.toggle("hidden", !(can("peserta") && participants.length));
  document.querySelector("#add-game")?.classList.toggle("hidden", !can("permainan"));
  document.querySelector("#reshuffle")?.classList.toggle("hidden", !can("pembagian"));
  document.querySelector("#upload-panel")?.classList.toggle("hidden", !can("peserta"));
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

function updateGenderCounts() {
  const summary = summarizeParticipants(participants);
  document.querySelector("#count-campur").textContent = `${summary.total} peserta`;
  document.querySelector("#count-laki").textContent = `${summary.laki} orang`;
  document.querySelector("#count-perempuan").textContent = `${summary.perempuan} orang`;
  genderModes.querySelectorAll(".gender-mode").forEach((card) => {
    const input = card.querySelector("input");
    card.classList.toggle("is-selected", input?.checked);
  });
}

function updateNeed() {
  const teams = Number(teamCountInput.value);
  const size = Number(membersInput.value);
  const needed = teams * size;
  const pool = poolParticipants();
  const enough = Number.isInteger(needed) && needed > 0 && pool.length >= needed;
  const game = selectedGame();
  const mode = genderModeLabel(selectedGenderMode());
  const label = game ? `${game.name} · ${mode}` : mode;
  needBox.innerHTML = `${escapeHtml(label)}: <strong>${needed || 0} orang</strong> dari ${pool.length} peserta`;
  needBox.classList.toggle("is-short", !enough);
}

function updateDrawPanel() {
  updateGenderCounts();
  renderGameSelect();
  const game = selectedGame();
  const existing = draws.find((draw) => draw.gameId === selectedGameId);
  selectedGameLabel.textContent = game
    ? `${game.name}: ${game.teamCount} grup × ${game.members} orang · ${game.groupsPerSession} grup per sesi.`
    : "Pilih permainan dari menu tarik-turun.";
  drawReplaceHint.classList.toggle("hidden", !existing);
  drawSubmit.textContent = existing ? "Ganti hasil acak" : "Bagi grup secara acak";
  const ready = Boolean(participants.length && games.length);
  configForm.classList.toggle("hidden", !ready);
  drawEmpty.classList.toggle("hidden", ready);
  if (!ready) {
    drawEmpty.textContent = !participants.length
      ? "Unggah peserta dulu di menu Peserta, lalu kembali ke Pembagian."
      : "Tambah permainan di menu Permainan, lalu pilih dari menu tarik-turun di Pembagian.";
  }
  updateNeed();
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
          <span class="game-card-size">${game.teamCount} grup · ${game.members} orang · ${game.groupsPerSession} /sesi</span>
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
    return;
  }
  const game = games.find((item) => item.id === gameId);
  if (!game) {
    selectedGameId = "";
    renderGamePicker();
    updateDrawPanel();
    return;
  }
  selectedGameId = game.id;
  teamCountInput.value = String(game.teamCount);
  membersInput.value = String(game.members);
  renderGamePicker();
  updateDrawPanel();
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
  } else {
    gameEditId.value = "";
    gameNameInput.value = "";
    gameDescriptionInput.value = "";
    gameTeamCountInput.value = "";
    gameMembersInput.value = "";
    gameGroupsPerSessionInput.value = "2";
  }
  show(gameEditor);
  gameNameInput.focus();
}

function renderParticipants(list) {
  const summary = summarizeParticipants(list);
  statsEl.innerHTML = [
    ["Total peserta", summary.total],
    ["Laki-laki", summary.laki],
    ["Perempuan", summary.perempuan],
    ["Cabang", summary.cabang],
  ]
    .map(
      ([label, value]) =>
        `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");

  rowsEl.innerHTML = list
    .map(
      (person, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(person.nama)}</td>
          <td>${genderBadge(person.jenisKelamin)}</td>
          <td>${escapeHtml(person.cabang)}</td>
        </tr>
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
  applyGame(selectedGameId);
  show(dataPanel);
  show(clearBtn);
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

async function readFile(file) {
  const text = await file.text();
  const parsed = parseParticipantsCsv(text);
  fileStatus.textContent = `Menyimpan ${parsed.participants.length} peserta ke Cloudflare…`;
  await persistParticipants(parsed.participants, file.name);
}

function renderResult(result) {
  lastResult = result;
  const modeLabel = genderModeLabel(result.genderMode);
  const pool = result.poolSize || result.used;
  const gameTitle = result.gameName || "Grup permainan";
  resultTitle.textContent = gameTitle;
  resultMeta.innerHTML = [
    `<span class="meta-chip">${escapeHtml(modeLabel)}</span>`,
    `<span class="meta-chip">${result.teams.length} grup × ${result.teams[0]?.members.length || 0} anggota</span>`,
    result.groupsPerSession ? `<span class="meta-chip">${result.groupsPerSession} grup per sesi</span>` : "",
    `<span class="meta-chip">${result.used} / ${pool} peserta</span>`,
    result.createdAt ? `<span class="meta-chip muted-chip">${escapeHtml(formatTime(result.createdAt))}</span>` : "",
  ].join("");
  renderBracket(result);
  teamsEl.innerHTML = result.teams
    .map(
      (team) => `
        <article class="team-card">
          <header>
            <strong>${escapeHtml(team.name)}</strong>
            <span>${team.members.length} orang</span>
          </header>
          <ol>
            ${team.members
              .map(
                (member) => `
                  <li>
                    <strong>${escapeHtml(member.nama)}</strong>
                    <span class="member-meta">${genderBadge(member.jenisKelamin)} · ${escapeHtml(member.cabang)}</span>
                  </li>
                `,
              )
              .join("")}
          </ol>
        </article>
      `,
    )
    .join("");

  if (result.leftover.length) {
    leftoverEl.classList.remove("hidden");
    leftoverEl.innerHTML = `<h3>Cadangan (${result.leftover.length})</h3><p>${result.leftover
      .map((person) => `${escapeHtml(person.nama)} (${escapeHtml(person.cabang)})`)
      .join(", ")}</p>`;
  } else {
    leftoverEl.classList.add("hidden");
    leftoverEl.innerHTML = "";
  }

  if (result.gameId) {
    selectedGameId = games.some((game) => game.id === result.gameId) ? result.gameId : selectedGameId;
    teamCountInput.value = String(result.teamCount || result.teams.length);
    membersInput.value = String(
      result.membersPerTeam || result.teams[0]?.members.length || selectedGame()?.members || 1,
    );
    const modeInput = genderModes.querySelector(`input[value="${normalizeGenderMode(result.genderMode)}"]`);
    if (modeInput) modeInput.checked = true;
    renderGamePicker();
    updateDrawPanel();
  }

  show(resultPanel);
  hide(resultEmpty);
}

function formatTime(value) {
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
}

function slugify(value) {
  return String(value || "tim")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "") || "tim";
}

function renderBracket(result) {
  const bracket = result?.bracket;
  if (!bracket?.rounds?.length) {
    hide(bracketEl);
    bracketEl.innerHTML = "";
    return;
  }

  const k = bracket.groupsPerSession || result.groupsPerSession || 2;
  const champion = bracket.champion;
  const gameTitle = result.gameName || "Pertandingan";
  bracketEl.innerHTML = `
    <div class="bracket-head">
      <div>
        <p class="eyebrow">Bagan sistem gugur</p>
        <h3>${escapeHtml(gameTitle)}</h3>
        <p>${k} grup per sesi. Klik pemenang agar maju ke babak berikutnya.</p>
      </div>
      ${
        champion
          ? `<div class="bracket-champion"><span>Juara</span><strong>${escapeHtml(champion.name)}</strong></div>`
          : ""
      }
    </div>
    <div class="bracket-board">
      <div class="bracket-rounds">
        ${bracket.rounds
          .map(
            (round) => `
              <section class="bracket-round">
                <h4>${escapeHtml(round.name)}</h4>
                <div class="bracket-round-matches">
                  ${(round.matches || [])
                    .map(
                      (match) => `
                        <article class="bracket-match${match.winnerNumber ? " has-winner" : ""}">
                          <p class="bracket-session">Sesi ${match.session}</p>
                          <div class="bracket-teams">
                            ${bracketTeamsHtml(match)}
                          </div>
                        </article>
                      `,
                    )
                    .join("")}
                  ${
                    round.byeTeams?.length
                      ? `<p class="bracket-bye">Lolos otomatis: ${round.byeTeams
                          .map((team) => escapeHtml(team.name))
                          .join(", ")}</p>`
                      : ""
                  }
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
  show(bracketEl);
}

function bracketTeamsHtml(match) {
  const teams = match.teams || [];
  return teams
    .map((team, index) => {
      const slot = bracketSlot(team, match);
      if (teams.length === 2 && index === 0) {
        return `${slot}<span class="bracket-vs" aria-hidden="true">VS</span>`;
      }
      return slot;
    })
    .join("");
}

function bracketSlot(team, match) {
  if (!team || team.pending) {
    return `<span class="bracket-slot is-pending">${escapeHtml(team?.label || "Menunggu pemenang")}</span>`;
  }
  const winner = match.winnerNumber === team.number;
  return `<button type="button" class="bracket-slot${winner ? " is-winner" : ""}" data-match-id="${escapeHtml(match.id)}" data-winner="${team.number}">${escapeHtml(team.name)}</button>`;
}

function gamePayload() {
  return {
    name: gameNameInput.value,
    description: gameDescriptionInput.value,
    teamCount: Number(gameTeamCountInput.value),
    members: Number(gameMembersInput.value),
    groupsPerSession: Number(gameGroupsPerSessionInput.value),
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
  if (!draws.length) {
    hide(drawHistory);
    drawHistory.innerHTML = "";
    updateDrawPanel();
    return;
  }

  drawHistory.innerHTML = `
    <option value="">Pilih permainan</option>
    ${draws
      .map(
        (draw) =>
          `<option value="${draw.id}" ${String(draw.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(draw.gameName || "Permainan")} · ${escapeHtml(genderModeLabel(draw.genderMode))} · ${draw.teamCount}×${draw.membersPerTeam}</option>`,
      )
      .join("")}
  `;
  show(drawHistory);
  updateDrawPanel();
}

async function runDraw({ confirmReplace = true } = {}) {
  hide(configError);
  if (!selectedGame()) {
    configError.textContent = "Pilih permainan dari menu tarik-turun.";
    show(configError);
    return;
  }
  if (!participants.length) {
    configError.textContent = "Unggah peserta dulu.";
    show(configError);
    showView("peserta");
    return;
  }
  const existing = draws.find((draw) => draw.gameId === selectedGameId);
  if (confirmReplace && existing) {
    if (!confirm(`Sudah ada hasil untuk “${selectedGame().name}”. Ganti dengan acakan baru?`)) {
      return;
    }
  }
  try {
    const result = await api("/api/draws", {
      method: "POST",
      body: JSON.stringify({
        teamCount: Number(teamCountInput.value),
        membersPerTeam: Number(membersInput.value),
        gameId: selectedGameId,
        genderMode: selectedGenderMode(),
        groupsPerSession: selectedGame().groupsPerSession,
      }),
    });
    renderResult(result);
    setCloudStatus(
      result.replaced
        ? `Hasil ${result.gameName} diganti dengan acakan baru`
        : `Grup ${result.gameName} tersimpan di Cloudflare D1`,
    );
    await refreshDrawHistory(result.id);
    showView("hasil");
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
    if (can("peserta")) {
      const data = await api("/api/participants");
      if (data.participants.length) {
        showParticipantData(data.participants, data.filename || "Cloudflare D1");
        setCloudStatus(`${data.participants.length} peserta dimuat dari Cloudflare D1`);
      } else {
        setCloudStatus("Belum ada data peserta di Cloudflare D1. Unggah CSV untuk menyimpan.", "muted");
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
      if (history[0]) {
        const latest = await api(`/api/draws/${history[0].id}`);
        renderResult(latest);
      }
    }
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
  showView(defaultView || firstAllowedView(currentUser) || "peserta");
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

genderModes.addEventListener("change", updateDrawPanel);
drawGameSelect.addEventListener("change", () => {
  applyGame(drawGameSelect.value);
});
teamCountInput.addEventListener("input", updateNeed);
membersInput.addEventListener("input", updateNeed);

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runDraw();
});

document.querySelector("#reshuffle").addEventListener("click", () => {
  runDraw({ confirmReplace: false });
});

document.querySelector("#export-csv").addEventListener("click", () => {
  if (!lastResult) return;
  const csv = teamsToCsv(lastResult.teams, lastResult.leftover, lastResult.gameName || selectedGame()?.name || "");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hasil-${slugify(lastResult.gameName || "pembagian-tim")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#print-result").addEventListener("click", () => window.print());

bracketEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-match-id]");
  if (!(button instanceof HTMLButtonElement) || !lastResult?.id) return;
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
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
});

drawHistory.addEventListener("change", async () => {
  const id = drawHistory.value;
  if (!id) return;
  try {
    const draw = await api(`/api/draws/${id}`);
    renderResult(draw);
    showView("hasil");
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
    showView("pembagian");
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Hapus semua peserta dan hasil undian dari Cloudflare D1? Jenis permainan tetap disimpan.")) return;
  try {
    await api("/api/participants", { method: "DELETE" });
    participants = [];
    lastResult = null;
    draws = [];
    hide(dataPanel);
    hide(resultPanel);
    show(resultEmpty);
    hide(clearBtn);
    hide(drawHistory);
    fileStatus.textContent = "Data Cloudflare D1 sudah dikosongkan.";
    setCloudStatus("Peserta dan undian dihapus. Jenis permainan tetap ada.", "muted");
    renderGamePicker();
    updateDrawPanel();
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
