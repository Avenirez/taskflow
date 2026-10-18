/**
 * Tugasku - Logic Application (Vanilla JavaScript)
 * Author: Antigravity AI
 * Description: State-based Todo List with animations, Local Storage,
 *              Undo management, full Edit Modal, Category Filters,
 *              Sound toggle, and Confetti celebration.
 */

// ==========================================================================
// SECURITY LIMITS & SANITIZATION
// ==========================================================================
const LIMITS = Object.freeze({
  MAX_TASKS: 500,
  MAX_TEXT_LENGTH: 160,
  MAX_QUERY_LENGTH: 80,
  VALID_PRIORITIES: new Set(['rendah', 'sedang', 'tinggi']),
  VALID_CATEGORIES: new Set(['umum', 'kerja', 'pribadi', 'belanja']),
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/
});

function sanitizeText(raw, maxLen = LIMITS.MAX_TEXT_LENGTH) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeStoredTodos(rawJson) {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    const safeList = [];
    const seenIds = new Set();

    for (let i = 0; i < parsed.length && safeList.length < LIMITS.MAX_TASKS; i++) {
      const item = parsed[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

      if (
        Object.prototype.hasOwnProperty.call(item, '__proto__') ||
        Object.prototype.hasOwnProperty.call(item, 'constructor') ||
        Object.prototype.hasOwnProperty.call(item, 'prototype')
      ) {
        continue;
      }

      let id = typeof item.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(item.id)
        ? item.id
        : String(Date.now() + Math.floor(Math.random() * 1000));

      if (seenIds.has(id)) {
        id = id + '_' + i;
      }
      seenIds.add(id);

      const text = sanitizeText(item.text);
      if (!text) continue;

      const completed = Boolean(item.completed);
      const rawPriority = typeof item.priority === 'string' ? item.priority.toLowerCase() : '';
      const priority = LIMITS.VALID_PRIORITIES.has(rawPriority) ? rawPriority : 'sedang';

      const rawDate = typeof item.date === 'string' ? item.date.trim() : '';
      const date = LIMITS.DATE_PATTERN.test(rawDate) ? rawDate : '';

      const rawCategory = typeof item.category === 'string' ? item.category.toLowerCase() : '';
      const category = LIMITS.VALID_CATEGORIES.has(rawCategory) ? rawCategory : 'umum';

      const createdAt = typeof item.createdAt === 'number' && !isNaN(item.createdAt)
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
  } catch (err) {
    console.warn('Storage validation fallback:', err);
    return [];
  }
}

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let state = {
  todos: sanitizeStoredTodos(localStorage.getItem('taskflow_todos')),
  currentFilter: 'all', // Options: 'all', 'active', 'completed'
  currentCategory: 'all', // Options: 'all', 'umum', 'kerja', 'pribadi', 'belanja'
  soundEnabled: localStorage.getItem('taskflow_sound') !== 'false',
  editingTodoId: null
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoPriority = document.getElementById('todo-priority');
const todoDate = document.getElementById('todo-date');
const todoCategory = document.getElementById('todo-category');
const searchInput = document.getElementById('search-input');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const emptyTitle = document.getElementById('empty-title');
const emptyDesc = document.getElementById('empty-desc');
const currentDateEl = document.getElementById('current-date');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const itemsCount = document.getElementById('items-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterTabs = document.querySelectorAll('.filter-tab');
const sliderIndicator = document.getElementById('slider-indicator');
const categoryChips = document.querySelectorAll('.category-chip');
const countAll = document.getElementById('count-all');
const countActive = document.getElementById('count-active');
const countCompleted = document.getElementById('count-completed');

// Sound Toggle
const soundToggleBtn = document.getElementById('sound-toggle');
const soundIconOn = soundToggleBtn ? soundToggleBtn.querySelector('.sound-icon-on') : null;
const soundIconOff = soundToggleBtn ? soundToggleBtn.querySelector('.sound-icon-off') : null;

// Edit Modal
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editText = document.getElementById('edit-text');
const editPriority = document.getElementById('edit-priority');
const editDate = document.getElementById('edit-date');
const editCategory = document.getElementById('edit-category');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Confetti Canvas
const confettiCanvas = document.getElementById('confetti-canvas');

// ==========================================================================
// AUDIO API (WEB AUDIO SYNTHESIZER)
// ==========================================================================
let audioContext = null;

function playSuccessSound() {
  if (!state.soundEnabled) return;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.12); // C6

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

function updateSoundToggleUI() {
  if (!soundToggleBtn) return;
  if (state.soundEnabled) {
    if (soundIconOn) soundIconOn.classList.remove('hidden');
    if (soundIconOff) soundIconOff.classList.add('hidden');
    soundToggleBtn.setAttribute('title', 'Suara: Aktif (Klik untuk matikan)');
    soundToggleBtn.setAttribute('aria-label', 'Matikan efek suara');
  } else {
    if (soundIconOn) soundIconOn.classList.add('hidden');
    if (soundIconOff) soundIconOff.classList.remove('hidden');
    soundToggleBtn.setAttribute('title', 'Suara: Senyap (Klik untuk aktifkan)');
    soundToggleBtn.setAttribute('aria-label', 'Aktifkan efek suara');
  }
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    try {
      localStorage.setItem('taskflow_sound', String(state.soundEnabled));
    } catch (err) {
      console.warn('Storage failed:', err);
    }
    updateSoundToggleUI();
    showToast(state.soundEnabled ? 'Efek suara diaktifkan 🔊' : 'Efek suara dinonaktifkan 🔇', null, 2500);
  });
}

// ==========================================================================
// CONFETTI CELEBRATION
// ==========================================================================
function triggerConfetti() {
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext('2d');
  if (!ctx) return;

  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#10b981', '#34d399', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7'];
  const count = 75;

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: window.innerWidth * 0.5 + (Math.random() * 240 - 120),
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 8 + 6),
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      gravity: 0.32
    });
  }

  let animationId = null;
  function updateConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rSpeed;
      p.opacity -= 0.012;

      if (p.opacity > 0 && p.y < window.innerHeight + 50) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    if (alive) {
      animationId = requestAnimationFrame(updateConfetti);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      cancelAnimationFrame(animationId);
    }
  }

  updateConfetti();
}

// ==========================================================================
// TOAST NOTIFICATION & UNDO SYSTEM
// ==========================================================================
function showToast(message, undoAction = null, duration = 4500) {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (undoAction && typeof undoAction === 'function') {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'toast-btn-undo';
    undoBtn.textContent = 'Urungkan';
    undoBtn.addEventListener('click', () => {
      undoAction();
      dismissToast(toast);
    });
    toast.appendChild(undoBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-btn-close';
  closeBtn.setAttribute('aria-label', 'Tutup pemberitahuan');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
  svg.appendChild(path);
  closeBtn.appendChild(svg);

  closeBtn.addEventListener('click', () => dismissToast(toast));
  toast.appendChild(closeBtn);

  toastContainer.appendChild(toast);

  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast._timeoutId = timeoutId;
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;
  if (toast._timeoutId) clearTimeout(toast._timeoutId);
  toast.classList.add('hiding');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 250);
}

// ==========================================================================
// DATE & TIME INITIALIZATION
// ==========================================================================
function updateDateDisplay() {
  if (!currentDateEl) return;
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const today = new Date();

  let dateString = today.toLocaleDateString('id-ID', options);
  dateString = dateString.replace(/(^\w|\s\w)/g, m => m.toUpperCase());

  currentDateEl.textContent = dateString;
}

// ==========================================================================
// STORAGE UTILITIES
// ==========================================================================
function saveToLocalStorage() {
  try {
    localStorage.setItem('taskflow_todos', JSON.stringify(state.todos));
  } catch (err) {
    console.error('Storage full:', err);
    showToast('Penyimpanan lokal penuh. Harap hapus beberapa tugas.', null, 4000);
  }
}

// ==========================================================================
// CORE FUNCTIONS (CRUD)
// ==========================================================================

// [CREATE] Add Task
function addTodo(rawText, priority, rawDate, category) {
  const cleanText = sanitizeText(rawText);
  if (!cleanText) return;

  if (state.todos.length >= LIMITS.MAX_TASKS) {
    showToast('Batas maksimum 500 tugas tercapai.', null, 3000);
    return;
  }

  const cleanPriority = LIMITS.VALID_PRIORITIES.has(priority) ? priority : 'sedang';
  const cleanCategory = LIMITS.VALID_CATEGORIES.has(category) ? category : 'umum';
  const cleanDate = LIMITS.DATE_PATTERN.test(rawDate) ? rawDate.trim() : '';

  const newTodo = {
    id: 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    text: cleanText,
    completed: false,
    priority: cleanPriority,
    date: cleanDate,
    category: cleanCategory,
    createdAt: Date.now()
  };

  state.todos.unshift(newTodo);
  saveToLocalStorage();
  render();
}

// [UPDATE] Toggle Task Status (Completed / Active)
function toggleTodo(id) {
  const wasAllCompletedBefore = state.todos.length > 0 && state.todos.every(t => t.completed);

  state.todos = state.todos.map(todo => {
    if (todo.id === id) {
      const willBeCompleted = !todo.completed;
      if (willBeCompleted) playSuccessSound();
      return { ...todo, completed: willBeCompleted };
    }
    return todo;
  });

  saveToLocalStorage();
  render();

  const isAllCompletedNow = state.todos.length > 0 && state.todos.every(t => t.completed);
  if (!wasAllCompletedBefore && isAllCompletedNow) {
    triggerConfetti();
  }
}

// [DELETE] Remove Task with Undo Support
function deleteTodo(id, todoElement) {
  const index = state.todos.findIndex(t => t.id === id);
  if (index === -1) return;

  const removedTodo = state.todos[index];

  const executeDeletion = () => {
    state.todos.splice(index, 1);
    saveToLocalStorage();
    render();

    showToast(`Tugas "${removedTodo.text}" dihapus`, () => {
      state.todos.splice(index, 0, removedTodo);
      saveToLocalStorage();
      render();
      showToast('Tugas berhasil dipulihkan!');
    });
  };

  if (todoElement) {
    todoElement.classList.add('deleting');
    setTimeout(executeDeletion, 200);
  } else {
    executeDeletion();
  }
}

// Clear All Completed Tasks with Undo Support
function clearCompleted() {
  const completedTodos = state.todos.filter(t => t.completed);
  if (completedTodos.length === 0) return;

  const previousTodos = [...state.todos];
  state.todos = state.todos.filter(t => !t.completed);
  saveToLocalStorage();
  render();

  showToast(`${completedTodos.length} tugas selesai dihapus`, () => {
    state.todos = previousTodos;
    saveToLocalStorage();
    render();
    showToast('Tugas selesai berhasil dipulihkan!');
  });
}

// ==========================================================================
// EDIT MODAL LOGIC
// ==========================================================================
function openEditModal(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo || !editModal) return;

  state.editingTodoId = id;
  editText.value = todo.text;
  editPriority.value = todo.priority || 'sedang';
  editDate.value = todo.date || '';
  editCategory.value = todo.category || 'umum';

  editModal.classList.remove('hidden');
  editText.focus();
}

function closeEditModal() {
  if (!editModal) return;
  editModal.classList.add('hidden');
  state.editingTodoId = null;
}

if (editForm) {
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.editingTodoId) return;

    const newText = sanitizeText(editText.value);
    if (!newText) return;

    const cleanPriority = LIMITS.VALID_PRIORITIES.has(editPriority.value) ? editPriority.value : 'sedang';
    const cleanCategory = LIMITS.VALID_CATEGORIES.has(editCategory.value) ? editCategory.value : 'umum';
    const cleanDate = LIMITS.DATE_PATTERN.test(editDate.value) ? editDate.value.trim() : '';

    state.todos = state.todos.map(todo => {
      if (todo.id === state.editingTodoId) {
        return {
          ...todo,
          text: newText,
          priority: cleanPriority,
          date: cleanDate,
          category: cleanCategory
        };
      }
      return todo;
    });

    saveToLocalStorage();
    closeEditModal();
    render();
    showToast('Perubahan tugas berhasil disimpan!');
  });
}

if (modalClose) modalClose.addEventListener('click', closeEditModal);
if (modalCancel) modalCancel.addEventListener('click', closeEditModal);

if (editModal) {
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
      closeEditModal();
    }
  });
}

// ==========================================================================
// CATEGORY FILTER LOGIC
// ==========================================================================
categoryChips.forEach(chip => {
  chip.addEventListener('click', () => {
    categoryChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.currentCategory = chip.getAttribute('data-category') || 'all';
    render();
  });
});

// ==========================================================================
// RENDERING & UI CONTROL (SAFE NATIVE DOM CREATION)
// ==========================================================================
function render() {
  const totalCount = state.todos.length;
  const completedCount = state.todos.filter(t => t.completed).length;
  const activeCount = totalCount - completedCount;

  // 1. Update Progress Bar
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  progressBar.style.width = `${progressPercent}%`;
  progressText.textContent = `${progressPercent}%`;

  // 2. Update Tab Badge Counts
  if (countAll) countAll.textContent = String(totalCount);
  if (countActive) countActive.textContent = String(activeCount);
  if (countCompleted) countCompleted.textContent = String(completedCount);

  // 3. Filter tasks
  const rawQuery = searchInput ? searchInput.value : '';
  const query = sanitizeText(rawQuery, LIMITS.MAX_QUERY_LENGTH).toLowerCase();

  let filteredTodos = state.todos.filter(todo => {
    const matchesFilter = state.currentFilter === 'all' ||
                          (state.currentFilter === 'active' && !todo.completed) ||
                          (state.currentFilter === 'completed' && todo.completed);

    const matchesCategory = state.currentCategory === 'all' || todo.category === state.currentCategory;
    const matchesSearch = !query || todo.text.toLowerCase().includes(query);

    return matchesFilter && matchesCategory && matchesSearch;
  });

  // 4. Sort tasks: Priority, then createdAt
  const priorityWeight = {
    'tinggi': 3,
    'sedang': 2,
    'rendah': 1
  };

  filteredTodos.sort((a, b) => {
    const pA = priorityWeight[a.priority] || 0;
    const pB = priorityWeight[b.priority] || 0;
    if (pA !== pB) {
      return pB - pA;
    }
    return b.createdAt - a.createdAt;
  });

  // 5. Clear list
  todoList.replaceChildren();

  // 6. Handle Contextual Empty State
  if (filteredTodos.length === 0) {
    emptyState.classList.remove('hidden');
    todoList.classList.add('hidden');

    if (query) {
      if (emptyTitle) emptyTitle.textContent = 'Tidak Ditemukan!';
      if (emptyDesc) emptyDesc.textContent = `Tidak ada tugas yang cocok dengan kata kunci "${query}".`;
    } else if (state.currentCategory !== 'all') {
      const catNames = { 'umum': 'Umum', 'kerja': 'Kerja', 'pribadi': 'Pribadi', 'belanja': 'Belanja' };
      const catName = catNames[state.currentCategory] || state.currentCategory;
      if (emptyTitle) emptyTitle.textContent = 'Kategori Kosong';
      if (emptyDesc) emptyDesc.textContent = `Belum ada tugas dalam kategori "${catName}".`;
    } else if (state.currentFilter === 'active') {
      if (emptyTitle) emptyTitle.textContent = 'Semua Selesai! 🎉';
      if (emptyDesc) emptyDesc.textContent = 'Tidak ada tugas aktif yang tersisa. Kerja luar biasa!';
    } else if (state.currentFilter === 'completed') {
      if (emptyTitle) emptyTitle.textContent = 'Belum Ada yang Selesai';
      if (emptyDesc) emptyDesc.textContent = 'Ceklis tugas yang sudah Anda selesaikan untuk melihatnya di sini.';
    } else {
      if (emptyTitle) emptyTitle.textContent = 'Tidak ada tugas!';
      if (emptyDesc) emptyDesc.textContent = 'Belum ada tugas. Selamat menikmati waktu luang Anda!';
    }
  } else {
    emptyState.classList.add('hidden');
    todoList.classList.remove('hidden');

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    filteredTodos.forEach(todo => {
      const todoItem = document.createElement('li');
      todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      todoItem.setAttribute('data-id', todo.id);

      // Todo content wrapper
      const todoContent = document.createElement('div');
      todoContent.className = 'todo-content';

      // Checkbox container
      const labelCheckbox = document.createElement('label');
      labelCheckbox.className = 'checkbox-container';
      labelCheckbox.title = todo.completed ? 'Tandai belum selesai' : 'Tandai selesai';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', 'Tandai tugas selesai');
      checkbox.addEventListener('change', () => toggleTodo(todo.id));

      const checkmark = document.createElement('span');
      checkmark.className = 'checkmark';

      labelCheckbox.appendChild(checkbox);
      labelCheckbox.appendChild(checkmark);
      todoContent.appendChild(labelCheckbox);

      // Text and badges wrapper
      const textWrapper = document.createElement('div');
      textWrapper.className = 'todo-text-wrapper';

      const todoText = document.createElement('span');
      todoText.className = 'todo-text';
      todoText.textContent = todo.text; // Safe: textContent avoids XSS
      todoText.title = 'Klik tombol edit atau klik ganda untuk mengubah';
      todoText.addEventListener('dblclick', () => openEditModal(todo.id));
      textWrapper.appendChild(todoText);

      // Meta badges
      const badgesContainer = document.createElement('div');
      badgesContainer.className = 'todo-meta-badges';

      // Priority badge
      const priorityBadge = document.createElement('span');
      priorityBadge.className = `badge badge-priority-${todo.priority}`;
      priorityBadge.textContent = todo.priority === 'tinggi' ? '🔴 Tinggi' : todo.priority === 'sedang' ? '🟡 Sedang' : '🟢 Rendah';
      badgesContainer.appendChild(priorityBadge);

      // Category badge
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'badge badge-category';
      const catIcons = { 'umum': '📁', 'kerja': '💼', 'pribadi': '👤', 'belanja': '🛒' };
      const catIcon = catIcons[todo.category] || '📁';
      categoryBadge.textContent = `${catIcon} ${todo.category.charAt(0).toUpperCase() + todo.category.slice(1)}`;
      badgesContainer.appendChild(categoryBadge);

      // Date badge
      if (todo.date) {
        const isOverdue = new Date(todo.date) < todayDate && !todo.completed;
        const dateBadge = document.createElement('span');
        dateBadge.className = `badge badge-date ${isOverdue ? 'overdue' : ''}`;
        dateBadge.textContent = `📅 ${todo.date}`;
        badgesContainer.appendChild(dateBadge);
      }

      textWrapper.appendChild(badgesContainer);
      todoContent.appendChild(textWrapper);
      todoItem.appendChild(todoContent);

      // Action buttons wrapper
      const actionsWrapper = document.createElement('div');
      actionsWrapper.className = 'todo-actions';

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-action btn-edit';
      editBtn.title = 'Edit Tugas Lengkap';
      editBtn.setAttribute('aria-label', 'Edit Tugas');

      const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      editSvg.setAttribute('fill', 'none');
      editSvg.setAttribute('viewBox', '0 0 24 24');
      editSvg.setAttribute('stroke', 'currentColor');
      const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      editPath.setAttribute('stroke-linecap', 'round');
      editPath.setAttribute('stroke-linejoin', 'round');
      editPath.setAttribute('stroke-width', '2');
      editPath.setAttribute('d', 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z');
      editSvg.appendChild(editPath);
      editBtn.appendChild(editSvg);

      editBtn.addEventListener('click', () => openEditModal(todo.id));
      actionsWrapper.appendChild(editBtn);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-action btn-delete';
      deleteBtn.title = 'Hapus Tugas';
      deleteBtn.setAttribute('aria-label', 'Hapus Tugas');

      const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      deleteSvg.setAttribute('fill', 'none');
      deleteSvg.setAttribute('viewBox', '0 0 24 24');
      deleteSvg.setAttribute('stroke', 'currentColor');
      const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      deletePath.setAttribute('stroke-linecap', 'round');
      deletePath.setAttribute('stroke-linejoin', 'round');
      deletePath.setAttribute('stroke-width', '2');
      deletePath.setAttribute('d', 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16');
      deleteSvg.appendChild(deletePath);
      deleteBtn.appendChild(deleteSvg);

      deleteBtn.addEventListener('click', () => deleteTodo(todo.id, todoItem));
      actionsWrapper.appendChild(deleteBtn);

      todoItem.appendChild(actionsWrapper);
      todoList.appendChild(todoItem);
    });
  }

  // 7. Update Items Left count
  if (activeCount === 0 && totalCount > 0) {
    itemsCount.textContent = 'Semua tugas selesai! ✨';
  } else {
    itemsCount.textContent = `${activeCount} tugas tersisa`;
  }

  // 8. Show/Hide Clear Completed Button
  if (completedCount > 0) {
    clearCompletedBtn.classList.remove('hidden');
  } else {
    clearCompletedBtn.classList.add('hidden');
  }
}

// ==========================================================================
// FILTER SLIDER NAVIGATION LOGIC
// ==========================================================================
function updateSliderPosition(activeTab) {
  if (!activeTab || !sliderIndicator) return;
  sliderIndicator.style.width = `${activeTab.offsetWidth}px`;
  sliderIndicator.style.left = `${activeTab.offsetLeft}px`;
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================

// Form Submit (Add Todo)
todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value;
  const priority = todoPriority ? todoPriority.value : 'sedang';
  const date = todoDate ? todoDate.value : '';
  const category = todoCategory ? todoCategory.value : 'umum';

  if (text.trim()) {
    addTodo(text, priority, date, category);
    todoInput.value = '';
    if (todoDate) todoDate.value = '';
    if (todoPriority) todoPriority.value = 'sedang';
    if (todoCategory) todoCategory.value = 'umum';
    todoInput.focus();
  }
});

// Search Input Logic
if (searchInput) {
  searchInput.addEventListener('input', render);
}

// Clear Completed Click
clearCompletedBtn.addEventListener('click', clearCompleted);

// Filter Tab Click Handling
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    state.currentFilter = tab.getAttribute('data-filter') || 'all';
    updateSliderPosition(tab);
    render();
  });
});

// Handle resize to fix slider positions automatically
window.addEventListener('resize', () => {
  const activeTab = document.querySelector('.filter-tab.active');
  if (activeTab) {
    updateSliderPosition(activeTab);
  }
});

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateDateDisplay();
  updateSoundToggleUI();

  setTimeout(() => {
    const activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
      updateSliderPosition(activeTab);
    }
  }, 100);

  render();
});
