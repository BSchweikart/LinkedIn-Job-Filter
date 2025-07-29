document.addEventListener('DOMContentLoaded', () => {
    // MODIFIED: Renamed from extensionToggle to extensionMasterToggle
    const extensionMasterToggleCheckbox = document.getElementById('extensionMasterToggle');
    // NEW: Checkbox for hiding promoted content
    const hidePromotedContentCheckbox = document.getElementById('hidePromotedContentOption');
    const delayUserHiddenCheckbox = document.getElementById('delayUserHidden');
    const enableJobFiltersCheckbox = document.getElementById('enableJobFiltersOption');
    const excludedTitlesTextarea = document.getElementById('excludedTitles');
    const excludedLocationsStateTextarea = document.getElementById('excludedLocationsState');
    const excludedLocationsCityTextarea = document.getElementById('excludedLocationsCity');
    const excludedCompaniesTextarea = document.getElementById('excludedCompanies');
    // NEW: Textarea for hard state exclusions
    const excludedLocationsHardStateTextarea = document.getElementById('excludedLocationsHardState');
    const saveOptionsButton = document.getElementById('saveOptions');

    // --- Load saved states from storage ---
    // NEW: Load extensionMasterToggle state
    chrome.storage.local.get('extensionEnabled', (data) => {
        extensionMasterToggleCheckbox.checked = data.extensionEnabled === true;
    });

    // NEW: Load hidePromotedContentOption state
    chrome.storage.local.get('hidePromotedContentEnabled', (data) => {
        hidePromotedContentCheckbox.checked = data.hidePromotedContentEnabled === true;
    });

    chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
        delayUserHiddenCheckbox.checked = data.delayUserHiddenEnabled === true;
    });

    chrome.storage.local.get('enableJobFilters', (data) => {
        enableJobFiltersCheckbox.checked = data.enableJobFilters === true;
    });

    chrome.storage.local.get({
        'excludedTitles': [],
        'excludedLocationsState': [],
        'excludedLocationsCity': [],
        'excludedCompanies': [],
        // NEW: Load hard state exclusions
        'excludedLocationsHardState': []
    }, (data) => {
        excludedTitlesTextarea.value = data.excludedTitles.join('\n');
        excludedLocationsStateTextarea.value = data.excludedLocationsState.join('\n');
        excludedLocationsCityTextarea.value = data.excludedLocationsCity.join('\n');
        excludedCompaniesTextarea.value = data.excludedCompanies.join('\n');
        // NEW: Set value for hard state exclusions
        excludedLocationsHardStateTextarea.value = data.excludedLocationsHardState.join('\n');
    });

    // --- Event listeners for saving states to storage ---
    // NEW: Save extensionMasterToggle state on change
    extensionMasterToggleCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'extensionEnabled': event.target.checked });
    });

    // NEW: Save hidePromotedContentOption state on change
    hidePromotedContentCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'hidePromotedContentEnabled': event.target.checked });
    });

    delayUserHiddenCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked });
    });

    // Save all options when the "Save & Refresh Page" button is clicked
    saveOptionsButton.addEventListener('click', () => {
        const masterToggleEnabled = extensionMasterToggleCheckbox.checked; // NEW: Get master toggle state
        const hidePromoted = hidePromotedContentCheckbox.checked; // NEW: Get hide promoted state
        const delayEnabled = delayUserHiddenCheckbox.checked;
        const enableFilters = enableJobFiltersCheckbox.checked;
        const titles = excludedTitlesTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const locationsState = excludedLocationsStateTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const locationsCity = excludedLocationsCityTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const companies = excludedCompaniesTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        // NEW: Get hard state exclusions
        const locationsHardState = excludedLocationsHardStateTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');


        chrome.storage.local.set({
            'extensionEnabled': masterToggleEnabled, // NEW: Save master toggle state
            'hidePromotedContentEnabled': hidePromoted, // NEW: Save hide promoted content state
            'delayUserHiddenEnabled': delayEnabled,
            'enableJobFilters': enableFilters,
            'excludedTitles': titles,
            'excludedLocationsState': locationsState,
            'excludedLocationsCity': locationsCity,
            'excludedCompanies': companies,
            'excludedLocationsHardState': locationsHardState // NEW: Save hard state exclusions
        }, () => {
            // Reload the current tab to apply the filters
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        });
    });
});
