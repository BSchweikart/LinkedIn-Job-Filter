document.addEventListener('DOMContentLoaded', () => {
    const extensionToggle = document.getElementById('extensionToggle');
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

    // --- Load saved states ---
    chrome.storage.local.get('extensionEnabled', (data) => {
        extensionToggle.checked = data.extensionEnabled === true;
    });

    chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
        delayUserHiddenCheckboxPopup.checked = data.delayUserHiddenEnabled === true;
    });

    chrome.storage.local.get('enableJobFilters', (data) => {
        enableJobFiltersCheckbox.checked = data.enableJobFilters === true;
    });

    // --- Save state on change ---
    extensionToggle.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'extensionEnabled': event.target.checked });
    });

    delayUserHiddenCheckboxPopup.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked });
    });

    enableJobFiltersCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'enableJobFilters': event.target.checked });
    });

    // --- Add filter functionality ---
    addExcludeTitleButton.addEventListener('click', () => {
        const title = excludeTitleInput.value.trim();
        if (title) {
            chrome.storage.local.get({ 'excludedTitles': [] }, (data) => {
                const updatedTitles = [...data.excludedTitles, title];
                chrome.storage.local.set({ 'excludedTitles': updatedTitles }, () => {
                    excludeTitleInput.value = ''; // Clear the input
                    console.log('Added to excluded titles:', title); // Optional feedback
                });
            });
        }
    });

    addExcludeLocationStateButton.addEventListener('click', () => {
        const locationsInput = excludeLocationStateInput.value.trim();
        if (locationsInput) {
            const locationsArray = locationsInput.split(',').map(loc => loc.trim()).filter(loc => loc !== '');
            if (locationsArray.length > 0) {
                chrome.storage.local.get({ 'excludedLocationsState': [] }, (data) => {
                    const updatedLocations = [...data.excludedLocationsState, ...locationsArray];
                    chrome.storage.local.set({ 'excludedLocationsState': updatedLocations }, () => {
                        excludeLocationStateInput.value = '';
                        console.log('Added to excluded locations (state):', locationsArray);
                    });
                });
            }
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
