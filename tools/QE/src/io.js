/**
 * @file src/io.js
 * @purpose Handles Input/Output operations: file/folder uploads, URL/GitHub imports,
 *          and downloading files/workspace.
 * @usage Imported by main.js, ui.js, and event handlers.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring. Consolidated all I/O related functions:
 *               uploads, drag/drop, URL/GitHub import, downloads.
 */

// --- Module Imports ---
import * as state from './state.js';
import * as ui from './ui.js';
import * as filesystem from './filesystem.js';
import { readFileContent, getLanguageForFile } from './utils.js';

// --- Constants ---
const GITHUB_API_BASE = 'https://api.github.com';

// --- File/Folder Upload & Drop ---

/**
 * Handles file selection via the hidden file input element.
 * @param {Event} event - The input change event.
 */
export async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        ui.showMessage("No files selected.", 'info');
        return; // Exit if no files
    }
    
    // Hide the import modal immediately when files are selected
    ui.hideModal(ui.domElements.importModal);
    
    await processUploadedFiles(files, state.getLastUsedFolder()); // Process into last active folder
    // Clear the file input value to allow re-uploading the same file
    event.target.value = '';
}

/**
 * Handles folder selection via the hidden directory input element.
 * @param {Event} event - The change event from the folder input.
 */
export async function handleFolderUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        ui.showMessage("No files selected in folder.", 'info');
        return;
    }
    
    // Hide the import modal immediately when files are selected
    ui.hideModal(ui.domElements.importModal);
    
    // Use the existing processUploadedFolder function to handle the folder structure
    await processUploadedFolder(files, state.getLastUsedFolder());
    
    // Clear the input value to allow re-uploading the same folder
    event.target.value = '';
}

/**
 * Processes a list of files (from input or drop) to be added to a specific folder.
 * @param {FileList | File[]} files - The files to process.
 * @param {string} targetFolderPath - The destination folder path in the workspace.
 */
async function processUploadedFiles(files, targetFolderPath) {
    ui.setLoading(true);
    let firstFileName = null;
    let successCount = 0;

    try {
        for (const file of files) {
            const fileName = file.name;
            const filePath = state.getFilePath(fileName);

            // Check for collision in the target folder
            if (state.getFile(fileName) && filePath === targetFolderPath) {
                // Basic overwrite for now, could prompt user
                console.warn(`Upload: Overwriting existing file "${fileName}" in "${targetFolderPath}".`);
                // Use internal delete to remove before adding again
                filesystem.deleteFileInternal(fileName, targetFolderPath);
            } else if (state.getFile(fileName)) {
                console.warn(`Upload: File name "${fileName}" exists in another folder ("${filePath}"). Creating duplicate in "${targetFolderPath}".`);
            }

            try {
                const content = await readFileContent(file);
                const language = getLanguageForFile(fileName);
                // Use filesystem module to create model and update state
                const model = filesystem.createEditorModel(fileName, content, language, targetFolderPath);
                if (model) {
                    if (!firstFileName) firstFileName = fileName;
                    successCount++;
                }
            } catch (readError) {
                 console.error(`Error reading file ${fileName}:`, readError);
                 ui.showMessage(`Error reading file ${fileName}`, 'error');
            }
        }

        ui.renderFileTree(); // Update UI once after processing all files

        // Open the first uploaded file if none is currently open
        if (firstFileName && !state.getCurrentFile()) {
            filesystem.openFile(firstFileName);
        }

        if (successCount > 0) {
            ui.showMessage(`Uploaded ${successCount}/${files.length} file(s) to "${targetFolderPath === 'root' ? 'Root' : state.getFolder(targetFolderPath)?.name}".`, 'success');
        } else if (files.length > 0) {
             ui.showMessage(`Failed to upload selected files.`, 'error');
        }

    } catch (error) {
        console.error("Error processing uploaded files:", error);
        ui.showMessage("An unexpected error occurred during file upload.", 'error');
    } finally {
        ui.setLoading(false);
    }
}


/**
 * Processes files from a folder upload (input[webkitdirectory]), maintaining structure.
 * @param {FileList} files - The files containing webkitRelativePath.
 * @param {string} importBaseFolder - The workspace folder path to import into ('root' or other).
 */
async function processUploadedFolder(files, importBaseFolder) {
    ui.setLoading(true);
    let firstFileName = null;
    let firstFilePath = null;
    let successCount = 0;
    const createdFoldersThisImport = new Set();

    // Ensure base folder exists or is root
    if (importBaseFolder !== 'root' && !state.getFolder(importBaseFolder)) {
         ui.showMessage(`Import target folder "${importBaseFolder}" not found. Importing to Root instead.`, 'warning');
         importBaseFolder = 'root';
    }
     if (importBaseFolder !== 'root') {
         createdFoldersThisImport.add(importBaseFolder);
     }


    try {
        const filePromises = [];
        for (const file of files) {
            let relativePath = file.webkitRelativePath;
            if (!relativePath) {
                console.warn("Browser does not support webkitRelativePath. Uploading file directly to target folder.");
                // Fallback: Treat as single file upload into the base folder
                 filePromises.push((async () => {
                     try {
                         const fileName = file.name;
                          if (state.getFile(fileName) && state.getFilePath(fileName) === importBaseFolder) {
                              console.warn(`Folder Upload Fallback: Overwriting ${fileName} in ${importBaseFolder}`);
                              filesystem.deleteFileInternal(fileName, importBaseFolder);
                          }
                         const content = await readFileContent(file);
                         const language = getLanguageForFile(fileName);
                         const model = filesystem.createEditorModel(fileName, content, language, importBaseFolder);
                         if(model) successCount++;
                          if (!firstFileName) firstFileName = fileName;
                     } catch (fbError) { console.error("Folder Upload Fallback Error:", fbError); }
                 })());
                continue; // Skip structured processing for this file
            }

             // Normal processing with relative path
             filePromises.push((async () => {
                 try {
                     const pathParts = relativePath.split('/');
                     const fileName = pathParts.pop(); // Actual file name
                     if (!fileName) return; // Skip if path ends in slash?

                     let currentFolderPath = importBaseFolder;

                     // Create nested folders if they don't exist
                     for (const folderName of pathParts) {
                         if (!folderName) continue; // Skip empty parts

                         // Construct the full path within the workspace
                         const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;

                         // Check if folder exists OR was already created in this batch
                         if (!state.getFolder(nextPath) && !createdFoldersThisImport.has(nextPath)) {
                             // Create folder using filesystem module
                              filesystem.createNewFolder(folderName, currentFolderPath); // This handles state update and linking
                              // Check if creation succeeded (createNewFolder shows messages, but check state)
                              if(state.getFolder(nextPath)) {
                                 createdFoldersThisImport.add(nextPath); // Mark as created *if successful*
                              } else {
                                  console.error(`Failed to create intermediate folder ${folderName} in ${currentFolderPath}. Aborting path for ${fileName}`);
                                  return; // Stop processing this file if folder creation fails
                              }
                         } else if (!state.getFolder(nextPath) && createdFoldersThisImport.has(nextPath)) {
                              // Folder was created in this batch, proceed
                         } else if (!state.getFolder(nextPath)) {
                              // Should not happen if checks above are correct, but handle defensively
                              console.error(`Target folder ${nextPath} vanished during import? Aborting path for ${fileName}`);
                              return;
                         }
                         currentFolderPath = nextPath; // Move deeper
                     }

                     // Check for file collision within the final target folder
                     if (state.getFile(fileName) && state.getFilePath(fileName) === currentFolderPath) {
                         console.warn(`Folder Upload: Overwriting file "${fileName}" in "${currentFolderPath}".`);
                         filesystem.deleteFileInternal(fileName, currentFolderPath);
                     } else if (state.getFile(fileName)) {
                         console.warn(`Folder Upload: File name "${fileName}" exists elsewhere. Creating duplicate in "${currentFolderPath}".`);
                     }

                     // Read file content and create model
                     const content = await readFileContent(file);
                     const language = getLanguageForFile(fileName);
                     const model = filesystem.createEditorModel(fileName, content, language, currentFolderPath);

                     if(model) {
                         successCount++;
                         // Track the first file added
                         if (!firstFileName) {
                             firstFileName = fileName;
                             firstFilePath = currentFolderPath; // Store its path too
                         }
                     }
                 } catch (readError) {
                      console.error(`Error processing file ${relativePath}:`, readError);
                     ui.showMessage(`Error reading file ${file.name}`, 'error');
                 }
             })());
        }

        // Wait for all file processing to complete
        await Promise.all(filePromises);

        ui.renderFileTree(); // Update the UI once

        // Open the first file added if no file is currently open
        if (firstFileName && !state.getCurrentFile()) {
            filesystem.openFile(firstFileName);
        }

        if(successCount > 0) {
            ui.showMessage(`Imported ${successCount} file(s) with folder structure into "${importBaseFolder === 'root' ? 'Root' : state.getFolder(importBaseFolder)?.name}".`, 'success');
        } else if (files.length > 0) {
             ui.showMessage(`Failed to import files from selected folder.`, 'error');
        }

    } catch (error) {
        console.error("Error importing folder:", error);
        ui.showMessage("Error importing folder structure.", 'error');
    } finally {
        ui.setLoading(false);
    }
}

/**
 * Handles items (files/directories) dropped onto the dropzone.
 * Uses FileSystem API (webkitGetAsEntry) if available.
 * @param {DataTransferItemList} items - The items from the drop event.
 */
export async function handleDroppedItems(items) {
    ui.setLoading(true);
    let processedFiles = 0;
    let processedFolders = 0;
    let firstFileName = null;
    const createdFolders = new Set(); // Track folders created in this operation

    try {
        // Recursive function to process FileSystemEntry objects
        async function processEntry(entry, currentWorkspacePath = 'root') {
            if (!entry) return;

            if (entry.isFile) {
                try {
                    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
                    const fileName = file.name;

                    // Check for collision
                    if (state.getFile(fileName) && state.getFilePath(fileName) === currentWorkspacePath) {
                        console.warn(`Drop: Overwriting existing file "${fileName}" in "${currentWorkspacePath}".`);
                        filesystem.deleteFileInternal(fileName, currentWorkspacePath);
                    } else if (state.getFile(fileName)) {
                        console.warn(`Drop: File name "${fileName}" exists elsewhere. Creating duplicate in "${currentWorkspacePath}".`);
                    }

                    const content = await readFileContent(file);
                    const language = getLanguageForFile(fileName);
                    const model = filesystem.createEditorModel(fileName, content, language, currentWorkspacePath);
                    if (model) {
                        processedFiles++;
                        if (!firstFileName) firstFileName = fileName;
                    }
                } catch (error) {
                    console.error(`Error processing dropped file ${entry.fullPath}:`, error);
                    ui.showMessage(`Error processing file ${entry.name}`, 'error');
                }
            } else if (entry.isDirectory) {
                const dirName = entry.name;
                const newWorkspacePath = currentWorkspacePath === 'root' ? dirName : `${currentWorkspacePath}/${dirName}`;

                try {
                    // Create folder if it doesn't exist and wasn't just created
                    if (!state.getFolder(newWorkspacePath) && !createdFolders.has(newWorkspacePath)) {
                         filesystem.createNewFolder(dirName, currentWorkspacePath);
                         if(state.getFolder(newWorkspacePath)) {
                             createdFolders.add(newWorkspacePath);
                             processedFolders++;
                         } else {
                              console.error(`Drop: Failed to create directory "${dirName}" in "${currentWorkspacePath}". Skipping contents.`);
                              return; // Skip processing this directory's contents
                         }
                    } else if (!state.getFolder(newWorkspacePath)) {
                        console.error(`Drop: Directory "${newWorkspacePath}" failed creation previously or vanished. Skipping contents.`);
                        return; // Skip processing this directory's contents
                    }


                    // Process directory contents
                    const dirReader = entry.createReader();
                    const entries = await new Promise((resolve, reject) => {
                        let allEntries = [];
                        function readBatch() {
                            dirReader.readEntries(batch => {
                                if (batch.length === 0) {
                                    resolve(allEntries); // All entries read
                                } else {
                                    allEntries = allEntries.concat(batch);
                                    readBatch(); // Read next batch
                                }
                            }, reject); // Pass rejection handler
                        }
                        readBatch();
                    });

                    // Process all child entries recursively
                    const entryPromises = entries.map(childEntry => processEntry(childEntry, newWorkspacePath));
                    await Promise.all(entryPromises);

                } catch (error) {
                    console.error(`Error processing dropped directory ${entry.fullPath}:`, error);
                    ui.showMessage(`Error processing directory ${entry.name}`, 'error');
                }
            }
        }

        // Process all top-level dropped items
        const topLevelPromises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (typeof item.webkitGetAsEntry === 'function') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    topLevelPromises.push(processEntry(entry)); // Process from root
                }
            } else {
                 console.warn("Browser does not fully support directory drop API.");
                 // Fallback? Could try processing item.getAsFile() if it's a file.
                 if (item.kind === 'file') {
                      const file = item.getAsFile();
                      if(file) {
                          await processUploadedFiles([file], 'root'); // Process as single file to root
                      }
                 }
            }
        }
        await Promise.all(topLevelPromises);

        ui.renderFileTree();

        if (firstFileName && !state.getCurrentFile()) {
            filesystem.openFile(firstFileName);
        }
        ui.showMessage(`Imported ${processedFiles} files and ${processedFolders} folders via drop.`, 'success');

    } catch (error) {
        console.error("Error processing dropped items:", error);
        ui.showMessage("An error occurred processing dropped items.", 'error');
    } finally {
        ui.setLoading(false);
    }
}

// --- URL Import ---

/**
 * Handles the 'Import from URL' button click.
 * Determines if it's a file or ZIP and calls the appropriate function.
 */
export function handleImportUrl() {
    const url = ui.domElements.importUrlInput?.value?.trim();
    if (!url) {
        ui.showMessage("Please enter a URL", 'error');
        return;
    }
    const isZipImport = ui.domElements.urlTypeZip?.checked;

    ui.hideModal(ui.domElements.importModal); // Close modal immediately

    if (isZipImport) {
        importZipFromUrl(url);
    } else {
        fetchFromUrl(url);
    }
}

/**
 * Fetches content from a URL, assumes it's a single file.
 * @param {string} url - The URL to fetch.
 */
async function fetchFromUrl(url) {
    ui.setLoading(true);
    let fileName = 'imported-file.txt'; // Default

    try {
        // Basic URL validation
        try { new URL(url); } catch (_) { throw new Error("Invalid URL format"); }

        console.log(`Fetching file from URL: ${url}`);
        const response = await fetch(url); // Add CORS handling/proxy if needed

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        // Try to extract filename from URL path
        try {
            const pathName = new URL(url).pathname;
            const nameFromPath = pathName.split('/').pop();
            // Basic sanitization, remove query params etc.
            if (nameFromPath) fileName = nameFromPath.split('?')[0].split('#')[0] || fileName;
        } catch (e) { console.warn("Could not parse URL to get filename, using default."); }


        // Handle potential duplicates in root folder
        const targetFolder = 'root';
        if (state.getFile(fileName) && state.getFilePath(fileName) === targetFolder) {
             console.warn(`URL Import: Overwriting existing file "${fileName}" in "${targetFolder}".`);
             filesystem.deleteFileInternal(fileName, targetFolder);
        }

        // Create model and open file (using filesystem module)
        const language = getLanguageForFile(fileName);
        const model = filesystem.createEditorModel(fileName, content, language, targetFolder);

        if (model) {
            ui.renderFileTree();
            filesystem.openFile(fileName);
            ui.showMessage(`Imported file: ${fileName}`, 'success');
        } else {
             ui.showMessage(`Failed to create model for imported file: ${fileName}`, 'error');
        }

    } catch (error) {
        console.error("Error fetching URL:", error);
        ui.showMessage(`Error importing from URL: ${error.message}`, 'error');
    } finally {
        ui.setLoading(false);
    }
}

/**
 * Fetches a ZIP archive from a URL and extracts its contents into the workspace.
 * @param {string} url - The URL of the ZIP file.
 */
async function importZipFromUrl(url) {
    if (typeof JSZip === 'undefined') {
        ui.showMessage("JSZip library not found. Cannot import ZIP.", 'error');
        console.error("JSZip library is required for ZIP import.");
        return;
    }
    ui.setLoading(true);
    ui.showMessage("Importing ZIP from URL...", 'info', 5000); // Show progress

    try {
        // Basic URL validation
        try { new URL(url); } catch (_) { throw new Error("Invalid URL format"); }

        console.log(`Fetching ZIP from URL: ${url}`);
        const response = await fetch(url); // Add CORS handling/proxy if needed
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const zipData = await response.arrayBuffer();
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipData);

        let extractedFiles = 0;
        let firstFileName = null;
        const createdFolders = new Set();
        const filePromises = [];

        // Process ZIP entries
        contents.forEach((relativePath, zipEntry) => {
            // Skip directories explicitly listed, create them implicitly via file paths
            if (zipEntry.dir) return;

            filePromises.push((async () => {
                try {
                    const content = await zipEntry.async('text');
                    const pathParts = relativePath.split('/').filter(part => part); // Filter empty parts
                    const fileName = pathParts.pop();
                    if (!fileName) return; // Skip entries without a filename

                    let currentFolderPath = 'root'; // Import to root by default

                    // Create folder structure
                    for (const folderName of pathParts) {
                        const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;
                        if (!state.getFolder(nextPath) && !createdFolders.has(nextPath)) {
                            filesystem.createNewFolder(folderName, currentFolderPath);
                            if(state.getFolder(nextPath)){
                                createdFolders.add(nextPath);
                            } else {
                                console.error(`ZIP Import: Failed to create folder ${nextPath}. Skipping file ${fileName}.`);
                                return;
                            }
                        } else if (!state.getFolder(nextPath)){
                             console.error(`ZIP Import: Folder ${nextPath} vanished or failed previous creation. Skipping file ${fileName}.`);
                             return;
                        }
                        currentFolderPath = nextPath;
                    }

                    // Handle file collision
                     if (state.getFile(fileName) && state.getFilePath(fileName) === currentFolderPath) {
                         console.warn(`ZIP Import: Overwriting file "${fileName}" in "${currentFolderPath}".`);
                         filesystem.deleteFileInternal(fileName, currentFolderPath);
                     } else if (state.getFile(fileName)) {
                         console.warn(`ZIP Import: File name "${fileName}" exists elsewhere. Creating duplicate in "${currentFolderPath}".`);
                     }

                    // Create model
                    const language = getLanguageForFile(fileName);
                    const model = filesystem.createEditorModel(fileName, content, language, currentFolderPath);

                    if (model) {
                        extractedFiles++;
                        if (!firstFileName) firstFileName = fileName;
                    }
                } catch (extractError) {
                    console.error(`Error extracting file ${relativePath} from ZIP:`, extractError);
                    ui.showMessage(`Error processing ${relativePath} in ZIP`, 'error');
                }
            })());
        });

        await Promise.all(filePromises);

        ui.renderFileTree();
        if (firstFileName && !state.getCurrentFile()) {
            filesystem.openFile(firstFileName);
        }
        ui.showMessage(`Extracted ${extractedFiles} file(s) from ZIP archive.`, 'success');

    } catch (error) {
        console.error("Error importing ZIP from URL:", error);
        ui.showMessage(`Error importing ZIP: ${error.message}`, 'error');
    } finally {
        ui.setLoading(false);
    }
}


// --- GitHub Import ---

/**
 * Handles the 'Browse GitHub Repo' button click.
 * Parses input and fetches initial repo contents.
 */
export async function handleImportRepo() {
    let repoInput = ui.domElements.importRepoInput?.value?.trim();
    if (!repoInput) {
        ui.showMessage("Please enter a GitHub repo (owner/repo) or URL", 'error');
        return;
    }
    ui.hideModal(ui.domElements.importModal);

    let owner, repo;
    try {
        // Check if it's a full URL
        if (repoInput.includes('github.com')) {
            const url = new URL(repoInput);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (url.hostname !== 'github.com' || pathParts.length < 2) throw new Error();
            owner = pathParts[0];
            repo = pathParts[1].replace('.git', '');
        } else {
            // Assume owner/repo format
            const parts = repoInput.split('/');
            if (parts.length < 2 || !parts[0] || !parts[1]) throw new Error();
            owner = parts[0];
            repo = parts[1].replace('.git', '');
        }
    } catch (_) {
         ui.showMessage("Invalid GitHub repo format. Use 'owner/repo' or full URL.", 'error');
         return;
    }

    fetchGitHubRepoContents(owner, repo); // Fetch root contents
}


/**
 * Fetches the contents of a GitHub repository path (root or subdirectory).
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {string} [path=''] - Path within the repo (empty for root).
 * @param {string} [branch=''] - Branch name (fetches default if empty).
 */
export async function fetchGitHubRepoContents(owner, repo, path = '', branch = '') {
    ui.setLoading(true);
    ui.domElements.repoFileList.innerHTML = '<li>Loading repository contents...</li>'; // Clear previous list
    ui.domElements.repoInfo.textContent = `Loading ${owner}/${repo}...`;
    ui.showGitHubModal(); // Show the modal


    let defaultBranch = branch;
    try {
         // If branch not specified, fetch repo details to get default branch
         if (!defaultBranch) {
              const repoDetailsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
              console.log(`Fetching repo details: ${repoDetailsUrl}`);
              const repoDetailsResponse = await fetch(repoDetailsUrl);
              if (!repoDetailsResponse.ok) {
                  if (repoDetailsResponse.status === 404) throw new Error(`Repository not found: ${owner}/${repo}`);
                  if (repoDetailsResponse.status === 403) throw new Error(`GitHub API rate limit exceeded.`);
                  throw new Error(`GitHub API error ${repoDetailsResponse.status}`);
              }
              const repoDetails = await repoDetailsResponse.json();
              defaultBranch = repoDetails.default_branch || 'main';
         }


        // Fetch contents
        const contentsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${defaultBranch}`;
        console.log(`Fetching contents: ${contentsUrl}`);
        const response = await fetch(contentsUrl);
        if (!response.ok) {
             if (response.status === 404) throw new Error(`Path not found or empty repo: ${path} (Branch: ${defaultBranch})`);
             if (response.status === 403) throw new Error(`GitHub API rate limit exceeded.`);
            throw new Error(`GitHub API error fetching contents: ${response.status}`);
        }
        const data = await response.json();

        if (!Array.isArray(data)) {
             throw new Error("Unexpected response format from GitHub API.");
        }

        // Display repo info in modal header/info area
        ui.domElements.repoInfo.innerHTML = `<strong>Repo:</strong> ${owner}/${repo} <br> <strong>Branch:</strong> ${defaultBranch} <br> <strong>Path:</strong> /${path || ''} <br> Select files/folders:`;

        // Populate the file list in the modal using UI module function
        await ui.populateRepoFileList(data, owner, repo, defaultBranch, path, ui.domElements.repoFileList);

    } catch (error) {
        console.error("Error fetching GitHub repo contents:", error);
        ui.showMessage(`Error fetching GitHub repo: ${error.message}`, 'error');
        ui.domElements.repoInfo.textContent = `Error: ${error.message}`;
        ui.domElements.repoFileList.innerHTML = `<li>Error loading contents.</li>`;
    } finally {
        ui.setLoading(false);
    }
}

/**
 * Fetches directory contents specifically for folder expansion in the GitHub browser modal.
 * @param {string} apiUrl - The direct GitHub API URL for the directory contents.
 * @returns {Promise<Array>} - A promise resolving to the array of directory contents.
 */
export async function fetchGitHubDirectoryContents(apiUrl) {
     // No separate loading indicator here, UI function handles visual cues
     console.log(`Fetching GitHub directory contents: ${apiUrl}`);
     const response = await fetch(apiUrl);
     if (!response.ok) {
          if (response.status === 403) throw new Error(`GitHub API rate limit exceeded.`);
          throw new Error(`GitHub API error ${response.status}`);
     }
     const dirContents = await response.json();
     if (!Array.isArray(dirContents)) {
        throw new Error("Unexpected response format from GitHub API.");
     }
     return dirContents;
}


/**
 * Handles the 'Import Selected Files' button click in the GitHub modal.
 * Fetches content for selected files and folders and adds them to the workspace.
 */
export async function loadSelectedGitHubFiles() {
    const fileCheckboxes = ui.domElements.repoFileList?.querySelectorAll('.repo-file-checkbox:checked');
    const folderCheckboxes = ui.domElements.repoFileList?.querySelectorAll('.repo-folder-checkbox:checked');
    
    if ((!fileCheckboxes || fileCheckboxes.length === 0) && (!folderCheckboxes || folderCheckboxes.length === 0)) {
        ui.showMessage("No files or folders selected from GitHub repo.", 'info');
        return;
    }

    ui.setLoading(true);
    ui.hideModal(ui.domElements.githubModal); // Close modal

    let loadedCount = 0;
    let firstFileName = null;
    const createdFoldersThisLoad = new Set();

    try {
        // Process individual files
        if (fileCheckboxes && fileCheckboxes.length > 0) {
            ui.showMessage(`Loading ${fileCheckboxes.length} selected files...`, 'info', 2000);
            await processSelectedFiles(fileCheckboxes, createdFoldersThisLoad);
        }
        
        // Process folders (this will involve recursive API calls)
        if (folderCheckboxes && folderCheckboxes.length > 0) {
            ui.showMessage(`Loading ${folderCheckboxes.length} selected folders...`, 'info', 2000);
            for (const checkbox of folderCheckboxes) {
                const folderPath = checkbox.dataset.path;
                const apiUrl = checkbox.dataset.apiUrl;
                
                if (!folderPath || !apiUrl) continue;
                
                try {
                    const processedFiles = await processGitHubFolder(apiUrl, folderPath, createdFoldersThisLoad);
                    loadedCount += processedFiles.length;
                    if (processedFiles.length > 0 && !firstFileName) {
                        firstFileName = processedFiles[0]; // Remember first file for opening
                    }
                } catch (folderError) {
                    console.error(`Error processing GitHub folder ${folderPath}:`, folderError);
                    ui.showMessage(`Error loading folder ${folderPath.split('/').pop()}: ${folderError.message}`, 'error');
                }
            }
        }

        ui.renderFileTree(); // Update UI

        if (loadedCount > 0 && firstFileName && !state.getCurrentFile()) {
            filesystem.openFile(firstFileName); // Open first loaded file if none active
        }

        const totalSelected = (fileCheckboxes?.length || 0) + (folderCheckboxes?.length || 0);
        ui.showMessage(`Imported ${loadedCount} file(s) from GitHub.`, 'success');

    } catch (error) {
        console.error("Unexpected error during GitHub import:", error);
        ui.showMessage("An unexpected error occurred while importing from GitHub.", 'error');
    } finally {
        ui.setLoading(false);
    }
    
    /**
     * Helper function to process selected individual files
     * @param {NodeList} checkboxes - The selected file checkboxes
     * @param {Set<string>} createdFolders - Set to track created folders
     * @returns {Promise<number>} - Number of files processed
     */
    async function processSelectedFiles(checkboxes, createdFolders) {
        let count = 0;
        const filePromises = [];

        checkboxes.forEach(checkbox => {
            const relativePath = checkbox.dataset.path; // Path relative to repo root
            const downloadUrl = checkbox.dataset.url;
            if (!relativePath || !downloadUrl) return;

            filePromises.push((async () => {
                try {
                    console.log(`Fetching GitHub file: ${relativePath} from ${downloadUrl}`);
                    const response = await fetch(downloadUrl); // Fetch raw content
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status} fetching ${relativePath}`);
                    }
                    const content = await response.text();

                    // Determine workspace path and create folders
                    const pathParts = relativePath.split('/');
                    const fileName = pathParts.pop();
                    if (!fileName) return; // Should not happen for files

                    let currentFolderPath = 'root';
                    // Create any needed folder structure
                    for (const folderName of pathParts) {
                        if (!folderName) continue;
                        const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;
                        
                        if (!state.getFolder(nextPath) && !createdFolders.has(nextPath)) {
                            filesystem.createNewFolder(folderName, currentFolderPath);
                            if (state.getFolder(nextPath)) {
                                createdFolders.add(nextPath);
                            } else {
                                console.error(`GH Import: Failed to create folder ${nextPath}. Skipping file ${fileName}.`);
                                return;
                            }
                        } else if (!state.getFolder(nextPath)) {
                            console.error(`GH Import: Folder ${nextPath} vanished. Skipping file ${fileName}.`);
                            return;
                        }
                        currentFolderPath = nextPath;
                    }

                    // Handle collision
                    if (state.getFile(fileName) && state.getFilePath(fileName) === currentFolderPath) {
                        console.warn(`GitHub Import: Overwriting existing file "${fileName}" in "${currentFolderPath}".`);
                        filesystem.deleteFileInternal(fileName, currentFolderPath);
                    } else if (state.getFile(fileName)) {
                        console.warn(`GitHub Import: File name "${fileName}" exists elsewhere. Creating duplicate in "${currentFolderPath}".`);
                    }

                    // Create model
                    const language = getLanguageForFile(fileName);
                    const model = filesystem.createEditorModel(fileName, content, language, currentFolderPath);

                    if (model) {
                        count++;
                        if (!firstFileName) firstFileName = fileName;
                    }
                } catch (error) {
                    console.error(`Error loading GitHub file ${relativePath}:`, error);
                    ui.showMessage(`Error loading ${relativePath.split('/').pop()}: ${error.message}`, 'error');
                }
            })());
        });

        await Promise.all(filePromises); // Wait for all files to process
        return count;
    }
    
    /**
     * Recursively processes a GitHub folder to fetch and save all its files
     * @param {string} apiUrl - GitHub API URL for the folder contents
     * @param {string} folderPath - Path of the folder in the repo
     * @param {Set<string>} createdFolders - Set to track created folders
     * @returns {Promise<string[]>} - Array of file names processed
     */
    async function processGitHubFolder(apiUrl, folderPath, createdFolders) {
        const processedFiles = [];
        
        try {
            // Fetch the folder contents
            const dirContents = await fetchGitHubDirectoryContents(apiUrl);
            
            // Process files in this folder
            const filePromises = dirContents.filter(item => item.type === 'file').map(async (file) => {
                // Get the file contents
                try {
                    const response = await fetch(file.download_url);
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status} fetching ${file.path}`);
                    }
                    const content = await response.text();
                    
                    // Determine workspace path
                    const pathParts = folderPath.split('/');
                    const fileName = file.name;
                    
                    // Create folders in workspace
                    let currentFolderPath = 'root';
                    for (const folderName of pathParts) {
                        if (!folderName) continue;
                        const nextPath = currentFolderPath === 'root' ? folderName : `${currentFolderPath}/${folderName}`;
                        
                        if (!state.getFolder(nextPath) && !createdFolders.has(nextPath)) {
                            filesystem.createNewFolder(folderName, currentFolderPath);
                            if (state.getFolder(nextPath)) {
                                createdFolders.add(nextPath);
                            } else {
                                console.error(`GH Import: Failed to create folder ${nextPath}. Skipping file ${fileName}.`);
                                return;
                            }
                        } else if (!state.getFolder(nextPath)) {
                            console.error(`GH Import: Folder ${nextPath} vanished. Skipping file ${fileName}.`);
                            return;
                        }
                        currentFolderPath = nextPath;
                    }
                    
                    // Handle collision
                    if (state.getFile(fileName) && state.getFilePath(fileName) === currentFolderPath) {
                        console.warn(`GitHub Folder Import: Overwriting existing file "${fileName}" in "${currentFolderPath}".`);
                        filesystem.deleteFileInternal(fileName, currentFolderPath);
                    }
                    
                    // Create model
                    const language = getLanguageForFile(fileName);
                    const model = filesystem.createEditorModel(fileName, content, language, currentFolderPath);
                    
                    if (model) {
                        processedFiles.push(fileName);
                        loadedCount++; // Increment total loaded count
                        if (!firstFileName) firstFileName = fileName;
                    }
                } catch (error) {
                    console.error(`Error loading file ${file.path} from folder:`, error);
                }
            });
            
            // Wait for all files in this folder to complete
            await Promise.all(filePromises);
            
            // Recursively process subfolders
            const subdirPromises = dirContents.filter(item => item.type === 'dir').map(async (dir) => {
                const subfolderPath = `${folderPath}/${dir.name}`;
                const subfolderResults = await processGitHubFolder(dir.url, subfolderPath, createdFolders);
                processedFiles.push(...subfolderResults);
            });
            
            // Wait for all subfolders to complete
            await Promise.all(subdirPromises);
            
            return processedFiles;
        } catch (error) {
            console.error(`Error processing GitHub folder ${folderPath}:`, error);
            throw error; // Re-throw to be handled by caller
        }
    }
}

// --- Download ---

/**
 * Initiates download of the currently open file.
 */
export function downloadCurrentFile() {
    const currentFileName = state.getCurrentFile();
    const editor = state.getEditorInstance();

    if (!currentFileName || !editor || !editor.getModel()) {
         ui.showMessage("No file is currently open to download.", 'info');
         console.warn("Attempted downloadCurrentFile with no active file/model.");
         return;
    }

    const fileData = state.getFile(currentFileName);
    if (!fileData) {
         ui.showMessage("Error: Could not find data for the current file.", 'error');
         console.error(`Data mismatch: currentFile is ${currentFileName} but not found in state.files.`);
         return;
    }

    // Get content directly from the current editor model for latest edits
    const content = editor.getValue();

    downloadFileHelper(currentFileName, content); // Use helper
    ui.showMessage(`Downloading ${currentFileName}...`, 'info', 1500);
}


/**
 * Initiates download of the entire workspace as a ZIP file.
 */
export async function downloadWorkspace() {
    const workspaceName = ui.domElements.workspaceName?.value?.trim() || 'qe-workspace';
    const files = state.getFiles();
    const folders = state.getFolders();

    if (Object.keys(files).length === 0 && Object.keys(folders).length <= 1) { // Check for non-root folders too
        ui.showMessage("Workspace is empty, nothing to download.", 'info');
        ui.hideModal(ui.domElements.downloadWorkspaceModal);
        return;
    }

    if (typeof JSZip === 'undefined') {
        ui.showMessage("JSZip library not found. Cannot create ZIP.", 'error');
        console.error("JSZip library is required for workspace download.");
        ui.hideModal(ui.domElements.downloadWorkspaceModal);
        return;
    }

    ui.setLoading(true);
    ui.hideModal(ui.domElements.downloadWorkspaceModal);

    try {
        const zip = new JSZip();

        // Recursive function to add folders and files to the zip object
        function addFolderToZip(folderPath, zipFolder) {
            const folderData = folders[folderPath];
            if (!folderData) return; // Should not happen for valid paths

            // Add files in this folder
            folderData.files.forEach(fileName => {
                const fileData = files[fileName];
                // Ensure file exists in state and path matches, and model is valid
                if (fileData && state.getFilePath(fileName) === folderPath && fileData.model && !fileData.model.isDisposed()) {
                    const content = fileData.model.getValue();
                    zipFolder.file(fileName, content); // Add file to current zip folder level
                } else {
                     console.warn(`Workspace Download: Skipping file "${fileName}" in ZIP (missing/invalid data or model).`);
                }
            });

            // Add subfolders recursively
            folderData.subfolders.forEach(subfolderPath => {
                 const subfolderData = folders[subfolderPath];
                 if (subfolderData) {
                     // Create subfolder representation in zip, use its actual name
                     const subZipFolder = zipFolder.folder(subfolderData.name);
                     if (subZipFolder) { // Check if folder creation succeeded
                        addFolderToZip(subfolderPath, subZipFolder); // Recurse
                     } else {
                          console.warn(`Workspace Download: Failed to create folder "${subfolderData.name}" in ZIP.`);
                     }
                 } else {
                      console.warn(`Workspace Download: Skipping subfolder path "${subfolderPath}" in ZIP (missing data).`);
                 }
            });
        }

        // Start adding from the root level ('root' itself isn't a folder in the zip)
        addFolderToZip('root', zip);

        // Generate the zip file blob
        ui.showMessage("Generating ZIP file...", 'info', 5000);
        const blob = await zip.generateAsync({
             type: 'blob',
             compression: "DEFLATE",
             compressionOptions: { level: 6 } // Balance speed and compression
        });

        // Use helper to trigger download
        downloadFileHelper(`${workspaceName}.zip`, blob);
        ui.showMessage(`Downloaded workspace as ${workspaceName}.zip`, 'success');

    } catch (error) {
        console.error("Error creating workspace ZIP:", error);
        ui.showMessage(`Error creating ZIP: ${error.message}`, 'error');
    } finally {
        ui.setLoading(false);
    }
}


/**
 * Helper function to trigger a browser download for given content.
 * @param {string} filename - The desired name for the downloaded file.
 * @param {string|Blob} content - The content (string or Blob).
 * @param {string} [mimeType='application/octet-stream'] - MIME type for Blob.
 */
function downloadFileHelper(filename, content, mimeType = 'application/octet-stream') {
    try {
        const blob = (content instanceof Blob) ? content : new Blob([content], { type: 'text/plain;charset=utf-8' }); // Default to text for strings
        const effectiveMimeType = (content instanceof Blob) ? content.type || mimeType : 'text/plain;charset=utf-8';

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        // link.type = effectiveMimeType; // Type on link not usually needed

        // Append, click, remove pattern
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Revoke the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(link.href), 200);

    } catch (error) {
         console.error("Error creating download link:", error);
         ui.showMessage("Failed to initiate download.", 'error');
    }
}


// --- Event Listener Setup ---
// Called from main.js to attach listeners specific to IO elements/actions
export function setupIOEventListeners() {
    // File/Folder Inputs
    ui.domElements.fileUpload?.addEventListener('change', handleFileUpload);
    ui.domElements.folderUpload?.addEventListener('change', handleFolderUpload);

    // Import Dropzone Listeners
    const dropzone = ui.domElements.importDropzone;
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            e.stopPropagation();
            if(e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Avoid flickering when moving over child elements
             if (e.relatedTarget && dropzone.contains(e.relatedTarget)) {
                 return;
            }
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
            ui.hideModal(ui.domElements.importModal); // Close import modal on drop

            if (e.dataTransfer?.items) {
                // Prefer DataTransferItemList API for directory support
                handleDroppedItems(e.dataTransfer.items);
            } else if (e.dataTransfer?.files) {
                // Fallback to FileList API (files only)
                processUploadedFiles(e.dataTransfer.files, 'root'); // Drop to root by default
            } else {
                 ui.showMessage("Could not process dropped items.", "warning");
            }
        });
    }

     console.log("IO Event listeners set up.");
     // Note: Listeners for buttons inside modals (like Import URL/Repo, Download ZIP)
     // are often better handled in ui.js's setup function, as they trigger IO handlers directly.
     // Kept setup for file/folder inputs and dropzone here as they are direct IO triggers.
}