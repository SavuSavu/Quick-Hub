/**
 * @file src/utils/helpers.js
 * @purpose Provides general utility functions used across the application.
 * @usage Imported by various modules needing helper functionalities like file reading or language detection.
 *
 * @changeLog
 * - 2024-07-26: Initial refactoring. Moved readFileContent and getLanguageForFile from monolithic scripts.js.
 */

/**
 * Reads the content of a File object as text.
 * @param {File} file - The File object to read.
 * @returns {Promise<string>} A promise that resolves with the file content as a string.
 */
export function readFileContent(file) {
    return new Promise((resolve, reject) => {
        if (!(file instanceof File)) {
            return reject(new TypeError("Invalid input: Expected a File object."));
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result || ''); // Resolve with empty string if result is null/undefined
        reader.onerror = (e) => reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`));
        reader.onabort = () => reject(new Error('FileReader aborted.'));
        reader.readAsText(file); // Assume text files
    });
}

/**
 * Determines a suitable Monaco language identifier for a given filename.
 * Tries to use Monaco's built-in registry first, then falls back to a manual map.
 * @param {string} filename - The name of the file (e.g., 'script.js', 'styles.css').
 * @returns {string} The Monaco language ID (e.g., 'javascript', 'css', 'plaintext').
 */
export function getLanguageForFile(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'plaintext';
    }

    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || filename.startsWith('.')) { // Handle hidden files or files without extension
        return 'plaintext';
    }

    // Prefer Monaco's built-in language detection if available
    if (window.monaco && typeof monaco.languages?.getLanguages === 'function') {
        try {
            const languages = monaco.languages.getLanguages();
            // Ensure extensions start with '.' for comparison
            const dotExtension = `.${extension}`;
            const lang = languages.find(l => l.extensions?.includes(dotExtension));
            if (lang && lang.id) {
                // console.log(`Monaco found language '${lang.id}' for extension '${dotExtension}'`);
                return lang.id;
            }
        } catch (error) {
            console.warn("Error accessing Monaco languages registry:", error);
        }
    } else {
         // console.warn("Monaco languages registry not available for dynamic lookup.");
    }

    // Fallback mapping (based on original script)
    const langMap = {
        'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
        'html': 'html', 'htm': 'html',
        'css': 'css', 'scss': 'scss', 'less': 'less',
        'json': 'json', 'jsonc': 'json', 'geojson': 'json', 'webmanifest': 'json',
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
        'tsx': 'typescript', // Monaco handles TSX within 'typescript'
        'jsx': 'javascript', // Monaco handles JSX within 'javascript'
        'xml': 'xml', 'xaml': 'xml', 'svg': 'xml', 'plist': 'xml', 'csproj': 'xml', 'rss': 'xml', 'atom': 'xml',
        'sql': 'sql',
        'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell', 'ksh': 'shell',
        'yml': 'yaml', 'yaml': 'yaml',
        'txt': 'plaintext',
        'log': 'plaintext',
        'ini': 'ini', 'properties': 'ini', 'editorconfig': 'ini',
        'bat': 'bat', 'cmd': 'bat',
        'ps1': 'powershell', 'psm1': 'powershell', 'psd1': 'powershell',
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
        'diff': 'diff', 'patch': 'diff',
        'env': 'shell', // Often treated like shell scripts
        'gitignore': 'plaintext', // Or could be custom 'gitignore' if lang defined
        // Add more mappings as needed
    };

    const mappedLang = langMap[extension];
    if (mappedLang) {
        // console.log(`Fallback map found language '${mappedLang}' for extension '.${extension}'`);
        return mappedLang;
    }

    // Default if no match found
    // console.log(`No specific language found for extension '.${extension}', defaulting to 'plaintext'.`);
    return 'plaintext';
}

/**
 * Debounces a function call.
 * Ensures the function is only called after a certain period of inactivity.
 * @param {Function} func The function to debounce.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Example Usage (within another module):
// import { readFileContent, getLanguageForFile } from './utils/helpers.js';
//
// async function processFile(file) {
//   const content = await readFileContent(file);
//   const language = getLanguageForFile(file.name);
//   console.log(`File: ${file.name}, Language: ${language}`);
// }