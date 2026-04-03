// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  支持远程 GitHub 更新、内置自定义 UI 通知、实时时钟、秒表及完整更新日志
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
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        CHANGELOG: [
            "v1.4.0: 新增实时时钟与秒表工具，增加更新日志展示板块。",
            "v1.3.1: 修复 GitHub 远程更新检测失败问题，增强抗缓存机制。",
            "v1.3.0: 移除系统原生通知，改用自定义 UI 通知悬浮框，新增密码生成与链接采集工具。",
            "v1.2.0: 脚本全界面汉化并优化 UI 设计。"
        ]
    };

    // --- 自定义通知系统 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 2100000; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;`;
            document.body.appendChild(this.container);
        },
        show(text, type = 'info', duration = 4000) {
            this.init();
            const toast = document.createElement('div');
            const colors = { info: '#007bff', success: '#28a745', warning: '#ffc107', error: '#dc3545' };
            toast.style.cssText = `
                margin-bottom: 10px; padding: 12px 18px; background: rgba(255, 255, 255, 0.98); color: #333;
                border-left: 5px solid ${colors[type] || colors.info}; border-radius: 12px;
                box-shadow: 0 10px 20px rgba(0,0,0,0.1); font-size: 13.5px; min-width: 180px; max-width: 320px;
                pointer-events: auto; opacity: 0; transform: translateY(-20px); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(8px);
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

    // --- 更新检测逻辑 ---
    function checkUpdate(isManual = false) {
        const lastCheck = GM_getValue('last_update_check', 0);
        const now = Date.now();
        if (!isManual && (now - lastCheck < CONFIG.AUTO_CHECK_INTERVAL)) return;
        if (isManual) Notify.show('正在连接 GitHub 服务器...', 'info');

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + now,
            headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
            timeout: 12000,
            onload: function(response) {
                GM_setValue('last_update_check', now);
                if (response.status === 200) {
                    const remoteMatch = response.responseText.match(/@version\s+([\d.]+)/i);
                    if (remoteMatch) {
                        const remoteV = remoteMatch[1];
                        if (isNewerVersion(remoteV, CONFIG.CURRENT_VERSION)) {
                            Notify.show(`🚀 发现重大更新: v${remoteV}`, 'success', 6000);
                            setTimeout(() => {
                                if (confirm(`【助手更新提醒】\n发现新版本: ${remoteV}\n当前本地版本: ${CONFIG.CURRENT_VERSION}\n\n是否打开下载页面同步变更？`)) {
                                    GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
                                }
                            }, 500);
                        } else if (isManual) Notify.show(`当前固件已是最新 (v${CONFIG.CURRENT_VERSION})`, 'success');
                    }
                } else if (isManual) Notify.show(`服务器响应异常: ${response.status}`, 'error');
            },
            onerror: () => isManual && Notify.show('网络请求失败', 'error')
        });
    }

    function isNewerVersion(r, c) {
        const rV = r.split('.').map(Number), cV = c.split('.').map(Number);
        for (let i = 0; i < Math.max(rV.length, cV.length); i++) {
            if ((rV[i] || 0) > (cV[i] || 0)) return true;
            if ((rV[i] || 0) < (cV[i] || 0)) return false;
        }
        return false;
    }

    // --- 实用工具模块 ---
    const Tools = {
        sw: { timer: null, time: 0, running: false }, 

        updateClock() {
            const clockEl = document.getElementById('helper-clock-dis');
            if (clockEl) clockEl.innerText = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        },

        toggleStopwatch() {
            const btn = document.getElementById('helper-sw-btn');
            const display = document.getElementById('helper-sw-dis');
            if (this.sw.running) {
                clearInterval(this.sw.timer);
                btn.innerText = '▶️ 继续'; btn.style.background = '#28a745';
                this.sw.running = false;
            } else {
                this.sw.timer = setInterval(() => {
                    this.sw.time += 1;
                    const s = Math.floor(this.sw.time / 10), ms = this.sw.time % 10;
                    display.innerText = `${s}.${ms}s`;
                }, 100);
                btn.innerText = '⏸ 暂停'; btn.style.background = '#ffc107';
                this.sw.running = true;
            }
        },

        resetStopwatch() {
            clearInterval(this.sw.timer);
            this.sw.time = 0; this.sw.running = false;
            document.getElementById('helper-sw-dis').innerText = '0.0s';
            document.getElementById('helper-sw-btn').innerText = '▶️ 开始';
            document.getElementById('helper-sw-btn').style.background = '#28a745';
        },

        generatePassword() {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let ret = "";
            for (let i = 0; i < 16; i++) ret += charset.charAt(Math.floor(Math.random() * charset.length));
            navigator.clipboard.writeText(ret).then(() => Notify.show(`已复制: ${ret}`, 'success'));
        },

        collectLinks() {
            const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(u => u.startsWith('http'));
            const unique = [...new Set(links)];
            if (unique.length === 0) return Notify.show('未采集到链接', 'warning');
            const blob = new Blob([unique.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `links_${location.hostname}.txt`; a.click();
            URL.revokeObjectURL(url);
            Notify.show(`成功提取 ${unique.length} 条链接`, 'success');
        }
    };

    // --- UI 渲染 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        root.style.cssText = `position: fixed; bottom: 30px; right: 30px; width: 230px; background: rgba(255, 255, 255, 0.95); border-radius: 20px; box-shadow: 0 15px 50px rgba(0,0,0,0.25); z-index: 1999999; font-family: sans-serif; overflow: hidden; transition: all 0.4s ease; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.4); user-select: none;`;

        const header = document.createElement('div');
        header.style.cssText = `padding: 16px 20px; background: linear-gradient(135deg, #007bff, #00d2ff); color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 14px;`;
        header.innerHTML = `<span>⚙️ 助手控制中心</span><span id="helper-toggle-icon">${CONFIG.IS_MINIMIZED ? '展开' : '折叠'}</span>`;
        
        const body = document.createElement('div');
        body.id = 'helper-ui-body';
        body.style.cssText = `padding: 16px; display: ${CONFIG.IS_MINIMIZED ? 'none' : 'block'}; max-height: 520px; overflow-y: auto;`;

        const section = (title) => {
            const div = document.createElement('div');
            div.style.cssText = `font-size: 11px; color: #888; margin: 12px 0 8px 2px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 3px;`;
            div.innerText = title; return div;
        };

        const createDiv = (css) => {
            const div = document.createElement('div');
            div.style.cssText = css; return div;
        };

        const createBtn = (text, onClick, color = '#6c757d', variant = 'solid') => {
            const btn = document.createElement('button');
            btn.innerText = text; btn.onclick = onClick;
            btn.style.cssText = `width: 100%; margin-bottom: 8px; padding: 10px; background: ${variant === 'solid' ? color : 'transparent'}; color: ${variant === 'solid' ? 'white' : color}; border: ${variant === 'solid' ? 'none' : `1px solid ${color}`}; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;`;
            btn.onmouseenter = () => btn.style.opacity = '0.85';
            btn.onmouseleave = () => btn.style.opacity = '1';
            return btn;
        };

        // 1. 时间显示
        body.appendChild(section('⏰ 当前时间'));
        const clockRow = createDiv(`text-align: center; font-size: 22px; font-weight: 900; color: #333; margin-bottom: 10px; font-family: monospace; letter-spacing: 1px;`);
        clockRow.id = 'helper-clock-dis';
        body.appendChild(clockRow);
        setInterval(Tools.updateClock, 1000);

        // 2. 秒表工具
        body.appendChild(section('⏱ 秒表小工具'));
        const swRow = createDiv(`display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; background: rgba(0,0,0,0.03); padding: 5px 10px; border-radius: 10px;`);
        const swDis = createDiv(`font-size: 16px; font-weight: bold; color: #28a745; width: 60px;`);
        swDis.id = 'helper-sw-dis'; swDis.innerText = '0.0s';
        const swBtn = createBtn('▶️ 开始', () => Tools.toggleStopwatch(), '#28a745');
        swBtn.id = 'helper-sw-btn'; swBtn.style.width = '70px'; swBtn.style.margin = '0';
        const swReset = createBtn('🔄', () => Tools.resetStopwatch(), '#dc3545');
        swReset.style.width = '35px'; swReset.style.margin = '0';
        swRow.appendChild(swDis); swRow.appendChild(swBtn); swRow.appendChild(swReset);
        body.appendChild(swRow);

        // 3. 实用工具
        body.appendChild(section('🔧 实用配置'));
        body.appendChild(createBtn('🔑 一键生成强密码', () => Tools.generatePassword(), '#17a2b8'));
        body.appendChild(createBtn('🌍 导出全站链接', () => Tools.collectLinks(), '#6610f2'));
        body.appendChild(createBtn('🔄 强制检测更新', () => checkUpdate(true), '#007bff'));

        // 4. 更新日志
        body.appendChild(section('📜 更新日志'));
        const logContent = createDiv(`font-size: 10px; color: #666; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 12px; line-height: 1.6; max-height: 120px; overflow-y: auto; text-align: left;`);
        logContent.innerText = CONFIG.CHANGELOG.join('\n\n');
        body.appendChild(logContent);

        // 5. 个性化
        body.appendChild(section('🎨 个性化设置'));
        body.appendChild(createBtn('🌘 切换暗黑模式', () => {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD); applyDarkMode(isD);
            Notify.show(isD ? '暗黑模式已激活' : '白天模式已恢复', 'info');
        }, '#495057', 'outline'));

        const footer = document.createElement('div');
        footer.style.cssText = `font-size: 10px; color: #bbb; text-align: center; margin-top: 15px;`;
        footer.innerText = `Stable v${CONFIG.CURRENT_VERSION} | Created with ❤️`;
        body.appendChild(footer);

        root.appendChild(header); root.appendChild(body); document.body.appendChild(root);

        header.onclick = () => {
            const isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            document.getElementById('helper-toggle-icon').innerText = isMin ? '折叠' : '展开';
            root.style.width = isMin ? '230px' : '150px';
            GM_setValue('is_minimized', !isMin);
        };
        if (CONFIG.IS_MINIMIZED) root.style.width = '150px';
    }

    function applyDarkMode(e) {
        const id = 'helper-dark-mode-style', el = document.getElementById(id);
        if (e) {
            if (!el) {
                const s = document.createElement('style'); s.id = id;
                s.innerHTML = `html { filter: invert(0.9) hue-rotate(180deg) !important; background: #111; } img, video, iframe, canvas { filter: invert(1.1) hue-rotate(180deg) !important; } #helper-ui-root, #helper-notify-container { filter: invert(1.1) hue-rotate(180deg) !important; }`;
                document.head.appendChild(s);
            }
        } else if (el) el.remove();
    }

    function init() {
        createUI(); applyDarkMode(GM_getValue('dark_mode', false));
        checkUpdate(false);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
