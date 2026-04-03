// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.7.0
// @description  支持远程 GitHub 更新、内置控制面板、工具箱、仪表盘及系统自检 (Professional UI)
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

    // --- 核心配置与专业数据 ---
    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        STATUS: 'secure',
        LATENCY: '--',
        ENV: {
            browser: (() => {
                const ua = navigator.userAgent;
                if (ua.includes("Edg/")) return "Edge";
                if (ua.includes("Chrome/")) return "Chrome";
                if (ua.includes("Firefox/")) return "Firefox";
                return "未知浏览器";
            })(),
            manager: GM_info.scriptHandler || "Tampermonkey",
            managerVer: GM_info.version || "未知",
            platform: navigator.platform
        },
        CHANGELOG: [
            { v: '1.7.0', d: '2026/04/03', c: '专业版升级：重构维护页面为动态仪表盘，新增系统自检功能与网络延迟监测。' },
            { v: '1.6.0', d: '2026/04/03', c: '功能版增强：网页随手贴（URL 锁定）、二维码生成及图片采集卡上线。' },
            { v: '1.5.0', d: '2026/04/03', c: 'UI 视觉升级：重构 Premium 级控制面板，引入 Tab 导航，消除滚动条。' }
        ]
    };

    // --- 样式引擎 2.0 (Professional Dashboard) ---
    const UI_STYLES = `
        :root {
            --helper-bg: rgba(255, 255, 255, 0.92);
            --helper-blur: blur(25px);
            --helper-primary: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            --helper-accent: #667eea;
            --helper-success: #00b894;
            --helper-error: #ff7675;
            --helper-card-bg: rgba(255, 255, 255, 0.6);
            --helper-text-main: #2d3436;
            --helper-text-sec: #636e72;
        }

        #helper-ui-root {
            position: fixed; bottom: 30px; right: 30px; width: 300px;
            background: var(--helper-bg); border-radius: 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            z-index: 1999999; font-family: -apple-system, sans-serif; overflow: hidden;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: var(--helper-blur); border: 1px solid rgba(255, 255, 255, 0.5);
            user-select: none; color: var(--helper-text-main);
        }

        #helper-ui-root.minimized { width: 150px; }

        .helper-header {
            padding: 20px; background: var(--helper-primary); color: white;
            cursor: pointer; display: flex; justify-content: space-between; align-items: center;
            font-weight: 800; font-size: 15px;
        }

        .helper-tabs { display: flex; background: rgba(0,0,0,0.05); padding: 5px; }
        .helper-tab-item {
            flex: 1; text-align: center; padding: 10px 0; font-size: 12px;
            cursor: pointer; transition: 0.3s; color: var(--helper-text-sec); font-weight: 700;
            border-radius: 12px;
        }
        .helper-tab-item.active { background: white; color: var(--helper-accent); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

        .helper-body { padding: 18px; min-height: 280px; }
        .tab-content { display: none; animation: slideIn 0.4s ease; }
        .tab-content.active { display: block; }
        @keyframes slideIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        /* Dashboard 专用样式 */
        .dash-card {
            background: var(--helper-card-bg); border-radius: 16px; padding: 12px;
            margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.6);
        }
        .dash-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; }
        .dash-label { color: var(--helper-text-sec); }
        .dash-value { font-weight: 700; color: var(--helper-text-main); }
        
        .badge {
            padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 900;
            color: white; transform: skewX(-10deg); display: inline-block;
        }
        .badge-stable { background: var(--helper-success); }
        .badge-dev { background: var(--helper-accent); }

        .btn-premium {
            width: 100%; padding: 12px; border-radius: 15px; border: none;
            cursor: pointer; font-size: 12px; font-weight: 800; transition: 0.3s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 10px;
        }
        .btn-premium:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .btn-main { background: var(--helper-primary); color: white; }
        .btn-light { background: #f1f2f6; color: #2f3542; }

        /* 自检脉冲效果 */
        .pulse-light { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .p-green { background: var(--helper-success); box-shadow: 0 0 12px var(--helper-success); }
        .p-yellow { background: var(--helper-warning); animation: h-pulse 1s infinite; }
        @keyframes h-pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        
        /* 隐藏滚动条 */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;

    // --- 自定义通知模块 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notify-container';
            this.container.style.cssText = `position: fixed; top: 25px; right: 25px; z-index: 10000000; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;`;
            document.body.appendChild(this.container);
        },
        show(text, type = 'info') {
            this.init();
            const toast = document.createElement('div');
            const colors = { info: '#4facfe', success: '#00b894', warning: '#fdcb6e', error: '#ff7675' };
            toast.style.cssText = `
                margin-bottom: 12px; padding: 15px 25px; background: rgba(255, 255, 255, 0.98); color: #2d3436;
                border-left: 8px solid ${colors[type] || colors.info}; border-radius: 20px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1); font-size: 14px; font-weight: 800;
                pointer-events: auto; opacity: 0; transform: translateX(50px); transition: 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(10px);
            `;
            toast.innerText = text;
            this.container.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(50px)'; setTimeout(() => toast.remove(), 500); }, 4000);
        }
    };

    // --- 仪表盘与核心逻辑 ---
    const Tools = {
        sw: { timer: null, time: 0, running: false },

        // 系统自检函数
        selfCheck() {
            const btn = document.getElementById('btn-selfcheck');
            const latencyVal = document.getElementById('dash-latency');
            if (btn) { btn.innerText = '🛡️ 正在进行全系统扫描...'; btn.disabled = true; }
            Notify.show('🔮 全系统实时自检已启动...', 'info');

            const start = Date.now();
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: 'https://github.com/favicon.ico?t=' + start,
                timeout: 5000,
                onload: () => {
                    const latency = Date.now() - start;
                    CONFIG.LATENCY = latency + 'ms';
                    if (latencyVal) {
                        latencyVal.innerText = CONFIG.LATENCY;
                        latencyVal.style.color = latency < 200 ? 'var(--helper-success)' : 'var(--helper-warning)';
                    }
                    Notify.show(`系统自检完成：响应延迟 ${latency}ms，运行状态极佳！`, 'success');
                    if (btn) { btn.innerText = '🛡️ 开始一键系统自检'; btn.disabled = false; }
                },
                onerror: () => {
                    Notify.show('链路连接异常，部分功能可能受限', 'error');
                    if (btn) { btn.innerText = '🛡️ 开始一键系统自检'; btn.disabled = false; }
                }
            });
        },

        // 随手贴
        toggleSticky() {
            let note = document.getElementById('helper-sticky');
            if (!note) {
                note = document.createElement('div');
                note.id = 'helper-sticky';
                note.style.cssText = `position:fixed;top:100px;left:20px;width:180px;height:200px;background:rgba(255,255,200,0.9);z-index:2000000;border-radius:15px;box-shadow:5px 5px 20px rgba(0,0,0,0.1);padding:15px;cursor:move;backdrop-filter:blur(5px);`;
                note.innerHTML = `<div style="font-size:10px;color:#aaa;margin-bottom:8px;border-bottom:1px solid #eee;">📌 随手贴 (自动保存)</div><textarea id="sticky-val" style="width:100%;height:150px;background:transparent;border:none;outline:none;resize:none;font-size:13px;"></textarea>`;
                document.body.appendChild(note);
                const area = document.getElementById('sticky-val');
                area.value = GM_getValue(`note_${location.hostname}`, '');
                area.oninput = () => GM_setValue(`note_${location.hostname}`, area.value);
                
                // 拖拽逻辑
                let isD=false, o=[0,0];
                note.onmousedown=(e)=>{ if(e.target===area)return; isD=true; o=[note.offsetLeft-e.clientX, note.offsetTop-e.clientY]; };
                document.onmousemove=(e)=>{ if(!isD)return; note.style.left=(e.clientX+o[0])+'px'; note.style.top=(e.clientY+o[1])+'px'; };
                document.onmouseup=()=>{ isD=false; };

                Notify.show('网页随手贴已挂载', 'success');
            } else {
                note.style.display = note.style.display === 'none' ? 'block' : 'none';
                Notify.show(note.style.display === 'none' ? '便签已隐藏' : '便签已还原', 'info');
            }
        },

        generateQR() {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(location.href)}`;
            const overlay = document.createElement('div');
            overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);opacity:0;transition:0.3s;`;
            overlay.innerHTML = `<div style="background:white;padding:30px;border-radius:30px;text-align:center;"><h3>网页二维码同步</h3><img src="${url}" style="margin:20px 0;width:200px;border:5px solid #eee;border-radius:10px;"><br/><button id="qr-close" class="btn-premium btn-main" style="margin:0 auto">关闭同步</button></div>`;
            document.body.appendChild(overlay);
            setTimeout(()=>overlay.style.opacity='1',10);
            document.getElementById('qr-close').onclick=()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.remove(),300); };
            Notify.show('二维码生成成功，可在手机端同步', 'success');
        },

        collectImages() {
            Notify.show('正在启动暴力图像采集引擎...', 'info');
            const imgs = [...new Set([...document.querySelectorAll('img')].map(i=>i.src))].filter(s=>s.startsWith('http'));
            if(imgs.length===0) return Notify.show('未能识别到有效图像资源', 'warning');
            
            const overlay = document.createElement('div');
            overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:9999999;backdrop-filter:blur(20px);padding:50px;overflow-y:auto;`;
            overlay.className = 'no-scrollbar';
            overlay.innerHTML = `<div style="max-width:800px;margin:0 auto;"><h2>图像采集清单 (${imgs.length} 张)</h2><div class="image-grid" style="margin-top:30px;">${imgs.map(s=>`<img src="${s}" style="width:100%;height:150px;object-fit:cover;border-radius:15px;cursor:pointer;border:3px solid white;box-shadow:0 10px 20px rgba(0,0,0,0.1);" onclick="window.open('${s}')">`).join('')}</div><button id="img-close" class="btn-premium btn-main" style="margin-top:50px;max-width:200px">退出查看模式</button></div>`;
            document.body.appendChild(overlay);
            document.getElementById('img-close').onclick=()=>overlay.remove();
        }
    };

    // --- UI 渲染系统 ---
    function renderTab(tab) {
        document.querySelectorAll('.helper-tab-item').forEach(e=>e.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
    }

    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        GM_addStyle(UI_STYLES);

        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        if (CONFIG.IS_MINIMIZED) root.classList.add('minimized');

        // 头部
        const header = document.createElement('div');
        header.className = 'helper-header';
        header.innerHTML = `<div><span id="p-dot" class="pulse-light p-green"></span><span>专业控制中心</span></div><span id="tog-text" style="font-size:12px;">${CONFIG.IS_MINIMIZED?'展开':'折叠'}</span>`;
        header.onclick = (e) => {
            if(e.target.closest('.helper-tab-item')) return;
            const isM = root.classList.toggle('minimized');
            body.style.display = isM?'none':'block';
            tabs.style.display = isM?'none':'flex';
            document.getElementById('tog-text').innerText = isM?'展开':'折叠';
            GM_setValue('is_minimized', isM);
        };
        root.appendChild(header);

        // 导航
        const tabs = document.createElement('div');
        tabs.className = 'helper-tabs';
        tabs.style.display = CONFIG.IS_MINIMIZED?'none':'flex';
        tabs.innerHTML = `<div class="helper-tab-item active" data-tab="tools">辅助引擎</div><div class="helper-tab-item" data-tab="dashboard">仪表盘库</div>`;
        tabs.onclick = (e) => { const itm=e.target.closest('.helper-tab-item'); if(itm) renderTab(itm.dataset.tab); };
        root.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'helper-body no-scrollbar';
        body.style.display = CONFIG.IS_MINIMIZED?'none':'block';

        // 1. 工具引擎
        const tabTools = document.createElement('div');
        tabTools.id = 'tab-tools'; tabTools.className = 'tab-content active';
        tabTools.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:15px;gap:10px;">
                <div class="dash-card" style="flex:1;text-align:center;margin:0;"><div style="font-size:10px;color:#999">系统时钟</div><div id="h-clock" style="font-weight:900;font-size:18px">--:--:--</div></div>
                <div class="dash-card" style="flex:1;text-align:center;margin:0;"><div style="font-size:10px;color:#999">响应延迟</div><div id="dash-latency" style="font-weight:bold;color:var(--helper-success)">${CONFIG.LATENCY}</div></div>
            </div>
            <button id="btn-sticky-t" class="btn-premium btn-main">📝 网页随手贴：跨页持久同步</button>
            <button id="btn-qr-t" class="btn-premium btn-light">📱 生成网址同步二维码</button>
            <button id="btn-img-t" class="btn-premium btn-main" style="background:var(--helper-accent)">🖼️ 万能图像采集：全幅扫描</button>
            <button id="btn-link-t" class="btn-premium btn-light">🔗 导出文本链接清单 (.txt)</button>
        `;

        // 2. 专业仪表盘
        const tabDash = document.createElement('div');
        tabDash.id = 'tab-dashboard'; tabDash.className = 'tab-content';
        tabDash.innerHTML = `
            <div class="dash-card">
                <div class="dash-row"><span class="dash-label">核心版本</span><span class="dash-value"><span class="badge badge-stable">v${CONFIG.CURRENT_VERSION} [STABLE]</span></span></div>
                <div class="dash-row"><span class="dash-label">浏览器内核</span><span class="dash-value">${CONFIG.ENV.browser}</span></div>
                <div class="dash-row"><span class="dash-label">脚本管理器</span><span class="dash-value">${CONFIG.ENV.manager} v${CONFIG.ENV.managerVer}</span></div>
                <div class="dash-row"><span class="dash-label">维护作者</span><span class="dash-value">gao1774420117</span></div>
            </div>
            <div class="dash-card">
                <div style="font-weight:bold;font-size:11px;margin-bottom:8px;">🔥 实时运行指纹 (Build)</div>
                <div class="no-scrollbar" style="font-size:9px;color:#aaa;max-height:60px;overflow-y:auto;line-height:1.4;">
                    ${CONFIG.CHANGELOG.map(l=>`<b>v${l.v}</b>: ${l.c}<br/>`).join('')}
                </div>
            </div>
            <button id="btn-selfcheck" class="btn-premium btn-main">🛡️ 开始一键系统自检</button>
            <button id="btn-repo-t" class="btn-premium btn-light">📂 访问 GitHub 全球仓库</button>
        `;

        body.appendChild(tabTools); body.appendChild(tabDash);
        root.appendChild(body);
        document.body.appendChild(root);

        // 绑定功能
        document.getElementById('btn-selfcheck').onclick = () => Tools.selfCheck();
        document.getElementById('btn-sticky-t').onclick = () => Tools.toggleSticky();
        document.getElementById('btn-qr-t').onclick = () => Tools.generateQR();
        document.getElementById('btn-img-t').onclick = () => Tools.collectImages();
        document.getElementById('btn-link-t').onclick = () => {
            const ls = [...new Set([...document.querySelectorAll('a')].map(a=>a.href).filter(h=>h.startsWith('http')))];
            const b = new Blob([ls.join('\n')], {type:'text/plain'});
            const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='links.txt'; a.click();
            Notify.show('链接清单已完整导出', 'success');
        };
        document.getElementById('btn-repo-t').onclick = () => GM_openInTab(CONFIG.REPO_URL);
        
        setInterval(() => {
            const el = document.getElementById('h-clock');
            if(el) el.innerText = new Date().toLocaleTimeString('zh-CN', {hour12:false});
        }, 1000);
    }

    // 更新逻辑
    function checkUpdate(manual=false) {
        const dot = document.getElementById('p-dot');
        if(manual) Notify.show('正在侦测云端同步状态...', 'info');
        if(dot) dot.className = 'pulse-light p-yellow';

        GM_xmlhttpRequest({
            method: 'GET',
            url: CONFIG.UPDATE_URL + '?t=' + Date.now(),
            timeout: 8000,
            onload: (res) => {
                if(res.status === 200) {
                    const m = res.responseText.match(/@version\s+([\d.]+)/i);
                    if(m && isNewerVersion(m[1], CONFIG.CURRENT_VERSION)) {
                        if(dot) { dot.className = 'pulse-light'; dot.style.background = 'var(--helper-error)'; dot.style.boxShadow = '0 0 10px var(--helper-error)'; }
                        if(confirm(`检测到维护补丁: v${m[1]}\n当前版本: v${CONFIG.CURRENT_VERSION}\n\n是否立即应用更新？`)) GM_openInTab(CONFIG.UPDATE_URL);
                    } else {
                        if(dot) dot.className = 'pulse-light p-green';
                        if(manual) Notify.show('系统已处于最新维护状态', 'success');
                    }
                }
            }
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
        const lastV = GM_getValue('last_known_ver', '');
        if (lastV && isNewerVersion(CONFIG.CURRENT_VERSION, lastV)) {
            Notify.show(`🚀 系统已升级至 v${CONFIG.CURRENT_VERSION}，正在重构运行环境...`, 'success');
            GM_setValue('last_known_ver', CONFIG.CURRENT_VERSION);
            setTimeout(() => location.reload(true), 1500);
        } else {
            GM_setValue('last_known_ver', CONFIG.CURRENT_VERSION);
            createUI();
            checkUpdate(false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
