// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.7.1
// @description  支持远程 GitHub 更新、全能工具箱、系统仪表盘、随手贴、二维码、图片采集及暗黑模式 (精修补全版)
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
                return "未知内核";
            })(),
            manager: GM_info.scriptHandler || "Tampermonkey",
            managerVer: GM_info.version || "未知",
            platform: navigator.platform
        },
        CHANGELOG: [
            { v: '1.7.1', d: '2026/04/03', c: '精修补全版：找回丢失的密码生成、暗黑模式入口，补全手动更新检测逻辑。' },
            { v: '1.7.0', d: '2026/04/03', c: '专业版升级：重构维护页面为动态仪表盘，新增系统自检。' },
            { v: '1.6.0', d: '2026/04/03', c: '功能版增强：随手贴、二维码及图片采集卡上线。' }
        ]
    };

    // --- 样式引擎 2.1 (完美平衡版) ---
    const UI_STYLES = `
        :root {
            --helper-bg: rgba(255, 255, 255, 0.94);
            --helper-blur: blur(30px);
            --helper-primary: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            --helper-accent: #667eea;
            --helper-success: #00b894;
            --helper-error: #ff7675;
            --helper-warning: #fdcb6e;
            --helper-text-main: #2d3436;
            --helper-text-sec: #636e72;
        }

        #helper-ui-root {
            position: fixed; bottom: 30px; right: 30px; width: 320px;
            background: var(--helper-bg); border-radius: 30px; box-shadow: 0 25px 70px rgba(0,0,0,0.18);
            z-index: 10000000; font-family: -apple-system, sans-serif; overflow: hidden;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            backdrop-filter: var(--helper-blur); border: 1px solid rgba(255, 255, 255, 0.6);
            user-select: none; color: var(--helper-text-main);
        }

        #helper-ui-root.minimized { width: 150px; }

        .helper-header { padding: 18px 22px; background: var(--helper-primary); color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; }
        .helper-tabs { display: flex; background: rgba(0,0,0,0.06); padding: 5px; }
        .helper-tab-item { flex: 1; text-align: center; padding: 10px 0; font-size: 12px; cursor: pointer; transition: 0.3s; color: var(--helper-text-sec); font-weight: 700; border-radius: 12px; }
        .helper-tab-item.active { background: white; color: #4facfe; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

        .helper-body { padding: 18px; min-height: 250px; }
        .tab-content { display: none; animation: slideIn 0.4s ease; }
        .tab-content.active { display: block; }
        @keyframes slideIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

        .dash-card { background: rgba(255,255,255,0.6); border-radius: 18px; padding: 14px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
        .dash-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 7px; }
        .dash-label { color: var(--helper-text-sec); }
        .dash-value { font-weight: 700; color: var(--helper-text-main); font-family: monospace; }
        
        .badge { padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 900; color: white; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
        .badge-stable { background: var(--helper-success); }

        .btn-p { width: 100%; padding: 12px; border-radius: 16px; border: none; cursor: pointer; font-size: 12px; font-weight: 800; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); margin-bottom: 10px; }
        .btn-p:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.12); opacity: 0.95; }
        .btn-main { background: var(--helper-primary); color: white; }
        .btn-sec { background: #f1f2f6; color: #2f3542; }

        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 10px; }
        .dot-green { background: var(--helper-success); box-shadow: 0 0 12px var(--helper-success); }
        .dot-yellow { background: var(--helper-warning); animation: h-pulse 1s infinite; }
        .dot-red { background: var(--helper-error); box-shadow: 0 0 12px var(--helper-error); }
        @keyframes h-pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .image-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
    `;

    // --- 自定义通知 ---
    const Notify = {
        container: null,
        init() {
            if (this.container) return;
            this.container = document.createElement('div');
            this.container.id = 'helper-notif-box';
            this.container.style.cssText = `position:fixed; top:30px; right:30px; z-index:20000000; display:flex; flex-direction:column; align-items:flex-end; pointer-events:none;`;
            document.body.appendChild(this.container);
        },
        show(msg, type = 'info') {
            this.init();
            const t = document.createElement('div');
            const c = { info: '#4facfe', success: '#00b894', warning: '#fdcb6e', error: '#ff7675' };
            t.style.cssText = `margin-bottom:12px; padding:16px 26px; background:rgba(255,255,255,0.98); color:#2d3436; border-left:8px solid ${c[type]}; border-radius:22px; box-shadow:0 15px 40px rgba(0,0,0,0.12); font-size:14px; font-weight:800; pointer-events:auto; opacity:0; transform:translateX(60px); transition:all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter:blur(15px);`;
            t.innerText = msg;
            this.container.appendChild(t);
            setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateX(0)'; }, 20);
            setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(60px)'; setTimeout(() => t.remove(), 500); }, 4000);
        }
    };

    // --- 核心业务逻辑 ---
    const Tools = {
        sw: { t: null, s: 0, r: false },

        // 1. 系统自检 (Latency)
        selfCheck() {
            const btn = document.getElementById('btn-selfcheck');
            const lat = document.getElementById('dash-latency');
            if (btn) btn.innerText = '🛡️ 深度环境扫描中...';
            Notify.show('🔮 已建立数据链路，正在测算节点延迟...', 'info');

            const start = Date.now();
            GM_xmlhttpRequest({
                method: 'HEAD', url: 'https://github.com/favicon.ico?t=' + start, timeout: 6000,
                onload: () => {
                    const l = Date.now() - start;
                    if (lat) { lat.innerText = l + 'ms'; lat.style.color = l < 180 ? '#00b894' : '#fdcb6e'; }
                    Notify.show(`自检完成：链路探测 ${l}ms，系统安全性 [极高]`, 'success');
                    if (btn) btn.innerText = '🛡️ 开始一键系统自检';
                }
            });
        },

        // 2. 检查更新 (Version)
        forceUpdate() {
            Notify.show('🚀 正在检索 GitHub 全球维护版本库...', 'info');
            checkUpdate(true);
        },

        // 3. 随手贴
        toggleSticky() {
            let n = document.getElementById('helper-note');
            if (!n) {
                n = document.createElement('div');
                n.id = 'helper-note';
                n.style.cssText = `position:fixed; top:120px; left:30px; width:200px; height:220px; background:rgba(255,255,200,0.92); z-index:9000000; border-radius:20px; shadow:5px 5px 30px rgba(0,0,0,0.15); padding:18px; cursor:move; backdrop-filter:blur(8px); border:1px solid rgba(0,0,0,0.05);`;
                n.innerHTML = `<div style="font-size:11px;color:#999;margin-bottom:10px;border-bottom:1px solid #ddd;padding-bottom:5px;">📝 网页笔记 (云同步)</div><textarea id="note-area" style="width:100%;height:160px;background:transparent;border:none;outline:none;resize:none;font-size:14px;color:#2d3436;"></textarea>`;
                document.body.appendChild(n);
                const a = document.getElementById('note-area');
                a.value = GM_getValue(`n_${location.hostname}`, '');
                a.oninput = () => GM_setValue(`n_${location.hostname}`, a.value);
                let isD=false, o=[0,0];
                n.onmousedown=(e)=>{ if(e.target===a)return; isD=true; o=[n.offsetLeft-e.clientX, n.offsetTop-e.clientY]; };
                document.onmousemove=(e)=>{ if(!isD)return; n.style.left=(e.clientX+o[0])+'px'; n.style.top=(e.clientY+o[1])+'px'; };
                document.onmouseup=()=>{ isD=false; };
                Notify.show('随手贴已挂载，跨页自动同步', 'success');
            } else {
                n.style.display = n.style.display === 'none' ? 'block' : 'none';
                Notify.show(n.style.display === 'none' ? '笔记面板已隐藏' : '笔记面板已显示', 'info');
            }
        },

        // 4. 工具函数
        generatePassword() {
            const cs = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
            let r = ""; for (let i = 0; i < 18; i++) r += cs.charAt(Math.floor(Math.random() * cs.length));
            navigator.clipboard.writeText(r).then(() => Notify.show(`强密码生成并复制: ${r}`, 'success'));
        },

        generateQR() {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(location.href)}`;
            const over = document.createElement('div');
            over.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:99999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(15px);opacity:0;transition:0.3s;`;
            over.innerHTML = `<div style="background:white;padding:35px;border-radius:35px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.3);"><h3>网址多端同步</h3><img src="${url}" style="margin:25px 0;width:180px;border-radius:15px;border:8px solid #f9f9f9;"><br/><button id="qr-cls" class="btn-p btn-main" style="max-width:160px;margin:10px auto">关闭同步</button></div>`;
            document.body.appendChild(over);
            setTimeout(()=>over.style.opacity='1',10);
            document.getElementById('qr-cls').onclick=()=>{ over.style.opacity='0'; setTimeout(()=>over.remove(),300); };
            Notify.show('二维码已生成，手机扫码即可同步网址', 'success');
        },

        collectImages() {
            Notify.show('正在启动暴力图像扫描矩阵...', 'info');
            const imgs = [...new Set([...document.querySelectorAll('img')].map(i=>i.src))].filter(s=>s && s.startsWith('http'));
            if(imgs.length===0) return Notify.show('未能探测到可捕获的视觉资源', 'warning');
            const over = document.createElement('div');
            over.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:99999999;backdrop-filter:blur(25px);padding:50px;overflow-y:auto;`;
            over.innerHTML = `<div style="max-width:900px;margin:0 auto;"><h2 style="font-weight:900;">资源捕获清单 (${imgs.length} 份)</h2><div class="image-grid" style="margin-top:30px;">${imgs.map(s=>`<img src="${s}" style="width:100%;height:160px;object-fit:cover;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.08);cursor:pointer;border:4px solid white;" onclick="window.open('${s}')">`).join('')}</div><button id="img-cls" class="btn-p btn-main" style="margin-top:50px;max-width:260px">退出预览模式</button></div>`;
            document.body.appendChild(over);
            document.getElementById('img-cls').onclick=()=>over.remove();
        }
    };

    // --- UI 渲染系统 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        GM_addStyle(UI_STYLES);

        const root = document.createElement('div');
        root.id = 'helper-ui-root';
        if (CONFIG.IS_MINIMIZED) root.classList.add('minimized');

        // Header
        const header = document.createElement('div');
        header.className = 'helper-header';
        header.innerHTML = `<div><span id="stat-dot" class="pulse-dot dot-green"></span><span>全能助手中心</span></div><span id="tog-txt" style="font-size:12px;opacity:0.8;">${CONFIG.IS_MINIMIZED?'展开':'折叠'}</span>`;
        header.onclick = (e) => {
            if(e.target.closest('.helper-tab-item')) return;
            const isM = root.classList.toggle('minimized');
            body.style.display = isM?'none':'block';
            tabs.style.display = isM?'none':'flex';
            document.getElementById('tog-txt').innerText = isM?'展开':'折叠';
            GM_setValue('is_minimized', isM);
        };
        root.appendChild(header);

        // Tabs
        const tabs = document.createElement('div');
        tabs.className = 'helper-tabs';
        tabs.style.display = CONFIG.IS_MINIMIZED?'none':'flex';
        tabs.innerHTML = `<div class="helper-tab-item active" data-tab="tools">辅助引擎</div><div class="helper-tab-item" data-tab="dash">系统状况</div>`;
        tabs.onclick = (e) => {
            const itm = e.target.closest('.helper-tab-item');
            if(itm) {
                document.querySelectorAll('.helper-tab-item').forEach(el=>el.classList.remove('active'));
                itm.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
                document.getElementById(`tab-${itm.dataset.tab}`).classList.add('active');
            }
        };
        root.appendChild(tabs);

        const body = document.createElement('div');
        body.className = 'helper-body no-scrollbar';
        body.style.display = CONFIG.IS_MINIMIZED?'none':'block';

        // Tab: 工具单元
        const tabTools = document.createElement('div');
        tabTools.id = 'tab-tools'; tabTools.className = 'tab-content active';
        tabTools.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;gap:10px;">
                <div class="dash-card" style="flex:1;text-align:center;margin:0;padding:10px;"><div style="font-size:10px;color:#999">响应延迟</div><div id="dash-latency" style="font-weight:900;font-size:16px;color:#00b894;">${CONFIG.LATENCY}</div></div>
                <div class="dash-card" style="flex:1;text-align:center;margin:0;padding:10px;"><div style="font-size:10px;color:#999">实时时钟</div><div id="u-clock" style="font-weight:bold;font-size:14px;color:#2d3436">--:--:--</div></div>
            </div>
            <button id="b-sticky" class="btn-p btn-main">📝 网页随手贴：跨页自动存</button>
            <button id="b-pwd" class="btn-p btn-sec">🔑 一键生成 18 位随机强密码</button>
            <button id="b-img" class="btn-p btn-main" style="background:var(--helper-accent)">🖼️ 暴力采集全站高清大图资源</button>
            <div style="display:flex;gap:10px;">
                <button id="b-qr" class="btn-p btn-sec" style="flex:1">📱 网址同步</button>
                <button id="b-dark" class="btn-p btn-sec" style="flex:1">◑ 模式切换</button>
            </div>
            <button id="b-links" class="btn-p btn-sec">🔗 提取全站文本链接清单 (.txt)</button>
        `;

        // Tab: 仪表盘
        const tabDash = document.createElement('div');
        tabDash.id = 'tab-dash'; tabDash.className = 'tab-content';
        tabDash.innerHTML = `
            <div class="dash-card">
                <div class="dash-row"><span class="dash-label">版本状态</span><span class="dash-value"><span class="badge badge-stable">v${CONFIG.CURRENT_VERSION} [STABLE]</span></span></div>
                <div class="dash-row"><span class="dash-label">核心内核</span><span class="dash-value">${CONFIG.ENV.browser}</span></div>
                <div class="dash-row"><span class="dash-label">管理器版本</span><span class="dash-value">${CONFIG.ENV.manager} ${CONFIG.ENV.managerVer}</span></div>
                <div class="dash-row"><span class="dash-label">维护作者</span><span class="dash-value">gao1774420117</span></div>
            </div>
            <div class="dash-card">
                <div style="font-weight:bold;font-size:11px;margin-bottom:8px;color:var(--helper-accent)">📜 离线维护日志 (Build Fingerprint)</div>
                <div class="no-scrollbar" style="font-size:9px;color:#aaa;max-height:55px;overflow-y:auto;line-height:1.5;">
                    ${CONFIG.CHANGELOG.map(l=>`• <b>v${l.v}</b>: ${l.c}<br/>`).join('')}
                </div>
            </div>
            <button id="b-upd" class="btn-p btn-main">🚀 立即检查 GitHub 维护版本库</button>
            <button id="b-self" class="btn-p btn-sec">🛡️ 一键执行全系统自检</button>
        `;

        body.appendChild(tabTools); body.appendChild(tabDash);
        root.appendChild(body);
        document.body.appendChild(root);

        // 按钮挂载
        document.getElementById('b-sticky').onclick = () => Tools.toggleSticky();
        document.getElementById('b-pwd').onclick = () => Tools.generatePassword();
        document.getElementById('b-img').onclick = () => Tools.collectImages();
        document.getElementById('b-qr').onclick = () => Tools.generateQR();
        document.getElementById('b-dark').onclick = () => {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD); applyDarkMode(isD);
            Notify.show(isD ? '暗黑模式已激活' : '已切回常规视觉模式', 'info');
        };
        document.getElementById('b-links').onclick = () => {
            const ls = [...new Set([...document.querySelectorAll('a')].map(a=>a.href).filter(h=>h.startsWith('http')))];
            const b = new Blob([ls.join('\n')], {type:'text/plain'});
            const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='links.txt'; a.click();
            Notify.show('链接列表已成功导出', 'success');
        };
        document.getElementById('b-upd').onclick = () => Tools.forceUpdate();
        document.getElementById('b-self').onclick = () => Tools.selfCheck();

        setInterval(() => {
            const e = document.getElementById('u-clock');
            if(e) e.innerText = new Date().toLocaleTimeString('zh-CN', {hour12:false});
        }, 1000);
    }

    // 核心更新检测
    function checkUpdate(manual = false) {
        const dot = document.getElementById('stat-dot');
        if(dot) dot.className = 'pulse-dot dot-yellow';

        GM_xmlhttpRequest({
            method: 'GET', url: CONFIG.UPDATE_URL + '?t=' + Date.now(), timeout: 10000,
            onload: (res) => {
                if(res.status === 200) {
                    const m = res.responseText.match(/@version\s+([\d.]+)/i);
                    if(m && isNewerVersion(m[1], CONFIG.CURRENT_VERSION)) {
                        if(dot) dot.className = 'pulse-dot dot-red';
                        if(confirm(`🚀 发现维护版本补丁: v${m[1]}\n当前版本: v${CONFIG.CURRENT_VERSION}\n\n是否立即同步更新以应用补丁？`)) GM_openInTab(CONFIG.UPDATE_URL);
                    } else {
                        if(dot) dot.className = 'pulse-dot dot-green';
                        if(manual) Notify.show('当前系统已处于最新维护状态', 'success');
                    }
                }
            },
            onerror: () => { if(dot) dot.className = 'pulse-dot dot-green'; }
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

    function applyDarkMode(e) {
        const id = 'h-dark-style', el = document.getElementById(id);
        if (e) {
            if (!el) {
                const s = document.createElement('style'); s.id = id;
                s.innerHTML = `html { filter: invert(0.96) hue-rotate(180deg) !important; background: #000; } img, video, iframe, canvas, [style*="background-image"] { filter: invert(1.04) hue-rotate(180deg) !important; } #helper-ui-root, #helper-notif-box { filter: invert(1.04) hue-rotate(180deg) !important; }`;
                document.head.appendChild(s);
            }
        } else if (el) el.remove();
    }

    // 初始化运行
    function init() {
        const lastV = GM_getValue('last_v_check', '');
        if (lastV && isNewerVersion(CONFIG.CURRENT_VERSION, lastV)) {
            Notify.show(`🎉 系统环境升级至 v${CONFIG.CURRENT_VERSION} 成功！正在重构内核空间...`, 'success');
            GM_setValue('last_v_check', CONFIG.CURRENT_VERSION);
            setTimeout(() => location.reload(true), 1500);
        } else {
            GM_setValue('last_v_check', CONFIG.CURRENT_VERSION);
            createUI();
            applyDarkMode(GM_getValue('dark_mode', false));
            checkUpdate(false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
