/**
 * @file src/main.js
 * @purpose Main application entry point. Initializes modules, editor, event listeners, and session management.
 * @usage Included via <script type="module"> in index.html.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring from monolithic scripts.js. Sets up module imports, Monaco initialization, core listeners, and startup sequence.
 */

// --- Module Imports ---
import * as state from './state.js';
import * as ui from './ui.js';
import * as filesystem from './filesystem.js';
import * as io from './io.js';
import * as session from './session.js';
// Note: utils.js is likely used *within* other modules, so may not need direct import here unless main.js uses a util directly.

// --- Constants ---
// Could be moved to a config.js if it grows
const MONACO_VS_PATH = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs';

// --- Monaco Editor Initialization ---
require.config({ paths: { 'vs': MONACO_VS_PATH } });

require(['vs/editor/editor.main'], () => {
    console.log("Monaco editor loaded.");
    try {
        // Create editor instance and store it in state
        state.setEditorInstance(monaco.editor.create(ui.domElements.monacoEditorContainer, {
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            tabSize: 2,
            wordWrap: 'on'
        }));

        // --- Editor Event Listeners ---
        if (state.getEditorInstance()) {
            // Update cursor position in status bar
            state.getEditorInstance().onDidChangeCursorPosition((e) => {
                if (e.position) {
                    ui.updateStatusBarCursor(e.position.lineNumber, e.position.column);
                }
            });

            // Detect content changes for debounced auto-save
            state.getEditorInstance().onDidChangeModelContent(() => {
                if (state.getCurrentFile()) {
                    session.triggerDebouncedSave(); // Let session manager handle debouncing
                }
            });

            // --- Keyboard Shortcuts ---
            // Ctrl+S / Cmd+S for downloading current file
            state.getEditorInstance().addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, (e) => {
                e?.preventDefault(); // Prevent browser save dialog if event is passed
                 console.log("Ctrl+S detected");
                if (state.getCurrentFile()) {
                     console.log("Calling downloadCurrentFile...");
                    io.downloadCurrentFile(); // Let io module handle download
                } else {
                     console.log("No current file to download.");
                }
            });

             // Manual Save Shortcut (Ctrl+Shift+S / Cmd+Shift+S) - Moved from global listener for better context
             state.getEditorInstance().addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, (e) => {
                e?.preventDefault();
                 console.log("Ctrl+Shift+S detected");
                 session.saveSessionToStorage(); // Directly save
                 ui.showMessage("Session saved manually", 'success', 1500);
             });

        } else {
            console.error("Failed to create Monaco Editor instance!");
            ui.showMessage("Fatal Error: Could not initialize code editor.", 'error', 10000);
            return; // Stop initialization if editor fails
        }

        // --- Application Initialization (depends on editor being ready) ---
        initializeApp();

    } catch (error) {
        console.error("Error during Monaco editor initialization:", error);
        ui.showMessage("Error initializing editor: " + error.message, 'error', 10000);
        // Optionally display a more user-friendly error message in the UI body
        document.body.innerHTML = `<div style="padding: 20px; text-align: center;">
            <h2>Application Error</h2>
            <p>Could not load the code editor. Please check your internet connection and try refreshing the page.</p>
            <p><i>Error: ${error.message}</i></p>
            </div>`;
    }
});

// --- Core Application Setup ---
function initializeApp() {
    console.log("Initializing Quick Edit Application...");

    // 1. Initialize File Structure State
    filesystem.initFileStructure();

    // 2. Setup Event Listeners from different modules
    // Pass necessary handlers between modules if needed
    setupCoreListeners(); // Global listeners like beforeunload
    ui.setupUIEventListeners(); // Listeners for UI elements (buttons, modals, etc.)
    io.setupIOEventListeners(); // Listeners for import/export triggers

    // 3. Check for and potentially restore previous session
    // This will also handle the initial UI render (welcome message or restored tree/file)
    session.checkForPreviousSession();

    // 4. Start Auto-Save Timer (if not already started by session recovery)
    session.setupAutoSave();

    console.log("Quick Edit Application Initialized.");
}

// --- Global Event Listeners ---
function setupCoreListeners() {
    // Save session when the user is leaving the page
    window.addEventListener('beforeunload', () => {
        session.saveSessionToStorage(); // Use the session module's function
        // Note: We can't guarantee this runs fully, but it's the best effort.
    });

    // Global Keydown Listener (e.g., for Esc key to close modals/menus)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            ui.closeAllModals();
            ui.hideContextMenu(); // Use UI module function
        }
        // Note: Ctrl+Shift+S moved to editor command for better context
    });

    // Global Click Listener (to close context menu, potentially modals)
    document.addEventListener('click', (e) => {
        ui.hideContextMenuOnClickOutside(e); // Let UI module handle logic
        ui.closeModalOnClickOutside(e); // Handle clicks on modal background
    });

     // Handle window resizing for editor layout
     // Debounce resize events for performance
     let resizeTimeout;
     window.addEventListener('resize', () => {
         clearTimeout(resizeTimeout);
         resizeTimeout = setTimeout(() => {
             const editor = state.getEditorInstance();
             if (editor) {
                 editor.layout(); // Trigger Monaco's layout recalculation
             }
         }, 150); // Adjust debounce delay as needed
     });

    console.log("Core listeners set up.");
}

// --- Initial Check ---
// Basic check if running in an iframe (useful for Quick-Hub integration context)
if (window.self !== window.top) {
    console.log("QE running inside an iframe.");
    // Potentially add specific iframe-related logic here if needed
}