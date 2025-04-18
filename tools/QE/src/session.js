/**
 * @file src/session.js
 * @purpose Manages saving and loading the application state to/from localStorage,
 *          handles auto-save logic, and session recovery prompts.
 * @usage Imported by main.js and potentially other modules that need to trigger saves.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring from monolithic scripts.js. Moved session saving, loading, auto-save, and recovery logic here. Added debounced save trigger.
 */

// --- Module Imports ---
import * as state from './state.js';
import * as ui from './ui.js';
import * as filesystem from './filesystem.js'; // Needed for initFileStructure, createEditorModel, openFile
import { getLanguageForFile } from './utils.js'; // Specific helper needed

// --- Constants ---
const SESSION_KEY = 'qe-editor-session-v2'; // Use a new key for the refactored structure
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds
const DEBOUNCE_SAVE_DELAY_MS = 2000; // 2 seconds after typing stops

// --- Private State ---
let autoSaveIntervalId = null;
let autoSaveTimeoutId = null; // For debouncing content changes

// --- Public Functions ---

/**
 * Sets up the periodic auto-save timer.
 */
export function setupAutoSave() {
    if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId); // Clear existing interval if any
    }
    // Auto-save periodically as a fallback
    autoSaveIntervalId = setInterval(() => {
        // console.log("Periodic auto-save triggered.");
        saveSessionToStorage();
    }, AUTO_SAVE_INTERVAL_MS);
    console.log("Auto-save interval started.");
}

/**
 * Checks localStorage for a previously saved session and prompts the user to restore it.
 */
export function checkForPreviousSession() {
    try {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (!sessionData) {
            console.log("No previous session found.");
            ui.showWelcomeMessage(); // Show default welcome message
            return;
        }

        const savedSession = JSON.parse(sessionData);

        // Basic validation of the saved data structure
        if (!savedSession || !savedSession.timestamp || !savedSession.fileContents || !savedSession.folders) {
            console.warn("Invalid session data found in localStorage. Clearing.");
            clearSessionData();
            ui.showWelcomeMessage();
            return;
        }

        const savedDate = new Date(savedSession.timestamp);
        const fileCount = Object.keys(savedSession.fileContents).length;

        // If no files were saved, treat as a new session
        if (fileCount === 0 && Object.keys(savedSession.folders).length <= 1) { // <= 1 allows for just the root folder
             console.log("Previous session was empty. Starting fresh.");
             clearSessionData();
             ui.showWelcomeMessage();
             return;
        }

        // Populate and show the recovery modal (using ui module)
        const details = `Last saved: ${savedDate.toLocaleString()}\nFiles: ${fileCount}${savedSession.currentFile ? `\nLast open: ${savedSession.currentFile}` : ''}`;
        ui.showSessionRecoveryModal(details, () => { // onRecover
            console.log("User chose to recover session.");
            restoreSessionFromStorage(savedSession);
        }, () => { // onNewSession
            console.log("User chose a new session.");
            clearSessionData();
            filesystem.initFileStructure(); // Re-initialize state via filesystem module
            ui.renderFileTree(); // Update UI
            ui.showWelcomeMessage();
        });

    } catch (error) {
        console.error("Error checking for previous session:", error);
        clearSessionData(); // Clear potentially corrupted data
        ui.showWelcomeMessage();
    }
}

/**
 * Saves the current application state to localStorage.
 */
export function saveSessionToStorage() {
    const editor = state.getEditorInstance();
    const files = state.getFiles();
    const folders = state.getFolders(); // Get folder structure from state
    const currentFile = state.getCurrentFile();

    // Avoid saving if the editor isn't ready or if there are no files/folders (besides root)
    if (!editor || (Object.keys(files).length === 0 && Object.keys(folders).length <= 1)) {
        // console.log("Skipping save: No files/folders or editor not ready.");
        // Consider clearing old session if workspace becomes empty?
        // if (localStorage.getItem(SESSION_KEY)) {
        //    clearSessionData();
        //    console.log("Cleared previous session data as workspace is now empty.");
        // }
        return;
    }

    // console.log("Attempting to save session...");

    try {
        // Ensure current file's view state is saved before proceeding
        if (currentFile && files[currentFile]) {
            const currentViewState = editor.saveViewState();
            state.updateFileState(currentFile, { viewState: currentViewState });
        }

        const fileContents = {};
        Object.keys(files).forEach(fileName => {
            const fileData = files[fileName];
            if (fileData && fileData.model) {
                // Check if model is disposed before getting value (paranoid check)
                 if (!fileData.model.isDisposed()) {
                    fileContents[fileName] = {
                        content: fileData.model.getValue(),
                        language: fileData.language,
                        path: state.getFilePath(fileName) || 'root', // Get path from state map
                        // ViewState is complex and large, generally avoid storing it in localStorage
                        // viewState: fileData.viewState ? JSON.stringify(fileData.viewState) : null // Example if you MUST save it (use with caution)
                    };
                } else {
                     console.warn(`Skipping file ${fileName} during save: Model is disposed.`);
                }
            } else {
                console.warn(`Skipping file ${fileName} during save: Missing data or model.`);
            }
        });

        // Don't save if no valid files were found
        if (Object.keys(fileContents).length === 0 && Object.keys(folders).length <= 1) {
             // console.log("Skipping save: No valid file contents.");
             return;
        }

        const sessionData = {
            fileContents,
            folders: folders, // Save the entire folder structure map
            currentFile: currentFile,
            lastUsedFolder: state.getLastUsedFolder(),
            sidebarVisible: state.isSidebarVisible(),
            timestamp: new Date().toISOString(),
            // Add versioning? Might help with future format changes.
             _version: "2.0"
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
        state.setLastSaveTime(new Date());
        // console.log("Session saved at", state.getLastSaveTime()?.toLocaleTimeString());

        // Optional: Update save status indicator in UI (via ui module)
        // ui.showSaveIndicator();

    } catch (error) {
        console.error("Failed to save session:", error);
        // Avoid showing message too often, maybe only on manual save failure?
        // ui.showMessage("Error saving session to local storage", 'error');

        // Check for QuotaExceededError
        if (error.name === 'QuotaExceededError') {
             ui.showMessage("Storage limit exceeded. Cannot save session. Please clear some files or browser data.", 'error', 10000);
        }
    }
}

/**
 * Restores the application state from a parsed saved session object.
 * @param {object} savedSession - The parsed session data from localStorage.
 */
export function restoreSessionFromStorage(savedSession) {
    console.log("Restoring session...");
    const editor = state.getEditorInstance();
    if (!editor) {
        console.error("Cannot restore session: Editor not available.");
        ui.showMessage("Error: Cannot restore session, editor not initialized.", "error");
        return;
    }

    // Clear existing state before restoring
    filesystem.resetWorkspace(); // Use filesystem function to clear files/folders/models

    try {
        // 1. Restore Folder Structure
        if (savedSession.folders) {
            state.setFolders(savedSession.folders);
            // Ensure root exists if somehow missing from saved data
            if (!state.getFolders()['root']) {
                 state.getFolders()['root'] = { name: 'root', files: [], subfolders: [], path: 'root' };
            }
        } else {
            // Should not happen if validation passed, but handle defensively
            filesystem.initFileStructure();
        }

        // 2. Restore Last Used Folder preference
        state.setLastUsedFolder(savedSession.lastUsedFolder || 'root');

        // 3. Restore Files and Models
        const restoredFiles = {};
        const restoredFilePaths = {};
        if (savedSession.fileContents) {
            Object.keys(savedSession.fileContents).forEach(fileName => {
                const fileData = savedSession.fileContents[fileName];
                if (fileData && typeof fileData.content === 'string') { // Basic validation
                    const language = fileData.language || getLanguageForFile(fileName);
                    const path = fileData.path || 'root';

                    // Use filesystem.createEditorModel to handle model creation and state update consistently
                    try {
                        filesystem.createEditorModel(fileName, fileData.content, language, path);
                        // Keep track for reporting
                        restoredFiles[fileName] = true;
                        restoredFilePaths[fileName] = path;
                    } catch (modelError) {
                         console.error(`Error creating model for ${fileName}:`, modelError);
                    }
                } else {
                    console.warn(`Skipping invalid file data for ${fileName} during restore.`);
                }
            });
        }
         // Ensure consistency between restored folders.files and actual files created
         filesystem.syncFolderFileLists();

        // 4. Restore Sidebar State
        const sidebarVisible = savedSession.sidebarVisible !== undefined ? savedSession.sidebarVisible : true;
        ui.setSidebarVisible(sidebarVisible, false); // Update UI without animation initially
         state.setSidebarVisible(sidebarVisible);


        // 5. Render the file tree with restored structure
        ui.renderFileTree();

        // 6. Open the previously active file, if possible
        let fileToOpen = null;
        if (savedSession.currentFile && state.getFiles()[savedSession.currentFile]) {
            fileToOpen = savedSession.currentFile;
        } else if (Object.keys(restoredFiles).length > 0) {
            // Otherwise, open the first restored file (order isn't guaranteed, but better than nothing)
            fileToOpen = Object.keys(restoredFiles)[0];
        }

        if (fileToOpen) {
            filesystem.openFile(fileToOpen); // Use filesystem module function
            // View state restoration is currently handled within openFile if available
        } else {
            // If no files were restored or could be opened, show welcome message
            ui.showWelcomeMessage();
        }

        // Ensure editor layout is correct after potential sidebar changes and model loading
        setTimeout(() => editor.layout(), 50); // Small delay might help rendering

        ui.showMessage(`Restored session with ${Object.keys(restoredFiles).length} file(s)`, 'success');
        console.log("Session restored successfully.");

    } catch (error) {
        console.error("Failed to restore session:", error);
        ui.showMessage("Error restoring previous session. Starting fresh.", 'error');
        clearSessionData(); // Clear corrupted data
        filesystem.resetWorkspace(); // Reset state again
        ui.renderFileTree();
        ui.showWelcomeMessage();
    }
}

/**
 * Clears the saved session data from localStorage.
 */
export function clearSessionData() {
    try {
        localStorage.removeItem(SESSION_KEY);
        console.log("Session data cleared from localStorage.");
    } catch (error) {
        console.error("Error clearing session data:", error);
        ui.showMessage("Could not clear session data.", "error");
    }
}

/**
 * Triggers a debounced save. Called when editor content changes.
 */
export function triggerDebouncedSave() {
    clearTimeout(autoSaveTimeoutId);
    autoSaveTimeoutId = setTimeout(() => {
        // console.log("Debounced save triggered.");
        saveSessionToStorage();
    }, DEBOUNCE_SAVE_DELAY_MS);
}

/**
 * Cleans up timers when the application closes (or potentially on full reset).
 */
export function cleanupTimers() {
     if (autoSaveIntervalId) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
    }
     if (autoSaveTimeoutId) {
        clearTimeout(autoSaveTimeoutId);
        autoSaveTimeoutId = null;
    }
    console.log("Session timers cleaned up.");
}

// Add cleanup listener for page unload? beforeunload already calls save, maybe not needed.
// window.addEventListener('unload', cleanupTimers); // 'unload' is less reliable than 'beforeunload'