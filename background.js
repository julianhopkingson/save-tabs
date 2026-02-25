const STORAGE_KEY = 'saved_session_snapshot';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'save_tabs') {
        handleSaveTabs().then(() => {
            sendResponse({ success: true });
        }).catch(e => {
            console.error('Save tabs error', e);
            sendResponse({ success: false, error: e.message });
        });
        return true; // keep alive for async sendResponse
    }

    if (request.action === 'recover_tabs') {
        handleRecoverTabs().then(() => {
            sendResponse({ success: true });
        }).catch(e => {
            console.error('Recover tabs error', e);
            sendResponse({ success: false, error: e.message });
        });
        return true;
    }
});

/**
 * Handle saving the current window's tabs and tab groups
 */
async function handleSaveTabs() {
    const currentWindow = await chrome.windows.getCurrent();
    const windowId = currentWindow.id;

    // 1. Get all groups
    const groups = await chrome.tabGroups.query({ windowId });
    const groupMap = {};
    groups.forEach(g => {
        groupMap[g.id] = { title: g.title, color: g.color };
    });

    // 2. Get all tabs
    const tabs = await chrome.tabs.query({ windowId });

    // 3. Construct save data
    const snapshotData = tabs.map(tab => {
        let groupInfo = null;
        if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && groupMap[tab.groupId]) {
            groupInfo = groupMap[tab.groupId];
        }

        return {
            url: tab.url,
            title: tab.title,
            active: tab.active,
            pinned: tab.pinned,
            groupInfo: groupInfo // null if not in a group
        };
    });

    // 4. Save to storage
    await chrome.storage.local.set({ [STORAGE_KEY]: snapshotData });
}

/**
 * Handle restoring tabs seamlessly
 */
async function handleRecoverTabs() {
    const { [STORAGE_KEY]: rawData } = await chrome.storage.local.get([STORAGE_KEY]);
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('No snapshot data found');
    }

    const currentWindow = await chrome.windows.getCurrent();
    const windowId = currentWindow.id;

    // 1. Fetch old tabs to be deleted later
    const oldTabs = await chrome.tabs.query({ windowId });
    const oldTabIds = oldTabs.map(t => t.id);

    // 2. We will group the tabs after they have been created.
    // Using stringified groupInfo as a temporary grouping key.
    const groupBins = {}; // key: stringified groupInfo, value: [new tab IDs]

    let hasCreatedAtLeastOneTab = false;

    // 3. Create new tabs 
    for (const tabData of rawData) {
        let targetUrl = tabData.url;
        // Basic protection against broken protocols
        if (!targetUrl.startsWith('http') && !targetUrl.startsWith('chrome')) {
            targetUrl = 'chrome://newtab/';
        }

        try {
            const newTab = await chrome.tabs.create({
                windowId,
                url: targetUrl,
                active: tabData.active,
                pinned: tabData.pinned
            });

            hasCreatedAtLeastOneTab = true;

            // Classify for grouping
            if (tabData.groupInfo) {
                const key = JSON.stringify(tabData.groupInfo);
                if (!groupBins[key]) groupBins[key] = [];
                groupBins[key].push(newTab.id);
            }
        } catch (createErr) {
            console.warn('Failed to recover a specific tab:', targetUrl, createErr);
        }
    }

    // 4. Reconstruct groups
    for (const key of Object.keys(groupBins)) {
        const ids = groupBins[key];
        const info = JSON.parse(key);

        try {
            const newGroupId = await chrome.tabs.group({ tabIds: ids, createProperties: { windowId } });
            await chrome.tabGroups.update(newGroupId, {
                color: info.color,
                title: info.title || ''
            });
        } catch (groupErr) {
            console.warn('Failed to reconstruct a group:', info, groupErr);
        }
    }

    // 5. Delete old tabs ONLY IF AT LEAST ONE NEW TAB IS SUCCESSFULLY CREATED 
    // This prevents the whole Chrome window from crashing/closing inadvertently.
    if (hasCreatedAtLeastOneTab) {
        await new Promise(r => setTimeout(r, 100)); // micro-delay for visual transition
        for (const oldId of oldTabIds) {
            try {
                await chrome.tabs.remove(oldId);
            } catch (e) {
                // Tab might have already been closed manually by the user or an extension
            }
        }
    }
}
