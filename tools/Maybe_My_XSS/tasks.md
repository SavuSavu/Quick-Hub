# XSS Prober - Task List

## Phase 1: Basic Structure & UI (Completed)

* [x] Create `index.html` with basic layout (URL input, iframe container, controls, results panel).
* [x] Create `style.css` for basic dark theme styling using Tailwind CSS.
* [x] Create `app.js` for core application logic.
* [x] Create `payloads.js` with an initial list of XSS payloads.
* [x] Link CSS, JS, and payload files in `index.html`.
* [x] Implement basic dark theme consistent with Quick-Hub.
* [x] Add Inter font.
* [x] Add basic responsive design using Tailwind.

## Phase 2: Core Functionality (Completed - Initial Version)

* [x] Implement URL input and "Load Target" button functionality.
* [x] Load the target URL into the `iframe`.
* [x] Add basic `sandbox` attributes to the iframe (`allow-scripts`, `allow-forms`).
* [x] Implement basic error handling for iframe loading (detect `X-Frame-Options`/CSP blocking - best effort).
    * [x] Show placeholder/blocker messages in the iframe area.
* [x] Populate payload dropdown from `payloads.js`.
* [x] Implement parameter name input.
* [x] Implement "Inject & Reload" button functionality.
* [x] Construct new URL with payload in query parameter.
* [x] Construct new URL with payload in URL fragment (#).
* [x] Reload the iframe with the constructed URL.
* [x] Implement results log panel.
* [x] Add log entries for actions (loading, injecting, errors).
* [x] Add clear warnings about manual inspection requirements due to browser limitations.
* [x] Add ethical use warning.
* [x] Implement a simple message box for user feedback (e.g., "URL loaded", "Select payload").

## Phase 3: Enhancements (Future Considerations)

* [ ] **Payload Management:**
    * [ ] Allow users to add, edit, and delete custom payloads via the UI. Store custom payloads in localStorage for persistence across sessions.
    * [ ] Enable editing of both the payload string and its display name for user-added payloads.
    * [ ] Support categorization of payloads (e.g., Reflected, DOM, Polyglot, Custom) using tags or a dropdown filter in the UI.
    * [ ] Allow filtering of payloads by category for easier selection.
    * [ ] Provide an option to select multiple payloads and run them sequentially against the target, with user confirmation before starting. Log each attempt separately in the activity log.
    * [ ] Clearly mark user-added payloads as "Custom" in the dropdown and allow easy management (edit/delete) from the UI.
* [ ] **Advanced Injection:**
    * [ ] Explore ways to simulate POST requests (potentially using a hidden form submitted via JS, though complex and may not be accurate).
    * [ ] Handle different encoding types for payloads.
* [ ] **Reporting:**
    * [ ] Allow exporting the log.
    * [ ] Add timestamps to log entries (Completed).
* [ ] **UI/UX Improvements:**
    * [ ] Better visual indication of iframe loading state.
    * [ ] Clearer separation between controls and results.
    * [ ] More detailed error messages.
* [ ] **Documentation:**
    * [ ] Add inline comments explaining code sections (Completed).
    * [ ] Improve `project_notes.md` with findings.

## Phase 4: Integration (Completed)

* [x] Create `tools.json` entry.
* [x] Ensure file structure matches `Quick-Hub/tools/xss-prober/`.
* [x] Create `tasks.md` (this file).
* [x] Create `project_notes.md`.

