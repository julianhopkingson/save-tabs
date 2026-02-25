document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('session-list');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');

    const defaultIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjODY4NjhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINmEyIDIgMCAwIDAtMiAydjE2YTIgMiAwIDAgMCAyIDJoMTJhMiAyIDAgMCAwIDItMlY5eiI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjEzIDIgMTMgOSAyMCA5Ij48L3BvbHlsaW5lPjwvc3ZnPg==';

    function getFaviconUrl(u) {
        const url = new URL(chrome.runtime.getURL("/_favicon/"));
        url.searchParams.set("pageUrl", u);
        url.searchParams.set("size", "32");
        return url.toString();
    }

    // --- Load Recently Closed ---
    const loadSessions = (maxResults) => {
        chrome.sessions.getRecentlyClosed({ maxResults }, (sessions) => {
            loadingState.classList.add('hidden');
            if (!sessions || sessions.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            sessions.forEach(session => {
                let title = '';
                let url = '';
                let iconUrl = defaultIcon;
                let isWindow = !!session.window;

                if (session.tab) {
                    title = session.tab.title || session.tab.url;
                    url = session.tab.url;
                    if (url && (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:'))) {
                        iconUrl = defaultIcon;
                    } else if (url) {
                        iconUrl = getFaviconUrl(url);
                    } else {
                        iconUrl = defaultIcon;
                    }
                } else if (session.window) {
                    let tabsCount = session.window.tabs ? session.window.tabs.length : 0;
                    title = `${tabsCount} Tabs Window`;
                    url = 'chrome://history/'; // fall back click target
                }

                const el = document.createElement('div');
                el.className = 'session-item';
                el.title = title;

                const img = document.createElement('img');
                img.className = 'session-icon';
                img.src = iconUrl;
                // fallback if favIconUrl is broken
                img.onerror = () => { img.src = defaultIcon; };

                const info = document.createElement('div');
                info.className = 'session-info';

                const titleEl = document.createElement('div');
                titleEl.className = 'session-title';
                titleEl.textContent = title;

                info.appendChild(titleEl);
                el.appendChild(img);
                el.appendChild(info);

                el.addEventListener('click', () => {
                    const sessionId = session.tab ? session.tab.sessionId : (session.window ? session.window.sessionId : undefined);
                    chrome.sessions.restore(sessionId, () => {
                        window.close();
                    });
                });

                container.appendChild(el);
            });
        });
    };

    chrome.storage.sync.get({ displayCount: 25 }, (items) => {
        loadSessions(items.displayCount);
    });

    // --- Actions ---
    document.getElementById('btn-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById('btn-history').addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://history/' });
    });

    document.getElementById('btn-save').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'save_tabs' }, (response) => {
            if (response && response.success) {
                let btn = document.getElementById('btn-save');
                let orgHtml = btn.innerHTML;
                btn.innerHTML = '✅';
                setTimeout(() => { btn.innerHTML = orgHtml; }, 1500);
            }
        });
    });

    // --- Recover Modal ---
    const modal = document.getElementById('confirm-modal');
    const btnCancel = document.getElementById('btn-modal-cancel');
    const btnConfirm = document.getElementById('btn-modal-confirm');

    document.getElementById('btn-recover').addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    btnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    btnConfirm.addEventListener('click', () => {
        modal.classList.add('hidden');
        // Change to loading text
        document.getElementById('btn-recover').innerHTML = '⏳';
        chrome.runtime.sendMessage({ action: 'recover_tabs' }, (response) => {
            if (response && response.success) {
                window.close();
            }
        });
    });
});
