// ==UserScript==
// @name         Remote Update & Utility Helper
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Support manual update checking and various utility features
// @author       YourName
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_openInTab
// @connect      raw.githubusercontent.com
// @updateURL    https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// @downloadURL  https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration & Constants ---
    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        CURRENT_VERSION: GM_info.script.version,
        IS_MINIMIZED: GM_getValue('is_minimized', false)
    };

    // --- Utility Functions ---
    const Logger = {
        info: (msg) => console.log(`%c[Helper]%c ${msg}`, 'color: #007bff; font-weight: bold', 'color: inherit'),
        error: (msg) => console.error(`[Helper] Error: ${msg}`)
    };

    // --- Manual Update Checker ---
    function checkUpdate(isManual = false) {
        if (isManual) {
            GM_notification({
                title: 'Updating...',
                text: 'Checking for remote version...',
                timeout: 2000
            });
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL,
            onload: function(response) {
                if (response.status === 200) {
                    const remoteMatch = response.responseText.match(/@version\s+([\d.]+)/);
                    if (remoteMatch && remoteMatch[1]) {
                        const remoteVersion = remoteMatch[1];
                        if (isNewerVersion(remoteVersion, CONFIG.CURRENT_VERSION)) {
                            handleNewVersion(remoteVersion);
                        } else if (isManual) {
                            alert(`Current version (${CONFIG.CURRENT_VERSION}) is up to date!`);
                        }
                    }
                } else {
                    Logger.error('Failed to fetch remote version.');
                }
            },
            onerror: () => Logger.error('Network error during update check.')
        });
    }

    function isNewerVersion(remote, current) {
        const r = remote.split('.').map(Number);
        const c = current.split('.').map(Number);
        for (let i = 0; i < Math.max(r.length, c.length); i++) {
            if ((r[i] || 0) > (c[i] || 0)) return true;
            if ((r[i] || 0) < (c[i] || 0)) return false;
        }
        return false;
    }

    function handleNewVersion(version) {
        const confirmUpdate = confirm(`New version found: ${version}\nYour version: ${CONFIG.CURRENT_VERSION}\nUpdate now?`);
        if (confirmUpdate) {
            GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
        }
    }

    // --- UI Implementation ---
    function createUI() {
        const container = document.createElement('div');
        container.id = 'helper-ui-root';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 220px;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(0,0,0,0.05);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px 16px;
            background: #007bff;
            color: white;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
        `;
        header.innerHTML = `<span>Script Helper</span><span id="helper-toggle-icon">−</span>`;
        
        const body = document.createElement('div');
        body.id = 'helper-ui-body';
        body.style.cssText = `padding: 12px; display: block;`;

        // Utility Buttons
        const createButton = (text, onClick, color = '#007bff') => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.onclick = onClick;
            btn.style.cssText = `
                width: 100%;
                margin-bottom: 8px;
                padding: 8px;
                background: ${color};
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                transition: opacity 0.2s;
            `;
            btn.onmouseover = () => btn.style.opacity = '0.8';
            btn.onmouseout = () => btn.style.opacity = '1';
            return btn;
        };

        const updateBtn = createButton('Check for Update', () => checkUpdate(true));
        const infoBtn = createButton('Current Info', () => {
            alert(`Script: ${GM_info.script.name}\nVersion: ${CONFIG.CURRENT_VERSION}\nSite: ${location.hostname}`);
        }, '#28a745');
        
        const darkToggle = createButton('Toggle Dark Mode', () => {
            const isDark = GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', !isDark);
            applyDarkMode(!isDark);
        }, '#343a40');

        body.appendChild(updateBtn);
        body.appendChild(infoBtn);
        body.appendChild(darkToggle);

        const footer = document.createElement('div');
        footer.style.cssText = `
            font-size: 10px;
            color: #666;
            text-align: center;
            padding-bottom: 8px;
        `;
        footer.innerText = `Version ${CONFIG.CURRENT_VERSION}`;
        body.appendChild(footer);

        container.appendChild(header);
        container.appendChild(body);
        document.body.appendChild(container);

        // Toggle functionality
        const toggle = () => {
            const isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            document.getElementById('helper-toggle-icon').innerText = isMin ? '−' : '+';
            container.style.width = isMin ? '220px' : '120px';
            GM_setValue('is_minimized', !isMin);
        };

        header.onclick = toggle;

        // Restore state
        if (CONFIG.IS_MINIMIZED) {
            body.style.display = 'none';
            document.getElementById('helper-toggle-icon').innerText = '+';
            container.style.width = '120px';
        }
    }

    function applyDarkMode(enabled) {
        if (enabled) {
            document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)';
        } else {
            document.documentElement.style.filter = '';
        }
    }

    // --- Entry Point ---
    function init() {
        createUI();
        applyDarkMode(GM_getValue('dark_mode', false));
        GM_registerMenuCommand('Manual Check Update', () => checkUpdate(true));
        Logger.info('Initialized.');
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
