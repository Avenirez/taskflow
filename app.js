/**
 * Taskflow
 * Client-side task engine with local persistence and defensive security controls.
 */

// ==========================================================================
// SECURITY DEFENSE CONTROLS
// ==========================================================================

// 1. Anti-Clickjacking Frame Buster
if (window.self !== window.top) {
  try {
    window.top.location = window.self.location;
  } catch (frameError) {
    document.documentElement.style.display = "none";
  }
}

// 2. Strict Whitelists and Bounds
const SECURITY_LIMITS = Object.freeze({
  MAX_TASKS: 500,
  MAX_TEXT_LENGTH: 160,
  MAX_QUERY_LENGTH: 80,
  VALID_PRIORITIES: new Set(["rendah", "sedang", "tinggi"]),
  VALID_CATEGORIES: new Set(["umum", "kerja", "pribadi", "keuangan"]),
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/
});

// 3. Sanitizer to strip control characters and enforce bounds
function sanitizeInputText(raw, maxLength = SECURITY_LIMITS.MAX_TEXT_LENGTH) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

// 4. Safe Deserialization and Prototype Pollution Defense
function sanitizeStoredTodos(rawJson) {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    const safeList = [];
    const seenIds = new Set();

    for (let i = 0; i < parsed.length && safeList.length < SECURITY_LIMITS.MAX_TASKS; i++) {
      const item = parsed[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;

      // Defense: Reject prototype pollution attempts
      if (
        Object.prototype.hasOwnProperty.call(item, "__proto__") ||
        Object.prototype.hasOwnProperty.call(item, "constructor") ||
        Object.prototype.hasOwnProperty.call(item, "prototype")
      ) {
        continue;
      }

      // Validate ID: alphanumeric, underscore, hyphen only
      let id = typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(item.id)
        ? item.id
        : String(Date.now() + Math.floor(Math.random() * 1000));

      if (seenIds.has(id)) {
        id = id + "_" + i;
      }
      seenIds.add(id);

      // Validate Text
      const text = sanitizeInputText(item.text);
      if (!text) continue;

      // Validate Completed Status
      const completed = Boolean(item.completed);

      // Validate Priority
      const rawPriority = typeof item.priority === "string" ? item.priority.toLowerCase() : "";
      const priority = SECURITY_LIMITS.VALID_PRIORITIES.has(rawPriority) ? rawPriority : "sedang";

      // Validate Date
      const rawDate = typeof item.date === "string" ? item.date.trim() : "";
      const date = SECURITY_LIMITS.DATE_PATTERN.test(rawDate) ? rawDate : "";

      // Validate Category
      const rawCategory = typeof item.category === "string" ? item.category.toLowerCase() : "";
      const category = SECURITY_LIMITS.VALID_CATEGORIES.has(rawCategory) ? rawCategory : "umum";

      // Validate Timestamp
      const createdAt = typeof item.createdAt === "number" && !isNaN(item.createdAt)
        ? item.createdAt
        : Date.now();

      safeList.push({
        id,
        text,
        completed,
        priority,
        date,
        category,
        createdAt
      });
    }

    return safeList;
  } catch (parseError) {
    console.warn("Storage validation fallback:", parseError);
    return [];
  }
}

// ==========================================================================
// STATE
// ==========================================================================
let state = {
  todos: sanitizeStoredTodos(localStorage.getItem("taskflow_todos")),
  currentFilter: "all",
  currentCategory: "all",
  soundEnabled: localStorage.getItem("taskflow_sound") !== "false",
  editingTodoId: null
};

// ==========================================================================
// DOM REFERENCES
// ==========================================================================
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoPriority = document.getElementById("todo-priority");
const todoDate = document.getElementById("todo-date");
const todoCategory = document.getElementById("todo-category");
const searchInput = document.getElementById("search-input");
const todoList = document.getElementById("todo-list");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptyDesc = document.getElementById("empty-desc");
const currentDateEl = document.getElementById("current-date");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const itemsCount = document.getElementById("items-count");
const clearCompletedBtn = document.getElementById("clear-completed");
const filterTabs = document.querySelectorAll(".state-tab");
const sliderIndicator = document.getElementById("slider-indicator");
const categoryChips = document.querySelectorAll(".filter-chip");
const countAll = document.getElementById("count-all");
const countActive = document.getElementById("count-active");
const countCompleted = document.getElementById("count-completed");

const soundToggleBtn = document.getElementById("sound-toggle");
const soundIconOn = soundToggleBtn ? soundToggleBtn.querySelector(".sound-icon-on") : null;
const soundIconOff = soundToggleBtn ? soundToggleBtn.querySelector(".sound-icon-off") : null;

const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editText = document.getElementById("edit-text");
const editPriority = document.getElementById("edit-priority");
const editDate = document.getElementById("edit-date");
const editCategory = document.getElementById("edit-category");
const modalClose = document.getElementById("modal-close");
const modalCancel = document.getElementById("modal-cancel");

const toastContainer = document.getElementById("toast-container");

// ==========================================================================
// AUDIO FEEDBACK
// ==========================================================================
let audioContext = null;

function playCheckSound() {
  if (!state.soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
  } catch (audioError) {
    console.warn("Audio unavailable:", audioError);
  }
}

function updateSoundToggleUI() {
  if (!soundToggleBtn) return;

  if (state.soundEnabled) {
    if (soundIconOn) soundIconOn.classList.remove("hidden");
    if (soundIconOff) soundIconOff.classList.add("hidden");
    soundToggleBtn.setAttribute("title", "Audio: Aktif");
    soundToggleBtn.setAttribute("aria-label", "Nonaktifkan audio");
  } else {
    if (soundIconOn) soundIconOn.classList.add("hidden");
    if (soundIconOff) soundIconOff.classList.remove("hidden");
    soundToggleBtn.setAttribute("title", "Audio: Senyap");
    soundToggleBtn.setAttribute("aria-label", "Aktifkan audio");
  }
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    try {
      localStorage.setItem("taskflow_sound", String(state.soundEnabled));
    } catch (storageError) {
      console.warn("Storage write failed:", storageError);
    }
    updateSoundToggleUI();
    showToast(state.soundEnabled ? "Audio diaktifkan." : "Audio dinonaktifkan.", null, 2000);
  });
}

// ==========================================================================
// TOAST & UNDO NOTIFICATION
// ==========================================================================
function showToast(message, undoAction = null, duration = 4000) {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = "toast-item";

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-msg";
  msgSpan.textContent = message; // Safe: textContent prevents script injection
  toast.appendChild(msgSpan);

  if (undoAction && typeof undoAction === "function") {
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "toast-undo";
    undoBtn.textContent = "Urungkan";
    undoBtn.addEventListener("click", () => {
      undoAction();
      dismissToast(toast);
    });
    toast.appendChild(undoBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "toast-dismiss";
  dismissBtn.setAttribute("aria-label", "Tutup");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "18");
  line1.setAttribute("y1", "6");
  line1.setAttribute("x2", "6");
  line1.setAttribute("y2", "18");

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "6");
  line2.setAttribute("y1", "6");
  line2.setAttribute("x2", "18");
  line2.setAttribute("y2", "18");

  svg.appendChild(line1);
  svg.appendChild(line2);
  dismissBtn.appendChild(svg);

  dismissBtn.addEventListener("click", () => dismissToast(toast));
  toast.appendChild(dismissBtn);

  toastContainer.appendChild(toast);

  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast._timeoutId = timeoutId;
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains("hiding")) return;
  if (toast._timeoutId) clearTimeout(toast._timeoutId);
  toast.classList.add("hiding");
  toast.addEventListener("transitionend", () => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, { once: true });
}

// ==========================================================================
// DATE FORMATTER
// ==========================================================================
function updateDateDisplay() {
  if (!currentDateEl) return;
  const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const today = new Date();
  currentDateEl.textContent = today.toLocaleDateString("id-ID", options);
}

// ==========================================================================
// PERSISTENCE WITH STORAGE QUOTA PROTECTION
// ==========================================================================
function saveToLocalStorage() {
  try {
    localStorage.setItem("taskflow_todos", JSON.stringify(state.todos));
  } catch (storageError) {
    console.error("Storage error:", storageError);
    showToast("Penyimpanan lokal penuh. Hapus beberapa tugas.", null, 4000);
  }
}

// ==========================================================================
// TASK OPERATIONS (CRUD)
// ==========================================================================
function addTodo(rawText, rawPriority, rawDate, rawCategory) {
  const text = sanitizeInputText(rawText);
  if (!text) return;

  if (state.todos.length >= SECURITY_LIMITS.MAX_TASKS) {
    showToast("Batas kuota tugas tercapai (maksimal 500 tugas).", null, 3000);
    return;
  }

  const priorityCandidate = typeof rawPriority === "string" ? rawPriority.toLowerCase() : "";
  const priority = SECURITY_LIMITS.VALID_PRIORITIES.has(priorityCandidate) ? priorityCandidate : "sedang";

  const dateCandidate = typeof rawDate === "string" ? rawDate.trim() : "";
  const date = SECURITY_LIMITS.DATE_PATTERN.test(dateCandidate) ? dateCandidate : "";

  const categoryCandidate = typeof rawCategory === "string" ? rawCategory.toLowerCase() : "";
  const category = SECURITY_LIMITS.VALID_CATEGORIES.has(categoryCandidate) ? categoryCandidate : "umum";

  const newTodo = {
    id: "task_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    text,
    completed: false,
    priority,
    date,
    category,
    createdAt: Date.now()
  };

  state.todos.unshift(newTodo);
  saveToLocalStorage();
  render();
}

function toggleTodo(id) {
  state.todos = state.todos.map(todo => {
    if (todo.id === id) {
      const nextStatus = !todo.completed;
      if (nextStatus) playCheckSound();
      return { ...todo, completed: nextStatus };
    }
    return todo;
  });

  saveToLocalStorage();
  render();
}

function deleteTodo(id, itemElement) {
  const index = state.todos.findIndex(t => t.id === id);
  if (index === -1) return;

  const targetTodo = state.todos[index];

  const finalizeDeletion = () => {
    state.todos.splice(index, 1);
    saveToLocalStorage();
    render();

    showToast("Tugas dihapus.", () => {
      state.todos.splice(index, 0, targetTodo);
      saveToLocalStorage();
      render();
      showToast("Tugas dipulihkan.");
    });
  };

  if (itemElement) {
    itemElement.classList.add("deleting");
    setTimeout(finalizeDeletion, 150);
  } else {
    finalizeDeletion();
  }
}

function clearCompleted() {
  const completedList = state.todos.filter(t => t.completed);
  if (completedList.length === 0) return;

  const previousSnapshot = [...state.todos];
  state.todos = state.todos.filter(t => !t.completed);
  saveToLocalStorage();
  render();

  showToast(`${completedList.length} tugas selesai dihapus.`, () => {
    state.todos = previousSnapshot;
    saveToLocalStorage();
    render();
    showToast("Tugas selesai dipulihkan.");
  });
}

// ==========================================================================
// EDIT MODAL
// ==========================================================================
function openEditModal(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo || !editModal) return;

  state.editingTodoId = id;
  editText.value = todo.text;
  editPriority.value = todo.priority;
  editDate.value = todo.date;
  editCategory.value = todo.category;

  editModal.classList.remove("hidden");
  editText.focus();
}

function closeEditModal() {
  if (!editModal) return;
  editModal.classList.add("hidden");
  state.editingTodoId = null;
}

if (editForm) {
  editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.editingTodoId) return;

    const updatedText = sanitizeInputText(editText.value);
    if (!updatedText) return;

    const rawPriority = editPriority.value.toLowerCase();
    const priority = SECURITY_LIMITS.VALID_PRIORITIES.has(rawPriority) ? rawPriority : "sedang";

    const rawDate = editDate.value.trim();
    const date = SECURITY_LIMITS.DATE_PATTERN.test(rawDate) ? rawDate : "";

    const rawCategory = editCategory.value.toLowerCase();
    const category = SECURITY_LIMITS.VALID_CATEGORIES.has(rawCategory) ? rawCategory : "umum";

    state.todos = state.todos.map(todo => {
      if (todo.id === state.editingTodoId) {
        return {
          ...todo,
          text: updatedText,
          priority,
          date,
          category
        };
      }
      return todo;
    });

    saveToLocalStorage();
    closeEditModal();
    render();
    showToast("Perubahan disimpan.");
  });
}

if (modalClose) modalClose.addEventListener("click", closeEditModal);
if (modalCancel) modalCancel.addEventListener("click", closeEditModal);

if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !editModal.classList.contains("hidden")) {
      closeEditModal();
    }
  });
}

// ==========================================================================
// CATEGORY FILTER
// ==========================================================================
categoryChips.forEach(chip => {
  chip.addEventListener("click", () => {
    categoryChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const selected = chip.getAttribute("data-category") || "all";
    state.currentCategory = selected;
    render();
  });
});

// ==========================================================================
// RENDER PIPELINE (XSS-FREE NATIVE DOM BUILDING)
// ==========================================================================
function render() {
  const totalCount = state.todos.length;
  const completedCount = state.todos.filter(t => t.completed).length;
  const activeCount = totalCount - completedCount;

  // 1. Metric Update
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  progressBar.style.width = `${progressPercent}%`;
  progressText.textContent = `${progressPercent}%`;

  // 2. Tab Badge Counts
  if (countAll) countAll.textContent = String(totalCount);
  if (countActive) countActive.textContent = String(activeCount);
  if (countCompleted) countCompleted.textContent = String(completedCount);

  // 3. Filter Dataset
  const rawQuery = searchInput ? searchInput.value : "";
  const query = sanitizeInputText(rawQuery, SECURITY_LIMITS.MAX_QUERY_LENGTH).toLowerCase();

  const filteredTodos = state.todos.filter(todo => {
    const matchesFilter =
      state.currentFilter === "all" ||
      (state.currentFilter === "active" && !todo.completed) ||
      (state.currentFilter === "completed" && todo.completed);

    const matchesCategory =
      state.currentCategory === "all" || todo.category === state.currentCategory;

    const matchesSearch = !query || todo.text.toLowerCase().includes(query);

    return matchesFilter && matchesCategory && matchesSearch;
  });

  // 4. Sort: Priority Weight, then Timestamp
  const priorityWeights = { tinggi: 3, sedang: 2, rendah: 1 };
  filteredTodos.sort((a, b) => {
    const weightDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
    if (weightDiff !== 0) return weightDiff;
    return b.createdAt - a.createdAt;
  });

  // 5. Render DOM Items via Native APIs (Eliminates DOM-based XSS)
  todoList.replaceChildren();

  if (filteredTodos.length === 0) {
    emptyState.classList.remove("hidden");
    todoList.classList.add("hidden");

    if (query) {
      if (emptyTitle) emptyTitle.textContent = "Tidak ditemukan";
      if (emptyDesc) emptyDesc.textContent = `Tidak ada tugas yang cocok dengan kata kunci "${query}".`;
    } else if (state.currentCategory !== "all") {
      const categoryNames = { umum: "Umum", kerja: "Kerja", pribadi: "Pribadi", keuangan: "Keuangan" };
      const categoryName = categoryNames[state.currentCategory] || state.currentCategory;
      if (emptyTitle) emptyTitle.textContent = "Kategori kosong";
      if (emptyDesc) emptyDesc.textContent = `Tidak ada tugas dalam kategori "${categoryName}".`;
    } else if (state.currentFilter === "active") {
      if (emptyTitle) emptyTitle.textContent = "Semua tugas selesai";
      if (emptyDesc) emptyDesc.textContent = "Tidak ada tugas aktif dalam antrean.";
    } else if (state.currentFilter === "completed") {
      if (emptyTitle) emptyTitle.textContent = "Belum ada yang selesai";
      if (emptyDesc) emptyDesc.textContent = "Tandai tugas yang sudah tuntas untuk melihatnya di sini.";
    } else {
      if (emptyTitle) emptyTitle.textContent = "Tidak ada tugas";
      if (emptyDesc) emptyDesc.textContent = "Daftar tugas kosong. Masukkan tugas baru di atas.";
    }
  } else {
    emptyState.classList.add("hidden");
    todoList.classList.remove("hidden");

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    filteredTodos.forEach(todo => {
      const itemEl = document.createElement("li");
      itemEl.className = "task-item" + (todo.completed ? " completed" : "");
      itemEl.setAttribute("data-id", todo.id);

      // Core container
      const itemCore = document.createElement("div");
      itemCore.className = "item-core";

      // Custom Checkbox
      const checkWrapper = document.createElement("label");
      checkWrapper.className = "check-wrapper";
      checkWrapper.title = todo.completed ? "Tandai aktif" : "Tandai selesai";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.completed;
      checkbox.setAttribute("aria-label", "Status tugas");
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      const checkBoxCustom = document.createElement("span");
      checkBoxCustom.className = "check-box";

      checkWrapper.appendChild(checkbox);
      checkWrapper.appendChild(checkBoxCustom);
      itemCore.appendChild(checkWrapper);

      // Details container
      const itemDetails = document.createElement("div");
      itemDetails.className = "item-details";

      const taskLabel = document.createElement("span");
      taskLabel.className = "task-label";
      taskLabel.textContent = todo.text; // Safe: avoids innerHTML interpolation
      taskLabel.title = "Klik ganda untuk mengedit";
      taskLabel.addEventListener("dblclick", () => openEditModal(todo.id));
      itemDetails.appendChild(taskLabel);

      // Tags row
      const tagRow = document.createElement("div");
      tagRow.className = "tag-row";

      // Priority Tag
      const priorityTag = document.createElement("span");
      priorityTag.className = "tag tag-priority-" + todo.priority;

      const priorityDot = document.createElement("span");
      priorityDot.className = "tag-dot";
      priorityTag.appendChild(priorityDot);

      const priorityText = document.createTextNode(
        todo.priority === "tinggi" ? "Tinggi" : todo.priority === "sedang" ? "Sedang" : "Rendah"
      );
      priorityTag.appendChild(priorityText);
      tagRow.appendChild(priorityTag);

      // Category Tag
      const categoryTag = document.createElement("span");
      categoryTag.className = "tag";
      const catCapitalized = todo.category.charAt(0).toUpperCase() + todo.category.slice(1);
      categoryTag.textContent = catCapitalized;
      tagRow.appendChild(categoryTag);

      // Date Tag
      if (todo.date) {
        const isOverdue = new Date(todo.date) < todayDate && !todo.completed;
        const dateTag = document.createElement("span");
        dateTag.className = "tag tag-date" + (isOverdue ? " overdue" : "");
        dateTag.textContent = todo.date;
        tagRow.appendChild(dateTag);
      }

      itemDetails.appendChild(tagRow);
      itemCore.appendChild(itemDetails);
      itemEl.appendChild(itemCore);

      // Actions container
      const itemActions = document.createElement("div");
      itemActions.className = "item-actions";

      // Edit Button
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "action-btn edit-btn";
      editBtn.title = "Edit tugas";
      editBtn.setAttribute("aria-label", "Edit tugas");

      const editSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      editSvg.setAttribute("width", "15");
      editSvg.setAttribute("height", "15");
      editSvg.setAttribute("viewBox", "0 0 24 24");
      editSvg.setAttribute("fill", "none");
      editSvg.setAttribute("stroke", "currentColor");
      editSvg.setAttribute("stroke-width", "2");
      editSvg.setAttribute("stroke-linecap", "round");
      editSvg.setAttribute("stroke-linejoin", "round");

      const editPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      editPath1.setAttribute("d", "M12 20h9");
      const editPath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      editPath2.setAttribute("d", "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z");

      editSvg.appendChild(editPath1);
      editSvg.appendChild(editPath2);
      editBtn.appendChild(editSvg);
      editBtn.addEventListener("click", () => openEditModal(todo.id));
      itemActions.appendChild(editBtn);

      // Delete Button
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "action-btn delete-btn";
      deleteBtn.title = "Hapus tugas";
      deleteBtn.setAttribute("aria-label", "Hapus tugas");

      const deleteSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      deleteSvg.setAttribute("width", "15");
      deleteSvg.setAttribute("height", "15");
      deleteSvg.setAttribute("viewBox", "0 0 24 24");
      deleteSvg.setAttribute("fill", "none");
      deleteSvg.setAttribute("stroke", "currentColor");
      deleteSvg.setAttribute("stroke-width", "2");
      deleteSvg.setAttribute("stroke-linecap", "round");
      deleteSvg.setAttribute("stroke-linejoin", "round");

      const deletePoly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      deletePoly.setAttribute("points", "3 6 5 6 21 6");
      const deletePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      deletePath.setAttribute("d", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2");

      deleteSvg.appendChild(deletePoly);
      deleteSvg.appendChild(deletePath);
      deleteBtn.appendChild(deleteSvg);
      deleteBtn.addEventListener("click", () => deleteTodo(todo.id, itemEl));
      itemActions.appendChild(deleteBtn);

      itemEl.appendChild(itemActions);
      todoList.appendChild(itemEl);
    });
  }

  // 6. Footer Counts
  if (itemsCount) {
    itemsCount.textContent = `${activeCount} tugas tersisa`;
  }

  // 7. Clear Completed Toggle
  if (clearCompletedBtn) {
    if (completedCount > 0) {
      clearCompletedBtn.classList.remove("hidden");
    } else {
      clearCompletedBtn.classList.add("hidden");
    }
  }
}

// ==========================================================================
// TAB NAVIGATION INDICATOR
// ==========================================================================
function updateSliderPosition(activeTab) {
  if (!activeTab || !sliderIndicator) return;
  sliderIndicator.style.width = `${activeTab.offsetWidth}px`;
  sliderIndicator.style.left = `${activeTab.offsetLeft}px`;
}

// ==========================================================================
// EVENT BINDINGS
// ==========================================================================
todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = todoInput.value;
  const priority = todoPriority ? todoPriority.value : "sedang";
  const date = todoDate ? todoDate.value : "";
  const category = todoCategory ? todoCategory.value : "umum";

  if (text.trim()) {
    addTodo(text, priority, date, category);
    todoInput.value = "";
    if (todoDate) todoDate.value = "";
    if (todoPriority) todoPriority.value = "sedang";
    if (todoCategory) todoCategory.value = "umum";
    todoInput.focus();
  }
});

if (searchInput) {
  searchInput.addEventListener("input", render);
}

if (clearCompletedBtn) {
  clearCompletedBtn.addEventListener("click", clearCompleted);
}

filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    filterTabs.forEach(t => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    const filterVal = tab.getAttribute("data-filter") || "all";
    state.currentFilter = filterVal;
    updateSliderPosition(tab);
    render();
  });
});

window.addEventListener("resize", () => {
  const activeTab = document.querySelector(".state-tab.active");
  if (activeTab) {
    updateSliderPosition(activeTab);
  }
});

// ==========================================================================
// BOOTSTRAP
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  updateDateDisplay();
  updateSoundToggleUI();

  setTimeout(() => {
    const activeTab = document.querySelector(".state-tab.active");
    if (activeTab) {
      updateSliderPosition(activeTab);
    }
  }, 50);

  render();
});
