/**
 * @file src/ui.js
 * @purpose Manages all UI rendering, DOM manipulation, modals, notifications,
 *          and UI-specific event listeners.
 * @usage Imported by main.js and potentially other modules for UI updates.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring. Consolidated DOM elements, rendering functions (file tree, status bar),
 *               modal logic, notifications, context menu display, sidebar, and loading indicator from scripts.js.
 */

// --- Module Imports ---
import * as state from './state.js';
import { 
    createNewFile, 
    createNewFolder, 
    openFile,
    deleteFile,
    renameFile,
    deleteFolder,
    renameFolder 
} from './filesystem.js';
import {
    handleFileUpload,
    handleFolderUpload,
    handleImportUrl,
    handleImportRepo,
    downloadWorkspace,
    loadSelectedGitHubFiles
} from './io.js';

// --- DOM Elements Cache ---
// Encapsulate DOM elements within this module
export const domElements = {
    // Core Layout & Editor
    mainContainer: document.querySelector('.main-container'),
    monacoEditorContainer: document.getElementById('monaco-editor'),

    // Sidebar & File Tree
    fileSidebar: document.querySelector('.file-sidebar'),
    sidebarToggle: document.querySelector('.sidebar-toggle'),
    fileList: document.getElementById('file-list'), // File tree root <ul>
    collapseAllBtn: document.getElementById('collapse-all-btn'), // Added for completeness

    // Toolbar Buttons
    importBtn: document.getElementById('import-btn'),
    downloadBtn: document.getElementById('download-btn'),
    newFileBtn: document.getElementById('new-file-btn'),
    newFolderBtn: document.getElementById('new-folder-btn'),
    downloadAllBtn: document.getElementById('download-all-btn'),

    // Status Bar
    languageMode: document.getElementById('language-mode'),
    cursorPosition: document.getElementById('cursor-position'),
    saveStatus: document.getElementById('save-status'), // For save indicator

    // Modals & Content
    newFileModal: document.getElementById('new-file-modal'),
    newFileName: document.getElementById('new-file-name'),
    newFileFolder: document.getElementById('new-file-folder'),
    createFileBtn: document.getElementById('create-file-btn'),

    newFolderModal: document.getElementById('new-folder-modal'),
    newFolderName: document.getElementById('new-folder-name'),
    newFolderParent: document.getElementById('new-folder-parent'),
    createFolderBtn: document.getElementById('create-folder-btn'),

    downloadWorkspaceModal: document.getElementById('download-workspace-modal'),
    workspaceName: document.getElementById('workspace-name'),
    downloadWorkspaceBtn: document.getElementById('download-workspace-btn'),

    importModal: document.getElementById('import-modal'),
    importModalClose: document.getElementById('import-modal-close'),
    importDropzone: document.getElementById('import-dropzone'),
    importUrlInput: document.getElementById('import-url-input'),
    importUrlBtn: document.getElementById('import-url-btn'),
    importRepoInput: document.getElementById('import-repo-input'),
    importRepoBtn: document.getElementById('import-repo-btn'),
    importFilesBtn: document.getElementById('import-files-btn'),
    importFolderChooserBtn: document.getElementById('import-folder-chooser-btn'),
    urlTypeFile: document.querySelector('input[name="url-type"][value="file"]'),
    urlTypeZip: document.querySelector('input[name="url-type"][value="zip"]'),
    // Hidden inputs (accessed via buttons)
    fileUpload: document.getElementById('file-upload'),
    folderUpload: document.getElementById('folder-upload'),

    githubModal: document.getElementById('github-modal'),
    repoInfo: document.getElementById('repo-info'),
    repoFileList: document.getElementById('repo-file-list'), // Container for repo files
    loadGithubFilesBtn: document.getElementById('load-github-files'), // Changed ID from loadGithubFiles

    sessionRecoveryModal: document.getElementById('session-recovery-modal'),
    sessionDetails: document.getElementById('session-details'),
    newSessionBtn: document.getElementById('new-session-btn'),
    recoverSessionBtn: document.getElementById('recover-session-btn'),

    // Standalone UI Elements
    loadingIndicator: document.getElementById('loading'),
    messageBox: document.getElementById('message-box'),
    contextMenu: document.getElementById('context-menu'),
};

// --- Private State ---
let messageBoxTimeoutId = null;
// Folder expansion state tracking
const expandedFolders = new Set(); // Store expanded folder paths

// --- File Tree Rendering ---

/**
 * Renders the entire file tree based on the current state.folders and state.files.
 */
export function renderFileTree() {
    if (!domElements.fileList) return;
    domElements.fileList.innerHTML = ''; // Clear existing list

    const folders = state.getFolders();
    const currentFilePath = state.getCurrentFile() ? state.getFilePath(state.getCurrentFile()) : null;
    const currentFileName = state.getCurrentFile();

    // Recursive function to build the tree
    function buildTree(folderPath, parentElement, level = 0) {
        const folderData = folders[folderPath];
        if (!folderData) {
             console.error("UI Render Error: Folder data not found for path:", folderPath);
             return;
        }

        // Sort subfolders alphabetically
        const sortedSubfolders = [...folderData.subfolders].sort((a, b) =>
            folders[a]?.name.localeCompare(folders[b]?.name) ?? 0
        );
        // Sort files alphabetically
        const sortedFiles = [...folderData.files].sort((a, b) => a.localeCompare(b));

        // Add subfolders first
        sortedSubfolders.forEach(subfolderPath => {
            const folderItem = createFolderItem(subfolderPath, level);
            if (folderItem) {
                parentElement.appendChild(folderItem);
                // Recursively build content for this subfolder *inside* its content div
                const contentDiv = folderItem.querySelector('.folder-content');
                if (contentDiv) { // Ensure contentDiv exists
                     // Preserve expanded state visually (more robust state saving needed for persistence)
                     if (folderItem.classList.contains('folder-expanded')) {
                         buildTree(subfolderPath, contentDiv, level + 1);
                     }
                }
            }
        });

        // Add files
        sortedFiles.forEach(fileName => {
            // Only render file if it actually exists in the main files state
            if (state.getFile(fileName) && state.getFilePath(fileName) === folderPath) {
                const fileItem = createFileItem(fileName, level);
                if (fileItem) {
                    parentElement.appendChild(fileItem);
                }
            } else {
                // This indicates an inconsistency - the file is listed in the folder but not in the main state/path map
                console.warn(`UI Render Warning: File "${fileName}" listed in folder "${folderPath}" but not found in global state or path map.`);
                 // Optionally, automatically clean up the inconsistency here
                 // filesystem.removeFileFromFolderList(fileName, folderPath); // Example cleanup
            }
        });
    }

    // Start building from the root
    buildTree('root', domElements.fileList, 0);
}

/**
 * Creates a DOM element for a single file.
 * @param {string} fileName
 * @param {number} level - Indentation level.
 * @returns {HTMLLIElement | null}
 */
function createFileItem(fileName, level) {
    const li = document.createElement('li');
    li.className = 'file-item';
    if (fileName === state.getCurrentFile()) {
        li.classList.add('active');
    }
    li.dataset.filename = fileName;
    li.dataset.type = 'file';
    li.style.paddingLeft = `${level * 15 + 15}px`; // Adjust indentation

    // Add file extension for styling icons
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension && extension !== fileName) {
        li.dataset.ext = extension;
    }

    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-item-name';
    fileNameSpan.textContent = fileName;
    fileNameSpan.title = fileName; // Tooltip for long names

    li.appendChild(fileNameSpan);

    // Event listeners
    li.addEventListener('click', () => openFile(fileName)); // Import and use openFile from filesystem
    li.addEventListener('contextmenu', handleContextMenuTrigger); // Use handler from events module

    // Add drag and drop listeners (using handlers from events module)
    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);

    // Add visual cue if file is in clipboard for 'cut'
    const clipboard = state.getClipboard();
    if (clipboard?.type === 'cut' && clipboard.fileName === fileName && clipboard.sourcePath === state.getFilePath(fileName)) {
         li.style.opacity = '0.5'; // Example visual cue
         li.style.fontStyle = 'italic';
    }


    return li;
}

/**
 * Creates a DOM element for a single folder (including header and content container).
 * @param {string} folderPath
 * @param {number} level - Indentation level.
 * @returns {HTMLDivElement | null}
 */
function createFolderItem(folderPath, level) {
    const folderData = state.getFolder(folderPath);
    if (!folderData || folderPath === 'root') return null; // Don't render root explicitly

    const folderContainer = document.createElement('div');
    folderContainer.className = 'folder-item';
    
    // Check folder expansion state from our tracked state
    if (expandedFolders.has(folderPath)) {
        folderContainer.classList.add('folder-expanded');
    }
    
    folderContainer.dataset.path = folderPath;
    folderContainer.dataset.type = 'folder';
    folderContainer.style.paddingLeft = `${level * 15}px`; // Base indent for folder container

    // --- Folder Header (Toggle, Icon, Name) ---
    const folderHeader = document.createElement('div');
    folderHeader.className = 'folder-item-header';
    folderHeader.addEventListener('click', toggleFolderExpansion); // Click header to toggle
    folderHeader.addEventListener('contextmenu', handleContextMenuTrigger); // Context menu on header

    const folderToggle = document.createElement('span');
    folderToggle.className = 'folder-toggle';

    const folderIcon = document.createElement('span');
    folderIcon.className = 'folder-icon';

    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folderData.name;
    folderName.title = folderData.name;

    folderHeader.appendChild(folderToggle);
    folderHeader.appendChild(folderIcon);
    folderHeader.appendChild(folderName);
    // --- End Folder Header ---

    const folderContent = document.createElement('div');
    folderContent.className = 'folder-content';
    // Content starts hidden unless folder is expanded
    if (!folderContainer.classList.contains('folder-expanded')) {
       folderContent.style.display = 'none'; // Explicitly hide
    } else {
       // If expanded, build its tree content immediately during this render pass
       buildTree(folderPath, folderContent, level + 1); // Call buildTree recursively
    }

    folderContainer.appendChild(folderHeader);
    folderContainer.appendChild(folderContent);

    // Add drag and drop listeners (using handlers from events module)
    // Allow dropping onto the header
    folderHeader.setAttribute('draggable', 'true'); // Make header draggable
    folderHeader.addEventListener('dragstart', handleDragStart); // Drag folder
    folderHeader.addEventListener('dragover', handleDragOver); // Allow dropping onto folder
    folderHeader.addEventListener('dragleave', handleDragLeave);
    folderHeader.addEventListener('drop', handleDrop); // Handle drop onto folder
    folderHeader.addEventListener('dragend', handleDragEnd);

    return folderContainer;
}

/**
 * Toggles the expansion state of a folder in the UI.
 * @param {MouseEvent} event
 */
function toggleFolderExpansion(event) {
    const header = event.currentTarget; // The header div that was clicked
    const folderItem = header.closest('.folder-item');
    if (!folderItem) return;

    const folderPath = folderItem.dataset.path;
    const isExpanded = folderItem.classList.toggle('folder-expanded');
    const folderContent = folderItem.querySelector('.folder-content');

    // Track expanded state in our state management
    if (isExpanded) {
        expandedFolders.add(folderPath);
    } else {
        expandedFolders.delete(folderPath);
    }

    if (folderContent) {
        if (isExpanded && folderContent.innerHTML === '') {
             // If expanding and content is empty, render it now
             buildTree(folderPath, folderContent, parseInt(folderItem.style.paddingLeft || '0') / 15 + 1);
        }
        folderContent.style.display = isExpanded ? 'block' : 'none';
    }

    console.log(`Folder ${folderPath} ${isExpanded ? 'expanded' : 'collapsed'}`);
}


/**
 * Recursively builds the file tree content for a given folder path.
 * Internal helper for renderFileTree and toggleFolderExpansion.
 * @param {string} folderPath
 * @param {HTMLElement} parentElement - The element to append children to.
 * @param {number} level - Indentation level.
 */
function buildTree(folderPath, parentElement, level = 0) {
    const folders = state.getFolders();
    const folderData = folders[folderPath];
    if (!folderData) return;

    parentElement.innerHTML = ''; // Clear previous content before rebuilding

    // Sort subfolders alphabetically
    const sortedSubfolders = [...folderData.subfolders].sort((a, b) =>
        folders[a]?.name.localeCompare(folders[b]?.name) ?? 0
    );
    // Sort files alphabetically
    const sortedFiles = [...folderData.files].sort((a, b) => a.localeCompare(b));

    // Add subfolders first
    sortedSubfolders.forEach(subfolderPath => {
        const folderItem = createFolderItem(subfolderPath, level);
        if (folderItem) {
            parentElement.appendChild(folderItem);
            // If the subfolder itself should be expanded, recurse immediately
             const contentDiv = folderItem.querySelector('.folder-content');
             if (folderItem.classList.contains('folder-expanded') && contentDiv) {
                 buildTree(subfolderPath, contentDiv, level + 1);
             }
        }
    });

    // Add files
    sortedFiles.forEach(fileName => {
         if (state.getFile(fileName) && state.getFilePath(fileName) === folderPath) {
             const fileItem = createFileItem(fileName, level);
             if (fileItem) {
                 parentElement.appendChild(fileItem);
             }
         }
    });
}

/**
 * Expands all parent folders of a file path to make the file visible in the UI
 * @param {string} filePath - The folder path of the file to reveal
 */
export function expandParentFolders(filePath) {
    if (filePath === 'root' || !filePath) return;
    
    // Build an array of all parent folder paths
    const pathParts = filePath.split('/');
    let currentPath = '';
    
    // Build each parent path and add it to expanded folders set
    for (let i = 0; i < pathParts.length; i++) {
        if (i === 0) {
            currentPath = pathParts[0];
        } else {
            currentPath = `${currentPath}/${pathParts[i]}`;
        }
        
        // Add to expanded folders tracking
        expandedFolders.add(currentPath);
    }
}

/**
 * Collapses all folders in the file explorer
 */
export function collapseAllFolders() {
    // Clear the set of expanded folders
    expandedFolders.clear();
    
    // Re-render the file tree to reflect the collapsed state
    renderFileTree();
    
    showMessage("All folders collapsed", 'info', 1500);
}

// --- Status Bar Updates ---

export function updateStatusBarLanguage(language) {
    if (domElements.languageMode) {
        domElements.languageMode.textContent = language ? `Lang: ${language}` : 'No file open';
    }
}

export function updateStatusBarCursor(line, column) {
    if (domElements.cursorPosition) {
        domElements.cursorPosition.textContent = `Line: ${line}, Col: ${column}`;
    }
}

// Example for save status - could be called from session.js
export function updateSaveStatus(statusText = '', duration = 2000) {
    if (!domElements.saveStatus) return;
    domElements.saveStatus.textContent = statusText;
    if (statusText) {
        // Clear after a delay
        setTimeout(() => {
            if (domElements.saveStatus.textContent === statusText) { // Avoid clearing if changed again
                domElements.saveStatus.textContent = '';
            }
        }, duration);
    }
}


// --- UI State Management (Sidebar, Loading) ---

/**
 * Toggles the visibility of the file sidebar.
 */
export function toggleSidebar() {
    const isVisible = !state.isSidebarVisible(); // Toggle state
    setSidebarVisible(isVisible, true); // Update UI with animation
    state.setSidebarVisible(isVisible); // Update state

    // Save preference? Could be done here or in session save
    // session.saveSessionToStorage();
}

/**
 * Sets the visibility of the sidebar, optionally with animation.
 * @param {boolean} isVisible
 * @param {boolean} animate
 */
export function setSidebarVisible(isVisible, animate = false) {
    if (!domElements.mainContainer || !domElements.sidebarToggle) return;

    domElements.mainContainer.classList.toggle('sidebar-hidden', !isVisible);
    domElements.sidebarToggle.textContent = isVisible ? '←' : '→';

    // Trigger editor layout recalculation after transition (if animating)
    const editor = state.getEditorInstance();
    if (editor) {
        const delay = animate ? 350 : 50; // Longer delay if animating
        setTimeout(() => {
            editor.layout();
        }, delay);
    }
}

/**
 * Shows or hides the global loading indicator.
 * @param {boolean} isLoading
 */
export function setLoading(isLoading) {
    if (domElements.loadingIndicator) {
        domElements.loadingIndicator.style.display = isLoading ? 'flex' : 'none';
        // Update state as well
        state.setLoading(isLoading);
    }
}

// --- Notifications ---

/**
 * Displays a short-lived message to the user.
 * @param {string} message - The text to display.
 * @param {'info' | 'success' | 'error' | 'warning'} type - Message type for styling.
 * @param {number} duration - How long to display the message in ms.
 */
export function showMessage(message, type = 'info', duration = 3000) {
    if (!domElements.messageBox) return;

    domElements.messageBox.textContent = message;
    domElements.messageBox.className = 'message-box'; // Reset classes
    domElements.messageBox.classList.add(`message-${type}`); // Add type class
    domElements.messageBox.classList.add('visible'); // Make visible

    // Clear previous timeout if any
    if (messageBoxTimeoutId) {
        clearTimeout(messageBoxTimeoutId);
    }

    // Auto-hide after specified duration
    if (duration > 0) {
        messageBoxTimeoutId = setTimeout(() => {
            domElements.messageBox.classList.remove('visible');
            messageBoxTimeoutId = null; // Clear the stored ID
        }, duration);
    }
}


// --- Modal Management ---

/**
 * Populates a <select> element with folder options.
 * @param {HTMLSelectElement} selectElement - The dropdown element.
 * @param {string} [defaultValue='root'] - The path of the folder to select initially.
 */
export function populateFolderDropdown(selectElement, defaultValue = 'root') {
    if (!selectElement) return;
    selectElement.innerHTML = ''; // Clear existing options
    const folders = state.getFolders();

    // Recursive function to add options with indentation
    function addOptions(folderPath, level = 0) {
        const folderData = folders[folderPath];
        if (!folderData) return;

        const option = document.createElement('option');
        option.value = folderPath;

        const indent = '\u00A0\u00A0'.repeat(level * 2); // Use non-breaking spaces for indent
        option.textContent = indent + (folderPath === 'root' ? 'Workspace Root' : folderData.name);

        selectElement.appendChild(option);

        // Sort subfolders alphabetically for the dropdown
        const sortedSubfolders = [...folderData.subfolders].sort((a, b) =>
            folders[a]?.name.localeCompare(folders[b]?.name) ?? 0
        );

        // Add subfolders recursively
        sortedSubfolders.forEach(subfolderPath => {
            addOptions(subfolderPath, level + 1);
        });
    }

    // Start from root
    addOptions('root', 0);

    // Set the default selected value, falling back to 'root' if invalid
    if (folders[defaultValue] || defaultValue === 'root') {
       selectElement.value = defaultValue;
    } else {
       selectElement.value = 'root';
    }
}

/** Opens the 'New File' modal */
export function showNewFileModal() {
    if (!domElements.newFileModal) return;
    populateFolderDropdown(domElements.newFileFolder, state.getLastUsedFolder());
    domElements.newFileName.value = '';
    domElements.newFileModal.style.display = 'flex';
    domElements.newFileName.focus();
}

/** Opens the 'New Folder' modal */
export function showNewFolderModal() {
     if (!domElements.newFolderModal) return;
    populateFolderDropdown(domElements.newFolderParent, state.getLastUsedFolder());
    domElements.newFolderName.value = '';
    domElements.newFolderModal.style.display = 'flex';
    domElements.newFolderName.focus();
}

/** Opens the 'Download Workspace' modal */
export function showDownloadWorkspaceModal() {
    if (!domElements.downloadWorkspaceModal) return;
     // Suggest a default name based on the first folder or a default
    const folders = state.getFolders();
    const firstRootFolder = folders['root']?.subfolders[0];
    const suggestedName = firstRootFolder ? folders[firstRootFolder]?.name || 'qe-workspace' : 'qe-workspace';
    domElements.workspaceName.value = suggestedName;
    domElements.downloadWorkspaceModal.style.display = 'flex';
    domElements.workspaceName.focus();
}

/** Opens the main 'Import' modal */
export function showImportModal() {
     if (!domElements.importModal) return;
    domElements.importUrlInput.value = '';
    domElements.importRepoInput.value = '';
    domElements.importModal.style.display = 'flex';
}

/** Opens the 'GitHub Repo Browser' modal */
export function showGitHubModal() {
     if (!domElements.githubModal) return;
    domElements.githubModal.style.display = 'flex';
}


/**
 * Shows the session recovery prompt modal.
 * @param {string} detailsText - Text describing the found session.
 * @param {Function} onRecover - Callback function if user chooses to recover.
 * @param {Function} onNewSession - Callback function if user chooses a new session.
 */
export function showSessionRecoveryModal(detailsText, onRecover, onNewSession) {
     if (!domElements.sessionRecoveryModal) return;

    domElements.sessionDetails.textContent = detailsText;

    // Remove previous listeners before adding new ones to prevent duplicates
    const recoverBtnClone = domElements.recoverSessionBtn.cloneNode(true);
    domElements.recoverSessionBtn.parentNode.replaceChild(recoverBtnClone, domElements.recoverSessionBtn);
    domElements.recoverSessionBtn = recoverBtnClone; // Update cache

    const newSessionBtnClone = domElements.newSessionBtn.cloneNode(true);
    domElements.newSessionBtn.parentNode.replaceChild(newSessionBtnClone, domElements.newSessionBtn);
    domElements.newSessionBtn = newSessionBtnClone; // Update cache


     // Add new listeners
    domElements.recoverSessionBtn.addEventListener('click', () => {
        hideModal(domElements.sessionRecoveryModal);
        onRecover();
    }, { once: true });

    domElements.newSessionBtn.addEventListener('click', () => {
        hideModal(domElements.sessionRecoveryModal);
        onNewSession();
    }, { once: true });

    domElements.sessionRecoveryModal.style.display = 'flex';
}

/** Hides a specific modal */
export function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

/** Hides all currently visible modals */
export function closeAllModals() {
     document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    // Also hide context menu if it's open
    hideContextMenu();
}

/** Closes modals if the click target is the modal background */
export function closeModalOnClickOutside(event) {
    if (event.target.classList.contains('modal') && event.target.style.display !== 'none') {
        closeAllModals();
   }
}

// --- Context Menu ---

/**
 * Shows the context menu at the specified coordinates, configured for the target.
 * @param {number} x - Page X coordinate.
 * @param {number} y - Page Y coordinate.
 * @param {'file' | 'folder'} type - The type of item clicked.
 * @param {string} targetPath - The filename (for file) or folder path (for folder).
 */
export function showContextMenu(x, y, type, targetPath) {
    if (!domElements.contextMenu) return;

    // Configure items based on type
    if (type === 'file') {
        configureContextMenuForFile(targetPath);
    } else if (type === 'folder') {
        // Prevent menu on root (should be handled by caller, but double-check)
        if (targetPath === 'root') {
             hideContextMenu();
             return;
        }
        configureContextMenuForFolder(targetPath);
    } else {
        hideContextMenu(); // Hide if type is invalid
        return;
    }

    // Position and show
    domElements.contextMenu.style.left = `${x}px`;
    domElements.contextMenu.style.top = `${y}px`;
    domElements.contextMenu.style.display = 'block';

    // Store target info on the menu itself for action handlers
    domElements.contextMenu.dataset.targetType = type;
    domElements.contextMenu.dataset.targetPath = targetPath;
}

/** Hides the context menu */
export function hideContextMenu() {
    if (domElements.contextMenu) {
        domElements.contextMenu.style.display = 'none';
    }
}

/** Hides context menu if a click occurs outside of it */
export function hideContextMenuOnClickOutside(event) {
    if (domElements.contextMenu.style.display === 'block' && !domElements.contextMenu.contains(event.target)) {
         hideContextMenu();
    }
}

/** Configures context menu items visibility for a file target */
function configureContextMenuForFile(fileName) {
    domElements.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        const action = item.dataset.action;
        switch (action) {
            case 'rename':
            case 'delete':
            case 'copy':
            case 'cut':
                item.style.display = 'flex'; // Show (use flex for icon alignment)
                break;
            case 'paste':
                 item.style.display = 'none'; // Cannot paste onto a file
                break;
            default:
                item.style.display = 'none'; // Hide unknown actions
        }
    });
}

/** Configures context menu items visibility for a folder target */
function configureContextMenuForFolder(folderPath) {
    const clipboard = state.getClipboard();
    const canPaste = clipboard !== null; // Enable paste if clipboard has content

    domElements.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        const action = item.dataset.action;
        switch (action) {
            case 'rename':
            case 'delete':
                item.style.display = 'flex'; // Always show for non-root folders
                break;
            case 'copy':
            case 'cut':
                 item.style.display = 'none'; // Folder copy/cut not implemented yet
                break;
            case 'paste':
                item.style.display = canPaste ? 'flex' : 'none'; // Show only if clipboard has data
                break;
            default:
                item.style.display = 'none'; // Hide unknown actions
        }
    });
}

// --- GitHub Repo Browser UI ---

/**
 * Populates the GitHub file browser list in its modal.
 * @param {Array} items - Array of file/dir objects from GitHub API.
 * @param {string} owner - Repo owner.
 * @param {string} repo - Repo name.
 * @param {string} branch - Repo branch.
 * @param {string} currentPath - The current path being browsed within the repo.
 * @param {HTMLElement} parentElement - The UL element to append items to.
 * @param {number} [level=0] - Indentation level.
 */
export async function populateRepoFileList(items, owner, repo, branch, currentPath, parentElement, level = 0) {
    // Sort: directories first, then files, alphabetically
    items.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
    });

     parentElement.innerHTML = ''; // Clear previous content for this level

    for (const item of items) {
        const itemElement = document.createElement('li');
        itemElement.className = 'repo-file-item';
        itemElement.style.paddingLeft = `${level * 15 + 5}px`; // Indentation

        const fullItemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        const uniqueIdSuffix = fullItemPath.replace(/[^a-zA-Z0-9_-]/g, '-'); // Sanitize path for ID

        if (item.type === 'file') {
            const checkboxId = `gh-cb-${uniqueIdSuffix}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'repo-file-checkbox';
            checkbox.dataset.path = fullItemPath;
            checkbox.dataset.url = item.download_url;
            checkbox.id = checkboxId;

            const label = document.createElement('label');
            // Simple file icon using text for now
            label.textContent = `📄 ${item.name}`;
            label.setAttribute('for', checkboxId);
            label.style.cursor = 'pointer';

            itemElement.appendChild(checkbox);
            itemElement.appendChild(label);

        } else if (item.type === 'dir') {
            // Create folder container
            itemElement.classList.add('repo-folder-item');
            
            // Add a checkbox for folder selection
            const checkboxId = `gh-folder-cb-${uniqueIdSuffix}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'repo-folder-checkbox';
            checkbox.dataset.path = fullItemPath;
            checkbox.dataset.apiUrl = item.url;
            checkbox.dataset.type = 'folder';
            checkbox.id = checkboxId;
            checkbox.style.marginRight = '5px';
            
            // Don't propagate click events from checkbox to avoid toggling the folder
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            
            // Create folder label and container for the expand/collapse UI
            const folderContainer = document.createElement('span');
            folderContainer.dataset.path = fullItemPath;
            folderContainer.dataset.apiUrl = item.url;
            folderContainer.style.fontWeight = 'bold';
            folderContainer.style.cursor = 'pointer';
            folderContainer.textContent = `▶ 📁 ${item.name}`; // Collapsed state indicator
            folderContainer.dataset.expanded = 'false';
            folderContainer.id = `gh-folder-${uniqueIdSuffix}`;
            
            // Add the components to the list item
            itemElement.appendChild(checkbox);
            itemElement.appendChild(folderContainer);
            
            // Click handler on the folder container for expand/collapse
            folderContainer.addEventListener('click', async (e) => {
                e.stopPropagation();
                const targetElement = e.currentTarget;
                const isExpanded = targetElement.dataset.expanded === 'true';
                const sublistId = `gh-sublist-${uniqueIdSuffix}`;
                let sublist = document.getElementById(sublistId);

                if (isExpanded) {
                    // Collapse
                    if (sublist) sublist.remove();
                    targetElement.dataset.expanded = 'false';
                    targetElement.textContent = `▶ 📁 ${item.name}`;
                } else {
                    // Expand
                    if (sublist) sublist.remove(); // Remove old one if exists

                    sublist = document.createElement('ul');
                    sublist.id = sublistId;
                    sublist.style.listStyle = 'none';
                    sublist.style.padding = '0';
                    sublist.style.margin = '0';
                    targetElement.parentNode.insertBefore(sublist, targetElement.nextSibling);

                    // Show temporary loading state inside sublist
                    const loadingLi = document.createElement('li');
                    loadingLi.textContent = 'Loading...';
                    loadingLi.style.paddingLeft = `${(level + 1) * 15 + 5}px`;
                    loadingLi.style.fontStyle = 'italic';
                    sublist.appendChild(loadingLi);

                    targetElement.textContent = `▼ 📁 ${item.name}`; // Show expanded icon immediately
                    targetElement.dataset.expanded = 'true';

                    try {
                        const apiUrl = targetElement.dataset.apiUrl;
                        if (!apiUrl) throw new Error("Missing API URL.");

                        const { fetchGitHubDirectoryContents } = await import('./io.js'); 
                        const dirContents = await fetchGitHubDirectoryContents(apiUrl);

                        // Populate the sublist recursively
                        await populateRepoFileList(dirContents, owner, repo, branch, fullItemPath, sublist, level + 1);
                    } catch (error) {
                        console.error(`Error expanding GitHub directory ${fullItemPath}:`, error);
                        if (sublist) {
                           sublist.innerHTML = ''; // Clear loading message
                           const errorLi = document.createElement('li');
                           errorLi.textContent = `Error: ${error.message}`;
                           errorLi.style.color = 'red';
                           errorLi.style.paddingLeft = `${(level + 1) * 15 + 5}px`;
                           sublist.appendChild(errorLi);
                        }
                    }
                }
            });
        }
        parentElement.appendChild(itemElement);
    }
}

/**
 * Displays the initial welcome message in the editor.
 */
export function showWelcomeMessage() {
    const editor = state.getEditorInstance();
    if (!editor) {
        console.warn("UI: Cannot show welcome message, editor not ready.");
        return;
    }
    const welcomeContent = `// Welcome to Quick Edit (QE)
// A lightweight, client-side code editor.
//
// Get started:
// 1. Use 'Import' to load files/folders, fetch from URL/GitHub.
// 2. Use 'New File' or 'New Folder' to start from scratch.
// 3. Drag and drop files/folders onto the 'Import' dropzone.
//
// Features:
// - Monaco-powered editor with syntax highlighting.
// - File/Folder management (create, rename, delete, move).
// - Session auto-save to browser's local storage.
// - Download individual files (Ctrl/Cmd+S) or the entire workspace as a ZIP.
//
// Note: All data is stored locally in your browser.`;

    // Check if a model already exists and dispose if necessary (e.g., from a failed restore)
    const currentModel = editor.getModel();
    if (currentModel && !state.getCurrentFile()) { // Only dispose if no file is meant to be open
         console.log("Disposing existing model before showing welcome message.");
         currentModel.dispose();
    }

    // Create a temporary, read-only model for the welcome message
    const model = monaco.editor.createModel(welcomeContent, 'markdown'); // Use markdown for better formatting
    editor.setModel(model);
     // Make it read-only
     // editor.updateOptions({ readOnly: true }); // Causes issues if user immediately tries to create/open file

    // Update UI elements
    updateStatusBarLanguage('Info');
    updateStatusBarCursor(1, 1);
    if(domElements.downloadBtn) domElements.downloadBtn.disabled = true;
    state.setCurrentFile(null); // Ensure no file is marked as current
}


// --- UI Event Listener Setup ---
// This function is called from main.js to attach listeners to UI elements.
export function setupUIEventListeners() {
    // Toolbar Buttons
    domElements.importBtn?.addEventListener('click', showImportModal);
    domElements.downloadBtn?.addEventListener('click', async () => { // Needs to call io.downloadCurrentFile
        const { downloadCurrentFile } = await import('../io.js');
        downloadCurrentFile();
    });
    domElements.newFileBtn?.addEventListener('click', showNewFileModal);
    domElements.newFolderBtn?.addEventListener('click', showNewFolderModal);
    domElements.downloadAllBtn?.addEventListener('click', () => {
         if (Object.keys(state.getFiles()).length === 0) {
            showMessage("Workspace is empty, nothing to download.", 'info');
            return;
        }
        showDownloadWorkspaceModal();
    });

    // Sidebar
    domElements.sidebarToggle?.addEventListener('click', toggleSidebar);
    domElements.collapseAllBtn?.addEventListener('click', () => {
        collapseAllFolders();
    });

    // Modals - Close buttons
    document.querySelectorAll('.modal .modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) hideModal(modal);
        });
    });

    // Modals - Action buttons (using handlers from events module)
    domElements.createFileBtn?.addEventListener('click', () => {
        const fileName = domElements.newFileName.value.trim();
        const folderPath = domElements.newFileFolder.value;
        // Call the actual function from the filesystem module
        createNewFile(fileName, folderPath);
        // Close the modal
        hideModal(domElements.newFileModal);
    });
    
    domElements.createFolderBtn?.addEventListener('click', () => {
        const folderName = domElements.newFolderName.value.trim();
        const parentPath = domElements.newFolderParent.value;
        // Call the actual function from the filesystem module
        createNewFolder(folderName, parentPath);
        // Close the modal
        hideModal(domElements.newFolderModal);
    });
    
    domElements.downloadWorkspaceBtn?.addEventListener('click', () => {
        const workspaceName = domElements.workspaceName.value.trim() || 'qe-workspace';
        downloadWorkspace(workspaceName);
        hideModal(domElements.downloadWorkspaceModal);
    });
    
    domElements.importUrlBtn?.addEventListener('click', () => {
        const url = domElements.importUrlInput.value.trim();
        if (!url) {
            showMessage('Please enter a URL', 'error');
            return;
        }
        const isZip = domElements.urlTypeZip?.checked || false;
        handleImportUrl(url, isZip);
        hideModal(domElements.importModal);
    });
    
    domElements.importRepoBtn?.addEventListener('click', () => {
        const repo = domElements.importRepoInput.value.trim();
        if (!repo) {
            showMessage('Please enter a repository', 'error');
            return;
        }
        handleImportRepo(repo);
        hideModal(domElements.importModal);
    });
    
    domElements.loadGithubFilesBtn?.addEventListener('click', () => {
        loadSelectedGitHubFiles();
        // Modal is typically closed within the loadSelectedGitHubFiles function
    });
    
    domElements.importFilesBtn?.addEventListener('click', () => {
        domElements.fileUpload?.click(); // Trigger the hidden file input
    });
    
    domElements.importFolderChooserBtn?.addEventListener('click', () => {
        domElements.folderUpload?.click(); // Trigger the hidden folder input
    });

    // File and Folder Upload Inputs
    domElements.fileUpload?.addEventListener('change', handleFileUpload);
    domElements.folderUpload?.addEventListener('change', handleFolderUpload);

    // Modals - Enter key submission
    domElements.newFileName?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            const fileName = domElements.newFileName.value.trim();
            const folderPath = domElements.newFileFolder.value;
            createNewFile(fileName, folderPath);
            hideModal(domElements.newFileModal);
        }
    });
    
    domElements.newFolderName?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            const folderName = domElements.newFolderName.value.trim();
            const parentPath = domElements.newFolderParent.value;
            createNewFolder(folderName, parentPath);
            hideModal(domElements.newFolderModal);
        }
    });
    
    domElements.workspaceName?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            const workspaceName = domElements.workspaceName.value.trim() || 'qe-workspace';
            downloadWorkspace(workspaceName);
            hideModal(domElements.downloadWorkspaceModal);
        }
    });
    
    domElements.importUrlInput?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            const url = domElements.importUrlInput.value.trim();
            if (!url) {
                showMessage('Please enter a URL', 'error');
                return;
            }
            const isZip = domElements.urlTypeZip?.checked || false;
            handleImportUrl(url, isZip);
            hideModal(domElements.importModal);
        }
    });
    
    domElements.importRepoInput?.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            const repo = domElements.importRepoInput.value.trim();
            if (!repo) {
                showMessage('Please enter a repository', 'error');
                return;
            }
            handleImportRepo(repo);
            hideModal(domElements.importModal);
        }
    });

    // Context Menu Items (delegated to contextMenuHandler.js)
     domElements.contextMenu?.querySelectorAll('.context-menu-item').forEach(item => {
         item.addEventListener('click', async (event) => {
             const { handleContextMenuAction } = await import('./events/contextMenuHandler.js');
             handleContextMenuAction(event);
         });
     });

     // Import Dropzone (specific listeners handled in io.js setup)

    console.log("UI Event listeners set up.");
}

// --- Event Handlers for File Tree Items ---

/**
 * Handles right-click on file/folder items to show context menu.
 * @param {MouseEvent} event - The contextmenu event.
 */
function handleContextMenuTrigger(event) {
    event.preventDefault(); // Prevent default browser context menu
    event.stopPropagation(); // Prevent bubbling to parent elements
    
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    const type = targetElement.dataset.type; // 'file' or 'folder'
    const targetPath = type === 'file' 
        ? targetElement.dataset.filename 
        : targetElement.dataset.path;
        
    if (!targetPath) return;
    
    // Don't show context menu for root
    if (type === 'folder' && targetPath === 'root') return;
    
    // Position and show context menu
    const x = event.pageX;
    const y = event.pageY;
    showContextMenu(x, y, type, targetPath);
}

/**
 * Handles drag start event for file/folder items.
 * @param {DragEvent} event - The dragstart event.
 */
function handleDragStart(event) {
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    const type = targetElement.dataset.type; // 'file' or 'folder'
    const path = type === 'file' 
        ? targetElement.dataset.filename 
        : targetElement.dataset.path;
        
    if (!path) return;
    
    // Don't allow dragging root
    if (type === 'folder' && path === 'root') {
        event.preventDefault();
        return;
    }
    
    // Set drag data
    event.dataTransfer.setData('application/qe-item', JSON.stringify({
        type: type,
        path: path,
        sourcePath: type === 'file' ? state.getFilePath(path) : state.getFolder(path)?.path
    }));
    
    event.dataTransfer.effectAllowed = 'move';
    
    // Visual feedback
    targetElement.classList.add('dragging');
    
    // Set a transparent drag image to improve UX
    const dragIcon = target.cloneNode(true);
    dragIcon.style.opacity = '0.7';
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    event.dataTransfer.setDragImage(dragIcon, 0, 0);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
}

/**
 * Handles dragover event for file/folder items.
 * @param {DragEvent} event - The dragover event.
 */
function handleDragOver(event) {
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    // Only allow dropping onto folders
    if (targetElement.dataset.type !== 'folder') return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    // Visual feedback
    targetElement.classList.add('drag-over');
}

/**
 * Handles dragleave event for file/folder items.
 * @param {DragEvent} event - The dragleave event.
 */
function handleDragLeave(event) {
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    // Remove visual feedback
    targetElement.classList.remove('drag-over');
}

/**
 * Handles drop event for file/folder items.
 * @param {DragEvent} event - The drop event.
 */
function handleDrop(event) {
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    // Only allow dropping onto folders
    if (targetElement.dataset.type !== 'folder') return;
    
    event.preventDefault();
    
    // Remove visual feedback
    targetElement.classList.remove('drag-over');
    
    try {
        const data = JSON.parse(event.dataTransfer.getData('application/qe-item'));
        const targetFolder = targetElement.dataset.path;
        
        if (!data || !targetFolder) return;
        
        // Don't allow dropping onto itself or its own child
        if (data.type === 'folder' && 
            (data.path === targetFolder || 
             targetFolder.startsWith(data.path + '/'))) {
            showMessage("Cannot move a folder into itself", 'error');
            return;
        }
        
        // Perform the move operation
        if (data.type === 'file') {
            // Move file to target folder
            const sourceFolder = data.sourcePath;
            if (sourceFolder === targetFolder) return; // No change
            
            // Use filesystem module to move file
            moveFile(data.path, sourceFolder, targetFolder);
        } else if (data.type === 'folder') {
            // Move folder to target folder
            const sourceParentPath = data.path.includes('/') 
                ? data.path.substring(0, data.path.lastIndexOf('/')) 
                : 'root';
                
            if (sourceParentPath === targetFolder) return; // No change
            
            // Use filesystem module to move folder
            moveFolder(data.path, targetFolder);
        }
        
    } catch (error) {
        console.error("Error processing drop:", error);
        showMessage("Error moving item", 'error');
    }
}

/**
 * Handles dragend event for file/folder items.
 * @param {DragEvent} event - The dragend event.
 */
function handleDragEnd(event) {
    const target = event.currentTarget;
    const targetElement = target.classList.contains('folder-item-header') 
        ? target.closest('.folder-item') 
        : target;
        
    if (!targetElement) return;
    
    // Remove visual feedback
    targetElement.classList.remove('dragging');
    
    // Clean up any remaining drag-over classes in the tree
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

/**
 * Moves a file from one folder to another.
 * Basic implementation - in a real app, this would update the file system structure.
 * @param {string} fileName - The name of the file to move.
 * @param {string} sourceFolder - The source folder path.
 * @param {string} targetFolder - The target folder path.
 */
function moveFile(fileName, sourceFolder, targetFolder) {
    console.log(`Moving file ${fileName} from ${sourceFolder} to ${targetFolder}`);
    
    try {
        // Get the file data
        const fileData = state.getFile(fileName);
        if (!fileData || !fileData.model) {
            showMessage(`Cannot move file: ${fileName} not found`, 'error');
            return;
        }
        
        // Remove from source folder
        const sourceData = state.getFolder(sourceFolder);
        if (sourceData) {
            sourceData.files = sourceData.files.filter(f => f !== fileName);
        }
        
        // Add to target folder
        const targetData = state.getFolder(targetFolder);
        if (targetData) {
            if (!targetData.files.includes(fileName)) {
                targetData.files.push(fileName);
            }
        }
        
        // Update file path in the state
        state.setFilePath(fileName, targetFolder);
        
        // Update UI
        renderFileTree();
        showMessage(`Moved ${fileName} to ${targetFolder === 'root' ? 'Root' : state.getFolder(targetFolder)?.name}`, 'success');
        
    } catch (error) {
        console.error(`Error moving file ${fileName}:`, error);
        showMessage(`Error moving file: ${error.message}`, 'error');
    }
}

/**
 * Moves a folder from one location to another.
 * Basic implementation - in a real app, this would update the file system structure.
 * @param {string} folderPath - The path of the folder to move.
 * @param {string} targetFolder - The target folder path.
 */
function moveFolder(folderPath, targetFolder) {
    console.log(`Moving folder ${folderPath} to ${targetFolder}`);
    
    try {
        // Get the folder data
        const folderData = state.getFolder(folderPath);
        if (!folderData) {
            showMessage(`Cannot move folder: ${folderPath} not found`, 'error');
            return;
        }
        
        // Calculate new path
        const folderName = folderData.name;
        const newPath = targetFolder === 'root' ? folderName : `${targetFolder}/${folderName}`;
        
        // Check if destination already has a folder with same name
        if (state.getFolder(newPath)) {
            showMessage(`Cannot move folder: destination already has a folder named ${folderName}`, 'error');
            return;
        }
        
        // Remove from source parent's subfolders
        const sourceParentPath = folderPath.includes('/') 
            ? folderPath.substring(0, folderPath.lastIndexOf('/')) 
            : 'root';
            
        const sourceParent = state.getFolder(sourceParentPath);
        if (sourceParent) {
            sourceParent.subfolders = sourceParent.subfolders.filter(f => f !== folderPath);
        }
        
        // Add to target's subfolders
        const targetData = state.getFolder(targetFolder);
        if (targetData) {
            targetData.subfolders.push(newPath);
        }
        
        // Update the folder path itself and all its children recursively
        updateFolderPath(folderPath, newPath);
        
        // Update UI
        renderFileTree();
        showMessage(`Moved folder ${folderName} to ${targetFolder === 'root' ? 'Root' : state.getFolder(targetFolder)?.name}`, 'success');
        
    } catch (error) {
        console.error(`Error moving folder ${folderPath}:`, error);
        showMessage(`Error moving folder: ${error.message}`, 'error');
    }
}

/**
 * Recursively updates a folder's path and all its children when moving.
 * @param {string} oldPath - The original folder path.
 * @param {string} newPath - The new folder path.
 */
function updateFolderPath(oldPath, newPath) {
    // Get the folder data
    const folderData = state.getFolder(oldPath);
    if (!folderData) return;
    
    // Create a copy of the folder data with the new path
    const updatedFolder = {
        ...folderData,
        path: newPath
    };
    
    // Add the folder with the new path and remove the old one
    state.addOrUpdateFolder(newPath, updatedFolder);
    state.removeFolder(oldPath);
    
    // Update file paths for all files in this folder
    folderData.files.forEach(fileName => {
        state.setFilePath(fileName, newPath);
    });
    
    // Recursively update paths for all subfolders
    const subfolders = [...folderData.subfolders]; // Create a copy to avoid modification during iteration
    subfolders.forEach(subfolderPath => {
        const subfolderName = subfolderPath.substring(subfolderPath.lastIndexOf('/') + 1);
        const newSubfolderPath = `${newPath}/${subfolderName}`;
        
        // Update the subfolder list in the parent
        updatedFolder.subfolders = updatedFolder.subfolders.filter(f => f !== subfolderPath);
        updatedFolder.subfolders.push(newSubfolderPath);
        
        // Recursively update the subfolder
        updateFolderPath(subfolderPath, newSubfolderPath);
    });
}