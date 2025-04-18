import { elements } from './dom.js';
import { state } from './state.js';

let statsUpdateTimeout = null;

// Update stats display (attempts, successes, speed, progress)
export function updateStatsDisplay() {
    if (!elements.attemptCount || !elements.successCount || !elements.speedCount || !elements.progressBar || !elements.progressText) {
        console.warn("Stats elements not found");
        return;
    }

    elements.attemptCount.textContent = state.stats.attempts;
    elements.successCount.textContent = state.stats.successes;

    // Calculate speed (attempts per second)
    const now = new Date();
    if (state.stats.startTime && state.isRunning) {
        const timeElapsed = (now - state.stats.startTime) / 1000; // seconds
        if (timeElapsed > 0) {
            const speed = Math.round(state.stats.attempts / timeElapsed);
            elements.speedCount.textContent = `${speed}/s`;
        } else {
            elements.speedCount.textContent = '0/s';
        }

        // Update progress
        const totalPossibleAttempts = state.usernames.length * state.passwords.length;
        if (totalPossibleAttempts > 0) {
            const progress = Math.min(100, (state.stats.attempts / totalPossibleAttempts) * 100);
            elements.progressBar.style.width = `${progress}%`;
            elements.progressText.textContent = `${Math.round(progress)}%`;
        } else {
             elements.progressBar.style.width = '0%';
             elements.progressText.textContent = `0%`;
        }
    } else {
        // Reset speed and progress if not running
        elements.speedCount.textContent = '0/s';
        elements.progressBar.style.width = '0%';
        elements.progressText.textContent = `0%`;
    }

    // Schedule next update if running
    if (state.isRunning) {
        // Clear previous timeout to avoid multiple loops
        if (statsUpdateTimeout) clearTimeout(statsUpdateTimeout);
        statsUpdateTimeout = setTimeout(updateStatsDisplay, 1000); // Update every second
    } else {
         if (statsUpdateTimeout) clearTimeout(statsUpdateTimeout);
         statsUpdateTimeout = null;
    }
}

// Generate statistics content for the Stats tab
export function generateStats() {
     if (!elements.statsTabContent) {
        console.warn("Stats tab content not found");
        return;
    }

    if (!state.stats.startTime) {
        elements.statsTabContent.innerHTML = `
            <div class="text-center text-gray-400 py-10">
                <i class="fas fa-chart-pie text-4xl mb-2"></i>
                <p>No statistics available yet. Start an attack first.</p>
            </div>
        `;
        return;
    }

    const duration = state.isRunning
        ? (new Date() - state.stats.startTime) / 1000 // Ongoing
        : (state.stats.endTime || new Date()) - state.stats.startTime / 1000; // Finished or stopped

    const speed = duration > 0 ? Math.round(state.stats.attempts / duration) : 0;
    const successRate = state.stats.attempts > 0 ? (state.stats.successes / state.stats.attempts * 100).toFixed(2) : 0;

    elements.statsTabContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-medium text-gray-700 mb-3">Attack Summary</h3>
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Status:</span>
                        <span class="${state.isRunning ? 'text-blue-500' : 'text-gray-500'}">${state.isRunning ? 'Running' : 'Stopped'}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Duration:</span>
                        <span>${duration.toFixed(1)} seconds</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Attempts:</span>
                        <span>${state.stats.attempts.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Successes:</span>
                        <span class="text-green-600 font-medium">${state.stats.successes}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Success rate:</span>
                        <span>${successRate}%</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Average speed:</span>
                        <span>${speed} attempts/sec</span>
                    </div>
                </div>
            </div>

            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-medium text-gray-700 mb-3">Configuration Used</h3>
                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Protocol:</span>
                        <span>${elements.protocolSelect?.value || 'N/A'}</span>
                    </div>
                     <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Threads:</span>
                        <span>${elements.threadsSlider?.value || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Delay:</span>
                        <span>${elements.delaySlider?.value || 'N/A'}ms</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Stop on success:</span>
                        <span>${elements.stopOnSuccess?.checked ? 'Yes' : 'No'}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Targets:</span>
                        <span>${state.targets.length}</span>
                    </div>
                     <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Usernames:</span>
                        <span>${state.usernames.length.toLocaleString()}</span>
                    </div>
                     <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Passwords:</span>
                        <span>${state.passwords.length.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="md:col-span-2 bg-white p-4 rounded shadow">
                <h3 class="font-medium text-gray-700 mb-3">Credential Stats (Sample)</h3>
                 <p class="text-xs text-gray-500 mb-3">Note: This shows counts based on the lists used, not necessarily actual attempts if stopped early.</p>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h4 class="text-sm font-medium text-gray-500 mb-2">Top Usernames Used</h4>
                        <div class="space-y-1 max-h-32 overflow-y-auto text-xs">
                            ${getTopItems(state.usernames, 10).map(item => `
                                <div class="flex justify-between">
                                    <span class="truncate" title="${item.value}">${item.value}</span>
                                    <!-- <span class="text-gray-500">${item.count} potential uses</span> -->
                                </div>
                            `).join('') || '<span class="text-gray-400">No usernames loaded.</span>'}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-sm font-medium text-gray-500 mb-2">Top Passwords Used</h4>
                          <div class="space-y-1 max-h-32 overflow-y-auto text-xs">
                             ${getTopItems(state.passwords, 10).map(item => `
                                <div class="flex justify-between">
                                     <span class="truncate" title="${item.value}">${item.value}</span>
                                    <!-- <span class="text-gray-500">${item.count} potential uses</span> -->
                                </div>
                            `).join('') || '<span class="text-gray-400">No passwords loaded.</span>'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper to get top items from an array (can be moved to utils.js if used elsewhere)
function getTopItems(array, count) {
    if (!array || array.length === 0) return [];
    // Simple slice for demo, frequency count is more complex with simulation state
    return array.slice(0, count).map(value => ({ value, count: 1 })); // Simplified for display

    /* // More accurate frequency count (if needed)
    const frequency = {};
    array.forEach(item => {
        frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, count);
    */
}