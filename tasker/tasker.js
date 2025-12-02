// Tasker - Todoist Clone with Import Functionality

class Tasker {
    constructor() {
        this.tags = new Map();
        this.allTasks = [];
        this.allNotes = 0;
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        const fileInput = document.getElementById('zipFile');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Filter buttons
        document.getElementById('filterAll').addEventListener('click', () => this.setFilter('all'));
        document.getElementById('filterToday').addEventListener('click', () => this.setFilter('today'));
        document.getElementById('filterOverdue').addEventListener('click', () => this.setFilter('overdue'));

        // Modal functionality
        const modal = document.getElementById('taskModal');
        const closeBtn = document.querySelector('.close');
        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    setFilter(filter) {
        this.currentFilter = filter;

        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`).classList.add('active');

        // Re-render with filter
        this.renderTags();
    }

    isTaskForToday(task) {
        if (!task.date && !task.deadline) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkDate = (dateStr) => {
            if (!dateStr) return false;

            // Handle various date formats
            const datePatterns = [
                /every day/i,
                /daily/i,
                /today/i
            ];

            // Check for recurring daily patterns
            if (datePatterns.some(pattern => pattern.test(dateStr))) {
                return true;
            }

            // Check for specific day names
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = days[today.getDay()];
            if (new RegExp(todayName, 'i').test(dateStr)) {
                return true;
            }

            // Try parsing as a date
            try {
                const taskDate = new Date(dateStr);
                if (!isNaN(taskDate.getTime())) {
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === today.getTime();
                }
            } catch (e) {
                // Ignore parsing errors
            }

            return false;
        };

        return checkDate(task.date) || checkDate(task.deadline);
    }

    isTaskOverdue(task) {
        if (!task.deadline) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const deadlineDate = new Date(task.deadline);
            if (!isNaN(deadlineDate.getTime())) {
                deadlineDate.setHours(0, 0, 0, 0);
                return deadlineDate.getTime() < today.getTime();
            }
        } catch (e) {
            return false;
        }

        return false;
    }

    filterTasks(tasks) {
        if (this.currentFilter === 'all') {
            return tasks;
        } else if (this.currentFilter === 'today') {
            return tasks.filter(task => this.isTaskForToday(task));
        } else if (this.currentFilter === 'overdue') {
            return tasks.filter(task => this.isTaskOverdue(task));
        }
        return tasks;
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('importStatus');
        statusEl.textContent = 'Processing...';
        statusEl.className = 'status-message processing';

        try {
            await this.processZipFile(file);
            statusEl.textContent = `✓ Successfully imported ${this.tags.size} tags with ${this.allTasks.length} tasks`;
            statusEl.className = 'status-message success';
        } catch (error) {
            statusEl.textContent = `✗ Error: ${error.message}`;
            statusEl.className = 'status-message error';
            console.error('Import error:', error);
        }
    }

    async processZipFile(file) {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        this.tags.clear();
        this.allTasks = [];
        this.allNotes = 0;

        // Process each CSV file
        for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (filename.endsWith('.csv') && !zipEntry.dir) {
                const csvContent = await zipEntry.async('text');
                const tagName = this.extractTagName(filename);
                const tasks = this.parseCSV(csvContent, tagName);

                if (tasks.length > 0) {
                    this.tags.set(tagName, tasks);
                    this.allTasks.push(...tasks);
                }
            }
        }

        this.renderTags();
        this.updateStats();
        document.getElementById('filterBar').classList.remove('hidden');
    }

    extractTagName(filename) {
        // Extract tag name before the bracket
        // e.g., "Boat [6f297rJjc5QVj5RF].csv" -> "Boat"
        const match = filename.match(/^(.+?)\s*\[.+?\]\.csv$/);
        return match ? match[1].trim() : filename.replace('.csv', '');
    }

    parseCSV(csvContent, tagName) {
        const lines = csvContent.split('\n');
        const tasks = [];
        let currentTask = null;

        // Skip header and meta rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = this.parseCSVLine(line);
            if (!row || row.length < 2) continue;

            const type = row[0];

            if (type === 'meta') {
                // Disregard meta rows
                continue;
            } else if (type === 'task') {
                currentTask = {
                    type: 'task',
                    content: row[1],
                    description: row[2] || '',
                    isCollapsed: row[3],
                    priority: parseInt(row[4]) || 4,
                    indent: parseInt(row[5]) || 1,
                    author: row[6],
                    responsible: row[7],
                    date: row[8],
                    dateLang: row[9],
                    timezone: row[10],
                    duration: row[11],
                    durationUnit: row[12],
                    deadline: row[13],
                    deadlineLang: row[14],
                    tag: tagName,
                    notes: []
                };
                tasks.push(currentTask);
            } else if (type === 'note' && currentTask) {
                // Attach note to the last task
                currentTask.notes.push({
                    content: row[1],
                    author: row[6],
                    date: row[8]
                });
                this.allNotes++;
            }
        }

        return tasks;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && nextChar === '"' && inQuotes) {
                current += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result;
    }

    renderTags() {
        const container = document.getElementById('tagsContainer');
        container.innerHTML = '';

        // Sort tags alphabetically
        const sortedTags = Array.from(this.tags.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
        );

        sortedTags.forEach(([tagName, tasks]) => {
            const filteredTasks = this.filterTasks(tasks);
            if (filteredTasks.length > 0) {
                const tagSection = this.createTagSection(tagName, filteredTasks);
                container.appendChild(tagSection);
            }
        });

        // Show message if no tasks match filter
        if (container.children.length === 0) {
            container.innerHTML = '<div class="no-tasks-message">No tasks match the current filter</div>';
        }
    }

    createTagSection(tagName, tasks) {
        const section = document.createElement('div');
        section.className = 'tag-section';
        section.dataset.tag = tagName;

        const header = document.createElement('div');
        header.className = 'tag-header';
        header.innerHTML = `
            <h2 class="tag-title">${tagName}</h2>
            <span class="task-count">${tasks.length} tasks</span>
        `;
        section.appendChild(header);

        const taskList = document.createElement('div');
        taskList.className = 'task-list';

        tasks.forEach(task => {
            const taskEl = this.createTaskElement(task);
            taskList.appendChild(taskEl);
        });

        section.appendChild(taskList);
        return section;
    }

    createTaskElement(task) {
        const taskEl = document.createElement('div');
        taskEl.className = `task-item priority-${task.priority} indent-${task.indent}`;
        taskEl.dataset.taskId = this.allTasks.indexOf(task);
        taskEl.style.marginLeft = `${(task.indent - 1) * 30}px`;

        const hasNotes = task.notes.length > 0;
        const notesIndicator = hasNotes ? `<span class="notes-indicator" title="${task.notes.length} notes">💬 ${task.notes.length}</span>` : '';

        const deadlineDisplay = task.deadline ? `<span class="deadline">📅 ${task.deadline}</span>` : '';
        const descriptionPreview = task.description ? `<span class="description-preview">${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}</span>` : '';

        taskEl.innerHTML = `
            <div class="task-content">
                <div class="task-title-row">
                    <span class="task-title">${this.escapeHtml(task.content)}</span>
                    ${notesIndicator}
                </div>
                ${descriptionPreview}
                ${deadlineDisplay}
            </div>
            <div class="task-priority-indicator" title="Priority ${task.priority}">P${task.priority}</div>
        `;

        taskEl.addEventListener('click', () => this.showTaskDetails(task));

        return taskEl;
    }

    showTaskDetails(task) {
        const modal = document.getElementById('taskModal');
        const titleEl = document.getElementById('taskTitle');
        const metaEl = document.getElementById('taskMeta');
        const descriptionEl = document.getElementById('taskDescription');
        const notesEl = document.getElementById('taskNotes');

        titleEl.textContent = task.content;

        // Meta information
        let metaHTML = `
            <div class="meta-item"><strong>Tag:</strong> ${task.tag}</div>
            <div class="meta-item"><strong>Priority:</strong> <span class="priority-badge priority-${task.priority}">P${task.priority}</span></div>
            <div class="meta-item"><strong>Indent Level:</strong> ${task.indent}</div>
        `;
        if (task.deadline) {
            metaHTML += `<div class="meta-item"><strong>Deadline:</strong> ${task.deadline}</div>`;
        }
        if (task.date) {
            metaHTML += `<div class="meta-item"><strong>Scheduled:</strong> ${task.date}</div>`;
        }
        if (task.author) {
            metaHTML += `<div class="meta-item"><strong>Author:</strong> ${task.author}</div>`;
        }
        metaEl.innerHTML = metaHTML;

        // Description
        if (task.description) {
            descriptionEl.innerHTML = `<h3>Description</h3><p>${this.escapeHtml(task.description).replace(/\n/g, '<br>')}</p>`;
            descriptionEl.style.display = 'block';
        } else {
            descriptionEl.style.display = 'none';
        }

        // Notes
        if (task.notes.length > 0) {
            let notesHTML = `<h3>Notes (${task.notes.length})</h3>`;
            task.notes.forEach((note, index) => {
                const noteDate = note.date ? new Date(note.date).toLocaleString() : 'Unknown date';
                notesHTML += `
                    <div class="note-item">
                        <div class="note-header">
                            <span class="note-number">#${index + 1}</span>
                            <span class="note-date">${noteDate}</span>
                        </div>
                        <div class="note-content">${this.escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
                    </div>
                `;
            });
            notesEl.innerHTML = notesHTML;
            notesEl.style.display = 'block';
        } else {
            notesEl.style.display = 'none';
        }

        modal.style.display = 'block';
    }

    updateStats() {
        document.getElementById('tagCount').textContent = this.tags.size;
        document.getElementById('taskCount').textContent = this.allTasks.length;
        document.getElementById('noteCount').textContent = this.allNotes;
        document.getElementById('statsBar').classList.remove('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getTagColor(tagName) {
        // Generate a consistent color based on tag name
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 60%, 50%)`;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new Tasker();
});
