import { parseParticipantsCsv, summarizeParticipants } from "./csv.js";
import { teamsToCsv } from "./teams.js";
import { api } from "./api.js";

const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const fileStatus = document.querySelector("#file-status");
const fileName = document.querySelector("#file-name");
const dataPanel = document.querySelector("#data-panel");
const configPanel = document.querySelector("#config-panel");
const resultPanel = document.querySelector("#result-panel");
const statsEl = document.querySelector("#stats");
const rowsEl = document.querySelector("#participant-rows");
const teamCountInput = document.querySelector("#team-count");
const membersInput = document.querySelector("#members-per-team");
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
let lastResult = null;

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

function updateNeed() {
  const teams = Number(teamCountInput.value);
  const size = Number(membersInput.value);
  const needed = teams * size;
  const enough = Number.isInteger(needed) && needed > 0 && participants.length >= needed;
  needBox.innerHTML = `Kebutuhan: <strong>${needed || 0} orang</strong> dari ${participants.length} peserta`;
  needBox.style.color = enough ? "inherit" : "var(--danger)";
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
  show(dataPanel);
  show(configPanel);
  show(clearBtn);
  hide(configError);
  updateNeed();
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
  const when = result.createdAt ? ` Disimpan ${formatTime(result.createdAt)}.` : "";
  resultMeta.textContent = `${result.teams.length} tim × ${result.teams[0]?.members.length || 0} anggota. ${result.used} peserta terpakai dari ${result.total}.${when}`;
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

  show(resultPanel);
}

function formatTime(value) {
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
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
          `<option value="${draw.id}" ${String(draw.id) === String(selectedId) ? "selected" : ""}>Undian #${draw.id} · ${draw.teamCount}×${draw.membersPerTeam} · ${escapeHtml(draw.createdAt)}</option>`,
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
      }),
    });
    renderResult(result);
    setCloudStatus(`Hasil undian #${result.id} tersimpan di Cloudflare D1`);
    await refreshDrawHistory(result.id);
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
  }
}

async function loadFromCloud() {
  try {
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

teamCountInput.addEventListener("input", updateNeed);
membersInput.addEventListener("input", updateNeed);

configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runDraw();
});

document.querySelector("#reshuffle").addEventListener("click", runDraw);

document.querySelector("#export-csv").addEventListener("click", () => {
  if (!lastResult) return;
  const csv = teamsToCsv(lastResult.teams, lastResult.leftover);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hasil-pembagian-tim.csv";
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
  if (!confirm("Hapus semua peserta dan hasil undian dari Cloudflare D1?")) return;
  try {
    await api("/api/participants", { method: "DELETE" });
    participants = [];
    lastResult = null;
    hide(dataPanel);
    hide(configPanel);
    hide(resultPanel);
    hide(clearBtn);
    hide(drawHistory);
    fileStatus.textContent = "Data Cloudflare D1 sudah dikosongkan.";
    setCloudStatus("Cloudflare D1 kosong. Unggah CSV baru.", "muted");
  } catch (error) {
    setCloudStatus(error.message, "warn");
  }
});

loadFromCloud();
