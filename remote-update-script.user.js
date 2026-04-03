// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.3.1
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
// @updateURL    https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// @downloadURL  https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置与常量 ---
    const CONFIG = {
        // 使用用户提供的原始链接，确保一致性
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        THEME_COLOR: '#007bff'
    };

    // --- 自定义通知系统 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 2000000; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;`;
            document.body.appendChild(this.container);
        },
        show(text, type = 'info', duration = 4000) {
            this.init();
            const toast = document.createElement('div');
            const colors = { info: '#007bff', success: '#28a745', warning: '#ffc107', error: '#dc3545' };
            toast.style.cssText = `
                margin-bottom: 10px; padding: 12px 20px; background: rgba(255, 255, 255, 0.98); color: #333;
                border-left: 5px solid ${colors[type] || colors.info}; border-radius: 10px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.12); font-size: 14px; min-width: 180px; max-width: 320px;
                pointer-events: auto; opacity: 0; transform: translateY(-20px); transition: all 0.4s ease; backdrop-filter: blur(8px);
            `;
            toast.innerText = text;
            this.container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
            setTimeout(() => {
                toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)';
                setTimeout(() => toast.remove(), 400);
            }, duration);
        }
    };

    // --- 更新检测逻辑优化 ---
    function checkUpdate(isManual = false) {
        const lastCheck = GM_getValue('last_update_check', 0);
        const now = Date.now();

        if (!isManual && (now - lastCheck < CONFIG.AUTO_CHECK_INTERVAL)) return;

        if (isManual) Notify.show('正在强制刷新并检查远程版本...', 'info');

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + now, // 彻底绕过缓存
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            },
            timeout: 15000, // 增加超时到15秒
            onload: function(response) {
                GM_setValue('last_update_check', now);
                if (response.status === 200) {
                    // 优化正则，支持混淆代码或复杂头部的版本提取
                    const remoteText = response.responseText;
                    const remoteMatch = remoteText.match(/@version\s+([\d.]+)/i);
                    
                    if (remoteMatch) {
                        const remoteV = remoteMatch[1];
                        console.log(`[助手] 远程版本: ${remoteV}, 本地版本: ${CONFIG.CURRENT_VERSION}`);
                        
                        if (isNewerVersion(remoteV, CONFIG.CURRENT_VERSION)) {
                            Notify.show(`🔥 发现新版本: v${remoteV}`, 'success', 6000);
                            setTimeout(() => {
                                if (confirm(`【更新提示】\n发现新版本: ${remoteV}\n当前版本: ${CONFIG.CURRENT_VERSION}\n\n检测到 GitHub 文件已变更，是否立即更新？`)) {
                                    GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
                                }
                            }, 500);
                        } else if (isManual) {
                            Notify.show(`当前已是最新 (v${CONFIG.CURRENT_VERSION})`, 'success');
                        }
                    } else {
                        if (isManual) Notify.show('解析失败：未在远程文件中找到版本号', 'error');
                    }
                } else {
                    if (isManual) Notify.show(`服务器响应异常: ${response.status}`, 'error');
                }
            },
            onerror: (err) => {
                console.error(err);
                if (isManual) Notify.show('网络连接失败 (GitHub 访问受限)', 'error');
            },
            ontimeout: () => {
                if (isManual) Notify.show('请求超时，GitHub 响应太慢', 'warning');
            }
        });
    }

    function isNewerVersion(r, c) {
        const rV = r.split('.').map(Number);
        const cV = c.split('.').map(Number);
        for (let i = 0; i < Math.max(rV.length, cV.length); i++) {
            const rvVal = rV[i] || 0;
            const cvVal = cV[i] || 0;
            if (rvVal > cvVal) return true;
            if (rvVal < cvVal) return false;
        }
        return false;
    }

    // --- 实用工具 ---
    const Tools = {
        generatePassword(length = 16) {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let retVal = "";
            for (let i = 0, n = charset.length; i < length; ++i) {
                retVal += charset.charAt(Math.floor(Math.random() * n));
            }
            navigator.clipboard.writeText(retVal).then(() => Notify.show(`已复制强密码: ${retVal}`, 'success'));
        },
        collectLinks() {
            const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(url => url.startsWith('http'));
            const uniqueLinks = [...new Set(links)];
            if (uniqueLinks.length === 0) return Notify.show('未发现有效链接', 'warning');
            const blob = new Blob([uniqueLinks.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `links_${location.hostname}.txt`; a.click();
            URL.revokeObjectURL(url);
            Notify.show(`已采集 ${uniqueLinks.length} 个链接`, 'success');
        }
    };

    // --- UI 界面 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        root.style.cssText = `position: fixed; bottom: 30px; right: 30px; width: 220px; background: rgba(255, 255, 255, 0.92); border-radius: 18px; box-shadow: 0 15px 45px rgba(0,0,0,0.22); z-index: 1999999; font-family: sans-serif; overflow: hidden; transition: all 0.4s ease; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.4); user-select: none;`;

        const header = document.createElement('div');
        header.style.cssText = `padding: 15px 20px; background: linear-gradient(135deg, #007bff, #00c6ff); color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: bold;`;
        header.innerHTML = `<span>⚙️ 助手控制中心</span><span id="helper-toggle-icon">${CONFIG.IS_MINIMIZED ? '展开' : '折叠'}</span>`;
        
        const body = document.createElement('div');
        body.id = 'helper-ui-body';
        body.style.cssText = `padding: 16px; display: ${CONFIG.IS_MINIMIZED ? 'none' : 'block'};`;

        const section = (title) => {
            const div = document.createElement('div');
            div.style.cssText = `font-size: 11px; color: #777; margin: 10px 0 6px 2px; text-transform: uppercase; letter-spacing: 1px;`;
            div.innerText = title; return div;
        };

        const createBtn = (text, onClick, color = '#007bff', variant = 'solid') => {
            const btn = document.createElement('button');
            btn.innerText = text; btn.onclick = onClick;
            btn.style.cssText = `width: 100%; margin-bottom: 10px; padding: 11px; background: ${variant === 'solid' ? color : 'transparent'}; color: ${variant === 'solid' ? 'white' : color}; border: ${variant === 'solid' ? 'none' : `1px dashed ${color}`}; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.2s;`;
            btn.onmouseenter = () => btn.style.transform = 'scale(1.02)';
            btn.onmouseleave = () => btn.style.transform = 'scale(1)';
            return btn;
        };

        body.appendChild(section('同步状态'));
        body.appendChild(createBtn('🔄 强制检测更新', () => checkUpdate(true)));
        
        body.appendChild(section('实用工具'));
        body.appendChild(createBtn('🔑 随机强密码', () => Tools.generatePassword(), '#28a745'));
        body.appendChild(createBtn('🌍 采集页面链接', () => Tools.collectLinks(), '#17a2b8'));
        
        body.appendChild(section('个性化'));
        body.appendChild(createBtn('🌘 护眼/暗黑模式', () => {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD); applyDarkMode(isD);
            Notify.show(isD ? '暗黑模式已启用' : '系统主题已恢复', isD ? 'info' : 'success');
        }, '#5a67d8', 'outline'));

        const footer = document.createElement('div');
        footer.style.cssText = `font-size: 10px; color: #aaa; text-align: center; margin-top: 15px;`;
        footer.innerText = `Stable v${CONFIG.CURRENT_VERSION} | gao1774420117`;
        body.appendChild(footer);

        root.appendChild(header); root.appendChild(body); document.body.appendChild(root);

        header.onclick = () => {
            const isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            document.getElementById('helper-toggle-icon').innerText = isMin ? '折叠' : '展开';
            root.style.width = isMin ? '220px' : '120px';
            GM_setValue('is_minimized', !isMin);
        };
        if (CONFIG.IS_MINIMIZED) root.style.width = '120px';
    }

    function applyDarkMode(enabled) {
        const id = 'helper-dark-mode-style';
        let style = document.getElementById(id);
        if (enabled) {
            if (!style) {
                style = document.createElement('style'); style.id = id;
                style.innerHTML = `
                    html { filter: invert(0.9) hue-rotate(180deg) !important; background: #111; }
                    img, video, iframe, canvas, [style*="background-image"] { filter: invert(1.1) hue-rotate(180deg) !important; }
                    #helper-ui-root, #helper-notify-container { filter: invert(1.1) hue-rotate(180deg) !important; }
                `;
                document.head.appendChild(style);
            }
        } else if (style) style.remove();
    }

    function init() {
        createUI();
        applyDarkMode(GM_getValue('dark_mode', false));
        checkUpdate(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
