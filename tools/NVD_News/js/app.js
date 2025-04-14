/**
 * Main Application for Vulnews
 * Orchestrates between UI, API services, and application state
 */

const app = {
    /**
     * Application state
     */
    state: {
        selectedSeverities: ['CRITICAL'], // Default to only Critical severity
        selectedSources: ['NVD', 'GITHUB'],
        searchTerm: '',
        vulnerabilities: [],
        filteredVulnerabilities: [],
        isLoading: false,
        error: null,
        currentView: 'list',
        selectedCVE: null,
        partialDataLoaded: false // Flag to indicate if data is partial
    },
    
    /**
     * Initialize the application
     */
    init() {
        // Initialize UI manager with application state
        uiManager.init(this.state);
        
        // Setup Quick-Hub specific integrations
        this.setupQuickHubIntegration();
        
        // Fetch initial data
        this.fetchVulnerabilities();
    },
    
    /**
     * Setup integrations specific to running within Quick-Hub
     */
    setupQuickHubIntegration() {
        // Listen for theme changes from parent
        window.addEventListener('message', (event) => {
            if (event.data && event.data.action === 'themeChanged') {
                const newTheme = event.data.theme;
                if (newTheme === 'dark' && !document.documentElement.classList.contains('dark')) {
                    uiManager.toggleDarkMode();
                } else if (newTheme === 'light' && document.documentElement.classList.contains('dark')) {
                    uiManager.toggleDarkMode();
                }
            }
        });
    },
    
    /**
     * Toggle severity filter
     * @param {string} severity - Severity level to toggle
     */
    toggleSeverityFilter(severity) {
        const index = this.state.selectedSeverities.indexOf(severity);
        if (index > -1) {
            // Only remove if not the last selected severity
            if (this.state.selectedSeverities.length > 1) {
                this.state.selectedSeverities.splice(index, 1);
            }
        } else {
            this.state.selectedSeverities.push(severity);
        }
        
        // Fetch new vulnerabilities with updated severity filters
        this.fetchVulnerabilities();
    },
    
    /**
     * Toggle source filter
     * @param {string} source - Data source to toggle
     */
    toggleSourceFilter(source) {
        const index = this.state.selectedSources.indexOf(source);
        if (index > -1) {
            // Only remove if not the last selected source
            if (this.state.selectedSources.length > 1) {
                this.state.selectedSources.splice(index, 1);
            }
        } else {
            this.state.selectedSources.push(source);
        }
        
        // Fetch new vulnerabilities with updated source filters
        this.fetchVulnerabilities();
    },
    
    /**
     * Fetch vulnerabilities based on current filters
     */
    async fetchVulnerabilities() {
        // Reset state
        this.state.isLoading = true;
        this.state.error = null;
        this.state.partialDataLoaded = false;
        uiManager.updateLoadingState();
        uiManager.hideError();
        
        try {
            // Fetch data from selected sources
            const results = await apiService.fetchVulnerabilities(
                this.state.selectedSeverities,
                this.state.selectedSources
            );
            
            // Check if we have partial data with an error
            if (results && results.data) {
                // We have partial data with an error
                this.state.vulnerabilities = results.data;
                
                if (results.error) {
                    this.state.error = results.error;
                    this.state.partialDataLoaded = true;
                }
            } else {
                // We have complete data
                this.state.vulnerabilities = results;
            }
            
            // Filter and render results
            uiManager.renderVulnerabilities();
            
            // Show partial data errors
            if (this.state.partialDataLoaded) {
                uiManager.updateErrorState();
            }
            
        } catch (error) {
            console.error('Error fetching vulnerabilities:', error);
            this.state.error = error.message || 'Failed to fetch vulnerability data';
            this.state.partialDataLoaded = false;
            uiManager.updateErrorState();
        } finally {
            this.state.isLoading = false;
            uiManager.updateLoadingState();
        }
    }
};

// Initialize the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});