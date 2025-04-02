console.log("Content script is running!");

let extensionEnabled = false; // Default to false
let debounceTimeoutId = null;
const debounceDelay = 200; // Adjust as needed
let hasLoggedInfo = false;
let currentUrl = null;

// --- Helper function to get extensionEnabled state ---
function isExtensionEnabled(callback) {
    chrome.storage.local.get('extensionEnabled', (data) => {
        const enabled = data.extensionEnabled === true;
        callback(enabled);
    });
}

function logExtensionInfo() {
    chrome.storage.local.get('extensionEnabled', (data) => {
        const shouldHide = data.extensionEnabled === true;
        console.log("Extension state:", shouldHide ? "On" : "Off");
        console.log("Current Webpage:", window.location.href);

        if (window.location.href.startsWith('https://www.linkedin.com/jobs/search')) {
            console.log("Current Function:", "processJobs (search)");
        } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
            console.log("Current Function:", "processJobs (home/other)");
        } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
            console.log("Current Function:", "processFeed");
        }
    });
}

function initialize() {
    setupGlobalObserver();
    // Initial processing will be done by the event listeners
}

// --- Home Page Logic ---
function hidePromotedFeedItem(feedPost) {
    const promotedMeta = feedPost.querySelector('.update-components-actor__meta');
    if (promotedMeta) {
        const promotedSpan = promotedMeta.querySelector('.update-components-actor__sub-description > span[aria-hidden="true"]');
        if (promotedSpan && promotedSpan.textContent.trim() === 'Promoted') {
            if (feedPost && feedPost.style.display !== 'none') {
                feedPost.style.display = 'none';
                return true;
            }
        }
    }
    return false;
}

function processFeed() {
    const feedItems = document.querySelectorAll('.feed-shared-update-v2');
    isExtensionEnabled(enabled => {
        if (enabled) {
            feedItems.forEach(item => {
                hidePromotedFeedItem(item);
            });
        }
    });
}

// --- Observer setup ---
let bodyObserver = null; // Declare observer outside the function

function setupGlobalObserver() {
    const body = document.querySelector('body');
    let targetNode = body;
    const observerOptions = { childList: true, subtree: true };

    if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
        const jobListContainer = document.querySelector('div.scaffold-layout__list');
        if (jobListContainer) {
            targetNode = jobListContainer;
        }
    }

    if (targetNode) {
        const observer = new MutationObserver(mutationsList => {
            isExtensionEnabled(enabled => {
                if (enabled) {
                    debouncedProcessPage();
                }
            });
        });
        observer.observe(targetNode, observerOptions);
        bodyObserver = observer; // Assign observer to the global variable
    } else {
        // console.log('Target element not found for MutationObserver.'); // Removed
    }
}

// --- Adapted Jobs Page Logic (based on home page pattern) ---
function hidePromotedJobCard(jobCardLi) {
    const promotedFooterItems = jobCardLi.querySelectorAll('.job-card-container__footer-item');
    if (promotedFooterItems) {
        for (const footerItem of promotedFooterItems) {
            const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
            if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                if (jobCardLi) {
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none';
                    return true;
                }
            }
        }
    }

    // Check for the "We won’t show you this job again." message
    const hiddenByUserFooter = jobCardLi.querySelector('.job-card-container__footer-item--highlighted');
    if (hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.') {
        if (jobCardLi) {
            jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
            jobCardLi.style.display = 'none';
            return true;
        }
    }
    return false;
}

function processJobs() {
    isExtensionEnabled(enabled => {
        if (enabled) {
            let jobListContainer;
            if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                jobListContainer = document.querySelector('div.scaffold-layout__list');
                if (jobListContainer) {
                    const jobItems = jobListContainer.querySelectorAll('li.scaffold-layout__list-item');
                    jobItems.forEach(item => {
                        hidePromotedJobCard(item);
                    });
                }
            } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                const jobItems = document.querySelectorAll('li.discovery-templates-entity-item');
                jobItems.forEach(item => {
                    hidePromotedJobCard(item);
                });
            }
        }
    });
}

function debouncedProcessPage() {
    if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
    }
    debounceTimeoutId = setTimeout(() => {
        isExtensionEnabled(enabled => {
            if (enabled) {
                if (window.location.href !== currentUrl) {
                    hasLoggedInfo = false;
                    logExtensionInfo();
                    currentUrl = window.location.href;
                    hasLoggedInfo = true;
                }
                if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                    processJobs();
                } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                    processFeed();
                }
            } else {
                hasLoggedInfo = false;
                currentUrl = null;
            }
        });
        debounceTimeoutId = null;
    }, debounceDelay);
}

// --- Initialization and Event Listeners ---
window.addEventListener('load', () => {
    initialize();
    isExtensionEnabled(enabled => {
        if (enabled) {
            logExtensionInfo();
            currentUrl = window.location.href; // Initialize currentUrl
            if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                processJobs();
            } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                processFeed();
            }
            hasLoggedInfo = true;
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Removed runProcessing();
});

document.addEventListener('visibilitychange', () => {
    // Removed runProcessing();
});

window.addEventListener('popstate', () => {
    // Removed runProcessing();
});

window.addEventListener('hashchange', () => {
    // Removed runProcessing();
});
