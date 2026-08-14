import { parseParticipantsCsv, summarizeParticipants } from "./csv.js";
import { teamsToCsv } from "./teams.js";
import { DEFAULT_GAMES, getGame, suggestedTeamCount } from "./games.js";
import { api } from "./api.js";

const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const fileStatus = document.querySelector("#file-status");
const fileName = document.querySelector("#file-name");
const dataPanel = document.querySelector("#data-panel");
const resultPanel = document.querySelector("#result-panel");
const statsEl = document.querySelector("#stats");
const rowsEl = document.querySelector("#participant-rows");
const teamCountInput = document.querySelector("#team-count");
const membersInput = document.querySelector("#members-per-team");
const balanceGenderInput = document.querySelector("#balance-gender");
const gameGrid = document.querySelector("#game-grid");
const gameEditor = document.querySelector("#game-editor");
const gameEditId = document.querySelector("#game-edit-id");
const gameNameInput = document.querySelector("#game-name");
const gameMembersInput = document.querySelector("#game-members");
const gamePrefixInput = document.querySelector("#game-prefix");
const gameDescriptionInput = document.querySelector("#game-description");
const gameError = document.querySelector("#game-error");
const needBox = document.querySelector("#need-box");
const configForm = document.querySelector("#config-form");
const configError = document.querySelector("#config-error");
const teamsEl = document.querySelector("#teams");
const leftoverEl = document.querySelector("#leftover");
const resultMeta = document.querySelector("#result-meta");
const cloudStatus = document.querySelector("#cloud-status");
const drawHistory = document.querySelector("#draw-history");
const clearBtn = document.querySelector("#clear-cloud");

let participants = [];
let games = [...DEFAULT_GAMES];
let lastResult = null;
let selectedGameId = "umum";

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

function setGames(list, { keepSelection = true } = {}) {
  games = Array.isArray(list) && list.length ? list : [...DEFAULT_GAMES];
  if (!keepSelection || !games.some((game) => game.id === selectedGameId)) {
    selectedGameId = games[0].id;
  }
  renderGamePicker();
  updateNeed();
}

function updateNeed() {
  const teams = Number(teamCountInput.value);
  const size = Number(membersInput.value);
  const needed = teams * size;
  const enough = Number.isInteger(needed) && needed > 0 && participants.length >= needed;
  const game = selectedGame();
  needBox.innerHTML = `${escapeHtml(game.name)}: <strong>${needed || 0} orang</strong> dari ${participants.length} peserta`;
  needBox.style.color = enough ? "inherit" : "var(--danger)";
}

function renderGamePicker() {
  gameGrid.innerHTML = games
    .map(
      (game) => `
      <article class="game-card ${game.id === selectedGameId ? "is-selected" : ""}" data-game-id="${escapeHtml(game.id)}">
        <label>
          <input type="radio" name="game-id" value="${escapeHtml(game.id)}" ${
            game.id === selectedGameId ? "checked" : ""
          } />
          <span class="game-card-name">${escapeHtml(game.name)}</span>
          <span class="game-card-size">${game.members} orang / grup</span>
          <span class="game-card-desc">${escapeHtml(game.description)}</span>
        </label>
        <div class="game-card-actions">
          <button type="button" class="text-btn" data-game-action="edit" data-game-id="${escapeHtml(game.id)}">Ubah</button>
          <button type="button" class="text-btn danger-text" data-game-action="delete" data-game-id="${escapeHtml(game.id)}">Hapus</button>
        </div>
      </article>
    `,
    )
    .join("");
}

function applyGame(gameId, { suggestTeams = true } = {}) {
  selectedGameId = gameId;
  const game = selectedGame();
  membersInput.value = String(game.members);
  if (suggestTeams && participants.length) {
    teamCountInput.value = String(suggestedTeamCount(participants.length, game.members));
  }
  renderGamePicker();
  updateNeed();
}

function closeGameEditor() {
  hide(gameEditor);
  hide(gameError);
  gameEditor.reset();
  gameEditId.value = "";
}

function openGameEditor(game) {
  hide(gameError);
  delete gamePrefixInput.dataset.touched;
  if (game) {
    gameEditId.value = game.id;
    gameNameInput.value = game.name;
    gameMembersInput.value = String(game.members);
    gamePrefixInput.value = game.labelPrefix;
    gameDescriptionInput.value = game.description || "";
    gamePrefixInput.dataset.touched = "1";
  } else {
    gameEditId.value = "";
    gameNameInput.value = "";
    gameMembersInput.value = "4";
    gamePrefixInput.value = "Tim";
    gameDescriptionInput.value = "";
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
  show(configForm);
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
  const gameLabel = result.gameName ? `${result.gameName} · ` : "";
  const when = result.createdAt ? ` Disimpan ${formatTime(result.createdAt)}.` : "";
  resultMeta.textContent = `${gameLabel}${result.teams.length} grup × ${result.teams[0]?.members.length || 0} anggota. ${result.used} peserta terpakai dari ${result.total}.${when}`;
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
    membersInput.value = String(result.membersPerTeam || result.teams[0]?.members.length || selectedGame().members);
    renderGamePicker();
    updateNeed();
  }

  show(resultPanel);
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

function gamePayload() {
  return {
    name: gameNameInput.value,
    members: Number(gameMembersInput.value),
    labelPrefix: gamePrefixInput.value,
    description: gameDescriptionInput.value,
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
  if (!confirm(`Hapus permainan “${game.name}”?`)) return;
  try {
    const result = await api(`/api/games/${encodeURIComponent(id)}`, { method: "DELETE" });
    setGames(result.games, { keepSelection: selectedGameId !== id });
    if (selectedGameId === id) applyGame(games[0].id);
    closeGameEditor();
    setCloudStatus(`Permainan ${game.name} dihapus`);
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

async function restoreGames() {
  if (!confirm("Tambahkan kembali permainan bawaan yang belum ada? Permainan kustom tetap disimpan.")) {
    return;
  }
  try {
    const result = await api("/api/games/restore", { method: "POST" });
    setGames(result.games);
    setCloudStatus("Permainan bawaan dipulihkan");
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
}

async function refreshDrawHistory(selectedId) {
  const { draws } = await api("/api/draws");
  if (!draws.length) {
    hide(drawHistory);
    drawHistory.innerHTML = "";
    return;
  }

  drawHistory.innerHTML = `
    <option value="">Pilih undian tersimpan</option>
    ${draws
      .map(
        (draw) =>
          `<option value="${draw.id}" ${String(draw.id) === String(selectedId) ? "selected" : ""}>Undian #${draw.id} · ${escapeHtml(draw.gameName || "Umum")} · ${draw.teamCount}×${draw.membersPerTeam} · ${escapeHtml(draw.createdAt)}</option>`,
      )
      .join("")}
  `;
  show(drawHistory);
}

async function runDraw() {
  hide(configError);
  try {
    const result = await api("/api/draws", {
      method: "POST",
      body: JSON.stringify({
        teamCount: Number(teamCountInput.value),
        membersPerTeam: Number(membersInput.value),
        gameId: selectedGameId,
        balanceGender: Boolean(balanceGenderInput.checked),
      }),
    });
    renderResult(result);
    setCloudStatus(`Grup ${result.gameName} #${result.id} tersimpan di Cloudflare D1`);
    await refreshDrawHistory(result.id);
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    await loadGamesFromCloud();
    const data = await api("/api/participants");
    if (data.participants.length) {
      showParticipantData(data.participants, data.filename || "Cloudflare D1");
      setCloudStatus(`${data.participants.length} peserta dimuat dari Cloudflare D1`);
    } else {
      setCloudStatus("Belum ada data peserta di Cloudflare D1. Unggah CSV untuk menyimpan.", "muted");
      hide(clearBtn);
    }

    const { draws } = await api("/api/draws");
    await refreshDrawHistory(draws[0]?.id);
    if (draws[0]) {
      const latest = await api(`/api/draws/${draws[0].id}`);
      renderResult(latest);
    }
  } catch (error) {
    setCloudStatus(
      `Cloudflare belum terhubung: ${error.message}. Jalankan npm run dev atau deploy Worker.`,
      "warn",
    );
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

gameGrid.addEventListener("change", (event) => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.name === "game-id") {
    applyGame(input.value);
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
document.querySelector("#restore-games").addEventListener("click", restoreGames);
document.querySelector("#game-cancel").addEventListener("click", closeGameEditor);
gameEditor.addEventListener("submit", saveGame);

gameNameInput.addEventListener("input", () => {
  if (gameEditId.value) return;
  if (!gamePrefixInput.dataset.touched) {
    gamePrefixInput.value = gameNameInput.value.trim() || "Tim";
  }
});

gamePrefixInput.addEventListener("input", () => {
  gamePrefixInput.dataset.touched = "1";
});

teamCountInput.addEventListener("input", updateNeed);
membersInput.addEventListener("input", updateNeed);

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runDraw();
});

document.querySelector("#reshuffle").addEventListener("click", runDraw);

document.querySelector("#export-csv").addEventListener("click", () => {
  if (!lastResult) return;
  const csv = teamsToCsv(lastResult.teams, lastResult.leftover, lastResult.gameName || selectedGame().name);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hasil-${slugify(lastResult.gameName || "pembagian-tim")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#print-result").addEventListener("click", () => window.print());

drawHistory.addEventListener("change", async () => {
  const id = drawHistory.value;
  if (!id) return;
  try {
    const draw = await api(`/api/draws/${id}`);
    renderResult(draw);
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Hapus semua peserta dan hasil undian dari Cloudflare D1? Jenis permainan tetap disimpan.")) return;
  try {
    await api("/api/participants", { method: "DELETE" });
    participants = [];
    lastResult = null;
    hide(dataPanel);
    hide(configForm);
    hide(resultPanel);
    hide(clearBtn);
    hide(drawHistory);
    fileStatus.textContent = "Data Cloudflare D1 sudah dikosongkan.";
    setCloudStatus("Peserta dan undian dihapus. Jenis permainan tetap ada.", "muted");
    renderGamePicker();
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
});

renderGamePicker();
loadFromCloud();
