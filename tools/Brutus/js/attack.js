import { state, resetState } from './state.js';
import { elements } from './dom.js';
import { wordlists } from './config.js';
import { addLogEntry, addFoundCredential, clearLogs } from './logger.js';
import { updateStatsDisplay, generateStats } from './stats.js';
import { setAttackRunningUI, switchTab, resetUI, updateTargetCount } from './ui.js';

let simulationTimeouts = []; // To keep track of pending timeouts for stopping

// Validate inputs before starting attack
function validateInputs() {
    // Check targets
    if (elements.multiTargetSection.classList.contains('hidden')) {
        // Single target mode
        const target = elements.targetInput.value.trim();
        if (!target) {
            addLogEntry('Please enter a target URL', 'error');
            return false;
        }
        // Validate URL format (basic)
        try {
            new URL(target);
        } catch (_) {
            addLogEntry('Invalid target URL format', 'error');
            return false;
        }
        state.targets = [target];
        updateTargetCount(); // Ensure count is updated
    } else {
        // Multi-target mode
        if (state.targets.length === 0) {
            addLogEntry('Please upload a targets file or switch to single target mode', 'error');
            return false;
        }
        // Could add validation for each URL in state.targets if needed
    }

    // Check credentials
    if (elements.customCredsSection.classList.contains('hidden')) {
        // Default credentials mode
        const userlistKey = elements.userlistSelect.value;
        const passlistKey = elements.passlistSelect.value;
        state.usernames = wordlists.users[userlistKey] || [];
        state.passwords = wordlists.passwords[passlistKey] || [];
        addLogEntry(`Using default lists: ${state.usernames.length} usernames, ${state.passwords.length} passwords`, 'info');
    } else {
        // Custom credentials mode
        if (state.usernames.length === 0) {
            addLogEntry('Please upload a usernames file or switch to default credentials', 'error');
            return false;
        }
        if (state.passwords.length === 0) {
             addLogEntry('Please upload a passwords file or switch to default credentials', 'error');
            return false;
        }
         addLogEntry(`Using custom lists: ${state.usernames.length} usernames, ${state.passwords.length} passwords`, 'info');
    }

     if (state.usernames.length === 0 || state.passwords.length === 0) {
         addLogEntry('Cannot start attack: No usernames or passwords loaded.', 'error');
         return false;
     }

    return true;
}

// Prepare attack data (currently simple)
function prepareAttackData() {
    // For demo purposes, we'll just use the first target if multiple are loaded
    if (state.targets.length > 1) {
        addLogEntry(`Multiple targets loaded, simulation will use first target: ${state.targets[0]}`, 'warning');
        // In a real tool, you'd iterate through targets.
    } else if (state.targets.length === 1) {
         addLogEntry(`Target set to: ${state.targets[0]}`, 'info');
    }

    const totalAttempts = state.usernames.length * state.passwords.length;
    addLogEntry(`Protocol: ${elements.protocolSelect.value}`, 'info');
    addLogEntry(`Preparing to test ${totalAttempts.toLocaleString()} credential combinations`, 'info');
}

// Simulate attack (in a real app, this would make actual requests)
function simulateAttack(attackId) {
    if (!state.isRunning || attackId !== state.currentAttackId) return;

    const threads = parseInt(elements.threadsSlider.value) || 4;
    const delay = parseInt(elements.delaySlider.value) || 100;
    const stopOnSuccess = elements.stopOnSuccess.checked;
    const totalPossibleAttempts = state.usernames.length * state.passwords.length;


    // Calculate next attempt index based on current attempts
    const attemptIndex = state.stats.attempts;

    // Check if all combinations have been attempted
    if (attemptIndex >= totalPossibleAttempts) {
        if (state.isRunning) { // Check if already stopped
            addLogEntry(`Attack completed. Tested all ${totalPossibleAttempts.toLocaleString()} combinations.`, 'success');
            stopAttack();
        }
        return;
    }

    const usernameIndex = attemptIndex % state.usernames.length;
    const passwordIndex = Math.floor(attemptIndex / state.usernames.length);

    const username = state.usernames[usernameIndex];
    const password = state.passwords[passwordIndex];

    // --- Simulation Logic ---
    const isSuccess = Math.random() < 0.005; // Lower success rate for demo
    const responseTime = Math.floor(Math.random() * (isSuccess ? 300 : 800)) + 50; // Simulate response time
    const statusCode = isSuccess ? 200 : (Math.random() < 0.9 ? 401 : (Math.random() < 0.5 ? 403: 500)); // Simulate status code
    // --- End Simulation Logic ---

    // Log the attempt *before* incrementing stats.attempts
    addLogEntry(`[${attemptIndex + 1}/${totalPossibleAttempts}] Attempting ${username}:${password}...`, 'info');

    // Schedule the result log after simulated response time
    const resultTimeout = setTimeout(() => {
        if (!state.isRunning || attackId !== state.currentAttackId) return; // Check if stopped during wait

        // Log result
        const statusClass = isSuccess ? 'text-green-500' : (statusCode === 401 ? 'text-yellow-600' : 'text-red-500');
         addLogEntry(`Result for ${username}:${password} - Status: <span class="${statusClass} font-medium">${statusCode}</span> (${responseTime}ms)`, isSuccess ? 'success' : 'info');


        // Update stats
        state.stats.attempts++; // Increment *after* attempt is logged/processed
        state.stats.attemptsSinceLastUpdate++; // For speed calculation


        if (isSuccess) {
            state.stats.successes++;
            const found = { username, password, target: state.targets[0] }; // Include target
            state.foundCredentials.push(found);
            addFoundCredential(username, password);

            if (stopOnSuccess) {
                addLogEntry('SUCCESS! Stopping attack as configured (stop on first success).', 'success');
                stopAttack();
                return; // Stop further processing/scheduling
            }
        }

        // Schedule the *next* attempt simulation after the delay
        // This creates a loop, controlled by state.isRunning and attackId
        const nextTimeout = setTimeout(() => simulateAttack(attackId), delay);
        simulationTimeouts.push(nextTimeout);

    }, responseTime);
    simulationTimeouts.push(resultTimeout);

    // Update UI stats (progress, counts) - often updated by stats.js interval, but can force update here if needed
    updateStatsDisplay();
}


// Start the attack
export function startAttack() {
    if (state.isRunning) return;

    clearLogs(); // Clear previous results from display
    switchTab('log'); // Ensure log tab is active

    if (!validateInputs()) return; // Validate config first

    prepareAttackData();

    // Update state
    state.isRunning = true;
    state.currentAttackId = Date.now(); // Unique ID for this run
    state.stats = { // Reset stats for new run
        attempts: 0,
        successes: 0,
        startTime: new Date(),
        endTime: null, // Mark end time on stop
        lastSpeedUpdate: new Date(),
        attemptsSinceLastUpdate: 0
    };
    state.foundCredentials = []; // Clear found creds from previous runs

    // Update UI
    setAttackRunningUI(true);
    updateStatsDisplay(); // Start the stats update loop


    addLogEntry('Attack started...', 'success');

    // Start simulation loops (like threads)
    const threads = parseInt(elements.threadsSlider.value) || 4;
    for (let i = 0; i < threads; i++) {
         // Stagger start slightly? Or just let the delays handle it.
         // Use setTimeout to ensure it runs after current execution context
         const startTimeout = setTimeout(() => simulateAttack(state.currentAttackId), i * 10); // Small stagger
         simulationTimeouts.push(startTimeout);
    }
}

// Stop the attack
export function stopAttack() {
    if (!state.isRunning) return;

    addLogEntry('Stopping attack...', 'warning');

    state.isRunning = false;
    state.stats.endTime = new Date(); // Record end time for stats
    state.currentAttackId = null; // Invalidate current run

    // Clear all pending simulation timeouts
    simulationTimeouts.forEach(clearTimeout);
    simulationTimeouts = [];

    // Update UI
    setAttackRunningUI(false);
    updateStatsDisplay(); // Perform a final update of stats display
    generateStats(); // Update stats tab content

    // Calculate duration and log summary
    const duration = (state.stats.endTime - state.stats.startTime) / 1000;
    addLogEntry(`Attack stopped after ${duration.toFixed(1)} seconds.`, 'warning');
    addLogEntry(`Total attempts: ${state.stats.attempts.toLocaleString()}`, 'info');
    addLogEntry(`Successful logins found: ${state.stats.successes}`, state.stats.successes > 0 ? 'success' : 'info');

    if (state.stats.successes === 0 && state.stats.attempts === (state.usernames.length * state.passwords.length)) {
         addLogEntry('Attack completed. No valid credentials found.', 'warning');
    } else if (state.stats.successes === 0) {
        addLogEntry('Attack stopped. No valid credentials found in attempted range.', 'warning');
    }
}

// Reset the entire application
export function resetApp() {
    stopAttack(); // Ensure any running attack is stopped first
    resetState(); // Clear application state
    resetUI(); // Reset UI elements to defaults
    clearLogs(); // Clear log/found/stats tabs content
    addLogEntry('Application reset to default state.', 'info');
}