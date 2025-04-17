# XSS Prober - Project Notes

## Key Challenges & Limitations

* **Same-Origin Policy (SOP):** This is the biggest hurdle. The parent window (XSS Prober tool) cannot directly access the DOM, execute scripts, or read content from a cross-origin iframe (`target-iframe`). This prevents automated detection of:
    * Reflected payloads in the HTML source.
    * DOM changes caused by payloads.
    * Successful script execution (e.g., `alert()` boxes) unless the payload explicitly communicates outwards (e.g., `postMessage`, changing `window.location`).
* **`X-Frame-Options` & `Content-Security-Policy (frame-ancestors)`:** Many websites prevent themselves from being loaded into iframes using these headers. The tool attempts to detect this but relies on indirect methods (`onerror`, checking `contentWindow.location` which might fail) which aren't foolproof. When blocked, testing is impossible.
* **Sandboxing:** The `sandbox` attribute on the iframe adds security but also restricts the loaded page. While `allow-scripts` and `allow-forms` are necessary for testing, they don't override SOP for the *parent* frame's access.
* **POST Requests:** Simulating POST requests accurately from the client-side without direct form access is difficult. The current version focuses on GET parameters and URL fragments.
* **Stored XSS Detection:** Impossible purely client-side without specific knowledge of the application or backend interaction. This tool focuses on Reflected and DOM-based vectors that can be triggered via URL manipulation.

## Design Decisions

* **Manual Inspection Focus:** Due to the limitations, the tool primarily acts as a *payload injector* and *test harness*. The core "detection" relies on the user manually observing the iframe's behavior after injection. The UI and logs emphasize this.
* **GET/Fragment Injection:** Focused on the most feasible client-side injection methods: modifying query parameters and the URL fragment.
* **Basic Error Handling:** Implemented basic checks for URL validity and iframe load failures, acknowledging these checks aren't perfect.
* **Payload List:** Provided a static list in `payloads.js` for simplicity. A future enhancement could allow user-defined payloads.
* **UI:** Used Tailwind CSS for rapid development of a clean, dark-themed interface consistent with the Quick-Hub concept.

## Test Scenarios

* **Target Loads Successfully:**
    * Input a test site known to allow iframing (e.g., a simple personal page or a specifically configured test environment).
    * Inject basic `<script>alert(1)</script>` into a known vulnerable parameter (e.g., `?query=<script>alert(1)</script>`).
    * **Expected:** Iframe reloads. User *manually* observes the alert box. Log shows injection attempt.
* **Target Blocks Iframe:**
    * Input a major site likely using `X-Frame-Options` (e.g., `google.com`).
    * **Expected:** Iframe shows blocker message. Log indicates loading failure. Injection button remains disabled or becomes disabled.
* **Inject into Fragment:**
    * Load a test page.
    * Select a payload, leave parameter name blank.
    * **Expected:** Iframe reloads with `#payload` appended. User *manually* observes if any client-side JS on the target page processes the fragment unsafely. Log shows fragment injection attempt.
* **Invalid URL Input:**
    * Enter "not a url".
    * **Expected:** User sees a message via the message box. No iframe loading attempt.
* **No Payload Selected:**
    * Load URL, click inject without selecting payload.
    * **Expected:** User sees message box feedback. No injection occurs.

## Future Improvements / Ideas

* Investigate if `postMessage` could be used *if* the target site has a vulnerability allowing script execution. The injected payload could try to `postMessage` back to the parent window, which *could* be detected. This requires specific payload crafting.
* Consider providing links to browser developer tools to encourage manual inspection.
* Add functionality to cycle through all payloads for a given parameter automatically (with user confirmation).

