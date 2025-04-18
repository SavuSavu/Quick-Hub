/**
 * @file src/state.js
 * @purpose Defines the central application state and provides getter/setter functions
 *          for controlled access and modification. Acts as the single source of truth.
 * @usage Imported by most other modules to read or update application state.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring. Defined appState structure and basic getter/setter functions.
 */

// --- Private State Object ---

const appState = {
    // Core Data Structures
    files: {},          // fileName -> { model: MonacoModel, viewState: MonacoViewState|null, language: string, path: string }
    folders: {},        // folderPath -> { name: string, files: string[], subfolders: string[], path: string }
    filePaths: {},      // fileName -> folderPath (e.g., 'myFile.js': 'src/utils') - Provides quick lookup of a file's location

    // Editor & UI State
    editorInstance: null, // Monaco editor instance
    currentFile: null,  // Name (key) of the currently active file in the editor
    sidebarVisible: true,
    isLoading: false,
    clipboard: null,    // { type: 'copy'/'cut', fileName, content, language, sourcePath? }

    // User Preferences & Session Info
    lastUsedFolder: 'root', // Default folder for new files/folders
    lastSaveTime: null, // Timestamp of the last successful save to localStorage

    // Internal/Temporary State (Might be managed elsewhere if complex)
    // autoSaveInterval: null, // Managed within session.js
    // autoSaveTimeout: null,  // Managed within session.js
    // sessionSaved: false, // Less critical now, saveTime indicates status
};

// --- Getters ---

export function getFiles() {
    return appState.files;
}

export function getFile(fileName) {
    return appState.files[fileName];
}

export function getFolders() {
    return appState.folders;
}

export function getFolder(folderPath) {
    return appState.folders[folderPath];
}

export function getFilePaths() {
    return appState.filePaths;
}

export function getFilePath(fileName) {
    return appState.filePaths[fileName];
}

export function getEditorInstance() {
    return appState.editorInstance;
}

export function getCurrentFile() {
    return appState.currentFile;
}

export function isSidebarVisible() {
    return appState.sidebarVisible;
}

export function isLoading() {
    return appState.isLoading;
}

export function getClipboard() {
    return appState.clipboard;
}

export function getLastUsedFolder() {
    return appState.lastUsedFolder;
}

export function getLastSaveTime() {
    return appState.lastSaveTime;
}

// --- Setters / Updaters ---
// These functions ensure state is modified in a controlled way.

export function setEditorInstance(editor) {
    appState.editorInstance = editor;
}

export function setCurrentFile(fileName) {
    // fileName can be null if no file is open
    appState.currentFile = fileName;
}

export function setSidebarVisible(isVisible) {
    appState.sidebarVisible = !!isVisible; // Ensure boolean
}

export function setLoading(loadingState) {
    appState.isLoading = !!loadingState; // Ensure boolean
}

export function setClipboard(clipboardData) {
    // clipboardData should be null or an object like:
    // { type: 'copy'|'cut', fileName, content, language, sourcePath }
    appState.clipboard = clipboardData;
}

export function setLastUsedFolder(folderPath) {
    if (appState.folders[folderPath] || folderPath === 'root') {
        appState.lastUsedFolder = folderPath;
    } else {
        console.warn(`Attempted to set lastUsedFolder to non-existent path: ${folderPath}. Resetting to root.`);
        appState.lastUsedFolder = 'root';
    }
}

export function setLastSaveTime(dateTime) {
    appState.lastSaveTime = dateTime instanceof Date ? dateTime : null;
}

/**
 * Adds or updates a file entry in the state.
 * Manages both `files` and `filePaths`.
 * Assumes the model is already created elsewhere.
 * @param {string} fileName - The key/name of the file.
 * @param {object} fileData - { model, language, path, viewState? }
 */
export function addOrUpdateFile(fileName, fileData) {
    if (!fileName || !fileData || !fileData.model || !fileData.language || !fileData.path) {
        console.error("State Error: Invalid data passed to addOrUpdateFile for", fileName);
        return;
    }
    appState.files[fileName] = {
        model: fileData.model,
        language: fileData.language,
        path: fileData.path,
        viewState: fileData.viewState || null, // Ensure viewState exists or is null
    };
    appState.filePaths[fileName] = fileData.path;
    // Note: Does NOT add the fileName to the folder's file list. That's handled by filesystem.js or structure.js.
}

/**
 * Removes a file entry from the state.
 * Manages both `files` and `filePaths`.
 * Assumes the model disposal happens elsewhere.
 * @param {string} fileName - The key/name of the file.
 */
export function removeFile(fileName) {
    delete appState.files[fileName];
    // Only delete from filePaths if this was the *last* instance of that filename
    // This is complex if we allow duplicate names across folders.
    // For now, let's assume filesystem.js handles ensuring the correct path map entry is removed *before* calling this.
    // Revisit if duplicate filenames become a core feature requiring careful path map management here.
     if (appState.filePaths[fileName]) { // Cautious check
        delete appState.filePaths[fileName];
     }
    // Note: Does NOT remove the fileName from the folder's file list. That's handled by filesystem.js or structure.js.
}

/**
 * Updates specific properties of an existing file's state.
 * @param {string} fileName - The name of the file to update.
 * @param {object} updates - An object containing properties to update (e.g., { viewState: ..., path: ... }).
 */
export function updateFileState(fileName, updates) {
    if (appState.files[fileName] && updates) {
        Object.assign(appState.files[fileName], updates);
        // If path is updated, update the filePath map too
        if (updates.path !== undefined) {
            appState.filePaths[fileName] = updates.path;
        }
    } else {
        console.warn(`Attempted to update state for non-existent file: ${fileName}`);
    }
}


/**
 * Adds or updates a folder entry in the state.
 * @param {string} folderPath - The full path/key of the folder.
 * @param {object} folderData - { name, files?, subfolders?, path }
 */
export function addOrUpdateFolder(folderPath, folderData) {
     if (!folderPath || !folderData || !folderData.name || !folderData.path) {
        console.error("State Error: Invalid data passed to addOrUpdateFolder for", folderPath);
        return;
    }
    // Ensure files and subfolders arrays exist
    folderData.files = folderData.files || [];
    folderData.subfolders = folderData.subfolders || [];

    appState.folders[folderPath] = folderData;
}

/**
 * Removes a folder entry from the state.
 * Assumes descendant files/folders are handled elsewhere.
 * @param {string} folderPath - The path/key of the folder to remove.
 */
export function removeFolder(folderPath) {
    if (folderPath === 'root') {
        console.error("State Error: Cannot remove root folder.");
        return;
    }
    delete appState.folders[folderPath];
    // Note: Does NOT remove the folderPath from its parent's subfolder list. That's handled by filesystem.js or structure.js.
}


/**
 * Completely replaces the files state. Used during session restore or reset.
 * @param {object} newFilesState - The new files object.
 */
export function setFiles(newFilesState) {
    appState.files = newFilesState || {};
}

/**
 * Completely replaces the folders state. Used during session restore or reset.
 * @param {object} newFoldersState - The new folders object.
 */
export function setFolders(newFoldersState) {
    appState.folders = newFoldersState || {};
    // Ensure root always exists after setting
    if (!appState.folders['root']) {
         appState.folders['root'] = { name: 'root', files: [], subfolders: [], path: 'root' };
    }
}

/**
 * Completely replaces the filePaths state. Used during session restore or reset.
 * @param {object} newFilePathsState - The new filePaths object.
 */
export function setFilePaths(newFilePathsState) {
    appState.filePaths = newFilePathsState || {};
}

// --- Initialization ---
// Ensure root folder exists on initial load
if (!appState.folders['root']) {
    appState.folders['root'] = { name: 'root', files: [], subfolders: [], path: 'root' };
}