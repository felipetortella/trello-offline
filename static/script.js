document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("board");
    const addColumnBtn = document.getElementById("add-column-btn");
    const addColumnForm = document.getElementById("add-column-form");
    const newColumnTitle = document.getElementById("new-column-title");
    const saveColumnBtn = document.getElementById("save-column-btn");
    const cancelColumnBtn = document.getElementById("cancel-column-btn");

    let draggedTask = null;
    let draggedColumn = null;

    // Fetch and render board
    async function loadBoard() {
        const res = await fetch("/api/board");
        const data = await res.json();
        renderBoard(data.columns);
    }

    // Render all columns
    function renderBoard(columns) {
        boardEl.innerHTML = "";
        columns.forEach(col => {
            const colEl = createColumnElement(col);
            boardEl.appendChild(colEl);
        });
        setupDragAndDrop();
    }

    // Create column DOM element
    function createColumnElement(column) {
        const colDiv = document.createElement("div");
        colDiv.className = "column";
        colDiv.dataset.id = column.id;
        colDiv.draggable = true;
        colDiv.addEventListener("dragstart", handleColumnDragStart);
        colDiv.addEventListener("dragend", handleColumnDragEnd);

        colDiv.innerHTML = `
            <div class="column-header">
                <div class="column-title" style="color: var(--text-cyan)">${escapeHTML(column.title)}</div>
                <button class="delete-col-btn" onclick="deleteColumn('${column.id}', this)">
                    rm -rf
                </button>
            </div>
            <div class="task-list" data-column-id="${column.id}"></div>
            <div class="add-task-wrapper">
                <button class="add-btn" onclick="showAddTaskForm('${column.id}')">
                    <span style="color: var(--text-green)">+</span> touch file
                </button>
                <div class="compose-form hidden" id="form-${column.id}">
                    <textarea class="compose-textarea" id="input-${column.id}" rows="3" placeholder="enter text..."></textarea>
                    <div class="form-actions">
                        <button class="primary-btn" onclick="addTask('${column.id}')">save</button>
                        <button class="icon-btn" onclick="hideAddTaskForm('${column.id}')">esc</button>
                    </div>
                </div>
            </div>
        `;

        const taskList = colDiv.querySelector(".task-list");
        if (column.tasks) {
            column.tasks.forEach(task => {
                const taskEl = createTaskElement(task, column.id);
                taskList.appendChild(taskEl);
            });
        }

        return colDiv;
    }

    // Create task DOM element
    function createTaskElement(task, columnId) {
        const taskDiv = document.createElement("div");
        taskDiv.className = "task";
        taskDiv.draggable = true;
        taskDiv.dataset.id = task.id;
        taskDiv.dataset.columnId = columnId;

        // Using standard non-editing view or an edit view
        taskDiv.innerHTML = `
            <div class="task-content" id="content-${task.id}">${formatContent(task.content)}</div>
            <div class="task-actions">
                <button class="task-action-btn edit" onclick="editTask('${columnId}', '${task.id}')">
                    nano
                </button>
                <button class="task-action-btn delete" onclick="deleteTask('${columnId}', '${task.id}', this)">
                    rm
                </button>
            </div>
            <!-- Edit Mode UI (Hidden initially) -->
            <div class="compose-form hidden" id="edit-form-${task.id}" style="margin-top: 5px;">
                <textarea class="compose-textarea" id="edit-input-${task.id}" rows="3">${escapeHTML(task.content)}</textarea>
                <div class="form-actions">
                    <button class="primary-btn" onclick="saveEditTask('${columnId}', '${task.id}')">save</button>
                    <button class="icon-btn" onclick="cancelEditTask('${task.id}')">esc</button>
                </div>
            </div>
        `;
        
        taskDiv.addEventListener("dragstart", handleDragStart);
        taskDiv.addEventListener("dragend", handleDragEnd);

        return taskDiv;
    }

    // --- Actions ---

    window.showAddTaskForm = (colId) => {
        const btn = document.querySelector(`.column[data-id="${colId}"] .add-btn`);
        const form = document.getElementById(`form-${colId}`);
        btn.classList.add("hidden");
        form.classList.remove("hidden");
        document.getElementById(`input-${colId}`).focus();
    };

    window.hideAddTaskForm = (colId) => {
        const btn = document.querySelector(`.column[data-id="${colId}"] .add-btn`);
        const form = document.getElementById(`form-${colId}`);
        const input = document.getElementById(`input-${colId}`);
        btn.classList.remove("hidden");
        form.classList.add("hidden");
        input.value = "";
    };

    window.addTask = async (colId) => {
        const input = document.getElementById(`input-${colId}`);
        const content = input.value.trim();
        if (!content) {
            input.focus();
            return;
        }

        const res = await fetch(`/api/columns/${colId}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });

        if (res.ok) {
            hideAddTaskForm(colId);
            loadBoard();
        }
    };

    window.deleteTask = async (colId, taskId, btn) => {
        if (!btn.dataset.confirm) {
            btn.dataset.confirm = "true";
            const originalText = btn.textContent;
            btn.textContent = "sure?";
            btn.style.color = "var(--danger-color)";
            setTimeout(() => {
                btn.dataset.confirm = "";
                btn.textContent = originalText;
                btn.style.color = "";
            }, 3000);
            return;
        }

        const res = await fetch(`/api/columns/${colId}/tasks/${taskId}`, { method: "DELETE" });
        if (res.ok) loadBoard();
    };

    window.editTask = (colId, taskId) => {
        document.getElementById(`content-${taskId}`).classList.add("hidden");
        document.querySelector(`.task[data-id="${taskId}"] .task-actions`).classList.add("hidden");
        document.getElementById(`edit-form-${taskId}`).classList.remove("hidden");
        document.getElementById(`edit-input-${taskId}`).focus();
    };

    window.cancelEditTask = (taskId) => {
        document.getElementById(`content-${taskId}`).classList.remove("hidden");
        document.querySelector(`.task[data-id="${taskId}"] .task-actions`).classList.remove("hidden");
        document.getElementById(`edit-form-${taskId}`).classList.add("hidden");
    };

    window.saveEditTask = async (colId, taskId) => {
        const input = document.getElementById(`edit-input-${taskId}`);
        const content = input.value.trim();
        if (!content) return;

        const res = await fetch(`/api/columns/${colId}/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });

        if (res.ok) loadBoard();
    };

    window.deleteColumn = async (colId, btn) => {
        if (!btn.dataset.confirm1) {
            btn.dataset.confirm1 = "true";
            btn.textContent = "sure?";
            btn.style.color = "var(--danger-color)";
            setTimeout(() => {
                btn.dataset.confirm1 = "";
                btn.dataset.confirm2 = "";
                btn.textContent = "rm -rf";
                btn.style.color = "";
            }, 3000);
            return;
        }

        if (!btn.dataset.confirm2) {
            btn.dataset.confirm2 = "true";
            btn.textContent = "ALL DATA LOST. SURE?";
            setTimeout(() => {
                // If it times out, reset completely
                if (btn) {
                    btn.dataset.confirm1 = "";
                    btn.dataset.confirm2 = "";
                    btn.textContent = "rm -rf";
                    btn.style.color = "";
                }
            }, 3000);
            return;
        }

        try {
            const res = await fetch(`/api/columns/${colId}`, { method: "DELETE" });
            if (res.ok) {
                loadBoard();
            } else {
                console.error("Failed to delete column, status:", res.status);
                alert("Error deleting directory.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- Add Column Logic ---

    addColumnBtn.addEventListener("click", () => {
        addColumnBtn.classList.add("hidden");
        addColumnForm.classList.remove("hidden");
        newColumnTitle.focus();
    });

    const closeAddColumn = () => {
        addColumnBtn.classList.remove("hidden");
        addColumnForm.classList.add("hidden");
        newColumnTitle.value = "";
    };

    cancelColumnBtn.addEventListener("click", closeAddColumn);

    saveColumnBtn.addEventListener("click", async () => {
        const title = newColumnTitle.value.trim();
        if (!title) {
            newColumnTitle.focus();
            return;
        }

        const res = await fetch("/api/columns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title })
        });

        if (res.ok) {
            closeAddColumn();
            loadBoard();
        }
    });

    // Handle Enter key for inputs
    newColumnTitle.addEventListener("keyup", (e) => {
        if (e.key === "Enter") saveColumnBtn.click();
        if (e.key === "Escape") closeAddColumn();
    });

    document.addEventListener("keyup", (e) => {
        if (e.key === "Escape") {
            // Close any open add/edit forms
            document.querySelectorAll(".icon-btn").forEach(btn => {
                if (!btn.closest('.hidden')) {
                    if (btn.querySelector('.ph-x')) btn.click();
                }
            });
        }
    });

    // --- Drag and Drop Logic ---

    function handleDragStart(e) {
        e.stopPropagation(); // Prevent column from being dragged when dragging a task
        draggedTask = this;
        setTimeout(() => this.classList.add("dragging"), 0);
        e.dataTransfer.effectAllowed = "move";
        // Setup data for drop
        e.dataTransfer.setData("text/plain", this.dataset.id);
    }

    function handleDragEnd() {
        this.classList.remove("dragging");
        draggedTask = null;
        document.querySelectorAll('.column.drag-over').forEach(col => col.classList.remove('drag-over'));
    }

    function handleColumnDragStart(e) {
        if (e.target.classList.contains("task")) return;
        draggedColumn = this;
        setTimeout(() => this.classList.add("dragging-col"), 0);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", this.dataset.id);
    }

    function handleColumnDragEnd(e) {
        this.classList.remove("dragging-col");
        draggedColumn = null;
    }

    function setupDragAndDrop() {
        const taskLists = document.querySelectorAll(".task-list");

        taskLists.forEach(list => {
            list.addEventListener("dragover", e => {
                if (!draggedTask) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                list.closest('.column').classList.add('drag-over');

                const afterElement = getDragAfterElement(list, e.clientY);
                if (afterElement == null) {
                    list.appendChild(draggedTask);
                } else {
                    list.insertBefore(draggedTask, afterElement);
                }
            });

            list.addEventListener("dragleave", e => {
                if (!draggedTask) return;
                // Remove visual cue if leaving the list entirely
                if (!list.contains(e.relatedTarget)) {
                    list.closest('.column').classList.remove('drag-over');
                }
            });

            list.addEventListener("drop", async e => {
                e.preventDefault();
                list.closest('.column').classList.remove('drag-over');
                
                if (!draggedTask) return;

                const taskId = draggedTask.dataset.id;
                const sourceColumnId = draggedTask.dataset.columnId;
                const targetColumnId = list.dataset.columnId;
                
                // Determine new index
                const tasksInList = [...list.querySelectorAll(".task")];
                const newIndex = tasksInList.indexOf(draggedTask);

                // Update UI state
                draggedTask.dataset.columnId = targetColumnId;

                // Make API Call to persist
                try {
                    await fetch("/api/tasks/move", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            task_id: taskId,
                            source_column_id: sourceColumnId,
                            target_column_id: targetColumnId,
                            new_index: newIndex
                        })
                    });
                } catch (err) {
                    console.error("Failed to move task", err);
                    loadBoard(); // rollback on failure
                }
            });
        });
    }

    // Helper for sorting elements during drag
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll(".task:not(.dragging)")];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Helper for sorting columns during drag
    function getDragAfterColumnElement(container, x) {
        const draggableElements = [...container.querySelectorAll(".column:not(.dragging-col)")];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Board drag and drop listeners (once per page load)
    boardEl.addEventListener("dragover", e => {
        if (!draggedColumn) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        
        const afterElement = getDragAfterColumnElement(boardEl, e.clientX);
        if (afterElement == null) {
            boardEl.appendChild(draggedColumn);
        } else {
            boardEl.insertBefore(draggedColumn, afterElement);
        }
    });

    boardEl.addEventListener("drop", async e => {
        if (!draggedColumn) return;
        e.preventDefault();
        
        const colId = draggedColumn.dataset.id;
        const colsInBoard = [...boardEl.querySelectorAll(".column")];
        const newIndex = colsInBoard.indexOf(draggedColumn);
        
        try {
            await fetch("/api/columns/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    column_id: colId,
                    new_index: newIndex
                })
            });
        } catch (err) {
            console.error("Failed to move column", err);
            loadBoard(); // rollback validation
        }
    });

    // Helper to escape HTML and prevent XSS
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    // Helper to escape HTML and convert URLs to clickable links
    function formatContent(str) {
        const escaped = escapeHTML(str);
        // Regex to match URLs starting with http:// or https://
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">$1</a>');
    }

    // Init
    loadBoard();
});
