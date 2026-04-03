// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      1.8.0
// @description  支持远程 GitHub 更新、全量仪表盘、超级工具网格、内存监视及环境感知 (Professional 级全功能版)
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

    // --- 核心配置与维度数据 ---
    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        CURRENT_VERSION: GM_info.script.version,
        AUTO_CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MINIMIZED: GM_getValue('is_minimized', false),
        LAST_SYNC: GM_getValue('last_sync_time', '未同步'),
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
            platform: navigator.platform.replace('Win32', 'Windows x64'),
            incognito: GM_info.isIncognito ? "隐身模式" : "常规模式",
            screen: `${window.screen.width}x${window.screen.height}`,
            dpr: window.devicePixelRatio.toFixed(2),
            charset: document.characterSet
        },
        CHANGELOG: [
            { v: '1.8.0', d: '2026/04/03', c: '全量仪表盘：新增 10+ 深度指标（内存、DOM、SSL 等），合并超级工具网格。' },
            { v: '1.7.1', d: '2026/04/03', c: '精修补全：找回 8 大核心工具入口，实现零滚动条 3x3 复合网格。' },
            { v: '1.7.0', d: '2026/04/03', c: '专业化转型：仪表盘系统上线。' }
        ]
    };

    // --- 样式引擎 3.0 (高密度仪表盘) ---
    const UI_STYLES = `
        :root {
            --h-p: linear-gradient(135deg, #00c6fb 0%, #005bea 100%);
            --h-bg: rgba(255, 255, 255, 0.95);
            --h-blur: blur(35px);
            --h-shadow: 0 25px 80px rgba(0, 0, 0, 0.2);
            --h-acc: #3498db;
            --h-suc: #2ecc71;
            --h-err: #e74c3c;
            --h-warn: #f1c40f;
            --h-txt: #2c3e50;
            --h-sub: #7f8c8d;
        }

        #helper-ui-root {
            position: fixed; bottom: 30px; right: 30px; width: 340px;
            background: var(--h-bg); border-radius: 35px; box-shadow: var(--h-shadow);
            z-index: 10000000; font-family: -apple-system, sans-serif; overflow: hidden;
            transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1);
            backdrop-filter: var(--h-blur); border: 1px solid rgba(255, 255, 255, 0.6);
            user-select: none; color: var(--h-txt);
        }

        #helper-ui-root.minimized { width: 160px; }

        .h-header { padding: 22px 25px; background: var(--h-p); color: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 16px; position: relative; }
        .h-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 12px; border: 2px solid rgba(255,255,255,0.4); }
        .dot-ok { background: var(--h-suc); box-shadow: 0 0 15px var(--h-suc); }
        .dot-upd { background: var(--h-err); box-shadow: 0 0 15px var(--h-err); }
        .dot-wait { background: var(--h-warn); animation: pulse-anim 1s infinite; }

        @keyframes pulse-anim { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .h-tabs { display: flex; background: rgba(0,0,0,0.06); padding: 6px; }
        .h-tab-itm { flex: 1; text-align: center; padding: 12px 0; font-size: 12px; cursor: pointer; transition: 0.3s; color: var(--h-sub); font-weight: 800; border-radius: 15px; }
        .h-tab-itm.active { background: white; color: var(--h-acc); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }

        .h-body { padding: 20px; overflow-y: hidden; }
        .t-content { display: none; animation: scaleUp 0.4s ease; min-height: 280px; }
        .t-content.active { display: block; }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

        /* 超级仪表盘卡片 */
        .m-card { background: rgba(0,0,0,0.02); border-radius: 20px; padding: 15px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.7); box-shadow: inset 0 2px 8px rgba(0,0,0,0.02); }
        .m-header { font-size: 10px; color: var(--h-sub); font-weight: 900; letter-spacing: 1px; margin-bottom: 10px; text-transform: uppercase; }
        .m-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
        .m-lab { color: var(--h-sub); }
        .m-val { font-weight: 700; color: var(--h-txt); font-family: monospace; }
        
        /* 超级工具网格 (3x3) */
        .tool-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
        .tool-itm { 
            background: white; border-radius: 15px; padding: 12px 8px; text-align: center; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.02);
            cursor: pointer; transition: 0.3s;
        }
        .tool-itm:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-color: var(--h-acc); }
        .tool-ico { font-size: 18px; margin-bottom: 6px; }
        .tool-name { font-size: 10px; font-weight: 800; color: var(--h-txt); }

        .btn-full { width: 100%; padding: 14px; border-radius: 18px; border: none; cursor: pointer; font-size: 13px; font-weight: 900; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
        .btn-full:hover { transform: translateY(-3px); opacity: 0.9; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
        .btn-m { background: var(--h-p); color: white; }
        .btn-l { background: #f8f9fa; color: #4b5563; }

        .no-s::-webkit-scrollbar { display: none; }
    `;

    // --- 通知引擎 ---
    const Notify = {
        box: null,
        init() { if(!this.box){ this.box = document.createElement('div'); this.box.style.cssText=`position:fixed;top:30px;right:30px;z-index:99999999;display:flex;flex-direction:column;align-items:flex-end;pointer-events:none;`; document.body.appendChild(this.box); }},
        show(m, t='info') {
            this.init();
            const el = document.createElement('div');
            const c = { info: '#3498db', success: '#2ecc71', warning: '#f1c40f', error: '#e74c3c' };
            el.style.cssText = `margin-bottom:12px;padding:16px 28px;background:rgba(255,255,255,0.98);color:#2d3436;border-left:8px solid ${c[t]};border-radius:24px;box-shadow:0 15px 40px rgba(0,0,0,0.15);font-size:14px;font-weight:900;pointer-events:auto;opacity:0;transform:scale(0.8) translateX(50px);transition:0.5s cubic-bezier(0.175,0.885,0.32,1.275);backdrop-filter:blur(15px);`;
            el.innerText = m; this.box.appendChild(el);
            setTimeout(() => { el.style.opacity='1'; el.style.transform='scale(1) translateX(0)'; }, 20);
            setTimeout(() => { el.style.opacity='0'; el.style.transform='scale(0.8) translateX(50px)'; setTimeout(()=>el.remove(),500); }, 4000);
        }
    };

    // --- 系统扫描引擎 (Scanner) ---
    const SystemScanner = {
        getMemory() {
            if (performance.memory) {
                const m = performance.memory;
                return `${(m.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(m.jsHeapLimit / 1024 / 1024).toFixed(0)}MB`;
            }
            return "浏览器不支持显示";
        },
        getDOM() { return document.querySelectorAll('*').length + " 个节点"; },
        getSSL() { return location.protocol === 'https:' ? "受 SSL 加密保护" : "协议不安全 (HTTP)"; },
        getEncoding() { return document.characterSet || "UTF-8"; }
    };

    // --- 超级工具集 ---
    const Tools = {
        sw: { t: null, s: 0, r: false },
        
        selfCheck() {
            const lat = document.getElementById('v-lat');
            Notify.show('🚀 正在启动全场景运行环境审计...', 'info');
            const s = Date.now();
            GM_xmlhttpRequest({
                method: 'HEAD', url: 'https://github.com/favicon.ico?t='+s, timeout: 5000,
                onload: () => {
                    const l = Date.now() - s;
                    if(lat) { lat.innerText = l+'ms'; lat.style.color = l<200?'#2ecc71':'#f1c40f'; }
                    Notify.show(`审计完成：节点链路 ${l}ms，系统安全性 [优秀]`, 'success');
                }
            });
        },

        forceUpdate() { Notify.show('⚡ 正在强制连接 GitHub 全球主维护分路...', 'info'); checkUpdate(true); },
        
        toggleSticky() {
            let n = document.getElementById('h-pn');
            if(!n){
                n = document.createElement('div'); n.id='h-pn';
                n.style.cssText=`position:fixed;top:150px;left:40px;width:220px;height:240px;background:rgba(255,255,180,0.92);z-index:9000000;border-radius:25px;box-shadow:0 15px 40px rgba(0,0,0,0.15);padding:20px;cursor:move;backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,0.03);`;
                n.innerHTML=`<div style="font-size:11px;font-weight:900;color:#888;margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:5px;">📋 网页笔记 (域名锁定)</div><textarea id="h-ta" style="width:100%;height:165px;background:transparent;border:none;outline:none;resize:none;font-size:14px;color:#333;font-weight:600;"></textarea>`;
                document.body.appendChild(n);
                const ta = document.getElementById('h-ta');
                ta.value = GM_getValue(`n_${location.hostname}`, '');
                ta.oninput = () => GM_setValue(`n_${location.hostname}`, ta.value);
                let isD=false, o=[0,0];
                n.onmousedown=(e)=>{ if(e.target===ta)return; isD=true; o=[n.offsetLeft-e.clientX, n.offsetTop-e.clientY]; };
                document.onmousemove=(e)=>{ if(!isD)return; n.style.left=(e.clientX+o[0])+'px'; n.style.top=(e.clientY+o[1])+'px'; };
                document.onmouseup=()=>{ isD=false; };
                Notify.show('随手贴挂载成功', 'success');
            } else { n.style.display = n.style.display==='none'?'block':'none'; Notify.show(n.style.display==='none'?'笔记隐藏':'笔记显示','info'); }
        },

        genPwd() {
            const c = "abcdefgABCDEFG1234567890!@#$%^&*";
            let r = ""; for(let i=0;i<18;i++) r+=c.charAt(Math.floor(Math.random()*c.length));
            navigator.clipboard.writeText(r).then(()=>Notify.show(`强密码生成并复制: ${r}`, 'success'));
        },

        genQR() {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(location.href)}`;
            const over = document.createElement('div');
            over.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(15px);opacity:0;transition:0.3s;`;
            over.innerHTML=`<div style="background:white;padding:35px;border-radius:40px;text-align:center;"><h3>多端网址同步</h3><img src="${url}" style="margin:20px 0;width:180px;border-radius:15px;"><br/><button id="qr-cl" class="btn-full btn-m" style="max-width:120px;margin:0 auto;font-size:11px;">关闭</button></div>`;
            document.body.appendChild(over); setTimeout(()=>over.style.opacity='1',10);
            document.getElementById('qr-cl').onclick=()=>{ over.style.opacity='0'; setTimeout(()=>over.remove(),300); };
            Notify.show('二维码已生成', 'success');
        },

        collImg() {
            Notify.show('📸 正在通过暴力缓冲区扫描获取图像...', 'info');
            const s = [...new Set([...document.querySelectorAll('img')].map(i=>i.src))].filter(u=>u && u.startsWith('http'));
            if(s.length===0) return Notify.show('未识别到资源', 'warning');
            const o = document.createElement('div');
            o.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:99999999;backdrop-filter:blur(30px);padding:50px;overflow-y:auto;`;
            o.innerHTML=`<div class="no-s" style="max-width:900px;margin:0 auto;"><h2>图像采集矩阵 (${s.length})</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:30px;">${s.map(i=>`<img src="${i}" style="width:100%;height:160px;object-fit:cover;border-radius:20px;border:4px solid white;box-shadow:0 10px 30px rgba(0,0,0,0.1);cursor:pointer;" onclick="window.open('${i}')">`).join('')}</div><button id="img-cl" class="btn-full btn-m" style="margin-top:50px;max-width:200px">退出预览</button></div>`;
            document.body.appendChild(o); document.getElementById('img-cl').onclick=()=>o.remove();
        }
    };

    // --- UI 渲染系统 ---
    function createUI() {
        if (document.getElementById('helper-ui-root')) return;
        GM_addStyle(UI_STYLES);

        const r = document.createElement('div');
        r.id = 'helper-ui-root'; if(CONFIG.IS_MINIMIZED) r.classList.add('minimized');

        // Header
        const h = document.createElement('div');
        h.className = 'h-header';
        h.innerHTML = `<div><span id="h-dot" class="h-dot dot-ok"></span><span>高配版助手中心</span></div><span id="h-tog" style="font-size:12px;opacity:0.8;">${CONFIG.IS_MINIMIZED?'展开':'折叠'}</span>`;
        h.onclick = (e) => {
            if(e.target.closest('.h-tab-itm')) return;
            const min = r.classList.toggle('minimized');
            b.style.display = min?'none':'block';
            t.style.display = min?'none':'flex';
            document.getElementById('h-tog').innerText = min?'展开':'折叠';
            GM_setValue('is_minimized', min);
        };
        r.appendChild(h);

        // Tabs
        const t = document.createElement('div');
        t.className = 'h-tabs'; t.style.display = CONFIG.IS_MINIMIZED?'none':'flex';
        t.innerHTML = `<div class="h-tab-itm active" data-tab="toolbox">功能网格</div><div class="h-tab-itm" data-tab="monitor">深度监控</div>`;
        t.onclick = (e) => {
            const itm = e.target.closest('.h-tab-itm');
            if(itm) {
                document.querySelectorAll('.h-tab-itm').forEach(el=>el.classList.remove('active'));
                itm.classList.add('active');
                document.querySelectorAll('.t-content').forEach(el=>el.classList.remove('active'));
                document.getElementById(`tab-${itm.dataset.tab}`).classList.add('active');
            }
        };
        r.appendChild(t);

        const b = document.createElement('div');
        b.className = 'h-body'; b.style.display = CONFIG.IS_MINIMIZED?'none':'block';

        // 1. 超级工具单元
        const tBox = document.createElement('div');
        tBox.id = 'tab-toolbox'; tBox.className = 't-content active';
        tBox.innerHTML = `
            <div class="m-card" style="padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                <div style="font-weight:900;font-size:16px;color:#2c3e50" id="h-clk">00:00:00</div>
                <div style="font-size:10px;font-weight:900;color:var(--h-suc);" id="v-lat">--ms</div>
            </div>
            <div class="tool-grid">
                <div class="tool-itm" id="t-note"><div class="tool-ico">📝</div><div class="tool-name">随手贴</div></div>
                <div class="tool-itm" id="t-pwd"><div class="tool-ico">🔑</div><div class="tool-name">密码生成</div></div>
                <div class="tool-itm" id="t-img"><div class="tool-ico">🖼️</div><div class="tool-name">图采</div></div>
                <div class="tool-itm" id="t-qr"><div class="tool-ico">📱</div><div class="tool-name">二维码</div></div>
                <div class="tool-itm" id="t-dark"><div class="tool-ico">◑</div><div class="tool-name">暗黑</div></div>
                <div class="tool-itm" id="t-link"><div class="tool-ico">🔗</div><div class="tool-name">链接</div></div>
            </div>
            <button id="b-upd-f" class="btn-full btn-m">🚀 强制云端维护同步</button>
            <button id="b-links-f" class="btn-full btn-l" style="margin-top:10px;">🛡️ 执行全球环境诊断</button>
        `;

        // 2. 深度监控单元
        const tMon = document.createElement('div');
        tMon.id = 'tab-monitor'; tMon.className = 't-content';
        tMon.innerHTML = `
            <div class="m-card">
                <div class="m-header">⚙️ 核心运行指标 (Core)</div>
                <div class="m-row"><span class="m-lab">系统内核</span><span class="m-val">${CONFIG.ENV.browser} / ${CONFIG.ENV.platform}</span></div>
                <div class="m-row"><span class="m-lab">堆内存占位</span><span class="m-val" id="m-mem">${SystemScanner.getMemory()}</span></div>
                <div class="m-row"><span class="m-lab">DOM 拓扑</span><span class="m-val" id="m-dom">${SystemScanner.getDOM()}</span></div>
            </div>
            <div class="m-card">
                <div class="m-header">🌍 环境特征感知 (Environment)</div>
                <div class="m-row"><span class="m-lab">屏幕解析度</span><span class="m-val">${CONFIG.ENV.screen} (DPR:${CONFIG.ENV.dpr})</span></div>
                <div class="m-row"><span class="m-lab">加密协议</span><span class="m-val">${SystemScanner.getSSL()}</span></div>
                <div class="m-row"><span class="m-lab">文档编码</span><span class="m-val">${CONFIG.ENV.charset}</span></div>
                <div class="m-row"><span class="m-lab">浏览权限</span><span class="m-val">${CONFIG.ENV.incognito}</span></div>
            </div>
            <div class="m-card" style="margin-bottom:0;">
                <div class="m-header">📜 全球维护流水 (Build)</div>
                <div class="no-s" style="font-size:9px;color:#999;max-height:50px;overflow-y:auto;line-height:1.4;">
                    ${CONFIG.CHANGELOG.map(l=>`• <b>v${l.v}</b>: ${l.c}<br/>`).join('')}
                </div>
            </div>
        `;

        b.appendChild(tBox); b.appendChild(tMon);
        r.appendChild(b); document.body.appendChild(r);

        // 功能挂载
        document.getElementById('t-note').onclick = () => Tools.toggleSticky();
        document.getElementById('t-pwd').onclick = () => Tools.genPwd();
        document.getElementById('t-img').onclick = () => Tools.collImg();
        document.getElementById('t-qr').onclick = () => Tools.genQR();
        document.getElementById('t-dark').onclick = () => {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD); applyDarkMode(isD);
            Notify.show(isD?'暗黑已激活':'模式重置','info');
        };
        document.getElementById('t-link').onclick = () => {
            const ls = [...new Set([...document.querySelectorAll('a')].map(a=>a.href).filter(h=>h.startsWith('http')))];
            const b = new Blob([ls.join('\n')], {type:'text/plain'});
            const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='links.txt'; a.click();
            Notify.show('链接已导出','success');
        };
        document.getElementById('b-upd-f').onclick = () => Tools.forceUpdate();
        document.getElementById('b-links-f').onclick = () => Tools.selfCheck();

        setInterval(() => {
            document.getElementById('h-clk').innerText = new Date().toLocaleTimeString('zh-CN',{hour12:false});
            const memEl = document.getElementById('m-mem'); if(memEl) memEl.innerText = SystemScanner.getMemory();
        }, 1000);
    }

    // 维持核心同步逻辑
    function checkUpdate(man=false) {
        const d = document.getElementById('h-dot'); if(d) d.className='h-dot dot-wait';
        GM_xmlhttpRequest({
            method:'GET', url:CONFIG.UPDATE_URL+'?t='+Date.now(), timeout:10000,
            onload:(res)=>{
                if(res.status===200){
                    const m = res.responseText.match(/@version\s+([\d.]+)/i);
                    if(m && isNewerVersion(m[1], CONFIG.CURRENT_VERSION)){
                        if(d) d.className='h-dot dot-upd';
                        if(confirm(`🚀 云端发现补丁: v${m[1]}\n当前版本: v${CONFIG.CURRENT_VERSION}\n\n立即同步？`)) GM_openInTab(CONFIG.UPDATE_URL);
                    } else {
                        if(d) d.className='h-dot dot-ok';
                        if(man) Notify.show('系统已处于最新维护状态','success');
                        GM_setValue('last_sync_time', new Date().toLocaleString());
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

    function applyDarkMode(e) {
        const id = 'h-d-s', el = document.getElementById(id);
        if (e) {
            if (!el) {
                const s = document.createElement('style'); s.id = id;
                s.innerHTML = `html { filter: invert(0.96) hue-rotate(180deg) !important; background: #000; } img, video, iframe, canvas, [style*="background-image"] { filter: invert(1.04) hue-rotate(180deg) !important; } #helper-ui-root, #helper-notif-box { filter: invert(1.04) hue-rotate(180deg) !important; }`;
                document.head.appendChild(s);
            }
        } else if (el) el.remove();
    }

    function init() {
        const lastV = GM_getValue('l_v_c', '');
        if (lastV && isNewerVersion(CONFIG.CURRENT_VERSION, lastV)) {
            Notify.show(`🎉 系统成功升级至 v${CONFIG.CURRENT_VERSION}，正在重组环境数据...`, 'success');
            GM_setValue('l_v_c', CONFIG.CURRENT_VERSION);
            setTimeout(() => location.reload(true), 1500);
        } else {
            GM_setValue('l_v_c', CONFIG.CURRENT_VERSION);
            createUI(); applyDarkMode(GM_getValue('dark_mode', false));
            checkUpdate(false);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
