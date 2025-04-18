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
    *   Adopted an iframe-based approach for loading local tools (`BOMStorm`, `NOT-PING`, `QE`). This keeps the Quick-Hub header/footer context (though they are currently minimal) and provides better visual integration than simple links.
    *   External tools are opened in a new tab (`type: "link"`).
    *   Placeholders (`type: "placeholder"`) show an alert.
4.  **UI Structure:**
    *   Simplified the main Quick-Hub layout. Removed the original sidebar concept in favor of showing categories/tools directly in the main content area.
    *   Introduced a dedicated view (`#tool-view`) to host the iframe, which is shown/hidden as needed.
    *   Added responsive side-by-side layout with auto-loaded NVD_News (Vulnews) tool that appears when viewport is wide enough.
5.  **Tool Adaptation:**
    *   Modified `BOMStorm`'s HTML to fit within the theme (using cards, common button styles) and removed its header/footer. Critically updated its Cytoscape styling in JS to use the new CSS variables. Adapted its tab switching logic for the new structure.
    *   Modified `NOT-PING`'s HTML similarly, removing header/footer and relying on the main CSS. Minor JS adjustments for CSS compatibility (e.g., connection bars). Removed less relevant sections (Network Info, History) for the iframe context.
    *   Created a streamlined "results-only.html" for NVD_News to display just vulnerability data in the auto-tool panel, enabling more efficient use of screen space.
    *   Integrated **Quick Edit (QE)** as a full-featured client-side code editor (Monaco-based) under the new "Editors" category. QE supports file/folder management, GitHub/URL import, and workspace ZIP download, and is styled to match the Quick-Hub dark theme.
6.  **Framework:** Stuck to vanilla HTML, CSS, and JavaScript as per the original examples provided.
7.  **Auto-Tool Feature:**
    *   Implemented automatic loading of the NVD_News (Vulnews) tool in a side panel on wider screens.
    *   Added viewport width detection to show/hide the auto-tool panel based on available space.
    *   Created responsive layout that adjusts the dashboard width when the auto-tool panel is visible.
    *   Implemented smart loading of vulnerability news with a results-focused view to maximize information density.

## Newly Integrated Tools

* **XSS Prober** (tools/Maybe_My_XSS/index.html)
    * Category: Injections
    * Description: Test for reflected and DOM-based XSS vulnerabilities by injecting payloads into URLs and fragments. Manual inspection required due to browser security restrictions.
    * Integrated as an iframe tool via tools.json.
    * See tools/Maybe_My_XSS/projectNotes.md for technical notes and limitations.

* **Quick Edit (QE)** (tools/QE/index.html)
    * Category: Editors
    * Description: Client-side code editor with Monaco, file/folder management, GitHub/URL import, and workspace ZIP download.
    * Integrated as an iframe tool via tools.json.
    * See tools/QE/projectNotes.md for technical notes and limitations.

## Challenges

*   **CSS Specificity/Cascading:** Ensuring the main `styles.css` applied correctly within the iframed tools without major conflicts required careful selector choices and removing the tools' original CSS.
*   **Cytoscape Styling:** Adapting the hardcoded color values in `BOMStorm`'s JavaScript to use CSS variables required careful mapping and testing.
*   **Iframe Communication (Not Implemented):** For more advanced features (e.g., passing search terms *into* a tool), iframe communication mechanisms (like `postMessage`) would be needed, adding complexity. This was kept simple for now.
*   **Responsive Layout:** Creating a flexible layout that accommodates both the main dashboard and the auto-tool panel required careful CSS planning, particularly for different viewport sizes.
*   **Auto-Tool Loading:** Determining the appropriate conditions to show the auto-tool and ensuring it behaves correctly when switching between different views.
*   **QE Integration:** Ensuring Monaco editor loads correctly in an iframe, and that file/folder management, GitHub/URL import, and workspace ZIP download all work as expected within the Quick-Hub context.

## Future Enhancements

*   **Theme Toggle:** Implement light/dark mode switching that also updates the Cytoscape graph style in BOMStorm and the QE editor theme.
*   **Settings Persistence:** Save category expansion state (e.g., in localStorage).
*   **Improved Search:** Highlight matching text within tool descriptions.
*   **More Tools:** Integrate actual functionality for the placeholder tools.
*   **Error Handling:** More robust error handling for `tools.json` fetching and iframe loading.
*   **Accessibility:** Perform a thorough accessibility audit.
*   **Auto-Tool Configuration:** Allow users to select which tool appears in the auto-tool panel.
*   **Synchronization:** Implement communication between the main dashboard and auto-tool panel (e.g., filtering vulnerability results based on dashboard context).
*   **QE Enhancements:** Add tabbed editing, drag-and-drop, and advanced Monaco features to QE.