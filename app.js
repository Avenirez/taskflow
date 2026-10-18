/**
 * TaskFlow - Logic Application (Vanilla JavaScript)
 * Author: Antigravity AI
 * Description: State-based Todo List with animations and Local Storage.
 */

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let state = {
  todos: JSON.parse(localStorage.getItem('taskflow_todos')) || [],
  currentFilter: 'all' // Options: 'all', 'active', 'completed'
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const currentDateEl = document.getElementById('current-date');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const itemsCount = document.getElementById('items-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterTabs = document.querySelectorAll('.filter-tab');
const sliderIndicator = document.getElementById('slider-indicator');

// ==========================================================================
// DATE & TIME INITIALIZATION
// ==========================================================================
function updateDateDisplay() {
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const today = new Date();
  
  // Set date text in Indonesian locale
  let dateString = today.toLocaleDateString('id-ID', options);
  
  // Capitalize first letter of each word (standard Indonesian styling)
  dateString = dateString.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
  
  currentDateEl.textContent = dateString;
}

// ==========================================================================
// STORAGE UTILITIES
// ==========================================================================
function saveToLocalStorage() {
  localStorage.setItem('taskflow_todos', JSON.stringify(state.todos));
}

// ==========================================================================
// CORE FUNCTIONS (CRUD)
// ==========================================================================

// [CREATE] Add Task
function addTodo(text) {
  const cleanText = text.trim();
  if (!cleanText) return;

  const newTodo = {
    id: Date.now().toString(),
    text: cleanText,
    completed: false,
    createdAt: new Date().getTime()
  };

  state.todos.unshift(newTodo); // Add new tasks to the beginning
  saveToLocalStorage();
  render();
}

// [UPDATE] Toggle Task Status (Completed / Active)
function toggleTodo(id) {
  state.todos = state.todos.map(todo => {
    if (todo.id === id) {
      return { ...todo, completed: !todo.completed };
    }
    return todo;
  });
  saveToLocalStorage();
  render();
}

// [UPDATE] Edit Task Text
function updateTodoText(id, newText) {
  const cleanText = newText.trim();
  if (!cleanText) {
    // If the text is left empty, delete the task
    const todoEl = document.querySelector(`[data-id="${id}"]`);
    if (todoEl) deleteTodo(id, todoEl);
    return;
  }

  state.todos = state.todos.map(todo => {
    if (todo.id === id) {
      return { ...todo, text: cleanText };
    }
    return todo;
  });
  saveToLocalStorage();
  // Don't render full list here to avoid losing user cursor focus in case of real-time edits
}

// [DELETE] Remove Task with Animation
function deleteTodo(id, todoElement) {
  // Add animation class
  todoElement.classList.add('deleting');

  // Wait for the slideOut animation to finish (300ms defined in CSS)
  todoElement.addEventListener('animationend', () => {
    state.todos = state.todos.filter(todo => todo.id !== id);
    saveToLocalStorage();
    render();
  }, { once: true });
}

// Clear All Completed Tasks
function clearCompleted() {
  state.todos = state.todos.filter(todo => !todo.completed);
  saveToLocalStorage();
  render();
}

// ==========================================================================
// RENDERING & UI CONTROL
// ==========================================================================

function render() {
  // 1. Calculate & Update Progress Bar
  const totalCount = state.todos.length;
  const completedCount = state.todos.filter(t => t.completed).length;
  const activeCount = totalCount - completedCount;
  
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  progressBar.style.width = `${progressPercent}%`;
  progressText.textContent = `${progressPercent}%`;

  // 2. Filter tasks based on current filter state
  let filteredTodos = [...state.todos];
  if (state.currentFilter === 'active') {
    filteredTodos = state.todos.filter(t => !t.completed);
  } else if (state.currentFilter === 'completed') {
    filteredTodos = state.todos.filter(t => t.completed);
  }

  // 3. Clear existing list element
  todoList.innerHTML = '';

  // 4. Handle Empty State
  if (filteredTodos.length === 0) {
    emptyState.classList.remove('hidden');
    todoList.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    todoList.classList.remove('hidden');

    // 5. Render filtered todos dynamically
    filteredTodos.forEach(todo => {
      const todoItem = document.createElement('li');
      todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      todoItem.setAttribute('data-id', todo.id);

      // Inner structure creation
      todoItem.innerHTML = `
        <div class="todo-content">
          <label class="checkbox-container">
            <input type="checkbox" ${todo.completed ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
          <span class="todo-text" spellcheck="false">${escapeHTML(todo.text)}</span>
        </div>
        <div class="todo-actions">
          <button class="btn-action btn-edit" title="Edit Tugas" aria-label="Edit Tugas">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button class="btn-action btn-delete" title="Hapus Tugas" aria-label="Hapus Tugas">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;

      // Event Listeners for the dynamic components
      const checkbox = todoItem.querySelector('input[type="checkbox"]');
      const todoTextSpan = todoItem.querySelector('.todo-text');
      const editBtn = todoItem.querySelector('.btn-edit');
      const deleteBtn = todoItem.querySelector('.btn-delete');

      // Toggle checkbox event
      checkbox.addEventListener('change', () => toggleTodo(todo.id));

      // Delete task event
      deleteBtn.addEventListener('click', () => deleteTodo(todo.id, todoItem));

      // Edit task inline text handling
      let originalText = todo.text;
      
      const enableEditing = () => {
        if (todo.completed) return; // Prevent editing completed tasks
        todoTextSpan.setAttribute('contenteditable', 'true');
        todoTextSpan.focus();
        
        // Put caret (cursor) at the end of the text
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(todoTextSpan);
        range.collapse(false); // false means collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
      };

      const saveChanges = () => {
        todoTextSpan.setAttribute('contenteditable', 'false');
        const newText = todoTextSpan.textContent.trim();
        if (newText !== originalText) {
          originalText = newText;
          updateTodoText(todo.id, newText);
        }
      };

      // Trigger editing on Edit Button click
      editBtn.addEventListener('click', () => {
        if (todoTextSpan.getAttribute('contenteditable') === 'true') {
          saveChanges();
        } else {
          enableEditing();
        }
      });

      // Trigger editing on Double Click on text
      todoTextSpan.addEventListener('dblclick', enableEditing);

      // Save changes on blur (focus out)
      todoTextSpan.addEventListener('blur', saveChanges);

      // Enter key saves changes, Escape cancels
      todoTextSpan.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); // Prevent line breaks
          todoTextSpan.blur(); // Triggers blur which runs saveChanges
        } else if (e.key === 'Escape') {
          todoTextSpan.textContent = originalText; // Revert
          todoTextSpan.setAttribute('contenteditable', 'false');
          todoTextSpan.blur();
        }
      });

      todoList.appendChild(todoItem);
    });
  }

  // 6. Update Items Left count text
  if (activeCount === 0) {
    itemsCount.textContent = 'Semua tugas selesai! ✨';
  } else {
    itemsCount.textContent = `${activeCount} tugas tersisa`;
  }

  // 7. Show/Hide Clear Completed Button
  if (completedCount > 0) {
    clearCompletedBtn.classList.remove('hidden');
  } else {
    clearCompletedBtn.classList.add('hidden');
  }
}

// Helper: Escape HTML to prevent XSS
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// FILTER SLIDER NAVIGATION LOGIC
// ==========================================================================
function updateSliderPosition(activeTab) {
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
  if (text.trim()) {
    addTodo(text);
    todoInput.value = '';
    todoInput.focus();
  }
});

// Clear Completed Click
clearCompletedBtn.addEventListener('click', clearCompleted);

// Filter Tab Click Handling
filterTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    filterTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    
    state.currentFilter = tab.getAttribute('data-filter');
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
  
  // Set initial slider position after slight timeout to ensure DOM layout calculations are correct
  setTimeout(() => {
    const activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
      updateSliderPosition(activeTab);
    }
  }, 100);

  render();
});
