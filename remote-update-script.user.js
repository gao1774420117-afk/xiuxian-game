// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.6.0
// @description  支持远程 GitHub 更新、内置控制面板、工具箱、随手贴、二维码及图片采集 (Premium UI)
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
// @connect      api.qrserver.com
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
        ACTIVE_TAB: 'tools',
        STATUS: 'secure',
        MAINTENANCE: {
            author: 'gao1774420117',
            status: '维护中 (v1.6.0 增强版已上线)',
            info: '本项目旨在提供全方位的网页实用辅助与快速工具集成。'
        },
        CHANGELOG: [
            { v: '1.6.0', d: '2026/04/03', c: '新增：网页随手贴、URL 二维码生成、万能图片采集系统；优化：助手 UI 网格布局。' },
            { v: '1.5.0', d: '2026/04/03', c: '全面重构 Premium UI，引入 Tab 导航、状态流转及详细维护菜单。' },
            { v: '1.4.1', d: '2026/04/03', c: '优化更新检测链路，实现更新后物理层自动刷新方案。' }
        ]
    };

    // --- 样式引擎 ---
    const UI_STYLES = `
        :root {
            --helper-bg: rgba(255, 255, 255, 0.9);
            --helper-blur: blur(20px);
            --helper-primary: linear-gradient(135deg, #6e8efb, #a777e3);
            --helper-shadow: 0 15px 45px rgba(0, 0, 0, 0.18);
            --helper-text: #2d3436;
            --helper-success: #00b894;
            --helper-error: #d63031;
            --helper-warning: #fdcb6e;
        }

        #helper-ui-root {
            position: fixed; bottom: 30px; right: 30px; width: 280px;
            background: var(--helper-bg); border-radius: 28px; box-shadow: var(--helper-shadow);
            z-index: 1999999; font-family: -apple-system, sans-serif;
            overflow: hidden; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1);
            backdrop-filter: var(--helper-blur); border: 1px solid rgba(255, 255, 255, 0.5);
            user-select: none; color: var(--helper-text);
        }

        #helper-ui-root.minimized { width: 140px; }

        .helper-header { padding: 18px 20px; background: var(--helper-primary); color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 14px; }
        .helper-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-secure { background: var(--helper-success); box-shadow: 0 0 15px var(--helper-success); }
        .status-checking { background: var(--helper-warning); animation: pulse 1s infinite; }
        .status-outdated { background: var(--helper-error); box-shadow: 0 0 15px var(--helper-error); }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .helper-tabs { display: flex; background: rgba(0,0,0,0.04); padding: 6px; }
        .helper-tab-item { flex: 1; text-align: center; padding: 10px 0; font-size: 11px; cursor: pointer; transition: 0.3s; color: #636e72; font-weight: bold; border-radius: 12px; }
        .helper-tab-item.active { background: white; color: #6e8efb; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

        .helper-body { padding: 16px; min-height: 250px; }
        .tab-content { display: none; animation: fadeIn 0.4s ease; }
        .tab-content.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .helper-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
        .helper-card { background: white; border-radius: 16px; padding: 14px; box-shadow: 0 5px 15px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,0.03); }

        .btn-action { width: 100%; padding: 12px; border-radius: 14px; border: none; cursor: pointer; font-size: 11px; font-weight: 800; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 10px; }
        .btn-action:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
        .btn-p { background: var(--helper-primary); color: white; }
        .btn-s { background: #f1f2f6; color: #2f3542; }

        /* 随手贴样式 */
        #helper-sticky-note {
            position: fixed; top: 100px; left: 20px; width: 180px; height: 180px;
            background: rgba(255, 243, 176, 0.9); border-radius: 15px; box-shadow: 5px 5px 25px rgba(0,0,0,0.1);
            z-index: 1888888; padding: 15px; display: none; backdrop-filter: blur(5px);
            border: 1px solid rgba(0,0,0,0.05); cursor: move;
        }
        #helper-sticky-note textarea {
            width: 100%; height: 100%; background: transparent; border: none; outline: none;
            resize: none; font-family: "Microsoft YaHei", sans-serif; font-size: 13px; color: #57606f; line-height: 1.5;
        }

        /* 遮罩层 Overlay */
        .helper-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
            z-index: 3000000; display: none; align-items: center; justify-content: center;
        }
        .overlay-content {
            background: white; border-radius: 28px; padding: 25px;
            max-width: 85%; max-height: 85%; overflow-y: auto; text-align: center;
            box-shadow: 0 25px 60px rgba(0,0,0,0.3);
        }
        .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px; margin-top: 20px; }
        .img-item { width: 100%; height: 100px; object-fit: cover; border-radius: 12px; cursor: pointer; transition: 0.3s; border: 2px solid transparent; }
        .img-item:hover { transform: scale(1.05); border-color: #6e8efb; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
    `;

    // --- 通用通知 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `position: fixed; top: 25px; right: 25px; z-index: 9999999; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;`;
            document.body.appendChild(this.container);
        },
        show(text, type = 'info') {
            this.init();
            const toast = document.createElement('div');
            const colors = { info: '#6e8efb', success: '#00b894', warning: '#fdcb6e', error: '#d63031' };
            toast.style.cssText = `
                margin-bottom: 12px; padding: 14px 22px; background: rgba(255, 255, 255, 0.98); color: #2d3436;
                border-left: 6px solid ${colors[type] || colors.info}; border-radius: 18px;
                box-shadow: 0 12px 25px rgba(0,0,0,0.1); font-size: 13px; font-weight: 800;
                pointer-events: auto; opacity: 0; transform: translateY(-20px); transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;
            toast.innerText = text;
            this.container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 400); }, 3500);
        }
    };

    // --- 核心工具模块 ---
    const Tools = {
        sw: { timer: null, time: 0, running: false },

        // 1. 随手贴 (Sticky Notes)
        initSticky() {
            if (document.getElementById('helper-sticky-note')) return;
            const note = document.createElement('div');
            note.id = 'helper-sticky-note';
            note.innerHTML = `<textarea placeholder="在此输入随手记内容..."></textarea>`;
            document.body.appendChild(note);

            const textarea = note.querySelector('textarea');
            const savedNote = GM_getValue(`note_${location.hostname}`, '');
            textarea.value = savedNote;

            textarea.oninput = () => {
                GM_setValue(`note_${location.hostname}`, textarea.value);
            };

            // 简易拖拽
            let isDown = false, offset = [0,0];
            note.onmousedown = (e) => {
                if (e.target === textarea) return;
                isDown = true;
                offset = [note.offsetLeft - e.clientX, note.offsetTop - e.clientY];
            };
            document.onmousemove = (e) => {
                if (!isDown) return;
                note.style.left = (e.clientX + offset[0]) + 'px';
                note.style.top = (e.clientY + offset[1]) + 'px';
            };
            document.onmouseup = () => { isDown = false; };
        },

        toggleSticky() {
            this.initSticky();
            const note = document.getElementById('helper-sticky-note');
            const isVisible = note.style.display === 'block';
            note.style.display = isVisible ? 'none' : 'block';
            Notify.show(isVisible ? '随手贴已收起' : '随手贴已挂载', 'info');
        },

        // 2. 二维码生成 (QR Code)
        generateQR() {
            const overlay = document.getElementById('helper-qr-overlay');
            const qrImg = document.getElementById('helper-qr-img');
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(location.href)}`;
            qrImg.src = url;
            overlay.style.display = 'flex';
            Notify.show('二维码已生成', 'success');
        },

        // 3. 万能图片采集 (Image Collector)
        collectImages() {
            Notify.show('正在扫描页面媒体资源...', 'info');
            const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src).filter(src => src && src.startsWith('http'));
            
            // 扫描背景图
            const allElements = document.querySelectorAll('*');
            const bgImgs = [];
            allElements.forEach(el => {
                const bg = window.getComputedStyle(el).backgroundImage;
                if (bg && bg !== 'none' && bg.includes('url("')) {
                    const url = bg.match(/url\("(.+)"\)/)[1];
                    if (url.startsWith('http')) bgImgs.push(url);
                }
            });

            const allFound = [...new Set([...imgs, ...bgImgs])];
            const filtered = allFound.filter(src => src.length < 2000); // 过滤超长 Base64 或异常链接

            if (filtered.length === 0) return Notify.show('未发现可采集的图片', 'warning');

            const overlay = document.getElementById('helper-img-overlay');
            const grid = overlay.querySelector('.img-grid');
            grid.innerHTML = '';
            filtered.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'img-item';
                img.onclick = () => window.open(src);
                grid.appendChild(img);
            });
            overlay.querySelector('.img-count').innerText = `采集到 ${filtered.length} 张图片`;
            overlay.style.display = 'flex';
        },

        // 时钟/秒表
        updateClock() {
            const el = document.getElementById('helper-clock-dis');
            if (el) el.innerText = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        },
        toggleSW() {
            const btn = document.getElementById('helper-sw-btn');
            const dis = document.getElementById('helper-sw-dis');
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
        }
    };

    // --- UI 系统 ---
    function renderTab(tab) {
        document.querySelectorAll('.helper-tab-item').forEach(e => e.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
    }

    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        GM_addStyle(UI_STYLES);

        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        if (CONFIG.IS_MINIMIZED) root.classList.add('minimized');

        header: {
            const header = document.createElement('div');
            header.className = 'helper-header';
            header.innerHTML = `<div style="display:flex;align-items:center;"><span id="helper-dot" class="helper-status-dot status-secure"></span><span>脚本助手中心</span></div><span id="helper-toggle">${CONFIG.IS_MINIMIZED ? '展开' : '折叠'}</span>`;
            root.appendChild(header);
            header.onclick = (e) => {
                if (e.target.closest('.helper-tab-item')) return;
                const min = root.classList.toggle('minimized');
                body.style.display = min ? 'none' : 'block';
                tabs.style.display = min ? 'none' : 'flex';
                document.getElementById('helper-toggle').innerText = min ? '展开' : '折叠';
                GM_setValue('is_minimized', min);
            };
        }

        const tabs = document.createElement('div');
        tabs.className = 'helper-tabs';
        tabs.style.display = CONFIG.IS_MINIMIZED ? 'none' : 'flex';
        tabs.innerHTML = `<div class="helper-tab-item active" data-tab="tools">辅助增强</div><div class="helper-tab-item" data-tab="about">版本维护</div>`;
        tabs.onclick = (e) => { const itm = e.target.closest('.helper-tab-item'); if(itm) renderTab(itm.dataset.tab); };
        root.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'helper-body';
        body.style.display = CONFIG.IS_MINIMIZED ? 'none' : 'block';

        const tabTools = document.createElement('div');
        tabTools.id = 'tab-tools'; tabTools.className = 'tab-content active';
        tabTools.innerHTML = `
            <div class="helper-grid">
                <div class="helper-card"><div style="font-size:9px;color:#aaa;">TIME</div><div id="helper-clock-dis" style="font-weight:900;font-size:16px;">--:--:--</div></div>
                <div class="helper-card"><div style="font-size:9px;color:#aaa;">STOPWATCH</div><div id="helper-sw-dis" style="font-weight:bold;font-size:14px;color:#00b894;">0.0s</div>
                    <div style="display:flex;gap:4px;margin-top:4px;"><button id="sw-btn" style="padding:2px 8px;border:none;border-radius:6px;background:#00b894;color:white;font-size:10px;cursor:pointer;">开始</button><button id="sw-rst" style="padding:2px 8px;border:none;border-radius:6px;background:#eee;font-size:10px;cursor:pointer;">清空</button></div>
                </div>
            </div>
            <button id="btn-sticky" class="btn-action btn-p">📋 开启/关闭网页随手贴</button>
            <button id="btn-qr" class="btn-action btn-s">📱 生成当前页二维码</button>
            <button id="btn-collect" class="btn-action btn-p" style="background:#6e8efb">🖼️ 万能图片采集卡</button>
            <button id="btn-copy-links" class="btn-action btn-s">🔗 导出全站链接 (.txt)</button>
        `;

        const tabAbout = document.createElement('div');
        tabAbout.id = 'tab-about'; tabAbout.className = 'tab-content';
        tabAbout.innerHTML = `
            <div style="font-size:11px;color:#636e72;">
                <div style="margin-bottom:8px;border-bottom:1px dashed #eee;padding-bottom:5px;"><b>维护者:</b> ${CONFIG.MAINTENANCE.author}</div>
                <div style="margin-bottom:8px;border-bottom:1px dashed #eee;padding-bottom:5px;"><b>状态:</b> ${CONFIG.MAINTENANCE.status}</div>
                <div style="margin-bottom:8px;background:rgba(0,0,0,0.04);padding:10px;border-radius:12px;"><b>日志:</b><br/><div class="no-scrollbar" style="max-height:80px;overflow-y:auto;margin-top:5px;">${CONFIG.CHANGELOG.map(l=>`• <b>v${l.v}</b>: ${l.c}<br/>`).join('')}</div></div>
                <button id="btn-force-chk" class="btn-action btn-p" style="background:#5a67d8;">🔄 强制云端维护检测</button>
            </div>
        `;

        body.appendChild(tabTools); body.appendChild(tabAbout);
        root.appendChild(body);
        document.body.appendChild(root);

        // 初始化 Overlays
        const overlays = document.createElement('div');
        overlays.innerHTML = `
            <div id="helper-qr-overlay" class="helper-overlay"><div class="overlay-content"><h3>网页二维码</h3><img id="helper-qr-img" style="border:10px solid white;border-radius:8px;margin:20px 0;"><p style="font-size:12px;color:#888;">右键图片可另存为</p><button class="btn-action btn-p" style="margin-top:20px;" onclick="this.closest('.helper-overlay').style.display='none'">关闭</button></div></div>
            <div id="helper-img-overlay" class="helper-overlay"><div class="overlay-content"><h3>图片采集卡</h3><div class="img-count" style="font-size:12px;color:#6e8efb;margin-bottom:10px;"></div><div class="img-grid no-scrollbar"></div><button class="btn-action btn-p" style="margin-top:30px;" onclick="this.closest('.helper-overlay').style.display='none'">关闭窗口</button></div></div>
        `;
        document.body.appendChild(overlays);

        // 事件绑定
        document.getElementById('btn-sticky').onclick = () => Tools.toggleSticky();
        document.getElementById('btn-qr').onclick = () => Tools.generateQR();
        document.getElementById('btn-collect').onclick = () => Tools.collectImages();
        document.getElementById('btn-copy-links').onclick = () => {
             const links = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(u => u.startsWith('http'));
             const blob = new Blob([[...new Set(links)].join('\n')], { type: 'text/plain' });
             const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'links.txt'; a.click();
             Notify.show('链接已导出', 'success');
        };
        document.getElementById('sw-btn').onclick = () => Tools.toggleSW();
        document.getElementById('sw-rst').onclick = () => { Tools.sw.time = 0; document.getElementById('helper-sw-dis').innerText='0.0s'; };
        document.getElementById('btn-force-chk').onclick = () => checkUpdate(true);

        setInterval(Tools.updateClock, 1000);
    }

    function checkUpdate(manual = false) {
        const dot = document.getElementById('helper-dot');
        if (manual) Notify.show('正在检查云端维护状态...', 'info');
        if (dot) dot.className = 'helper-status-dot status-checking';

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + Date.now(),
            timeout: 10000,
            onload: (res) => {
                if (res.status === 200) {
                    const match = res.responseText.match(/@version\s+([\d.]+)/i);
                    if (match && isNewerVersion(match[1], CONFIG.CURRENT_VERSION)) {
                        if (dot) dot.className = 'helper-status-dot status-outdated';
                        if (confirm(`发现维护补丁 v${match[1]}，是否立即同步更新？`)) GM_openInTab(CONFIG.UPDATE_URL);
                    } else {
                        if (dot) dot.className = 'helper-status-dot status-secure';
                        if (manual) Notify.show('当前版本已处于最新维护状态', 'success');
                    }
                }
            },
            onerror: () => { if (dot) dot.className = 'helper-status-dot status-secure'; }
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

    // 初始化
    function init() {
        const lastV = GM_getValue('last_known_v', '');
        if (lastV && isNewerVersion(CONFIG.CURRENT_VERSION, lastV)) {
            Notify.show(`🎉 系统已升级至 v${CONFIG.CURRENT_VERSION}，正在刷新环境...`, 'success');
            GM_setValue('last_known_v', CONFIG.CURRENT_VERSION);
            setTimeout(() => location.reload(true), 1500);
        } else {
            GM_setValue('last_known_v', CONFIG.CURRENT_VERSION);
            createUI();
            checkUpdate(false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
