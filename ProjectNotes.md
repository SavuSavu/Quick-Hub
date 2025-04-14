# Quick-Hub Project Notes

## Goal

Integrate three separate web applications (SBOM Analyzer, NetScan Pro "NOT-PING", Quick-Hub placeholder) into a single, cohesive project named "Quick-Hub". The project should feature a unified dark theme based on "NOT-PING", dynamically load tools from `tools.json`, and embed local tools using iframes.

## Key Design Decisions & Changes

1.  **Unified Styling:**
    *   Based `styles.css` primarily on the "NOT-PING" application's CSS.
    *   Defined CSS variables for colors, fonts, etc., ensuring consistency.
    *   Adapted styles for category panels and tool items within the main dashboard.
    *   Removed individual CSS files from `BOMStorm` and `NOT-PING`, making them link to the main `styles.css`.
2.  **Dynamic Loading:**
    *   Implemented fetching and parsing of `tools.json` in the main `scripts.js`.
    *   The dashboard UI (categories, tools) is now generated entirely from this JSON data.
3.  **Tool Integration:**
    *   Adopted an iframe-based approach for loading local tools (`BOMStorm`, `NOT-PING`). This keeps the Quick-Hub header/footer context (though they are currently minimal) and provides better visual integration than simple links.
    *   External tools are opened in a new tab (`type: "link"`).
    *   Placeholders (`type: "placeholder"`) show an alert.
4.  **UI Structure:**
    *   Simplified the main Quick-Hub layout. Removed the original sidebar concept in favor of showing categories/tools directly in the main content area.
    *   Introduced a dedicated view (`#tool-view`) to host the iframe, which is shown/hidden as needed.
5.  **Tool Adaptation:**
    *   Modified `BOMStorm`'s HTML to fit within the theme (using cards, common button styles) and removed its header/footer. Critically updated its Cytoscape styling in JS to use the new CSS variables. Adapted its tab switching logic for the new structure.
    *   Modified `NOT-PING`'s HTML similarly, removing header/footer and relying on the main CSS. Minor JS adjustments for CSS compatibility (e.g., connection bars). Removed less relevant sections (Network Info, History) for the iframe context.
6.  **Framework:** Stuck to vanilla HTML, CSS, and JavaScript as per the original examples provided.

## Challenges

*   **CSS Specificity/Cascading:** Ensuring the main `styles.css` applied correctly within the iframed tools without major conflicts required careful selector choices and removing the tools' original CSS.
*   **Cytoscape Styling:** Adapting the hardcoded color values in `BOMStorm`'s JavaScript to use CSS variables required careful mapping and testing.
*   **Iframe Communication (Not Implemented):** For more advanced features (e.g., passing search terms *into* a tool), iframe communication mechanisms (like `postMessage`) would be needed, adding complexity. This was kept simple for now.

## Future Enhancements

*   **Theme Toggle:** Implement light/dark mode switching that also updates the Cytoscape graph style in BOMStorm.
*   **Settings Persistence:** Save category expansion state (e.g., in localStorage).
*   **Improved Search:** Highlight matching text within tool descriptions.
*   **More Tools:** Integrate actual functionality for the placeholder tools.
*   **Error Handling:** More robust error handling for `tools.json` fetching and iframe loading.
*   **Accessibility:** Perform a thorough accessibility audit.