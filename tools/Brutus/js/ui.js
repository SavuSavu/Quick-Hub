import { elements } from './dom.js';
import { state } from './state.js';
import { generateStats, updateStatsDisplay } from './stats.js';
import { resetUploadArea } from './fileHandler.js';
import { clearLogs } from './logger.js';

// Toggle between Single and Multiple target sections
export function toggleTargetMode(mode) { // 'single' or 'multi'
    const singleActive = mode === 'single';

    elements.singleTargetBtn.classList.toggle('bg-blue-500', singleActive);
    elements.singleTargetBtn.classList.toggle('text-white', singleActive);
    elements.singleTargetBtn.classList.toggle('bg-gray-200', !singleActive);
    elements.singleTargetBtn.classList.toggle('text-gray-700', !singleActive);

    elements.multiTargetBtn.classList.toggle('bg-blue-500', !singleActive);
    elements.multiTargetBtn.classList.toggle('text-white', !singleActive);
    elements.multiTargetBtn.classList.toggle('bg-gray-200', singleActive);
    elements.multiTargetBtn.classList.toggle('text-gray-700', singleActive);

    elements.singleTargetSection.classList.toggle('hidden', !singleActive);
    elements.multiTargetSection.classList.toggle('hidden', singleActive);

     // Clear the other mode's input/state when switching
    if (singleActive) {
        state.targets = []; // Clear multi-target state
        resetUploadArea('targets'); // Reset multi-target UI
    } else {
        elements.targetInput.value = ''; // Clear single target input
        state.targets = []; // Clear single target state (was set by input)
    }
    updateTargetCount(); // Update count display
}

// Toggle between Default and Custom credential sections
export function toggleCredentialMode(mode) { // 'default' or 'custom'
    const defaultActive = mode === 'default';

    elements.defaultCredsBtn.classList.toggle('bg-blue-500', defaultActive);
    elements.defaultCredsBtn.classList.toggle('text-white', defaultActive);
    elements.defaultCredsBtn.classList.toggle('bg-gray-200', !defaultActive);
    elements.defaultCredsBtn.classList.toggle('text-gray-700', !defaultActive);

    elements.customCredsBtn.classList.toggle('bg-blue-500', !defaultActive);
    elements.customCredsBtn.classList.toggle('text-white', !defaultActive);
    elements.customCredsBtn.classList.toggle('bg-gray-200', defaultActive);
    elements.customCredsBtn.classList.toggle('text-gray-700', defaultActive);

    elements.defaultCredsSection.classList.toggle('hidden', !defaultActive);
    elements.customCredsSection.classList.toggle('hidden', defaultActive);

    // Clear the other mode's state when switching
     if (defaultActive) {
        state.usernames = [];
        state.passwords = [];
        resetUploadArea('users');
        resetUploadArea('passwords');
    } else {
        // Reset selects to default? Optional.
        // elements.userlistSelect.value = 'top-users';
        // elements.passlistSelect.value = 'top-passwords';
        state.usernames = [];
        state.passwords = [];
    }
}

// Toggle Advanced Options visibility
export function toggleAdvancedOptions() {
    elements.advancedOptions.classList.toggle('hidden');
    const icon = elements.toggleAdvanced.querySelector('i');
    const isHidden = elements.advancedOptions.classList.contains('hidden');
    icon.classList.toggle('fa-chevron-down', isHidden);
    icon.classList.toggle('fa-chevron-up', !isHidden);
}

// Update slider value display
export function updateSliderValue(sliderId) {
    if (sliderId === 'threadsSlider') {
        elements.threadsValue.textContent = elements.threadsSlider.value;
    } else if (sliderId === 'delaySlider') {
        elements.delayValue.textContent = elements.delaySlider.value;
    }
}

// Switch between result tabs
export function switchTab(tab) { // 'log', 'found', 'stats'
    // Reset all tab buttons to inactive state
    [elements.logTabBtn, elements.foundTabBtn, elements.statsTabBtn].forEach(btn => {
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        btn.classList.add('text-gray-500', 'hover:text-gray-700');
    });

    // Hide all tab contents
    elements.logTabContent.classList.add('hidden');
    elements.foundTabContent.classList.add('hidden');
    elements.statsTabContent.classList.add('hidden');

    // Activate the selected tab button and show its content
    if (tab === 'log') {
        elements.logTabBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        elements.logTabBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        elements.logTabContent.classList.remove('hidden');
    } else if (tab === 'found') {
        elements.foundTabBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        elements.foundTabBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        elements.foundTabContent.classList.remove('hidden');
        // If no credentials found, ensure placeholder is shown (Logger handles adding entries)
        if (state.foundCredentials.length === 0 && !elements.foundTabContent.querySelector('.log-entry')) {
             elements.foundTabContent.innerHTML = `
                <div class="text-center text-gray-400 py-10">
                    <i class="fas fa-key text-4xl mb-2"></i>
                    <p>No credentials found yet</p>
                </div>
            `;
        }
    } else if (tab === 'stats') {
        elements.statsTabBtn.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        elements.statsTabBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        elements.statsTabContent.classList.remove('hidden');
        generateStats(); // Generate/update stats content when tab is viewed
    }
}

// Update attack button states (running/stopped)
export function setAttackRunningUI(isRunning) {
    elements.startAttackBtn.classList.toggle('hidden', isRunning);
    elements.stopAttackBtn.classList.toggle('hidden', !isRunning);
    // Disable config elements while running? (Optional, add later if needed)
    // const configElements = [ ... ];
    // configElements.forEach(el => el.disabled = isRunning);
}

// Update the target count display in the results header
export function updateTargetCount() {
    elements.targetCount.textContent = state.targets.length;
}


// Reset UI elements to their default state
export function resetUI() {
    // Reset config selections to default
    toggleTargetMode('single');
    toggleCredentialMode('default');
    elements.targetInput.value = '';
    elements.userlistSelect.value = 'top-users';
    elements.passlistSelect.value = 'top-passwords';
    elements.protocolSelect.value = 'http-post-form';

    // Reset sliders
    elements.threadsSlider.value = 4;
    elements.delaySlider.value = 100;
    updateSliderValue('threadsSlider');
    updateSliderValue('delaySlider');
    elements.stopOnSuccess.checked = true;
    if (!elements.advancedOptions.classList.contains('hidden')) {
        toggleAdvancedOptions(); // Hide advanced options
    }


    // Reset file upload areas
    resetUploadArea('targets');
    resetUploadArea('users');
    resetUploadArea('passwords');


    // Reset result stats display
    updateStatsDisplay(); // Should reset based on state cleared elsewhere
    elements.targetCount.textContent = '0'; // Explicitly reset target count display


    // Reset tabs and logs
    clearLogs();
    switchTab('log'); // Switch back to log tab

    // Reset attack buttons
    setAttackRunningUI(false);
}