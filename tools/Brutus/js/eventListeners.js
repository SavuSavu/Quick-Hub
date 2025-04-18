import { elements } from './dom.js';
import { handleFileUpload, setupDragAndDrop } from './fileHandler.js';
import { toggleTargetMode, toggleCredentialMode, toggleAdvancedOptions, updateSliderValue, switchTab } from './ui.js';
import { startAttack, stopAttack, resetApp } from './attack.js';

// Set up all event listeners for the application
export function setupEventListeners() {

    // Target selection buttons
    elements.singleTargetBtn.addEventListener('click', () => toggleTargetMode('single'));
    elements.multiTargetBtn.addEventListener('click', () => toggleTargetMode('multi'));

    // Credential selection buttons
    elements.defaultCredsBtn.addEventListener('click', () => toggleCredentialMode('default'));
    elements.customCredsBtn.addEventListener('click', () => toggleCredentialMode('custom'));

    // Advanced options toggle
    elements.toggleAdvanced.addEventListener('click', toggleAdvancedOptions);

    // Sliders - update value display on input
    elements.threadsSlider.addEventListener('input', () => updateSliderValue('threadsSlider'));
    elements.delaySlider.addEventListener('input', () => updateSliderValue('delaySlider'));

    // File upload buttons (trigger hidden inputs)
    // Note: Buttons inside upload areas might be recreated, listeners added in fileHandler.js/ui.js resetUploadArea
    elements.targetFileBtn?.addEventListener('click', () => elements.targetFileInput.click());
    elements.userFileBtn?.addEventListener('click', () => elements.userFileInput.click());
    elements.passFileBtn?.addEventListener('click', () => elements.passFileInput.click());

    // File input changes
    elements.targetFileInput.addEventListener('change', (e) => handleFileUpload(e, 'targets'));
    elements.userFileInput.addEventListener('change', (e) => handleFileUpload(e, 'users'));
    elements.passFileInput.addEventListener('change', (e) => handleFileUpload(e, 'passwords'));

    // Drag and drop setup
    setupDragAndDrop(elements.targetUploadArea, elements.targetFileInput, 'targets');
    setupDragAndDrop(elements.userUploadArea, elements.userFileInput, 'users');
    setupDragAndDrop(elements.passUploadArea, elements.passFileInput, 'passwords');

    // Action buttons
    elements.startAttackBtn.addEventListener('click', startAttack);
    elements.stopAttackBtn.addEventListener('click', stopAttack);
    elements.resetBtn.addEventListener('click', resetApp);

    // Tab buttons
    elements.logTabBtn.addEventListener('click', () => switchTab('log'));
    elements.foundTabBtn.addEventListener('click', () => switchTab('found'));
    elements.statsTabBtn.addEventListener('click', () => switchTab('stats'));
}