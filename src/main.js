import { parseParticipantsCsv, summarizeParticipants } from "./csv.js";
import { divideTeams, teamsToCsv } from "./teams.js";

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

let participants = [];
let lastResult = null;

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
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

function loadCsvText(text, name) {
  const parsed = parseParticipantsCsv(text);
  participants = parsed.participants;
  fileStatus.textContent = `${participants.length} peserta berhasil dimuat${
    parsed.errors.length ? ` (${parsed.errors.length} baris dilewati)` : ""
  }.`;
  fileName.textContent = name;
  renderParticipants(participants);
  show(dataPanel);
  show(configPanel);
  hide(resultPanel);
  lastResult = null;
  hide(configError);
  updateNeed();
}

async function readFile(file) {
  const text = await file.text();
  loadCsvText(text, file.name);
}

function renderResult(result) {
  lastResult = result;
  resultMeta.textContent = `${result.teams.length} tim × ${result.teams[0]?.members.length || 0} anggota. ${result.used} peserta terpakai dari ${result.total}.`;
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
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function runDraw() {
  hide(configError);
  try {
    const result = divideTeams(participants, {
      teamCount: Number(teamCountInput.value),
      membersPerTeam: Number(membersInput.value),
    });
    renderResult(result);
  } catch (error) {
    configError.textContent = error.message;
    show(configError);
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
  if (file) readFile(file).catch((error) => {
    fileStatus.textContent = error.message;
  });
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    readFile(file).catch((error) => {
      fileStatus.textContent = error.message;
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
