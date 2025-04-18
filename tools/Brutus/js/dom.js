// Cache DOM elements for easy access
export const elements = {
    // Configuration
    singleTargetBtn: document.getElementById('singleTargetBtn'),
    multiTargetBtn: document.getElementById('multiTargetBtn'),
    singleTargetSection: document.getElementById('singleTargetSection'),
    multiTargetSection: document.getElementById('multiTargetSection'),
    targetInput: document.getElementById('targetInput'),
    targetUploadArea: document.getElementById('targetUploadArea'),
    targetFileInput: document.getElementById('targetFileInput'),
    targetFileBtn: document.getElementById('targetFileBtn'), // Initial button

    // Credentials
    defaultCredsBtn: document.getElementById('defaultCredsBtn'),
    customCredsBtn: document.getElementById('customCredsBtn'),
    defaultCredsSection: document.getElementById('defaultCredsSection'),
    customCredsSection: document.getElementById('customCredsSection'),
    userlistSelect: document.getElementById('userlistSelect'),
    passlistSelect: document.getElementById('passlistSelect'),
    userUploadArea: document.getElementById('userUploadArea'),
    userFileInput: document.getElementById('userFileInput'),
    userFileBtn: document.getElementById('userFileBtn'), // Initial button
    passUploadArea: document.getElementById('passUploadArea'),
    passFileInput: document.getElementById('passFileInput'),
    passFileBtn: document.getElementById('passFileBtn'), // Initial button

    // Advanced
    toggleAdvanced: document.getElementById('toggleAdvanced'),
    advancedOptions: document.getElementById('advancedOptions'),
    threadsSlider: document.getElementById('threadsSlider'),
    threadsValue: document.getElementById('threadsValue'),
    delaySlider: document.getElementById('delaySlider'),
    delayValue: document.getElementById('delayValue'),
    stopOnSuccess: document.getElementById('stopOnSuccess'),

    // Actions
    startAttackBtn: document.getElementById('startAttackBtn'),
    stopAttackBtn: document.getElementById('stopAttackBtn'),
    resetBtn: document.getElementById('resetBtn'),

    // Results
    targetCount: document.getElementById('targetCount'),
    attemptCount: document.getElementById('attemptCount'),
    successCount: document.getElementById('successCount'),
    speedCount: document.getElementById('speedCount'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),

    // Tabs
    logTabBtn: document.getElementById('logTabBtn'),
    foundTabBtn: document.getElementById('foundTabBtn'),
    statsTabBtn: document.getElementById('statsTabBtn'),
    logTabContent: document.getElementById('logTabContent'),
    foundTabContent: document.getElementById('foundTabContent'),
    statsTabContent: document.getElementById('statsTabContent'),

    // Protocol
    protocolSelect: document.getElementById('protocolSelect'),
};