document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const categoryContainer = document.getElementById('category-container');
    const searchBar = document.getElementById('search-bar');
    const noResultsDiv = document.getElementById('no-results');
    const searchTermDisplay = document.getElementById('search-term-display');
    const footerYear = document.getElementById('footer-year');
    const toolView = document.getElementById('tool-view');
    const toolIframe = document.getElementById('tool-iframe');
    const iframeTitle = document.getElementById('iframe-title');
    const iframeCloseBtn = document.getElementById('iframe-close-btn');
    const dashboardContent = document.querySelector('.dashboard-content'); // Reference to the container holding search/categories
    
    // Auto-tool elements
    const autoToolContainer = document.getElementById('auto-tool-container');
    const autoToolIframe = document.getElementById('auto-tool-iframe');
    const autoToolToggleBtn = document.getElementById('auto-tool-toggle-btn');

    // State
    let allToolsData = [];
    let expandedState = {}; // { categoryId: boolean }
    let isAutoToolCollapsed = false; // Track if auto-tool is collapsed

    // Icons
    const icons = {
        chevronRight: '<i class="bi bi-chevron-right"></i>',
        chevronDown: '<i class="bi bi-chevron-down"></i>',
        externalLink: '<i class="bi bi-box-arrow-up-right"></i>',
        iframe: '<i class="bi bi-layout-text-window-reverse"></i>', // Changed icon
        placeholder: '<i class="bi bi-gear"></i>',
        collapse: '<i class="bi bi-arrows-collapse"></i>',
        expand: '<i class="bi bi-arrows-expand"></i>'
    };

    // --- Helper Functions ---

    function createToolItemHTML(tool) {
        let actionIcon = icons.placeholder;
        if (tool.type === 'link') actionIcon = icons.externalLink;
        else if (tool.type === 'iframe') actionIcon = icons.iframe;

        return `
            <div class="tool-item" data-url="${tool.url || '#'}" data-type="${tool.type}" data-name="${tool.name}" title="${tool.description || tool.name}">
                <div class="tool-details">
                    <h3>${tool.name}</h3>
                    <p>${tool.description || 'Click to open'}</p>
                </div>
                <span class="tool-action-icon">${actionIcon}</span>
            </div>
        `;
    }

    function createCategoryPanelHTML(category, isExpanded) {
        const toolsHTML = category.tools.map(createToolItemHTML).join('');
        const chevronIcon = isExpanded ? icons.chevronDown : icons.chevronRight;
        const contentClasses = isExpanded ? 'category-content expanded' : 'category-content';
        const categoryIcon = category.icon ? `<i class="bi ${category.icon}"></i>` : '';

        // Add data-category-id to the outer panel div
        return `
            <div class="category-panel" data-category-id="${category.id}">
                <div class="category-header ${isExpanded ? 'expanded' : ''}">
                    <div class="category-title">
                        ${categoryIcon}
                        <span>${category.name}</span>
                    </div>
                    <div class="category-toggle-icon">${chevronIcon}</div>
                </div>
                <div class="${contentClasses}">
                   <div class="tool-list">
                        ${toolsHTML}
                   </div>
                </div>
            </div>
        `;
    }

    function renderCategories(categoriesToRender) {
        if (!categoryContainer) return;
        categoryContainer.innerHTML = ''; // Clear previous content

        if (categoriesToRender.length === 0 && searchBar.value) {
            noResultsDiv.classList.remove('hidden');
            searchTermDisplay.textContent = searchBar.value;
        } else {
            noResultsDiv.classList.add('hidden');
            categoriesToRender.forEach(category => {
                const isExpanded = categoriesToRender.length === 1 || !!expandedState[category.id];
                if (categoriesToRender.length === 1 && !expandedState[category.id]) {
                    expandedState[category.id] = true; // Auto-expand if only one category shown
                }
                const categoryHTML = createCategoryPanelHTML(category, isExpanded);
                categoryContainer.insertAdjacentHTML('beforeend', categoryHTML);
            });
        }
        // Re-attach listeners AFTER rendering content
        attachEventListeners();
    }

    function filterData(term) {
        const lowerCaseTerm = term.toLowerCase().trim();
        if (!lowerCaseTerm) return allToolsData;

        return allToolsData.map(category => {
            const categoryMatch = category.name.toLowerCase().includes(lowerCaseTerm);
            const matchingTools = category.tools.filter(tool =>
                tool.name.toLowerCase().includes(lowerCaseTerm) ||
                (tool.description && tool.description.toLowerCase().includes(lowerCaseTerm))
            );

            if (categoryMatch || matchingTools.length > 0) {
                const toolsToShow = matchingTools.length > 0 ? matchingTools : category.tools;
                return { ...category, tools: toolsToShow };
            }
            return null;
        }).filter(Boolean);
    }

    function openToolView(url, name) {
        // Update the new header: logo + Quick-Hub + tool name
        const iframeTitle = document.getElementById('iframe-title');
        if (iframeTitle) {
            iframeTitle.textContent = name;
        }
        toolIframe.src = url;
        toolView.classList.remove('hidden');
        dashboardContent.classList.add('hidden'); // Hide dashboard instead of setting display:none
        if (autoToolContainer) {
            autoToolContainer.classList.remove('visible'); // Hide auto-tool when opening full tool view
        }
        window.scrollTo(0, 0);
    }

    function closeToolView() {
        toolIframe.src = 'about:blank';
        iframeTitle.textContent = '';
        toolView.classList.add('hidden');
        dashboardContent.classList.remove('hidden'); // Show dashboard again
        
        // Check if we should show the auto-tool again when closing tool view
        checkAndLoadAutoTool();
    }

    function handleToolClick(event) {
        const toolItem = event.currentTarget; // Use currentTarget on the listener
        const url = toolItem.dataset.url;
        const type = toolItem.dataset.type;
        const name = toolItem.dataset.name;

        if (type === 'link' && url && url !== '#') {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else if (type === 'iframe' && url && url !== '#') {
            openToolView(url, name);
        } else if (type === 'placeholder') {
            alert(`Tool "${name}" is currently a placeholder.`);
        } else {
            console.warn(`Clicked tool: ${name}, Type: ${type}, URL: ${url} - No action defined.`);
        }
    }

    function handleCategoryToggle(event) {
        const header = event.currentTarget; // Use currentTarget on the listener
        const panel = header.closest('.category-panel'); // Find the parent panel
        if (!panel) return;

        const categoryId = panel.dataset.categoryId;
        const content = panel.querySelector('.category-content');
        const iconDiv = header.querySelector('.category-toggle-icon');

        expandedState[categoryId] = !expandedState[categoryId];
        const isNowExpanded = expandedState[categoryId];

        header.classList.toggle('expanded', isNowExpanded);
        content.classList.toggle('expanded', isNowExpanded);
        iconDiv.innerHTML = isNowExpanded ? icons.chevronDown : icons.chevronRight;
    }

    // Function to check screen width and load auto-tool if appropriate
    function checkAndLoadAutoTool() {
        // Verify that all required elements exist
        if (!dashboardContent || !autoToolContainer || !autoToolIframe || !toolView) {
            console.warn("Required DOM elements for auto-tool feature are missing");
            return;
        }

        const minWidthForAutoTool = 1024; // Minimum width in pixels
        const isWideScreen = window.innerWidth >= minWidthForAutoTool;
        const isToolViewOpen = !toolView.classList.contains('hidden');
        
        // Check if NVD_News tool exists in our data
        let nvdNewsUrl = null;
        let nvdNewsResultsOnlyUrl = null;
        if (allToolsData.length > 0) {
            // Look for the NVD_News tool
            for (const category of allToolsData) {
                const nvdNews = category.tools.find(tool => 
                    (tool.url && tool.url.includes('NVD_News')) || 
                    (tool.name && tool.name.toLowerCase().includes('vulnews')) ||
                    (tool.name && tool.name.toLowerCase().includes('vulnerability'))
                );
                if (nvdNews) {
                    nvdNewsUrl = nvdNews.url;
                    // Create the URL for the results-only view
                    nvdNewsResultsOnlyUrl = nvdNewsUrl.replace('index.html', 'results-only.html');
                    if (!nvdNewsResultsOnlyUrl.includes('results-only.html')) {
                        // If URL doesn't end with a filename, append results-only.html
                        nvdNewsResultsOnlyUrl = nvdNewsUrl + (nvdNewsUrl.endsWith('/') ? '' : '/') + 'results-only.html';
                    }
                    break;
                }
            }
        }
        
        // Update classes based on conditions
        if (isWideScreen && !isToolViewOpen && nvdNewsResultsOnlyUrl && !isAutoToolCollapsed) {
            // Load NVD_News results-only view if screen is wide enough and tool view isn't open
            dashboardContent.classList.add('with-auto-tool');
            autoToolContainer.classList.add('visible');
            
            // Only set src if it's not already loaded (to prevent unnecessary reloads)
            if (autoToolIframe.src === 'about:blank' || !autoToolIframe.src.includes('results-only.html')) {
                autoToolIframe.src = nvdNewsResultsOnlyUrl;
            }
        } else {
            // Hide auto-tool if conditions aren't met
            dashboardContent.classList.remove('with-auto-tool');
            autoToolContainer.classList.remove('visible');
        }
    }

    function toggleAutoTool() {
        isAutoToolCollapsed = !isAutoToolCollapsed;
        
        // Update button icon
        autoToolToggleBtn.innerHTML = isAutoToolCollapsed ? icons.expand : icons.collapse;
        
        if (isAutoToolCollapsed) {
            // Hide the auto tool
            dashboardContent.classList.remove('with-auto-tool');
            autoToolContainer.classList.remove('visible');
        } else {
            // Show the auto tool again
            checkAndLoadAutoTool();
        }
    }

    // Centralized function to attach listeners
    function attachEventListeners() {
        // Tool item clicks
        const toolItems = categoryContainer.querySelectorAll('.tool-item');
        toolItems.forEach(item => {
            item.removeEventListener('click', handleToolClick); // Prevent duplicates
            item.addEventListener('click', handleToolClick);
        });

        // Category header clicks (for toggle)
        const categoryHeaders = categoryContainer.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            header.removeEventListener('click', handleCategoryToggle); // Prevent duplicates
            header.addEventListener('click', handleCategoryToggle);
        });
    }


    // --- Global Event Listeners ---

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        const filtered = filterData(searchTerm);

        // Reset or auto-expand based on search term
        expandedState = {}; // Clear state on new search
        if (searchTerm && filtered.length > 0) {
            // Auto-expand all categories with results when searching
            filtered.forEach(cat => expandedState[cat.id] = true);
        }
        renderCategories(filtered);
    });

    iframeCloseBtn.addEventListener('click', closeToolView);
    
    // Auto tool toggle button listener
    if (autoToolToggleBtn) {
        autoToolToggleBtn.addEventListener('click', toggleAutoTool);
    }
    
    // Listen for window resize events
    window.addEventListener('resize', checkAndLoadAutoTool);

    // --- Initialisation ---
    async function initializeApp() {
        if (footerYear) {
            footerYear.textContent = new Date().getFullYear();
        }

        try {
            const response = await fetch('tools.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            allToolsData = data.categories;
            renderCategories(allToolsData);
            
            // Check if we should load the auto-tool after data is loaded
            setTimeout(checkAndLoadAutoTool, 500); // Small delay to ensure everything is rendered
        } catch (error) {
            console.error("Error fetching or parsing tools.json:", error);
            categoryContainer.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 2rem;">Error loading tools data. Please check tools.json and ensure it's accessible.</p>`;
        }
    }

    initializeApp();
});