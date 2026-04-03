// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  支持远程 GitHub 更新、内置 UI 控制面板及多种实用功能
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
// @connect      github.com
// @updateURL    https://raw.githubusercontent.com/gao1774420117-afk/xiuxian-game/main/remote-update-script.user.js
// @downloadURL  https://raw.githubusercontent.com/gao1774420117-afk/xiuxian-game/main/remote-update-script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置与常量 ---
    const CONFIG = {
        UPDATE_URL: 'https://raw.githubusercontent.com/gao1774420117-afk/xiuxian-game/main/remote-update-script.user.js',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6, // 每6小时自动检查一次
        IS_MINIMIZED: GM_getValue('is_minimized', false)
    };

    // --- 日志助手 ---
    const Logger = {
        info: (msg) => console.log(`%c[脚本助手]%c ${msg}`, 'color: #007bff; font-weight: bold', 'color: inherit'),
        error: (msg) => console.error(`[脚本助手] 错误: ${msg}`)
    };

    // --- 更新检测逻辑优化 ---
    function checkUpdate(isManual = false) {
        const lastCheck = GM_getValue('last_update_check', 0);
        const now = Date.now();

        // 自动检查频率限制 (非手动模式下)
        if (!isManual && (now - lastCheck < CONFIG.AUTO_CHECK_INTERVAL)) {
            return; 
        }

        if (isManual) {
            GM_notification({
                title: '检查更新中...',
                text: '正在连接远程服务器，请稍候...',
                timeout: 3000
            });
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + now, // 添加时间戳防止缓存
            timeout: 10000,
            onload: function(response) {
                GM_setValue('last_update_check', now);
                
                if (response.status === 200) {
                    const remoteText = response.responseText;
                    const remoteMatch = remoteText.match(/@version\s+([\d.]+)/);
                    
                    if (remoteMatch && remoteMatch[1]) {
                        const remoteVersion = remoteMatch[1];
                        if (isNewerVersion(remoteVersion, CONFIG.CURRENT_VERSION)) {
                            handleNewVersion(remoteVersion);
                        } else if (isManual) {
                            alert(`当前已是最新版本! \n本地版本: ${CONFIG.CURRENT_VERSION}\n远程版本: ${remoteVersion}`);
                        }
                    } else {
                        if (isManual) alert('无法解析远程版本号，请查看脚本源码格式是否正确。');
                    }
                } else {
                    Logger.error(`更新检查失败，状态码: ${response.status}`);
                    if (isManual) alert('更新请求失败，请检查网络或 GitHub 仓库地址。');
                }
            },
            onerror: () => {
                Logger.error('网络错误，无法检查更新。');
                if (isManual) alert('网络连接错误，请稍后再试。');
            },
            ontimeout: () => {
                Logger.error('更新检查超时。');
                if (isManual) alert('请求超时，请检查您的网络连接。');
            }
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
        const msg = `发现新版本: ${version}\n当前版本: ${CONFIG.CURRENT_VERSION}\n\n是否立即前往更新？`;
        if (confirm(msg)) {
            GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
        }
    }

    // --- UI 界面实现 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;

        const container = document.createElement('div');
        container.id = 'helper-ui-root';
        container.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 25px;
            width: 200px;
            background: rgba(255, 255, 255, 0.92);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 999999;
            font-family: "Microsoft YaHei", sans-serif;
            overflow: hidden;
            transition: all 0.4s ease;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(0,123,255,0.2);
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 12px 15px;
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            font-size: 14px;
        `;
        header.innerHTML = `<span>⚙️ 助手控制台</span><span id="helper-toggle-icon" style="font-size:18px;">${CONFIG.IS_MINIMIZED ? '+' : '−'}</span>`;
        
        const body = document.createElement('div');
        body.id = 'helper-ui-body';
        body.style.cssText = `padding: 15px; display: ${CONFIG.IS_MINIMIZED ? 'none' : 'block'};`;

        // 按钮构建器
        const createButton = (text, onClick, color = '#007bff') => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.onclick = onClick;
            btn.style.cssText = `
                width: 100%;
                margin-bottom: 10px;
                padding: 10px;
                background: ${color};
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: transform 0.2s, box-shadow 0.2s;
            `;
            btn.onmouseenter = () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            };
            return btn;
        };

        const updateBtn = createButton('🚀 检查更新', () => checkUpdate(true));
        const infoBtn = createButton('📝 版本信息', () => {
            alert(`脚本名称: ${GM_info.script.name}\n当前版本: ${CONFIG.CURRENT_VERSION}\n运行域名: ${location.hostname}`);
        }, '#28a745');
        
        const darkToggle = createButton('🌓 切换主题', () => {
            const isDark = GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', !isDark);
            applyDarkMode(!isDark);
            GM_notification({ text: !isDark ? '已开启暗黑模式' : '已关闭暗黑模式', timeout: 1500 });
        }, '#495057');

        body.appendChild(updateBtn);
        body.appendChild(infoBtn);
        body.appendChild(darkToggle);

        const footer = document.createElement('div');
        footer.style.cssText = `
            font-size: 11px;
            color: #888;
            text-align: center;
            padding-top: 5px;
            border-top: 1px solid #eee;
        `;
        footer.innerText = `当前版本 v${CONFIG.CURRENT_VERSION}`;
        body.appendChild(footer);

        container.appendChild(header);
        container.appendChild(body);
        document.body.appendChild(container);

        // 折叠功能逻辑
        header.onclick = () => {
            const isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            document.getElementById('helper-toggle-icon').innerText = isMin ? '−' : '+';
            container.style.width = isMin ? '200px' : '130px';
            GM_setValue('is_minimized', !isMin);
        };

        if (CONFIG.IS_MINIMIZED) {
            container.style.width = '130px';
        }
    }

    function applyDarkMode(enabled) {
        const id = 'helper-dark-mode-style';
        let style = document.getElementById(id);
        if (enabled) {
            if (!style) {
                style = document.createElement('style');
                style.id = id;
                style.innerHTML = `
                    html { filter: invert(0.9) hue-rotate(180deg) !important; }
                    img, video, iframe, canvas { filter: invert(1.1) hue-rotate(180deg) !important; }
                `;
                document.head.appendChild(style);
            }
        } else if (style) {
            style.remove();
        }
    }

    // --- 入口初始化 ---
    function init() {
        createUI();
        applyDarkMode(GM_getValue('dark_mode', false));
        
        // 注册油猴菜单
        GM_registerMenuCommand('手动检查更新', () => checkUpdate(true));
        GM_registerMenuCommand('重置控制台位置', () => {
            GM_setValue('is_minimized', false);
            location.reload();
        });

        // 启动时自动检查更新 (受时间间隔限制)
        checkUpdate(false);
        Logger.info(`初始化完成，当前版本: ${CONFIG.CURRENT_VERSION}`);
    }

    // 等待 DOM 加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
