import { setupEventListeners } from './eventListeners.js';
import { updateStatsDisplay } from './stats.js';
import { addLogEntry } from './logger.js';
import { updateSliderValue } from './ui.js'; // Import for initial slider values

// Initialize the application
function init() {
    console.log("Initializing HydraBrute UI...");
    try {
        setupEventListeners();
        updateStatsDisplay(); // Initial display update
        updateSliderValue('threadsSlider'); // Set initial display value
        updateSliderValue('delaySlider'); // Set initial display value
        addLogEntry("Application initialized. Configure the attack and click Start.", "info");
    } catch (error) {
        console.error("Initialization failed:", error);
         // Optionally display an error to the user in the UI
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '10px';
            errorDiv.style.left = '10px';
            errorDiv.style.right = '10px';
            errorDiv.style.padding = '15px';
            errorDiv.style.backgroundColor = '#f8d7da'; // Reddish background
            errorDiv.style.color = '#721c24'; // Dark red text
            errorDiv.style.border = '1px solid #f5c6cb'; // Red border
            errorDiv.style.borderRadius = '4px';
            errorDiv.style.zIndex = '1000';
            errorDiv.textContent = `Error initializing application: ${error.message}. Please check the console.`;
            body.prepend(errorDiv);
        }
    }
}

// Run init when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);