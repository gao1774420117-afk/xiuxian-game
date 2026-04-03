// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  支持远程 GitHub 更新、内置自定义 UI 通知、实用小工具（及密码生成、链接采集）
// @author       YourName
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
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
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        THEME_COLOR: '#007bff'
    };

    // --- 自定义通知系统 (不调用系统原生) ---
    const Notify = {
        container: null,

        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000000;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        },

        show(text, type = 'info', duration = 3500) {
            this.init();
            const toast = document.createElement('div');
            const colors = {
                info: '#007bff',
                success: '#28a745',
                warning: '#ffc107',
                error: '#dc3545'
            };
            
            toast.style.cssText = `
                margin-bottom: 10px;
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.95);
                color: #333;
                border-left: 5px solid ${colors[type] || colors.info};
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.15);
                font-family: inherit;
                font-size: 14px;
                min-width: 150px;
                max-width: 300px;
                pointer-events: auto;
                opacity: 0;
                transform: translateX(50px);
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                backdrop-filter: blur(5px);
            `;
            toast.innerText = text;
            
            this.container.appendChild(toast);
            
            // 进场动画
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);
            
            // 自动移除
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(50px)';
                setTimeout(() => toast.remove(), 400);
            }, duration);
        }
    };

    // --- 更新检测逻辑 ---
    function checkUpdate(isManual = false) {
        const lastCheck = GM_getValue('last_update_check', 0);
        const now = Date.now();

        if (!isManual && (now - lastCheck < CONFIG.AUTO_CHECK_INTERVAL)) return;

        if (isManual) Notify.show('正在检查云端版本...', 'info');

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + now,
            timeout: 8000,
            onload: function(response) {
                GM_setValue('last_update_check', now);
                if (response.status === 200) {
                    const remoteMatch = response.responseText.match(/@version\s+([\d.]+)/);
                    if (remoteMatch) {
                        const remoteV = remoteMatch[1];
                        if (isNewerVersion(remoteV, CONFIG.CURRENT_VERSION)) {
                            Notify.show(`发现新版本 v${remoteV}，正在为您准备更新...`, 'success');
                            setTimeout(() => {
                                if (confirm(`发现新版本: ${remoteV}\n当前版本: ${CONFIG.CURRENT_VERSION}\n\n是否打开下载页面？`)) {
                                    GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
                                }
                            }, 1000);
                        } else if (isManual) {
                            Notify.show('当前已是最新版本', 'success');
                        }
                    }
                } else if (isManual) {
                    Notify.show('更新检查失败: 无法访问资源', 'error');
                }
            },
            onerror: () => isManual && Notify.show('网络连接异常', 'error'),
            ontimeout: () => isManual && Notify.show('连接超时，请重试', 'warning')
        });
    }

    function isNewerVersion(r, c) {
        const rV = r.split('.').map(Number);
        const cV = c.split('.').map(Number);
        for (let i = 0; i < Math.max(rV.length, cV.length); i++) {
            if ((rV[i] || 0) > (cV[i] || 0)) return true;
            if ((rV[i] || 0) < (cV[i] || 0)) return false;
        }
        return false;
    }

    // --- 实用小工具逻辑 ---
    const Tools = {
        // 随机密码生成器
        generatePassword(length = 16) {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let retVal = "";
            for (let i = 0, n = charset.length; i < length; ++i) {
                retVal += charset.charAt(Math.floor(Math.random() * n));
            }
            navigator.clipboard.writeText(retVal).then(() => {
                Notify.show(`生成成功并复制到剪贴板: ${retVal}`, 'success');
            });
        },
        
        // 链接采集器
        collectLinks() {
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(url => url.startsWith('http'));
            const uniqueLinks = [...new Set(links)];
            if (uniqueLinks.length === 0) {
                Notify.show('当前页面未发现有效链接', 'warning');
                return;
            }
            const blob = new Blob([uniqueLinks.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `links_${location.hostname}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            Notify.show(`采集完成！共提取 ${uniqueLinks.length} 个唯一链接`, 'success');
        }
    };

    // --- UI 界面 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;

        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        root.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 220px;
            background: rgba(255, 255, 255, 0.85);
            border-radius: 16px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.18);
            z-index: 999999;
            font-family: inherit;
            overflow: hidden;
            transition: all 0.4s ease;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.3);
            user-select: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 14px 18px;
            background: linear-gradient(135deg, #007bff, #00a2ff);
            color: white;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            letter-spacing: 0.5px;
        `;
        header.innerHTML = `<span>🛠️ 工具助手</span><span id="helper-toggle-icon">${CONFIG.IS_MINIMIZED ? '展开' : '折叠'}</span>`;
        
        const body = document.createElement('div');
        body.id = 'helper-ui-body';
        body.style.cssText = `padding: 12px 16px; display: ${CONFIG.IS_MINIMIZED ? 'none' : 'block'};`;

        const section = (title) => {
            const div = document.createElement('div');
            div.style.cssText = `font-size: 11px; color: #666; margin: 8px 0 5px 2px; font-weight: bold;`;
            div.innerText = title;
            return div;
        };

        const createBtn = (text, onClick, color = '#007bff', variant = 'solid') => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.onclick = onClick;
            btn.style.cssText = `
                width: 100%;
                margin-bottom: 8px;
                padding: 10px;
                background: ${variant === 'solid' ? color : 'transparent'};
                color: ${variant === 'solid' ? 'white' : color};
                border: ${variant === 'solid' ? 'none' : `1px solid ${color}`};
                border-radius: 10px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s;
            `;
            btn.onmouseenter = () => btn.style.filter = 'brightness(1.1)';
            btn.onmouseleave = () => btn.style.filter = 'none';
            return btn;
        };

        body.appendChild(section('📦 核心功能'));
        body.appendChild(createBtn('🚀 检查更新', () => checkUpdate(true)));
        
        body.appendChild(section('🔧 实用工具'));
        body.appendChild(createBtn('🔑 生成强密码', () => Tools.generatePassword(), '#28a745'));
        body.appendChild(createBtn('🔗 采集页面链接', () => Tools.collectLinks(), '#17a2b8'));
        
        body.appendChild(section('🎨 界面设置'));
        body.appendChild(createBtn('🌓 护眼模式开关', () => {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD);
            applyDarkMode(isD);
            Notify.show(isD ? '护眼模式开启' : '护眼模式关闭', 'info');
        }, '#4a5568', 'outline'));

        const footer = document.createElement('div');
        footer.style.cssText = `font-size: 10px; color: #999; text-align: center; margin-top: 10px;`;
        footer.innerText = `v${CONFIG.CURRENT_VERSION} | Created with ❤️`;
        body.appendChild(footer);

        root.appendChild(header);
        root.appendChild(body);
        document.body.appendChild(root);

        header.onclick = () => {
            const isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            document.getElementById('helper-toggle-icon').innerText = isMin ? '折叠' : '展开';
            root.style.width = isMin ? '220px' : '100px';
            GM_setValue('is_minimized', !isMin);
        };

        if (CONFIG.IS_MINIMIZED) {
            root.style.width = '100px';
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
                    html { filter: invert(0.9) hue-rotate(180deg) !important; background: #000; }
                    img, video, iframe, canvas, [style*="background-image"] { filter: invert(1.1) hue-rotate(180deg) !important; }
                    #helper-ui-root { filter: invert(1.1) hue-rotate(180deg) !important; }
                    #helper-notify-container { filter: invert(1.1) hue-rotate(180deg) !important; }
                `;
                document.head.appendChild(style);
            }
        } else if (style) {
            style.remove();
        }
    }

    function init() {
        createUI();
        applyDarkMode(GM_getValue('dark_mode', false));
        checkUpdate(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
