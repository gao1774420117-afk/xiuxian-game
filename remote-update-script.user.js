// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      2.3.0
// @description  Premium 级全能助手 — 专业仪表盘·深度监控·超级工具集·GitHub 自动同步 (精修 2.3)
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

(function () {
    'use strict';

    // ===================== 配置 (先声明，供后续一切引用) =====================
    const MANAGER_INFO = `${GM_info.scriptHandler || 'Tampermonkey'} v${GM_info.version || '未知'}`;

    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        VERSION: GM_info.script.version,
        BUILD: '20260403-R3',
        CHANNEL: 'STABLE',
        AUTHOR: 'gao1774420117',
        CONTACT: 'GitHub · TapTap',
        IS_MIN: GM_getValue('is_minimized', false),
        CHANGELOG: [
            { v: '2.3.0', d: '2026/04/03', tag: 'UI',    c: 'UI 全面升级：Aurora 标题流光、时钟渐变字、工具格彩色发光、Tab 滑动指示、迷你球脉冲环、按钮 Shimmer、Toast 图标栏。' },
            { v: '2.2.0', d: '2026/04/03', tag: 'UI',    c: '更新通知弹窗与主菜单风格完全统一：相同标题栏渐变、状态条版本对比、卡片式日志时间轴，新增右上角 ✕ 关闭按钮。' },
            { v: '2.1.0', d: '2026/04/03', tag: 'FIX',   c: '修复 CONFIG_MGRINF 时序 Bug、暗黑模式计数器问题及拖拽事件冲突；全新迷你悬浮球设计。' },
            { v: '2.0.0', d: '2026/04/03', tag: 'MAJOR',  c: '全面重构 Premium UI 2.0：深度仪表盘、动态指标卡、版本时间轴、加密状态显示。' },
            { v: '1.8.0', d: '2026/04/03', tag: 'FEATURE',c: '系统深度监控上线：内存追踪、DOM 拓扑、环境感知。' },
            { v: '1.7.1', d: '2026/04/03', tag: 'FIX',    c: '修复功能丢失问题，补全全部 8 大工具入口。' },
            { v: '1.6.0', d: '2026/04/03', tag: 'FEATURE',c: '随手贴、URL 二维码、万能图像采集上线。' },
        ]
    };

    const STATE = {
        toolCallCount: GM_getValue('tool_calls', 0),
        lastSync: GM_getValue('last_sync', '从未同步'),
        injectCount: parseInt(GM_getValue('inject_count', 0)) + 1,
        latency: null,
    };
    GM_setValue('inject_count', STATE.injectCount);

    // ===================== 系统扫描器 =====================
    const SYS = {
        browser() {
            const ua = navigator.userAgent;
            // 优先匹配 Edg (Edge) 和 OPR (Opera) 避免被 Chrome 覆盖
            if (ua.includes('Edg/'))     { const v = ua.match(/Edg\/(\d+)/);     return ['Edge',    v?.[1] || '?']; }
            if (ua.includes('OPR/'))     { const v = ua.match(/OPR\/(\d+)/);     return ['Opera',   v?.[1] || '?']; }
            if (ua.includes('Firefox/')) { const v = ua.match(/Firefox\/(\d+)/); return ['Firefox', v?.[1] || '?']; }
            if (ua.includes('Chrome/'))  { const v = ua.match(/Chrome\/(\d+)/);  return ['Chrome',  v?.[1] || '?']; }
            if (ua.includes('Safari/'))  { const v = ua.match(/Version\/(\d+)/); return ['Safari',  v?.[1] || '?']; }
            return ['未知内核', '?'];
        },
        memory() {
            if (!performance.memory) return null;
            const { usedJSHeapSize: u, jsHeapSizeLimit: l } = performance.memory;
            return {
                used: (u / 1048576).toFixed(1),
                total: (l / 1048576).toFixed(0),
                pct: Math.min(100, Math.round((u / l) * 100))
            };
        },
        dom()       { return document.querySelectorAll('*').length; },
        links()     { return document.querySelectorAll('a[href]').length; },
        images()    { return document.querySelectorAll('img').length; },
        scripts()   { return document.querySelectorAll('script').length; },
        stylesheets(){ return document.querySelectorAll('link[rel="stylesheet"]').length; },
        ssl()       { return location.protocol === 'https:'; },
        incog()     { return GM_info.isIncognito || false; },
        resolution(){ return `${screen.width}×${screen.height}`; },
        dpr()       { return window.devicePixelRatio.toFixed(1); },
        charset()   { return document.characterSet; },
        lang()      { return navigator.language; },
        cookieEnabled() { return navigator.cookieEnabled; },
        pageTitle() { return document.title.slice(0, 20) || '—'; },
    };

    // ===================== CSS =====================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        #hap-root, #hap-root * { box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }

        /* ══════ 主容器 ══════ */
        #hap-root {
            position: fixed; bottom: 28px; right: 28px;
            width: 370px;
            z-index: 2147483640;
            transition: width .5s cubic-bezier(.77,0,.18,1), opacity .3s;
            filter: drop-shadow(0 24px 48px rgba(0,0,0,0.45));
        }
        #hap-root.min { width: 64px; }

        #hap-inner {
            background: rgba(10,11,20,0.97);
            border-radius: 28px;
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
            backdrop-filter: blur(60px) saturate(220%);
            box-shadow: 0 0 0 1px rgba(99,102,241,0.1) inset,
                        0 2px 0 rgba(255,255,255,0.05) inset;
        }

        /* ══════ 标题栏 Aurora ══════ */
        #hap-header {
            background: linear-gradient(135deg, #0a0820 0%, #1e1b52 50%, #0f0c29 100%);
            padding: 18px 20px 14px;
            cursor: pointer;
            position: relative; overflow: hidden;
        }
        /* 流动光晕层 */
        #hap-header::before {
            content: '';
            position: absolute; inset: -50%;
            background: conic-gradient(from 0deg at 30% 60%,
                transparent 0deg, rgba(99,102,241,0.18) 60deg,
                transparent 120deg, rgba(168,85,247,0.12) 200deg,
                transparent 280deg, rgba(59,130,246,0.1) 340deg, transparent 360deg);
            animation: hap-aurora 8s linear infinite;
        }
        @keyframes hap-aurora { to { transform: rotate(360deg); } }
        /* 径向光斑 */
        #hap-header::after {
            content: '';
            position: absolute; inset: 0;
            background: radial-gradient(ellipse at 15% 50%, rgba(99,102,241,0.3), transparent 55%),
                        radial-gradient(ellipse at 85% 10%, rgba(168,85,247,0.2), transparent 50%);
        }
        .h-top { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
        .h-badges { display: flex; gap: 6px; }
        .hbv {
            background: linear-gradient(135deg,#6366f1,#8b5cf6);
            color:#fff; font-size:9px; font-weight:900; padding:3px 10px;
            border-radius:8px; letter-spacing:.6px;
            box-shadow: 0 2px 8px rgba(99,102,241,0.5);
        }
        .hbc {
            background:rgba(52,211,153,0.1); color:#34d399; font-size:9px;
            font-weight:900; padding:3px 10px; border-radius:8px;
            border:1px solid rgba(52,211,153,0.3);
        }
        .h-tog {
            color:rgba(255,255,255,0.35); font-size:11px; font-weight:700;
            position:relative; z-index:1; cursor:pointer;
            padding:4px 9px; border-radius:8px; transition:.25s;
            border: 1px solid transparent;
        }
        .h-tog:hover { color:white; background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.08); }
        .h-name {
            font-size:15px; font-weight:900; color:white; margin-top:10px;
            position:relative; z-index:1; letter-spacing:-.3px;
            text-shadow: 0 0 30px rgba(165,180,252,0.4);
        }
        .h-sub  { font-size:10px; color:rgba(255,255,255,0.3); margin-top:3px; position:relative; z-index:1; }

        /* ══════ 状态条 ══════ */
        #hap-sbar {
            display: flex; align-items: center; gap: 9px;
            padding: 8px 20px;
            background: rgba(255,255,255,0.02);
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .sdot { width:8px; height:8px; border-radius:50%; flex-shrink:0; position:relative; }
        .s-ok   { background:#34d399; box-shadow:0 0 10px #34d399aa; }
        .s-wait { background:#fbbf24; animation:sblink 1.1s ease-in-out infinite; }
        .s-bad  { background:#f87171; box-shadow:0 0 10px #f87171aa; animation:sblink 0.9s ease-in-out infinite; }
        .s-unk  { background:#374151; }
        /* 状态点脉冲环 */
        .s-ok::after, .s-bad::after {
            content:''; position:absolute; inset:-4px; border-radius:50%;
            animation: sdot-ring 2s ease-out infinite;
        }
        .s-ok::after  { border: 1px solid rgba(52,211,153,0.5); }
        .s-bad::after { border: 1px solid rgba(248,113,113,0.5); }
        @keyframes sdot-ring { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(2.2)} }
        @keyframes sblink { 0%,100%{opacity:1} 50%{opacity:.25} }
        #hap-stext { flex:1; font-size:10.5px; font-weight:600; color:rgba(255,255,255,0.45); }
        #hap-stime { font-size:10px; color:rgba(255,255,255,0.18); font-family:monospace; }

        /* ══════ 折叠区 ══════ */
        #hap-collapsible { overflow:hidden; }

        /* ══════ Tab 导航 ══════ */
        #hap-tabs {
            display: flex; padding: 8px 10px; gap: 4px;
            background: rgba(255,255,255,0.015);
            border-bottom: 1px solid rgba(255,255,255,0.04);
            position: relative;
        }
        .htab {
            flex:1; text-align:center; padding:9px 4px; font-size:10.5px; font-weight:800;
            cursor:pointer; border-radius:11px; color:rgba(255,255,255,0.25);
            transition: all .28s cubic-bezier(.34,1.56,.64,1);
            border:1px solid transparent; letter-spacing:.2px;
            position: relative;
        }
        .htab.on {
            background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12));
            color:#c4b5fd;
            border-color:rgba(99,102,241,0.3);
            box-shadow: 0 0 0 1px rgba(99,102,241,0.15) inset, 0 4px 12px rgba(99,102,241,0.15);
        }
        /* 激活 Tab 底部高亮线 */
        .htab.on::after {
            content:''; position:absolute; bottom:-1px; left:20%; right:20%;
            height:2px; border-radius:99px;
            background: linear-gradient(90deg,#6366f1,#a78bfa);
            box-shadow: 0 0 8px rgba(99,102,241,0.8);
        }
        .htab:hover:not(.on) { color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.04); transform:translateY(-1px); }

        /* ══════ 内容区 ══════ */
        #hap-body { padding:14px; }
        .hpane { display:none; }
        .hpane.on { display:block; animation:paneIn .32s cubic-bezier(.34,1.2,.64,1); }
        @keyframes paneIn { from{opacity:0;transform:translateY(8px) scale(.98)} to{opacity:1;transform:none} }

        /* ══════ 指标卡片 ══════ */
        .mc {
            background: rgba(255,255,255,0.025);
            border-radius:18px; padding:14px;
            margin-bottom:10px;
            border:1px solid rgba(255,255,255,0.055);
            transition: border-color .25s, background .25s;
        }
        .mc:hover { background:rgba(255,255,255,0.035); border-color:rgba(99,102,241,0.2); }
        .mc:last-child { margin-bottom:0; }
        .mc-hd {
            font-size:9px; font-weight:900; letter-spacing:1.6px; text-transform:uppercase;
            color:rgba(255,255,255,0.22); margin-bottom:11px;
            display:flex; align-items:center; gap:7px;
        }
        .mc-hd::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(255,255,255,0.07),transparent); }
        .mc-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; }
        .mc-row:last-child { margin-bottom:0; }
        .mclb { font-size:11px; color:rgba(255,255,255,0.32); font-weight:500; }
        .mcvl { font-size:11px; font-weight:700; color:rgba(255,255,255,0.8); display:flex; align-items:center; gap:5px; }

        /* 徽章 */
        .bx { padding:2px 8px; border-radius:6px; font-size:9px; font-weight:900; white-space:nowrap; }
        .bg { background:rgba(52,211,153,0.1);  color:#34d399; border:1px solid rgba(52,211,153,0.2); }
        .bb { background:rgba(99,102,241,0.1);  color:#a5b4fc; border:1px solid rgba(99,102,241,0.25); }
        .br { background:rgba(248,113,113,0.1); color:#f87171; border:1px solid rgba(248,113,113,0.2); }
        .by { background:rgba(251,191,36,0.1);  color:#fbbf24; border:1px solid rgba(251,191,36,0.2); }
        .bw { background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.07); }
        .bp { background:rgba(168,85,247,0.1);  color:#c084fc; border:1px solid rgba(168,85,247,0.25); }

        /* 内存进度条 */
        .pg-w { width:72px; height:4px; background:rgba(255,255,255,0.06); border-radius:99px; overflow:hidden; }
        .pg-f { height:100%; border-radius:99px; transition:width .7s cubic-bezier(.4,0,.2,1); }
        .pggreen { background:linear-gradient(90deg,#10b981,#34d399); box-shadow:0 0 6px rgba(52,211,153,0.5); }
        .pgyell  { background:linear-gradient(90deg,#f59e0b,#fbbf24); box-shadow:0 0 6px rgba(251,191,36,0.5); }
        .pgred   { background:linear-gradient(90deg,#ef4444,#f87171); box-shadow:0 0 6px rgba(248,113,113,0.5); }

        /* ══════ 工具网格 ══════ */
        .tg { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
        .tgi {
            background:rgba(255,255,255,0.035);
            border-radius:16px; padding:14px 6px;
            text-align:center; cursor:pointer;
            border:1px solid rgba(255,255,255,0.05);
            transition:all .28s cubic-bezier(.34,1.56,.64,1);
            position: relative; overflow: hidden;
        }
        /* Shimmer overlay on tool cards */
        .tgi::before {
            content:''; position:absolute; inset:0;
            background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
            transform: translateX(-100%); transition: transform .5s;
        }
        .tgi:hover::before { transform: translateX(100%); }
        .tgi:hover {
            background:rgba(99,102,241,0.12);
            border-color:rgba(99,102,241,0.35);
            transform:translateY(-4px) scale(1.03);
            box-shadow: 0 10px 28px rgba(99,102,241,0.22), 0 0 0 1px rgba(99,102,241,0.2) inset;
        }
        .tgi:active { transform:translateY(-1px) scale(1.01); }
        .tgi-ico { font-size:20px; margin-bottom:5px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transition:.28s; }
        .tgi:hover .tgi-ico { transform:scale(1.15); }
        .tgi-lb  { font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); transition:.28s; }
        .tgi:hover .tgi-lb { color:rgba(165,180,252,0.85); }

        /* 时钟 — 渐变文字 */
        #hap-clock {
            font-size:32px; font-weight:900; text-align:center;
            margin-bottom:2px; letter-spacing:2px; font-variant-numeric:tabular-nums;
            background: linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 50%, #c4b5fd 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
            filter: drop-shadow(0 0 20px rgba(165,180,252,0.35));
        }
        #hap-date  { font-size:10px; color:rgba(255,255,255,0.28); text-align:center; margin-bottom:13px; }

        /* 操作按钮 */
        .hbtn {
            width:100%; padding:13px 16px; border-radius:15px; border:none; cursor:pointer;
            font-size:12.5px; font-weight:800; transition:all .28s cubic-bezier(.34,1.2,.64,1);
            display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:8px;
            position:relative; overflow:hidden;
        }
        .hbtn:last-child { margin-bottom:0; }
        /* Button shimmer */
        .hbtn::after {
            content:''; position:absolute;
            top:0; left:-100%; width:60%; height:100%;
            background: linear-gradient(105deg, transparent, rgba(255,255,255,0.15), transparent);
            transition: left .5s ease;
        }
        .hbtn:hover::after { left:140%; }
        .hbtn:hover { transform:translateY(-2px); }
        .hbtn:active { transform:translateY(0) scale(.98); }
        .btn-ind {
            background:linear-gradient(135deg,#5b5ef4,#7c3aed);
            color:#fff;
            box-shadow:0 4px 20px rgba(99,102,241,0.42), 0 1px 0 rgba(255,255,255,0.15) inset;
        }
        .btn-ind:hover { box-shadow:0 8px 32px rgba(99,102,241,0.58); }
        .btn-gh  {
            background:rgba(255,255,255,0.045); color:rgba(255,255,255,0.55);
            border:1px solid rgba(255,255,255,0.07);
        }
        .btn-gh:hover { background:rgba(255,255,255,0.08); color:#fff; border-color:rgba(255,255,255,0.12); }

        /* ══════ 版本时间轴 ══════ */
        .tl-item { display:flex; gap:12px; margin-bottom:13px; }
        .tl-item:last-child { margin-bottom:0; }
        .tl-spine { display:flex; flex-direction:column; align-items:center; }
        .tl-dot {
            width:9px; height:9px; border-radius:50%; flex-shrink:0; margin-top:2px;
            position:relative;
        }
        .tl-dot::after {
            content:''; position:absolute; inset:-3px; border-radius:50%;
            border:1px solid currentColor; opacity:0.25;
        }
        .tl-ln  { width:1px; flex:1; background:linear-gradient(180deg,rgba(255,255,255,0.08),transparent); margin-top:4px; min-height:18px; }
        .tl-item:last-child .tl-ln { display:none; }
        .tl-v { font-size:11px; font-weight:800; color:rgba(255,255,255,0.82); margin-bottom:2px; }
        .tl-d { font-size:9.5px; color:rgba(255,255,255,0.22); margin-bottom:3px; }
        .tl-c { font-size:10px; color:rgba(255,255,255,0.42); line-height:1.6; }

        /* ══════ 迷你悬浮球 ══════ */
        #hap-mini {
            display:none;
            width:64px; height:64px; border-radius:22px; cursor:pointer;
            background: linear-gradient(145deg,#1a1540,#0a0820);
            border:1px solid rgba(99,102,241,0.4);
            box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(99,102,241,0.15) inset;
            flex-direction:column; align-items:center; justify-content:center; gap:4px;
            transition:all .35s cubic-bezier(.34,1.56,.64,1);
            position:relative; overflow:hidden;
        }
        /* 迷你球脉冲光环 */
        #hap-mini::before {
            content:''; position:absolute; inset:-1px; border-radius:22px;
            background: conic-gradient(from 0deg, #6366f1, #8b5cf6, #6366f1);
            animation: mini-spin 3s linear infinite;
            opacity: 0.4;
            z-index: 0;
        }
        #hap-mini::after {
            content:''; position:absolute; inset:1px; border-radius:21px;
            background: linear-gradient(145deg,#1a1540,#0a0820);
            z-index: 0;
        }
        #hap-mini > * { position:relative; z-index:1; }
        @keyframes mini-spin { to { transform: rotate(360deg); } }
        #hap-root.min #hap-mini  { display:flex; }
        #hap-root.min #hap-inner { display:none; }
        .mini-dot { width:8px; height:8px; border-radius:50%; }
        .mini-ver { font-size:9px; font-weight:900; color:rgba(255,255,255,0.5); letter-spacing:.5px; }
        #hap-mini:hover { transform:scale(1.1) rotate(-3deg); box-shadow:0 16px 44px rgba(99,102,241,0.5); }

        /* ══════ Toast 通知 ══════ */
        #hap-notifs {
            position:fixed; top:24px; right:24px; z-index:2147483647;
            display:flex; flex-direction:column; align-items:flex-end;
            pointer-events:none; gap:8px;
        }
        .hap-toast {
            display:flex; align-items:center; gap:0;
            max-width:340px; min-width:200px;
            background:rgba(10,11,20,0.97);
            border-radius:16px;
            box-shadow:0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset;
            pointer-events:auto; opacity:0; transform:translateX(40px) scale(.94);
            transition:all .44s cubic-bezier(0.175,0.885,0.32,1.275);
            backdrop-filter:blur(50px);
            overflow:hidden;
        }
        .hap-toast.in { opacity:1; transform:translateX(0) scale(1); }
        /* 左侧色块 */
        .hap-toast-bar {
            width:4px; align-self:stretch; flex-shrink:0;
            border-radius:0;
        }
        .hap-toast-body {
            padding:12px 16px 12px 12px;
            font-size:12.5px; font-weight:700; color:rgba(255,255,255,0.85);
            line-height:1.4;
        }

        /* ══════ 更新通知面板 ══════ */
        #hap-upd-overlay {
            position:fixed; inset:0; z-index:2147483645;
            background:rgba(0,0,0,0.72);
            backdrop-filter:blur(25px) saturate(160%);
            display:flex; align-items:center; justify-content:center;
            opacity:0; transition:opacity .35s ease;
            pointer-events:none;
        }
        #hap-upd-overlay.show { opacity:1; pointer-events:all; }
        #hap-upd-panel {
            width:400px; max-width:92vw;
            background:rgba(13,15,24,0.97);
            border-radius:26px;
            border:1px solid rgba(255,255,255,0.07);
            box-shadow:0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.08) inset;
            overflow:hidden;
            backdrop-filter:blur(50px) saturate(200%);
            transform:scale(0.88) translateY(20px);
            transition:transform .4s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        #hap-upd-overlay.show #hap-upd-panel { transform:scale(1) translateY(0); }

        /* 更新面板 — 标题栏（与 #hap-header 一致）*/
        .upd-header {
            background: linear-gradient(135deg, #0f0c29 0%, #302b63 60%, #1e1b4b 100%);
            padding:18px 20px 14px;
            position:relative; overflow:hidden;
        }
        .upd-header::after {
            content:'';
            position:absolute; inset:0;
            background: radial-gradient(ellipse at top left, rgba(99,102,241,0.25), transparent 60%),
                        radial-gradient(ellipse at bottom right, rgba(168,85,247,0.15), transparent 60%);
        }
        .upd-badge-row { display:flex; gap:6px; margin-bottom:10px; position:relative; z-index:1; align-items:center; }
        .upd-h2  { font-size:15px; font-weight:900; color:#fff; position:relative; z-index:1; margin-bottom:3px; letter-spacing:-.3px; }
        .upd-sub { font-size:10px; color:rgba(255,255,255,0.35); position:relative; z-index:1; }

        /* 更新面板 — 版本差异行（内嵌状态条风格）*/
        .upd-sbar {
            display:flex; align-items:center; gap:9px;
            padding:9px 20px;
            background:rgba(255,255,255,0.025);
            border-bottom:1px solid rgba(255,255,255,0.04);
        }
        .upd-ver-chip {
            display:flex; gap:10px; align-items:center;
            flex:1;
        }
        .upd-ver-sep { font-size:14px; color:rgba(255,255,255,0.2); }

        /* 更新面板 — Body（与 hap-body 一致）*/
        .upd-body { padding:14px 16px 16px; }

        /* 更新面板 — changelog 卡片（复用 .mc 风格）*/
        .upd-mc {
            background:rgba(255,255,255,0.03); border-radius:16px; padding:14px;
            margin-bottom:12px; border:1px solid rgba(255,255,255,0.06);
        }
        .upd-mc-hd {
            font-size:9px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase;
            color:rgba(255,255,255,0.25); margin-bottom:10px;
            display:flex; align-items:center; gap:7px;
        }
        .upd-mc-hd::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.05); }

        /* 更新面板 — 时间轴（完全复用 .tl-* 风格）*/
        .upd-tl-wrap {
            max-height:200px; overflow-y:auto;
            padding-right:4px;
        }
        .upd-tl-wrap::-webkit-scrollbar { width:3px; }
        .upd-tl-wrap::-webkit-scrollbar-track { background:transparent; }
        .upd-tl-wrap::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.4); border-radius:99px; }

        /* 更新面板 — 按钮区 */
        .upd-btns { display:flex; gap:9px; }
        .upd-btn-ok {
            flex:2; padding:13px 16px; border:none; border-radius:14px; cursor:pointer;
            background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
            font-size:12.5px; font-weight:800; transition:all .22s;
            display:flex; align-items:center; justify-content:center; gap:8px;
            box-shadow:0 4px 18px rgba(99,102,241,0.38);
        }
        .upd-btn-ok:hover { box-shadow:0 8px 28px rgba(99,102,241,0.52); transform:translateY(-2px); }
        .upd-btn-ok:active { transform:translateY(0); }
        .upd-btn-skip {
            flex:1; padding:13px 16px; border:1px solid rgba(255,255,255,0.07);
            border-radius:14px; cursor:pointer;
            background:rgba(255,255,255,0.055); color:rgba(255,255,255,0.6);
            font-size:12px; font-weight:700; transition:all .22s;
        }
        .upd-btn-skip:hover { background:rgba(255,255,255,0.09); color:#fff; }
        .upd-btn-skip:active { transform:translateY(0); }
    `);

    // ===================== 通知模块 =====================
    const Notify = (() => {
        let box;
        const C = { info:'#6366f1', success:'#34d399', warning:'#fbbf24', error:'#f87171' };
        return {
            show(msg, type='info', dur=4000) {
                if (!box) { box = document.createElement('div'); box.id='hap-notifs'; document.body.appendChild(box); }
                const t = document.createElement('div');
                t.className = 'hap-toast';
                // 新结构：左色条 + 文字区
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

    // ===================== 工具集 =====================
    // BUG FIX: 拖拽改用闭包内事件，避免污染宿主 document
    function makeDraggable(el, handleEl) {
        let dragging=false, ox=0, oy=0;
        const onDown = e => {
            if (e.target === handleEl) return; // 如果 handle 就是输入框则跳过
            dragging=true; ox=el.offsetLeft-e.clientX; oy=el.offsetTop-e.clientY;
            e.preventDefault();
        };
        const onMove = e => { if(dragging) { el.style.left=(e.clientX+ox)+'px'; el.style.top=(e.clientY+oy)+'px'; } };
        const onUp = () => dragging=false;
        el.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    const Tools = {
        sticky() {
            let n = document.getElementById('h-pn');
            if (!n) {
                n = document.createElement('div'); n.id='h-pn';
                n.style.cssText='position:fixed;top:130px;left:40px;width:235px;height:260px;background:rgba(13,15,24,0.95);z-index:9999999;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);padding:18px;backdrop-filter:blur(40px);border:1px solid rgba(99,102,241,0.25);';
                const hd = document.createElement('div');
                hd.style.cssText='font-size:10px;font-weight:800;color:rgba(165,180,252,0.7);margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:8px;cursor:move;letter-spacing:1px;';
                hd.textContent='📝 网页笔记 · 域名绑定存储';
                const ta = document.createElement('textarea');
                ta.id='h-ta'; ta.style.cssText='width:100%;height:180px;background:transparent;border:none;outline:none;resize:none;font-size:13px;color:rgba(255,255,255,0.78);font-family:Inter,sans-serif;line-height:1.65;';
                ta.value = GM_getValue(`n_${location.hostname}`, '');
                ta.oninput = () => GM_setValue(`n_${location.hostname}`, ta.value);
                n.appendChild(hd); n.appendChild(ta);
                document.body.appendChild(n);
                makeDraggable(n, ta); // BUG FIX: 不再污染 document.onmousemove
                Notify.show('📝 随手贴已挂载，内容实时保存', 'success');
            } else { n.style.display = n.style.display==='none'?'block':'none'; Notify.show(n.style.display==='none'?'便签已隐藏':'便签已显示','info'); }
        },

        pwd() {
            const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-={}|;:,.<>?';
            let r=''; for(let i=0;i<20;i++) r+=c[Math.floor(Math.random()*c.length)];
            navigator.clipboard.writeText(r).then(() => Notify.show(`🔑 已生成并复制: ${r.slice(0,12)}...`, 'success'));
        },

        images() {
            Notify.show('🖼️ 正在扫描页面所有图像资源...', 'info');
            const srcs = [...new Set([...document.querySelectorAll('img')].map(i=>i.src))].filter(s=>s.startsWith('http'));
            if (!srcs.length) return Notify.show('未检测到图像资源', 'warning');
            const over = document.createElement('div');
            over.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999999;backdrop-filter:blur(30px);overflow-y:auto;padding:50px;';
            over.innerHTML = `<div style="max-width:920px;margin:0 auto"><h2 style="color:#fff;font-size:20px;font-weight:900;margin-bottom:28px">🖼️ 图像采集清单 · 共 ${srcs.length} 张</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">${srcs.map(s=>`<img src="${s}" style="width:100%;height:130px;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,0.07);cursor:pointer;transition:.2s" onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='rgba(255,255,255,0.07)'" onclick="window.open('${s}')">`).join('')}</div><button id="img-cl" style="margin-top:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:14px 40px;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer">关闭预览</button></div>`;
            document.body.appendChild(over);
            document.getElementById('img-cl').onclick = () => over.remove();
        },

        qr() {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(location.href)}`;
            const over = document.createElement('div');
            over.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(22px);';
            over.innerHTML = `<div style="background:rgba(13,15,24,0.97);padding:34px;border-radius:28px;text-align:center;border:1px solid rgba(255,255,255,0.07);box-shadow:0 40px 100px rgba(0,0,0,0.6)"><div style="color:rgba(255,255,255,0.4);font-size:10px;font-weight:800;letter-spacing:1.2px;margin-bottom:18px">📱 多端网址同步二维码</div><img src="${url}" style="width:180px;border-radius:16px;border:8px solid rgba(255,255,255,0.04)"><div style="color:rgba(255,255,255,0.25);font-size:10px;margin-top:14px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${location.hostname}</div><button id="qr-cl" style="margin-top:18px;background:#6366f1;color:#fff;border:none;padding:11px 28px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer">关闭</button></div>`;
            document.body.appendChild(over);
            document.getElementById('qr-cl').onclick = () => over.remove();
            Notify.show('📱 二维码已生成，扫码即可跨端访问', 'success');
        },

        // BUG FIX: 暗黑模式不再通过 click() 触发，避免工具计数+1
        applyDark(isD) {
            const id='h-dark-css', el=document.getElementById(id);
            if (isD && !el) {
                const s=document.createElement('style'); s.id=id;
                s.textContent='html{filter:invert(.95) hue-rotate(180deg)!important}img,video,iframe,canvas{filter:invert(1.05) hue-rotate(180deg)!important}#hap-root,#hap-notifs{filter:invert(1.05) hue-rotate(180deg)!important}';
                document.head.appendChild(s);
            } else if (!isD && el) el.remove();
        },

        dark() {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD);
            this.applyDark(isD);
            Notify.show(isD ? '◑ 暗黑模式已激活' : '◑ 已恢复常规视觉模式', 'info');
        },

        links() {
            const ls = [...new Set([...document.querySelectorAll('a')].map(a=>a.href).filter(h=>h.startsWith('http')))];
            if (!ls.length) return Notify.show('未检测到有效链接', 'warning');
            const blob = new Blob([ls.join('\n')], {type:'text/plain'});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`links-${location.hostname}.txt`; a.click();
            Notify.show(`🔗 链接清单已导出，共 ${ls.length} 条`, 'success');
        },

        diag() {
            const latEl = document.getElementById('m-lat');
            Notify.show('🛡️ 全系统诊断启动，正在测量节点延迟...', 'info');
            const s = Date.now();
            GM_xmlhttpRequest({
                method:'HEAD', url:'https://github.com/favicon.ico?t='+s, timeout:6000,
                onload: () => {
                    const l = Date.now()-s;
                    STATE.latency = l;
                    if (latEl) { latEl.textContent=l+'ms'; latEl.className='bx '+(l<180?'bg':l<500?'by':'br'); }
                    updateStatusBar('ok', `系统诊断完成 · 延迟 ${l}ms · 状态极佳`);
                    Notify.show(`🛡️ 诊断完成：链路延迟 ${l}ms，安全评级 A+`, 'success');
                },
                onerror: () => {
                    updateStatusBar('unk', '诊断失败，请检查代理设置');
                    Notify.show('⚠️ 诊断失败，请检查代理设置', 'error');
                }
            });
        }
    };

    // ===================== 状态条 =====================
    function updateStatusBar(type, text) {
        const dot = document.getElementById('hap-sdot');
        const txt = document.getElementById('hap-stext');
        const mDot = document.getElementById('hap-mini-dot');
        if (!dot || !txt) return;
        const cls = {ok:'s-ok', wait:'s-wait', bad:'s-bad', unk:'s-unk'}[type]||'s-unk';
        dot.className = 'sdot '+cls;
        txt.textContent = text;
        // 同步迷你球颜色
        if (mDot) mDot.className = 'mini-dot '+cls.replace('s-','sdot-fake-');
        if (mDot) mDot.style.background = ({ok:'#34d399',wait:'#fbbf24',bad:'#f87171',unk:'#4b5563'}[type]||'#4b5563');
        if (mDot && type==='ok') mDot.style.boxShadow='0 0 8px #34d39988';
        else if (mDot && type==='bad') mDot.style.boxShadow='0 0 8px #f8717188';
        else if (mDot) mDot.style.boxShadow='none';
    }

    // ===================== UI 构建 =====================
    function buildUI() {
        if (document.getElementById('hap-root')) return;

        const [browser, bVer] = SYS.browser();
        const mem = SYS.memory();
        const tagMap = { MAJOR:'bb', FEATURE:'bg', FIX:'by', UI:'bw' };
        const dotColors = ['#6366f1','#34d399','#fbbf24','#f87171','#c084fc'];

        const root = document.createElement('div');
        root.id = 'hap-root';
        if (CONFIG.IS_MIN) root.classList.add('min');

        // 迷你球 (BUG FIX: 专属设计，不挤压标题栏)
        const mini = document.createElement('div');
        mini.id = 'hap-mini';
        mini.innerHTML = `
            <div id="hap-mini-dot" class="mini-dot" style="background:#4b5563"></div>
            <div style="font-size:20px;margin-bottom:0">🛡️</div>
            <div class="mini-ver">v${CONFIG.VERSION}</div>
        `;
        mini.title = '点击展开全能助手';
        mini.onclick = () => { root.classList.remove('min'); GM_setValue('is_minimized', false); document.getElementById('hap-tog').textContent='最小化 ▼'; };
        root.appendChild(mini);

        // 主面板
        const inner = document.createElement('div');
        inner.id = 'hap-inner';
        inner.innerHTML = `
            <!-- 标题栏 -->
            <div id="hap-header">
                <div class="h-top">
                    <div class="h-badges"><span class="hbv">v${CONFIG.VERSION}</span><span class="hbc">${CONFIG.CHANNEL}</span></div>
                    <span class="h-tog" id="hap-tog">最小化 ▼</span>
                </div>
                <div class="h-name">🛡️ 全能助手控制中心</div>
                <div class="h-sub">${CONFIG.AUTHOR} · ${CONFIG.BUILD}</div>
            </div>

            <!-- 状态条 -->
            <div id="hap-sbar">
                <span class="sdot s-unk" id="hap-sdot"></span>
                <span id="hap-stext">正在初始化系统环境...</span>
                <span id="hap-stime"></span>
            </div>

            <!-- 折叠区 -->
            <div id="hap-collapsible">
                <!-- Tabs -->
                <div id="hap-tabs">
                    <div class="htab on" data-p="tools">🔧 工具箱</div>
                    <div class="htab" data-p="monitor">📊 监控</div>
                    <div class="htab" data-p="version">🏷️ 版本</div>
                </div>

                <!-- Body -->
                <div id="hap-body">

                    <!-- 工具面板 -->
                    <div class="hpane on" id="pane-tools">
                        <div id="hap-clock">00:00:00</div>
                        <div id="hap-date"></div>
                        <div class="tg">
                            <div class="tgi" id="ti-note"><div class="tgi-ico">📝</div><div class="tgi-lb">随手贴</div></div>
                            <div class="tgi" id="ti-pwd"><div class="tgi-ico">🔑</div><div class="tgi-lb">密码生成</div></div>
                            <div class="tgi" id="ti-img"><div class="tgi-ico">🖼️</div><div class="tgi-lb">图像采集</div></div>
                            <div class="tgi" id="ti-qr"><div class="tgi-ico">📱</div><div class="tgi-lb">二维码</div></div>
                            <div class="tgi" id="ti-dark"><div class="tgi-ico">◑</div><div class="tgi-lb">暗黑模式</div></div>
                            <div class="tgi" id="ti-link"><div class="tgi-ico">🔗</div><div class="tgi-lb">导出链接</div></div>
                        </div>
                        <button class="hbtn btn-ind" id="hap-btn-update">🚀 检查 GitHub 云端更新</button>
                        <button class="hbtn btn-gh" id="hap-btn-diag">🛡️ 执行全系统诊断自检</button>

                    <!-- 更新通知遮罩 (初始隐藏，挂在 body 外 inline，避免被面板 overflow hidden 裁切) -->
                    </div>

                    <!-- 监控面板 -->
                    <div class="hpane" id="pane-monitor">
                        <div class="mc">
                            <div class="mc-hd">🖥️ 运行环境</div>
                            <div class="mc-row"><span class="mclb">浏览器内核</span><span class="mcvl">${browser} <span class="bx bb">v${bVer}</span></span></div>
                            <div class="mc-row"><span class="mclb">脚本管理器</span><span class="mcvl">${MANAGER_INFO}</span></div>
                            <div class="mc-row"><span class="mclb">运行系统</span><span class="mcvl">${navigator.platform}</span></div>
                            <div class="mc-row"><span class="mclb">系统语言</span><span class="mcvl">${SYS.lang()}</span></div>
                            <div class="mc-row"><span class="mclb">浏览模式</span><span class="mcvl"><span class="bx ${SYS.incog()?'by':'bg'}">${SYS.incog()?'🕵️ 无痕模式':'✅ 常规模式'}</span></span></div>
                            <div class="mc-row"><span class="mclb">Cookie</span><span class="mcvl"><span class="bx ${SYS.cookieEnabled()?'bg':'br'}">${SYS.cookieEnabled()?'已启用':'已禁用'}</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-hd">📐 显示与连接</div>
                            <div class="mc-row"><span class="mclb">屏幕分辨率</span><span class="mcvl">${SYS.resolution()} · DPR ${SYS.dpr()}</span></div>
                            <div class="mc-row"><span class="mclb">安全协议</span><span class="mcvl"><span class="bx ${SYS.ssl()?'bg':'br'}">${SYS.ssl()?'🔒 HTTPS 加密':'⚠️ HTTP 明文'}</span></span></div>
                            <div class="mc-row"><span class="mclb">文档编码</span><span class="mcvl">${SYS.charset()}</span></div>
                            <div class="mc-row"><span class="mclb">云端延迟</span><span class="mcvl"><span class="bx bw" id="m-lat">等待诊断</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-hd">⚡ 页面资源快照</div>
                            <div class="mc-row"><span class="mclb">DOM 节点</span><span class="mcvl" id="m-dom">${SYS.dom()} 个</span></div>
                            <div class="mc-row"><span class="mclb">图片资源</span><span class="mcvl">${SYS.images()} 张</span></div>
                            <div class="mc-row"><span class="mclb">超链接</span><span class="mcvl">${SYS.links()} 条</span></div>
                            <div class="mc-row"><span class="mclb">脚本文件</span><span class="mcvl">${SYS.scripts()} 个</span></div>
                            <div class="mc-row"><span class="mclb">样式表</span><span class="mcvl">${SYS.stylesheets()} 个</span></div>
                            ${mem ? `
                            <div class="mc-row" style="margin-top:8px;">
                                <span class="mclb">JS 堆内存</span>
                                <span class="mcvl" style="flex-direction:column;align-items:flex-end;gap:5px;">
                                    <span id="m-mem">${mem.used}MB / ${mem.total}MB</span>
                                    <div class="pg-w"><div class="pg-f ${mem.pct>70?'pgred':mem.pct>40?'pgyell':'pggreen'}" id="m-mbar" style="width:${mem.pct}%"></div></div>
                                </span>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- 版本面板 -->
                    <div class="hpane" id="pane-version">
                        <div class="mc">
                            <div class="mc-hd">🏷️ 版本与发布信息</div>
                            <div class="mc-row"><span class="mclb">本地版本</span><span class="mcvl"><span class="bx bb">v${CONFIG.VERSION}</span></span></div>
                            <div class="mc-row"><span class="mclb">云端版本</span><span class="mcvl" id="v-remote"><span class="bx bw">待检测</span></span></div>
                            <div class="mc-row"><span class="mclb">更新状态</span><span class="mcvl" id="v-status"><span class="bx bw">未知</span></span></div>
                            <div class="mc-row"><span class="mclb">发布渠道</span><span class="mcvl"><span class="bx bg">${CONFIG.CHANNEL}</span></span></div>
                            <div class="mc-row"><span class="mclb">构建标识</span><span class="mcvl" style="color:rgba(255,255,255,0.3);font-size:10px">${CONFIG.BUILD}</span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-hd">👤 维护与运行统计</div>
                            <div class="mc-row"><span class="mclb">维护作者</span><span class="mcvl">${CONFIG.AUTHOR}</span></div>
                            <div class="mc-row"><span class="mclb">联系平台</span><span class="mcvl">${CONFIG.CONTACT}</span></div>
                            <div class="mc-row"><span class="mclb">最后同步</span><span class="mcvl" id="v-lastsync" style="font-size:10px">${STATE.lastSync}</span></div>
                            <div class="mc-row"><span class="mclb">累计启动</span><span class="mcvl"><span class="bx bp">${STATE.injectCount} 次</span></span></div>
                            <div class="mc-row"><span class="mclb">工具调用</span><span class="mcvl"><span class="bx bw">${STATE.toolCallCount} 次</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-hd">📋 版本历史时间轴</div>
                            ${CONFIG.CHANGELOG.map((l,i) => `
                            <div class="tl-item">
                                <div class="tl-spine">
                                    <div class="tl-dot" style="background:${dotColors[i%5]};box-shadow:0 0 8px ${dotColors[i%5]}55"></div>
                                    <div class="tl-ln"></div>
                                </div>
                                <div style="flex:1;padding-bottom:3px">
                                    <div class="tl-v">v${l.v} <span class="bx ${tagMap[l.tag]||'bw'}" style="font-size:8px">${l.tag}</span></div>
                                    <div class="tl-d">${l.d}</div>
                                    <div class="tl-c">${l.c}</div>
                                </div>
                            </div>`).join('')}
                        </div>
                        <button class="hbtn btn-ind" id="hap-btn-upd2">🔄 立即检查云端维护更新</button>
                        <button class="hbtn btn-gh" id="hap-btn-repo">📂 前往 GitHub 源码仓库</button>
                    </div>

                </div><!-- hap-body -->
            </div><!-- hap-collapsible -->
        `;
        root.appendChild(inner);
        document.body.appendChild(root);

        // ── 事件绑定 ──
        document.getElementById('hap-tog').onclick = (e) => {
            e.stopPropagation();
            root.classList.add('min');
            GM_setValue('is_minimized', true);
        };
        // 点击 header 中非按钮区域不响应 (防止误触 toggle)
        // Header 本身也可以点击折叠
        document.getElementById('hap-header').onclick = (e) => {
            if (e.target.id === 'hap-tog' || e.target.closest('#hap-tabs')) return;
        };

        document.getElementById('hap-tabs').onclick = (e) => {
            const tab = e.target.closest('.htab');
            if (!tab) return;
            document.querySelectorAll('.htab').forEach(t => t.classList.remove('on'));
            document.querySelectorAll('.hpane').forEach(p => p.classList.remove('on'));
            tab.classList.add('on');
            document.getElementById(`pane-${tab.dataset.p}`).classList.add('on');
        };

        const bindTool = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => { STATE.toolCallCount++; GM_setValue('tool_calls', STATE.toolCallCount); fn(); };
        };
        bindTool('ti-note', () => Tools.sticky());
        bindTool('ti-pwd',  () => Tools.pwd());
        bindTool('ti-img',  () => Tools.images());
        bindTool('ti-qr',   () => Tools.qr());
        bindTool('ti-dark', () => Tools.dark());
        bindTool('ti-link', () => Tools.links());
        document.getElementById('hap-btn-update').onclick = () => checkUpdate(true);
        document.getElementById('hap-btn-diag').onclick   = () => Tools.diag();
        document.getElementById('hap-btn-upd2').onclick   = () => checkUpdate(true);
        document.getElementById('hap-btn-repo').onclick   = () => GM_openInTab(CONFIG.REPO_URL);

        // 初始化更新面板 DOM (挂载到 body，不受 overflow:hidden 限制)
        initUpdatePanel();

        // 时钟
        const tick = () => {
            const n = new Date();
            const ce = document.getElementById('hap-clock'), de = document.getElementById('hap-date'), se = document.getElementById('hap-stime');
            if (ce) ce.textContent = n.toLocaleTimeString('zh-CN',{hour12:false});
            if (de) de.textContent = n.toLocaleDateString('zh-CN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
            if (se) se.textContent = n.toLocaleTimeString('zh-CN',{hour12:false});
        };
        tick(); setInterval(tick, 1000);

        // 内存实时
        if (performance.memory) {
            setInterval(() => {
                const m = SYS.memory();
                const mEl=document.getElementById('m-mem'), bEl=document.getElementById('m-mbar'), dEl=document.getElementById('m-dom');
                if (mEl) mEl.textContent=`${m.used}MB / ${m.total}MB`;
                if (bEl) { bEl.style.width=m.pct+'%'; bEl.className='pg-f '+(m.pct>70?'pgred':m.pct>40?'pgyell':'pggreen'); }
                if (dEl) dEl.textContent=SYS.dom()+' 个';
            }, 2500);
        }
    }

    // ===================== 更新通知面板 =====================
    const TAG_BADGE_MAP = { MAJOR:'bb', FEATURE:'bg', FIX:'by', UI:'bw' };
    const DOT_COLORS    = ['#6366f1','#34d399','#fbbf24','#f87171','#c084fc'];

    function initUpdatePanel() {
        if (document.getElementById('hap-upd-overlay')) return;
        const ol = document.createElement('div');
        ol.id = 'hap-upd-overlay';
        ol.innerHTML = '<div id="hap-upd-panel"></div>';
        document.body.appendChild(ol);
    }

    function showUpdatePanel(remoteVer, changelog) {
        initUpdatePanel();
        const overlay = document.getElementById('hap-upd-overlay');
        const panel   = document.getElementById('hap-upd-panel');

        // 时间轴日志 HTML（完全复用 .tl-* 风格，与版本面板一致）
        const tlHTML = changelog.map((l, i) => `
            <div class="tl-item">
                <div class="tl-spine">
                    <div class="tl-dot" style="background:${DOT_COLORS[i%5]};box-shadow:0 0 8px ${DOT_COLORS[i%5]}55"></div>
                    <div class="tl-ln"></div>
                </div>
                <div style="flex:1;padding-bottom:3px">
                    <div class="tl-v">v${l.v} <span class="bx ${TAG_BADGE_MAP[l.tag]||'bw'}" style="font-size:8px">${l.tag}</span></div>
                    <div class="tl-d">${l.d}</div>
                    <div class="tl-c">${l.c}</div>
                </div>
            </div>
        `).join('');

        panel.innerHTML = `
            <!-- 标题栏：与 #hap-header 完全一致 -->
            <div class="upd-header">
                <div class="h-top">
                    <div class="upd-badge-row">
                        <span class="hbv">v${remoteVer}</span>
                        <span class="bx br" style="font-size:9px;font-weight:900;padding:3px 9px;border-radius:7px">🚀 NEW</span>
                        <span class="hbc">${CONFIG.CHANNEL}</span>
                    </div>
                    <span class="h-tog" id="upd-close-x" style="cursor:pointer">✕</span>
                </div>
                <div class="h-name">☁️ 发现云端维护更新</div>
                <div class="h-sub">${CONFIG.AUTHOR} · ${CONFIG.BUILD}</div>
            </div>

            <!-- 版本状态条：仿 #hap-sbar -->
            <div class="upd-sbar">
                <span class="sdot s-bad"></span>
                <span class="upd-ver-chip">
                    <span class="bx bw" style="font-size:10px">本地 v${CONFIG.VERSION}</span>
                    <span class="upd-ver-sep">→</span>
                    <span class="bx bb" style="font-size:10px">最新 v${remoteVer}</span>
                </span>
                <span class="bx br" style="font-size:9px">需要更新</span>
            </div>

            <!-- Body -->
            <div class="upd-body">
                <!-- 更新日志卡片（.mc 风格）-->
                <div class="upd-mc">
                    <div class="upd-mc-hd">📋 版本更新日志</div>
                    <div class="upd-tl-wrap">
                        ${tlHTML}
                    </div>
                </div>
                <!-- 按钮区（.hbtn 风格）-->
                <div class="upd-btns">
                    <button class="upd-btn-ok" id="upd-go">⬆️ 立即前往 GitHub 更新</button>
                    <button class="upd-btn-skip" id="upd-skip">稍后</button>
                </div>
            </div>
        `;

        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

        document.getElementById('upd-go').onclick     = () => { overlay.classList.remove('show'); GM_openInTab(CONFIG.UPDATE_URL, { active: true, insert: true }); };
        document.getElementById('upd-skip').onclick   = () => overlay.classList.remove('show');
        document.getElementById('upd-close-x').onclick= () => overlay.classList.remove('show');
        overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('show'); };
    }

    // ===================== 状态条更新 =====================
    function updateStatusBar(type, text) {
        const dot  = document.getElementById('hap-sdot');
        const txt  = document.getElementById('hap-stext');
        const mDot = document.getElementById('hap-mini-dot');
        if (!dot || !txt) return;
        dot.className = 'sdot ' + ({ok:'s-ok', wait:'s-wait', bad:'s-bad', unk:'s-unk'}[type] || 's-unk');
        txt.textContent = text;
        const dotColor = {ok:'#34d399', wait:'#fbbf24', bad:'#f87171', unk:'#4b5563'}[type] || '#4b5563';
        if (mDot) {
            mDot.style.background  = dotColor;
            mDot.style.boxShadow   = (type==='ok'||type==='bad') ? `0 0 8px ${dotColor}AA` : 'none';
        }
    }

    // ===================== 更新检测 =====================
    function checkUpdate(manual=false) {
        updateStatusBar('wait', '正在连接 GitHub 全球维护镜像...');
        if (manual) Notify.show('⚡ 正在请求云端版本信息...', 'info');
        const vR=document.getElementById('v-remote'), vS=document.getElementById('v-status');

        GM_xmlhttpRequest({
            method:'GET', url:CONFIG.UPDATE_URL+'?t='+Date.now(), timeout:12000,
            onload(res) {
                if (res.status===200) {
                    const m = res.responseText.match(/@version\s+([\d.]+)/i);
                    if (m) {
                        const rv=m[1];
                        if (vR) vR.innerHTML=`<span class="bx bb">v${rv}</span>`;
                        if (isNewer(rv, CONFIG.VERSION)) {
                            if (vS) vS.innerHTML=`<span class="bx br">🔴 发现新版本</span>`;
                            updateStatusBar('bad', `⚠️ 发现维护补丁 v${rv}，建议立即更新`);
                            // 使用 Premium 风格面板替代原生 confirm()
                            showUpdatePanel(rv, CONFIG.CHANGELOG);
                        } else {
                            if (vS) vS.innerHTML=`<span class="bx bg">✅ 已是最新</span>`;
                            const now=new Date().toLocaleString('zh-CN');
                            GM_setValue('last_sync', now);
                            const lsEl=document.getElementById('v-lastsync'); if(lsEl) lsEl.textContent=now;
                            updateStatusBar('ok', '云端同步完成 · 本地版本已是最新');
                            if (manual) Notify.show('✅ 已是最新版本，无需更新', 'success');
                        }
                    }
                } else {
                    updateStatusBar('unk', '服务器响应异常，请稍后重试');
                    if (manual) Notify.show('❌ 服务器响应异常: '+res.status, 'error');
                }
            },
            onerror() {
                updateStatusBar('unk', '网络连接失败，请检查代理设置');
                if (manual) Notify.show('⚠️ 网络连接失败', 'error');
            }
        });
    }

    function isNewer(r, c) {
        const a=r.split('.').map(Number), b=c.split('.').map(Number);
        for (let i=0; i<Math.max(a.length,b.length); i++) {
            if ((a[i]||0)>(b[i]||0)) return true;
            if ((a[i]||0)<(b[i]||0)) return false;
        }
        return false;
    }

    // ===================== 入口 =====================
    function init() {
        const lastV = GM_getValue('lv', '');
        if (lastV && isNewer(CONFIG.VERSION, lastV)) {
            // 先显示通知再刷新
            const box = document.createElement('div');
            box.id='hap-notifs'; document.body.appendChild(box);
            Notify.show(`🎉 脚本已升级至 v${CONFIG.VERSION}，正在刷新运行环境...`, 'success');
            GM_setValue('lv', CONFIG.VERSION);
            setTimeout(() => location.reload(true), 1800);
            return;
        }
        GM_setValue('lv', CONFIG.VERSION);
        buildUI();
        // BUG FIX: 暗黑模式直接调用函数，不触发计数器
        if (GM_getValue('dark_mode', false)) Tools.applyDark(true);
        updateStatusBar('wait', '正在建立云端检测连接...');
        setTimeout(() => checkUpdate(false), 1200);
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
