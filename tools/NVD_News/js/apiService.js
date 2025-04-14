/**
 * API Service for Vulnews
 * Handles all API interactions with vulnerability data sources
 */

const apiService = {
    // Constants
    NVD_API_BASE_URL: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
    GITHUB_API_BASE_URL: 'https://api.github.com/advisories',
    RESULTS_PER_PAGE: 50,
    DAYS_BACK: 30,
    INITIAL_CHECK_DAYS: 2, // Initially check last 2 days for critical vulns
    MAX_CHECK_DAYS: 120,   // Maximum days to check back
    
    // Mock data for offline/CORS scenarios
    MOCK_NVD_DATA: [
        {
            id: "CVE-2025-1234",
            source: "NVD",
            severity: "CRITICAL",
            publishedDate: "2025-04-12T15:30:00Z",
            lastModifiedDate: "2025-04-13T08:45:00Z",
            description: "Critical vulnerability in Example Framework allows remote attackers to execute arbitrary code via a crafted HTTP request.",
            url: "https://nvd.nist.gov/vuln/detail/CVE-2025-1234",
            references: ["https://example.com/security/advisory-123", "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2025-1234"],
            cvssScore: 9.8,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
            cwe: ["CWE-78"]
        },
        {
            id: "CVE-2025-5678",
            source: "NVD",
            severity: "HIGH",
            publishedDate: "2025-04-10T12:00:00Z",
            lastModifiedDate: "2025-04-12T16:20:00Z",
            description: "Improper input validation in Popular Database System allows attackers to perform SQL injection attacks.",
            url: "https://nvd.nist.gov/vuln/detail/CVE-2025-5678",
            references: ["https://database-vendor.com/security/advisory-456"],
            cvssScore: 8.4,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
            cwe: ["CWE-89"]
        },
        {
            id: "CVE-2025-9101",
            source: "NVD",
            severity: "CRITICAL",
            publishedDate: "2025-04-13T11:15:00Z",
            lastModifiedDate: "2025-04-14T09:30:00Z",
            description: "Buffer overflow vulnerability in Network Protocol Library could allow remote code execution with elevated privileges.",
            url: "https://nvd.nist.gov/vuln/detail/CVE-2025-9101",
            references: ["https://security-research.org/disclosures/network-lib-vuln", "https://github.com/vendor/security-advisories/blob/main/2025-04.md"],
            cvssScore: 10.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            cwe: ["CWE-120", "CWE-122"]
        },
        {
            id: "CVE-2025-2468",
            source: "NVD",
            severity: "MEDIUM",
            publishedDate: "2025-04-08T14:50:00Z",
            lastModifiedDate: "2025-04-11T18:10:00Z",
            description: "Cross-Site Scripting (XSS) vulnerability in Popular CMS allows attackers to inject malicious scripts into web pages.",
            url: "https://nvd.nist.gov/vuln/detail/CVE-2025-2468",
            references: ["https://cms-project.org/security/xss-fix"],
            cvssScore: 6.1,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
            cwe: ["CWE-79"]
        },
        {
            id: "CVE-2025-3579",
            source: "NVD",
            severity: "LOW",
            publishedDate: "2025-04-09T09:45:00Z",
            lastModifiedDate: "2025-04-10T13:25:00Z",
            description: "Information disclosure vulnerability in Email Client reveals sender IP addresses in message headers.",
            url: "https://nvd.nist.gov/vuln/detail/CVE-2025-3579",
            references: ["https://email-vendor.com/security/advisory-789"],
            cvssScore: 3.5,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
            cwe: ["CWE-200"]
        }
    ],
    
    MOCK_GITHUB_DATA: [
        {
            id: "GHSA-h8f6-c5p9-g3q2",
            source: "GITHUB",
            severity: "CRITICAL",
            publishedDate: "2025-04-13T16:20:00Z",
            lastModifiedDate: "2025-04-14T10:15:00Z",
            description: "Critical authentication bypass vulnerability in popular-auth-library allows attackers to gain unauthorized access to protected resources.",
            url: "https://github.com/advisories/GHSA-h8f6-c5p9-g3q2",
            references: ["https://github.com/org/popular-auth-library/security/advisories/GHSA-h8f6-c5p9-g3q2"],
            affected: ["popular-auth-library@1.0.0-2.1.3"]
        },
        {
            id: "GHSA-j7v3-m9rf-q8h5",
            source: "GITHUB",
            severity: "HIGH",
            publishedDate: "2025-04-11T14:30:00Z",
            lastModifiedDate: "2025-04-12T09:40:00Z",
            description: "Path traversal vulnerability in static-file-server package allows attackers to access files outside the intended directory.",
            url: "https://github.com/advisories/GHSA-j7v3-m9rf-q8h5",
            references: ["https://github.com/org/static-file-server/security/advisories/GHSA-j7v3-m9rf-q8h5"],
            affected: ["static-file-server@3.0.0-3.2.1"]
        },
        {
            id: "GHSA-p4v6-c8m7-r2f3",
            source: "GITHUB",
            severity: "MEDIUM",
            publishedDate: "2025-04-12T11:05:00Z",
            lastModifiedDate: "2025-04-13T15:50:00Z",
            description: "Regular expression denial of service (ReDoS) in string-validator allows attackers to cause excessive CPU usage through crafted input strings.",
            url: "https://github.com/advisories/GHSA-p4v6-c8m7-r2f3",
            references: ["https://github.com/org/string-validator/security/advisories/GHSA-p4v6-c8m7-r2f3", "https://npmsecurity.org/advisories/2025-04-regex-dos"],
            affected: ["string-validator@2.4.0-2.8.2"]
        },
        {
            id: "GHSA-w9c2-r7p1-h3j8",
            source: "GITHUB",
            severity: "CRITICAL",
            publishedDate: "2025-04-14T08:10:00Z",
            lastModifiedDate: "2025-04-14T12:30:00Z",
            description: "Deserialization vulnerability in json-parser allows remote code execution when processing untrusted input.",
            url: "https://github.com/advisories/GHSA-w9c2-r7p1-h3j8",
            references: ["https://github.com/org/json-parser/security/advisories/GHSA-w9c2-r7p1-h3j8"],
            affected: ["json-parser@1.2.0-1.5.3"]
        }
    ],
    
    /**
     * Formats a date for the NVD API (YYYY-MM-DDTHH:mm:ss.SSSZ)
     * @param {Date} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDateForApi(date) {
        return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    },
    
    /**
     * Fetch vulnerabilities based on selected sources and severities
     * @param {Array} selectedSeverities - Array of severity levels to include
     * @param {Array} selectedSources - Array of data sources to query
     * @returns {Promise<Array>} - Promise resolving to combined normalized results
     */
    async fetchVulnerabilities(selectedSeverities, selectedSources) {
        const results = [];
        let errors = [];
        
        try {
            // Create an array of fetch promises based on selected sources
            const fetchPromises = [];
            
            if (selectedSources.includes('NVD')) {
                fetchPromises.push(this.fetchNVDData(selectedSeverities));
            }
            
            if (selectedSources.includes('GITHUB')) {
                fetchPromises.push(this.fetchGitHubData(selectedSeverities));
            }
            
            // Execute all fetch promises in parallel
            const responses = await Promise.allSettled(fetchPromises);
            
            // Process successful responses
            responses.forEach(response => {
                if (response.status === 'fulfilled' && response.value) {
                    if (response.value.data) {
                        results.push(...response.value.data);
                    } else {
                        results.push(...response.value);
                    }
                    
                    if (response.value.error) {
                        errors.push(response.value.error);
                    }
                } else if (response.status === 'rejected') {
                    errors.push(response.reason.message || 'Error fetching data');
                }
            });
            
            // Sort by published date (newest first)
            const sortedResults = results.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
            
            // If we have partial results but also errors, return both
            if (sortedResults.length > 0 && errors.length > 0) {
                return {
                    data: sortedResults,
                    error: `Partial data loaded. ${errors.join('. ')}`
                };
            }
            
            return sortedResults;
            
        } catch (error) {
            console.error('Error in fetchVulnerabilities:', error);
            
            // If we have any results despite the error, return them as partial data
            if (results.length > 0) {
                return {
                    data: results.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)),
                    error: `Partial data loaded. ${error.message}`
                };
            }
            
            // If everything failed, return mock data
            console.log('All data sources failed. Using mock data instead.');
            const mockResults = [];
            
            if (selectedSources.includes('NVD')) {
                const filteredMockNvd = this.MOCK_NVD_DATA.filter(item => 
                    !selectedSeverities || selectedSeverities.includes(item.severity));
                mockResults.push(...filteredMockNvd);
            }
            
            if (selectedSources.includes('GITHUB')) {
                const filteredMockGithub = this.MOCK_GITHUB_DATA.filter(item => 
                    !selectedSeverities || selectedSeverities.includes(item.severity));
                mockResults.push(...filteredMockGithub);
            }
            
            return {
                data: mockResults.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate)),
                error: `Using sample data due to API access errors: ${error.message}`
            };
        }
    },
    
    /**
     * Fetch vulnerability data from NVD API with adaptive date range
     * @param {Array} selectedSeverities - Severity levels to filter for
     * @returns {Promise<Array|Object>} - Promise resolving to normalized NVD data or partial data with error
     */
    async fetchNVDData(selectedSeverities) {
        let allResults = [];
        let partialFetchError = null;
        
        try {
            // Try with CORS proxy first if in a web context
            const useProxy = typeof window !== 'undefined';
            
            const targetResultCount = this.RESULTS_PER_PAGE;
            const endDate = new Date();
            
            // Start with checking just the last few days
            let daysToCheck = this.INITIAL_CHECK_DAYS;
            let consecutiveEmptyResponses = 0;
            
            // Continue expanding search until we have enough results or reach the maximum days back
            while (allResults.length < targetResultCount && daysToCheck <= this.MAX_CHECK_DAYS) {
                // Calculate start date based on current daysToCheck
                const startDate = new Date();
                startDate.setDate(endDate.getDate() - daysToCheck);
                
                // Format dates properly for the NVD API
                const formattedStartDate = this.formatDateForApi(startDate);
                const formattedEndDate = this.formatDateForApi(endDate);
                
                // Build severity parameter
                let severityParam = '';
                if (selectedSeverities && selectedSeverities.length > 0) {
                    // If only one severity, add it as a parameter
                    if (selectedSeverities.length === 1) {
                        severityParam = `&cvssV3Severity=${selectedSeverities[0]}`;
                    }
                    // If multiple severities, we'll filter after fetching
                }
                
                let apiUrl = `${this.NVD_API_BASE_URL}?pubStartDate=${encodeURIComponent(formattedStartDate)}&pubEndDate=${encodeURIComponent(formattedEndDate)}${severityParam}&resultsPerPage=${this.RESULTS_PER_PAGE}`;
                
                // Add API Key if available
                const headers = { 
                    'Accept': 'application/json'
                };
                
                const nvdApiKey = localStorage.getItem('nvd_api_key');
                if (nvdApiKey) {
                    headers['apiKey'] = nvdApiKey;
                }
                
                console.log(`Fetching NVD data from: ${apiUrl} (checking last ${daysToCheck} days)`);
                
                try {
                    // Execute fetch request with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                    
                    const response = await fetch(apiUrl, { 
                        headers,
                        signal: controller.signal,
                        mode: 'cors' // Explicitly request CORS
                    }).catch(error => {
                        clearTimeout(timeoutId);
                        throw error;
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        let errorMsg = `NVD API error: ${response.status} ${response.statusText}`;
                        
                        // Check for rate limiting or CORS issues
                        if (response.status === 403) {
                            errorMsg += "\nPossible rate limiting or CORS issue. Try using an NVD API Key.";
                            throw new Error(errorMsg);
                        }
                        
                        throw new Error(errorMsg);
                    }
                    
                    const data = await response.json();
                    
                    if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
                        console.log(`No vulnerabilities found in the NVD API response for the last ${daysToCheck} days`);
                        consecutiveEmptyResponses++;
                        
                        // If we've had multiple empty responses, we might be in a period with no vulnerabilities
                        // Increase the days to check more aggressively
                        if (consecutiveEmptyResponses >= 2) {
                            daysToCheck = Math.min(daysToCheck * 3, this.MAX_CHECK_DAYS);
                        } else {
                            daysToCheck = Math.min(daysToCheck * 2, this.MAX_CHECK_DAYS);
                        }
                        continue;
                    }
                    
                    consecutiveEmptyResponses = 0;
                    
                    // Filter by severity if we have multiple severities
                    let results = data.vulnerabilities;
                    if (selectedSeverities && selectedSeverities.length > 1) {
                        results = results.filter(item => {
                            const cvssV3 = item.cve.metrics?.cvssMetricV31?.[0] || 
                                        item.cve.metrics?.cvssMetricV30?.[0];
                            if (!cvssV3) return false;
                            return selectedSeverities.includes(cvssV3.cvssData.baseSeverity);
                        });
                    }
                    
                    // Process results and add to our collection
                    const normalizedResults = this.normalizeNVDData(data, selectedSeverities);
                    allResults = allResults.concat(normalizedResults);
                    
                    console.log(`Found ${normalizedResults.length} vulnerabilities in the last ${daysToCheck} days. Total: ${allResults.length}`);
                    
                    if (normalizedResults.length < this.RESULTS_PER_PAGE / 2) {
                        // If we got fewer than half the expected results, double the search window
                        daysToCheck = Math.min(daysToCheck * 2, this.MAX_CHECK_DAYS);
                    } else {
                        // Otherwise, increase more gradually
                        daysToCheck = Math.min(daysToCheck + 7, this.MAX_CHECK_DAYS);
                    }
                } catch (error) {
                    // Store error but continue if we have some data
                    partialFetchError = error;
                    
                    // Break the loop - we can't fetch more data
                    break;
                }
            }
            
            console.log(`Finished gathering vulnerabilities. Total found: ${allResults.length}`);
            
            // Return partial data with error
            if (partialFetchError && allResults.length > 0) {
                return {
                    data: allResults.slice(0, this.RESULTS_PER_PAGE),
                    error: partialFetchError.message
                };
            }
            
            // If we have no results due to API error, return mock data
            if (allResults.length === 0 && partialFetchError) {
                const mockData = this.MOCK_NVD_DATA.filter(item => 
                    !selectedSeverities || selectedSeverities.includes(item.severity));
                
                return {
                    data: mockData,
                    error: `Using sample data due to API access error: ${partialFetchError.message}`
                };
            }
            
            // Return the latest vulnerabilities (up to RESULTS_PER_PAGE)
            return allResults.slice(0, this.RESULTS_PER_PAGE);
            
        } catch (error) {
            console.error('Error fetching NVD data:', error);
            
            // If we have partial results, return them with the error
            if (allResults.length > 0) {
                return {
                    data: allResults.slice(0, this.RESULTS_PER_PAGE),
                    error: `Partial data loaded. ${error.message}`
                };
            }
            
            // Return mock data when all else fails
            const mockData = this.MOCK_NVD_DATA.filter(item => 
                !selectedSeverities || selectedSeverities.includes(item.severity));
            
            return {
                data: mockData,
                error: `Using sample data due to API access error: ${error.message}`
            };
        }
    },
    
    /**
     * Check if the data received is too old (oldest entry more than 1 year ago)
     * @param {Object} data - Raw data from NVD API
     * @returns {boolean} - True if data is too old
     */
    isDataTooOld(data) {
        if (!data.vulnerabilities || data.vulnerabilities.length === 0) return false;
        
        // Check the oldest entry in the returned data
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        // Sort by published date and check the oldest
        const sortedByDate = [...data.vulnerabilities].sort((a, b) => 
            new Date(a.cve.published) - new Date(b.cve.published)
        );
        
        const oldestDate = new Date(sortedByDate[0].cve.published);
        console.log(`Oldest vulnerability date: ${oldestDate.toISOString()}`);
        
        return oldestDate < oneYearAgo;
    },
    
    /**
     * Filter NVD data to include only vulnerabilities from the last 48 hours
     * @param {Object} data - Raw data from NVD API
     * @returns {Object} - Filtered data
     */
    filterLast48Hours(data) {
        if (!data || !data.vulnerabilities) return data;
        
        const now = new Date();
        const cutoff = new Date(now.getTime() - (48 * 60 * 60 * 1000)); // 48 hours ago
        
        // Create a copy of the response with filtered vulnerabilities
        const filteredData = {
            ...data,
            vulnerabilities: data.vulnerabilities.filter(item => {
                const publishDate = new Date(item.cve.published);
                return publishDate >= cutoff;
            })
        };
        
        return filteredData;
    },
    
    /**
     * Fetch vulnerability data from GitHub Advisories API
     * @param {Array} selectedSeverities - Severity levels to filter for
     * @returns {Promise<Array|Object>} - Promise resolving to normalized GitHub data or partial data with error
     */
    async fetchGitHubData(selectedSeverities) {
        try {
            // Prepare headers
            const headers = {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            };
            
            const githubToken = localStorage.getItem('github_api_key');
            if (githubToken) {
                headers['Authorization'] = `Bearer ${githubToken}`;
            }
            
            // Build URL with query parameters
            const url = `${this.GITHUB_API_BASE_URL}?per_page=100`;
            
            // Execute fetch request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const response = await fetch(url, { 
                    headers,
                    signal: controller.signal,
                    mode: 'cors' // Explicitly request CORS
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    if (response.status === 403) {
                        const rateLimitReset = response.headers.get('x-ratelimit-reset');
                        let message = 'GitHub API rate limit exceeded';
                        
                        if (rateLimitReset) {
                            const resetDate = new Date(parseInt(rateLimitReset) * 1000);
                            message += `. Resets at ${resetDate.toLocaleTimeString()}`;
                        }
                        
                        throw new Error(message);
                    }
                    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                return this.normalizeGitHubData(data, selectedSeverities);
            } catch (error) {
                // Return mock data if fetch failed
                const mockData = this.MOCK_GITHUB_DATA.filter(item => 
                    !selectedSeverities || selectedSeverities.includes(item.severity));
                
                return {
                    data: mockData,
                    error: `Using sample data due to API access error: ${error.message}`
                };
            }
            
        } catch (error) {
            console.error('Error fetching GitHub data:', error);
            
            // Return mock data
            const mockData = this.MOCK_GITHUB_DATA.filter(item => 
                !selectedSeverities || selectedSeverities.includes(item.severity));
            
            return {
                data: mockData,
                error: `Using sample data due to API access error: ${error.message}`
            };
        }
    },
    
    /**
     * Normalize NVD data to common format
     * @param {Object} data - Raw data from NVD API
     * @param {Array} selectedSeverities - Severity levels to filter for
     * @returns {Array} - Normalized vulnerability data
     */
    normalizeNVDData(data, selectedSeverities = null) {
        if (!data || !data.vulnerabilities) return [];
        
        return data.vulnerabilities
            .map(item => {
                const cve = item.cve;
                const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0];
                
                let severity = 'UNKNOWN';
                if (metrics) {
                    severity = metrics.cvssData.baseSeverity || 
                               (metrics.cvssData.baseScore >= 9 ? 'CRITICAL' :
                                metrics.cvssData.baseScore >= 7 ? 'HIGH' :
                                metrics.cvssData.baseScore >= 4 ? 'MEDIUM' : 'LOW');
                }
                
                return {
                    id: cve.id,
                    source: 'NVD',
                    severity: severity.toUpperCase(),
                    publishedDate: cve.published,
                    lastModifiedDate: cve.lastModified,
                    description: cve.descriptions.find(d => d.lang === 'en')?.value || 'No description available',
                    url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
                    references: cve.references?.map(ref => ref.url) || [],
                    // Additional metrics for detailed view
                    cvssScore: metrics?.cvssData?.baseScore,
                    cvssVector: metrics?.cvssData?.vectorString,
                    cwe: cve.weaknesses?.map(w => w.description.find(d => d.lang === 'en')?.value) || []
                };
            })
            .filter(item => !selectedSeverities || selectedSeverities.includes(item.severity));
    },
    
    /**
     * Normalize GitHub data to common format
     * @param {Object} data - Raw data from GitHub API
     * @param {Array} selectedSeverities - Severity levels to filter for
     * @returns {Array} - Normalized vulnerability data
     */
    normalizeGitHubData(data, selectedSeverities = null) {
        if (!Array.isArray(data)) return [];
        
        return data
            .map(item => {
                let severity = 'UNKNOWN';
                if (item.severity) {
                    severity = item.severity.toUpperCase();
                } else if (item.cvss?.score) {
                    severity = item.cvss.score >= 9 ? 'CRITICAL' :
                               item.cvss.score >= 7 ? 'HIGH' :
                               item.cvss.score >= 4 ? 'MEDIUM' : 'LOW';
                }
                
                return {
                    id: item.ghsa_id || item.cve_id || `GHSA-${Math.random().toString(36).substring(2, 10)}`,
                    source: 'GITHUB',
                    severity: severity,
                    publishedDate: item.published_at,
                    lastModifiedDate: item.updated_at,
                    description: item.summary || 'No description available',
                    url: item.html_url,
                    references: item.references || [],
                    // GitHub-specific fields
                    affected: item.affected_packages,
                    cwes: item.cwe_ids
                };
            })
            .filter(item => !selectedSeverities || selectedSeverities.includes(item.severity));
    }
};