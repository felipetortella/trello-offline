document.addEventListener("DOMContentLoaded", () => {
    const listContainer = document.getElementById("deleted-tasks-list");
    const searchInput = document.getElementById("search-input");
    
    let allDeletedTasks = [];

    async function loadTasks() {
        try {
            const res = await fetch("/api/deleted_tasks");
            allDeletedTasks = await res.json();
            renderTasks(allDeletedTasks);
        } catch (err) {
            console.error("Failed to load deleted tasks", err);
            listContainer.innerHTML = "<div style='color: var(--danger-color); padding: 1rem 0;'>Error loading data.</div>";
        }
    }

    function renderTasks(tasks) {
        listContainer.innerHTML = "";
        
        if (tasks.length === 0) {
            listContainer.innerHTML = "<div style='color: var(--text-secondary); padding: 1rem 0;'>No matching tasks found.</div>";
            return;
        }
        
        tasks.forEach(task => {
            const item = document.createElement("div");
            item.className = "deleted-task-item";
            
            const dateStr = task.deleted_at ? new Date(task.deleted_at).toLocaleString() : "Unknown Date";
            
            // Format content with HTML escaping and basic URL linkifying
            const escapedContent = task.content ? task.content.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag])
            ) : "";
            const formattedContent = escapedContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--link-color); text-decoration: underline;">$1</a>');
            
            item.innerHTML = `
                <div class="deleted-task-date" style="color: var(--text-cyan); border-bottom: 1px dashed rgba(255, 255, 255, 0.1); padding-bottom: 0.25rem;">${dateStr}</div>
                <div class="deleted-task-content" style="color: var(--text-color); margin-top: 0.5rem; word-break: break-word; white-space: pre-wrap;">${formattedContent}</div>
            `;
            
            listContainer.appendChild(item);
        });
    }

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        if (!query) {
            renderTasks(allDeletedTasks);
            return;
        }
        
        const filtered = allDeletedTasks.filter(task => 
            (task.content && task.content.toLowerCase().includes(query)) ||
            (task.deleted_at && task.deleted_at.toLowerCase().includes(query))
        );
        
        renderTasks(filtered);
    });

    loadTasks();
});
