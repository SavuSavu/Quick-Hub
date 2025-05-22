/**
 * UI Manager for Vulnews
 * Handles all UI interactions and rendering
 */

const uiManager = {
    /**
     * Initialize UI references and event listeners
     * @param {Object} appState - Reference to the application state
     */
    init(appState) {
        this.appState = appState;
        this.initDomElements();
        this.setupEventListeners();
        this.loadApiKeys();
        this.checkDarkModePreference();
        
        // Set initial button states based on default selections
        this.updateSeverityButtonStates();
        this.updateSourceButtonStates();
    },
    
    /**
     * Initialize DOM element references
     */
    initDomElements() {
        this.elements = {
            severityFilters: document.getElementById('severityFilters'),
            sourceFilters: document.getElementById('sourceFilters'),
            searchInput: document.getElementById('searchInput'),
            refreshBtn: document.getElementById('refreshBtn'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            errorContainer: document.getElementById('errorContainer'),
            errorMessage: document.getElementById('errorMessage'),
            resultCount: document.getElementById('resultCount'),
            vulnerabilityList: document.getElementById('vulnerabilityList'),
            listView: document.getElementById('listView'),
            detailView: document.getElementById('detailView'),
            backToListBtn: document.getElementById('backToListBtn'),
            vulnerabilityDetail: document.getElementById('vulnerabilityDetail'),
            darkModeToggle: document.getElementById('darkModeToggle'),
            infoBtn: document.getElementById('infoBtn'),
            infoModal: document.getElementById('infoModal'),
            closeInfoModalBtn: document.getElementById('closeInfoModalBtn'),
            apiKeySection: document.getElementById('apiKeySection'),
            githubApiKey: document.getElementById('githubApiKey'),
            nvdApiKey: document.getElementById('nvdApiKey'),
            saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
            resultsSection: document.getElementById('resultsSection')
        };
    },
    
    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Severity filter buttons
        document.querySelectorAll('.severity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const severity = btn.dataset.severity;
                app.toggleSeverityFilter(severity);
                
                // Update all button states to match the current app state
                this.updateSeverityButtonStates();
                // No need to call renderVulnerabilities here as fetchVulnerabilities will handle it
            });
        });

        // Source filter buttons
        document.querySelectorAll('.source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const source = btn.dataset.source;
                app.toggleSourceFilter(source);
                
                // Update all button states to match the current app state
                this.updateSourceButtonStates();
                
                app.fetchVulnerabilities();
            });
        });

        // Search input
        this.elements.searchInput.addEventListener('input', (e) => {
            this.appState.searchTerm = e.target.value.trim().toLowerCase();
            this.renderVulnerabilities();
        });

        // Refresh button
        this.elements.refreshBtn.addEventListener('click', () => {
            app.fetchVulnerabilities();
        });

        // Back to list button
        this.elements.backToListBtn.addEventListener('click', () => {
            this.appState.currentView = 'list';
            this.renderView();
        });

        // Dark mode toggle
        this.elements.darkModeToggle.addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Info button and modal
        this.elements.infoBtn.addEventListener('click', () => {
            this.elements.infoModal.classList.remove('hidden');
        });

        this.elements.closeInfoModalBtn.addEventListener('click', () => {
            this.elements.infoModal.classList.add('hidden');
        });

        // Save API keys
        this.elements.saveApiKeyBtn.addEventListener('click', () => {
            this.saveApiKeys();
        });
    },
    
    /**
     * Load saved API keys from local storage
     */
    loadApiKeys() {
        const githubKey = localStorage.getItem('github_api_key');
        if (githubKey && this.elements.githubApiKey) {
            this.elements.githubApiKey.value = githubKey;
        }
        
        const nvdKey = localStorage.getItem('nvd_api_key');
        if (nvdKey && this.elements.nvdApiKey) {
            this.elements.nvdApiKey.value = nvdKey;
        }
    },
    
    /**
     * Save API keys to local storage
     */
    saveApiKeys() {
        if (this.elements.githubApiKey) {
            const githubKey = this.elements.githubApiKey.value.trim();
            if (githubKey) {
                localStorage.setItem('github_api_key', githubKey);
            } else {
                localStorage.removeItem('github_api_key');
            }
        }
        
        if (this.elements.nvdApiKey) {
            const nvdKey = this.elements.nvdApiKey.value.trim();
            if (nvdKey) {
                localStorage.setItem('nvd_api_key', nvdKey);
            } else {
                localStorage.removeItem('nvd_api_key');
            }
        }
        
        // Show feedback
        const btnText = this.elements.saveApiKeyBtn.innerHTML;
        this.elements.saveApiKeyBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
        this.elements.saveApiKeyBtn.classList.remove('bg-yellow-600');
        this.elements.saveApiKeyBtn.classList.add('bg-green-600');
        
        setTimeout(() => {
            this.elements.saveApiKeyBtn.innerHTML = btnText;
            this.elements.saveApiKeyBtn.classList.add('bg-yellow-600');
            this.elements.saveApiKeyBtn.classList.remove('bg-green-600');
        }, 2000);
        
        // If we're mid-error, retry the fetch
        if (this.appState.error && this.appState.error.includes('API rate limit')) {
            app.fetchVulnerabilities();
        }
    },
    
    /**
     * Check and apply user's dark mode preference
     */
    checkDarkModePreference() {
        if (
            localStorage.getItem('darkMode') === 'true' || 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && 
            !localStorage.getItem('darkMode'))
        ) {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.add('bg-gray-900');
            document.documentElement.classList.remove('bg-gray-50');
            const icon = this.elements.darkModeToggle.querySelector('i');
            icon.classList.replace('fa-moon', 'fa-sun');
        }
    },
    
    /**
     * Toggle between light and dark mode
     */
    toggleDarkMode() {
        const isDark = document.documentElement.classList.contains('dark');
        const icon = this.elements.darkModeToggle.querySelector('i');
        
        if (isDark) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.remove('bg-gray-900');
            document.documentElement.classList.add('bg-gray-50');
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('darkMode', 'false');
            
            // Synchronize with parent Quick-Hub if we're in an iframe
            if (window.parent && window.parent !== window && window.parent.document.documentElement.classList.contains('dark-theme')) {
                try {
                    // Send message to parent to toggle its theme (if supported)
                    window.parent.postMessage({ action: 'toggleTheme', theme: 'light' }, '*');
                } catch (e) {
                    console.warn('Could not communicate with parent frame', e);
                }
            }
        } else {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.add('bg-gray-900');
            document.documentElement.classList.remove('bg-gray-50');
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('darkMode', 'true');
            
            // Synchronize with parent Quick-Hub if we're in an iframe
            if (window.parent && window.parent !== window && !window.parent.document.documentElement.classList.contains('dark-theme')) {
                try {
                    // Send message to parent to toggle its theme (if supported)
                    window.parent.postMessage({ action: 'toggleTheme', theme: 'dark' }, '*');
                } catch (e) {
                    console.warn('Could not communicate with parent frame', e);
                }
            }
        }
        
        // If any charts/visualizations need updating for dark mode, do it here
    },
    
    /**
     * Update severity button states to match selected severities in app state
     */
    updateSeverityButtonStates() {
        document.querySelectorAll('.severity-btn').forEach(btn => {
            const severity = btn.dataset.severity;
            if (this.appState.selectedSeverities.includes(severity)) {
                btn.classList.add('bg-opacity-30');
            } else {
                btn.classList.remove('bg-opacity-30');
            }
        });
    },
    
    /**
     * Update source button states to match selected sources in app state
     */
    updateSourceButtonStates() {
        document.querySelectorAll('.source-btn').forEach(btn => {
            const source = btn.dataset.source;
            if (this.appState.selectedSources.includes(source)) {
                btn.classList.add('bg-blue-600');
                btn.classList.add('text-white');
            } else {
                btn.classList.remove('bg-blue-600');
                btn.classList.remove('text-white');
            }
        });
    },
    
    /**
     * Show loading state
     */
    showLoading() {
        this.elements.loadingIndicator.classList.remove('hidden');
        this.elements.resultsSection.classList.add('hidden');
    },
    
    /**
     * Hide loading state
     */
    hideLoading() {
        this.elements.loadingIndicator.classList.add('hidden');
        this.elements.resultsSection.classList.remove('hidden');
    },
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorContainer.classList.remove('hidden');
        
        // If this is a partial data warning, style it differently
        if (this.appState.partialDataLoaded) {
            this.elements.errorContainer.classList.remove('bg-red-100', 'border-red-500', 'text-red-700');
            this.elements.errorContainer.classList.add('bg-yellow-100', 'border-yellow-500', 'text-yellow-700');
        } else {
            this.elements.errorContainer.classList.remove('bg-yellow-100', 'border-yellow-500', 'text-yellow-700');
            this.elements.errorContainer.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
        }
        
        // Show API key section if it's an auth error
        if (message.includes('API rate limit exceeded') || 
            message.includes('authentication') || 
            message.includes('CORS issue') || 
            message.includes('API key')) {
            this.elements.apiKeySection.classList.remove('hidden');
        }
    },
    
    /**
     * Hide error message
     */
    hideError() {
        this.elements.errorContainer.classList.add('hidden');
    },
    
    /**
     * Update UI based on loading state
     */
    updateLoadingState() {
        if (this.appState.isLoading) {
            this.showLoading();
        } else {
            this.hideLoading();
        }
    },
    
    /**
     * Update UI based on error state
     */
    updateErrorState() {
        if (this.appState.error) {
            this.showError(this.appState.error);
        } else {
            this.hideError();
        }
    },
    
    /**
     * Render all vulnerabilities based on current filters
     */
    renderVulnerabilities() {
        this.filterVulnerabilities();
        // Update result count only if the element exists
        if (this.elements.resultCount) {
            this.elements.resultCount.textContent = `${this.appState.filteredVulnerabilities.length} ${this.appState.filteredVulnerabilities.length === 1 ? 'result' : 'results'}`;
        }
        // Render appropriate view
        this.renderView();
    },
    
    /**
     * Filter vulnerabilities based on current state
     */
    filterVulnerabilities() {
        this.appState.filteredVulnerabilities = this.appState.vulnerabilities.filter(vuln => {
            // Filter by selected severities
            if (!this.appState.selectedSeverities.includes(vuln.severity)) {
                return false;
            }
            
            // Filter by search term
            if (this.appState.searchTerm) {
                const searchText = `${vuln.id} ${vuln.description}`.toLowerCase();
                if (!searchText.includes(this.appState.searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
    },
    
    /**
     * Render the appropriate view (list or detail)
     */
    renderView() {
        if (this.appState.currentView === 'list') {
            this.elements.listView.classList.remove('hidden');
            this.elements.detailView.classList.add('hidden');
            this.renderListView();
        } else {
            this.elements.listView.classList.add('hidden');
            this.elements.detailView.classList.remove('hidden');
            this.renderDetailView();
        }
    },
    
    /**
     * Extract vulnerable component name from description or id
     * @param {Object} vuln - Vulnerability object
     * @returns {string} - Component name
     */
    extractComponentName(vuln) {
        // Try to extract component name from description
        if (vuln.description) {
            // Common patterns: "vulnerability in X", "X is vulnerable", "X allows"
            const patterns = [
                /vulnerability\s+in\s+([^.,:;]+)/i,
                /in\s+([^.,:;]+)\s+allows/i,
                /([^.,:;]+)\s+is\s+vulnerable/i,
                /([^.,:;]+)\s+allows/i,
                /([^.,:;]+)\s+could\s+allow/i
            ];
            
            for (const pattern of patterns) {
                const match = vuln.description.match(pattern);
                if (match && match[1] && match[1].length > 3 && match[1].length < 50) {
                    return match[1].trim();
                }
            }
        }
        
        // For GitHub advisories, use affected package if available
        if (vuln.source === 'GITHUB' && vuln.affected && vuln.affected.length > 0) {
            const pkg = vuln.affected[0];
            return typeof pkg === 'string' ? pkg.split('@')[0] : (pkg.package || 'Unknown Package');
        }
        
        // Fallback: Get component name from CVE ID or use generic name
        if (vuln.id.startsWith('CVE-')) {
            return `Component (${vuln.id})`;
        } else if (vuln.id.startsWith('GHSA-')) {
            return `Package (${vuln.id})`;
        }
        
        return 'Unknown Component';
    },
    
    /**
     * Extract attack vector details from CVSS vector
     * @param {Object} vuln - Vulnerability object
     * @returns {Object} - Attack details
     */
    extractAttackDetails(vuln) {
        const details = {
            attackVector: 'Unknown',
            attackComplexity: 'Unknown',
            privilegesRequired: 'Unknown'
        };
        
        if (!vuln.cvssVector) return details;
        
        // Parse CVSS vector string
        const vectorString = vuln.cvssVector;
        
        // Extract attack vector (AV)
        const avMatch = vectorString.match(/AV:([NALP])/);
        if (avMatch) {
            const av = avMatch[1];
            details.attackVector = av === 'N' ? 'Network' :
                                  av === 'A' ? 'Adjacent Network' :
                                  av === 'L' ? 'Local' :
                                  av === 'P' ? 'Physical' : 'Unknown';
        }
        
        // Extract attack complexity (AC)
        const acMatch = vectorString.match(/AC:([LH])/);
        if (acMatch) {
            const ac = acMatch[1];
            details.attackComplexity = ac === 'L' ? 'Low' :
                                      ac === 'H' ? 'High' : 'Unknown';
        }
        
        // Extract privileges required (PR)
        const prMatch = vectorString.match(/PR:([NLH])/);
        if (prMatch) {
            const pr = prMatch[1];
            details.privilegesRequired = pr === 'N' ? 'None' :
                                         pr === 'L' ? 'Low' :
                                         pr === 'H' ? 'High' : 'Unknown';
        }
        
        return details;
    },
    
    /**
     * Render the list view
     */
    renderListView() {
        if (!this.appState.filteredVulnerabilities.length) {
            this.elements.vulnerabilityList.innerHTML = `
                <div class="bg-white rounded-lg shadow-md p-8 text-center card-shadow">
                    <i class="fas fa-exclamation-circle text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">No vulnerabilities found</h3>
                    <p class="text-gray-600">Try adjusting your filters or search term</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.appState.filteredVulnerabilities.forEach(vuln => {
            const severityClass = `severity-${vuln.severity.toLowerCase()}`;
            const componentName = this.extractComponentName(vuln);
            const attackDetails = this.extractAttackDetails(vuln);
            
            // Build attack details HTML
            let attackDetailsHtml = '';
            if (vuln.cvssVector) {
                attackDetailsHtml = `
                    <div class="flex flex-wrap gap-2 mt-2 text-xs">
                        <span class="px-2 py-1 bg-gray-100 rounded-full">Vector: ${attackDetails.attackVector}</span>
                        <span class="px-2 py-1 bg-gray-100 rounded-full">Complexity: ${attackDetails.attackComplexity}</span>
                        <span class="px-2 py-1 bg-gray-100 rounded-full">Privileges: ${attackDetails.privilegesRequired}</span>
                    </div>
                `;
            }
            
            html += `
                <div class="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer card-shadow fade-in vulnerability-card" data-id="${vuln.id}">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold text-lg truncate">${componentName}</h3>
                        <span class="px-2 py-1 rounded-full text-xs ${severityClass}">${vuln.severity}</span>
                    </div>
                    <p class="text-gray-600 mb-2 line-clamp-2">${vuln.description}</p>
                    ${attackDetailsHtml}
                    <div class="flex justify-between items-center text-sm mt-3">
                        <span class="text-gray-500">${this.formatDate(vuln.publishedDate)}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-gray-500">${vuln.source}</span>
                            <span class="text-xs text-gray-400">${vuln.id}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        this.elements.vulnerabilityList.innerHTML = html;
        
        // Add click event to each card
        document.querySelectorAll('.vulnerability-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const vuln = this.appState.vulnerabilities.find(v => v.id === id);
                if (vuln) {
                    this.appState.selectedCVE = vuln;
                    this.appState.currentView = 'detail';
                    this.renderView();
                }
            });
        });
    },
    
    /**
     * Render the detail view
     */
    renderDetailView() {
        if (!this.appState.selectedCVE) {
            this.elements.vulnerabilityDetail.innerHTML = '<p>No vulnerability selected</p>';
            return;
        }
        
        const vuln = this.appState.selectedCVE;
        const severityClass = `severity-${vuln.severity.toLowerCase()}`;
        const componentName = this.extractComponentName(vuln);
        const attackDetails = this.extractAttackDetails(vuln);
        
        let referencesHtml = '';
        if (vuln.references && vuln.references.length) {
            referencesHtml = `
                <div class="mt-4">
                    <h4 class="font-semibold mb-2">References:</h4>
                    <ul class="space-y-1">
                        ${vuln.references.map(ref => `<li><a href="${ref}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${this.truncateUrl(ref)}</a></li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Attack vector details section
        let attackVectorHtml = '';
        if (vuln.cvssVector) {
            attackVectorHtml = `
                <div class="mt-4">
                    <h4 class="font-semibold mb-2">Attack Details:</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-600">Attack Vector</p>
                            <p class="font-medium">${attackDetails.attackVector}</p>
                        </div>
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-600">Attack Complexity</p>
                            <p class="font-medium">${attackDetails.attackComplexity}</p>
                        </div>
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-600">Privileges Required</p>
                            <p class="font-medium">${attackDetails.privilegesRequired}</p>
                        </div>
                    </div>
                    ${vuln.cvssVector ? `<p class="text-sm text-gray-600 mt-2">Full Vector: ${vuln.cvssVector}</p>` : ''}
                </div>
            `;
        }
        
        let additionalInfoHtml = '';
        if (vuln.source === 'NVD' && vuln.cvssScore) {
            additionalInfoHtml += `
                <div class="mt-4">
                    <h4 class="font-semibold mb-2">CVSS Score:</h4>
                    <p>${vuln.cvssScore} (${vuln.severity})</p>
                </div>
                ${attackVectorHtml}
            `;
        }
        
        if (vuln.source === 'GITHUB' && vuln.affected) {
            const affectedPackages = Array.isArray(vuln.affected) ? vuln.affected : [];
            if (affectedPackages.length > 0) {
                additionalInfoHtml += `
                    <div class="mt-4">
                        <h4 class="font-semibold mb-2">Affected Packages:</h4>
                        <ul class="space-y-1">
                            ${affectedPackages.map(pkg => `<li class="text-gray-700">${pkg.package || pkg}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }
        
        this.elements.vulnerabilityDetail.innerHTML = `
            <div class="fade-in">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-2xl font-bold mb-1">${componentName}</h2>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 rounded-full ${severityClass} font-medium">${vuln.severity}</span>
                            <span class="text-gray-500">${vuln.id}</span>
                        </div>
                    </div>
                    <a href="${vuln.url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors flex items-center gap-1">
                        <i class="fas fa-external-link-alt"></i> View Source
                    </a>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <h4 class="font-semibold text-gray-700">Published</h4>
                        <p>${this.formatDate(vuln.publishedDate)}</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-700">Last Modified</h4>
                        <p>${vuln.lastModifiedDate ? this.formatDate(vuln.lastModifiedDate) : 'N/A'}</p>
                    </div>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg mb-4">
                    <p class="whitespace-pre-line">${vuln.description}</p>
                </div>
                
                ${additionalInfoHtml}
                ${referencesHtml}
            </div>
        `;
    },
    
    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} - Formatted date
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    
    /**
     * Truncate long URLs for display
     * @param {string} url - URL to truncate
     * @returns {string} - Truncated URL
     */
    truncateUrl(url) {
        if (url.length > 50) {
            return url.substring(0, 25) + '...' + url.substring(url.length - 25);
        }
        return url;
    }
};