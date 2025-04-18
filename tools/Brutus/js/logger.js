import { elements } from './dom.js';
import { state } from './state.js'; // Needed for addFoundCredential

// Add entry to attack log
export function addLogEntry(message, type = 'info') {
    if (!elements.logTabContent) {
        console.warn("Log tab content not found");
        return;
    }
    // Clear placeholder if present
    const placeholder = elements.logTabContent.querySelector('.text-center');
    if (placeholder) {
        elements.logTabContent.innerHTML = '';
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString();

    let typeClass = 'text-gray-500';
    let icon = 'fa-info-circle';

    if (type === 'success') {
        typeClass = 'text-green-500';
        icon = 'fa-check-circle';
    } else if (type === 'error') {
        typeClass = 'text-red-500';
        icon = 'fa-times-circle';
    } else if (type === 'warning') {
        typeClass = 'text-yellow-500';
        icon = 'fa-exclamation-circle';
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry text-sm flex items-start';
    entry.innerHTML = `
        <span class="text-gray-400 text-xs mr-2 mt-0.5">[${timeString}]</span>
        <i class="fas ${icon} ${typeClass} mr-2 mt-0.5"></i>
        <span>${message}</span>
    `;

    elements.logTabContent.prepend(entry); // Add to top
}

// Add found credential to results tab
export function addFoundCredential(username, password) {
     if (!elements.foundTabContent) {
        console.warn("Found tab content not found");
        return;
    }
    // Clear placeholder if present
    const placeholder = elements.foundTabContent.querySelector('.text-center');
     if (placeholder) {
        elements.foundTabContent.innerHTML = '';
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry p-3 bg-green-50 rounded mb-2 border border-green-200';
    entry.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <span class="font-medium text-green-800">${username}</span>
                <span class="mx-2 text-gray-400">:</span>
                <span class="font-medium text-green-800">${password}</span>
            </div>
            <span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                <i class="fas fa-check mr-1"></i> Valid
            </span>
        </div>
        <div class="mt-1 text-xs text-gray-500">
            Found at ${new Date().toLocaleTimeString()} for target ${state.targets[0] || 'N/A'} <!-- Assuming single target for demo -->
        </div>
    `;

    elements.foundTabContent.prepend(entry);
}

export function clearLogs() {
    elements.logTabContent.innerHTML = `
        <div class="text-center text-gray-400 py-10">
            <i class="fas fa-terminal text-4xl mb-2"></i>
            <p>Attack log will appear here</p>
        </div>`;
    elements.foundTabContent.innerHTML = `
        <div class="text-center text-gray-400 py-10">
            <i class="fas fa-key text-4xl mb-2"></i>
            <p>Found credentials will appear here</p>
        </div>`;
     elements.statsTabContent.innerHTML = `
        <div class="text-center text-gray-400 py-10">
            <i class="fas fa-chart-pie text-4xl mb-2"></i>
            <p>Statistics will appear here</p>
        </div>`;
}