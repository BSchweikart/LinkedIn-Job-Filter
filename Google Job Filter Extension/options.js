document.addEventListener('DOMContentLoaded', () => {
    const delayUserHiddenCheckbox = document.getElementById('delayUserHidden');
    const enableJobFiltersCheckbox = document.getElementById('enableJobFiltersOption');
    const excludedTitlesTextarea = document.getElementById('excludedTitles');
    const excludedLocationsStateTextarea = document.getElementById('excludedLocationsState');
    const excludedLocationsCityTextarea = document.getElementById('excludedLocationsCity');
    const excludedCompaniesTextarea = document.getElementById('excludedCompanies');
    const saveOptionsButton = document.getElementById('saveOptions');

    // --- Load saved states from storage ---
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
        'excludedCompanies': []
    }, (data) => {
        excludedTitlesTextarea.value = data.excludedTitles.join('\n');
        excludedLocationsStateTextarea.value = data.excludedLocationsState.join('\n');
        excludedLocationsCityTextarea.value = data.excludedLocationsCity.join('\n');
        excludedCompaniesTextarea.value = data.excludedCompanies.join('\n');
    });

    // --- Save states to storage ---
    delayUserHiddenCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked });
    });

    saveOptionsButton.addEventListener('click', () => {
        const delayEnabled = delayUserHiddenCheckbox.checked;
        const enableFilters = enableJobFiltersCheckbox.checked;
        const titles = excludedTitlesTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const locationsState = excludedLocationsStateTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const locationsCity = excludedLocationsCityTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');
        const companies = excludedCompaniesTextarea.value.split('\n').map(line => line.trim()).filter(line => line !== '');

        chrome.storage.local.set({
            'delayUserHiddenEnabled': delayEnabled,
            'enableJobFilters': enableFilters,
            'excludedTitles': titles,
            'excludedLocationsState': locationsState,
            'excludedLocationsCity': locationsCity,
            'excludedCompanies': companies
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
