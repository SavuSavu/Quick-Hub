// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const targetUrlInput = document.getElementById('target-url');
    const loadButton = document.getElementById('load-button');
    const targetIframe = document.getElementById('target-iframe');
    const iframeContainer = document.getElementById('iframe-container');
    const iframeBlocker = document.getElementById('iframe-blocker');
    const iframePlaceholder = document.getElementById('iframe-placeholder');
    const paramNameInput = document.getElementById('param-name');
    const payloadSelect = document.getElementById('payload-select');
    const injectButton = document.getElementById('inject-button');
    const resultsLog = document.getElementById('results-log');
    const messageBox = document.getElementById('message-box');
    const payloadCategoryFilter = document.getElementById('payload-category-filter');
    const customPayloadCategoryInput = document.getElementById('custom-payload-category');

    let currentTargetUrl = null; // Store the base URL loaded in the iframe

    // --- Utility Functions ---

    // Function to display messages to the user
    function showMessage(message, duration = 3000) {
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, duration);
    }

    // Function to add a log entry to the results panel
    function addLogEntry(message, type = 'info') {
        // Clear placeholder if it exists
        const placeholder = resultsLog.querySelector('p.text-gray-500');
        if (placeholder) {
            resultsLog.removeChild(placeholder);
        }

        const entry = document.createElement('div');
        entry.classList.add('log-entry', `log-${type}`); // Add type for potential styling

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('log-time');
        timeSpan.textContent = new Date().toLocaleTimeString();

        const messageSpan = document.createElement('span');
        // Basic sanitization to prevent log injection (though unlikely here)
        // A more robust sanitizer would be needed in a real-world scenario
        // For now, just replace < and > to prevent HTML injection in the log itself.
        messageSpan.textContent = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Highlight URLs and Payloads differently if needed (example)
        // This is basic, could be improved with regex
        if (message.includes('URL:') || message.includes('Testing:')) {
             messageSpan.innerHTML = message
                .replace(/</g, "&lt;").replace(/>/g, "&gt;") // Basic sanitize first
                .replace(/(https?:\/\/[^\s]+)/g, '<span class="log-url">$1</span>') // Highlight URLs
                .replace(/(&lt;.*&gt;)/g, '<span class="log-payload">$1</span>'); // Highlight potential payloads
        }


        entry.appendChild(timeSpan);
        entry.appendChild(messageSpan);
        resultsLog.appendChild(entry);

        // Scroll to the bottom
        resultsLog.scrollTop = resultsLog.scrollHeight;
    }

    // --- Event Listeners ---

    // Load Target URL Button
    loadButton.addEventListener('click', () => {
        const url = targetUrlInput.value.trim();
        if (!url) {
            showMessage("Please enter a target URL.");
            return;
        }

        // Basic URL validation (doesn't need to be perfect)
        try {
            new URL(url);
        } catch (_) {
            showMessage("Invalid URL format.");
            return;
        }

        addLogEntry(`Attempting to load URL: ${url}`, 'info');
        iframePlaceholder.classList.add('hidden'); // Hide placeholder
        iframeBlocker.classList.add('hidden'); // Hide blocker initially
        targetIframe.src = url; // Set iframe source
        currentTargetUrl = url; // Store the base URL
        injectButton.disabled = false; // Enable injection button
        targetIframe.classList.remove('hidden'); // Ensure iframe is visible

        // Add a listener to detect if the iframe fails to load (e.g., X-Frame-Options)
        // This is tricky and not foolproof. 'load' might fire even if content is blocked.
        // A common workaround is a timeout, but it's unreliable.
        // We'll rely more on visual confirmation and potential 'error' events if the browser supports them well here.
        targetIframe.onerror = () => {
            addLogEntry(`Error loading iframe for ${url}. Might be blocked by X-Frame-Options or CSP.`, 'error');
            iframeBlocker.classList.remove('hidden');
            targetIframe.classList.add('hidden'); // Hide the potentially blank iframe
            injectButton.disabled = true; // Disable injection if load fails
            currentTargetUrl = null;
        };
         targetIframe.onload = () => {
             // Check if the loaded content's location is 'about:blank' or similar, which might indicate blocking
             try {
                 // This access might fail due to cross-origin restrictions, hence the try...catch
                 if (targetIframe.contentWindow.location.href === 'about:blank' && url !== 'about:blank') {
                     addLogEntry(`Iframe loaded 'about:blank' instead of ${url}. Likely blocked by security headers.`, 'warn');
                     iframeBlocker.classList.remove('hidden');
                     targetIframe.classList.add('hidden');
                     injectButton.disabled = true;
                     currentTargetUrl = null;
                 } else {
                      addLogEntry(`Successfully initiated loading for: ${url}`, 'info');
                      // Check if the iframe is actually visible (sometimes it loads but is empty due to CSP)
                      // This check is also limited by cross-origin policy
                 }
             } catch (e) {
                 addLogEntry(`Loaded URL: ${url}. Cannot verify content due to cross-origin restrictions. Manual inspection required.`, 'warn');
             }
         };
    });

    // Inject Payload Button
    injectButton.addEventListener('click', () => {
        if (!currentTargetUrl) {
            showMessage("Load a target URL first.");
            return;
        }

        const paramName = paramNameInput.value.trim();
        const selectedPayload = payloadSelect.value;

        if (!selectedPayload) {
            showMessage("Please select a payload.");
            return;
        }

        let injectionUrl;
        const payloadData = xssPayloads.find(p => p.payload === selectedPayload);
        const payloadDescription = payloadData ? payloadData.name : 'Selected Payload';

        try {
            const urlObject = new URL(currentTargetUrl);

            if (paramName) {
                // Inject into query parameter
                urlObject.searchParams.set(paramName, selectedPayload);
                injectionUrl = urlObject.toString();
                addLogEntry(`Testing: ${paramName}=${selectedPayload} on ${urlObject.origin}${urlObject.pathname}`, 'info');
            } else {
                // Inject into URL fragment
                // Handle payloads that might already start with #
                if (selectedPayload.startsWith('#')) {
                     urlObject.hash = selectedPayload;
                } else {
                     urlObject.hash = '#' + selectedPayload;
                }
                injectionUrl = urlObject.toString();
                addLogEntry(`Testing: Fragment injection #${selectedPayload} on ${urlObject.origin}${urlObject.pathname}`, 'info');
            }

            addLogEntry(`Reloading iframe with URL: ${injectionUrl}`, 'info');
            addLogEntry(`Payload (${payloadDescription}): ${selectedPayload}`, 'info');
            addLogEntry("--- MANUAL CHECK REQUIRED ---", 'warn');
            addLogEntry("Look for: Alerts, popups, broken layout, unexpected content, or the payload reflected in the source.", 'warn');

            // Reload the iframe with the modified URL
            iframeBlocker.classList.add('hidden'); // Ensure blocker is hidden
            targetIframe.classList.remove('hidden'); // Ensure iframe is visible
            targetIframe.src = injectionUrl;

        } catch (e) {
            showMessage("Error constructing injection URL.");
            addLogEntry(`Error creating injection URL: ${e.message}`, 'error');
            console.error("URL construction error:", e);
        }
    });

    // --- Custom Payload Management ---
    const customPayloadNameInput = document.getElementById('custom-payload-name');
    const customPayloadValueInput = document.getElementById('custom-payload-value');
    const addCustomPayloadBtn = document.getElementById('add-custom-payload');
    const updateCustomPayloadBtn = document.getElementById('update-custom-payload');
    const cancelEditPayloadBtn = document.getElementById('cancel-edit-payload');
    const customPayloadList = document.getElementById('custom-payload-list');

    let customPayloads = [];
    let editPayloadIndex = null;

    function loadCustomPayloads() {
        const stored = localStorage.getItem('xssCustomPayloads');
        customPayloads = stored ? JSON.parse(stored) : [];
    }

    function saveCustomPayloads() {
        localStorage.setItem('xssCustomPayloads', JSON.stringify(customPayloads));
    }

    function renderCustomPayloadList() {
        customPayloadList.innerHTML = '';
        if (customPayloads.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No custom payloads.';
            li.className = 'text-muted';
            customPayloadList.appendChild(li);
            return;
        }
        customPayloads.forEach((payload, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<b>${payload.name}</b>: <code>${payload.payload}</code> `;
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'btn btn-xs';
            editBtn.onclick = () => startEditPayload(idx);
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.className = 'btn btn-xs';
            delBtn.onclick = () => deleteCustomPayload(idx);
            li.appendChild(editBtn);
            li.appendChild(delBtn);
            customPayloadList.appendChild(li);
        });
    }

    function updatePayloadDropdown() {
        // Remove all except the first option
        while (payloadSelect.options.length > 1) payloadSelect.remove(1);
        const selectedCategory = payloadCategoryFilter.value;
        // Built-in payloads
        if (typeof xssPayloads !== 'undefined' && Array.isArray(xssPayloads)) {
            xssPayloads.forEach(payload => {
                if (selectedCategory === 'All' || payload.category === selectedCategory) {
                    const option = document.createElement('option');
                    option.value = payload.payload;
                    option.textContent = payload.name.length > 50 ? payload.name.substring(0, 47) + '...' : payload.name;
                    payloadSelect.appendChild(option);
                }
            });
        }
        // Add custom payloads
        customPayloads.forEach(payload => {
            if ((selectedCategory === 'All' || payload.category === selectedCategory) || (selectedCategory === 'Custom' && payload.category === 'Custom')) {
                const option = document.createElement('option');
                option.value = payload.payload;
                option.textContent = `[Custom] ${payload.name}`;
                option.setAttribute('data-custom', 'true');
                payloadSelect.appendChild(option);
            }
        });
    }

    function addCustomPayload() {
        const name = customPayloadNameInput.value.trim();
        const payload = customPayloadValueInput.value.trim();
        const category = customPayloadCategoryInput.value;
        if (!name || !payload) {
            showMessage('Enter both name and payload.');
            return;
        }
        customPayloads.push({ name, payload, category });
        saveCustomPayloads();
        renderCustomPayloadList();
        updatePayloadDropdown();
        customPayloadNameInput.value = '';
        customPayloadValueInput.value = '';
        customPayloadCategoryInput.value = 'Custom';
        showMessage('Custom payload added.');
    }

    function startEditPayload(idx) {
        editPayloadIndex = idx;
        const payload = customPayloads[idx];
        customPayloadNameInput.value = payload.name;
        customPayloadValueInput.value = payload.payload;
        customPayloadCategoryInput.value = payload.category || 'Custom';
        addCustomPayloadBtn.style.display = 'none';
        updateCustomPayloadBtn.style.display = '';
        cancelEditPayloadBtn.style.display = '';
    }

    function updateCustomPayload() {
        if (editPayloadIndex === null) return;
        const name = customPayloadNameInput.value.trim();
        const payload = customPayloadValueInput.value.trim();
        const category = customPayloadCategoryInput.value;
        if (!name || !payload) {
            showMessage('Enter both name and payload.');
            return;
        }
        customPayloads[editPayloadIndex] = { name, payload, category };
        saveCustomPayloads();
        renderCustomPayloadList();
        updatePayloadDropdown();
        cancelEditPayload();
        showMessage('Custom payload updated.');
    }

    function cancelEditPayload() {
        editPayloadIndex = null;
        customPayloadNameInput.value = '';
        customPayloadValueInput.value = '';
        customPayloadCategoryInput.value = 'Custom';
        addCustomPayloadBtn.style.display = '';
        updateCustomPayloadBtn.style.display = 'none';
        cancelEditPayloadBtn.style.display = 'none';
    }

    function deleteCustomPayload(idx) {
        if (!confirm('Delete this custom payload?')) return;
        customPayloads.splice(idx, 1);
        saveCustomPayloads();
        renderCustomPayloadList();
        updatePayloadDropdown();
        cancelEditPayload();
        showMessage('Custom payload deleted.');
    }

    addCustomPayloadBtn.addEventListener('click', addCustomPayload);
    updateCustomPayloadBtn.addEventListener('click', updateCustomPayload);
    cancelEditPayloadBtn.addEventListener('click', cancelEditPayload);
    payloadCategoryFilter.addEventListener('change', updatePayloadDropdown);

    // --- Initialization ---

    // Populate Payload Select Dropdown
    function populatePayloads() {
        if (typeof xssPayloads !== 'undefined' && Array.isArray(xssPayloads)) {
            xssPayloads.forEach(payload => {
                const option = document.createElement('option');
                option.value = payload.payload;
                // Truncate long payload names in the dropdown for display
                option.textContent = payload.name.length > 50 ? payload.name.substring(0, 47) + '...' : payload.name;
                payloadSelect.appendChild(option);
            });
        } else {
            console.error("xssPayloads array not found or is not an array.");
            addLogEntry("Error: Could not load payloads from payloads.js", 'error');
        }
    }

    // Initial setup
    addLogEntry("XSS Prober initialized. Enter a URL to begin.", 'info');
    loadCustomPayloads();
    renderCustomPayloadList();
    updatePayloadDropdown();
    injectButton.disabled = true; // Disabled until a URL is loaded

}); // End DOMContentLoaded
