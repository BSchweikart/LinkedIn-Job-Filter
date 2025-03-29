// Only used to make sure it's running no other use.
console.log("Content script is running!");

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
    let hiddenCount = 0;
    feedItems.forEach(item => {
        if (hidePromotedFeedItem(item)) {
            hiddenCount++;
        }
    });
    // console.log("Processed", feedItems.length, " feed items, attempted to hide", hiddenCount, " promoted items.");
}

function setupHomePageObserver() {
    const feedContainer = document.querySelector('.scaffold-finite-scroll');
    if (feedContainer) {
        const observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    processFeed();
                }
            }
        });
        observer.observe(feedContainer, { childList: true, subtree: true });
    } else {
        console.log('Feed container not found for MutationObserver.');
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
                    // console.log('Found promoted job card, adding "hidden-promoted" class:', jobCardLi);
                    jobCardLi.classList.add('hidden-promoted');
                    return true;
                }
            }
        }
    }
    return false;
}

function processJobs() {
    const jobItems = document.querySelectorAll('li.discovery-templates-entity-item');
    let hiddenCount = 0;
    jobItems.forEach(item => {
        if (hidePromotedJobCard(item)) {
            hiddenCount++;
        }
    });
    // console.log("Processed", jobItems.length, " job items, attempted to hide", hiddenCount, " promoted items.");
}

function setupJobsPageObserver() {
    const jobsContainer = document.querySelector('.scaffold-finite-scroll__content');
    if (jobsContainer) {
        const observer = new MutationObserver(mutationsList => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    processJobs();
                }
            }
        });
        observer.observe(jobsContainer, { childList: true, subtree: true });
    } else {
        console.log('Jobs content container not found for MutationObserver.');
    }
}

// --- Initialization ---
window.addEventListener('load', () => {
    if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
        console.log('On the jobs page.');
        const jobsContainerInitial = document.querySelector('.scaffold-finite-scroll__content');
        if (jobsContainerInitial) {
            processJobs();
        } else {
            console.log('Initial jobs container not found.');
        }
        setupJobsPageObserver();
    } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
        console.log('On the home page.');
        processFeed();
        setupHomePageObserver();
    }
});

// Also try running on DOMContentLoaded for jobs page to catch elements sooner
if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
    document.addEventListener('DOMContentLoaded', () => {
        const jobsContainerDOMContentLoaded = document.querySelector('.scaffold-finite-scroll__content');
        if (jobsContainerDOMContentLoaded) {
            processJobs();
        }
    });
}
