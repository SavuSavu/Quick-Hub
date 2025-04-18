import { state } from './state.js';
import { elements } from './dom.js';
import { readFile } from './utils.js';
import { addLogEntry } from './logger.js';
import { MAX_FILE_LINES } from './config.js';
import { updateTargetCount } from './ui.js'; // Import UI update function

// Handle file uploads (from input click or drop)
export async function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    let uploadArea;
    let inputElement;
    if (type === 'targets') {
        uploadArea = elements.targetUploadArea;
        inputElement = elements.targetFileInput;
    } else if (type === 'users') {
        uploadArea = elements.userUploadArea;
         inputElement = elements.userFileInput;
    } else if (type === 'passwords') {
        uploadArea = elements.passUploadArea;
         inputElement = elements.passFileInput;
    } else {
        addLogEntry(`Unknown file type: ${type}`, 'error');
        return;
    }

    if (!uploadArea || !inputElement) {
         addLogEntry(`Upload area or input not found for type: ${type}`, 'error');
         return;
    }

    // Add loading indicator maybe?
    uploadArea.innerHTML = `
        <i class="fas fa-spinner fa-spin text-blue-500 text-xl mb-1"></i>
        <p class="text-xs text-gray-500">Loading ${file.name}...</p>
    `;

    try {
        const content = await readFile(file);
        const lines = content.split(/[\r\n]+/).filter(line => line.trim() !== ''); // Split by new lines, handle CRLF/LF

        if (lines.length === 0) {
             throw new Error("File is empty or contains no valid lines.");
        }

        // Limit lines
        const limitedLines = lines.slice(0, MAX_FILE_LINES);
        const truncated = lines.length > MAX_FILE_LINES;

        // Update UI
        uploadArea.innerHTML = `
            <i class="fas fa-check-circle text-green-500 text-xl mb-1"></i>
            <p class="text-xs font-medium truncate" title="${file.name}">${file.name}</p>
            <p class="text-xs text-gray-500">${limitedLines.length} items loaded${truncated ? ` (truncated from ${lines.length})` : ''}</p>
            <button class="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium change-btn">Change</button>
        `;
        uploadArea.querySelector('.change-btn').addEventListener('click', () => inputElement.click());


        // Update state
        if (type === 'targets') {
            state.targets = limitedLines;
            updateTargetCount(); // Update the count in the results panel
        } else if (type === 'users') {
            state.usernames = limitedLines;
        } else if (type === 'passwords') {
            state.passwords = limitedLines;
        }

        addLogEntry(`Loaded ${limitedLines.length} ${type} from ${file.name}${truncated ? ` (truncated from ${lines.length})` : ''}`, 'info');

    } catch (error) {
        console.error(`Error reading ${type} file:`, error);
        addLogEntry(`Error reading ${type} file: ${error.message}`, 'error');
        uploadArea.innerHTML = `
            <i class="fas fa-times-circle text-red-500 text-xl mb-1"></i>
            <p class="text-xs font-medium text-red-600">Error loading file</p>
            <p class="text-xs text-gray-500 truncate" title="${error.message}">${error.message}</p>
            <button class="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium retry-btn">Retry</button>
        `;

        // Set up retry button
        uploadArea.querySelector('.retry-btn').addEventListener('click', () => {
            inputElement.click();
        });
    } finally {
         // Clear the file input value so the 'change' event fires even if the same file is selected again
         inputElement.value = '';
    }
}

// Set up drag and drop for a file upload area
export function setupDragAndDrop(dropArea, fileInput, type) {
    if (!dropArea || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => highlight(dropArea), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => unhighlight(dropArea), false);
    });

    function highlight(area) {
        area.classList.add('dragover');
    }

    function unhighlight(area) {
        area.classList.remove('dragover');
    }

    dropArea.addEventListener('drop', (e) => handleDrop(e, fileInput, type), false);
}

// Handle the drop event
function handleDrop(e, fileInput, type) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
         // Assign the dropped files to the hidden file input
        fileInput.files = files;

        // Manually create and dispatch a 'change' event on the file input
        // This triggers the handleFileUpload function
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
    } else {
         addLogEntry('Drop event occurred but no files were transferred.', 'warning');
    }
}

export function resetUploadArea(type) {
    let uploadArea, inputElement, defaultHtml;

    if (type === 'targets') {
        uploadArea = elements.targetUploadArea;
        inputElement = elements.targetFileInput;
        defaultHtml = `
            <i class="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
            <p class="text-sm text-gray-500">Drag & drop target URLs file here</p>
            <p class="text-xs text-gray-400 mt-1">or</p>
            <input type="file" id="targetFileInput" class="hidden" accept=".txt,.csv">
            <button id="targetFileBtn" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm font-medium">Select File</button>
            <p class="text-xs text-gray-500 mt-2">One URL per line (max ${MAX_FILE_LINES})</p>
        `;
    } else if (type === 'users') {
        uploadArea = elements.userUploadArea;
        inputElement = elements.userFileInput;
        defaultHtml = `
            <i class="fas fa-user text-xl text-gray-400 mb-1"></i>
            <p class="text-xs text-gray-500">Usernames file</p>
            <input type="file" id="userFileInput" class="hidden" accept=".txt,.csv">
            <button id="userFileBtn" class="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium">Select</button>
        `;
    } else if (type === 'passwords') {
         uploadArea = elements.passUploadArea;
         inputElement = elements.passFileInput;
         defaultHtml = `
            <i class="fas fa-key text-xl text-gray-400 mb-1"></i>
            <p class="text-xs text-gray-500">Passwords file</p>
            <input type="file" id="passFileInput" class="hidden" accept=".txt,.csv">
            <button id="passFileBtn" class="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium">Select</button>
        `;
    } else {
        return;
    }

    if (uploadArea) {
        uploadArea.innerHTML = defaultHtml;
        // Re-assign button element reference and re-attach listener
        const buttonId = type === 'targets' ? 'targetFileBtn' : (type === 'users' ? 'userFileBtn' : 'passFileBtn');
        const button = uploadArea.querySelector(`#${buttonId}`);
        if (button && inputElement) {
             // Update the cached element reference in dom.js IF NEEDED,
             // but easier to just re-add listener here
             button.addEventListener('click', () => inputElement.click());
             if (type === 'targets') elements.targetFileBtn = button; // Update cache if needed elsewhere
             if (type === 'users') elements.userFileBtn = button;
             if (type === 'passwords') elements.passFileBtn = button;
        }
    }
    if (inputElement) {
        inputElement.value = ''; // Clear file selection
    }
}