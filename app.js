const STORAGE_KEY = "workout-logger-v4";

const DEFAULT_TEMPLATES = [
  { id: createId(), name: "Push", exercises: ["Bankdrücken", "Schrägbankdrücken", "Schulterdrücken", "Seitheben", "Trizepsdrücken"] },
  { id: createId(), name: "Pull", exercises: ["Kreuzheben", "Klimmzüge", "Rudern", "Latziehen", "Bizepscurls"] },
  { id: createId(), name: "Legs", exercises: ["Kniebeugen", "Beinpresse", "Rumänisches Kreuzheben", "Beinstrecker", "Beinbeuger", "Wadenheben"] }
];

const state = loadState();

const selectedDateInput = document.getElementById("selectedDate");
const workoutTitleInput = document.getElementById("workoutTitle");
const dayNotesInput = document.getElementById("dayNotes");
const exerciseNameInput = document.getElementById("exerciseName");
const addExerciseBtn = document.getElementById("addExerciseBtn");
const exerciseList = document.getElementById("exerciseList");
const todayBtn = document.getElementById("todayBtn");
const copyYesterdayBtn = document.getElementById("copyYesterdayBtn");
const deleteDayBtn = document.getElementById("deleteDayBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFile");
const resetAllBtn = document.getElementById("resetAllBtn");

const statDate = document.getElementById("statDate");
const statExercises = document.getElementById("statExercises");
const statSets = document.getElementById("statSets");
const statVolume = document.getElementById("statVolume");

const templateList = document.getElementById("templateList");
const newTemplateBtn = document.getElementById("newTemplateBtn");
const templateEditorCard = document.getElementById("templateEditorCard");
const templateEditorTitle = document.getElementById("templateEditorTitle");
const cancelTemplateEditBtn = document.getElementById("cancelTemplateEditBtn");
const templateNameInput = document.getElementById("templateName");
const templateExerciseInput = document.getElementById("templateExerciseInput");
const addTemplateExerciseBtn = document.getElementById("addTemplateExerciseBtn");
const templateExerciseList = document.getElementById("templateExerciseList");
const saveTemplateBtn = document.getElementById("saveTemplateBtn");

const trainingCard = document.getElementById("trainingCard");
const trainingCardBody = document.getElementById("trainingCardBody");
const toggleTrainingCardBtn = document.getElementById("toggleTrainingCardBtn");

const summaryDate = document.getElementById("summaryDate");
const summaryWorkoutTitle = document.getElementById("summaryWorkoutTitle");
const summaryCounts = document.getElementById("summaryCounts");

let editingTemplateId = null;
let editingTemplateExercises = [];

init();

function init() {
  if (!state.selectedDate) state.selectedDate = todayISO();
  if (!state.workouts[state.selectedDate]) state.workouts[state.selectedDate] = createEmptyWorkout();
  if (!Array.isArray(state.templates) || state.templates.length === 0) {
    state.templates = DEFAULT_TEMPLATES;
  }

  selectedDateInput.value = state.selectedDate;
  window.addEventListener("resize", restoreTrainingCardState);
  registerServiceWorker();
  bindEvents();
  restoreTrainingCardState();
  saveState();
  render();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        selectedDate: parsed.selectedDate || todayISO(),
        workouts: parsed.workouts || {},
        templates: parsed.templates || []
      };
    } catch (_) {}
  }
  return {
    selectedDate: todayISO(),
    workouts: {},
    templates: structuredClone(DEFAULT_TEMPLATES)
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createEmptyWorkout() {
  return {
    title: "",
    notes: "",
    exercises: []
  };
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function todayISO() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffsetMs).toISOString().slice(0, 10);
}

function formatDateGerman(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getWorkout(date = state.selectedDate) {
  if (!state.workouts[date]) {
    state.workouts[date] = createEmptyWorkout();
  }
  return state.workouts[date];
}

function bindEvents() {
  selectedDateInput.addEventListener("change", () => {
    if (!selectedDateInput.value) return;
    state.selectedDate = selectedDateInput.value;
    toggleTrainingCardBtn.addEventListener("click", toggleTrainingCard);
    getWorkout(state.selectedDate);
    saveState();
    render();
  });

  workoutTitleInput.addEventListener("input", () => {
    getWorkout().title = workoutTitleInput.value;
    saveState();
  });

  dayNotesInput.addEventListener("input", () => {
    getWorkout().notes = dayNotesInput.value;
    saveState();
  });

  addExerciseBtn.addEventListener("click", addExercise);
  exerciseNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addExercise();
  });

  todayBtn.addEventListener("click", () => {
    state.selectedDate = todayISO();
    selectedDateInput.value = state.selectedDate;
    getWorkout(state.selectedDate);
    saveState();
    render();
  });

  copyYesterdayBtn.addEventListener("click", copyYesterday);
  deleteDayBtn.addEventListener("click", deleteSelectedDay);
  exportBtn.addEventListener("click", exportData);
  importBtn.addEventListener("click", () => importFileInput.click());
  importFileInput.addEventListener("change", importData);
  resetAllBtn.addEventListener("click", resetAllData);

  newTemplateBtn.addEventListener("click", startNewTemplate);
  cancelTemplateEditBtn.addEventListener("click", closeTemplateEditor);
  addTemplateExerciseBtn.addEventListener("click", addExerciseToTemplateEditor);
  templateExerciseInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addExerciseToTemplateEditor();
  });
  saveTemplateBtn.addEventListener("click", saveTemplate);
}

function addExercise() {
  const name = exerciseNameInput.value.trim();
  if (!name) return;

  const workout = getWorkout();
  workout.exercises.push({
    id: createId(),
    name,
    sets: []
  });

  exerciseNameInput.value = "";
  saveState();
  render();
}

function deleteExercise(exerciseId) {
  const workout = getWorkout();
  workout.exercises = workout.exercises.filter(ex => ex.id !== exerciseId);
  saveState();
  render();
}

function addSet(exerciseId) {
  const kgInput = document.getElementById(`kg-${exerciseId}`);
  const repsInput = document.getElementById(`reps-${exerciseId}`);

  const kg = Number(kgInput.value.trim());
  const reps = Number(repsInput.value.trim());

  if (Number.isNaN(kg) || Number.isNaN(reps)) return;

  const exercise = getWorkout().exercises.find(ex => ex.id === exerciseId);
  if (!exercise) return;

  exercise.sets.push({
    id: createId(),
    kg,
    reps,
    createdAt: new Date().toISOString()
  });

  kgInput.value = "";
  repsInput.value = "";
  saveState();
  render();
}

function deleteSet(exerciseId, setId) {
  const exercise = getWorkout().exercises.find(ex => ex.id === exerciseId);
  if (!exercise) return;
  exercise.sets = exercise.sets.filter(set => set.id !== setId);
  saveState();
  render();
}

function copyYesterday() {
  const d = new Date(state.selectedDate + "T12:00:00");
  d.setDate(d.getDate() - 1);
  const y = d.toISOString().slice(0, 10);

  if (!state.workouts[y]) {
    alert("Kein Workout für gestern gefunden.");
    return;
  }

  if (!confirm("Workout von gestern in den aktuellen Tag kopieren?")) return;

  const src = state.workouts[y];
  state.workouts[state.selectedDate] = {
    title: src.title || "",
    notes: src.notes || "",
    exercises: src.exercises.map(ex => ({
      id: createId(),
      name: ex.name,
      sets: ex.sets.map(set => ({
        id: createId(),
        kg: set.kg,
        reps: set.reps,
        createdAt: new Date().toISOString()
      }))
    }))
  };

  saveState();
  render();
}

function deleteSelectedDay() {
  if (!confirm(`Workout für ${state.selectedDate} löschen?`)) return;
  delete state.workouts[state.selectedDate];
  getWorkout(state.selectedDate);
  saveState();
  render();
}

function calcExerciseVolume(exercise) {
  return exercise.sets.reduce((sum, set) => sum + (set.kg * set.reps), 0);
}

function calcWorkoutVolume(workout) {
  return workout.exercises.reduce((sum, ex) => sum + calcExerciseVolume(ex), 0);
}

function totalSets(workout) {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

function getPreviousExerciseEntry(exerciseName, currentDate) {
  const dates = Object.keys(state.workouts)
    .filter(date => date < currentDate)
    .sort((a, b) => b.localeCompare(a));

  for (const date of dates) {
    const workout = state.workouts[date];
    const match = workout.exercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
    if (match && match.sets.length > 0) {
      return { date, exercise: match };
    }
  }
  return null;
}

function updateStats() {
  const workout = getWorkout();
  const exerciseCount = workout.exercises.length;
  const setCount = totalSets(workout);
  const title = (workout.title || "").trim();

  statDate.textContent = formatDateGerman(state.selectedDate);
  statExercises.textContent = exerciseCount;
  statSets.textContent = setCount;
  statVolume.textContent = `${calcWorkoutVolume(workout)} kg`;

  summaryDate.textContent = formatDateGerman(state.selectedDate);
  summaryWorkoutTitle.textContent = title || "Ohne Titel";
  summaryCounts.textContent = `${exerciseCount} Übung${exerciseCount === 1 ? "" : "en"} / ${setCount} Satz${setCount === 1 ? "" : "e"}`;
}

function render() {
  const workout = getWorkout();

  selectedDateInput.value = state.selectedDate;
  workoutTitleInput.value = workout.title || "";
  dayNotesInput.value = workout.notes || "";

  updateStats();
  renderTemplates();
  renderTemplateEditor();
  renderExercises();
}

function renderTemplates() {
  if (state.templates.length === 0) {
    templateList.innerHTML = '<div class="empty">Noch keine Templates vorhanden.</div>';
    return;
  }

  templateList.innerHTML = state.templates.map(template => `
    <div class="template-item">
      <div class="template-item-header">
        <div>
          <div class="template-name">${escapeHtml(template.name)}</div>
          <div class="muted small">${template.exercises.length} Übung(en)</div>
        </div>
        <div class="template-actions">
          <button class="btn-primary" onclick="applyTemplate('${template.id}')">Anwenden</button>
          <button class="btn-secondary" onclick="editTemplate('${template.id}')">Bearbeiten</button>
          <button class="btn-danger" onclick="deleteTemplate('${template.id}')">Löschen</button>
        </div>
      </div>
      <div class="template-exercise-list">
        ${template.exercises.map(name => `
          <div class="template-exercise-item">${escapeHtml(name)}</div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderTemplateEditor() {
  templateExerciseList.innerHTML = editingTemplateExercises.length === 0
    ? '<div class="empty">Noch keine Übungen im Template.</div>'
    : editingTemplateExercises.map((name, index) => `
        <div class="template-exercise-item template-item-header">
          <div>${escapeHtml(name)}</div>
          <button class="btn-danger" onclick="removeTemplateExercise(${index})">Entfernen</button>
        </div>
      `).join("");
}

function renderExercises() {
  const workout = getWorkout();

  if (workout.exercises.length === 0) {
    exerciseList.innerHTML = '<div class="empty">Noch keine Übungen für diesen Tag vorhanden.</div>';
    return;
  }

  exerciseList.innerHTML = workout.exercises.map(exercise => {
    const prev = getPreviousExerciseEntry(exercise.name, state.selectedDate);
    const volume = calcExerciseVolume(exercise);

    return `
      <div class="exercise-card">
        <div class="exercise-head">
          <div>
            <div class="exercise-name">${escapeHtml(exercise.name)}</div>
            <div class="muted small">${exercise.sets.length} Satz/Sätze</div>
          </div>
          <button class="btn-danger" onclick="deleteExercise('${exercise.id}')">Übung löschen</button>
        </div>

        <div class="volume-box">
          Heutiges Volumen: <strong>${volume} kg</strong>
        </div>

        ${prev ? `
          <div class="history-box">
            Letzter Eintrag am <strong>${escapeHtml(formatDateGerman(prev.date))}</strong><br />
            ${prev.exercise.sets.map((set, i) => `Satz ${i + 1}: ${set.kg} kg × ${set.reps}`).join(" • ")}
          </div>
        ` : `
          <div class="history-box" style="background:rgba(148,163,184,0.08);border-color:rgba(148,163,184,0.18);color:#e2e8f0;">
            Kein früherer Eintrag gefunden.
          </div>
        `}

        <div class="row two-col spacer-top">
          <div>
            <label for="kg-${exercise.id}">Gewicht (kg)</label>
            <input id="kg-${exercise.id}" type="number" step="0.5" inputmode="decimal" placeholder="z. B. 80" />
          </div>
          <div>
            <label for="reps-${exercise.id}">Wiederholungen</label>
            <input id="reps-${exercise.id}" type="number" inputmode="numeric" placeholder="z. B. 8" />
          </div>
        </div>

        <div class="toolbar spacer-top">
          <button class="btn-primary full-width" onclick="addSet('${exercise.id}')">Satz speichern</button>
        </div>

        <div class="set-list">
          ${exercise.sets.length === 0
            ? '<div class="empty">Noch keine Sätze gespeichert.</div>'
            : exercise.sets.map((set, index) => `
                <div class="set-row">
                  <div>
                    <strong>Satz ${index + 1}</strong><br />
                    <span class="muted">${set.kg} kg × ${set.reps} Wdh. = ${set.kg * set.reps} Volumen</span>
                  </div>
                  <button class="btn-danger" onclick="deleteSet('${exercise.id}', '${set.id}')">Löschen</button>
                </div>
              `).join("")
          }
        </div>
      </div>
    `;
  }).join("");
}

function startNewTemplate() {
  editingTemplateId = null;
  editingTemplateExercises = [];
  templateNameInput.value = "";
  templateExerciseInput.value = "";
  templateEditorTitle.textContent = "Neues Template";
  templateEditorCard.classList.remove("hidden");
  renderTemplateEditor();
}

function editTemplate(templateId) {
  const template = state.templates.find(t => t.id === templateId);
  if (!template) return;

  editingTemplateId = template.id;
  editingTemplateExercises = [...template.exercises];
  templateNameInput.value = template.name;
  templateExerciseInput.value = "";
  templateEditorTitle.textContent = "Template bearbeiten";
  templateEditorCard.classList.remove("hidden");
  renderTemplateEditor();
}

function closeTemplateEditor() {
  editingTemplateId = null;
  editingTemplateExercises = [];
  templateNameInput.value = "";
  templateExerciseInput.value = "";
  templateEditorCard.classList.add("hidden");
}

function addExerciseToTemplateEditor() {
  const name = templateExerciseInput.value.trim();
  if (!name) return;
  editingTemplateExercises.push(name);
  templateExerciseInput.value = "";
  renderTemplateEditor();
}

function removeTemplateExercise(index) {
  editingTemplateExercises.splice(index, 1);
  renderTemplateEditor();
}

function saveTemplate() {
  const name = templateNameInput.value.trim();
  if (!name) {
    alert("Bitte einen Template-Namen eingeben.");
    return;
  }

  if (editingTemplateExercises.length === 0) {
    alert("Bitte mindestens eine Übung hinzufügen.");
    return;
  }

  if (editingTemplateId) {
    const template = state.templates.find(t => t.id === editingTemplateId);
    if (!template) return;
    template.name = name;
    template.exercises = [...editingTemplateExercises];
  } else {
    state.templates.push({
      id: createId(),
      name,
      exercises: [...editingTemplateExercises]
    });
  }

  saveState();
  closeTemplateEditor();
  render();
}

function deleteTemplate(templateId) {
  if (!confirm("Template wirklich löschen?")) return;
  state.templates = state.templates.filter(t => t.id !== templateId);
  saveState();
  render();
}

function applyTemplate(templateId) {
  const template = state.templates.find(t => t.id === templateId);
  if (!template) return;

  const workout = getWorkout();
  const existing = new Set(workout.exercises.map(ex => ex.name.toLowerCase()));

  for (const name of template.exercises) {
    if (!existing.has(name.toLowerCase())) {
      workout.exercises.push({
        id: createId(),
        name,
        sets: []
      });
    }
  }

  if (!workout.title) {
    workout.title = template.name;
  }

  saveState();
  render();
}

function isMobileView() {
  return window.innerWidth <= 720;
}

function toggleTrainingCard() {
  const collapsed = trainingCard.classList.toggle("collapsed");

  toggleTrainingCardBtn.textContent = collapsed ? "Aufklappen" : "Einklappen";
  localStorage.setItem("workout-training-card-collapsed", collapsed ? "1" : "0");
}

function restoreTrainingCardState() {
  const saved = localStorage.getItem("workout-training-card-collapsed");

  if (isMobileView() && saved === "1") {
    trainingCard.classList.add("collapsed");
    toggleTrainingCardBtn.textContent = "Aufklappen";
  } else {
    trainingCard.classList.remove("collapsed");
    toggleTrainingCardBtn.textContent = "Einklappen";
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workout-logger-v4-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || typeof imported !== "object") throw new Error();

      if (!confirm("Import ersetzt alle aktuellen Daten. Fortfahren?")) return;

      state.selectedDate = imported.selectedDate || todayISO();
      state.workouts = imported.workouts || {};
      state.templates = imported.templates || structuredClone(DEFAULT_TEMPLATES);
      getWorkout(state.selectedDate);

      selectedDateInput.value = state.selectedDate;
      saveState();
      render();
    } catch {
      alert("Import fehlgeschlagen. Bitte gültige JSON-Daten verwenden.");
    } finally {
      importFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm("Wirklich ALLE Daten löschen?")) return;
  state.selectedDate = todayISO();
  state.workouts = {};
  state.templates = structuredClone(DEFAULT_TEMPLATES);
  getWorkout(state.selectedDate);
  selectedDateInput.value = state.selectedDate;
  saveState();
  render();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addSet = addSet;
window.deleteSet = deleteSet;
window.deleteExercise = deleteExercise;
window.applyTemplate = applyTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.removeTemplateExercise = removeTemplateExercise;
