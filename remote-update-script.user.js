// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      3.1.1
// @description  Premium 级全能助手 — 专业仪表盘·深度监控·超级工具集·GitHub 自动同步 (v3.0 旗舰版)
// @author       gao1774420117
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      api.qrserver.com
// @connect      ip-api.com
// @updateURL    https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// @downloadURL  https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ===================== 配置 =====================
    const MANAGER_INFO = `${GM_info.scriptHandler || 'Tampermonkey'} v${GM_info.version || '未知'}`;

    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        VERSION: GM_info.script.version,
        BUILD: '20260403-V3.1-PRO',
        CHANNEL: 'STABLE',
        AUTHOR: 'gao1774420117',
        IS_MIN: GM_getValue('is_minimized', false),
        THEME: GM_getValue('theme', 'purple'), 
        OPACITY: GM_getValue('opacity', 0.98),
        WIDTH: GM_getValue('width', 380),
        TAB_MODE: GM_getValue('tab_mode', 'both'), // icon, text, both
        POS: GM_getValue('pos', { x: 28, y: 28, from: 'bottom-right' }),
        CHANGELOG: [
            { v: '3.1.1', d: '2026/04/03', tag: 'HOTFIX', c: '热修复：恢复随手贴拖动功能（注入丢失函数）、优化 JSON 剪贴板识别、修复页签切换动画中断。' },
            { v: '3.1.0', d: '2026/04/03', tag: 'STABLE', c: '旗舰增强：核心版本算法修复、21项全量工具集合、动态 Monitor 监控图表适配。' }
        ]
    };

    const STATE = {
        toolCallCount: GM_getValue('tool_calls', 0),
        lastSync: GM_getValue('last_sync', '从未同步'),
        injectCount: parseInt(GM_getValue('inject_count', 0)) + 1,
        latency: 0,
        dragging: false,
        fps: 0,
        errors: 0,
        reqs: 0,
        reqLogs: [],
        clipHistory: GM_getValue('clip_hist', []),
        fpsInterval: null,
        chart: null,
        history: GM_getValue('h_data', [])
    };
    GM_setValue('inject_count', STATE.injectCount);

    // ===================== 全局劫持 (监控项) =====================
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        STATE.reqs++;
        return originalFetch.apply(this, args);
    };
    const originalXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        STATE.reqs++;
        return originalXHR.apply(this, arguments);
    };
    window.addEventListener('error', e => { STATE.errors++; });
    window.addEventListener('unhandledrejection', e => { STATE.errors++; });
    document.addEventListener('copy', () => {
        setTimeout(async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && !STATE.clipHistory.includes(text)) {
                    STATE.clipHistory.unshift(text);
                    STATE.clipHistory = STATE.clipHistory.slice(0, 20);
                    GM_setValue('clip_hist', STATE.clipHistory);
                }
            } catch(e) {}
        }, 100);
    });

    // ===================== 通知模块 =====================
    const Notify = (() => {
        let box;
        const C = { info:'#6366f1', success:'#10b981', warning:'#f59e0b', error:'#ef4444' };
        return {
            show(msg, type='info', dur=4000) {
                if (!box) { box = document.createElement('div'); box.id='hap-notifs'; document.body.appendChild(box); }
                const t = document.createElement('div');
                t.className = 'hap-toast';
                const bar = document.createElement('div');
                bar.className = 'hap-toast-bar';
                bar.style.background = C[type] || C.info;
                const body = document.createElement('div');
                body.className = 'hap-toast-body';
                body.textContent = msg;
                t.appendChild(bar); t.appendChild(body);
                box.prepend(t);
                requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
                setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 500); }, dur);
            }
        };
    })();

    // ===================== 核心安全装饰器 =====================
    const safe = (fn, name = '匿名函数') => (...args) => {
        try {
            return fn(...args);
        } catch (e) {
            console.error(`[全能助手] ${name} 执行出错:`, e);
            STATE.errors++;
            Notify.show(`❌ ${name} 执行异常`, 'error');
        }
    };

    // ===================== 系统扫描器 =====================
    const SYS = {
        browser: () => {
            const ua = navigator.userAgent;
            if (ua.includes('Edg/')) return ['Edge', ua.match(/Edg\/(\d+)/)?.[1] || '?'];
            if (ua.includes('OPR/')) return ['Opera', ua.match(/OPR\/(\d+)/)?.[1] || '?'];
            if (ua.includes('Chrome/')) return ['Chrome', ua.match(/Chrome\/(\d+)/)?.[1] || '?'];
            if (ua.includes('Firefox/')) return ['Firefox', ua.match(/Firefox\/(\d+)/)?.[1] || '?'];
            return ['未知', '?'];
        },
        memory: () => {
            const m = performance.memory;
            if (!m) return null;
            const u = Math.round(m.usedJSHeapSize / 1048576);
            const t = Math.round(m.totalJSHeapSize / 1048576);
            return { used: u, total: t, pct: Math.round((u/t)*100) };
        },
        dom: () => document.getElementsByTagName('*').length,
        res: () => `${window.screen.width}×${window.screen.height}`,
        dpr: () => window.devicePixelRatio.toFixed(1),
    };

    // ===================== CSS =====================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        :root {
            /* Softer, Premium Professional Accents */
            --hap-purple-main: #7c4dff; --hap-purple-sec: #b388ff; --hap-purple-rgb: 124,77,255;
            --hap-green-main: #00c853;  --hap-green-sec: #69f0ae;  --hap-green-rgb: 0,200,83;
            --hap-cyan-main: #00b8d4;   --hap-cyan-sec: #84ffff;   --hap-cyan-rgb: 0,184,212;
            --hap-red-main: #ff5252;    --hap-red-sec: #ff8a80;    --hap-red-rgb: 255,82,82;
            --hap-bg: rgba(13, 14, 25, 0.95);
        }

        #hap-root.theme-purple { --hap-main: var(--hap-purple-main); --hap-sec: var(--hap-purple-sec); --hap-rgb: var(--hap-purple-rgb); }
        #hap-root.theme-green  { --hap-main: var(--hap-green-main);  --hap-sec: var(--hap-green-sec);  --hap-rgb: var(--hap-green-rgb); }
        #hap-root.theme-cyan   { --hap-main: var(--hap-cyan-main);   --hap-sec: var(--hap-cyan-sec);   --hap-rgb: var(--hap-cyan-rgb); }
        #hap-root.theme-red    { --hap-main: var(--hap-red-main);    --hap-sec: var(--hap-red-sec);    --hap-rgb: var(--hap-red-rgb); }

        #hap-root, #hap-root * { box-sizing: border-box; font-family: 'Outfit', sans-serif; }

        /* ══════ 主容器 ══════ */
        #hap-root { 
            position: fixed; z-index: 2147483640; 
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, transform 0.3s ease; 
            filter: drop-shadow(0 30px 60px rgba(0,0,0,0.6)); 
            width: ${CONFIG.WIDTH}px; 
        }
        #hap-root.min { width: 72px !important; }

        #hap-inner { 
            background: var(--hap-bg); 
            border-radius: 24px; 
            border: 1px solid rgba(255,255,255,0.1); 
            overflow: hidden; 
            backdrop-filter: blur(20px) saturate(160%); 
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);
            display: flex; flex-direction: column;
        }

        /* ══════ 头部: Aurora Flow ══════ */
        #hap-header { 
            padding: 20px 24px; cursor: move; position: relative; overflow: hidden; 
            background: linear-gradient(-45deg, #0f172a, #1e293b, #0f172a, #020617);
            background-size: 400% 400%; animation: aurora 15s ease infinite;
        }
        @keyframes aurora {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        #hap-header::after { 
            content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; 
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }

        .h-top { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; }
        .hbv { 
            background: rgba(var(--hap-rgb), 0.15); color: var(--hap-main); 
            font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; 
            border: 1px solid rgba(var(--hap-rgb), 0.3);
        }
        .h-btns { display: flex; gap: 4px; }
        .h-icon-btn { 
            width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
            color: rgba(255,255,255,0.4); cursor: pointer; border-radius: 10px; transition: 0.2s;
        }
        .h-icon-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }

        .h-name { font-size: 16px; font-weight: 800; color: #fff; margin-top: 12px; letter-spacing: -0.02em; }
        .h-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; font-weight: 400; }

        /* ══════ 状态条 ══════ */
        #hap-sbar { 
            display: flex; align-items: center; gap: 10px; padding: 8px 24px; 
            background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.03); 
        }
        .sdot { width: 8px; height: 8px; border-radius: 50%; position: relative; }
        .sdot::after { 
            content: ''; position: absolute; inset: -3px; border-radius: 50%; 
            background: inherit; opacity: 0.3; animation: pulse 2s infinite; 
        }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(2.4); opacity: 0; } }
        .s-ok { background: var(--hap-green-main); } 
        .s-wait { background: var(--hap-purple-main); } 
        .s-bad { background: var(--hap-red-main); } 
        .s-unk { background: #64748b; }
        #hap-stext { flex: 1; font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 500; }

        /* ══════ 标签页 ══════ */
        #hap-tabs { 
            display: flex; padding: 12px 16px; gap: 4px; position: relative; 
            background: rgba(0,0,0,0.1); 
        }
        .htab { 
            flex: 1; text-align: center; padding: 10px 0; font-size: 12px; font-weight: 600; 
            cursor: pointer; border-radius: 12px; color: rgba(255,255,255,0.3); transition: 0.3s; z-index: 1;
        }
        .htab.on { color: #fff; }
        .htab-indicator { 
            position: absolute; bottom: 12px; height: 36px; 
            background: rgba(255,255,255,0.06); border-radius: 12px; 
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s; 
            z-index: 0; border: 1px solid rgba(255,255,255,0.08); 
        }

        /* ══════ 内容区 ══════ */
        #hap-collapsible { overflow-y: auto; max-height: calc(100vh - 280px); scroll-behavior: smooth; }
        #hap-body { padding: 16px 20px 24px; position: relative; }
        
        /* Custom Scrollbar */
        #hap-collapsible::-webkit-scrollbar { width: 5px; }
        #hap-collapsible::-webkit-scrollbar-track { background: transparent; }
        #hap-collapsible::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        #hap-collapsible::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .hpane { display: none; width: 100%; opacity: 0; transform: translateY(10px); transition: 0.3s; }
        .hpane.on { display: block; opacity: 1; transform: none; }

        /* Card System */
        .mc { 
            background: rgba(255,255,255,0.03); border-radius: 20px; padding: 16px; margin-bottom: 12px; 
            border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;
        }
        .mc-hd { 
            font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.25); 
            margin-bottom: 12px; display: flex; align-items: center; gap: 8px; letter-spacing: 0.05em;
        }
        .mc-row { 
            display: flex; justify-content: space-between; align-items: center; 
            margin-bottom: 8px; font-size: 13px; 
        }
        .mclb { color: rgba(255,255,255,0.45); font-weight: 400; } 
        .mcvl { color: rgba(255,255,255,0.85); font-weight: 600; }

        /* Tools Grid */
        .tg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .tgi { 
            background: rgba(255,255,255,0.02); border-radius: 18px; padding: 14px 4px; 
            text-align: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); 
            transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tgi:hover { 
            background: rgba(var(--hap-rgb), 0.1); border-color: rgba(var(--hap-rgb), 0.3); 
            transform: translateY(-4px) scale(1.02); box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .tgi-ico { font-size: 22px; display: block; margin-bottom: 6px; transition: 0.3s; }
        .tgi:hover .tgi-ico { transform: scale(1.1); }
        .tgi-lb { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); }

        .hbtn { 
            width: 100%; padding: 14px; border-radius: 16px; border: none; cursor: pointer; 
            font-size: 13px; font-weight: 700; margin-top: 10px; transition: 0.3s; outline: none;
        }
        .btn-main { 
            background: var(--hap-main); color: #fff; 
            box-shadow: 0 8px 16px rgba(var(--hap-rgb), 0.2);
        }
        .btn-main:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(var(--hap-rgb), 0.3); }
        .btn-main:active { transform: translateY(0); }

        /* Mini Ball */
        #hap-mini { 
            display: none; width: 72px; height: 72px; border-radius: 24px; cursor: pointer; 
            background: #0a0820; position: relative; align-items: center; justify-content: center; 
            flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
        }
        #hap-root.min #hap-mini { display: flex; } 
        #hap-root.min #hap-inner { display: none; }
        .mini-ico { font-size: 26px; z-index: 1; } 
        .mini-ver { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 800; z-index: 1; }

        /* Range Sliders */
        input[type="range"] { 
            -webkit-appearance: none; width: 100px; height: 4px; border-radius: 10px; 
            background: rgba(255,255,255,0.1); outline: none; 
        }
        input[type="range"]::-webkit-slider-thumb { 
            -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; 
            background: var(--hap-main); cursor: pointer; 
        }

        /* Notifications (Toast) */
        #hap-notifs { position: fixed; top: 32px; right: 32px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; pointer-events: none; }
        .hap-toast { 
            display: flex; align-items: center; background: rgba(15, 23, 42, 0.9); 
            border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); 
            opacity: 0; transform: translateX(30px) scale(0.9); transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            pointer-events: auto; border: 1px solid rgba(255,255,255,0.08); 
        }
        .hap-toast.in { opacity: 1; transform: none; }
        .hap-toast-bar { width: 6px; align-self: stretch; }
        .hap-toast-body { padding: 14px 22px; color: #fff; font-size: 13px; font-weight: 600; }
    `);

    // ===================== 工具集 =====================
    const Tools = {
        // [1] 随手贴
        note: safe(() => {
            let n = document.getElementById('hap-note-win');
            if (n) { n.style.display = n.style.display==='none'?'block':'none'; return; }
            n = document.createElement('div'); n.id='hap-note-win';
            n.style.cssText='position:fixed;top:100px;left:100px;width:300px;height:300px;background:rgba(15,23,42,0.95);z-index:999999;border-radius:24px;border:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;box-shadow:0 30px 60px rgba(0,0,0,0.6);backdrop-filter:blur(30px);overflow:hidden;';
            n.innerHTML = `<div style="padding:16px 20px;background:rgba(255,255,255,0.03);cursor:move;font-size:11px;font-weight:800;color:rgba(255,255,255,0.4);display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);"><span>STICKY NOTE</span><span onclick="this.parentElement.parentElement.style.display='none'" style="cursor:pointer;color:#fff;font-size:14px;">✕</span></div><textarea style="flex:1;background:transparent;border:none;padding:20px;color:#fff;outline:none;resize:none;font-size:14px;line-height:1.7;font-family:\'Outfit\',sans-serif;">${GM_getValue('n_data','')}</textarea>`;
            document.body.appendChild(n);
            const ta = n.querySelector('textarea');
            ta.oninput = () => GM_setValue('n_data', ta.value);
            makeDraggable(n, n.children[0]);
            Notify.show('随手贴已挂载', 'success');
        }, '随手贴'),

        // [2] 密码生成
        pwd: safe(() => {
            const c='abcdefgABCDEFG0123456789!@#$%^&*';
            let r=''; for(let i=0;i<18;i++) r+=c[Math.floor(Math.random()*c.length)];
            GM_setClipboard(r); Notify.show('🔑 18位强密码已生成并复制', 'success');
        }, '密码生成'),

        // [3] 截图
        shot: safe(() => {
            Notify.show('📸 正在捕捉当前页面...', 'info');
            html2canvas(document.body).then(canvas => {
                const link = document.createElement('a');
                link.download = `screenshot-${Date.now()}.png`;
                link.href = canvas.toDataURL();
                link.click();
                Notify.show('✅ 截图已保存至下载目录', 'success');
            });
        }, '网页截图'),

        // [4] 二维码
        qr: safe(() => {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(location.href)}`;
            const o = document.createElement('div');
            o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(20px);cursor:pointer;';
            o.innerHTML = `<div style="text-align:center"><img src="${url}" style="border:12px solid #fff;border-radius:12px;box-shadow:0 0 50px rgba(255,255,255,0.2);"><p style="color:#fff;margin-top:20px;font-weight:900;letter-spacing:1px;">SCAN TO VISIT</p></div>`;
            o.onclick = () => o.remove(); document.body.appendChild(o);
        }, '二维码'),

        // [5] 取色器
        color: safe(async () => {
            if (!window.EyeDropper) return Notify.show('浏览器不支持取色器 API', 'error');
            const ed = new window.EyeDropper();
            try { const res = await ed.open(); GM_setClipboard(res.sRGBHex); Notify.show('🎨 已取色: '+res.sRGBHex, 'success'); } catch(e){}
        }, '取色器'),

        // [6] JSON美化
        json: safe(async () => {
            let s = window.getSelection().toString();
            if (!s) {
                try { s = await navigator.clipboard.readText(); Notify.show('检测到未选中，自动从剪贴板试读...', 'info'); } 
                catch(e) { return Notify.show('请选中 JSON 文本或授权剪贴板权限', 'warning'); }
            }
            if(!s) return Notify.show('无有效 JSON 输入', 'warning');
            try { 
                const res = JSON.stringify(JSON.parse(s),null,4);
                GM_setClipboard(res); Notify.show('{} JSON 已格式化并存入剪贴板', 'success'); 
            } catch(e){ Notify.show('❌ 无法解析，请检查 JSON 格式', 'error'); }
        }, 'JSON美化'),

        // [7] 网速测试
        speed: safe(() => {
            Notify.show('🚀 正在进行 1MB 下行链接测速...', 'info');
            const start = Date.now();
            fetch('https://raw.githubusercontent.com/gao1774420117-afk/xiuxian-game/main/README.md?t='+start)
                .then(r => r.text())
                .then(t => {
                    const dur = (Date.now() - start) / 1000;
                    const size = new Blob([t]).size / 1024; // KB
                    const speed = (size / dur).toFixed(2);
                    Notify.show(`⚡ 测速完成: ${speed} KB/s`, 'success');
                });
        }, '网速测试'),

        // [8] IP查询
        ip: safe(() => {
            Notify.show('🌐 正在查询出口 IP 信息...', 'info');
            GM_xmlhttpRequest({
                method: 'GET', url: 'http://ip-api.com/json', onload: res => {
                    const d = JSON.parse(res.responseText);
                    Notify.show(`🌍 IP: ${d.query} (${d.city}, ${d.country})`, 'success');
                }
            });
        }, 'IP查询'),

        // [9] Base64
        b64: safe(() => {
            const s = window.getSelection().toString();
            if(!s) return Notify.show('请选中要转换的文本', 'warning');
            const res = btoa(unescape(encodeURIComponent(s)));
            GM_setClipboard(res); Notify.show('🔡 已转换为 Base64 并复制', 'success');
        }, 'Base64'),

        // [10] 时间转换
        unix: safe(() => {
            const s = window.getSelection().toString();
            if(s.match(/^\d+$/)) {
                const d = new Date(parseInt(s) * (s.length===10?1000:1)).toLocaleString();
                Notify.show(`🕒 转换结果: ${d}`, 'info');
            } else {
                const u = Math.floor(Date.now()/1000); GM_setClipboard(u.toString());
                Notify.show(`🕒 当前时间戳 ${u} 已复制`, 'success');
            }
        }, '时间转换'),

        // [11] 页面大扫除 (清广告/清遮罩)
        clean: safe(() => {
            const tags = ['iframe', 'ins', '.adsbygoogle', '[id*="ad-"]', '[class*="ad-"]'];
            let count = 0;
            tags.forEach(t => document.querySelectorAll(t).forEach(e => { e.remove(); count++; }));
            Notify.show(`🧹 大扫除完成，清理了 ${count} 个疑似广告元素`, 'success');
        }, '页面清理'),

        // [12] 开启 FPS
        fps: safe(() => {
            if(STATE.fpsInterval) { clearInterval(STATE.fpsInterval); STATE.fpsInterval=null; Notify.show('FPS 监控已关闭', 'info'); return; }
            let frame=0, last=Date.now();
            STATE.fpsInterval = setInterval(() => {
                const now=Date.now();
                const fps = Math.round(frame / ((now-last)/1000));
                updateStatusBar('ok', `实时帧率: ${fps} FPS`);
                frame=0; last=now;
            }, 1000);
            const count = () => { frame++; if(STATE.fpsInterval) requestAnimationFrame(count); };
            requestAnimationFrame(count);
            Notify.show('📊 FPS 实时监控已开启', 'success');
        }, 'FPS监控'),
        
        // [13] 导出当前 COOKIE
        cookie: safe(() => {
            GM_setClipboard(document.cookie);
            Notify.show('🍪 当前域名 Cookie 已复制到剪贴板', 'success');
        }, 'Cookie导出'),

        // [14] 剪贴板历史
        clip: safe(() => {
            const list = STATE.clipHistory.map((c,i) => `<div class="mc-row"><span class="mclb" style="cursor:pointer" onclick="GM_setClipboard('${c.replace(/'/g,"\\'")}');Notify.show('已复制')">${c.slice(0,30)}...</span></div>`).join('');
            const o = document.createElement('div');
            o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;';
            o.innerHTML = `<div class="mc" style="width:300px;max-height:400px;overflow-y:auto;"><div class="mc-hd">CLIPBOARD HISTORY</div>${list || '暂无历史'}<button class="hbtn" onclick="this.parentElement.parentElement.remove()">关闭</button></div>`;
            document.body.appendChild(o);
        }, '剪贴板历史'),

        // [15] URL 解析
        url: safe(() => {
            const u = new URL(location.href);
            const data = { Host:u.host, Path:u.pathname, Protocol:u.protocol, Params:u.search };
            console.table(data);
            Notify.show('🔗 URL 参数已解析至控制台 (F12)', 'info');
        }, 'URL解析'),

        // [16] 正则测试
        regex: safe(() => {
            const reg = prompt('输入正则表达式 (如 /\\d+/)');
            if(!reg) return;
            const str = window.getSelection().toString() || prompt('输入测试文本');
            const match = str.match(new RegExp(reg.replace(/\/(.*)\//, '$1')));
            Notify.show(match ? `✅ 匹配成功: ${match[0]}` : '❌ 未匹配', match?'success':'warning');
        }, '正则测试'),

        // [17] 资源统计
        res_info: safe(() => {
            const p = performance.getEntriesByType('resource');
            const size = (p.reduce((acc, r) => acc + (r.transferSize || 0), 0) / 1024 / 1024).toFixed(2);
            Notify.show(`📦 页面资源总传输大小: ${size} MB`, 'info');
        }, '资源统计'),

        // [18] 字体预览
        font: safe(() => {
            const f = prompt('输入字体名称 (如 "Microsoft YaHei", "serif")');
            if(f) { document.body.style.fontFamily = f; Notify.show(`🔤 已切换字体为: ${f}`, 'success'); }
        }, '字体预览'),

        // [19] 元素高亮
        highlight: safe(() => {
            Notify.show('🖱️ 请点击页面元素进行高亮', 'info');
            const handler = e => {
                e.preventDefault(); e.stopPropagation();
                e.target.style.outline = '3px dashed var(--hap-main)';
                e.target.style.outlineOffset = '3px';
                document.removeEventListener('click', handler, true);
                Notify.show('✅ 元素已高亮', 'success');
            };
            document.addEventListener('click', handler, true);
        }, '元素高亮'),

        // [20] 字数统计
        count: safe(() => {
            const s = window.getSelection().toString();
            if(!s) return Notify.show('请先选中文字', 'warning');
            Notify.show(`📝 选中计: ${s.length} 字 | ${s.trim().split(/\s+/).length} 词`, 'info');
        }, '字数统计')
    };

    // = [v3.0 核心逻辑] =
    const el = { root: null };
    const updateStatusBar = (type, text) => {
        const dot = document.getElementById('hap-sdot'), txt = document.getElementById('hap-stext');
        if (dot && txt) {
            dot.className = 'sdot s-' + type;
            txt.textContent = text;
            txt.title = text; // 处理过长
        }
    };

    const Security = {
        scan: safe(() => {
            const res = { trackers:0, ads:0, risks:0 };
            const trackers = ['google-analytics', 'googletagmanager', 'facebook', 'baidu', 'doubleclick'];
            document.querySelectorAll('script').forEach(s => { trackers.forEach(t => { if(s.src.includes(t)) res.trackers++; }); });
            document.querySelectorAll('iframe, ins, .adsbygoogle, [id*="ad-"]').forEach(() => res.ads++);
            if (window.devicePixelRatio > 1) res.risks++;
            if (!window.indexedDB) res.risks += 2; // 无痕或隐私保护
            
            const list = document.getElementById('hap-sec-list');
            if(list) list.innerHTML = `
                <div class="mc"><div class="mc-hd">隐私扫描结果</div>
                    <div class="mc-row"><span class="mclb">第三方追踪器</span><span class="mcvl">${res.trackers} 个</span></div>
                    <div class="mc-row"><span class="mclb">广告容器检测</span><span class="mcvl">${res.ads} 个</span></div>
                    <div class="mc-row"><span class="mclb">指纹泄露评分</span><span class="mcvl ${res.risks>2?'pgred':'pggreen'}">${res.risks} / 10</span></div>
                </div>
                <button class="hbtn btn-main" onclick="Tools.clean()">⚡ 立即执行强力广告清理</button>
            `;
        }, '安全扫描')
    };

    const Data = {
        export: safe(() => {
            const data = {};
            const keys = ['theme', 'opacity', 'width', 'n_data', 'pos', 'tool_calls', 'is_minimized'];
            keys.forEach(k => data[k] = GM_getValue(k));
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `hap-config-${Date.now()}.json`; a.click();
            Notify.show('💾 配置已导出为 JSON', 'success');
        }, '数据导出'),
        import: safe(() => {
            const input = document.createElement('input'); input.type = 'file';
            input.onchange = e => {
                const reader = new FileReader();
                reader.onload = ev => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        Object.entries(data).forEach(([k, v]) => GM_setValue(k, v));
                        Notify.show('✅ 配置已导入，请刷新页面应用', 'success');
                        setTimeout(() => location.reload(), 2000);
                    } catch(err) { Notify.show('❌ 导入失败: 无效的 JSON', 'error'); }
                };
                reader.readAsText(e.target.files[0]);
            };
            input.click();
        }, '数据导入')
    };

    const buildUI = safe(() => {
        if (el.root) return;
        el.root = document.createElement('div'); el.root.id = 'hap-root';
        el.root.className = `theme-${CONFIG.THEME} ${CONFIG.IS_MIN?'min':''}`;
        el.root.style.width = CONFIG.WIDTH + 'px';
        el.root.style.opacity = CONFIG.OPACITY;
        const p = CONFIG.POS;
        if (p.from==='bottom-right') { el.root.style.bottom=p.y+'px'; el.root.style.right=p.x+'px'; }
        else { el.root.style.top=p.y+'px'; el.root.style.left=p.x+'px'; }

        el.root.innerHTML = `
            <div id="hap-mini"><div class="mini-ico">🚀</div><div class="mini-ver">v${CONFIG.VERSION}</div></div>
            <div id="hap-inner">
                <div id="hap-header">
                    <div class="h-top">
                        <span class="hbv" id="hap-title-ver">PRO v${CONFIG.VERSION}</span>
                        <div class="h-btns">
                            <div class="h-icon-btn" id="hap-btn-set" title="切换主题">🎨</div>
                            <div class="h-icon-btn" id="hap-btn-min" title="收起面板">➖</div>
                        </div>
                    </div>
                    <div class="h-name">Remote Utility Suite</div>
                    <div class="h-sub">旗舰级全能助手 · ${CONFIG.BUILD}</div>
                </div>
                <div id="hap-sbar">
                    <div class="sdot s-unk" id="hap-sdot"></div>
                    <div id="hap-stext">系统握手完成，欢迎主人</div>
                </div>
                <div id="hap-tabs">
                    <div class="htab-indicator" id="hap-tab-ind"></div>
                    <div class="htab on" data-p="tools">工具</div>
                    <div class="htab" data-p="mon">监控</div>
                    <div class="htab" data-p="sec">安全</div>
                    <div class="htab" data-p="data">数据</div>
                    <div class="htab" data-p="hist">历程</div>
                </div>
                <div id="hap-collapsible"><div id="hap-body">
                    <div class="hpane on" id="pane-tools">
                        <div class="tg">
                            <div class="tgi" onclick="Tools.note()" title="本地快速笔记"><span class="tgi-ico">📝</span><span class="tgi-lb">随手贴</span></div>
                            <div class="tgi" onclick="Tools.pwd()" title="生成 18 位高强度密码"><span class="tgi-ico">🔑</span><span class="tgi-lb">密生成</span></div>
                            <div class="tgi" onclick="Tools.shot()" title="全屏网页截图"><span class="tgi-ico">📸</span><span class="tgi-lb">截图</span></div>
                            <div class="tgi" onclick="Tools.qr()" title="当前 URL 转二维码"><span class="tgi-ico">📱</span><span class="tgi-lb">二维码</span></div>
                            <div class="tgi" onclick="Tools.json()" title="格式化剪贴板 JSON"><span class="tgi-ico">{}</span><span class="tgi-lb">格式化</span></div>
                            <div class="tgi" onclick="Tools.speed()" title="1MB 文件下行测速"><span class="tgi-ico">⚡</span><span class="tgi-lb">网速</span></div>
                            <div class="tgi" onclick="Tools.ip()" title="查看出口 IP 详情"><span class="tgi-ico">🌐</span><span class="tgi-lb">探测</span></div>
                            <div class="tgi" onclick="Tools.unix()" title="时间戳互转"><span class="tgi-ico">🕒</span><span class="tgi-lb">时间</span></div>
                            <div class="tgi" onclick="Tools.clip()" title="查看最近剪贴历史"><span class="tgi-ico">📋</span><span class="tgi-lb">剪贴板</span></div>
                            <div class="tgi" onclick="Tools.url()" title="深解析当前 URL 参数"><span class="tgi-ico">🔗</span><span class="tgi-lb">URL解析</span></div>
                            <div class="tgi" onclick="Tools.regex()" title="实时正则匹配测试"><span class="tgi-ico">⌗</span><span class="tgi-lb">正则</span></div>
                            <div class="tgi" onclick="Tools.font()" title="动态更改页面全局字体"><span class="tgi-ico">🔤</span><span class="tgi-lb">换肤</span></div>
                            <div class="tgi" onclick="Tools.highlight()" title="页面元素交互高亮器"><span class="tgi-ico">🔦</span><span class="tgi-lb">聚光灯</span></div>
                            <div class="tgi" onclick="Tools.count()" title="统计选中文字/字符数"><span class="tgi-ico">∑</span><span class="tgi-lb">计数</span></div>
                            <div class="tgi" onclick="Tools.res_info()" title="分析页面资源加载详情"><span class="tgi-ico">📦</span><span class="tgi-lb">负载</span></div>
                            <div class="tgi" onclick="Tools.clean()" title="清理浮动广告与遮罩"><span class="tgi-ico">🧹</span><span class="tgi-lb">清道夫</span></div>
                            <div class="tgi" onclick="Tools.fps()" title="切换实时 FPS 监测"><span class="tgi-ico">📊</span><span class="tgi-lb">FPS</span></div>
                            <div class="tgi" onclick="Tools.cookie()" title="复制当前域 Cookie"><span class="tgi-ico">🍪</span><span class="tgi-lb">Cookie</span></div>
                            <div class="tgi" onclick="Tools.b64()" title="Base64 快速编解码"><span class="tgi-ico">B64</span><span class="tgi-lb">Base64</span></div>
                        </div>
                        <button class="hbtn btn-main" id="hap-btn-upd">✨ 点击检查云端版本更新</button>
                    </div>
                    <div class="hpane" id="pane-mon">
                        <div id="hap-mon-list"></div>
                        <div class="mc" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.03);">
                            <canvas id="hap-chart" width="320" height="150" style="margin:0 auto; display:block;"></canvas>
                        </div>
                    </div>
                    <div class="hpane" id="pane-sec" id="hap-sec-list">
                        <div class="mc" style="text-align:center; padding:40px 20px;">
                            <div style="font-size:32px; margin-bottom:15px;">🛡️</div>
                            <div style="font-size:14px; color:#fff; font-weight:700; margin-bottom:8px;">点击下方标签开始扫描</div>
                            <div style="font-size:11px; color:rgba(255,255,255,0.4);">系统将分析当前页面的隐私泄露风险</div>
                        </div>
                    </div>
                    <div class="hpane" id="pane-data">
                        <div class="mc"><div class="mc-hd">数据云同步系统</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                <button class="hbtn" style="background:rgba(255,255,255,0.05);color:#fff;margin-top:0" onclick="Data.export()">📤 导出</button>
                                <button class="hbtn" style="background:rgba(255,255,255,0.05);color:#fff;margin-top:0" onclick="Data.import()">📥 导入</button>
                            </div>
                        </div>
                        <div class="mc"><div class="mc-hd">个性化视觉控制</div>
                            <div class="mc-row"><span class="mclb">面板不透明度</span><input type="range" min="0.5" max="1" step="0.01" value="${CONFIG.OPACITY}" oninput="document.getElementById('hap-root').style.opacity=this.value;GM_setValue('opacity',this.value)"></div>
                            <div class="mc-row"><span class="mclb">标准宽度选择</span>
                                <select style="background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:4px 10px; font-size:12px; outline:none;" onchange="document.getElementById('hap-root').style.width=this.value+'px';GM_setValue('width',this.value)">
                                    <option value="320" ${CONFIG.WIDTH==320?'selected':''}>小型 (320px)</option>
                                    <option value="380" ${CONFIG.WIDTH==380?'selected':''}>标准 (380px)</option>
                                    <option value="440" ${CONFIG.WIDTH==440?'selected':''}>宽屏 (440px)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="hpane" id="pane-hist">${CONFIG.CHANGELOG.map(l=>`<div class="mc"><div class="mc-hd">v${l.v} · ${l.d}</div><div style="font-size:10px;color:rgba(255,255,255,0.4)">${l.c}</div></div>`).join('')}</div>
                </div></div>
            </div>
        `;
        document.body.appendChild(el.root);
        bindEvents();
    }, 'UI构建');

    const bindEvents = () => {
        document.getElementById('hap-btn-min').onclick = () => { el.root.classList.add('min'); GM_setValue('is_minimized', true); };
        document.getElementById('hap-mini').onclick = () => { el.root.classList.remove('min'); GM_setValue('is_minimized', false); };
        document.getElementById('hap-btn-set').onclick = () => {
            const themes = ['purple', 'green', 'cyan', 'red'];
            const next = themes[(themes.indexOf(CONFIG.THEME)+1)%themes.length];
            el.root.className = `theme-${next} ${CONFIG.IS_MIN?'min':''}`;
            CONFIG.THEME = next; GM_setValue('theme', next);
            Notify.show(`🎨 已切换至 ${next.toUpperCase()} 主题`, 'success');
        };
        document.querySelectorAll('.htab').forEach(t => t.onclick = () => {
            const tabs = document.querySelectorAll('.htab'), panes = document.querySelectorAll('.hpane');
            const targetPane = document.getElementById('pane-' + t.dataset.p);
            if (targetPane.classList.contains('on')) return;

            tabs.forEach(x => x.classList.remove('on'));
            t.classList.add('on');

            const currentPane = document.querySelector('.hpane.on');
            if (currentPane) {
                currentPane.classList.remove('on');
                setTimeout(() => { currentPane.style.display = 'none'; }, 300); // 匹配 CSS transition
            }

            targetPane.style.display = 'block';
            setTimeout(() => { targetPane.classList.add('on'); }, 10);
            
            const ind = document.getElementById('hap-tab-ind');
            ind.style.width = t.offsetWidth + 'px';
            ind.style.transform = `translateX(${t.offsetLeft - 16}px)`;
            if (t.dataset.p === 'sec') Security.scan();
        });
        document.getElementById('hap-btn-upd').onclick = () => checkUpdate(true);
        const hd = document.getElementById('hap-header');
        hd.onmousedown = e => {
            if (e.target.closest('.h-btns')) return;
            STATE.dragging=true; const r=el.root.getBoundingClientRect(); const ox=e.clientX-r.left, oy=e.clientY-r.top;
            const move = ev => { if(STATE.dragging) { el.root.style.left=(ev.clientX-ox)+'px'; el.root.style.top=(ev.clientY-oy)+'px'; el.root.style.bottom='auto'; el.root.style.right='auto'; } };
            const up = () => { STATE.dragging=false; const rect=el.root.getBoundingClientRect(); GM_setValue('pos',{x:rect.left,y:rect.top,from:'top-left'}); document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); };
            document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
        };
        // 快捷键
        document.addEventListener('keydown', e => {
            if(e.altKey && e.code==='KeyQ') { el.root.classList.contains('min')?document.getElementById('hap-mini').click():document.getElementById('hap-btn-min').click(); }
            if(e.altKey && e.code==='KeyU') checkUpdate(true);
        });
    };

    const updateCharts = safe(() => {
        if (!window.Chart || !document.getElementById('hap-chart')) return;
        const ctx = document.getElementById('hap-chart').getContext('2d');
        const mainColor = getComputedStyle(el.root).getPropertyValue('--hap-main').trim() || '#6366f1';
        
        if (!STATE.chart) {
            STATE.chart = new Chart(ctx, {
                type: 'line',
                data: { labels: Array(15).fill(''), datasets: [{ label: 'Memory (MB)', data: Array(15).fill(0), borderColor: mainColor, tension: 0.4, fill: true, backgroundColor: mainColor.replace(')', ',0.1)').replace('rgb', 'rgba') }] },
                options: { responsive: false, animation: { duration: 800 }, scales: { y: { display: false }, x: { display: false } }, plugins: { legend: { display: false } } }
            });
        } else {
            STATE.chart.data.datasets[0].borderColor = mainColor;
            STATE.chart.data.datasets[0].backgroundColor = mainColor + '1A'; // 10% opacity in hex approx
        }
        const m = SYS.memory();
        if (m) {
            STATE.chart.data.datasets[0].data.push(m.used);
            STATE.chart.data.datasets[0].data.shift();
            STATE.chart.update();
        }
    }, '图表更新理论');

    const checkUpdate = safe((manual=false) => {
        const isNewer = (v1, v2) => {
            const a = v1.split('.').map(Number), b = v2.split('.').map(Number);
            for (let i = 0; i < Math.max(a.length, b.length); i++) {
                if ((a[i] || 0) > (b[i] || 0)) return true;
                if ((a[i] || 0) < (b[i] || 0)) return false;
            }
            return false;
        };

        updateStatusBar('wait', '正在检查更新...');
        GM_xmlhttpRequest({
            method:'GET', url:CONFIG.UPDATE_URL+'?t='+Date.now(), onload: res => {
                const m = res.responseText.match(/@version\s+([\d.]+)/);
                if (m && isNewer(m[1], CONFIG.VERSION)) { 
                    updateStatusBar('bad', '发现新版本 v'+m[1]); 
                    if(confirm(`发现新版本 v${m[1]}，是否更新至旗舰版？`)) GM_openInTab(CONFIG.UPDATE_URL); 
                } else if (m) {
                    updateStatusBar('ok', '旗舰版已是最新'); 
                    if(manual) Notify.show('当前已是最新旗舰版 (v' + CONFIG.VERSION + ')', 'success'); 
                } else {
                    updateStatusBar('unk', '版本检测失败');
                    if(manual) Notify.show('无法获取远程版本信息', 'error');
                }
            },
            onerror: () => {
                updateStatusBar('bad', '网络请求失败');
                if(manual) Notify.show('连不上更新服务器，请检查网络', 'error');
            }
        });
    }, '更新检查');

    setInterval(() => {
        if (!el.root) return;
        const mon = document.getElementById('pane-mon'), ml = document.getElementById('hap-mon-list');
        if (mon.classList.contains('on') && ml) {
            const m = SYS.memory();
            ml.innerHTML = `
                <div class="mc"><div class="mc-hd">核心性能指数</div>
                <div class="mc-row"><span class="mclb">JS 堆内存</span><span class="mcvl">${m?m.used+'MB / '+m.total+'MB':'不支持'}</span></div>
                <div class="mc-row"><span class="mclb">DOM 节点数</span><span class="mcvl">${SYS.dom()} 个</span></div>
                <div class="mc-row"><span class="mclb">网络请求数</span><span class="mcvl">${STATE.reqs} 次</span></div>
                <div class="mc-row"><span class="mclb">运行时错误</span><span class="mcvl ${STATE.errors>0?'pgred':''}">${STATE.errors} 个</span></div>
                </div>
            `;
            updateCharts();
        }
    }, 2000);

    const makeDraggable = (el, handle) => {
        let ox, oy, isDown = false;
        handle.onmousedown = e => {
            isDown = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
            document.onmousemove = ev => { if(isDown) { el.style.left = (ev.clientX - ox) + 'px'; el.style.top = (ev.clientY - oy) + 'px'; } };
            document.onmouseup = () => { isDown = false; document.onmousemove = null; };
        };
    };

    const init = () => { buildUI(); setTimeout(() => checkUpdate(false), 2000); };
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
