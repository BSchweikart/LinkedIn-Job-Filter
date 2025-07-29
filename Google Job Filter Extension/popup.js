document.addEventListener('DOMContentLoaded', () => {
    // NEW: Master Extension Toggle
    const extensionMasterTogglePopup = document.getElementById('extensionMasterTogglePopup');
    // MODIFIED: Renamed from extensionToggle to hidePromotedContentTogglePopup
    const hidePromotedContentTogglePopup = document.getElementById('hidePromotedContentTogglePopup');
    const delayUserHiddenCheckboxPopup = document.getElementById('delayUserHiddenPopup');
    const openOptionsPageLink = document.getElementById('openOptionsPage');

    const enableJobFiltersCheckbox = document.getElementById('enableJobFilters');
    const excludeTitleInput = document.getElementById('excludeTitle');
    const addExcludeTitleButton = document.getElementById('addExcludeTitle');
    const excludeLocationStateInput = document.getElementById('excludeLocationState');
    const addExcludeLocationStateButton = document.getElementById('addExcludeLocationState');
    const excludeLocationCityInput = document.getElementById('excludeLocationCity');
    const addExcludeLocationCityButton = document.getElementById('addExcludeLocationCity');
    const excludeCompanyInput = document.getElementById('excludeCompany');
    const addExcludeCompanyButton = document.getElementById('addExcludeCompany');
    // NEW: Hard State Exclusion inputs
    const excludeLocationHardStateInput = document.getElementById('excludeLocationHardState');
    const addExcludeLocationHardStateButton = document.getElementById('addExcludeLocationHardState');

    // --- Load saved states ---
    // NEW: Load state for master extension toggle
    chrome.storage.local.get('extensionEnabled', (data) => {
        extensionMasterTogglePopup.checked = data.extensionEnabled === true;
    });

    // NEW: Load state for hide promoted content toggle
    chrome.storage.local.get('hidePromotedContentEnabled', (data) => {
        hidePromotedContentTogglePopup.checked = data.hidePromotedContentEnabled === true;
    });

    chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
        delayUserHiddenCheckboxPopup.checked = data.delayUserHiddenEnabled === true;
    });

    chrome.storage.local.get('enableJobFilters', (data) => {
        enableJobFiltersCheckbox.checked = data.enableJobFilters === true;
    });

    // --- Event Listeners for Toggles ---
    // NEW: Listener for master extension toggle
    extensionMasterTogglePopup.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'extensionEnabled': event.target.checked }, () => {
            // Reload the current tab to apply the changes
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    // NEW: Listener for hide promoted content toggle
    hidePromotedContentTogglePopup.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'hidePromotedContentEnabled': event.target.checked }, () => {
            // Reload the current tab to apply the changes
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    delayUserHiddenCheckboxPopup.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    enableJobFiltersCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'enableJobFilters': event.target.checked }, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });

    // --- Event Listeners for Add Buttons ---
    addExcludeTitleButton.addEventListener('click', () => {
        const title = excludeTitleInput.value.trim();
        if (title) {
            chrome.storage.local.get({ 'excludedTitles': [] }, (data) => {
                const updatedTitles = [...data.excludedTitles, title];
                chrome.storage.local.set({ 'excludedTitles': updatedTitles }, () => {
                    excludeTitleInput.value = '';
                    console.log('Added to excluded titles:', title);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                });
            });
        }
    });

    addExcludeLocationStateButton.addEventListener('click', () => {
        const state = excludeLocationStateInput.value.trim();
        if (state) {
            chrome.storage.local.get({ 'excludedLocationsState': [] }, (data) => {
                const updatedStates = [...data.excludedLocationsState, state];
                chrome.storage.local.set({ 'excludedLocationsState': updatedStates }, () => {
                    excludeLocationStateInput.value = '';
                    console.log('Added to excluded locations (state):', state);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                });
            });
        }
    });

    addExcludeLocationCityButton.addEventListener('click', () => {
        const city = excludeLocationCityInput.value.trim();
        if (city) {
            chrome.storage.local.get({ 'excludedLocationsCity': [] }, (data) => {
                const updatedCities = [...data.excludedLocationsCity, city];
                chrome.storage.local.set({ 'excludedLocationsCity': updatedCities }, () => {
                    excludeLocationCityInput.value = '';
                    console.log('Added to excluded locations (city):', city);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                });
            });
        }
    });

    addExcludeCompanyButton.addEventListener('click', () => {
        const company = excludeCompanyInput.value.trim();
        if (company) {
            chrome.storage.local.get({ 'excludedCompanies': [] }, (data) => {
                const updatedCompanies = [...data.excludedCompanies, company];
                chrome.storage.local.set({ 'excludedCompanies': updatedCompanies }, () => {
                    excludeCompanyInput.value = '';
                    console.log('Added to excluded companies:', company);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                });
            });
        }
    });

    // NEW: Listener for adding Hard State Exclusions
    addExcludeLocationHardStateButton.addEventListener('click', () => {
        const hardStateInput = excludeLocationHardStateInput.value.trim();
        if (hardStateInput) {
            // Split the input by comma and trim each part
            const newHardStates = hardStateInput.split(',').map(item => item.trim()).filter(item => item !== '');

            chrome.storage.local.get({ 'excludedLocationsHardState': [] }, (data) => {
                // Combine existing hard states with the new, split ones
                const updatedHardStates = [...data.excludedLocationsHardState, ...newHardStates];
                chrome.storage.local.set({ 'excludedLocationsHardState': updatedHardStates }, () => {
                    excludeLocationHardStateInput.value = '';
                    console.log('Added to hard excluded states:', newHardStates);
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            chrome.tabs.reload(tabs[0].id);
                        }
                    });
                });
            });
        }
    });

    // --- Open options page ---
    if (openOptionsPageLink) {
        openOptionsPageLink.addEventListener('click', (event) => {
            event.preventDefault();
            chrome.runtime.openOptionsPage();
        });
    }
});
