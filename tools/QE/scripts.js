// Global state
const state = {
    files: {}, // file name -> { model, viewState, language, path }
    folders: {}, // folder path -> { name, files: [], subfolders: [], path }
    fileStructure: null, // Root folder object, initialized later
    currentFile: null, // Name of the currently active file
    editor: null, // Monaco editor instance
    isLoading: false,
    sidebarVisible: true,
    clipboard: null, // { type: 'copy'/'cut', fileName, content, language, sourcePath? }
    lastUsedFolder: 'root', // Default folder for new files
    autoSaveInterval: null, // Interval ID for auto-saves
    sessionSaved: false, // Flag to track if session has been saved
    lastSaveTime: null, // Timestamp of the last save
    sessionKey: 'eq-editor-session', // LocalStorage key for session data
    filePaths: {}, // Map of file names to their folder paths (e.g., 'myFile.js': 'src/utils')
    autoSaveTimeout: null // Timeout ID for debounced auto-save
};

// DOM Elements (Cached Selectors)
const dom = {
    downloadBtn: document.getElementById('download-btn'),
    fileList: document.getElementById('file-list'),
    loadingIndicator: document.getElementById('loading'),
    messageBox: document.getElementById('message-box'),
    githubModal: document.getElementById('github-modal'),
    repoFileList: document.getElementById('repo-file-list'),
    loadGithubFiles: document.getElementById('load-github-files'),
    repoInfo: document.getElementById('repo-info'),
    languageMode: document.getElementById('language-mode'),
    cursorPosition: document.getElementById('cursor-position'),
    sidebarToggle: document.querySelector('.sidebar-toggle'),
    mainContainer: document.querySelector('.main-container'),
    sessionRecoveryModal: document.getElementById('session-recovery-modal'),
    sessionDetails: document.getElementById('session-details'),
    newSessionBtn: document.getElementById('new-session-btn'),
    recoverSessionBtn: document.getElementById('recover-session-btn'),
    contextMenu: document.getElementById('context-menu'),
    newFileBtn: document.getElementById('new-file-btn'),
    newFolderBtn: document.getElementById('new-folder-btn'),
    downloadAllBtn: document.getElementById('download-all-btn'),
    newFileModal: document.getElementById('new-file-modal'),
    newFolderModal: document.getElementById('new-folder-modal'),
    folderImportModal: document.getElementById('folder-import-modal'),
    downloadWorkspaceModal: document.getElementById('download-workspace-modal'),
    newFileName: document.getElementById('new-file-name'),
    newFileFolder: document.getElementById('new-file-folder'),
    createFileBtn: document.getElementById('create-file-btn'),
    newFolderName: document.getElementById('new-folder-name'),
    newFolderParent: document.getElementById('new-folder-parent'),
    createFolderBtn: document.getElementById('create-folder-btn'),
    importFolderParent: document.getElementById('import-folder-parent'),
    importFolderBtn: document.getElementById('import-folder-btn'),
    workspaceName: document.getElementById('workspace-name'),
    downloadWorkspaceBtn: document.getElementById('download-workspace-btn'),
    importBtn: document.getElementById('import-btn'),
    importModal: document.getElementById('import-modal'),
    importModalClose: document.getElementById('import-modal-close'),
    importDropzone: document.getElementById('import-dropzone'),
    importUrlInput: document.getElementById('import-url-input'),
    importUrlBtn: document.getElementById('import-url-btn'),
    importRepoInput: document.getElementById('import-repo-input'),
    importRepoBtn: document.getElementById('import-repo-btn'),
    // New elements for file/folder import
    fileUpload: document.getElementById('file-upload'),
    folderUpload: document.getElementById('folder-upload'),
    importFilesBtn: document.getElementById('import-files-btn'),
    importFolderChooserBtn: document.getElementById('import-folder-chooser-btn'),
    urlTypeFile: document.querySelector('input[name="url-type"][value="file"]'),
    urlTypeZip: document.querySelector('input[name="url-type"][value="zip"]')
};

// --- Monaco Editor Initialization ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    // Create editor instance
    state.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        theme: 'vs-dark',
        automaticLayout: true, // Ensures editor resizes correctly
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'on' // Enable word wrap by default
    });

    // --- Editor Event Listeners ---
    // Update cursor position in status bar
    state.editor.onDidChangeCursorPosition((e) => {
        if (e.position) { // Check if position exists
           const position = e.position;
           dom.cursorPosition.textContent = `Line: ${position.lineNumber}, Col: ${position.column}`;
        }
    });

    // Detect content changes for auto-save
    state.editor.onDidChangeModelContent(() => {
        if (state.currentFile) {
            // Debounce auto-save: Save 2 seconds after user stops typing
            clearTimeout(state.autoSaveTimeout);
            state.autoSaveTimeout = setTimeout(() => {
                saveSessionToStorage();
            }, 2000);
        }
    });

    // --- Keyboard Shortcuts ---
    // Ctrl+S / Cmd+S for downloading current file
    state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (state.currentFile) {
            downloadCurrentFile();
        }
    });

    // --- Application Initialization ---
    initFileStructure();
    // Ensure event listeners are attached after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    checkForPreviousSession(); // Check for saved session data
    setupAutoSave(); // Start periodic auto-save timer

    // Initial render of the file tree (might be empty)
    renderFileTree();
}); // End of Monaco require callback


// --- File Structure and State Initialization ---
function initFileStructure() {
    // Initialize root folder
    state.folders = {
        'root': {
            name: 'root', // Special name for the root
            files: [],
            subfolders: [],
            path: 'root' // Path identifier
        }
    };
    // Set the main file structure reference
    state.fileStructure = state.folders['root'];
    // Reset file paths map
    state.filePaths = {};
}

// --- Auto Save and Session Management ---
function setupAutoSave() {
    // Auto-save every 30 seconds if changes were made
    state.autoSaveInterval = setInterval(() => {
        // We rely on the debounced save from onDidChangeModelContent
        // This interval acts as a fallback or periodic save
        // Consider only saving if state.sessionSaved is false? Or compare timestamps?
        // For simplicity, let's just call saveSessionToStorage here too.
        saveSessionToStorage();
    }, 30000);

    // Save session when the user is leaving the page
    window.addEventListener('beforeunload', () => {
        // Save immediately before closing
        clearTimeout(state.autoSaveTimeout); // Clear any pending debounced save
        saveSessionToStorage();
        // Note: We can't *guarantee* this runs fully, but it's the best effort.
    });
}

function checkForPreviousSession() {
    try {
        const sessionData = localStorage.getItem(state.sessionKey);
        if (!sessionData) {
            showWelcomeMessage(); // No session found, show default message
            return;
        }

        const savedSession = JSON.parse(sessionData);
        if (!savedSession || !savedSession.timestamp || !savedSession.fileContents) {
             // Invalid or incomplete session data
            console.warn("Invalid session data found in localStorage.");
            localStorage.removeItem(state.sessionKey); // Clear invalid data
            showWelcomeMessage();
            return;
        }

        const savedDate = new Date(savedSession.timestamp);
        const fileCount = Object.keys(savedSession.fileContents).length;

        // If no files were saved, treat as a new session
        if (fileCount === 0) {
             localStorage.removeItem(state.sessionKey); // Clear empty session
             showWelcomeMessage();
             return;
        }

        // Populate and show the recovery modal
        dom.sessionDetails.textContent = `Last saved: ${savedDate.toLocaleString()}\nFiles: ${fileCount}${savedSession.currentFile ? `\nLast open: ${savedSession.currentFile}` : ''}`;
        dom.sessionRecoveryModal.style.display = 'flex';

        // Handle modal button clicks (use .once to avoid multiple listeners if modal shown again)
        dom.newSessionBtn.addEventListener('click', () => {
            clearSessionData(); // Clear storage
            initFileStructure(); // Re-initialize state
            renderFileTree(); // Update UI
            dom.sessionRecoveryModal.style.display = 'none';
            showWelcomeMessage();
        }, { once: true });

        dom.recoverSessionBtn.addEventListener('click', () => {
            restoreSessionFromStorage(savedSession); // Restore using parsed data
            dom.sessionRecoveryModal.style.display = 'none';
        }, { once: true });

    } catch (error) {
        console.error("Error checking for previous session:", error);
        localStorage.removeItem(state.sessionKey); // Clear potentially corrupted data
        showWelcomeMessage();
    }
}

function showWelcomeMessage() {
    const welcomeContent = `// Welcome to Quick Edit (QE)
//
// Get started by:
// 1. Uploading files or folders using the buttons above.
// 2. Fetching a file from a URL.
// 3. Browsing and importing files from a GitHub repo.
// 4. Creating a new file or folder.
//
// Your work is saved locally in your browser.
// Use Ctrl+S / Cmd+S to download the current file.
// Use the "Download Workspace" button to get a ZIP.`;

    // Check if editor is initialized
    if (state.editor) {
        // Create a temporary model for the welcome message
        const model = monaco.editor.createModel(welcomeContent, 'plaintext');
        state.editor.setModel(model);
        dom.languageMode.textContent = 'Plaintext';
        dom.cursorPosition.textContent = 'Line: 1, Col: 1';
        dom.downloadBtn.disabled = true; // Can't download the welcome message
        state.currentFile = null; // Ensure no file is marked as current
    } else {
        // Fallback if editor isn't ready yet (shouldn't happen with current flow)
        console.warn("Editor not ready for welcome message.");
    }
}

function saveSessionToStorage() {
    // Avoid saving if the editor isn't ready or if there are no files
    if (!state.editor || Object.keys(state.files).length === 0) {
        // console.log("Skipping save: No files or editor not ready.");
        return;
    }

    try {
        // Ensure current file's view state is saved before switching models temporarily
        if (state.currentFile && state.files[state.currentFile]) {
             state.files[state.currentFile].viewState = state.editor.saveViewState();
        }

        const fileContents = {};
        Object.keys(state.files).forEach(fileName => {
            const fileData = state.files[fileName];
            // Ensure the model exists before trying to get its value
            if (fileData && fileData.model) {
                fileContents[fileName] = {
                    content: fileData.model.getValue(),
                    language: fileData.language,
                    path: state.filePaths[fileName] || 'root', // Save the path
                    // Don't save viewState here, it's complex and might not be serializable well
                };
            } else {
                console.warn(`Skipping file ${fileName} during save: Model not found.`);
            }
        });

        // If after checking, there are no valid file contents, don't save an empty session
        if (Object.keys(fileContents).length === 0) {
             // console.log("Skipping save: No valid file contents.");
             // Optionally clear old session data if it exists
             // localStorage.removeItem(state.sessionKey);
             return;
        }

        const sessionData = {
            fileContents,
            folders: state.folders, // Save folder structure
            // fileStructure is derived from folders, maybe don't need to save both?
            // Let's save folders only, and rebuild structure on restore if needed.
            currentFile: state.currentFile,
            lastUsedFolder: state.lastUsedFolder,
            timestamp: new Date().toISOString(),
            // Add sidebar state
            sidebarVisible: state.sidebarVisible
        };

        localStorage.setItem(state.sessionKey, JSON.stringify(sessionData));
        state.lastSaveTime = new Date();
        state.sessionSaved = true; // Mark session as saved (could be used by interval)
        // console.log("Session saved at", state.lastSaveTime.toLocaleTimeString());

        // Optional: Show a subtle save indicator (e.g., in status bar)
        // showSaveIndicator();

    } catch (error) {
        console.error("Failed to save session:", error);
        showMessage("Error saving session to local storage", 'error');
    }
}

function restoreSessionFromStorage(savedSession) { // Pass parsed data
    try {
        // Restore folders and structure
        if (savedSession.folders) {
            state.folders = savedSession.folders;
            // Ensure root exists if somehow missing
            if (!state.folders['root']) {
                 state.folders['root'] = { name: 'root', files: [], subfolders: [], path: 'root' };
            }
            state.fileStructure = state.folders['root']; // Reset reference
        } else {
            // If no folder data, initialize fresh
            initFileStructure();
        }

        // Restore last used folder
        state.lastUsedFolder = savedSession.lastUsedFolder || 'root';

        // Restore files
        state.files = {}; // Clear existing files state
        state.filePaths = {}; // Clear existing paths map

        if (savedSession.fileContents) {
            Object.keys(savedSession.fileContents).forEach(fileName => {
                const fileData = savedSession.fileContents[fileName];
                if (fileData && typeof fileData.content === 'string') { // Basic validation
                    const model = monaco.editor.createModel(
                        fileData.content,
                        fileData.language || getLanguageForFile(fileName) // Fallback language detection
                    );

                    state.files[fileName] = {
                        model,
                        viewState: null, // View state is not saved/restored currently
                        language: fileData.language || getLanguageForFile(fileName),
                        path: fileData.path || 'root' // Restore path
                    };

                    // Populate file paths map
                    state.filePaths[fileName] = fileData.path || 'root';

                    // Ensure file is listed in its folder (consistency check)
                     const folderPath = fileData.path || 'root';
                     if (state.folders[folderPath] && !state.folders[folderPath].files.includes(fileName)) {
                         state.folders[folderPath].files.push(fileName);
                     } else if (!state.folders[folderPath]) {
                         console.warn(`Folder ${folderPath} for file ${fileName} not found during restore. Placing in root.`);
                         state.filePaths[fileName] = 'root';
                         state.files[fileName].path = 'root';
                         if (!state.folders['root'].files.includes(fileName)) {
                            state.folders['root'].files.push(fileName);
                         }
                     }

                } else {
                    console.warn(`Skipping invalid file data for ${fileName} during restore.`);
                }
            });
        }

        // Restore sidebar state
        state.sidebarVisible = savedSession.sidebarVisible !== undefined ? savedSession.sidebarVisible : true;
        if (!state.sidebarVisible) {
            dom.mainContainer.classList.add('sidebar-hidden');
            dom.sidebarToggle.textContent = '→';
        } else {
             dom.mainContainer.classList.remove('sidebar-hidden');
             dom.sidebarToggle.textContent = '←';
        }
        // Trigger layout update after potential sidebar change
        if (state.editor) {
            state.editor.layout();
        }


        // Render the file tree with restored structure
        renderFileTree();

        // Open the previously active file, if possible
        let fileToOpen = null;
        if (savedSession.currentFile && state.files[savedSession.currentFile]) {
            fileToOpen = savedSession.currentFile;
        } else if (Object.keys(state.files).length > 0) {
            // Otherwise, open the first file found (order isn't guaranteed)
            fileToOpen = Object.keys(state.files)[0];
        }

        if (fileToOpen) {
            openFile(fileToOpen);
        } else {
            // If no files were restored or could be opened, show welcome message
            showWelcomeMessage();
        }

        showMessage(`Restored session with ${Object.keys(state.files).length} file(s)`, 'success');

    } catch (error) {
        console.error("Failed to restore session:", error);
        showMessage("Error restoring previous session. Starting fresh.", 'error');
        clearSessionData(); // Clear corrupted data
        initFileStructure(); // Reset state
        renderFileTree();
        showWelcomeMessage();
    }
}

function clearSessionData() {
    localStorage.removeItem(state.sessionKey);
    // Don't show message here, handled by caller context usually
    // showMessage("Previous session data cleared", 'info');
}

// --- Event Listener Setup ---
function setupEventListeners() {
    // Download Current File Button
    if (dom.downloadBtn) {
        dom.downloadBtn.addEventListener('click', downloadCurrentFile);
    }

    // Load Selected GitHub Files Button (in modal)
    if (dom.loadGithubFiles) {
        dom.loadGithubFiles.addEventListener('click', loadSelectedGitHubFiles);
    }

    // New File Button (opens modal)
    if (dom.newFileBtn) {
        dom.newFileBtn.addEventListener('click', () => {
            populateFolderDropdown(dom.newFileFolder, state.lastUsedFolder); // Pre-select last used folder
            dom.newFileName.value = ''; // Clear previous input
            dom.newFileModal.style.display = 'flex';
            dom.newFileName.focus(); // Focus the input field
        });
    }

    // New Folder Button (opens modal)
    if (dom.newFolderBtn) {
        dom.newFolderBtn.addEventListener('click', () => {
            populateFolderDropdown(dom.newFolderParent, state.lastUsedFolder); // Pre-select last used folder
            dom.newFolderName.value = ''; // Clear previous input
            dom.newFolderModal.style.display = 'flex';
            dom.newFolderName.focus(); // Focus the input field
        });
    }

    // Create New File Button (in modal)
    if (dom.createFileBtn) {
        dom.createFileBtn.addEventListener('click', createNewFile);
    }
    if (dom.newFileName) {
        dom.newFileName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createNewFile();
        });
    }

    // Create New Folder Button (in modal)
    if (dom.createFolderBtn) {
        dom.createFolderBtn.addEventListener('click', createNewFolder);
    }
    if (dom.newFolderName) {
        dom.newFolderName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createNewFolder();
        });
    }

    // Download Workspace Button (opens modal)
    if (dom.downloadAllBtn) {
        dom.downloadAllBtn.addEventListener('click', () => {
            // Only enable if there are files
            if (Object.keys(state.files).length === 0) {
                showMessage("Workspace is empty, nothing to download.", 'info');
                return;
            }
            // Suggest a default name based on the first folder or a default
            const firstFolder = state.folders['root']?.subfolders[0];
            dom.workspaceName.value = firstFolder ? state.folders[firstFolder]?.name || 'qe-workspace' : 'qe-workspace';
            dom.downloadWorkspaceModal.style.display = 'flex';
            dom.workspaceName.focus();
        });
    }

    // Download Workspace ZIP Button (in modal)
    if (dom.downloadWorkspaceBtn) {
        dom.downloadWorkspaceBtn.addEventListener('click', downloadWorkspace);
    }
    if (dom.workspaceName) {
        dom.workspaceName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') downloadWorkspace();
        });
    }

    // Select Folder to Import Button (triggers input click)
    if (dom.importFolderBtn) {
        dom.importFolderBtn.addEventListener('click', () => {
            dom.folderUpload.click(); // Trigger the hidden folder input
            // Modal is closed automatically after file selection starts or in handleFolderUpload
        });
    }

    // Sidebar Toggle Button
    if (dom.sidebarToggle) {
        dom.sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Global Click Listener (to close context menu)
    document.addEventListener('click', (e) => {
         // Close context menu if clicked outside of it
        if (dom.contextMenu.style.display === 'block' && !dom.contextMenu.contains(e.target)) {
             dom.contextMenu.style.display = 'none';
        }
        // Close modals if background overlay is clicked
        if (e.target.classList.contains('modal') && e.target.style.display !== 'none') {
             closeAllModals();
        }
    });

     // Global Keydown Listener (e.g., for Esc key to close modals)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            if (dom.contextMenu.style.display === 'block') {
                dom.contextMenu.style.display = 'none';
            }
        }
         // Manual Save Shortcut (Ctrl+Shift+S / Cmd+Shift+S)
        if (e.key === 'S' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
             e.preventDefault(); // Prevent browser's save page action
             saveSessionToStorage();
             showMessage("Session saved manually", 'success', 1500); // Shorter duration
        }
    });

    // Context Menu Listener (on file list)
    if (dom.fileList) {
        dom.fileList.addEventListener('contextmenu', handleContextMenu);
    }

    // Context Menu Item Click Handler
    dom.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', handleContextMenuAction);
    });

    // Modal Close Buttons
    document.querySelectorAll('.modal .modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // --- Import Modal Logic ---
    if (dom.importBtn) {
        dom.importBtn.addEventListener('click', () => {
            dom.importModal.style.display = 'flex';
            dom.importUrlInput.value = '';
            dom.importRepoInput.value = '';
        });
    }
    if (dom.importModalClose) {
        dom.importModalClose.addEventListener('click', () => {
            dom.importModal.style.display = 'none';
        });
    }
    if (dom.importModal) {
        dom.importModal.addEventListener('click', (e) => {
            if (e.target === dom.importModal) dom.importModal.style.display = 'none';
        });
    }
    if (dom.importDropzone) {
        dom.importDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.importDropzone.classList.add('dragover');
        });
        dom.importDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dom.importDropzone.classList.remove('dragover');
        });
        dom.importDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.importDropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleImportFiles(files);
                dom.importModal.style.display = 'none';
            }
        });
    }
    if (dom.importUrlBtn) {
        dom.importUrlBtn.addEventListener('click', () => {
            const url = dom.importUrlInput.value.trim();
            if (!url) return showMessage('Please enter a URL', 'error');
            dom.importModal.style.display = 'none';
            handleImportUrl(url);
        });
    }
    if (dom.importUrlInput) {
        dom.importUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') dom.importUrlBtn.click();
        });
    }
    if (dom.importRepoBtn) {
        dom.importRepoBtn.addEventListener('click', () => {
            const repo = dom.importRepoInput.value.trim();
            if (!repo) return showMessage('Please enter a repository', 'error');
            dom.importModal.style.display = 'none';
            handleImportRepo(repo);
        });
    }
    if (dom.importRepoInput) {
        dom.importRepoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') dom.importRepoBtn.click();
        });
    }

    // Import File Button
    if (dom.importFilesBtn) {
        dom.importFilesBtn.addEventListener('click', () => {
            dom.fileUpload.click(); // Trigger hidden file input
        });
    }

    // Import Folder Button
    if (dom.importFolderChooserBtn) {
        dom.importFolderChooserBtn.addEventListener('click', () => {
            dom.folderUpload.click(); // Trigger hidden folder input
        });
    }

    // File and Folder Upload Inputs
    if (dom.fileUpload) {
        dom.fileUpload.addEventListener('change', handleFileUpload);
    }
    if (dom.folderUpload) {
        dom.folderUpload.addEventListener('change', handleFolderUpload);
    }
}

// --- UI Update Functions ---

function renderFileTree() {
    dom.fileList.innerHTML = ''; // Clear existing list

    // Recursive function to build the tree
    function buildTree(folderPath, parentElement, level = 0) {
        const folderData = state.folders[folderPath];
        if (!folderData) {
             console.error("Folder data not found for path:", folderPath);
             return; // Should not happen
        }

        // Sort subfolders alphabetically
        folderData.subfolders.sort((a, b) => state.folders[a]?.name.localeCompare(state.folders[b]?.name));
        // Sort files alphabetically
        folderData.files.sort((a, b) => a.localeCompare(b));

        // Add subfolders first
        folderData.subfolders.forEach(subfolderPath => {
            const folderItem = createFolderItem(subfolderPath, level);
            if (folderItem) {
                parentElement.appendChild(folderItem);
                // Recursively build content for this subfolder *inside* its content div
                const contentDiv = folderItem.querySelector('.folder-content');
                if (contentDiv) { // Ensure contentDiv exists
                    buildTree(subfolderPath, contentDiv, level + 1);
                }
            }
        });

        // Add files
        folderData.files.forEach(fileName => {
            const fileItem = createFileItem(fileName, level);
            if (fileItem) {
                parentElement.appendChild(fileItem);
            }
        });
    }

    // Start building from the root
    buildTree('root', dom.fileList, 0);

     // Expand root by default? Or last known expanded folders? For now, only root.
     // This basic implementation doesn't preserve expanded state.
}

function createFileItem(fileName, level) {
    const li = document.createElement('li');
    li.className = 'file-item' + (fileName === state.currentFile ? ' active' : '');
    li.dataset.filename = fileName;
    li.dataset.type = 'file'; // Add type for context menu
    
    // Set file extension as a data attribute for styling
    const extension = fileName.split('.').pop().toLowerCase();
    if (extension !== fileName) {
        li.dataset.ext = extension;
    }

    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-item-name';
    fileNameSpan.textContent = fileName;
    fileNameSpan.title = fileName; // Tooltip for long names

    li.appendChild(fileNameSpan);

    // Click opens the file
    li.addEventListener('click', () => openFile(fileName));
    
    // Add drag and drop functionality
    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);

    return li;
}

function createFolderItem(folderPath, level) {
    const folderData = state.folders[folderPath];
    if (!folderData || folderPath === 'root') return null; // Don't render root explicitly here

    const folderContainer = document.createElement('div');
    folderContainer.className = 'folder-item';
    folderContainer.dataset.path = folderPath;
    folderContainer.dataset.type = 'folder'; // Add type for context menu
    
    // --- Folder Header (Toggle, Icon, Name) ---
    const folderHeader = document.createElement('div');
    folderHeader.className = 'folder-item-header';
    folderHeader.addEventListener('click', toggleFolderExpansion); // Click header to toggle

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
    
    folderContainer.appendChild(folderHeader);
    folderContainer.appendChild(folderContent);
    
    // Add drag and drop functionality
    folderContainer.setAttribute('draggable', 'true');
    folderContainer.addEventListener('dragstart', handleDragStart);
    folderContainer.addEventListener('dragover', handleDragOver);
    folderContainer.addEventListener('dragleave', handleDragLeave);
    folderContainer.addEventListener('drop', handleDrop);
    folderContainer.addEventListener('dragend', handleDragEnd);

    return folderContainer;
}


function toggleFolderExpansion(event) {
    const header = event.currentTarget; // The header div that was clicked
    const folderItem = header.closest('.folder-item');
    if (!folderItem) return;

    folderItem.classList.toggle('folder-expanded');
    const isExpanded = folderItem.classList.contains('folder-expanded');

    const folderContent = folderItem.querySelector('.folder-content');
    const folderToggle = header.querySelector('.folder-toggle');

    if (folderContent) {
        folderContent.style.display = isExpanded ? 'block' : 'none';
    }
    if (folderToggle) {
        folderToggle.style.transform = isExpanded ? 'rotate(90deg)' : '';
    }
    // Could save expanded state to localStorage here if desired
}


function populateFolderDropdown(selectElement, defaultValue = 'root') {
    selectElement.innerHTML = ''; // Clear existing options

    // Recursive function to add options with indentation
    function addOptions(folderPath, level = 0) {
        const folderData = state.folders[folderPath];
        if (!folderData) return;

        const option = document.createElement('option');
        option.value = folderPath;

        const indent = '— '.repeat(level);
        // Use 'Root' display name for the 'root' path
        option.textContent = indent + (folderPath === 'root' ? 'Root' : folderData.name);

        selectElement.appendChild(option);

        // Sort subfolders alphabetically for the dropdown
        const sortedSubfolders = [...folderData.subfolders].sort((a, b) =>
            state.folders[a]?.name.localeCompare(state.folders[b]?.name)
        );

        // Add subfolders recursively
        sortedSubfolders.forEach(subfolderPath => {
            addOptions(subfolderPath, level + 1);
        });
    }

    // Start from root
    addOptions('root', 0);

    // Set the default selected value
    selectElement.value = defaultValue;
}


function toggleSidebar() {
    state.sidebarVisible = !state.sidebarVisible;
    dom.mainContainer.classList.toggle('sidebar-hidden', !state.sidebarVisible);
    dom.sidebarToggle.textContent = state.sidebarVisible ? '←' : '→';

    // Trigger editor layout recalculation after transition
    if (state.editor) {
        // Use a timeout slightly longer than the CSS transition duration
        setTimeout(() => {
            state.editor.layout();
        }, 350); // Adjust if CSS transition is different
    }
     // Save sidebar state preference
     // saveSessionToStorage(); // Maybe too frequent, save on close/manual save instead?
}

function setLoading(isLoading) {
    state.isLoading = isLoading;
    dom.loadingIndicator.style.display = isLoading ? 'block' : 'none';
}

function showMessage(message, type = 'info', duration = 3000) {
    dom.messageBox.textContent = message;
    // Reset classes first
    dom.messageBox.className = 'message-box';
    // Add the type class
    dom.messageBox.classList.add(`message-${type}`);
    dom.messageBox.style.display = 'block';

    // Clear previous timeout if any
    if (dom.messageBox.timeoutId) {
        clearTimeout(dom.messageBox.timeoutId);
    }

    // Auto-hide after specified duration
    dom.messageBox.timeoutId = setTimeout(() => {
        dom.messageBox.style.display = 'none';
        dom.messageBox.timeoutId = null; // Clear the stored ID
    }, duration);
}

function closeAllModals() {
     document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// --- File and Folder Operations ---

async function handleFileUpload(event) {
    setLoading(true);
    closeAllModals(); // Close any open modals

    try {
        const files = event.target.files;
        if (!files || files.length === 0) {
            showMessage("No files selected.", 'info');
            return; // Exit if no files
        }

        let firstFileName = null;
        for (const file of files) {
            const fileName = file.name;

            // Prevent duplicates (ask user?) - For now, overwrite silently
            if (state.files[fileName]) {
                 console.warn(`File "${fileName}" already exists. Overwriting.`);
                 // Could implement renaming or skipping here
                 deleteFileInternal(fileName); // Remove old references cleanly
            }

            const content = await readFileContent(file);
            const language = getLanguageForFile(fileName);

            createEditorModel(fileName, content, language, state.lastUsedFolder); // Add to last active folder
            if (!firstFileName) firstFileName = fileName;
        }

        // Open the first uploaded file if none is currently open
        if (firstFileName && (!state.currentFile || !state.files[state.currentFile])) {
            openFile(firstFileName);
        } else {
             renderFileTree(); // Still need to re-render if a file was open
        }

        showMessage(`Uploaded ${files.length} file(s) successfully`, 'success');
    } catch (error) {
        console.error("Error uploading files:", error);
        showMessage("Error uploading files: " + error.message, 'error');
    } finally {
        setLoading(false);
        // Clear the file input value to allow re-uploading the same file
        event.target.value = '';
    }
}


async function handleFolderUpload(event) {
    setLoading(true);
    const importTargetFolder = dom.importFolderParent.value; // Get target from dropdown
    closeAllModals();

    try {
        const files = event.target.files;
        if (!files || files.length === 0) {
            showMessage("No files selected in the folder.", 'info');
            return;
        }

        const filePromises = [];
        let firstFileName = null;
        let firstFilePath = null; // Track full path for opening

        // Use a Set to efficiently track created folder paths during this import
        const createdFoldersThisImport = new Set();
         // Add target folder path if it's not root
         if (importTargetFolder !== 'root') {
             createdFoldersThisImport.add(importTargetFolder);
         }


        for (const file of files) {
             // webkitRelativePath includes the top-level folder selected by the user
            let relativePath = file.webkitRelativePath;
            if (!relativePath) {
                console.warn("Browser does not support webkitRelativePath. Uploading file to target folder directly.");
                relativePath = file.name; // Fallback: treat as single file upload
            }

             filePromises.push((async () => {
                 try {
                     const pathParts = relativePath.split('/');
                     const fileName = pathParts.pop();
                     let currentFolderPath = importTargetFolder; // Start at the selected target

                     // Create nested folders if they don't exist
                     for (const folderName of pathParts) {
                         if (!folderName) continue; // Skip empty parts (e.g., double slashes)

                         const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;

                         // Check if folder exists OR was already created in this batch
                         if (!state.folders[nextPath] && !createdFoldersThisImport.has(nextPath)) {
                             // Create it
                             state.folders[nextPath] = {
                                 name: folderName,
                                 files: [],
                                 subfolders: [],
                                 path: nextPath
                             };
                              // Link to parent
                             if (state.folders[currentFolderPath] && !state.folders[currentFolderPath].subfolders.includes(nextPath)) {
                                 state.folders[currentFolderPath].subfolders.push(nextPath);
                             }
                             createdFoldersThisImport.add(nextPath); // Mark as created
                         }
                         currentFolderPath = nextPath; // Move deeper
                     }

                     // Check for file collision within the target folder
                     const finalFilePath = currentFolderPath === 'root' ? fileName : `${currentFolderPath}/${fileName}`;
                     if (state.files[fileName] && state.filePaths[fileName] === currentFolderPath) {
                         console.warn(`File "${fileName}" already exists in "${currentFolderPath}". Overwriting.`);
                         deleteFileInternal(fileName); // Clean removal before adding again
                     } else if (state.files[fileName]) {
                         console.warn(`File "${fileName}" exists in a different folder. Uploading copy to "${currentFolderPath}".`);
                          // This scenario leads to two files with the same name, which our current state structure handles (keys are unique filenames).
                          // The UI will show both. Ensure openFile logic works correctly.
                     }


                     // Read file content
                     const content = await readFileContent(file);
                     const language = getLanguageForFile(fileName);

                     // Create the editor model and add to state/structure
                     createEditorModel(fileName, content, language, currentFolderPath);

                     // Track the first file added for potentially opening it later
                     if (!firstFileName) {
                         firstFileName = fileName;
                         firstFilePath = currentFolderPath; // Store its path too
                     }
                 } catch (readError) {
                      console.error(`Error processing file ${file.webkitRelativePath || file.name}:`, readError);
                     showMessage(`Error reading file ${file.name}`, 'error');
                 }
             })());
        }

        // Wait for all file processing to complete
        await Promise.all(filePromises);

        renderFileTree(); // Update the UI once all files are processed

        // Open the first file added if no file is currently open
        if (firstFileName && (!state.currentFile || !state.files[state.currentFile])) {
            openFile(firstFileName); // openFile uses state.filePaths, so path isn't needed here
        }

        showMessage(`Imported ${files.length} file(s) with folder structure`, 'success');

    } catch (error) {
        console.error("Error importing folder:", error);
        showMessage("Error importing folder: " + error.message, 'error');
    } finally {
        setLoading(false);
        // Clear the file input value
        event.target.value = '';
    }
}


function createNewFile() {
    const fileName = dom.newFileName.value.trim();
    const folderPath = dom.newFileFolder.value; // Get selected folder path

    if (!fileName) {
        showMessage("Please enter a file name", 'error');
        return;
    }
    // Basic validation for filename (prevent slashes, etc.)
    if (fileName.includes('/') || fileName.includes('\\')) {
         showMessage("File name cannot contain slashes", 'error');
         return;
    }

    // Check if file already exists *within the same folder*
    if (state.files[fileName] && state.filePaths[fileName] === folderPath) {
        showMessage(`File "${fileName}" already exists in folder "${folderPath === 'root' ? 'Root' : state.folders[folderPath].name}"`, 'error');
        return;
    }
     // Allow file with same name if in different folder (handled by state structure)
      if (state.files[fileName]) {
         console.warn(`File name "${fileName}" exists in another folder. Creating a new instance in "${folderPath}".`);
     }


    // Create empty model
    const language = getLanguageForFile(fileName);
    const model = monaco.editor.createModel('', language);

    // Add to state and structure
    state.files[fileName] = { model, viewState: null, language, path: folderPath };
    state.filePaths[fileName] = folderPath;

    // Add to folder's file list (ensure folder exists)
    if (state.folders[folderPath]) {
        if (!state.folders[folderPath].files.includes(fileName)) {
             state.folders[folderPath].files.push(fileName);
        }
    } else {
        console.error(`Target folder "${folderPath}" not found when creating file!`);
        showMessage(`Error: Target folder not found`, 'error');
        // Clean up inconsistent state
        delete state.files[fileName];
        delete state.filePaths[fileName];
        return;
    }

    // Update UI
    renderFileTree();

    // Open the newly created file
    openFile(fileName);

    // Update last used folder
    state.lastUsedFolder = folderPath;

    // Close modal and clear input
    dom.newFileModal.style.display = 'none';
    dom.newFileName.value = '';

    showMessage(`Created file: ${fileName}`, 'success');
}


function createNewFolder() {
    const folderName = dom.newFolderName.value.trim();
    const parentPath = dom.newFolderParent.value; // Get selected parent path

    if (!folderName) {
        showMessage("Please enter a folder name", 'error');
        return;
    }
     // Basic validation for folder name (prevent slashes, etc.)
     if (folderName.includes('/') || folderName.includes('\\') || folderName === 'root') {
         showMessage("Folder name cannot contain slashes or be 'root'", 'error');
         return;
     }

    // Construct the full path for the new folder
    const newFolderPath = parentPath === 'root' ? folderName : `${parentPath}/${folderName}`;

    // Check if folder already exists at this path
    if (state.folders[newFolderPath]) {
        showMessage(`Folder "${folderName}" already exists under "${parentPath === 'root' ? 'Root' : state.folders[parentPath].name}"`, 'error');
        return;
    }

    // Ensure parent folder exists
    if (!state.folders[parentPath]) {
         console.error(`Parent folder "${parentPath}" not found when creating folder!`);
         showMessage(`Error: Parent folder not found`, 'error');
         return;
    }

    // Create new folder entry in state
    state.folders[newFolderPath] = {
        name: folderName,
        files: [],
        subfolders: [],
        path: newFolderPath
    };

    // Add the new folder path to the parent's subfolders list
     if (!state.folders[parentPath].subfolders.includes(newFolderPath)) {
        state.folders[parentPath].subfolders.push(newFolderPath);
     }

    // Update UI
    renderFileTree();

    // Update last used folder (might set to the new folder or keep parent?)
    // Let's set it to the newly created folder.
    state.lastUsedFolder = newFolderPath;

    // Close modal and clear input
    dom.newFolderModal.style.display = 'none';
    dom.newFolderName.value = '';

    showMessage(`Created folder: ${folderName}`, 'success');
}

function addFileToFolder(fileName, folderPath) {
    // This function is partially redundant now with logic in createEditorModel/createNewFile
    // Main purpose is to ensure consistency.

    // Update file paths map
    state.filePaths[fileName] = folderPath;
    // Update path on file object itself
    if (state.files[fileName]) {
        state.files[fileName].path = folderPath;
    }

    // Ensure folder exists and add file to its list if not present
    if (state.folders[folderPath]) {
        if (!state.folders[folderPath].files.includes(fileName)) {
            state.folders[folderPath].files.push(fileName);
        }
    } else {
        // This indicates an inconsistency - should not happen if folders are created first
        console.error(`Attempted to add file "${fileName}" to non-existent folder "${folderPath}".`);
         // Fallback: Add to root? Or throw error? Let's add to root for robustness.
         state.filePaths[fileName] = 'root';
         if(state.files[fileName]) state.files[fileName].path = 'root';
         if (!state.folders['root'].files.includes(fileName)) {
              state.folders['root'].files.push(fileName);
         }
         showMessage(`Error: Folder "${folderPath}" not found. File "${fileName}" added to Root.`, 'error');
    }
}

function createEditorModel(fileName, content, language, folderPath = 'root') {
    // Create a new model for the file
    const model = monaco.editor.createModel(content, language);

    // Add to state, ensuring path consistency
    state.files[fileName] = {
        model,
        viewState: null, // Reset view state for new models
        language,
        path: folderPath
    };

    // Use addFileToFolder for consistent structure update
    addFileToFolder(fileName, folderPath);

    // Note: renderFileTree() is usually called *after* a batch of operations
    // or when opening a file, not necessarily here for every single model creation.
}

function openFile(fileName) {
    if (!state.files[fileName] || !state.files[fileName].model) {
         console.error(`File "${fileName}" or its model not found.`);
         showMessage(`Error: Could not open file "${fileName}".`, 'error');
         // Maybe try to remove inconsistent entry?
         if (state.files[fileName]) deleteFileInternal(fileName);
         renderFileTree();
         return;
    }

    // Save view state of the currently open file (if any)
    if (state.currentFile && state.files[state.currentFile] && state.editor.getModel()) {
        state.files[state.currentFile].viewState = state.editor.saveViewState();
    }

    // Set the new model in the editor
    state.currentFile = fileName;
    state.editor.setModel(state.files[fileName].model);

    // Restore view state for the new file (if available)
    if (state.files[fileName].viewState) {
        state.editor.restoreViewState(state.files[fileName].viewState);
    }

    // Update UI elements
    renderFileTree(); // Re-render to highlight the active file
    dom.downloadBtn.disabled = false;
    dom.languageMode.textContent = `Lang: ${state.files[fileName].language}`; // Shorter label

    // Update last used folder based on the opened file's location
    state.lastUsedFolder = state.filePaths[fileName] || 'root';

    // Focus the editor for immediate typing
    state.editor.focus();
}

function downloadCurrentFile() {
    if (!state.currentFile || !state.files[state.currentFile] || !state.editor.getModel()) {
         showMessage("No file is currently open or editor model is missing.", 'error');
         return;
    }

    const fileName = state.currentFile;
    // Get content directly from the current editor model to ensure latest edits
    const content = state.editor.getValue();

    downloadFile(fileName, content); // Use helper function
}

function downloadFile(fileName, content) {
    try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); // Specify charset
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;

        // Append, click, remove pattern
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke the object URL after a short delay to ensure download starts
        setTimeout(() => URL.revokeObjectURL(link.href), 100);

        showMessage(`Downloaded ${fileName}`, 'success');
    } catch (error) {
         console.error("Error creating download link:", error);
         showMessage("Failed to initiate download.", 'error');
    }
}

async function downloadWorkspace() {
    const workspaceName = dom.workspaceName.value.trim() || 'qe-workspace';
    if (Object.keys(state.files).length === 0) {
        showMessage("Workspace is empty, nothing to download.", 'error');
        closeAllModals();
        return;
    }

    setLoading(true); // Show loading indicator

    try {
        // Check if JSZip is loaded (it should be included in index.html now)
        if (typeof JSZip === 'undefined') {
            console.error("JSZip library is not loaded!");
            throw new Error("JSZip library not found. Cannot create ZIP.");
        }

        const zip = new JSZip();

        // Recursive function to add folders and files
        function addFolderToZip(folderPath, zipFolder) {
            const folderData = state.folders[folderPath];
            if (!folderData) return; // Skip if data missing

            // Add files in this folder
            folderData.files.forEach(fileName => {
                const fileData = state.files[fileName];
                 // Ensure file exists and has a model before adding
                if (fileData && fileData.model) {
                    const content = fileData.model.getValue();
                    zipFolder.file(fileName, content); // Add file to current zip folder level
                } else {
                     console.warn(`Skipping file "${fileName}" in ZIP: Missing data or model.`);
                }
            });

            // Add subfolders recursively
            folderData.subfolders.forEach(subfolderPath => {
                 const subfolderData = state.folders[subfolderPath];
                 if (subfolderData) {
                     const subZipFolder = zipFolder.folder(subfolderData.name); // Create subfolder in zip
                     addFolderToZip(subfolderPath, subZipFolder); // Recurse
                 } else {
                      console.warn(`Skipping subfolder "${subfolderPath}" in ZIP: Missing data.`);
                 }
            });
        }

        // Start adding from the root level
        addFolderToZip('root', zip);

        // Generate the zip file blob
        const blob = await zip.generateAsync({
             type: 'blob',
             compression: "DEFLATE", // Use compression
             compressionOptions: {
                 level: 6 // Moderate compression level (1-9)
             }
        });

        // Create and trigger download link
        downloadFile(`${workspaceName}.zip`, blob); // Use downloadFile for blobs too

        closeAllModals();
        showMessage(`Downloaded workspace as ${workspaceName}.zip`, 'success');

    } catch (error) {
        console.error("Error creating workspace ZIP:", error);
        showMessage(`Error creating ZIP: ${error.message}`, 'error');
    } finally {
        setLoading(false); // Hide loading indicator
    }
}


// --- Fetching External Files ---

async function fetchFromUrl() {
    const url = dom.urlInput.value.trim();
    if (!url) {
        showMessage("Please enter a URL", 'error');
        return;
    }

    // Basic URL validation (optional, but good practice)
    try {
         new URL(url);
    } catch (_) {
         showMessage("Invalid URL format", 'error');
         return;
    }


    setLoading(true);
    let fileName = 'fetched-file.txt'; // Default filename

    try {
        // Use CORS proxy if necessary (simple example, replace with your own or a service)
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // Example proxy
        // const fetchUrl = proxyUrl + url;
        const fetchUrl = url; // Try direct fetch first

        const response = await fetch(fetchUrl);

        if (!response.ok) {
            // Attempt fetch without proxy if proxy failed? Or just report error.
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        // Try to extract filename from URL path
        try {
            const pathName = new URL(url).pathname;
            const nameFromPath = pathName.split('/').pop();
            if (nameFromPath) {
                // Remove query parameters if present (though usually not in pathname)
                fileName = nameFromPath.split('?')[0];
            }
        } catch (e) {
            console.warn("Could not parse URL to get filename, using default.");
        }


        // Handle potential duplicate filenames
        if (state.files[fileName] && state.filePaths[fileName] === 'root') { // Check root only for simplicity
             console.warn(`File "${fileName}" already exists in root. Overwriting.`);
             deleteFileInternal(fileName);
        }


        const language = getLanguageForFile(fileName);
        createEditorModel(fileName, content, language, 'root'); // Add to root folder
        openFile(fileName);

        showMessage(`Fetched ${fileName} successfully`, 'success');
        dom.urlInput.value = ''; // Clear input on success

    } catch (error) {
        console.error("Error fetching URL:", error);
        showMessage(`Error fetching URL: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

// --- GitHub Integration ---

async function fetchGitHubRepo() {
    let repoInput = dom.githubRepo.value.trim();
    if (!repoInput) {
        showMessage("Please enter a GitHub repo (owner/repo) or URL", 'error');
        return;
    }

    let owner, repo;

    try {
        // Check if it's a full URL
        if (repoInput.includes('github.com')) {
            const url = new URL(repoInput);
            if (url.hostname !== 'github.com') {
                throw new Error('Not a GitHub URL');
            }
            const pathParts = url.pathname.split('/').filter(part => part.length > 0); // Filter empty parts
            if (pathParts.length < 2) {
                 throw new Error('Invalid GitHub URL path');
            }
            owner = pathParts[0];
            repo = pathParts[1].replace('.git', ''); // Remove .git suffix if present
        } else {
            // Assume owner/repo format
            const parts = repoInput.split('/');
            if (parts.length < 2 || !parts[0] || !parts[1]) {
                 throw new Error("Invalid format. Use 'owner/repo'");
            }
            owner = parts[0];
            repo = parts[1].replace('.git', '');
        }
    } catch (error) {
         showMessage(`Invalid GitHub input: ${error.message}`, 'error');
         return;
    }


    setLoading(true);
    dom.repoFileList.innerHTML = ''; // Clear previous list
    dom.repoInfo.textContent = ''; // Clear previous info


    try {
         // Fetch repo details (optional, gets default branch)
         const repoDetailsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
         if (!repoDetailsResponse.ok) {
              if (repoDetailsResponse.status === 404) throw new Error(`Repository not found: ${owner}/${repo}`);
              if (repoDetailsResponse.status === 403) throw new Error(`GitHub API rate limit exceeded. Try again later.`);
              throw new Error(`GitHub API error ${repoDetailsResponse.status}`);
         }
         const repoDetails = await repoDetailsResponse.json();
         const defaultBranch = repoDetails.default_branch || 'main'; // Use default branch


        // Fetch contents of the root directory of the default branch
        const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents?ref=${defaultBranch}`;
        const response = await fetch(contentsUrl);

        if (!response.ok) {
             if (response.status === 404) throw new Error(`Could not fetch contents for ${owner}/${repo} (branch: ${defaultBranch}). Empty repo or wrong default branch?`);
             if (response.status === 403) throw new Error(`GitHub API rate limit exceeded. Try again later.`);
            throw new Error(`GitHub API error fetching contents: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
             throw new Error("Unexpected response format from GitHub API (contents).");
        }

        // Display repo info
        dom.repoInfo.innerHTML = `<strong>Repo:</strong> ${owner}/${repo} (Branch: ${defaultBranch}) <br> Select files/folders to load:`;

        // Populate the file list in the modal
        await populateRepoFileList(data, owner, repo, defaultBranch, '', dom.repoFileList); // Pass repo details

        // Show the modal
        dom.githubModal.style.display = 'flex';

    } catch (error) {
        console.error("Error fetching GitHub repo:", error);
        showMessage(`Error fetching GitHub repo: ${error.message}`, 'error');
        dom.repoInfo.textContent = `Error: ${error.message}`; // Show error in modal too
    } finally {
        setLoading(false);
    }
}

async function populateRepoFileList(items, owner, repo, branch, currentPath, parentElement, level = 0) {
    // Sort: directories first, then files, alphabetically
    items.sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
    });

    for (const item of items) {
        const itemElement = document.createElement('li');
        itemElement.className = 'repo-file-item';
        itemElement.style.paddingLeft = `${level * 15 + 5}px`; // Indentation

        const fullItemPath = currentPath ? `${currentPath}/${item.name}` : item.name;

        if (item.type === 'file') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'repo-file-checkbox';
            checkbox.dataset.path = fullItemPath; // Store relative path
            checkbox.dataset.url = item.download_url; // URL to fetch content
            checkbox.id = `gh-cb-${fullItemPath.replace(/[^a-zA-Z0-9]/g, '-')}`; // Unique ID

            const label = document.createElement('label');
            label.textContent = `📄 ${item.name}`; // Add icon to label
            label.setAttribute('for', checkbox.id); // Link label to checkbox

            itemElement.appendChild(checkbox);
            itemElement.appendChild(label);

        } else if (item.type === 'dir') {
            itemElement.classList.add('repo-folder-item');
            itemElement.dataset.path = fullItemPath;
             // URL to fetch directory contents (item.url from GitHub API)
            itemElement.dataset.apiUrl = item.url;
            itemElement.style.fontWeight = 'bold';
            itemElement.style.cursor = 'pointer';
            itemElement.textContent = `▶ 📁 ${item.name}`; // Collapsed state indicator
            itemElement.dataset.expanded = 'false';

             // Click handler to expand/collapse directory
            itemElement.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering parent folder clicks
                const targetElement = e.currentTarget;
                const isExpanded = targetElement.dataset.expanded === 'true';
                const sublistId = `gh-sublist-${fullItemPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
                let sublist = document.getElementById(sublistId);

                if (isExpanded) {
                    // Collapse: Remove sublist
                    if (sublist) sublist.remove();
                    targetElement.dataset.expanded = 'false';
                    targetElement.textContent = `▶ 📁 ${item.name}`;
                } else {
                    // Expand: Fetch contents if needed, or just show if already fetched?
                    // Let's always fetch for simplicity, API calls are cached by browser usually.
                    if (sublist) sublist.remove(); // Remove old one if exists

                    sublist = document.createElement('ul');
                    sublist.id = sublistId;
                    sublist.style.listStyle = 'none';
                    sublist.style.padding = '0';
                    sublist.style.margin = '0';
                    // Insert sublist right after the folder item
                    targetElement.parentNode.insertBefore(sublist, targetElement.nextSibling);


                    try {
                        setLoading(true); // Show loading while fetching subfolder
                        const apiUrl = targetElement.dataset.apiUrl;
                        if (!apiUrl) throw new Error("Missing API URL for directory.");

                        const response = await fetch(apiUrl);
                        if (!response.ok) {
                             if (response.status === 403) throw new Error(`GitHub API rate limit exceeded.`);
                             throw new Error(`GitHub API error ${response.status}`);
                        }
                        const dirContents = await response.json();

                        if (!Array.isArray(dirContents)) {
                           throw new Error("Unexpected response format from GitHub API.");
                        }


                        // Populate the sublist recursively
                        await populateRepoFileList(dirContents, owner, repo, branch, fullItemPath, sublist, level + 1);

                        targetElement.dataset.expanded = 'true';
                        targetElement.textContent = `▼ 📁 ${item.name}`; // Expanded state indicator

                    } catch (error) {
                        console.error(`Error expanding directory ${fullItemPath}:`, error);
                        showMessage(`Error expanding folder: ${error.message}`, 'error');
                        if (sublist) sublist.remove(); // Clean up empty sublist on error
                        // Optionally display error message within the list?
                        const errorLi = document.createElement('li');
                        errorLi.textContent = `Error loading contents`;
                        errorLi.style.color = 'red';
                        errorLi.style.paddingLeft = `${(level + 1) * 15 + 5}px`;
                        targetElement.parentNode.insertBefore(errorLi, targetElement.nextSibling);

                    } finally {
                         setLoading(false);
                    }
                }
            });
        }

        parentElement.appendChild(itemElement);
    }
}


async function loadSelectedGitHubFiles() {
    const checkboxes = dom.repoFileList.querySelectorAll('.repo-file-checkbox:checked');
    if (checkboxes.length === 0) {
        showMessage("No files selected from GitHub", 'info');
        return;
    }

    setLoading(true);
    closeAllModals();

    let loadedCount = 0;
    let firstFileName = null;
    const filePromises = [];
    const createdFoldersThisLoad = new Set(); // Track folders created in this operation


    checkboxes.forEach(checkbox => {
        const relativePath = checkbox.dataset.path; // Path relative to repo root
        const downloadUrl = checkbox.dataset.url;

        filePromises.push((async () => {
            try {
                const response = await fetch(downloadUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} for ${relativePath}`);
                }
                const content = await response.text();

                const pathParts = relativePath.split('/');
                const fileName = pathParts.pop();
                let currentFolderPath = 'root'; // Start at workspace root

                // Create folder structure within the workspace
                for (const folderName of pathParts) {
                    if (!folderName) continue;
                    const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;

                    if (!state.folders[nextPath] && !createdFoldersThisLoad.has(nextPath)) {
                         // Create folder
                         state.folders[nextPath] = { name: folderName, files: [], subfolders: [], path: nextPath };
                         if (state.folders[currentFolderPath] && !state.folders[currentFolderPath].subfolders.includes(nextPath)) {
                             state.folders[currentFolderPath].subfolders.push(nextPath);
                         }
                         createdFoldersThisLoad.add(nextPath);
                    }
                    currentFolderPath = nextPath;
                }


                 // Check for file collision within the target folder
                 if (state.files[fileName] && state.filePaths[fileName] === currentFolderPath) {
                     console.warn(`GitHub file "${fileName}" overwriting existing file in "${currentFolderPath}".`);
                     deleteFileInternal(fileName);
                 }

                // Create model and add file
                const language = getLanguageForFile(fileName);
                createEditorModel(fileName, content, language, currentFolderPath);

                if (!firstFileName) firstFileName = fileName; // Track first loaded file
                loadedCount++;

            } catch (error) {
                console.error(`Error loading GitHub file ${relativePath}:`, error);
                showMessage(`Error loading ${relativePath}: ${error.message}`, 'error');
            }
        })());
    });

    try {
        await Promise.all(filePromises); // Wait for all files to be fetched and processed

        renderFileTree(); // Update UI

        if (loadedCount > 0 && firstFileName && (!state.currentFile || !state.files[state.currentFile])) {
            openFile(firstFileName); // Open first loaded file if none is active
        }

        if (loadedCount > 0) {
            showMessage(`Loaded ${loadedCount} file(s) from GitHub`, 'success');
        } else if (checkboxes.length > 0) {
             showMessage(`Failed to load selected GitHub files. See console for details.`, 'error');
        }
        // No message needed if loadedCount is 0 and checkboxes.length was 0 (handled earlier)

    } catch (error) {
        // Should not happen if individual errors are caught, but just in case
        console.error("Error during batch GitHub file loading:", error);
        showMessage("An unexpected error occurred while loading GitHub files.", 'error');
    } finally {
        setLoading(false);
    }
}


// --- Context Menu Actions ---

function handleContextMenu(event) {
    const targetElement = event.target.closest('.file-item, .folder-item .folder-item-header'); // Target file or folder header

    if (!targetElement) {
        // Clicked on empty space or folder content area, hide menu
         dom.contextMenu.style.display = 'none';
        return;
    }

    event.preventDefault(); // Prevent default browser context menu

    const dataType = targetElement.closest('.file-item, .folder-item').dataset.type; // Get type from parent item
    let dataTarget;

    if (dataType === 'file') {
        dataTarget = targetElement.closest('.file-item').dataset.filename;
        configureContextMenuForFile(dataTarget);
    } else if (dataType === 'folder') {
        dataTarget = targetElement.closest('.folder-item').dataset.path;
         // Don't show context menu for the root folder itself
         // Check if the click was on the root folder item representation if you add one later
        if (dataTarget === 'root') { // Prevent menu on root
             dom.contextMenu.style.display = 'none';
             return;
        }
        configureContextMenuForFolder(dataTarget);
    } else {
        dom.contextMenu.style.display = 'none'; // Hide if target type is unclear
        return;
    }


    // Position and show context menu
    dom.contextMenu.style.left = `${event.pageX}px`;
    dom.contextMenu.style.top = `${event.pageY}px`;
    dom.contextMenu.style.display = 'block';

    // Store target info on the menu itself
    dom.contextMenu.dataset.targetType = dataType;
    dom.contextMenu.dataset.targetPath = dataTarget; // Use path for both files (filename) and folders (folderpath)
}


function configureContextMenuForFile(fileName) {
    // Enable/disable items based on clipboard state etc.
    const pasteItem = dom.contextMenu.querySelector('[data-action="paste"]');

    dom.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        const action = item.dataset.action;
        switch (action) {
            case 'rename':
            case 'delete':
            case 'copy':
            case 'cut':
                item.style.display = 'block'; // Always show for files
                break;
            case 'paste':
                item.style.display = 'none'; // Cannot paste *onto* a file
                break;
            default:
                item.style.display = 'none'; // Hide unknown actions
        }
    });
}

function configureContextMenuForFolder(folderPath) {
    const pasteItem = dom.contextMenu.querySelector('[data-action="paste"]');
    const copyCutItems = dom.contextMenu.querySelectorAll('[data-action="copy"], [data-action="cut"]');

    dom.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        const action = item.dataset.action;
        switch (action) {
            case 'rename':
            case 'delete':
                item.style.display = 'block'; // Always show for folders (except root handled earlier)
                break;
            case 'paste':
                 break;
            default:
                item.style.display = 'none';
        }
    });
}

function handleContextMenuAction(event) {
    const action = event.target.dataset.action;
    // Get target info stored on the context menu element
    const type = dom.contextMenu.dataset.targetType;
    const targetPath = dom.contextMenu.dataset.targetPath; // Filename or folder path

    // Hide context menu immediately
    dom.contextMenu.style.display = 'none';

    if (!action || !type || !targetPath) {
        console.warn("Context menu action triggered without target information.");
        return;
    }

    console.log(`Action: ${action}, Type: ${type}, Target: ${targetPath}`);

    switch (action) {
        case 'rename':
            renameItem(type, targetPath);
            break;
        case 'delete':
            deleteItem(type, targetPath);
            break;
        case 'copy': // Currently only supports files
             if (type === 'file') copyItem(targetPath);
             else console.warn("Copy action not supported for folders yet.");
            break;
        case 'cut': // Currently only supports files
            if (type === 'file') cutItem(targetPath);
            else console.warn("Cut action not supported for folders yet.");
            break;
        case 'paste': // Paste *into* a folder
             if (type === 'folder') pasteItem(targetPath);
             else console.warn("Paste action only supported on folders.");
            break;
        default:
            console.warn(`Unknown context menu action: ${action}`);
    }
}


// --- Rename, Delete, Copy, Cut, Paste Logic ---

function renameItem(type, targetPath) {
    const currentName = type === 'file' ? targetPath : state.folders[targetPath]?.name;
    if (!currentName) {
         console.error("Cannot rename: Invalid target path or name.");
         return;
    }

    const newName = prompt(`Enter new name for ${type} "${currentName}":`, currentName);

    if (!newName || newName === currentName) {
        return; // User cancelled or didn't change the name
    }
    // Basic validation
    if (newName.includes('/') || newName.includes('\\') || (type === 'folder' && newName === 'root')) {
         showMessage("Invalid name: Cannot contain slashes or be 'root'", 'error');
         return;
    }


    if (type === 'file') {
        renameFile(targetPath, newName);
    } else if (type === 'folder') {
        renameFolder(targetPath, newName);
    }
}

function deleteItem(type, targetPath) {
    const targetName = type === 'file' ? targetPath : state.folders[targetPath]?.name;
    if (!targetName) {
         console.error("Cannot delete: Invalid target path or name.");
         return;
    }

    let confirmationMessage = `Are you sure you want to delete ${type} "${targetName}"?`;
    let requiresContentConfirmation = false;

    if (type === 'folder') {
         const folderData = state.folders[targetPath];
         if (folderData && (folderData.files.length > 0 || folderData.subfolders.length > 0)) {
             confirmationMessage += '\n\nThis folder contains other files or folders. This action CANNOT be undone.';
             requiresContentConfirmation = true;
         }
    }

    if (confirm(confirmationMessage)) {
         // Double confirmation if deleting non-empty folder
         if (requiresContentConfirmation) {
             const confirmContents = prompt(`Type the folder name "${targetName}" to confirm deletion of all its contents:`);
             if (confirmContents !== targetName) {
                  showMessage("Deletion cancelled. Confirmation name did not match.", 'info');
                  return;
             }
         }


        if (type === 'file') {
            deleteFile(targetPath);
        } else if (type === 'folder') {
            deleteFolder(targetPath);
        }
    }
}

function copyItem(fileName) { // Only files currently supported
    if (!state.files[fileName] || !state.files[fileName].model) {
         console.error("Cannot copy: File data or model missing for", fileName);
         return;
    }
    const fileData = state.files[fileName];
    const currentPath = state.filePaths[fileName] || 'root';

    state.clipboard = {
        type: 'copy',
        fileName: fileName, // Original name
        content: fileData.model.getValue(),
        language: fileData.language,
        sourcePath: currentPath // Store original path
    };

    showMessage(`Copied file: ${fileName}`, 'success', 1500);
    // Update context menu (e.g., enable paste on folders) - handled by configureContextMenu
}

function cutItem(fileName) { // Only files currently supported
     if (!state.files[fileName] || !state.files[fileName].model) {
         console.error("Cannot cut: File data or model missing for", fileName);
         return;
    }
    const fileData = state.files[fileName];
    const currentPath = state.filePaths[fileName] || 'root';

    state.clipboard = {
        type: 'cut',
        fileName: fileName, // Original name
        content: fileData.model.getValue(),
        language: fileData.language,
        sourcePath: currentPath // Store original path for removal later
    };

    showMessage(`Cut file: ${fileName}`, 'success', 1500);
    // Visually indicate cut state? (e.g., slightly greyed out in file list)
    renderFileTree(); // Re-render to potentially apply visual cue
     // Update context menu (e.g., enable paste on folders) - handled by configureContextMenu
}

function pasteItem(targetFolderPath) { // Paste into the target folder
    if (!state.clipboard) {
        showMessage("Clipboard is empty.", 'info');
        return;
    }
    if (!state.folders[targetFolderPath]) {
         showMessage("Target folder does not exist.", 'error');
         return;
    }

    const { type: clipType, fileName: originalFileName, content, language, sourcePath } = state.clipboard;

    let newFileName = originalFileName;

    // Check for name collision in the target folder
    if (state.files[newFileName] && state.filePaths[newFileName] === targetFolderPath) {
        // If cutting to the same folder, it's an invalid operation or should just cancel cut
        if (clipType === 'cut' && sourcePath === targetFolderPath) {
             showMessage("Cannot cut and paste file into the same folder.", 'info');
             state.clipboard = null; // Cancel cut operation
             renderFileTree(); // Remove visual cue
             return;
        }

        // Name exists, prompt for a new name
        newFileName = prompt(`File "${originalFileName}" already exists in this folder. Enter a new name (or cancel):`, `copy_of_${originalFileName}`);
        if (!newFileName) {
            return; // User cancelled
        }
         // Basic validation
         if (newFileName.includes('/') || newFileName.includes('\\')) {
             showMessage("Invalid name: Cannot contain slashes", 'error');
             return;
         }
         // Re-check collision with the *new* name
         if (state.files[newFileName] && state.filePaths[newFileName] === targetFolderPath) {
              showMessage(`File "${newFileName}" also exists. Paste cancelled.`, 'error');
              return;
         }
    }

    // Create the new file model
    const model = monaco.editor.createModel(content, language);

    // Add new file to state and folder structure
    state.files[newFileName] = { model, viewState: null, language, path: targetFolderPath };
    addFileToFolder(newFileName, targetFolderPath); // Handles filePaths and folder.files update

    // If it was a 'cut' operation, remove the original file
    if (clipType === 'cut') {
         // Only delete if the filename didn't change AND source path is different
         if (newFileName === originalFileName && sourcePath !== targetFolderPath) {
             deleteFileInternal(originalFileName, sourcePath); // Delete specifically from source
         } else if (sourcePath !== targetFolderPath) {
              // If renamed, we still need to delete the original entry by its name
              deleteFileInternal(originalFileName, sourcePath);
         }
         // If cut and pasted into same folder (handled above) or renamed during cut,
         // the original deleteFileInternal call should be skipped.

        // Clear clipboard after cut-paste is complete
        state.clipboard = null;
    }


    // Update UI and open the newly pasted/moved file
    renderFileTree();
    openFile(newFileName); // Open the newly created/moved file

    showMessage(`Pasted file as "${newFileName}" into ${targetFolderPath === 'root' ? 'Root' : state.folders[targetFolderPath].name}`, 'success');
}


function renameFile(oldFileName, newName) {
    const currentPath = state.filePaths[oldFileName];
    if (!currentPath || !state.files[oldFileName]) {
         console.error(`Cannot rename: File "${oldFileName}" or its path not found.`);
         return;
    }

    // Check for collision in the *same* folder
    if (state.files[newName] && state.filePaths[newName] === currentPath) {
        showMessage(`File "${newName}" already exists in this folder.`, 'error');
        return;
    }

    // Get existing file data
    const fileData = state.files[oldFileName];

    // Create new model with potentially updated language
    const newLanguage = getLanguageForFile(newName);
    // Re-create model? Or just update language? Let's update language on existing model if possible.
    // Monaco doesn't have a simple model.setLanguage, need to create new model usually.
    const newModel = monaco.editor.createModel(fileData.model.getValue(), newLanguage);


    // Add new entry
    state.files[newName] = {
        model: newModel,
        viewState: fileData.viewState, // Preserve viewstate if possible
        language: newLanguage,
        path: currentPath
    };
    state.filePaths[newName] = currentPath;

    // Update folder's file list
    if (state.folders[currentPath]) {
        const files = state.folders[currentPath].files;
        const index = files.indexOf(oldFileName);
        if (index > -1) {
            files[index] = newName; // Replace old name with new name
        } else {
             // Inconsistency: File was in path map but not folder list? Add it.
             console.warn(`Inconsistency: File ${oldFileName} path map points to ${currentPath}, but not in folder list.`);
             if (!files.includes(newName)) files.push(newName);
        }
    }


    // If the renamed file was currently open, update editor and state
    if (state.currentFile === oldFileName) {
        state.currentFile = newName;
        state.editor.setModel(newModel); // Set the new model
        // Restore view state immediately
        if (state.files[newName].viewState) {
             state.editor.restoreViewState(state.files[newName].viewState);
        }
        dom.languageMode.textContent = `Lang: ${newLanguage}`; // Update status bar
    }

    // Dispose old model to free memory
    fileData.model.dispose();

    // Remove old entries
    delete state.files[oldFileName];
    delete state.filePaths[oldFileName];

    // Update UI
    renderFileTree();
    showMessage(`Renamed file to "${newName}"`, 'success');
}


function renameFolder(oldPath, newName) {
     const folderData = state.folders[oldPath];
     if (!folderData) {
          console.error(`Cannot rename: Folder path "${oldPath}" not found.`);
          return;
     }

     // Determine parent path
     const pathParts = oldPath.split('/');
     pathParts.pop(); // Remove current name
     const parentPath = pathParts.length > 0 ? pathParts.join('/') : 'root';

     // Construct new path
     const newPath = parentPath === 'root' ? newName : `${parentPath}/${newName}`;

     // Check if new path already exists
     if (state.folders[newPath]) {
          showMessage(`Folder named "${newName}" already exists in "${parentPath === 'root' ? 'Root' : state.folders[parentPath].name}".`, 'error');
          return;
     }
     if (!state.folders[parentPath]) {
          console.error(`Cannot rename: Parent folder "${parentPath}" not found.`);
           showMessage(`Error: Parent folder not found`, 'error');
          return;
     }

     // --- Update Process ---
     // 1. Create new entry for the folder with the new path and name.
     // 2. Recursively update paths for all descendant folders and files.
     // 3. Update the parent folder's subfolder list.
     // 4. Delete the old folder entry.

     // 1. Create new folder entry (shallow copy of files/subfolders initially)
     state.folders[newPath] = {
          ...folderData, // Copy properties like files, subfolders arrays
          name: newName,
          path: newPath
     };


     // 2. Update descendants recursively
     updateDescendantPaths(oldPath, newPath);


     // 3. Update parent's subfolder list
     const parentSubfolders = state.folders[parentPath].subfolders;
     const indexInParent = parentSubfolders.indexOf(oldPath);
     if (index > -1) {
          parentSubfolders[indexInParent] = newPath; // Replace old path with new path
     } else {
          // Inconsistency? Add the new path if old wasn't found.
          console.warn(`Inconsistency: Renaming folder ${oldPath} not found in parent ${parentPath}'s subfolders.`);
          if (!parentSubfolders.includes(newPath)) parentSubfolders.push(newPath);
     }


     // 4. Delete the old folder entry
     delete state.folders[oldPath];


      // Update lastUsedFolder if it was the renamed folder or a descendant
      if (state.lastUsedFolder === oldPath || state.lastUsedFolder.startsWith(oldPath + '/')) {
         state.lastUsedFolder = state.lastUsedFolder.replace(oldPath, newPath); // Update path
      }


     // Update UI
     renderFileTree();
     showMessage(`Renamed folder to "${newName}"`, 'success');
}

// Helper for renameFolder: Recursively updates paths of children
function updateDescendantPaths(oldBasePath, newBasePath) {
     const folderData = state.folders[newBasePath]; // Use the *new* path to get the data

     // Update paths for files directly within this folder
     folderData.files.forEach(fileName => {
          state.filePaths[fileName] = newBasePath;
          if(state.files[fileName]) state.files[fileName].path = newBasePath;
     });


     // Update paths for subfolders and recurse
     // Must iterate over a copy of subfolders array as it might be modified inside loop (if rename changes structure)
     const subfoldersToUpdate = [...folderData.subfolders];
     folderData.subfolders = []; // Clear original array, will repopulate with new paths

     subfoldersToUpdate.forEach(oldSubfolderPath => {
          // Construct the expected new path for the subfolder
          // Example: oldBase = 'src', newBase = 'source', oldSub = 'src/utils' -> newSub = 'source/utils'
          const relativePath = oldSubfolderPath.substring(oldBasePath.length); // Should start with '/'
          const newSubfolderPath = newBasePath + relativePath;


          // Recursively update the subfolder (which should now exist at newSubfolderPath in state.folders)
           if (state.folders[newSubfolderPath]) {
                 updateDescendantPaths(oldSubfolderPath, newSubfolderPath); // Recurse with old and new paths for *this specific subfolder*
                 // Add the *new* path to the current folder's subfolder list
                 folderData.subfolders.push(newSubfolderPath);
           } else {
                console.error(`Inconsistency during rename: Expected subfolder ${newSubfolderPath} not found.`);
           }
     });
}


function deleteFile(fileName) {
     // Use internal helper to ensure consistency
     if (deleteFileInternal(fileName)) {
          renderFileTree(); // Update UI only if deletion happened
          showMessage(`Deleted file: ${fileName}`, 'success');
     }
}


// Internal delete function to handle state updates, returns true if deleted
function deleteFileInternal(fileName, specificPath = null) {
     const path = specificPath ?? state.filePaths[fileName]; // Use specific path if provided (for cut/paste source removal)

     if (!state.files[fileName] || path === undefined) {
          console.warn(`Cannot delete file "${fileName}": Not found in state or path map.`);
          return false; // Indicate not deleted
     }

     // Remove from folder's file list
     if (state.folders[path]) {
          const files = state.folders[path].files;
          const index = files.indexOf(fileName);
          if (index > -1) {
               files.splice(index, 1);
          }
     } else {
          console.warn(`Folder "${path}" not found when deleting file "${fileName}".`);
     }


     // If the deleted file is currently open, clear the editor
     if (state.currentFile === fileName) {
          state.editor.setModel(null); // Clear model
          state.currentFile = null;
          dom.downloadBtn.disabled = true;
          dom.languageMode.textContent = 'No file open';
          dom.cursorPosition.textContent = 'Line: 1, Col: 1';
     }

     // Dispose Monaco model to free memory
     if (state.files[fileName].model) {
          state.files[fileName].model.dispose();
     }


     // Remove from state
     delete state.files[fileName];
     // Only remove from path map if we weren't given a specific path
     // If specificPath was given, it might be a duplicate name from another folder
     if (!specificPath) {
        delete state.filePaths[fileName];
     } else {
         // If specificPath was given, verify that the filePaths entry actually matched it before deleting.
         // This prevents deleting the path entry for a duplicate filename in another folder.
         if (state.filePaths[fileName] === specificPath) {
              delete state.filePaths[fileName];
         }
     }


     return true; // Indicate deletion occurred
}


function deleteFolder(folderPath) {
     const folderData = state.folders[folderPath];
     const folderName = folderData?.name; // Get name before potential deletion

     if (!folderData || folderPath === 'root') {
          console.error(`Cannot delete folder: Path "${folderPath}" is invalid or root.`);
          return;
     }


     // --- Deletion Process ---
     // 1. Recursively delete all descendant files and folders.
     // 2. Remove the folder from its parent's subfolder list.
     // 3. Delete the folder's own entry.

     // 1. Delete descendants
     // Use copies of arrays as they will be modified by deletion functions
     const filesToDelete = [...folderData.files];
     const subfoldersToDelete = [...folderData.subfolders];

     filesToDelete.forEach(fileName => {
          deleteFileInternal(fileName, folderPath); // Delete file specifically from this path
     });

     subfoldersToDelete.forEach(subfolderPath => {
          deleteFolder(subfolderPath); // Recurse
     });


     // 2. Remove from parent
     const pathParts = folderPath.split('/');
     pathParts.pop();
     const parentPath = pathParts.length > 0 ? pathParts.join('/') : 'root';

     if (state.folders[parentPath]) {
          const parentSubfolders = state.folders[parentPath].subfolders;
          const index = parentSubfolders.indexOf(folderPath);
          if (index > -1) {
               parentSubfolders.splice(index, 1);
          }
     } else {
          console.warn(`Parent folder "${parentPath}" not found when deleting folder "${folderPath}".`);
     }


      // Update lastUsedFolder if it was the deleted folder or a descendant
      if (state.lastUsedFolder === folderPath || state.lastUsedFolder.startsWith(folderPath + '/')) {
          state.lastUsedFolder = parentPath; // Reset to parent folder
      }


     // 3. Delete folder entry itself
     delete state.folders[folderPath];

     // Update UI
     renderFileTree();
     showMessage(`Deleted folder: ${folderName}`, 'success');
}

// --- Utility Functions ---

function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`));
        reader.readAsText(file); // Assume text files
    });
}

function getLanguageForFile(filename) {
    // Monaco's built-in detection is often better, but this provides explicit mapping
     const extension = filename.split('.').pop()?.toLowerCase();
     if (!extension) return 'plaintext';

     // Use Monaco's languages registry if possible (more accurate)
     if (window.monaco && monaco.languages) {
         const languages = monaco.languages.getLanguages();
         const lang = languages.find(l => l.extensions?.includes('.' + extension));
         if (lang) return lang.id;
     }


    // Fallback mapping
    const langMap = {
        'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
        'html': 'html', 'htm': 'html',
        'css': 'css', 'scss': 'scss', 'less': 'less',
        'json': 'json', 'jsonc': 'json', 'geojson': 'json',
        'md': 'markdown', 'markdown': 'markdown',
        'py': 'python', 'pyw': 'python',
        'php': 'php', 'phtml': 'php',
        'rb': 'ruby', 'rbw': 'ruby',
        'java': 'java', 'jsp': 'java',
        'c': 'c', 'h': 'c',
        'cpp': 'cpp', 'hpp': 'cpp', 'cxx': 'cpp', 'hxx': 'cpp', 'cc': 'cpp', 'hh': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'ts': 'typescript',
        'tsx': 'typescript', // Monaco usually handles TSX within typescript
        'jsx': 'javascript', // Monaco usually handles JSX within javascript
        'xml': 'xml', 'xaml': 'xml', 'svg': 'xml', 'plist': 'xml', 'csproj': 'xml',
        'sql': 'sql',
        'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell',
        'yml': 'yaml', 'yaml': 'yaml',
        'txt': 'plaintext',
        'log': 'plaintext',
        'ini': 'ini',
        'bat': 'bat', 'cmd': 'bat',
        'ps1': 'powershell', 'psm1': 'powershell',
        'dockerfile': 'dockerfile',
        'graphql': 'graphql', 'gql': 'graphql',
        'lua': 'lua',
        'r': 'r',
        'swift': 'swift',
        'vb': 'vb',
        'dart': 'dart',
        'rs': 'rust',
        'kt': 'kotlin', 'kts': 'kotlin',
        'pl': 'perl', 'pm': 'perl',
        // Add more mappings as needed
    };

    return langMap[extension] || 'plaintext';
}

// --- Import Modal Handlers ---
function handleImportFiles(fileList) {
    // fileList: FileList or array of File objects
    // Use the same logic as handleFileUpload, but without the input element
    const event = { target: { files: fileList } };
    handleFileUpload(event);
}
function handleImportUrl(url) {
    // Check which import type is selected (file or ZIP)
    if (!url) {
        url = dom.importUrlInput?.value?.trim();
    }
    
    if (!url) {
        showMessage("Please enter a URL", 'error');
        return;
    }
    
    // Determine if this is a file or ZIP based on radio button selection
    const isZipImport = dom.urlTypeZip && dom.urlTypeZip.checked;
    
    if (isZipImport) {
        // Handle as ZIP archive
        importZipFile(url);
    } else {
        // Handle as single file (existing functionality)
        dom.urlInput = { value: url }; // Temporary override for fetchFromUrl
        fetchFromUrl();
        dom.urlInput = document.getElementById('url-input'); // Restore
    }
}
function handleImportRepo(repo) {
    // Use the same logic as fetchGitHubRepo, but with a custom repo
    dom.githubRepo = { value: repo };
    fetchGitHubRepo();
    dom.githubRepo = document.getElementById('github-repo');
}

// --- Import ZIP Archive ---
async function importZipFile(url) {
    if (!url) {
        showMessage("Please enter a URL for the ZIP archive", 'error');
        return;
    }

    setLoading(true);
    try {
        // Fetch the ZIP file
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        // Get the ZIP data as arrayBuffer
        const zipData = await response.arrayBuffer();
        
        // Use JSZip to parse the archive
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library not found. Cannot extract ZIP archive.");
        }
        
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipData);
        
        // Track stats
        let extractedFiles = 0;
        let extractedFolders = new Set();
        let firstFileName = null;
        
        // Process all files in the ZIP
        const filePromises = [];
        
        // A sequential processing function to maintain folder hierarchy
        const processZipEntries = async () => {
            // Get all file paths, sort them to ensure parent folders are created first
            const filePaths = Object.keys(contents.files).sort();
            
            for (const filePath of filePaths) {
                const zipObj = contents.files[filePath];
                
                // Skip directories, we'll create them as needed when processing files
                if (zipObj.dir) continue;
                
                try {
                    // Get file content
                    const content = await zipObj.async('text');
                    
                    // Parse path to get file name and folder structure
                    const pathParts = filePath.split('/');
                    const fileName = pathParts.pop();
                    
                    if (!fileName) continue; // Skip if no valid filename (e.g., empty paths)
                    
                    // Handle directory structure
                    let currentFolderPath = 'root';
                    
                    // Create folders in the path
                    for (const folderName of pathParts) {
                        if (!folderName) continue; // Skip empty parts
                        
                        const nextPath = currentFolderPath === 'root' 
                            ? folderName 
                            : `${currentFolderPath}/${folderName}`;
                        
                        // Create folder if it doesn't exist
                        if (!state.folders[nextPath]) {
                            state.folders[nextPath] = {
                                name: folderName,
                                files: [],
                                subfolders: [],
                                path: nextPath
                            };
                            
                            // Link to parent
                            if (state.folders[currentFolderPath] &&
                                !state.folders[currentFolderPath].subfolders.includes(nextPath)) {
                                state.folders[currentFolderPath].subfolders.push(nextPath);
                            }
                            
                            extractedFolders.add(nextPath);
                        }
                        
                        currentFolderPath = nextPath;
                    }
                    
                    // Check for file collision
                    if (state.files[fileName] && state.filePaths[fileName] === currentFolderPath) {
                        console.warn(`ZIP file "${fileName}" overwriting existing file in "${currentFolderPath}".`);
                        deleteFileInternal(fileName);
                    }
                    
                    // Create the model and add to state
                    const language = getLanguageForFile(fileName);
                    createEditorModel(fileName, content, language, currentFolderPath);
                    
                    if (!firstFileName) {
                        firstFileName = fileName;
                    }
                    
                    extractedFiles++;
                } catch (error) {
                    console.error(`Error extracting file ${filePath}:`, error);
                }
            }
        };
        
        // Process all entries sequentially
        await processZipEntries();
        
        // Update UI
        renderFileTree();
        
        // Open the first extracted file if no file is currently open
        if (firstFileName && (!state.currentFile || !state.files[state.currentFile])) {
            openFile(firstFileName);
        }
        
        showMessage(`Extracted ${extractedFiles} files and ${extractedFolders.size} folders from ZIP archive`, 'success');
    } catch (error) {
        console.error("Error importing ZIP:", error);
        showMessage(`Error importing ZIP: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

// --- Handle Directory Drop Support ---
async function handleDroppedItems(items) {
    setLoading(true);
    
    try {
        // Track stats and first file for opening
        let processedFiles = 0;
        let processedFolders = 0;
        let firstFileName = null;
        
        // Use Set to track created folders to avoid duplicates
        const createdFolders = new Set();
        
        // Process entries recursively
        async function processEntry(entry, basePath = '') {
            if (entry.isFile) {
                try {
                    // Get file as FileSystemFileEntry
                    const file = await new Promise((resolve, reject) => {
                        entry.file(resolve, reject);
                    });
                    
                    // Read file content
                    const content = await readFileContent(file);
                    const fileName = file.name;
                    
                    // Determine target folder path in our structure
                    const folderPath = basePath ? basePath : 'root';
                    
                    // Check for file collision
                    if (state.files[fileName] && state.filePaths[fileName] === folderPath) {
                        console.warn(`File "${fileName}" already exists in "${folderPath}". Overwriting.`);
                        deleteFileInternal(fileName);
                    }
                    
                    // Create the model and add to state
                    const language = getLanguageForFile(fileName);
                    createEditorModel(fileName, content, language, folderPath);
                    
                    processedFiles++;
                    
                    // Track first file for opening
                    if (!firstFileName) {
                        firstFileName = fileName;
                    }
                } catch (error) {
                    console.error(`Error processing dropped file ${entry.fullPath}:`, error);
                }
            } 
            else if (entry.isDirectory) {
                try {
                    // Get name of this directory
                    const dirName = entry.name;
                    
                    // Create folder path (handle root specially)
                    const folderPath = basePath ? 
                        (basePath === 'root' ? dirName : `${basePath}/${dirName}`) : 
                        dirName;
                    
                    // Create folder if it doesn't exist
                    if (!state.folders[folderPath] && !createdFolders.has(folderPath)) {
                        // Determine parent path
                        const parentPath = basePath || 'root';
                        
                        // Create folder entry
                        state.folders[folderPath] = {
                            name: dirName,
                            files: [],
                            subfolders: [],
                            path: folderPath
                        };
                        
                        // Link to parent
                        if (state.folders[parentPath] && 
                            !state.folders[parentPath].subfolders.includes(folderPath)) {
                            state.folders[parentPath].subfolders.push(folderPath);
                        }
                        
                        createdFolders.add(folderPath);
                        processedFolders++;
                    }
                    
                    // Read directory entries
                    const dirReader = entry.createReader();
                    
                    // Use recursion to process all entries
                    let entries = [];
                    let readEntries = async () => {
                        const newEntries = await new Promise((resolve, reject) => {
                            dirReader.readEntries(resolve, reject);
                        });
                        
                        if (newEntries.length > 0) {
                            entries = entries.concat(newEntries);
                            // Continue reading if more entries
                            await readEntries();
                        }
                    };
                    
                    // Start reading entries
                    await readEntries();
                    
                    // Process all collected entries
                    for (const childEntry of entries) {
                        await processEntry(childEntry, folderPath);
                    }
                } catch (error) {
                    console.error(`Error processing dropped directory ${entry.fullPath}:`, error);
                }
            }
        }
        
        // Process all dropped items
        const promises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    promises.push(processEntry(entry));
                }
            }
        }
        
        // Wait for all entries to be processed
        await Promise.all(promises);
        
        // Update UI
        renderFileTree();
        
        // Open the first file if no file is currently open
        if (firstFileName && (!state.currentFile || !state.files[state.currentFile])) {
            openFile(firstFileName);
        }
        
        showMessage(`Imported ${processedFiles} files from ${processedFolders} folders`, 'success');
    } catch (error) {
        console.error("Error processing dropped items:", error);
        showMessage(`Error processing dropped items: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

if (dom.importDropzone) {
        // Enable directory drop by preventing default on dragover
        dom.importDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy'; // Show copy icon
            dom.importDropzone.classList.add('dragover');
        });
        dom.importDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dom.importDropzone.classList.remove('dragover');
        });
        dom.importDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.importDropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            
            // Check if we have items (which can include directories)
            if (e.dataTransfer.items) {
                // Handle directory drop using webkitGetAsEntry API
                const items = e.dataTransfer.items;
                if (items.length > 0 && items[0].webkitGetAsEntry) {
                    handleDroppedItems(items);
                    dom.importModal.style.display = 'none';
                    return;
                }
            }
            
            // Fallback to regular file handling
            if (files && files.length > 0) {
                handleImportFiles(files);
                dom.importModal.style.display = 'none';
            }
        });
    }