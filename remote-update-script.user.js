// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  支持远程 GitHub 更新、内置控制面板、实时时钟、秒表、工具箱及详细维护日志 (Premium UI)
// @author       gao1774420117
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @connect      github.com
// @updateURL    https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// @downloadURL  https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 核心配置与状态管理 ---
    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        ACTIVE_TAB: 'tools', // 默认 Tab
        STATUS: 'secure', // secure | checking | outdated | error
        MAINTENANCE: {
            author: 'gao1774420117',
            status: '正常运行 (已接入 GitHub 自动化检查)',
            contact: 'GitHub / TapTap',
            info: '本项目旨在提供全方位的网页实用辅助与快速工具集成，通过 GitHub 保持实时维护与更新。'
        },
        CHANGELOG: [
            { v: '1.5.0', d: '2026/04/03', c: '全面重构 Premium UI，引入 Tab 导航、状态流转及详细维护菜单，消除滚动条。' },
            { v: '1.4.1', d: '2026/04/03', c: '优化更新检测链路，实现更新后物理层自动刷新方案。' },
            { v: '1.4.0', d: '2026/04/03', c: '整合实时时钟、精准秒表功能及初步日志板块。' },
            { v: '1.3.1', d: '2026/04/03', c: '绕过 GitHub CDN 缓存，修复远程更新无法检测问题。' }
        ]
    };

    // --- 样式引擎 (Premium UI) ---
    const UI_STYLES = `
        :root {
            --helper-bg: rgba(255, 255, 255, 0.88);
            --helper-blur: blur(16px);
            --helper-primary: linear-gradient(135deg, #6e8efb, #a777e3);
            --helper-secondary: #f8f9fa;
            --helper-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
            --helper-text: #2d3436;
            --helper-accent: #00cec9;
            --helper-success: #00b894;
            --helper-error: #d63031;
            --helper-warning: #fdcb6e;
        }

        #helper-ui-root {
            position: fixed; bottom: 30px; right: 30px; width: 280px;
            background: var(--helper-bg); border-radius: 24px; box-shadow: var(--helper-shadow);
            z-index: 1999999; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
            overflow: hidden; transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
            backdrop-filter: var(--helper-blur); border: 1px solid rgba(255, 255, 255, 0.4);
            user-select: none; color: var(--helper-text);
        }

        #helper-ui-root.minimized { width: 140px; }

        .helper-header {
            padding: 18px 20px; background: var(--helper-primary); color: white;
            cursor: pointer; display: flex; justify-content: space-between; align-items: center;
            font-weight: 700; font-size: 14px; position: relative;
        }

        .helper-status-dot {
            width: 8px; height: 8px; border-radius: 50%; display: inline-block;
            margin-right: 8px; transition: background 0.3s;
        }
        .status-secure { background: var(--helper-success); box-shadow: 0 0 10px var(--helper-success); }
        .status-checking { background: var(--helper-warning); animation: status-pulse 1s infinite; }
        .status-outdated { background: var(--helper-error); box-shadow: 0 0 10px var(--helper-error); }

        @keyframes status-pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .helper-tabs {
            display: flex; background: rgba(0,0,0,0.03); padding: 5px; margin: 0;
            overflow: hidden; justify-content: center;
        }

        .helper-tab-item {
            flex: 1; text-align: center; padding: 8px 0; font-size: 11px;
            cursor: pointer; transition: all 0.3s; color: #636e72; font-weight: 600;
            border-radius: 10px;
        }
        .helper-tab-item.active { background: white; color: #6e8efb; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }

        .helper-body { padding: 15px; display: block; min-height: 220px; }
        .tab-content { display: none; animation: fadeIn 0.3s ease; }
        .tab-content.active { display: block; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .helper-tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        
        .helper-card {
            background: white; border-radius: 12px; padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.02);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }

        .btn-premium {
            width: 100%; padding: 10px; border-radius: 12px; border: none;
            cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.3s;
            display: flex; align-items: center; justify-content: center; gap: 5px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.08); margin-top: 10px;
        }
        .btn-premium:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0,0,0,0.12); }
        .btn-primary { background: var(--helper-primary); color: white; }
        .btn-secondary { background: #f1f2f6; color: #2f3542; }

        #helper-clock-display { font-size: 18px; font-weight: 900; font-family: monospace; color: #2d3436; }
        
        .maintenance-info { font-size: 11px; line-height: 1.6; color: #636e72; }
        .maintenance-item { margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
        
        /* 隐藏滚动条但保留功能 */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;

    // --- 自定义通知系统 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 2200000; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;`;
            document.body.appendChild(this.container);
        },
        show(text, type = 'info', duration = 4000) {
            this.init();
            const toast = document.createElement('div');
            const colors = { info: '#6e8efb', success: '#00b894', warning: '#fdcb6e', error: '#d63031' };
            toast.style.cssText = `
                margin-bottom: 12px; padding: 14px 22px; background: rgba(255, 255, 255, 0.95); color: #2d3436;
                border-left: 6px solid ${colors[type] || colors.info}; border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600;
                pointer-events: auto; opacity: 0; transform: scale(0.8) translateY(-20px); transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(10px);
            `;
            toast.innerText = text;
            this.container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'scale(1) translateY(0)'; }, 10);
            setTimeout(() => {
                toast.style.opacity = '0'; toast.style.transform = 'scale(0.8) translateY(-20px)';
                setTimeout(() => toast.remove(), 500);
            }, duration);
        }
    };

    // --- 更新逻辑优化 ---
    function updateStatusUI(status) {
        CONFIG.STATUS = status;
        const dot = document.getElementById('helper-status-dot');
        const text = document.getElementById('helper-status-text');
        if (!dot || !text) return;
        
        dot.className = 'helper-status-dot';
        if (status === 'checking') {
            dot.classList.add('status-checking');
            text.innerText = '正在监测同步...';
        } else if (status === 'outdated') {
            dot.classList.add('status-outdated');
            text.innerText = '脚本待更新';
        } else {
            dot.classList.add('status-secure');
            text.innerText = '云端维护正常';
        }
    }

    function checkUpdate(isManual = false) {
        const lastCheck = GM_getValue('last_update_check', 0);
        const now = Date.now();
        if (!isManual && (now - lastCheck < CONFIG.AUTO_CHECK_INTERVAL)) return;

        updateStatusUI('checking');
        if (isManual) Notify.show('⚡ 正在请求 GitHub 维护镜像...', 'info');

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + now,
            headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
            timeout: 10000,
            onload: function(response) {
                GM_setValue('last_update_check', now);
                if (response.status === 200) {
                    const remoteMatch = response.responseText.match(/@version\s+([\d.]+)/i);
                    if (remoteMatch) {
                        const remoteV = remoteMatch[1];
                        if (isNewerVersion(remoteV, CONFIG.CURRENT_VERSION)) {
                            updateStatusUI('outdated');
                            setTimeout(() => {
                                if (confirm(`🔥 发现新版本: v${remoteV}\n当前本地版本: ${CONFIG.CURRENT_VERSION}\n\n是否立即前往 GitHub 同步最新维护补丁？`)) {
                                    GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true });
                                }
                            }, 500);
                        } else {
                            updateStatusUI('secure');
                            if (isManual) Notify.show('您的脚本已处于最佳运行状态', 'success');
                        }
                    }
                } else {
                    updateStatusUI('secure');
                    if (isManual) Notify.show('访问仓库失败，请检查网络环境', 'error');
                }
            },
            onerror: () => { updateStatusUI('secure'); if (isManual) Notify.show('连接被拒绝，可能是代理错误', 'error'); }
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

    // --- 实用工具集成 ---
    const Tools = {
        sw: { timer: null, time: 0, running: false },

        updateClock() {
            const el = document.getElementById('helper-clock-display');
            if (el) el.innerText = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        },

        toggleStopwatch() {
            const btn = document.getElementById('helper-sw-btn');
            const dis = document.getElementById('helper-sw-display');
            if (this.sw.running) {
                clearInterval(this.sw.timer);
                btn.innerText = '开始'; btn.style.background = '#00b894';
                this.sw.running = false;
            } else {
                this.sw.timer = setInterval(() => {
                    this.sw.time += 1;
                    const s = Math.floor(this.sw.time / 10), ms = this.sw.time % 10;
                    if (dis) dis.innerText = `${s}.${ms}s`;
                }, 100);
                btn.innerText = '暂停'; btn.style.background = '#fdcb6e';
                this.sw.running = true;
            }
        },

        resetStopwatch() {
            clearInterval(this.sw.timer);
            this.sw.time = 0; this.sw.running = false;
            if (document.getElementById('helper-sw-display')) document.getElementById('helper-sw-display').innerText = '0.0s';
            if (document.getElementById('helper-sw-btn')) {
                document.getElementById('helper-sw-btn').innerText = '开始';
                document.getElementById('helper-sw-btn').style.background = '#00b894';
            }
        }
    };

    // --- Tab 渲染策略 ---
    function renderTab(tabName) {
        CONFIG.ACTIVE_TAB = tabName;
        document.querySelectorAll('.helper-tab-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.helper-tab-item[data-tab="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }

    // --- UI 构建主函数 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        GM_addStyle(UI_STYLES);

        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        if (CONFIG.IS_MINIMIZED) root.classList.add('minimized');

        // 头部与状态
        const header = document.createElement('div');
        header.className = 'helper-header';
        header.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span id="helper-status-dot" class="helper-status-dot status-secure"></span>
                <span id="helper-status-text">助手中心</span>
            </div>
            <span id="helper-toggle-icon" style="font-size:12px;">${CONFIG.IS_MINIMIZED ? '展开' : '折叠'}</span>
        `;

        // Tab 导航
        const tabs = document.createElement('div');
        tabs.className = 'helper-tabs';
        tabs.innerHTML = `
            <div class="helper-tab-item active" data-tab="tools">辅助工具</div>
            <div class="helper-tab-item" data-tab="settings">个性化</div>
            <div class="helper-tab-item" data-tab="about">维护关于</div>
        `;

        // 主体容器
        const body = document.createElement('div');
        body.className = 'helper-body';
        body.style.display = CONFIG.IS_MINIMIZED ? 'none' : 'block';

        // 1. 工具 Tab
        const tabTools = document.createElement('div');
        tabTools.id = 'tab-tools';
        tabTools.className = 'tab-content active';
        tabTools.innerHTML = `
            <div class="helper-tools-grid">
                <div class="helper-card">
                    <div style="font-size:10px;color:#aaa;margin-bottom:5px;">🕒 实时时间</div>
                    <div id="helper-clock-display">00:00:00</div>
                </div>
                <div class="helper-card">
                    <div style="font-size:10px;color:#aaa;margin-bottom:5px;">⏱ 精准秒表</div>
                    <div id="helper-sw-display" style="font-weight:bold;">0.0s</div>
                    <div style="display:flex;gap:5px;width:100%;margin-top:5px;">
                         <button id="helper-sw-btn" class="btn-premium btn-primary" style="padding:4px;background:#00b894;margin:0">开始</button>
                         <button id="helper-sw-reset" class="btn-premium btn-secondary" style="padding:4px;margin:0">重置</button>
                    </div>
                </div>
            </div>
            <button id="btn-pw" class="btn-premium btn-primary">🔑 生成强密码并复制</button>
            <button id="btn-links" class="btn-premium btn-secondary" style="margin-top:8px">🌍 导出全站链接 (.txt)</button>
        `;

        // 2. 设置 Tab
        const tabSettings = document.createElement('div');
        tabSettings.id = 'tab-settings';
        tabSettings.className = 'tab-content';
        tabSettings.innerHTML = `
            <div class="helper-card" style="align-items:flex-start;">
                <div style="font-weight:bold;font-size:12px;margin-bottom:10px;">🎨 视觉配置</div>
                <button id="btn-dark" class="btn-premium btn-secondary" style="margin:0;margin-bottom:10px">◑ 切换暗黑模式 (全局抗色反)</button>
                <div style="font-size:10px;color:#999;">更多个性化选项正在开发中...</div>
            </div>
            <button id="btn-force-upd" class="btn-premium btn-primary" style="margin-top:20px;background:#6e8efb;">🔄 强制触发云端同步检测</button>
        `;

        // 3. 关于 Tab (详细维护信息)
        const tabAbout = document.createElement('div');
        tabAbout.id = 'tab-about';
        tabAbout.className = 'tab-content';
        
        let changelogHtml = CONFIG.CHANGELOG.map(l => `<div style="margin-bottom:5px;"><b>${l.v}</b>: ${l.c}</div>`).join('');
        
        tabAbout.innerHTML = `
            <div class="maintenance-info">
                <div class="maintenance-item">
                    <span style="font-weight:bold;">👨‍💻 维护作者:</span> ${CONFIG.MAINTENANCE.author}
                </div>
                <div class="maintenance-item">
                    <span style="font-weight:bold;">📡 维护状态:</span> ${CONFIG.MAINTENANCE.status}
                </div>
                <div class="maintenance-item">
                    <span style="font-weight:bold;">⚙️ 核心版本:</span> v${CONFIG.CURRENT_VERSION} Stable
                </div>
                <div class="maintenance-item" style="border:none;">
                    <span style="font-weight:bold;">ℹ️ 项目简介:</span><br/>
                    ${CONFIG.MAINTENANCE.info}
                </div>
                <div style="margin-top:10px;font-weight:bold;color:#6e8efb;">📄 近期更新日志:</div>
                <div style="font-size:10px;color:#999;max-height:80px;overflow-y:auto;background:rgba(0,0,0,0.03);padding:8px;border-radius:10px;margin-top:5px;" class="no-scrollbar">
                    ${changelogHtml}
                </div>
                <button id="btn-repo" class="btn-premium btn-primary" style="margin-top:10px;background:rgba(0,0,0,0.05);color:#555;box-shadow:none;">📂 访问 GitHub 源码库</button>
            </div>
        `;

        body.appendChild(tabTools);
        body.appendChild(tabSettings);
        body.appendChild(tabAbout);
        root.appendChild(header);
        root.appendChild(tabs);
        root.appendChild(body);
        document.body.appendChild(root);

        // --- 事件绑定 ---
        header.onclick = (e) => {
            if (e.target.closest('.helper-tab-item')) return;
            const isMin = root.classList.contains('minimized');
            if (isMin) {
                root.classList.remove('minimized');
                body.style.display = 'block';
                tabs.style.display = 'flex';
                document.getElementById('helper-toggle-icon').innerText = '折叠';
            } else {
                root.classList.add('minimized');
                body.style.display = 'none';
                tabs.style.display = 'none';
                document.getElementById('helper-toggle-icon').innerText = '展开';
            }
            GM_setValue('is_minimized', !isMin);
        };

        tabs.onclick = (e) => {
            const tabEl = e.target.closest('.helper-tab-item');
            if (tabEl) renderTab(tabEl.dataset.tab);
        };

        // 功能触发
        document.getElementById('helper-sw-btn').onclick = () => Tools.toggleStopwatch();
        document.getElementById('helper-sw-reset').onclick = () => Tools.resetStopwatch();
        document.getElementById('btn-pw').onclick = () => {
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let ret = ""; for (let i = 0; i < 16; i++) ret += charset.charAt(Math.floor(Math.random() * charset.length));
            navigator.clipboard.writeText(ret).then(() => Notify.show(`强密码已复制: ${ret}`, 'success'));
        };
        document.getElementById('btn-links').onclick = () => {
            const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(u => u.startsWith('http'));
            const unique = [...new Set(links)];
            if (unique.length === 0) return Notify.show('未采集到链接', 'warning');
            const blob = new Blob([unique.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `links_${location.hostname}.txt`; a.click();
            URL.revokeObjectURL(url);
            Notify.show(`成功提取 ${unique.length} 条链接`, 'success');
        };
        document.getElementById('btn-dark').onclick = () => {
             const isD = !GM_getValue('dark_mode', false);
             GM_setValue('dark_mode', isD); applyDarkMode(isD);
             Notify.show(isD ? '暗黑模式已激活' : '已切回常规模式', 'info');
        };
        document.getElementById('btn-force-upd').onclick = () => checkUpdate(true);
        document.getElementById('btn-repo').onclick = () => GM_openInTab(CONFIG.REPO_URL, { active: true });

        // 启动时钟
        setInterval(Tools.updateClock, 1000);
    }

    function applyDarkMode(e) {
        const id = 'helper-dark-mode-style', el = document.getElementById(id);
        if (e) {
            if (!el) {
                const s = document.createElement('style'); s.id = id;
                s.innerHTML = `html { filter: invert(0.95) hue-rotate(180deg) !important; background: #000; } img, video, iframe, canvas, [style*="background-image"] { filter: invert(1.05) hue-rotate(180deg) !important; } #helper-ui-root, #helper-notify-container { filter: invert(1.05) hue-rotate(180deg) !important; }`;
                document.head.appendChild(s);
            }
        } else if (el) el.remove();
    }

    // --- 入口初始化 ---
    function init() {
        const lastKnownV = GM_getValue('last_known_version', null);
        const currentV = CONFIG.CURRENT_VERSION;

        if (lastKnownV && isNewerVersion(currentV, lastKnownV)) {
            Notify.show(`🎉 系统升级成功！新内核 v${currentV} 已就绪，正在准备环境...`, 'success', 5000);
            GM_setValue('last_known_version', currentV);
            setTimeout(() => { location.reload(true); }, 1500);
            return;
        }
        
        GM_setValue('last_known_version', currentV);
        createUI();
        applyDarkMode(GM_getValue('dark_mode', false));
        
        GM_registerMenuCommand('🔄 一键检测全站更新', () => checkUpdate(true));
        GM_registerMenuCommand('🔧 强制重置面板状态', () => { GM_setValue('is_minimized', false); location.reload(); });

        checkUpdate(false);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
