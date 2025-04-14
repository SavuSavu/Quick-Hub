// tools/NOT-PING/scripts.js
document.addEventListener('DOMContentLoaded', function() {
    // --- UI Elements ---
    // Tab Elements
    const tabs = document.querySelectorAll('.tab'); // Use button.tab selector
    const tabContents = document.querySelectorAll('.tab-content');

    // General Input/Action
    const startTestBtn = document.getElementById('startTestBtn');
    const hostInput = document.getElementById('hostInput');

    // Ping Elements
    const pingResult = document.getElementById('pingResult');
    const singlePingBtn = document.getElementById('singlePingBtn');
    const continuousPingBtn = document.getElementById('continuousPingBtn');
    const pingProgress = document.getElementById('pingProgress');
    const pingProgressFill = document.getElementById('pingProgressFill');
    const pingProgressText = document.getElementById('pingProgressText');

    // Latency Elements
    const latencyResult = document.getElementById('latencyResult');
    const measureLatencyBtn = document.getElementById('measureLatencyBtn');
    const stopLatencyBtn = document.getElementById('stopLatencyBtn');
    const currentLatencyEl = document.getElementById('currentLatency');
    const minLatencyEl = document.getElementById('minLatency');
    const maxLatencyEl = document.getElementById('maxLatency');
    const avgLatencyEl = document.getElementById('avgLatency');
    const latencyProgress = document.getElementById('latencyProgress');
    const latencyProgressFill = document.getElementById('latencyProgressFill');
    const latencyProgressText = document.getElementById('latencyProgressText');

    // Traceroute Elements
    const traceResult = document.getElementById('traceResult');
    const startTraceBtn = document.getElementById('startTraceBtn');
    const traceProgress = document.getElementById('traceProgress');
    const traceProgressFill = document.getElementById('traceProgressFill');
    const traceProgressText = document.getElementById('traceProgressText');

    // DNS Elements
    const dnsResult = document.getElementById('dnsResult');
    const dnsLookupBtn = document.getElementById('dnsLookupBtn');
    const dnsInput = document.getElementById('dnsInput');
    const dnsType = document.getElementById('dnsType');
    const dnsProgress = document.getElementById('dnsProgress');
    const dnsProgressFill = document.getElementById('dnsProgressFill');
    const dnsProgressText = document.getElementById('dnsProgressText');

    // Connection Status Elements
    const connectivityStatus = document.getElementById('connectivityStatus');
    const connectivityLabel = document.getElementById('connectivityLabel');
    const connectionBars = document.getElementById('connectionBars');

    // --- State Variables ---
    let activeTab = 'ping'; // Default active tab
    let pingInterval = null;
    let latencyInterval = null;
    let latencyMeasurements = [];
    let traceTimeout = null; // To stop traceroute simulation if needed

    // --- Initialize the app ---
    init();

    function init() {
        checkConnectivity(); // Start checking connectivity

        // Tab switching logic
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTabId = tab.dataset.tab;
                if (targetTabId === activeTab) return; // Do nothing if already active

                // Update active tab state
                activeTab = targetTabId;

                // Update UI for tabs
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                const targetContent = document.getElementById(`${targetTabId}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // Stop any ongoing tests when switching tabs
                stopAllTests();
                updateUITabChange(); // Reset UI elements specific to tabs
            });
        });

        // Button click handlers
        startTestBtn.addEventListener('click', runActiveTest);
        singlePingBtn.addEventListener('click', () => runPingTest(5));
        continuousPingBtn.addEventListener('click', runContinuousPing);
        measureLatencyBtn.addEventListener('click', measureLatency);
        stopLatencyBtn.addEventListener('click', stopLatency);
        startTraceBtn.addEventListener('click', runTraceRoute);
        dnsLookupBtn.addEventListener('click', runDnsLookup);

        // Keyboard support for inputs
        hostInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runActiveTest();
        });
        dnsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runDnsLookup();
        });
    }

    // --- Core Test Logic ---

    function runActiveTest() {
        const host = hostInput.value.trim();
        if (!host && (activeTab === 'ping' || activeTab === 'latency' || activeTab === 'traceroute')) {
            showError(activeTab, 'Please enter a hostname or IP address');
            return;
        }

        stopAllTests(); // Stop previous tests before starting new one

        switch (activeTab) {
            case 'ping':
                runPingTest(5); // Default to 5 pings
                break;
            case 'latency':
                measureLatency();
                break;
            case 'traceroute':
                runTraceRoute();
                break;
            case 'dns':
                runDnsLookup(); // DNS uses its own input mostly
                break;
        }
    }

    function stopAllTests() {
        // Stop Ping
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
            setPingButtonsState(true); // Re-enable buttons
            pingProgress.classList.add('hidden'); // Hide progress
        }
        // Stop Latency
        if (latencyInterval) {
             stopLatency(); // Use existing stop function
        }
        // Stop Traceroute (clear timeout)
        if(traceTimeout){
            clearTimeout(traceTimeout);
            traceTimeout = null;
            startTraceBtn.disabled = false;
            traceProgress.classList.add('hidden');
        }
        // DNS doesn't have a continuous mode currently
    }

    // --- Ping Functionality ---
    function setPingButtonsState(enabled) {
         singlePingBtn.disabled = !enabled;
         continuousPingBtn.disabled = !enabled;
         startTestBtn.disabled = !enabled; // Also disable main run button
    }

    function runPingTest(count = 5) { // count = -1 for continuous
        const host = hostInput.value.trim();
        if (!host) {
            showError('ping', 'Please enter a hostname or IP address');
            return;
        }
        stopAllTests(); // Ensure other tests are stopped

        setPingButtonsState(false); // Disable buttons
        pingResult.innerHTML = `Pinging ${host}...<br>`;
        pingProgressFill.style.width = '0%';
        pingProgressText.textContent = count === -1 ? `Continuous ping starting...` : `Running test (0/${count})`;
        pingProgress.classList.remove('hidden');

        let packetsSent = 0;
        let packetsReceived = 0;
        let rttData = []; // Store round-trip times

        function sendPing() {
             // Check stop condition for fixed count
            if (count !== -1 && packetsSent >= count) {
                clearInterval(pingInterval);
                pingInterval = null;
                finalizePing(host, count, packetsReceived, rttData);
                return;
            }

            packetsSent++;
            if (count !== -1) {
                pingProgressFill.style.width = `${(packetsSent / count) * 100}%`;
                pingProgressText.textContent = `Running test (${packetsSent}/${count})`;
            } else {
                pingProgressText.textContent = `Continuous ping running (${packetsSent} sent)`;
            }

            // --- Simulation ---
            const startTime = performance.now();
            const isLost = Math.random() < 0.05; // 5% packet loss chance
            const delay = Math.random() * (60 - 5) + 5; // Simulated RTT 5-60ms

            setTimeout(() => {
                // Check if interval was cleared while waiting for timeout (e.g., tab switch)
                if(!pingInterval && count === -1) return;

                if (!isLost) {
                    packetsReceived++;
                    const rtt = performance.now() - startTime; // More realistic RTT
                    rttData.push(rtt);
                    pingResult.innerHTML += `Reply from ${host}: time=${rtt.toFixed(1)}ms TTL=64<br>`;
                } else {
                    pingResult.innerHTML += `Request timed out.<br>`;
                }
                pingResult.scrollTop = pingResult.scrollHeight; // Auto-scroll
            }, delay);
             // --- End Simulation ---
        }

        const intervalTime = count === -1 ? 1000 : 500; // Faster for fixed count
        pingInterval = setInterval(sendPing, intervalTime);
        sendPing(); // Send first immediately
    }

    function runContinuousPing() {
        runPingTest(-1);
    }

    function finalizePing(host, count, packetsReceived, rttData) {
         const packetsLost = count - packetsReceived;
         const lossPercent = count > 0 ? ((packetsLost / count) * 100).toFixed(1) : 0;
         let minTime = '-', maxTime = '-', avgTime = '-';

         if (rttData.length > 0) {
             minTime = Math.min(...rttData).toFixed(1);
             maxTime = Math.max(...rttData).toFixed(1);
             avgTime = (rttData.reduce((a, b) => a + b, 0) / rttData.length).toFixed(1);
         }

         pingResult.innerHTML += `<br>--- ${host} ping statistics ---<br>` +
             `${count} packets transmitted, ${packetsReceived} received, ${lossPercent}% packet loss<br>`;
         if (rttData.length > 0) {
             pingResult.innerHTML += `rtt min/avg/max = ${minTime}/${avgTime}/${maxTime} ms<br>`;
         }

         setPingButtonsState(true); // Re-enable buttons
         pingProgress.classList.add('hidden');
         pingResult.scrollTop = pingResult.scrollHeight;
    }


    // --- Latency Measurement ---
    function setLatencyButtonsState(measuring) {
         measureLatencyBtn.disabled = measuring;
         stopLatencyBtn.disabled = !measuring;
         startTestBtn.disabled = measuring; // Also disable main run button
    }

    function measureLatency() {
        const host = hostInput.value.trim();
        if (!host) {
            showError('latency', 'Please enter a hostname or IP address');
            return;
        }
        stopAllTests();

        latencyMeasurements = []; // Reset measurements
        setLatencyButtonsState(true); // Disable measure, enable stop
        latencyResult.innerHTML = `Measuring latency to ${host}...<br>`;
        currentLatencyEl.textContent = '-';
        minLatencyEl.textContent = '-';
        maxLatencyEl.textContent = '-';
        avgLatencyEl.textContent = '-';
        latencyProgressFill.style.width = '0%';
        latencyProgressText.textContent = 'Measuring latency for 15 seconds';
        latencyProgress.classList.remove('hidden');

        const duration = 15; // seconds
        let startTime = Date.now();
        let elapsedSeconds = 0;

        function measure() {
            elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const progressPercent = Math.min(100, (elapsedSeconds / duration) * 100);
            latencyProgressFill.style.width = `${progressPercent}%`;
            const remaining = duration - elapsedSeconds;
            latencyProgressText.textContent = `Measuring latency for ${remaining} second${remaining !== 1 ? 's' : ''}...`;

            // Stop condition
            if (elapsedSeconds >= duration) {
                stopLatency(); // Call stop function to finalize
                return;
            }

            // --- Simulation ---
            const latency = Math.random() * (110 - 5) + 5; // 5-110ms
            latencyMeasurements.push(latency);
            // --- End Simulation ---

            currentLatencyEl.textContent = latency.toFixed(1) + 'ms';
            updateLatencyStats();

            latencyResult.innerHTML += `[${new Date().toLocaleTimeString()}] Latency: ${latency.toFixed(1)}ms<br>`;
            latencyResult.scrollTop = latencyResult.scrollHeight;
        }

        latencyInterval = setInterval(measure, 1000);
        measure(); // Start immediately
    }

    function stopLatency() {
        if (latencyInterval) {
            clearInterval(latencyInterval);
            latencyInterval = null;
            setLatencyButtonsState(false); // Enable measure, disable stop
            latencyProgress.classList.add('hidden');

            if (latencyMeasurements.length > 0) {
                 updateLatencyStats(); // Ensure final stats are displayed
                 latencyResult.innerHTML += `<br>--- Latency test stopped (${latencyMeasurements.length} measurements) ---<br>`;
            } else {
                 latencyResult.innerHTML += `<br>--- Latency test stopped (No measurements) ---<br>`;
            }
             latencyResult.scrollTop = latencyResult.scrollHeight;
        }
    }

    function updateLatencyStats() {
         if (latencyMeasurements.length > 0) {
             let min = Math.min(...latencyMeasurements);
             let max = Math.max(...latencyMeasurements);
             let avg = latencyMeasurements.reduce((a, b) => a + b, 0) / latencyMeasurements.length;
             minLatencyEl.textContent = min.toFixed(1) + 'ms';
             maxLatencyEl.textContent = max.toFixed(1) + 'ms';
             avgLatencyEl.textContent = avg.toFixed(1) + 'ms';
         } else {
             minLatencyEl.textContent = '-';
             maxLatencyEl.textContent = '-';
             avgLatencyEl.textContent = '-';
         }
    }

    // --- Traceroute Functionality ---
    function runTraceRoute() {
        const host = hostInput.value.trim();
        if (!host) {
            showError('traceroute', 'Please enter a hostname or IP address');
            return;
        }
        stopAllTests();

        startTraceBtn.disabled = true;
        startTestBtn.disabled = true; // Disable main button
        traceResult.innerHTML = `Tracing route to ${host} (max 30 hops):<br><br>`;
        traceProgressFill.style.width = '0%';
        traceProgressText.textContent = 'Tracing hops (0/30)';
        traceProgress.classList.remove('hidden');

        // --- Simulation ---
        const maxHops = 30;
        const actualHops = Math.min(maxHops, Math.floor(Math.random() * 15) + 5); // Simulate 5-19 hops to reach target
        let currentHop = 0;

        function traceHop() {
            if(traceTimeout === null) return; // Stop if cancelled

            currentHop++;
            traceProgressFill.style.width = `${(currentHop / maxHops) * 100}%`;
            traceProgressText.textContent = `Tracing hops (${currentHop}/${maxHops})`;

            const isTarget = currentHop >= actualHops;
            const ip = isTarget ? host : `10.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}.${Math.floor(Math.random()*254)}`; // Simulate internal IPs
            const delay1 = Math.random() * 30 + 5; // 5-35ms
            const delay2 = Math.random() * 30 + 5;
            const delay3 = Math.random() * 30 + 5;
            const timeout = Math.random() < 0.1; // 10% chance of timeout

            let hopLine = `${currentHop.toString().padStart(2, ' ')}  `;
            if (timeout && !isTarget) {
                 hopLine += ` *        *        *       Request timed out.<br>`;
            } else {
                 hopLine += ` ${delay1.toFixed(0).padStart(3,' ')} ms  ${delay2.toFixed(0).padStart(3,' ')} ms  ${delay3.toFixed(0).padStart(3,' ')} ms  ${ip}<br>`;
            }

            traceResult.innerHTML += hopLine;
            traceResult.scrollTop = traceResult.scrollHeight;

            if (isTarget || currentHop >= maxHops) {
                // Test complete
                traceResult.innerHTML += `<br>Trace complete.`;
                startTraceBtn.disabled = false;
                startTestBtn.disabled = false;
                traceProgress.classList.add('hidden');
                traceTimeout = null;
            } else {
                // Schedule next hop
                traceTimeout = setTimeout(traceHop, 300 + Math.random() * 200); // Delay between hops
            }
        }

        traceTimeout = setTimeout(traceHop, 100); // Start after a short delay
         // --- End Simulation ---
    }


    // --- DNS Lookup Functionality ---
    function setDnsButtonState(enabled){
         dnsLookupBtn.disabled = !enabled;
         // Potentially disable main run button if DNS is active? Optional.
         // startTestBtn.disabled = !enabled;
    }

    function runDnsLookup() {
        const domain = dnsInput.value.trim() || hostInput.value.trim(); // Use specific DNS input first
        const type = dnsType.value;

        if (!domain) {
            showError('dns', 'Please enter a domain name');
            return;
        }
        stopAllTests();

        setDnsButtonState(false); // Disable button
        dnsResult.innerHTML = `Querying ${type} records for ${domain}...<br><br>`;
        dnsProgressFill.style.width = '0%';
        dnsProgressText.textContent = 'Looking up DNS records...';
        dnsProgress.classList.remove('hidden');

        // --- Simulation ---
        setTimeout(() => {
            dnsProgressFill.style.width = '50%';
            setTimeout(() => {
                dnsProgressFill.style.width = '100%';
                dnsProgressText.textContent = 'DNS lookup completed';
                dnsProgress.classList.add('hidden'); // Hide progress after completion

                let resultHTML = `<span style="color: var(--success);">DNS ${type} records for ${domain}:</span><br>`;
                const found = Math.random() > 0.1; // 90% chance of finding records

                if (found) {
                    switch (type) {
                        case 'A':
                            resultHTML += `Name: ${domain}<br>Address: 172.217.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}<br>`;
                            if (Math.random() > 0.5) resultHTML += `Name: ${domain}<br>Address: 142.250.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}<br>`;
                            break;
                        case 'AAAA':
                            resultHTML += `Name: ${domain}<br>IPv6 Address: 2607:f8b0:400${Math.floor(Math.random() * 9)}::${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}<br>`;
                            break;
                        case 'MX':
                            resultHTML += `Preference: 10 Mail Exchange: smtp.google.com<br>`; // Example
                            resultHTML += `Preference: 20 Mail Exchange: alt1.smtp.google.com<br>`;
                            break;
                        case 'NS':
                            resultHTML += `Nameserver: ns1.google.com<br>`;
                            resultHTML += `Nameserver: ns2.google.com<br>`;
                            break;
                        case 'TXT':
                            resultHTML += `Text: "v=spf1 include:_spf.google.com ~all"<br>`;
                            if (Math.random() > 0.5) resultHTML += `Text: "google-site-verification=ABC${Math.floor(Math.random()*1000)}"<br>`;
                            break;
                        case 'CNAME':
                             resultHTML += `Canonical name: www.${domain}.ghs.googlehosted.com<br>`; // Example
                             break;
                        default:
                             resultHTML += `No ${type} records found (simulation).<br>`;
                    }
                } else {
                     resultHTML += `No ${type} records found for ${domain}.<br>`;
                }

                dnsResult.innerHTML += resultHTML;
                setDnsButtonState(true); // Re-enable button

            }, 300 + Math.random() * 400);
        }, 200 + Math.random() * 300);
        // --- End Simulation ---
    }


    // --- Connectivity Check ---
    function checkConnectivity() {
         // --- Simulation ---
         setTimeout(() => {
             const quality = Math.random(); // 0-1 represents signal strength/quality
             let level = 0; // 0 = no connection (not simulated here), 1-5 bars
             let statusClass = 'danger';
             let label = 'Poor connection';

             if (quality > 0.8) { level = 5; statusClass = 'active'; label = 'Excellent connection'; }
             else if (quality > 0.6) { level = 4; statusClass = 'active'; label = 'Good connection'; }
             else if (quality > 0.4) { level = 3; statusClass = 'warning'; label = 'Fair connection'; }
             else if (quality > 0.15) { level = 2; statusClass = 'warning'; label = 'Poor connection'; }
             else { level = 1; statusClass = 'danger'; label = 'Very Poor connection'; }

             connectivityStatus.className = `status-indicator ${statusClass}`; // Update dot color
             connectivityLabel.textContent = label;
             updateConnectionBars(level); // Update bar display

             // Check again periodically
             setTimeout(checkConnectivity, 10000 + Math.random() * 10000); // Check every 10-20s
         }, 500 + Math.random() * 1000); // Initial delay
          // --- End Simulation ---
     }

     function updateConnectionBars(activeCount) {
         if (connectionBars) {
             connectionBars.dataset.level = activeCount; // Set data attribute for CSS styling
         }
     }


    // --- UI Utility Functions ---
    function updateUITabChange() {
        // Hide all progress bars when switching tabs
        [pingProgress, latencyProgress, traceProgress, dnsProgress].forEach(p => {
             if(p) p.classList.add('hidden');
         });
        // Reset button states if needed (stopAllTests usually handles this)
        setPingButtonsState(true);
        setLatencyButtonsState(false);
        startTraceBtn.disabled = false;
        setDnsButtonState(true);
    }

    function showError(tabId, message) {
        const resultArea = document.getElementById(`${tabId}Result`); // Assumes convention 'pingResult', 'latencyResult' etc.
        if (resultArea) {
             resultArea.innerHTML = `<span style="color: var(--danger);"><i class="bi bi-exclamation-triangle-fill"></i> Error: ${message}</span>`;
        } else {
             console.error(`Error display failed: Result area for tab '${tabId}' not found.`);
             alert(`Error in ${tabId.toUpperCase()} tab: ${message}`); // Fallback alert
        }
    }

    console.log("NOT-PING script loaded and initialized.");
}); // End DOMContentLoaded