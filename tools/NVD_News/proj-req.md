Core Architecture for: Vulnews
Foundation: Standard HTML5, CSS3, and modern JavaScript (ES6+).
Execution Environment: Runs entirely within the user's web browser.
No Backend: No server-side logic, database, or build process (like Webpack, Babel, npm). Files are served statically (can be opened directly from the filesystem or hosted on simple static hosting like GitHub Pages).
Data Fetching: JavaScript's fetch API will be used directly from the browser to query the public APIs of vulnerability databases.
Key Technology Choices (MVS):
HTML: Semantic HTML for structure (header, main content area, filter/search controls, list area, detail view area).
CSS:
Layout: Flexbox or CSS Grid for responsive layout structure.
Mobile-First: Styles defined primarily for small screens, with min-width media queries to adapt for larger screens.
Styling: Basic styling for readability, clear visual hierarchy, and creating "big button" aesthetics for pickers. Active/selected states for buttons.
JavaScript (Vanilla):
DOM Manipulation: Standard document.getElementById, createElement, appendChild, classList, etc., to update the UI dynamically.
Event Handling: addEventListener for user interactions (button clicks, search input).
API Interaction: fetch API to make asynchronous requests to external CVE databases. Handling Promises (async/await).
State Management (Simple): JavaScript variables/objects to keep track of selected severity, selected sources, search terms, fetched data, and current view (list vs. detail). No complex state library.
Routing (Simulated): Basic view switching by hiding/showing different div sections rather than using URL hash changes or History API (simplifies MVS).
Core Components/Modules (Logical Separation in JS):
apiService.js (Conceptual): A section of your script (or a separate file if you allow basic <script type="module">) responsible for:
Knowing the base URLs and query parameters for each target API (NVD, GitHub Advisories, etc.).
Functions to fetch data from each source, accepting parameters like severity, keywords, date ranges.
Crucially: A normalization layer to transform the data from each different API response structure into a consistent internal format (e.g., { id: 'CVE-xxxx-xxxx', source: 'NVD', severity: 'CRITICAL', publishedDate: '...', description: '...', url: '...' }). This is vital for displaying data from multiple sources uniformly.
uiManager.js (Conceptual): Handles all direct DOM manipulation:
Rendering the list of CVEs based on normalized data.
Rendering the detail view for a selected CVE.
Updating button states (active/inactive).
Showing/hiding loading indicators and error messages.
Handling view switching (showing list vs. detail).
appState.js (Conceptual): A simple object holding the current application state:
selectedSeverities: Array (e.g., ['CRITICAL', 'HIGH'])
selectedSources: Array (e.g., ['NVD', 'GITHUB'])
searchTerm: String
vulnerabilities: Array of normalized CVE data currently loaded/displayed.
isLoading: Boolean
error: String or null
currentView: String ('list' or 'detail')
selectedCVE: Object (details for the detail view)
main.js / script.js (Entry Point):
Initializes the application on DOMContentLoaded.
Sets up initial state.
Adds event listeners to UI elements (buttons, search input).
Orchestrates the flow: User interaction -> Update appState -> Call apiService (if needed) -> Process results -> Update appState -> Call uiManager to render changes.
Key Features Implementation (MVS Approach):
Multiple Vuln DBs:
MVS Target: Start with 2 sources, e.g., NVD (REST API 2.0) and GitHub Advisories (REST API - simpler than GraphQL for MVS, though potentially less powerful).
API Calls: Implement separate fetch functions within apiService for each. Handle potential differences in authentication (NVD allows limited anonymous, GitHub might require a token for better rates/access - consider user-provided token input for MVS, stored in localStorage temporarily).
Aggregation: Fetch from selected sources either sequentially or concurrently (Promise.all). Combine the normalized results into a single list in appState. Handle potential duplicates (e.g., based on CVE ID).
Severity Picker (Big Buttons):
HTML: A div containing <button> elements for each severity level (e.g., Critical, High, Medium, Low).
CSS: Style buttons to be large, clear, and touch-friendly. Use classes to indicate selected state.
JS: Add event listeners. On click:
Update the appState.selectedSeverities array.
Update button visual states (add/remove 'active' class).
Trigger a data refresh (either re-fetch from APIs with new severity filters OR filter the already loaded data if feasible for MVS). API filtering is generally better but more complex to implement across different APIs. Client-side filtering of a larger dataset is simpler for MVS but less efficient.
Source Picker (Big Buttons):
HTML/CSS/JS: Similar implementation to the severity picker, but for data sources (NVD, GitHub, etc.). Updates appState.selectedSources and triggers a data refresh, likely requiring new API calls to the selected sources.
Search Functionality:
HTML: An <input type="search"> field and possibly a search <button>.
JS: Add event listener (input or change event, or button click).
Update appState.searchTerm.
MVS Approach 1 (Simpler): Client-side Filter: Filter the appState.vulnerabilities array based on the search term matching CVE ID or description text. Re-render the list via uiManager. This requires fetching a reasonable amount of data initially.
MVS Approach 2 (More Complex): API Search: Construct new API queries incorporating the search term (if the APIs support keyword search). Trigger API fetches via apiService. This is more efficient for large datasets but harder to implement consistently across APIs. Recommendation for MVS: Start with client-side filtering.
Mobile-First, Simple & Engaging Interface:
Layout: Use Flexbox/Grid for main layout areas (filters, list, details) that reflow naturally on different screen sizes.
Controls: Ensure buttons and interactive elements have sufficient padding and size for easy tapping.
Readability: Use clear fonts and good contrast.
Feedback: Implement clear loading indicators (spinners/text) and user-friendly error messages. Visual cues for selected filters/buttons.
Engagement (MVS): Focus on clarity, responsiveness, and ease of use. Smooth transitions are nice-to-haves, likely deferred post-MVS.
Challenges & MVS Scope Limitations:
API Keys/Authentication: Handling API keys securely on the client-side is inherently difficult. MVS might rely on anonymous access (with rate limits) or require the user to paste keys into an input field (stored temporarily in localStorage or just in memory).
API Rate Limits: Direct client-side calls mean the user's IP hits the limits. MVS needs basic error handling for 429/403 errors, informing the user. Cannot implement server-side caching or rate-limiting strategies.
Data Normalization Complexity: Each API returns data differently. The normalization logic can become complex, especially when handling varying fields, severity scales (CVSS v2 vs v3), and reference types. MVS might only normalize essential fields (ID, description, severity, date, source URL).
Client-Side Performance: Fetching, normalizing, and rendering data from multiple sources can be slow, especially on mobile. MVS should fetch moderate amounts of data initially (e.g., last 30 days, limited results per source) and rely on client-side filtering/search for simplicity, accepting performance trade-offs. Pagination via API parameters is a post-MVS improvement.
Cross-Origin Resource Sharing (CORS): The APIs must have permissive CORS headers allowing requests from null origin (for file://) or * / specific domains if hosted. Public APIs usually do, but it's a prerequisite.