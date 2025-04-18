/**
 * @file src/filesystem.js
 * @purpose Manages the in-memory file/folder structure, performs CRUD operations
 *          on files and folders, handles Monaco model management, and clipboard operations.
 * @usage Imported by main.js, ui.js, io.js, session.js, and event handlers.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring. Consolidated file/folder operations (CRUD),
 *               Monaco model creation/disposal, structure management, and clipboard logic.
 */

// --- Module Imports ---
import * as state from './state.js';
import * as ui from './ui.js';
import { getLanguageForFile } from './utils.js';

// --- Initialization ---

/**
 * Initializes the basic root folder structure in the state.
 */
export function initFileStructure() {
    // Reset state via state module functions
    state.setFolders({
        'root': { name: 'root', files: [], subfolders: [], path: 'root' }
    });
    state.setFiles({});
    state.setFilePaths({});
    state.setCurrentFile(null);
    state.setLastUsedFolder('root');
    state.setClipboard(null);
    // Does not reset editor instance or last save time, handled elsewhere
}

/**
 * Resets the entire workspace state (files, folders, models) to empty.
 * Used before restoring a session or starting fresh.
 */
export function resetWorkspace() {
    console.log("Resetting workspace...");
    // Dispose all existing Monaco models
    const files = state.getFiles();
    Object.values(files).forEach(fileData => {
        if (fileData.model && !fileData.model.isDisposed()) {
            fileData.model.dispose();
        }
    });

    // Clear editor content if any
    const editor = state.getEditorInstance();
    if (editor && editor.getModel()) {
        editor.setModel(null);
    }

    // Reset state structures
    initFileStructure();
}

// --- File Operations ---

/**
 * Creates a Monaco editor model for a file and adds it to the application state.
 * Also ensures the file is listed in its parent folder's state.
 * @param {string} fileName - The name/key of the file.
 * @param {string} content - The initial content of the file.
 * @param {string} language - The Monaco language ID.
 * @param {string} folderPath - The path of the parent folder ('root' for top level).
 * @returns {monaco.editor.ITextModel | null} The created model or null on error.
 */
export function createEditorModel(fileName, content, language, folderPath = 'root') {
    if (!fileName || typeof content !== 'string' || !language || !folderPath) {
        console.error("Filesystem: Invalid arguments for createEditorModel", { fileName, content, language, folderPath });
        return null;
    }
    if (!state.getFolder(folderPath)) {
        console.error(`Filesystem: Target folder "${folderPath}" does not exist for file "${fileName}".`);
        ui.showMessage(`Error: Target folder "${folderPath}" not found.`, 'error');
        return null; // Prevent adding file to non-existent folder
    }


    // Check for existing model ONLY if file already exists in state at the same path
    // This prevents accidental model recreation if importing/pasting duplicates allowed by logic
    let model;
    const existingFile = state.getFile(fileName);
    const existingPath = state.getFilePath(fileName);

    if (existingFile && existingPath === folderPath && existingFile.model && !existingFile.model.isDisposed()) {
        // Overwriting content of existing file/model
        console.warn(`Filesystem: Overwriting existing model content for "${fileName}" in "${folderPath}".`);
        model = existingFile.model;
        // Use pushEditOperations for better undo/redo stack management if needed
        model.setValue(content);
        // Update language if necessary (less common on overwrite, but possible)
        if (model.getLanguageId() !== language && window.monaco?.editor?.setModelLanguage) {
             monaco.editor.setModelLanguage(model, language);
        }
        // Update state (only language might change)
        state.updateFileState(fileName, { language: language });


    } else {
         // Creating a new file entry or a duplicate in a different folder
         if (existingFile) {
             console.warn(`Filesystem: Creating new model for duplicate file name "${fileName}" in different folder "${folderPath}". Original in "${existingPath}".`);
         }

        try {
            model = monaco.editor.createModel(content, language);
        } catch (error) {
            console.error(`Filesystem: Failed to create Monaco model for ${fileName}:`, error);
            ui.showMessage(`Error creating model for ${fileName}`, 'error');
            return null;
        }

        // Add to state via state module function
        state.addOrUpdateFile(fileName, {
            model: model,
            language: language,
            path: folderPath,
            viewState: null // New files don't have saved view state
        });

        // Ensure file is listed in the parent folder's state
        addFileToFolderList(fileName, folderPath);
    }

    return model;
}

/**
 * Opens a file in the editor, updating the model and UI state.
 * @param {string} fileName - The name/key of the file to open.
 */
export function openFile(fileName) {
    const fileData = state.getFile(fileName);
    const editor = state.getEditorInstance();

    if (!fileData || !fileData.model) {
         console.error(`Filesystem: File "${fileName}" or its model not found for opening.`);
         // Attempt to clean up inconsistent state
         if (fileData) { // file exists in state but model is missing
             deleteFileInternal(fileName); // Remove the bad entry
             ui.renderFileTree();
         }
         ui.showMessage(`Error: Could not open file "${fileName}". It might be corrupted or missing.`, 'error');
         return;
    }

    if (fileData.model.isDisposed()) {
        console.error(`Filesystem: Attempted to open disposed model for file "${fileName}".`);
        // Clean up potentially broken state
        deleteFileInternal(fileName); // Remove the bad entry
        ui.renderFileTree();
        ui.showMessage(`Error: File "${fileName}" model is invalid. Removed file entry.`, 'error');
        return;
    }

    // Save view state of the currently open file (if any)
    const currentFile = state.getCurrentFile();
    if (currentFile && currentFile !== fileName && state.getFile(currentFile)?.model) {
        try {
            const currentViewState = editor.saveViewState();
            state.updateFileState(currentFile, { viewState: currentViewState });
        } catch (error) {
            console.warn(`Filesystem: Could not save view state for ${currentFile}:`, error);
        }
    }

    // Set the new model in the editor
    editor.setModel(fileData.model);
    state.setCurrentFile(fileName); // Update state

    // Restore view state for the new file (if available)
    if (fileData.viewState) {
        try {
            editor.restoreViewState(fileData.viewState);
        } catch (error) {
             console.warn(`Filesystem: Could not restore view state for ${fileName}:`, error);
             // Clear potentially invalid view state
             state.updateFileState(fileName, { viewState: null });
        }
    } else {
        // If no view state, ensure editor is scrolled to top and cursor at start
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.revealLine(1);
    }

    // Expand parent folders to show the file in the explorer
    const filePath = fileData.path || 'root';
    ui.expandParentFolders(filePath);

    // Update UI elements via UI module
    ui.renderFileTree(); // Re-render to highlight the active file
    ui.updateStatusBarLanguage(fileData.language);
    const position = editor.getPosition() || { lineNumber: 1, column: 1 };
    ui.updateStatusBarCursor(position.lineNumber, position.column);
    ui.domElements.downloadBtn.disabled = false; // Enable download button

    // Update last used folder based on the opened file's location
    state.setLastUsedFolder(fileData.path || 'root');

    // Focus the editor for immediate typing
    editor.focus();
}


/**
 * Handles the logic to create a new, empty file entry in the state and open it.
 * Assumes details (name, folderPath) are obtained from UI/event handler.
 * @param {string} fileName - The desired name for the new file.
 * @param {string} folderPath - The path of the parent folder.
 */
export function createNewFile(fileName, folderPath) {
     // Validation (Basic checks, more robust checks might be needed)
     if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
         ui.showMessage("Invalid file name. Cannot contain slashes.", 'error');
         return;
     }
     if (!state.getFolder(folderPath)) {
          ui.showMessage(`Target folder "${folderPath}" does not exist.`, 'error');
          return;
     }

    // Check if file already exists *within the same target folder*
    if (state.getFile(fileName) && state.getFilePath(fileName) === folderPath) {
        const targetFolderName = folderPath === 'root' ? 'Root' : state.getFolder(folderPath)?.name;
        ui.showMessage(`File "${fileName}" already exists in folder "${targetFolderName}".`, 'error');
        return;
    }
     // Allow file with same name if in different folder (handled by createEditorModel/state)
      if (state.getFile(fileName)) {
         console.warn(`Filesystem: Creating file with name "${fileName}" which exists elsewhere. Target: "${folderPath}".`);
     }

    // Create empty model and add to state/structure
    const language = getLanguageForFile(fileName);
    const model = createEditorModel(fileName, '', language, folderPath); // Use central model creation

    if (model) {
        // Update UI
        ui.renderFileTree();

        // Open the newly created file
        openFile(fileName);

        // Update last used folder
        state.setLastUsedFolder(folderPath);

        ui.showMessage(`Created file: ${fileName}`, 'success');
    } else {
        // Error occurred during model creation
        ui.showMessage(`Failed to create file: ${fileName}`, 'error');
    }
}

/**
 * Renames a file, updating state, models, and UI.
 * @param {string} oldFileName - The current name/key of the file.
 * @param {string} newName - The desired new name.
 */
export function renameFile(oldFileName, newName) {
    const fileData = state.getFile(oldFileName);
    const currentPath = state.getFilePath(oldFileName);

    if (!fileData || !currentPath) {
         console.error(`Filesystem: Cannot rename - File "${oldFileName}" or its path not found.`);
         return;
    }
    if (!newName || newName === oldFileName || newName.includes('/') || newName.includes('\\')) {
         ui.showMessage("Invalid new file name.", 'error');
         return;
    }

    // Check for collision with the new name in the *same* folder
    // Need to check both files state and filePaths map for consistency
    if (state.getFile(newName) && state.getFilePath(newName) === currentPath) {
        ui.showMessage(`File "${newName}" already exists in this folder.`, 'error');
        return;
    }

    // --- Proceed with rename ---
    const editor = state.getEditorInstance();
    const oldModel = fileData.model;
    const currentContent = oldModel?.isDisposed() ? '' : oldModel.getValue(); // Get content before disposing old model
    const newLanguage = getLanguageForFile(newName);

    // 1. Create new model (necessary if language changes, good practice anyway)
    let newModel;
     try {
        newModel = monaco.editor.createModel(currentContent, newLanguage);
    } catch (error) {
        console.error(`Filesystem: Failed to create Monaco model for renamed file ${newName}:`, error);
        ui.showMessage(`Error creating model for renamed file ${newName}`, 'error');
        return; // Abort rename if model creation fails
    }


    // 2. Update state with new entry
    state.addOrUpdateFile(newName, {
        model: newModel,
        language: newLanguage,
        path: currentPath,
        viewState: fileData.viewState // Preserve view state if it existed
    });

    // 3. Update folder's file list in state
    removeFileFromFolderList(oldFileName, currentPath);
    addFileToFolderList(newName, currentPath);

    // 4. If the renamed file was currently open, update editor and state
    if (state.getCurrentFile() === oldFileName) {
        editor.setModel(newModel); // Set the new model
        state.setCurrentFile(newName); // Update current file name in state
        // Restore view state immediately
        if (state.getFile(newName)?.viewState) {
            try {
                editor.restoreViewState(state.getFile(newName).viewState);
            } catch (e) { console.warn("Failed to restore view state after rename."); }
        }
        ui.updateStatusBarLanguage(newLanguage); // Update status bar
        // Cursor position should be handled by viewState or default set by setModel
    }

    // 5. Remove old state entries
    state.removeFile(oldFileName); // Removes from files and filePaths map

    // 6. Dispose old model
    if (oldModel && !oldModel.isDisposed()) {
        oldModel.dispose();
    }

    // 7. Update UI
    ui.renderFileTree();
    ui.showMessage(`Renamed file to "${newName}"`, 'success');
}


/**
 * Deletes a file, updating state, disposing model, and updating UI.
 * This is the user-facing function, performs checks and calls internal helper.
 * @param {string} fileName - The name/key of the file to delete.
 */
export function deleteFile(fileName) {
     if (!state.getFile(fileName)) {
         ui.showMessage(`File "${fileName}" not found.`, 'error');
         return;
     }
    // Confirmation dialog managed by event handler calling this
    if (deleteFileInternal(fileName)) {
        ui.renderFileTree(); // Update UI only if deletion happened
        ui.showMessage(`Deleted file: ${fileName}`, 'success');
    } else {
        ui.showMessage(`Failed to delete file: ${fileName}`, 'error'); // Should not happen if file exists initially
    }
}

/**
 * Internal helper to delete a file from state and dispose its model.
 * Handles state updates consistently. Returns true if successful.
 * @param {string} fileName - The name/key of the file to delete.
 * @param {string|null} [specificPath=null] - If provided, only deletes if file's path matches this (used for cut/paste source removal).
 * @returns {boolean} - True if the file was found and deleted, false otherwise.
 */
function deleteFileInternal(fileName, specificPath = null) {
     const fileData = state.getFile(fileName);
     const filePath = state.getFilePath(fileName); // Path from the map

     if (!fileData || filePath === undefined) {
          console.warn(`Filesystem Internal: Cannot delete file "${fileName}": Not found in state or path map.`);
          return false; // Indicate not deleted
     }

     // If specificPath is provided, ensure it matches the file's actual path
     if (specificPath !== null && filePath !== specificPath) {
          console.warn(`Filesystem Internal: deleteFileInternal called for "${fileName}" with specificPath "${specificPath}" but file is at "${filePath}". Skipping deletion.`);
          return false;
     }

     // 1. Remove from parent folder's file list in state
     removeFileFromFolderList(fileName, filePath);

     // 2. If the deleted file is currently open, clear the editor
     const editor = state.getEditorInstance();
     if (state.getCurrentFile() === fileName && editor) {
          editor.setModel(null); // Clear model from editor view
          state.setCurrentFile(null);
          // Update UI status elements
          ui.updateStatusBarLanguage(null);
          ui.updateStatusBarCursor(1, 1);
          ui.domElements.downloadBtn.disabled = true;
     }

     // 3. Dispose Monaco model
     if (fileData.model && !fileData.model.isDisposed()) {
          fileData.model.dispose();
     }

     // 4. Remove from state (files and filePaths maps)
     state.removeFile(fileName); // State function handles both maps

     console.log(`Filesystem Internal: Deleted file "${fileName}" from path "${filePath}".`);
     return true; // Indicate deletion occurred
}


// --- Folder Operations ---

/**
 * Handles the logic to create a new, empty folder entry in the state.
 * Assumes details (name, parentPath) are obtained from UI/event handler.
 * @param {string} folderName - The desired name for the new folder.
 * @param {string} parentPath - The path of the parent folder ('root' for top level).
 */
export function createNewFolder(folderName, parentPath) {
    // Validation
    if (!folderName || folderName.includes('/') || folderName.includes('\\') || folderName === 'root') {
        ui.showMessage("Invalid folder name.", 'error');
        return;
    }
    if (!state.getFolder(parentPath)) {
        ui.showMessage(`Parent folder "${parentPath}" does not exist.`, 'error');
        return;
    }

    // Construct the full path for the new folder
    const newFolderPath = parentPath === 'root' ? folderName : `${parentPath}/${folderName}`;

    // Check if folder already exists at this path
    if (state.getFolder(newFolderPath)) {
        const parentName = parentPath === 'root' ? 'Root' : state.getFolder(parentPath)?.name;
        ui.showMessage(`Folder "${folderName}" already exists under "${parentName}".`, 'error');
        return;
    }

    // Create new folder entry in state
    state.addOrUpdateFolder(newFolderPath, {
        name: folderName,
        files: [],
        subfolders: [],
        path: newFolderPath
    });

    // Add the new folder path to the parent's subfolders list in state
    addFolderToParentList(newFolderPath, parentPath);

    // Update UI
    ui.renderFileTree();

    // Update last used folder preference
    state.setLastUsedFolder(newFolderPath);

    ui.showMessage(`Created folder: ${folderName}`, 'success');
}


/**
 * Renames a folder, updating state, descendant paths, and UI.
 * @param {string} oldPath - The current path/key of the folder.
 * @param {string} newName - The desired new name.
 */
export function renameFolder(oldPath, newName) {
     const folderData = state.getFolder(oldPath);
     if (!folderData || oldPath === 'root') {
          console.error(`Filesystem: Cannot rename - Folder path "${oldPath}" not found or is root.`);
          return;
     }
     if (!newName || newName === folderData.name || newName.includes('/') || newName.includes('\\') || newName === 'root') {
          ui.showMessage("Invalid new folder name.", 'error');
          return;
     }


     // Determine parent path
     const pathParts = oldPath.split('/');
     pathParts.pop(); // Remove current name
     const parentPath = pathParts.length > 0 ? pathParts.join('/') : 'root';
     const parentFolder = state.getFolder(parentPath);

      if (!parentFolder) {
          console.error(`Filesystem: Cannot rename folder - Parent folder "${parentPath}" not found for "${oldPath}".`);
           ui.showMessage(`Error: Parent folder not found during rename.`, 'error');
          return;
     }


     // Construct new path
     const newPath = parentPath === 'root' ? newName : `${parentPath}/${newName}`;

     // Check if new path already exists
     if (state.getFolder(newPath)) {
          ui.showMessage(`A folder named "${newName}" already exists in this location.`, 'error');
          return;
     }

     // --- Update Process ---
     // 1. Store old data temporarily (especially children lists)
     const oldFiles = [...folderData.files];
     const oldSubfolders = [...folderData.subfolders];

     // 2. Create new entry for the folder with the new path and name.
     state.addOrUpdateFolder(newPath, {
         name: newName,
         path: newPath,
         files: oldFiles, // Keep same files for now, paths updated below
         subfolders: [] // Subfolder paths will be updated below
     });

     // 3. Recursively update paths for all descendant folders and files.
     updateDescendantPaths(oldPath, newPath); // This updates state.filePaths, state.files[...].path, and state.folders structure

     // 4. Update the parent folder's subfolder list.
     removeFolderFromParentList(oldPath, parentPath);
     addFolderToParentList(newPath, parentPath);


     // 5. Delete the old folder entry from state.
     state.removeFolder(oldPath);


     // 6. Update lastUsedFolder if it was the renamed folder or a descendant
      if (state.getLastUsedFolder() === oldPath || state.getLastUsedFolder().startsWith(oldPath + '/')) {
         const updatedLastUsed = state.getLastUsedFolder().replace(oldPath, newPath);
         state.setLastUsedFolder(updatedLastUsed);
      }

     // 7. Update UI
     ui.renderFileTree();
     ui.showMessage(`Renamed folder to "${newName}"`, 'success');
}


/**
 * Helper for renameFolder: Recursively updates paths of children in the state.
 * Updates filePaths map, file object paths, folder paths, and parent->child links.
 * @param {string} oldBasePath - The original path prefix being replaced.
 * @param {string} newBasePath - The new path prefix.
 */
function updateDescendantPaths(oldBasePath, newBasePath) {
    const folderData = state.getFolder(newBasePath); // Get the *newly created* folder entry
    if (!folderData) {
        console.error(`Filesystem internal error: Folder data for ${newBasePath} not found during path update.`);
        return;
    }

    // Update paths for files directly within this folder
    // Must iterate over a copy as state might change if helper funcs modify lists
    const currentFiles = [...folderData.files];
    currentFiles.forEach(fileName => {
        if (state.getFilePath(fileName) === oldBasePath) { // Double check path before updating
            state.updateFileState(fileName, { path: newBasePath }); // Updates files[fileName].path and filePaths[fileName]
        } else {
             // This file shouldn't be listed here if its path map points elsewhere, indicates inconsistency
             console.warn(`Path inconsistency for file "${fileName}" during rename. Expected path "${oldBasePath}", found "${state.getFilePath(fileName)}". Removing from folder "${newBasePath}" list.`);
             removeFileFromFolderList(fileName, newBasePath); // Clean up inconsistency
        }
    });

    // Update paths for subfolders and recurse
    const subfoldersToUpdate = state.getFolders()[oldBasePath]?.subfolders; // Get subfolders from the *original* path before it's deleted
    if (subfoldersToUpdate && subfoldersToUpdate.length > 0) {
         // Need to process subfolders based on the state *before* full deletion of oldPath
         // Iterate over original subfolder paths found under oldBasePath
        [...subfoldersToUpdate].forEach(oldSubfolderPath => {
            const subfolderName = state.getFolder(oldSubfolderPath)?.name;
            if (!subfolderName) {
                 console.error(`Failed to get name for subfolder ${oldSubfolderPath} during rename.`);
                 return; // Skip if subfolder is inconsistent
            }

            const newSubfolderPath = `${newBasePath}/${subfolderName}`;

            // 1. Update the subfolder's own entry in the main folders state
            const subfolderData = state.getFolder(oldSubfolderPath);
            if (subfolderData) {
                // Create new entry for the subfolder at its new path
                state.addOrUpdateFolder(newSubfolderPath, {
                    ...subfolderData,
                    path: newSubfolderPath // Update its own path property
                });

                 // 2. Add the *new* subfolder path to the *new* parent's list
                addFolderToParentList(newSubfolderPath, newBasePath);

                // 3. Recurse to update descendants of this subfolder
                updateDescendantPaths(oldSubfolderPath, newSubfolderPath);

                 // 4. Remove the old subfolder entry
                 state.removeFolder(oldSubfolderPath);

            } else {
                console.error(`Inconsistency during rename: Expected subfolder data for ${oldSubfolderPath} not found.`);
            }
        });
    } else {
        // console.log(`No subfolders found under old path ${oldBasePath} to update.`);
    }

    // Ensure the subfolders list for the *new* path is now correct based on the recursive calls
    // syncFolderSubfolderList(newBasePath); // Might be needed if addFolderToParentList is not sufficient
}


/**
 * Deletes a folder and all its contents recursively.
 * User-facing function, performs checks.
 * @param {string} folderPath - The path/key of the folder to delete.
 */
export function deleteFolder(folderPath) {
    const folderData = state.getFolder(folderPath);
    if (!folderData || folderPath === 'root') {
        ui.showMessage("Cannot delete this folder.", 'error');
        return;
    }
    const folderName = folderData.name;
    // Confirmation dialog managed by event handler calling this

    // Use internal recursive deletion
    if (deleteFolderRecursive(folderPath)) {
        ui.renderFileTree();
        ui.showMessage(`Deleted folder: ${folderName}`, 'success');
    } else {
         ui.showMessage(`Failed to fully delete folder: ${folderName}`, 'error');
    }
}


/**
 * Internal recursive function to delete a folder and its contents from state.
 * @param {string} folderPath - The path of the folder to delete.
 * @returns {boolean} - True if successful, false otherwise.
 */
function deleteFolderRecursive(folderPath) {
    const folderData = state.getFolder(folderPath);
    if (!folderData || folderPath === 'root') {
        console.error(`Filesystem Internal: Attempted to delete invalid or root folder: ${folderPath}`);
        return false;
    }

    // 1. Delete descendant files
    // Use copies of arrays as they will be modified by deletion functions
    const filesToDelete = [...folderData.files];
    filesToDelete.forEach(fileName => {
        // Use internal delete helper, specifying the path is crucial if duplicate names exist
        deleteFileInternal(fileName, folderPath);
    });

    // 2. Delete descendant subfolders recursively
    const subfoldersToDelete = [...folderData.subfolders];
    subfoldersToDelete.forEach(subfolderPath => {
        deleteFolderRecursive(subfolderPath); // Recurse
    });

    // 3. Remove the folder from its parent's subfolder list
    const pathParts = folderPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.length > 0 ? pathParts.join('/') : 'root';
    removeFolderFromParentList(folderPath, parentPath);

    // 4. Update lastUsedFolder if it was the deleted folder or a descendant
    if (state.getLastUsedFolder() === folderPath || state.getLastUsedFolder().startsWith(folderPath + '/')) {
        state.setLastUsedFolder(parentPath); // Reset to parent folder
    }

    // 5. Delete the folder's own entry from state
    state.removeFolder(folderPath);

    console.log(`Filesystem Internal: Deleted folder "${folderPath}".`);
    return true; // Assume success if no errors thrown
}

// --- Structure Management Helpers ---

/**
 * Adds a file name to a folder's `files` list in the state.
 * @param {string} fileName
 * @param {string} folderPath
 */
function addFileToFolderList(fileName, folderPath) {
    const folderData = state.getFolder(folderPath);
    if (folderData && !folderData.files.includes(fileName)) {
        folderData.files.push(fileName);
        // No need to call state.addOrUpdateFolder, modifying object directly is ok here
        // as long as we only modify the list content, not replace the list itself.
    } else if (!folderData) {
         console.error(`Filesystem: Cannot add file "${fileName}" to list, folder "${folderPath}" not found.`);
    }
}

/**
 * Removes a file name from a folder's `files` list in the state.
 * @param {string} fileName
 * @param {string} folderPath
 */
function removeFileFromFolderList(fileName, folderPath) {
    const folderData = state.getFolder(folderPath);
    if (folderData) {
        const index = folderData.files.indexOf(fileName);
        if (index > -1) {
            folderData.files.splice(index, 1);
        }
    } else {
         console.warn(`Filesystem: Cannot remove file "${fileName}" from list, folder "${folderPath}" not found.`);
    }
}

/**
 * Adds a subfolder path to a parent folder's `subfolders` list in the state.
 * @param {string} subfolderPath
 * @param {string} parentPath
 */
function addFolderToParentList(subfolderPath, parentPath) {
    const parentData = state.getFolder(parentPath);
    if (parentData && !parentData.subfolders.includes(subfolderPath)) {
        parentData.subfolders.push(subfolderPath);
    } else if (!parentData) {
         console.error(`Filesystem: Cannot add subfolder "${subfolderPath}" to list, parent folder "${parentPath}" not found.`);
    }
}

/**
 * Removes a subfolder path from a parent folder's `subfolders` list in the state.
 * @param {string} subfolderPath
 * @param {string} parentPath
 */
function removeFolderFromParentList(subfolderPath, parentPath) {
    const parentData = state.getFolder(parentPath);
    if (parentData) {
        const index = parentData.subfolders.indexOf(subfolderPath);
        if (index > -1) {
            parentData.subfolders.splice(index, 1);
        }
    } else {
         console.warn(`Filesystem: Cannot remove subfolder "${subfolderPath}" from list, parent folder "${parentPath}" not found.`);
    }
}

/**
 * Ensures consistency between the list of files in folder objects and the actual
 * files present in the main state.files / state.filePaths maps.
 * Useful after potentially inconsistent operations like session restore.
 */
export function syncFolderFileLists() {
    console.log("Syncing folder file lists with main state...");
    const folders = state.getFolders() || {};
    const filePaths = state.getFilePath() || {};
    const allFiles = state.getFiles() || {};
    let fixedCount = 0;

    Object.keys(folders).forEach(folderPath => {
        const folderData = folders[folderPath];
        if (!folderData) return; // Skip if folder data is missing
        
        const currentFileList = [...(folderData.files || [])]; // Work on a copy, ensure array

        folderData.files = []; // Reset the list

        currentFileList.forEach(fileName => {
            // Only add back if file exists in main state AND its path matches this folder
            if (allFiles[fileName] && filePaths[fileName] === folderPath) {
                 if (!folderData.files.includes(fileName)) { // Avoid duplicates just in case
                     folderData.files.push(fileName);
                 }
            } else {
                 console.warn(`Consistency Fix: Removing stale file reference "${fileName}" from folder "${folderPath}".`);
                 fixedCount++;
            }
        });

        // Also check for files whose path map points here but aren't in the list
        if (filePaths && typeof filePaths === 'object') {
            Object.entries(filePaths).forEach(([fileName, path]) => {
                if (path === folderPath && !folderData.files.includes(fileName) && allFiles[fileName]) {
                    console.warn(`Consistency Fix: Adding missing file reference "${fileName}" to folder "${folderPath}".`);
                    folderData.files.push(fileName);
                    fixedCount++;
                }
            });
        }

        // Sort the corrected list
        folderData.files.sort((a, b) => a.localeCompare(b));
    });
     if (fixedCount > 0) {
        console.log(`Folder list sync completed. ${fixedCount} inconsistencies fixed.`);
     } else {
        console.log("Folder list sync completed. No inconsistencies found.");
     }
}


// --- Clipboard Operations ---

/**
 * Copies a file's details to the clipboard state.
 * @param {string} fileName - The name of the file to copy.
 */
export function copyItem(fileName) {
    const fileData = state.getFile(fileName);
    const filePath = state.getFilePath(fileName);

    if (!fileData || !fileData.model || filePath === undefined) {
         console.error(`Filesystem: Cannot copy - File data, model, or path missing for "${fileName}".`);
         ui.showMessage("Cannot copy this file.", "error");
         return;
    }
     if (fileData.model.isDisposed()) {
          console.error(`Filesystem: Cannot copy - Model for "${fileName}" is disposed.`);
          ui.showMessage("Cannot copy file with invalid model.", "error");
          return;
     }


    state.setClipboard({
        type: 'copy',
        fileName: fileName,
        content: fileData.model.getValue(), // Get current content
        language: fileData.language,
        sourcePath: filePath
    });

    ui.showMessage(`Copied file: ${fileName}`, 'success', 1500);
    ui.renderFileTree(); // Re-render to potentially clear 'cut' visual state if any
}

/**
 * Cuts a file's details to the clipboard state (marks for move).
 * @param {string} fileName - The name of the file to cut.
 */
export function cutItem(fileName) {
    const fileData = state.getFile(fileName);
    const filePath = state.getFilePath(fileName);

    if (!fileData || !fileData.model || filePath === undefined) {
         console.error(`Filesystem: Cannot cut - File data, model, or path missing for "${fileName}".`);
         ui.showMessage("Cannot cut this file.", "error");
         return;
    }
     if (fileData.model.isDisposed()) {
          console.error(`Filesystem: Cannot cut - Model for "${fileName}" is disposed.`);
          ui.showMessage("Cannot cut file with invalid model.", "error");
          return;
     }


    state.setClipboard({
        type: 'cut',
        fileName: fileName,
        content: fileData.model.getValue(), // Get current content
        language: fileData.language,
        sourcePath: filePath
    });

    ui.showMessage(`Cut file: ${fileName}. Right-click folder to paste.`, 'info', 2500);
    ui.renderFileTree(); // Re-render to apply 'cut' visual state
}

/**
 * Pastes the clipboard content (file) into a target folder.
 * Handles 'copy' and 'cut' operations.
 * @param {string} targetFolderPath - The path of the folder to paste into.
 */
export function pasteItem(targetFolderPath) {
    const clipboard = state.getClipboard();

    if (!clipboard) {
        ui.showMessage("Clipboard is empty.", 'info');
        return;
    }
    if (!state.getFolder(targetFolderPath)) {
         ui.showMessage("Target folder does not exist.", 'error');
         return;
    }

    const { type: clipType, fileName: originalFileName, content, language, sourcePath } = clipboard;

    // Prevent cutting and pasting into the exact same folder
    if (clipType === 'cut' && sourcePath === targetFolderPath) {
         ui.showMessage("Cannot cut and paste file into the same folder.", 'info');
         state.setClipboard(null); // Cancel cut operation
         ui.renderFileTree(); // Remove visual cue
         return;
    }

    let newFileName = originalFileName;
    let overwrite = false;

    // Check for name collision in the target folder
    if (state.getFile(newFileName) && state.getFilePath(newFileName) === targetFolderPath) {
        // Name exists, prompt for action (overwrite, rename, cancel)
        const action = prompt(`File "${originalFileName}" already exists in "${targetFolderPath === 'root' ? 'Root' : state.getFolder(targetFolderPath).name}".\nEnter 'overwrite', 'rename', or cancel:`, 'rename');

        if (!action) {
            ui.showMessage("Paste cancelled.", 'info');
            // If it was a cut, should we cancel the cut state? Yes.
            if (clipType === 'cut') state.setClipboard(null);
            ui.renderFileTree(); // Remove visual cue if cut was cancelled
            return;
        }

        if (action.toLowerCase() === 'overwrite') {
            overwrite = true;
             // Need to delete the existing file before creating the new one via createEditorModel
             console.warn(`Paste: Overwriting existing file "${newFileName}" in "${targetFolderPath}".`);
             if (!deleteFileInternal(newFileName, targetFolderPath)) { // Delete specifically from target
                  ui.showMessage("Error removing existing file for overwrite. Paste cancelled.", "error");
                  if (clipType === 'cut') state.setClipboard(null); // Cancel cut
                  ui.renderFileTree();
                  return;
             }
        } else if (action.toLowerCase() === 'rename') {
            const suggestedName = `copy_of_${originalFileName}`;
            const nameFromPrompt = prompt(`Enter a new name for the pasted file:`, suggestedName);
            if (!nameFromPrompt) {
                ui.showMessage("Paste cancelled.", 'info');
                 if (clipType === 'cut') state.setClipboard(null);
                 ui.renderFileTree();
                 return;
            }
            newFileName = nameFromPrompt.trim();
             // Basic validation for the new name
            if (!newFileName || newFileName.includes('/') || newFileName.includes('\\')) {
                ui.showMessage("Invalid new name. Paste cancelled.", 'error');
                if (clipType === 'cut') state.setClipboard(null);
                ui.renderFileTree();
                return;
            }
            // Re-check collision with the *new* name
            if (state.getFile(newFileName) && state.getFilePath(newFileName) === targetFolderPath) {
                ui.showMessage(`File "${newFileName}" also exists. Paste cancelled.`, 'error');
                if (clipType === 'cut') state.setClipboard(null);
                ui.renderFileTree();
                return;
            }
        } else {
            // Cancel
             ui.showMessage("Paste cancelled.", 'info');
             if (clipType === 'cut') state.setClipboard(null);
             ui.renderFileTree();
             return;
        }
    }

    // Create the new file model and add to state (or update if overwriting)
    // createEditorModel handles adding to state.files, state.filePaths and folder.files list
    const model = createEditorModel(newFileName, content, language, targetFolderPath);

    if (model) {
         let message = `Pasted file as "${newFileName}"`;
        // If it was a 'cut' operation, remove the original file
        if (clipType === 'cut') {
            // Delete original using internal helper, specifying the source path
            if (deleteFileInternal(originalFileName, sourcePath)) {
                message = `Moved file to "${newFileName}"`;
            } else {
                 // This shouldn't typically happen if clipboard state was valid
                 console.error(`Failed to delete original file "${originalFileName}" from "${sourcePath}" after cut.`);
                 message += ` (Error deleting original)`;
            }
            // Clear clipboard ONLY after successful cut-paste
            state.setClipboard(null);
        } else {
             // For copy, clear clipboard if desired, or keep it for multiple pastes
             // state.setClipboard(null); // Uncomment to clear after copy-paste
        }

        // Update UI and open the newly pasted/moved file
        ui.renderFileTree();
        openFile(newFileName); // Open the newly created/moved file
        ui.showMessage(message, 'success');

    } else {
        // Error during model creation/state update
        ui.showMessage("Failed to paste file.", 'error');
        // If cut, clipboard should still be active? Maybe clear it to prevent repeated failures.
        // if (clipType === 'cut') state.setClipboard(null);
        // ui.renderFileTree(); // Ensure cut state is cleared visually if needed
    }
}