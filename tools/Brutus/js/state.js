// Initial application state
export const state = {
    isRunning: false,
    currentAttackId: null,
    targets: [],
    usernames: [],
    passwords: [],
    foundCredentials: [],
    stats: {
        attempts: 0,
        successes: 0,
        startTime: null,
        lastSpeedUpdate: null,
        attemptsSinceLastUpdate: 0
    }
};

// Function to reset state (partially, preserving some config maybe)
export function resetState() {
    state.isRunning = false;
    state.currentAttackId = null; // Stop ongoing simulations
    state.targets = [];
    state.usernames = [];
    state.passwords = [];
    state.foundCredentials = [];
    state.stats = {
        attempts: 0,
        successes: 0,
        startTime: null,
        lastSpeedUpdate: null,
        attemptsSinceLastUpdate: 0
    };
}