// Quick-Hub/tools/BOMStorm/scripts.js

// --- Configuration ---
const SUPPORTED_NAMESPACES = [
    'http://cyclonedx.org/schema/bom/1.4',
    'http://cyclonedx.org/schema/bom/1.5',
    'http://cyclonedx.org/schema/bom/1.6'
];
const MISSING_VERSION_PLACEHOLDER = "<version_missing>";

// --- Cytoscape Style Definitions ---
// Using hardcoded dark theme values matching Quick-Hub for reliability in iframe
const cytoscapeDarkStyle = [
    {
        selector: 'node',
        style: {
            'background-color': '#2d2d2d', // --input-bg
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#e0e0e0', // --text-color
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'padding': '5px',
            'shape': 'round-rectangle',
            'border-width': 1,
            'border-color': '#333' // --border-color
        },
    },
    {   // Style for expandable nodes
        selector: 'node.expandable[hasChildren]',
        style: {
            'border-width': 2,
            'border-color': '#4361ee', // --primary
            'font-weight': 'bold',
        }
    },
    {
        selector: 'edge',
        style: {
            'width': 1.5,
            'line-color': '#333', // --border-color
            'target-arrow-color': '#333', // --border-color
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8
        }
    },
    {   // Highlighted nodes
        selector: '.highlighted',
        style: {
            'border-color': '#f8961e', // --warning
            'border-width': 3,
            'background-color': 'rgba(248, 150, 30, 0.3)', // --warning with alpha
            'color': '#e0e0e0', // --text-color
            'font-weight': 'bold',
            'z-index': 10,
            'opacity': 1 // Ensure highlighted are fully opaque
        }
    },
     {   // Nodes with duplicate versions
        selector: 'node.duplicateVersion',
        style: {
            'border-color': '#f72585', // --danger
            'border-width': 3,
            'border-style': 'dashed',
        }
    },
    {   // Dimmed elements
        selector: '.dimmed',
        style: {
            'opacity': 0.25 // Make dimmed elements less prominent
        }
    }
];
// --- End Cytoscape Style Definitions ---


// --- DOM Elements ---
const fileInput = document.getElementById('sbomFile');
const analyzeButton = document.getElementById('analyzeButton');
const loadingIndicator = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultsDiv = document.getElementById('results');
// Summary elements
const totalProcessedValueEl = document.getElementById('totalProcessedValue');
const totalUniqueNamesValueEl = document.getElementById('totalUniqueNamesValue');
const totalUniqueNameVersionValueEl = document.getElementById('totalUniqueNameVersionValue');
const totalDuplicateNamesValueEl = document.getElementById('totalDuplicateNamesValue');
// Info elements
const infoFileName = document.getElementById('infoFileName');
const infoFileSize = document.getElementById('infoFileSize');
const infoBomVersion = document.getElementById('infoBomVersion');
const infoPrimaryComponent = document.getElementById('infoPrimaryComponent');
// Duplicate/Unique elements
const duplicatesText = document.getElementById('duplicatesText');
const uniqueComponentsText = document.getElementById('uniqueComponentsText');
// Graph elements
const dependencyGraphTabPane = document.getElementById('dependencyGraphTab'); // Container tab pane
const cyContainer = document.getElementById('cy'); // Cytoscape container div
const noDependenciesMessageGraph = document.getElementById('noDependenciesMessageGraph');
const graphSearchInput = document.getElementById('graphSearchInput');
const refreshGraphButton = document.getElementById('refreshGraphButton');
// Download button
const downloadButton = document.getElementById('downloadButton');
// Tab Elements
const tabButtons = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
// --- End DOM Elements ---

let analysisResultsStore = null; // Store analysis results for download
let cyInstance = null; // To hold the Cytoscape instance

// --- Core Functions ---

function displayError(message) {
    console.error("Displaying Error:", message);
    if (errorDiv) {
        errorDiv.textContent = `ERROR: ${message}`;
        errorDiv.classList.remove('hidden');
    }
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (downloadButton) downloadButton.classList.add('hidden');
    hideLoading();
    if (analyzeButton) analyzeButton.disabled = false;
}

function showLoading() {
    console.info("Showing loading indicator...");
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (errorDiv) errorDiv.classList.add('hidden');
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (downloadButton) downloadButton.classList.add('hidden');
    if (analyzeButton) analyzeButton.disabled = true;

    if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
    if (cyContainer) cyContainer.innerHTML = '';
    if (graphSearchInput) graphSearchInput.value = '';
}

function hideLoading() {
    console.info("Hiding loading indicator...");
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    if (analyzeButton) analyzeButton.disabled = false;
}


/** Recursively parses <dependency> elements using the detected namespace. */
function parseDependenciesRecursive(element, dependencyMap, namespace) {
    const parentRef = element.getAttribute('ref');
    if (!parentRef) return;

    const childDeps = Array.from(element.children).filter(el => el.namespaceURI === namespace && el.localName === 'dependency');

    if (!dependencyMap.has(parentRef)) {
         dependencyMap.set(parentRef, []);
    }

    for (const childElement of childDeps) {
        const childRef = childElement.getAttribute('ref');
        if (childRef) {
            const parentChildren = dependencyMap.get(parentRef);
            if (!parentChildren.includes(childRef)) {
                 parentChildren.push(childRef);
            }
            parseDependenciesRecursive(childElement, dependencyMap, namespace);
        }
    }
}

/** Detects the CycloneDX namespace used in the document. */
function detectNamespace(xmlDoc) {
     if (!xmlDoc || !xmlDoc.documentElement) {
         console.warn("XML document or root element not found for namespace detection.");
         return null;
     }
     const rootNamespace = xmlDoc.documentElement.namespaceURI;

     if (SUPPORTED_NAMESPACES.includes(rootNamespace)) {
         console.info(`Detected namespace from root element: ${rootNamespace}`);
         return rootNamespace;
     }

     console.warn(`Root element namespace "${rootNamespace}" not in supported list. Checking component tags...`);
     for (const ns of SUPPORTED_NAMESPACES) {
         const components = xmlDoc.getElementsByTagNameNS(ns, 'component');
         if (components.length > 0) {
             console.info(`Detected namespace from first component tag: ${ns}`);
             return ns;
         }
     }

     console.warn("Could not detect a supported CycloneDX namespace. Analysis might fail or be incomplete.");
     return null;
}

/** Main analysis logic */
function analyzeSBOM(xmlString) {
    console.info("Starting SBOM analysis...");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
        console.error("XML Parsing Error:", parserError.textContent);
        throw new Error(`Failed to parse XML. Error details: ${parserError.textContent.substring(0, 200)}...`);
    }

    const detectedNamespace = detectNamespace(xmlDoc);
    if (!detectedNamespace) {
         throw new Error("Could not find a supported CycloneDX namespace (e.g., 1.4, 1.5, 1.6) in the SBOM.");
    }

    console.info(`Searching for components using namespace: ${detectedNamespace}`);
    const components = xmlDoc.getElementsByTagNameNS(detectedNamespace, 'component');
    const totalComponentsProcessed = components.length;
    console.info(`Found ${totalComponentsProcessed} <component> elements.`);

    const nameToVersionsMap = new Map();
    const allComponentPairs = [];
    const uniqueNamesFound = new Set();
    const bomRefMap = new Map();

    for (const component of components) {
        const bomRef = component.getAttribute('bom-ref');
        const nameElement = component.getElementsByTagNameNS(detectedNamespace, 'name')[0];
        const versionElement = component.getElementsByTagNameNS(detectedNamespace, 'version')[0];
        const name = nameElement?.textContent?.trim() || null;
        let version = versionElement?.textContent?.trim();
        if (version === null || version === undefined || version === "") {
            version = MISSING_VERSION_PLACEHOLDER;
        }

        if (bomRef) {
            bomRefMap.set(bomRef, { name: name || bomRef, version: version });
        } else {
             console.warn("Component found without a 'bom-ref' attribute:", component.outerHTML.substring(0,100)+"...");
        }

        if (name) {
            uniqueNamesFound.add(name);
            if (!nameToVersionsMap.has(name)) {
                nameToVersionsMap.set(name, []);
            }
            nameToVersionsMap.get(name).push(version);
            allComponentPairs.push([name, version]);
        } else if (!bomRef) {
             console.warn(`Component missing both 'bom-ref' and 'name'. Cannot process fully:`, component.outerHTML.substring(0,100)+"...");
        }
    }

    const duplicateNameDetails = new Map();
    for (const [name, versionsList] of nameToVersionsMap.entries()) {
        const uniqueVersionsInList = new Set(versionsList);
        if (uniqueVersionsInList.size > 1) {
             const versionCounts = new Map();
             for (const version of versionsList) {
                versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
             }
            duplicateNameDetails.set(name, { total: versionsList.length, versions: versionCounts });
        }
    }
    const uniqueNameVersionSet = new Set(allComponentPairs.map(pair => `${pair[0]}|${pair[1]}`));
    const sortedUniqueComponents = Array.from(uniqueNameVersionSet)
        .map(uniqueString => {
            const parts = uniqueString.split('|');
            return [parts[0], parts[1]];
        })
        .sort((a, b) => {
            const nameA = a[0].toLowerCase();
            const nameB = b[0].toLowerCase();
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            const versionA = a[1] === MISSING_VERSION_PLACEHOLDER ? '' : a[1].toLowerCase();
            const versionB = b[1] === MISSING_VERSION_PLACEHOLDER ? '' : b[1].toLowerCase();
            return versionA.localeCompare(versionB);
         });

    const totalUniqueNames = uniqueNamesFound.size;
    const totalUniqueNameVersion = sortedUniqueComponents.length;

    // Parse Dependencies
    const dependenciesElement = xmlDoc.getElementsByTagNameNS(detectedNamespace, 'dependencies')[0];
    let dependencyMap = new Map();
    let dependencyRoots = new Set();

    if (dependenciesElement) {
        console.info("Found <dependencies> section. Parsing dependencies map...");
        const directDependencies = Array.from(dependenciesElement.children)
                                     .filter(el => el.namespaceURI === detectedNamespace && el.localName === 'dependency');

        const allParentRefs = new Set();
        const allChildRefs = new Set();
        directDependencies.forEach(depElement => {
             parseDependenciesRecursive(depElement, dependencyMap, detectedNamespace);
        });
        dependencyMap.forEach((children, parent) => {
            allParentRefs.add(parent);
            children.forEach(child => allChildRefs.add(child));
        });
         dependencyRoots = new Set([...allParentRefs].filter(ref => !allChildRefs.has(ref)));

        console.info(`Parsed ${dependencyMap.size} components listed as parents in the dependency map.`);
        console.info(`Identified ${dependencyRoots.size} root component(s) in dependencies.`);
    } else {
        console.info("No <dependencies> section found in SBOM.");
    }

    console.info(`Processed ${totalComponentsProcessed} <component> elements.`);
    console.info(`Found ${totalUniqueNames} unique component names.`);
    console.info(`Found ${totalUniqueNameVersion} unique name/version combinations.`);
    console.info(`Found ${duplicateNameDetails.size} names with multiple versions.`);
    console.info("Analysis finished successfully.");

    const fileInfo = fileInput.files.length > 0 ? { name: fileInput.files[0].name, size: fileInput.files[0].size } : { name: "unknown.xml", size: null };
    let bomFormatVersion = "-";
    if (xmlDoc.documentElement) {
        const bomFormat = xmlDoc.documentElement.namespaceURI;
        const bomVersionAttr = xmlDoc.documentElement.getAttribute('version');
        bomFormatVersion = `${bomFormat ? bomFormat.split('/').pop() : 'CycloneDX'}${bomVersionAttr ? ` / v${bomVersionAttr}` : ''}`;
     }
    let primaryComponentName = "-";
    const metadataComponent = xmlDoc.getElementsByTagNameNS(detectedNamespace, 'metadata')[0]?.getElementsByTagNameNS(detectedNamespace, 'component')[0];
    if(metadataComponent) {
        const nameEl = metadataComponent.getElementsByTagNameNS(detectedNamespace, 'name')[0];
        const versionEl = metadataComponent.getElementsByTagNameNS(detectedNamespace, 'version')[0];
        const metaName = nameEl?.textContent || '?';
        const metaVersion = versionEl?.textContent;
        primaryComponentName = `${metaName}${metaVersion ? ` (v${metaVersion})` : ''}`;
     }

    return {
        duplicateDetails: duplicateNameDetails,
        uniqueComponentsList: sortedUniqueComponents,
        totalProcessed: totalComponentsProcessed,
        totalUniqueNames: totalUniqueNames,
        totalUniqueNameVersion: totalUniqueNameVersion,
        inputFileName: fileInfo.name,
        inputFileSize: fileInfo.size,
        bomFormatVersion: bomFormatVersion,
        primaryComponentName: primaryComponentName,
        bomRefMap: bomRefMap,
        dependencyMap: dependencyMap,
        dependencyRoots: Array.from(dependencyRoots)
    };
}

// --- Graph Helper Functions ---

/** Creates a Cytoscape node object for a given ref. */
function createNodeObject(ref) {
    if (!analysisResultsStore || !analysisResultsStore.bomRefMap || !analysisResultsStore.dependencyMap || !analysisResultsStore.duplicateDetails) {
        console.error("Cannot create node object: analysisResultsStore not ready.");
        return null;
    }
    const { bomRefMap, dependencyMap, duplicateDetails } = analysisResultsStore;
    const namesWithDuplicates = new Set(duplicateDetails.keys());

    if (!bomRefMap.has(ref)) {
         console.warn(`Ref '${ref}' not found in bomRefMap. Cannot create node object.`);
         return null;
    }

    const componentInfo = bomRefMap.get(ref);
    const name = componentInfo.name;
    const version = componentInfo.version;
    const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<missing>" : version;
    const label = `${name}\n(${versionDisplay})`;

    const childrenInMap = dependencyMap.get(ref) || [];
    const hasChildren = childrenInMap.length > 0;
    const isDuplicateVersion = componentInfo.name && namesWithDuplicates.has(componentInfo.name);

    let nodeClasses = [];
    if (hasChildren) nodeClasses.push('expandable');
    if (isDuplicateVersion) nodeClasses.push('duplicateVersion');

    return {
        group: 'nodes',
        data: { id: ref, label: label, name: name, version: version,
                children: childrenInMap, hasChildren: hasChildren, isExpanded: false },
        classes: nodeClasses.join(' ')
    };
}


/** Finds a path from a root node to a target node ref using BFS. */
function findPathToNode(targetRef, roots, dependencyMap) {
    if (!roots || roots.length === 0 || !dependencyMap) return null;
    if (roots.includes(targetRef)) return [targetRef];

    const queue = roots.map(root => ({ ref: root, path: [root] }));
    const visited = new Set(roots);

    while (queue.length > 0) {
        const { ref: currentRef, path: currentPath } = queue.shift();

        const children = dependencyMap.get(currentRef) || [];
        for (const childRef of children) {
            if (childRef === targetRef) {
                return [...currentPath, childRef];
            }
            if (!visited.has(childRef)) {
                visited.add(childRef);
                queue.push({ ref: childRef, path: [...currentPath, childRef] });
            }
        }
    }
    console.warn(`No path found from roots to targetRef: ${targetRef}`);
    return null;
}

/**
 * Adds nodes and edges along a given path to the Cytoscape instance if they don't exist.
 * Modified to add edge between previous and current node.
 * @param {string[]} path - Array of node refs representing the path.
 * @param {cytoscape.Core} cy - The Cytoscape instance.
 * @returns {cytoscape.Collection} A collection of the nodes along the path (existing or newly added).
 */
function addNodesAndEdgesAlongPath(path, cy) { // Removed bomRefMap param, not needed with new logic
    let pathNodesCollection = cy.collection(); // Use a more descriptive name
    if (!path || path.length === 0 || !cy ) {
        console.error("Invalid arguments for addNodesAndEdgesAlongPath");
        return pathNodesCollection;
    };

    for (let i = 0; i < path.length; i++) {
        const nodeRef = path[i];
        let node = cy.$id(nodeRef);

        // Add node if it doesn't exist
        if (node.empty()) {
            const nodeObject = createNodeObject(nodeRef); // Use helper
            if (nodeObject) {
                // Expand intermediate nodes visually
                if (i < path.length - 1 && nodeObject.data.hasChildren) {
                     nodeObject.data.isExpanded = true;
                }
                 const added = cy.add(nodeObject);
                 node = added;
                 // Remove or comment out noisy log:
                 // console.log(`Added missing node for search reveal: ${nodeRef}`);
            } else {
                console.error(`Failed to add node ${nodeRef} along path - data missing.`);
                continue;
            }
        } else if (i < path.length - 1 && node.data('hasChildren') && !node.data('isExpanded')) {
             // Expand existing intermediate node
             node.data('isExpanded', true);
        }

        pathNodesCollection = pathNodesCollection.union(node);

        // ******** EDGE ADDITION LOGIC CHANGE ********
        // Add edge FROM the PREVIOUS node TO the CURRENT node (if i > 0)
        if (i > 0) {
            const prevNodeRef = path[i - 1];
            const edgeId = `edge-${prevNodeRef}-${nodeRef}`;

            // Add edge only if it doesn't already exist
            // Both prevNode (added in i-1) and node (added in i) MUST exist now.
            if (cy.$id(edgeId).empty()) {
                cy.add({ group: 'edges', data: { id: edgeId, source: prevNodeRef, target: nodeRef } });
                // Remove or comment out noisy log:
                // console.log(`Added missing edge for search reveal: ${edgeId}`);
            }
        }
        // ******** END EDGE ADDITION LOGIC CHANGE ********
    }
    return pathNodesCollection;
}


/** Recursively collapses nodes starting from a given node if they become orphans. */
function collapseNodeIfOrphan(node, cy, nodesToKeep = new Set()) {
    if (!node || node.empty() || !cy) return;
    if (nodesToKeep.has(node.id())) return;

    // Check if the node has any incoming edges *currently in the graph*
    if (node.indegree(true) === 0) {
        console.log(`Collapsing orphan node: ${node.id()}`);
        const outgoingEdges = node.connectedEdges(`edge[source = "${node.id()}"]`);
        const childrenNodes = outgoingEdges.targets();

        node.data('isExpanded', false);
        cy.remove(node); // Removing node removes connected edges automatically

        // Recursively check its children
        childrenNodes.forEach(child => collapseNodeIfOrphan(child, cy, nodesToKeep));
    } else {
         // Node is not an orphan, but ensure it's marked collapsed visually
         node.data('isExpanded', false);
    }
}


/** Creates the INITIAL elements array (roots + first level children) */
function createCytoscapeElements(bomRefMap, dependencyMap, dependencyRoots, duplicateDetails) {
    // This function remains exactly the same as the previous version
    const elements = [];
    const nodeRefs = new Set();
    const edgeSet = new Set();
    const namesWithDuplicates = new Set(duplicateDetails.keys());

    const createNodeObjectLocal = (ref) => {
        if (!bomRefMap.has(ref)) return null;
        const componentInfo = bomRefMap.get(ref);
        const name = componentInfo.name;
        const version = componentInfo.version;
        const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<missing>" : version;
        const label = `${name}\n(${versionDisplay})`;
        const childrenInMap = dependencyMap.get(ref) || [];
        const hasChildren = childrenInMap.length > 0;
        const isDuplicateVersion = componentInfo.name && namesWithDuplicates.has(componentInfo.name);
        let nodeClasses = [];
        if (hasChildren) nodeClasses.push('expandable');
        if (isDuplicateVersion) nodeClasses.push('duplicateVersion');
        return {
            group: 'nodes',
            data: { id: ref, label: label, name: name, version: version,
                    children: childrenInMap, hasChildren: hasChildren, isExpanded: false },
            classes: nodeClasses.join(' ')
        };
    };

    dependencyRoots.forEach(rootRef => {
        if (!nodeRefs.has(rootRef)) {
            const nodeObject = createNodeObjectLocal(rootRef);
            if (nodeObject) { elements.push(nodeObject); nodeRefs.add(rootRef); }
            else { console.warn(`Root ref '${rootRef}' could not be added.`); }
        }
    });

    dependencyRoots.forEach(rootRef => {
        if (!nodeRefs.has(rootRef)) return;
        const childrenRefs = dependencyMap.get(rootRef) || [];
        childrenRefs.forEach(childRef => {
            if (!nodeRefs.has(childRef)) {
                 const nodeObject = createNodeObjectLocal(childRef);
                 if (nodeObject) { elements.push(nodeObject); nodeRefs.add(childRef); }
                 else { console.warn(`Child ref '${childRef}' from root '${rootRef}' could not be added.`); }
            }
            const edgeId = `edge-${rootRef}-${childRef}`;
            if (nodeRefs.has(rootRef) && nodeRefs.has(childRef) && !edgeSet.has(edgeId)) {
                 elements.push({ group: 'edges', data: { id: edgeId, source: rootRef, target: childRef } });
                 edgeSet.add(edgeId);
            }
        });
    });

    console.info(`Created initial graph with ${nodeRefs.size} nodes and ${edgeSet.size} edges (Roots + First Level).`);
    if (elements.length === 0 && (dependencyMap.size > 0 || dependencyRoots.length > 0)) {
         console.warn("Dependency info found, but no graph elements generated.");
    }
    return elements;
}


// --- Debounce Utility ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/** Displays the analysis results in the UI */
function displayResults(results) {
     if (!totalProcessedValueEl || !duplicatesText || !cyContainer || !resultsDiv || !downloadButton || !infoFileName) {
         console.error("Cannot display results: Critical UI elements missing.");
         if(resultsDiv) resultsDiv.innerHTML = '<p style="color: red;">Internal Error: Could not display results. UI elements are missing.</p>';
         hideLoading();
         return;
     }

    // Populate Info/Summary/Duplicates/Unique tabs (same as before)
    infoFileName.textContent = results.inputFileName || '-';
    infoFileSize.textContent = results.inputFileSize ? `${(results.inputFileSize / 1024).toFixed(2)} KB` : '-';
    infoBomVersion.textContent = results.bomFormatVersion || '-';
    infoPrimaryComponent.textContent = results.primaryComponentName || '-';
    totalProcessedValueEl.textContent = results.totalProcessed;
    totalUniqueNamesValueEl.textContent = results.totalUniqueNames;
    totalUniqueNameVersionValueEl.textContent = results.totalUniqueNameVersion;
    totalDuplicateNamesValueEl.textContent = results.duplicateDetails.size;
    let dupText = "";
    if (results.duplicateDetails.size > 0) {
        const sortedDupNames = Array.from(results.duplicateDetails.keys()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        for (const name of sortedDupNames) {
            const details = results.duplicateDetails.get(name);
            dupText += `▶ ${name} (Total Instances: ${details.total})\n`;
            const sortedVersions = Array.from(details.versions.entries()).sort((a, b) => {
                const vA = a[0] === MISSING_VERSION_PLACEHOLDER ? '' : a[0].toLowerCase();
                const vB = b[0] === MISSING_VERSION_PLACEHOLDER ? '' : b[0].toLowerCase();
                return vA.localeCompare(vB);
            });
            for (const [version, count] of sortedVersions) {
                const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<not specified>" : version;
                dupText += `    - Version: ${versionDisplay}${count > 1 ? ` [x${count}]` : ''}\n`;
            }
            dupText += "\n";
        }
        duplicatesText.textContent = dupText.trimEnd();
    } else { duplicatesText.textContent = results.totalProcessed > 0 ? "No component names found with multiple different versions." : "No components processed."; }
    let uniqueText = "";
    if (results.uniqueComponentsList.length > 0) {
        results.uniqueComponentsList.forEach(([name, version]) => {
            const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<not specified>" : version;
            uniqueText += `- ${name} (Version: ${versionDisplay})\n`;
        });
        uniqueComponentsText.textContent = uniqueText.trimEnd();
    } else { uniqueComponentsText.textContent = results.totalProcessed > 0 ? "No unique name/version combinations extracted." : "No components found/processed."; }


    // --- Dependency Graph Handling ---
    if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
    cyContainer.innerHTML = '';

    if (results.dependencyMap && (results.dependencyMap.size > 0 || results.dependencyRoots.length > 0)) {
        noDependenciesMessageGraph.style.display = 'none';

        const cyElements = createCytoscapeElements(
            results.bomRefMap, results.dependencyMap, results.dependencyRoots, results.duplicateDetails
        );

        if (cyElements.length > 0) {
            try {
                const currentCyStyle = cytoscapeDarkStyle;
                console.log(`Applying Dark mode style to Cytoscape graph.`);

                cyInstance = cytoscape({
                    container: cyContainer, elements: cyElements, style: currentCyStyle,
                    layout: { name: 'dagre', rankDir: 'TB', spacingFactor: 1.3, padding: 30, nodeDimensionsIncludeLabels: true },
                    minZoom: 0.1, maxZoom: 3, zoomingEnabled: true, userZoomingEnabled: true,
                    panningEnabled: true, userPanningEnabled: true, boxSelectionEnabled: false,
                });

                // --- Cytoscape Event Handlers ---
                cyInstance.on('tap', 'node.expandable[hasChildren]', function(evt) {
                    const tappedNode = evt.target;
                    const nodeId = tappedNode.id();
                    const isExpanded = tappedNode.data('isExpanded');

                    if (!analysisResultsStore) { console.error("analysisResultsStore missing."); return; }
                    if (tappedNode.data('hasChildren') !== true) { console.warn(`Node '${nodeId}' tapped, but !hasChildren.`); return; }

                    const childrenRefs = tappedNode.data('children') || [];

                    if (childrenRefs.length > 0 || isExpanded) {
                        console.log(`${isExpanded ? 'Collapsing' : 'Expanding'} dependencies for: ${nodeId}`);
                        cyInstance.batch(() => {
                            if (isExpanded) {
                                // --- !! REFINED Collapse !! ---
                                console.log(`Starting collapse for ${nodeId}`);
                                const directChildrenNodes = tappedNode.outgoers('node');
                                tappedNode.outgoers('edge').remove();
                                directChildrenNodes.forEach(child => collapseNodeIfOrphan(child, cyInstance));
                                tappedNode.data('isExpanded', false);
                                console.log(`Finished collapse for ${nodeId}`);
                            } else {
                                // --- Expand ---
                                let addedElements = false;
                                childrenRefs.forEach(childRef => {
                                    if (cyInstance.$id(childRef).empty()) {
                                        const nodeObject = createNodeObject(childRef);
                                        if (nodeObject) { cyInstance.add(nodeObject); addedElements = true; }
                                        else { console.warn(`Cannot expand: Child ref '${childRef}' from '${nodeId}' not in bomRefMap.`); }
                                    }
                                    const edgeId = `edge-${nodeId}-${childRef}`;
                                     if (cyInstance.$id(edgeId).empty() && cyInstance.$id(childRef).nonempty()) {
                                        cyInstance.add({ group: 'edges', data: { id: edgeId, source: nodeId, target: childRef } });
                                        addedElements = true;
                                     }
                                });
                                tappedNode.data('isExpanded', true);
                                if (addedElements) {
                                     cyInstance.layout({ name: 'dagre', rankDir: 'TB', spacingFactor: 1.3, padding: 30,
                                         nodeDimensionsIncludeLabels: true, animate: true, animationDuration: 400, fit: false }).run();
                                }
                            }
                        }); // End batch
                    } else {
                        console.warn(`Node '${nodeId}' has expandable class/data but no children listed.`);
                        tappedNode.data('hasChildren', false);
                        tappedNode.removeClass('expandable');
                    }
                }); // --- End Node Tap ---

                cyInstance.ready(() => { cyInstance.fit(30); });

            } catch (graphError) {
                console.error("Cytoscape rendering failed:", graphError);
                displayError("Failed to render dependency graph. See console.");
                cyContainer.innerHTML = '<p style="color: red;">Graph rendering error.</p>';
                if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
            }
        } else {
            console.warn("Dependency map found, but no elements generated for Cytoscape.");
            noDependenciesMessageGraph.textContent = "Dependencies found, but component references might be missing.";
            noDependenciesMessageGraph.style.display = 'block';
            cyContainer.innerHTML = '';
        }
    } else {
        noDependenciesMessageGraph.textContent = "No <dependencies> section found in the SBOM.";
        noDependenciesMessageGraph.style.display = 'block';
        cyContainer.innerHTML = '';
    }

    resultsDiv.style.display = 'block';
    const showDownload = results.totalProcessed > 0 || (results.dependencyMap && results.dependencyMap.size > 0);
    downloadButton.classList.toggle('hidden', !showDownload);

    switchTab('infoTab');
}


// --- Tab Switching Logic ---
function switchTab(targetTabId) {
    tabButtons.forEach(button => button.classList.remove('active'));
    tabContents.forEach(pane => pane.classList.remove('active'));

    const targetPane = document.getElementById(targetTabId);
    if (targetPane) {
        targetPane.classList.add('active');
    } else {
        console.warn(`Tab pane '${targetTabId}' not found.`);
        document.querySelector('.tab-content')?.classList.add('active');
        document.querySelector('.tab')?.classList.add('active');
        return;
    }

    const targetHeader = document.querySelector(`.tab[data-tab="${targetTabId}"]`);
    if (targetHeader) {
        targetHeader.classList.add('active');
    } else {
         console.warn(`Tab header for '${targetTabId}' not found.`);
    }

     if (targetTabId === 'dependencyGraphTab' && cyInstance) {
        setTimeout(() => {
            if(cyInstance && cyInstance.container()) {
                cyInstance.resize();
                cyInstance.fit(30);
            }
        }, 50);
     }
}


// --- Event Handler for Analyze Button ---
async function handleAnalyzeClick() {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        displayError("Please select an SBOM XML file first.");
        return;
    }
    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.xml') && !file.type?.includes('xml')) {
         displayError("Please select a valid XML file (.xml).");
         fileInput.value = '';
         return;
    }

    showLoading();
    analysisResultsStore = null;

    const reader = new FileReader();
    reader.onload = function(event) {
        const xmlString = event.target.result;
        try {
            analysisResultsStore = analyzeSBOM(xmlString);
            displayResults(analysisResultsStore);
        } catch (error) {
            console.error("Analysis failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error during analysis.";
            displayError(errorMessage);
            analysisResultsStore = null;
        } finally {
            hideLoading();
        }
    };
    reader.onerror = function(event) {
        console.error("File reading error:", reader.error);
        displayError(`Failed to read file: ${reader.error?.name || 'Unknown Error'}`);
        hideLoading();
        analysisResultsStore = null;
    };
    reader.readAsText(file);
}

// --- Event Handler for Download Button ---
function handleDownload() {
    if (!analysisResultsStore) {
        alert("No analysis results available to download.");
        return;
    }
    // ... (Generate download content - same as before) ...
     let downloadContent = `SBOM Analysis Report\n`;
     downloadContent += `File: ${analysisResultsStore.inputFileName}\n`;
     downloadContent += `=========================\n\n`;
     // Info & Summary
     downloadContent += `Info & Summary:\n`;
     downloadContent += `- File Name: ${analysisResultsStore.inputFileName || '-'}\n`;
     downloadContent += `- File Size: ${analysisResultsStore.inputFileSize ? `${(analysisResultsStore.inputFileSize / 1024).toFixed(2)} KB` : '-'}\n`;
     downloadContent += `- BOM Format/Version: ${analysisResultsStore.bomFormatVersion || '-'}\n`;
     downloadContent += `- Primary Component: ${analysisResultsStore.primaryComponentName || '-'}\n`;
     downloadContent += `-------------------------\n`;
     downloadContent += `- Components Processed: ${analysisResultsStore.totalProcessed}\n`;
     downloadContent += `- Unique Component Names: ${analysisResultsStore.totalUniqueNames}\n`;
     downloadContent += `- Unique Name/Version Pairs: ${analysisResultsStore.totalUniqueNameVersion}\n`;
     downloadContent += `- Component Names with Multiple Versions: ${analysisResultsStore.duplicateDetails.size}\n\n`;
     // Duplicates
     downloadContent += `Component Names with Multiple Versions:\n`;
     if (analysisResultsStore.duplicateDetails.size > 0) {
          const sortedDupNames = Array.from(analysisResultsStore.duplicateDetails.keys()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
          for (const name of sortedDupNames) {
              const details = analysisResultsStore.duplicateDetails.get(name);
              downloadContent += `▶ ${name} (Total Instances: ${details.total})\n`;
              const sortedVersions = Array.from(details.versions.entries()).sort((a, b) => {
                  const vA = a[0] === MISSING_VERSION_PLACEHOLDER ? '' : a[0].toLowerCase();
                  const vB = b[0] === MISSING_VERSION_PLACEHOLDER ? '' : b[0].toLowerCase();
                  return vA.localeCompare(vB);
              });
              for (const [version, count] of sortedVersions) {
                  const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<not specified>" : version;
                  downloadContent += `    - Version: ${versionDisplay}${count > 1 ? ` [x${count}]` : ''}\n`;
              }
              downloadContent += "\n";
          }
     } else {
          downloadContent += (analysisResultsStore.totalProcessed > 0 ? "No duplicates found.\n\n" : "No components processed.\n\n");
     }
     // Unique Components
     downloadContent += `Unique Component Name/Version Combinations (Sorted):\n`;
      if (analysisResultsStore.uniqueComponentsList.length > 0) {
          analysisResultsStore.uniqueComponentsList.forEach(([name, version]) => {
              const versionDisplay = version === MISSING_VERSION_PLACEHOLDER ? "<not specified>" : version;
              downloadContent += `- ${name} (Version: ${versionDisplay})\n`;
          });
      } else {
           downloadContent += (analysisResultsStore.totalProcessed > 0 ? "No unique combinations extracted.\n" : "No components processed.\n");
      }
      downloadContent += "\n";
      // Dependencies
      downloadContent += `Dependency Information:\n`;
      if(analysisResultsStore.dependencyMap && analysisResultsStore.dependencyMap.size > 0) {
         downloadContent += `Dependency Roots Found: ${analysisResultsStore.dependencyRoots.length}\n`;
         analysisResultsStore.dependencyRoots.forEach(rootRef => {
              const rootInfo = analysisResultsStore.bomRefMap.get(rootRef);
              const rootName = rootInfo?.name || rootRef;
              const rootVersion = rootInfo?.version === MISSING_VERSION_PLACEHOLDER ? "<not specified>" : rootInfo?.version || "";
              downloadContent += `- ${rootName} ${rootVersion ? '(v' + rootVersion + ')' : ''} (Ref: ${rootRef})\n`;
         });
         downloadContent += "\n";
      } else {
         downloadContent += `No <dependencies> section found or processed.\n\n`;
      }

    const blob = new Blob([downloadContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeFileNameBase = (analysisResultsStore.inputFileName || 'sbom_analysis').replace(/[^a-z0-9_\-\.]/gi, '_').replace(/\.xml$/i, '');
    a.download = `${safeFileNameBase}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Graph Interaction Handlers ---
function handleGraphRefresh() {
     if (cyInstance && analysisResultsStore) { // Ensure instance and data exist
         console.log("Refreshing graph layout...");
         clearGraphHighlights();
         if(graphSearchInput) graphSearchInput.value = '';

          // Recreate initial elements to reset view completely
         const { bomRefMap, dependencyMap, dependencyRoots, duplicateDetails } = analysisResultsStore;
         const cyElements = createCytoscapeElements(bomRefMap, dependencyMap, dependencyRoots, duplicateDetails);
         cyInstance.elements().remove(); // Remove existing elements
         cyInstance.add(cyElements);    // Add the new initial elements

         cyInstance.layout({ name: 'dagre', rankDir: 'TB', spacingFactor: 1.3, padding: 30,
             nodeDimensionsIncludeLabels: true, animate: true, animationDuration: 500 }).run();
         cyInstance.fit(30); // Fit after layout

     } else {
         console.warn("Refresh clicked, but no graph instance or analysis data exists.");
     }
}

/** Enhanced graph search handler */
function handleGraphSearch() {
     if (!cyInstance || !graphSearchInput || !analysisResultsStore) return;
     const { bomRefMap, dependencyMap, dependencyRoots, duplicateDetails } = analysisResultsStore;

     const query = graphSearchInput.value.trim().toLowerCase();
     clearGraphHighlights();
     // Only search for 3+ chars
     if (query.length < 3) return;

     // Only search on Enter, or after debounce (see event listener below)
     // (Debounce is already applied in event listener)

     // Cap the number of matches to avoid UI freeze
     const MAX_MATCHES = 30; // Lowered for less crowding
     let potentialMatchesRefs = [];
     analysisResultsStore.bomRefMap.forEach((component, ref) => {
         const label = `${component.name}\n(${component.version === MISSING_VERSION_PLACEHOLDER ? "<missing>" : component.version})`.toLowerCase();
         const name = (component.name || '').toLowerCase();
         const version = (component.version === MISSING_VERSION_PLACEHOLDER ? '' : component.version).toLowerCase();
         if (label.includes(query) || name.includes(query) || version.includes(query)) {
             potentialMatchesRefs.push(ref);
         }
     });
     if (potentialMatchesRefs.length > MAX_MATCHES) {
         potentialMatchesRefs = potentialMatchesRefs.slice(0, MAX_MATCHES);
         if(graphSearchInput.style) {
             graphSearchInput.style.borderColor = '#f8961e'; // warning color
             setTimeout(() => { graphSearchInput.style.borderColor = ''; }, 1500);
         }
         // Optionally show a warning in the UI (not console)
     }
     if (potentialMatchesRefs.length === 0) {
         if(graphSearchInput.style) {
             graphSearchInput.style.borderColor = '#f72585'; // --danger
             setTimeout(() => { graphSearchInput.style.borderColor = ''; }, 1500);
         }
         cyInstance.elements().removeClass('dimmed');
         return;
     }
     cyInstance.elements().addClass('dimmed');
     let nodesToMakeVisible = cyInstance.collection();
     let needsLayout = false;
     potentialMatchesRefs.forEach(matchRef => {
         let nodeInGraph = cyInstance.$id(matchRef);
         if (nodeInGraph.empty()) {
             const path = findPathToNode(matchRef, dependencyRoots, dependencyMap);
             if (path) {
                 const addedNodes = addNodesAndEdgesAlongPath(path, cyInstance);
                 nodesToMakeVisible = nodesToMakeVisible.union(addedNodes);
                 needsLayout = true;
             }
         } else {
             nodesToMakeVisible = nodesToMakeVisible.union(nodeInGraph);
         }
     });
     let finalHighlightSet = cyInstance.collection();
     const namesProcessed = new Set();
     nodesToMakeVisible.forEach(node => {
         finalHighlightSet = finalHighlightSet.union(node);
         const nodeName = node.data('name');
         if (nodeName && analysisResultsStore.duplicateDetails.has(nodeName) && !namesProcessed.has(nodeName)) {
             const duplicateNodesInGraph = cyInstance.nodes(`[name = "${nodeName}"]`);
             finalHighlightSet = finalHighlightSet.union(duplicateNodesInGraph);
             namesProcessed.add(nodeName);
         }
     });
     if (finalHighlightSet.length > 0) {
        finalHighlightSet.neighborhood().removeClass('dimmed');
        finalHighlightSet.removeClass('dimmed').addClass('highlighted');
     } else {
         cyInstance.elements().removeClass('dimmed');
     }
     if (needsLayout) {
         const layout = cyInstance.layout({ name: 'dagre', rankDir: 'TB', spacingFactor: 1.3, padding: 30,
             nodeDimensionsIncludeLabels: true, animate: true, animationDuration: 500, fit: false
         });
         layout.run();
         setTimeout(() => {
             if (finalHighlightSet.length > 0) {
                cyInstance.animate({ fit: { eles: finalHighlightSet, padding: 50 } }, { duration: 400 });
             }
         }, 300);
     } else if (finalHighlightSet.length > 0){
         cyInstance.animate({ fit: { eles: finalHighlightSet, padding: 50 } }, { duration: 400 });
     }
}

function clearGraphHighlights() {
    if (cyInstance) {
        cyInstance.elements().removeClass('highlighted').removeClass('dimmed');
    }
     if(graphSearchInput && graphSearchInput.style) {
         graphSearchInput.style.borderColor = '';
     }
}

// --- Attach Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Basic check for essential elements
    if (!analyzeButton || !cyContainer || !fileInput || tabButtons.length === 0) {
        console.error("CRITICAL: Cannot attach listeners - UI elements missing.");
        const body = document.querySelector('body');
        if (body) body.innerHTML = '<p style="color: red; padding: 1rem;">Error initializing tool: Required UI elements not found.</p>';
        return;
    }

    // Attach core action listeners only if elements exist
    if(analyzeButton) analyzeButton.addEventListener('click', handleAnalyzeClick);
    if(downloadButton) downloadButton.addEventListener('click', handleDownload);
    if(refreshGraphButton) refreshGraphButton.addEventListener('click', handleGraphRefresh);
    if(graphSearchInput) {
        // Only search on Enter, or after debounce (debounce is still useful for Enter)
        graphSearchInput.addEventListener('input', debounce(() => {/* no-op, disables live search */}, 300));
        graphSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleGraphSearch(); });
    }

    // Attach tab switching listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetTabId = event.currentTarget.getAttribute('data-tab');
            if (targetTabId) switchTab(targetTabId);
        });
    });

    // File input listener
    if(fileInput) {
        fileInput.addEventListener('change', () => {
            if(graphSearchInput) graphSearchInput.value = '';
            clearGraphHighlights();
            if(resultsDiv) resultsDiv.style.display = 'none';
            if(errorDiv) errorDiv.classList.add('hidden');
            if (cyInstance) {
                cyInstance.destroy();
                cyInstance = null;
                cyContainer.innerHTML = '';
            }
        });
    }

    console.log("BOMStorm script loaded and event listeners attached.");
});

console.log("BOMStorm script file parsed.");