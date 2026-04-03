// ==UserScript==
// @name         远程更新与实用工具助手
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Premium 级全能助手 — 专业仪表盘·深度监控·超级工具集·GitHub 自动同步
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

    // ===================== 配置与数据 =====================
    const CONFIG = {
        UPDATE_URL: 'https://github.com/gao1774420117-afk/xiuxian-game/raw/refs/heads/main/remote-update-script.user.js',
        REPO_URL: 'https://github.com/gao1774420117-afk/xiuxian-game',
        VERSION: GM_info.script.version,
        BUILD: '20260403-RELEASE',
        CHANNEL: 'STABLE',
        AUTHOR: 'gao1774420117',
        CONTACT: 'GitHub · TapTap',
        CHECK_INTERVAL: 1000 * 60 * 60 * 6,
        IS_MIN: GM_getValue('is_minimized', false),
        CHANGELOG: [
            { v: '2.0.0', d: '2026/04/03', tag: 'MAJOR', c: '全面重构 Premium UI 2.0：深度仪表盘、动态指标卡、版本时间轴、加密状态显示。' },
            { v: '1.8.0', d: '2026/04/03', tag: 'FEATURE', c: '系统深度监控上线：内存追踪、DOM 拓扑、环境感知。' },
            { v: '1.7.1', d: '2026/04/03', tag: 'FIX', c: '修复功能丢失问题，补全全部 8 大工具入口。' },
            { v: '1.6.0', d: '2026/04/03', tag: 'FEATURE', c: '随手贴、URL 二维码、万能图像采集上线。' },
            { v: '1.5.0', d: '2026/04/03', tag: 'UI', c: 'Tab 导航 Premium UI 首次上线，引入毛玻璃主题。' },
        ]
    };

    // ===================== 系统扫描器 =====================
    const SYS = {
        browser() {
            const ua = navigator.userAgent;
            const v = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/(\d+)/);
            if (!v) return ['未知内核', '?'];
            const map = { Edg: 'Edge', OPR: 'Opera', Chrome: 'Chrome', Firefox: 'Firefox', Safari: 'Safari' };
            return [map[v[1]] || v[1], v[2]];
        },
        memory() {
            if (!performance.memory) return { used: -1, total: -1, pct: 0 };
            const m = performance.memory;
            const used = (m.usedJSHeapSize / 1048576).toFixed(1);
            const total = (m.jsHeapSizeLimit / 1048576).toFixed(0);
            const pct = Math.round((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100);
            return { used, total, pct };
        },
        dom() { return document.querySelectorAll('*').length; },
        links() { return document.querySelectorAll('a[href]').length; },
        images() { return document.querySelectorAll('img').length; },
        scripts() { return document.querySelectorAll('script').length; },
        ssl() { return location.protocol === 'https:'; },
        incog() { return GM_info.isIncognito || false; },
        resolution() { return `${screen.width}×${screen.height}`; },
        dpr() { return window.devicePixelRatio.toFixed(1); },
        charset() { return document.characterSet; },
        lang() { return navigator.language; },
        cookieEnabled() { return navigator.cookieEnabled; },
    };

    // ===================== 状态机 =====================
    const STATE = {
        updateStatus: 'unknown',  // unknown | checking | latest | outdated | error
        latency: null,
        latencyChecked: false,
        toolCallCount: GM_getValue('tool_calls', 0),
        lastSync: GM_getValue('last_sync', '从未同步'),
        injectCount: parseInt(GM_getValue('inject_count', 0)) + 1,
    };
    GM_setValue('inject_count', STATE.injectCount);

    // ===================== CSS 样式 =====================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        #hap-root *  { box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }
        
        #hap-root {
            position: fixed; bottom: 28px; right: 28px; width: 360px;
            z-index: 2147483640;
            filter: drop-shadow(0 30px 80px rgba(0,0,0,0.22)) drop-shadow(0 5px 15px rgba(0,0,0,0.1));
            transition: width .4s cubic-bezier(.77,0,.18,1);
            user-select: none;
        }
        #hap-root.min { width: 170px; }

        #hap-inner {
            background: rgba(15,17,26,0.96);
            border-radius: 28px;
            border: 1px solid rgba(255,255,255,0.08);
            overflow: hidden;
            backdrop-filter: blur(40px) saturate(180%);
        }

        /* ── 标题栏 ── */
        #hap-header {
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            padding: 18px 22px 16px;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        #hap-header::before {
            content: '';
            position: absolute; inset: 0;
            background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.2));
            opacity: 0.6;
        }
        .hap-title-row { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
        .hap-title-left { display: flex; align-items: center; gap: 10px; }
        .hap-badge-ver {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white; font-size: 9px; font-weight: 800; padding: 3px 8px;
            border-radius: 8px; letter-spacing: .5px;
        }
        .hap-badge-ch {
            background: rgba(52,211,153,0.2); color: #34d399; font-size: 9px;
            font-weight: 800; padding: 3px 8px; border-radius: 8px; letter-spacing: .5px;
            border: 1px solid rgba(52,211,153,0.3);
        }
        .hap-title-text { color: white; font-size: 13px; font-weight: 800; margin-top: 8px; position: relative; z-index: 1; }
        .hap-title-sub  { color: rgba(255,255,255,0.45); font-size: 10px; margin-top: 2px; position: relative; z-index: 1; }
        .hap-tog { color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 700; position: relative; z-index: 1; transition: color .2s; }
        .hap-tog:hover { color: white; }

        /* 状态指示器 */
        .hap-status-bar {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 22px;
            background: rgba(255,255,255,0.03);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            position: relative; z-index: 1;
        }
        .hap-sdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .sdot-ok   { background: #34d399; box-shadow: 0 0 8px #34d399; }
        .sdot-wait { background: #fbbf24; animation: blink 1s ease-in-out infinite; }
        .sdot-bad  { background: #f87171; box-shadow: 0 0 8px #f87171; }
        .sdot-unk  { background: #6b7280; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        .hap-stext { flex: 1; font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.6); }
        .hap-stime { font-size: 10px; color: rgba(255,255,255,0.3); font-family: monospace; }

        /* ── 导航 Tab ── */
        #hap-tabs {
            display: flex; padding: 10px 14px;
            background: rgba(255,255,255,0.02);
            gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .hap-tab {
            flex: 1; text-align: center; padding: 8px 4px; font-size: 11px; font-weight: 700;
            cursor: pointer; border-radius: 12px; color: rgba(255,255,255,0.35);
            transition: all .25s; border: 1px solid transparent;
        }
        .hap-tab.on {
            background: rgba(99,102,241,0.15); color: #a5b4fc;
            border-color: rgba(99,102,241,0.3);
        }

        /* ── 内容区 ── */
        #hap-body { padding: 18px; }
        .hap-pane { display: none; animation: fadeUp .35s ease; }
        .hap-pane.on { display: block; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }

        /* ── 指标卡片 ── */
        .mc { 
            background: rgba(255,255,255,0.04); border-radius: 18px; padding: 16px;
            margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.07);
        }
        .mc-title {
            font-size: 9.5px; font-weight: 800; letter-spacing: 1.2px;
            color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 12px;
            display: flex; align-items: center; gap: 6px;
        }
        .mc-title::after { content:''; flex:1; height:1px; background: rgba(255,255,255,0.07); }
        .mc-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .mc-row:last-child { margin-bottom: 0; }
        .mc-label { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 500; }
        .mc-val {
            font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.85);
            font-family: 'Inter', monospace; display: flex; align-items: center; gap: 5px;
        }
        .badge-s { padding: 2px 7px; border-radius: 6px; font-size: 9px; font-weight: 800; }
        .b-green { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
        .b-blue  { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.25); }
        .b-red   { background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
        .b-yellow{ background: rgba(251,191,36,0.15);  color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
        .b-gray  { background: rgba(255,255,255,0.07);  color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.08); }

        /* 进度条 */
        .prog-wrap { width: 80px; height: 5px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; }
        .prog-fill  { height: 100%; border-radius: 99px; transition: width .5s ease; }
        .pf-green { background: linear-gradient(90deg,#34d399,#10b981); }
        .pf-yellow{ background: linear-gradient(90deg,#fbbf24,#f59e0b); }
        .pf-red   { background: linear-gradient(90deg,#f87171,#ef4444); }

        /* ── 工具网格 ── */
        .tg { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 14px; }
        .tg-itm {
            background: rgba(255,255,255,0.05); border-radius: 16px; padding: 14px 8px;
            text-align: center; cursor: pointer;
            border: 1px solid rgba(255,255,255,0.06);
            transition: all .25s;
        }
        .tg-itm:hover {
            background: rgba(99,102,241,0.12);
            border-color: rgba(99,102,241,0.35);
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(99,102,241,0.2);
        }
        .tg-ico { font-size: 20px; margin-bottom: 6px; }
        .tg-lbl { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.55); }

        /* ── 动作按钮 ── */
        .hap-btn {
            width: 100%; padding: 13px 18px; border-radius: 16px; border: none; cursor: pointer;
            font-size: 12.5px; font-weight: 800; transition: all .25s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            margin-bottom: 10px;
        }
        .hap-btn:last-child { margin-bottom: 0; }
        .hap-btn:hover { transform: translateY(-2px); }
        .btn-indigo {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white; box-shadow: 0 4px 15px rgba(99,102,241,0.4);
        }
        .btn-indigo:hover { box-shadow: 0 8px 25px rgba(99,102,241,0.5); }
        .btn-ghost {
            background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.65);
            border: 1px solid rgba(255,255,255,0.08);
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); color: white; }
        .btn-danger { background: linear-gradient(135deg,#ef4444,#dc2626); color:white; box-shadow:0 4px 15px rgba(239,68,68,0.4); }

        /* ── 版本时间轴 ── */
        .tl { padding: 0; margin: 0; }
        .tl-item { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
        .tl-item:last-child { margin-bottom: 0; }
        .tl-dot-col { display: flex; flex-direction: column; align-items: center; }
        .tl-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
        .tl-line { width: 1px; flex: 1; background: rgba(255,255,255,0.07); margin-top: 4px; min-height: 20px; }
        .tl-item:last-child .tl-line { display: none; }
        .tl-v { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.8); margin-bottom: 3px; }
        .tl-d { font-size: 9.5px; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
        .tl-c { font-size: 10px; color: rgba(255,255,255,0.5); line-height: 1.5; }

        /* 时间组件 */
        #hap-clock { font-size: 28px; font-weight: 900; color: white; font-family: 'Inter',monospace; letter-spacing: 1px; text-align:center; margin-bottom:5px; }
        #hap-date  { font-size: 11px; color: rgba(255,255,255,0.35); text-align:center; margin-bottom:14px; }

        /* 通知容器 */
        #hap-notifs {
            position: fixed; top: 25px; right: 25px; z-index: 2147483647;
            display: flex; flex-direction: column; align-items: flex-end; pointer-events: none;
        }
        .hap-toast {
            margin-bottom: 10px; padding: 14px 22px;
            background: rgba(15,17,26,0.95); color: rgba(255,255,255,0.9);
            border-left: 4px solid; border-radius: 18px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.4); font-size: 13px; font-weight: 700;
            pointer-events: auto; opacity: 0; transform: translateX(40px);
            transition: all .45s cubic-bezier(0.175,0.885,0.32,1.275);
            backdrop-filter: blur(30px); white-space: nowrap;
        }
        .hap-toast.in { opacity: 1; transform: translateX(0); }
    `);

    // ===================== 通知模块 =====================
    const Notify = (() => {
        let box;
        const colors = { info: '#6366f1', success: '#34d399', warning: '#fbbf24', error: '#f87171' };
        return {
            show(msg, type = 'info', dur = 4000) {
                if (!box) { box = document.createElement('div'); box.id = 'hap-notifs'; document.body.appendChild(box); }
                const t = document.createElement('div');
                t.className = 'hap-toast'; t.style.borderLeftColor = colors[type] || colors.info;
                t.textContent = msg; box.prepend(t);
                requestAnimationFrame(() => t.classList.add('in'));
                setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 500); }, dur);
            }
        };
    })();

    // ===================== UI 构建 =====================
    function buildUI() {
        if (document.getElementById('hap-root')) return;

        const [browser, bVer] = SYS.browser();
        const tagColors = { MAJOR: 'b-blue', FEATURE: 'b-green', FIX: 'b-yellow', UI: 'b-gray' };

        const root = document.createElement('div');
        root.id = 'hap-root';
        if (CONFIG.IS_MIN) root.classList.add('min');

        root.innerHTML = `
        <div id="hap-inner">

            <!-- 标题栏 -->
            <div id="hap-header">
                <div class="hap-title-row">
                    <div class="hap-title-left">
                        <span class="hap-badge-ver">v${CONFIG.VERSION}</span>
                        <span class="hap-badge-ch">${CONFIG.CHANNEL}</span>
                    </div>
                    <span class="hap-tog" id="hap-tog">${CONFIG.IS_MIN ? '展开 ▲' : '最小化 ▼'}</span>
                </div>
                <div class="hap-title-text">🛡️ 全能助手控制中心</div>
                <div class="hap-title-sub">${CONFIG.AUTHOR} · ${CONFIG.BUILD}</div>
            </div>

            <!-- 状态栏 -->
            <div class="hap-status-bar" id="hap-sbar">
                <span class="hap-sdot sdot-unk" id="hap-sdot"></span>
                <span class="hap-stext" id="hap-stext">正在初始化系统环境...</span>
                <span class="hap-stime" id="hap-stime">${new Date().toLocaleTimeString('zh-CN')}</span>
            </div>

            <!-- 折叠体 -->
            <div id="hap-collapsible" style="${CONFIG.IS_MIN ? 'display:none' : ''}">

                <!-- Tab 导航 -->
                <div id="hap-tabs">
                    <div class="hap-tab on" data-p="tools">🔧 工具</div>
                    <div class="hap-tab" data-p="monitor">📊 监控</div>
                    <div class="hap-tab" data-p="version">🏷️ 版本</div>
                </div>

                <!-- 内容 -->
                <div id="hap-body">

                    <!-- ======= 工具面板 ======= -->
                    <div class="hap-pane on" id="pane-tools">
                        <div id="hap-clock">00:00:00</div>
                        <div id="hap-date"></div>
                        <div class="tg">
                            <div class="tg-itm" id="ti-note"><div class="tg-ico">📝</div><div class="tg-lbl">随手贴</div></div>
                            <div class="tg-itm" id="ti-pwd"><div class="tg-ico">🔑</div><div class="tg-lbl">密码生成</div></div>
                            <div class="tg-itm" id="ti-img"><div class="tg-ico">🖼️</div><div class="tg-lbl">图像采集</div></div>
                            <div class="tg-itm" id="ti-qr"><div class="tg-ico">📱</div><div class="tg-lbl">二维码</div></div>
                            <div class="tg-itm" id="ti-dark"><div class="tg-ico">◑</div><div class="tg-lbl">暗黑模式</div></div>
                            <div class="tg-itm" id="ti-link"><div class="tg-ico">🔗</div><div class="tg-lbl">导出链接</div></div>
                        </div>
                        <button class="hap-btn btn-indigo" id="hap-btn-update">🚀 检查 GitHub 云端维护更新</button>
                        <button class="hap-btn btn-ghost" id="hap-btn-diag">🛡️ 执行全系统诊断自检</button>
                    </div>

                    <!-- ======= 监控面板 ======= -->
                    <div class="hap-pane" id="pane-monitor">
                        <div class="mc">
                            <div class="mc-title">🖥️ 运行环境</div>
                            <div class="mc-row"><span class="mc-label">浏览器内核</span><span class="mc-val">${browser} <span class="badge-s b-blue">v${bVer}</span></span></div>
                            <div class="mc-row"><span class="mc-label">脚本管理器</span><span class="mc-val">${CONFIG_MGRINF}</span></div>
                            <div class="mc-row"><span class="mc-label">运行系统</span><span class="mc-val">${navigator.platform}</span></div>
                            <div class="mc-row"><span class="mc-label">系统语言</span><span class="mc-val">${SYS.lang()}</span></div>
                            <div class="mc-row"><span class="mc-label">浏览模式</span><span class="mc-val"><span class="badge-s ${SYS.incog() ? 'b-yellow' : 'b-green'}">${SYS.incog() ? '无痕模式' : '常规模式'}</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-title">📐 显示与网络</div>
                            <div class="mc-row"><span class="mc-label">屏幕分辨率</span><span class="mc-val">${SYS.resolution()} · DPR ${SYS.dpr()}</span></div>
                            <div class="mc-row"><span class="mc-label">安全协议</span><span class="mc-val"><span class="badge-s ${SYS.ssl() ? 'b-green' : 'b-red'}">${SYS.ssl() ? '🔒 HTTPS 加密' : '⚠️ HTTP 不安全'}</span></span></div>
                            <div class="mc-row"><span class="mc-label">文档编码</span><span class="mc-val">${SYS.charset()}</span></div>
                            <div class="mc-row"><span class="mc-label">云端延迟</span><span class="mc-val"><span id="m-lat" class="badge-s b-gray">等待诊断</span></span></div>
                            <div class="mc-row"><span class="mc-label">Cookie 支持</span><span class="mc-val"><span class="badge-s ${SYS.cookieEnabled() ? 'b-green' : 'b-red'}">${SYS.cookieEnabled() ? '已启用' : '已禁用'}</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-title">⚡ 页面资源统计</div>
                            <div class="mc-row"><span class="mc-label">DOM 节点数</span><span class="mc-val" id="m-dom">${SYS.dom()} 个</span></div>
                            <div class="mc-row"><span class="mc-label">页面图片数</span><span class="mc-val">${SYS.images()} 张</span></div>
                            <div class="mc-row"><span class="mc-label">外链数量</span><span class="mc-val">${SYS.links()} 条</span></div>
                            <div class="mc-row"><span class="mc-label">脚本组件数</span><span class="mc-val">${SYS.scripts()} 个</span></div>
                            ${performance.memory ? `
                            <div class="mc-row" style="margin-top:10px;">
                                <span class="mc-label">JS 堆内存</span>
                                <span class="mc-val" style="flex-direction:column;align-items:flex-end;gap:4px;">
                                    <span id="m-mem">${SYS.memory().used}MB / ${SYS.memory().total}MB</span>
                                    <div class="prog-wrap"><div class="prog-fill ${SYS.memory().pct > 70 ? 'pf-red' : SYS.memory().pct > 40 ? 'pf-yellow' : 'pf-green'}" id="m-mbar" style="width:${SYS.memory().pct}%"></div></div>
                                </span>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- ======= 版本面板 ======= -->
                    <div class="hap-pane" id="pane-version">
                        <div class="mc">
                            <div class="mc-title">🏷️ 版本与发布信息</div>
                            <div class="mc-row"><span class="mc-label">当前版本</span><span class="mc-val"><span class="badge-s b-blue">v${CONFIG.VERSION}</span></span></div>
                            <div class="mc-row"><span class="mc-label">发布渠道</span><span class="mc-val"><span class="badge-s b-green">${CONFIG.CHANNEL}</span></span></div>
                            <div class="mc-row"><span class="mc-label">构建标识</span><span class="mc-val" style="color:rgba(255,255,255,0.4)">${CONFIG.BUILD}</span></div>
                            <div class="mc-row"><span class="mc-label">云端版本</span><span class="mc-val" id="v-remote"><span class="badge-s b-gray">待检测</span></span></div>
                            <div class="mc-row"><span class="mc-label">更新状态</span><span class="mc-val" id="v-status"><span class="badge-s b-gray">未知</span></span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-title">👤 维护信息</div>
                            <div class="mc-row"><span class="mc-label">维护作者</span><span class="mc-val">${CONFIG.AUTHOR}</span></div>
                            <div class="mc-row"><span class="mc-label">联系平台</span><span class="mc-val">${CONFIG.CONTACT}</span></div>
                            <div class="mc-row"><span class="mc-label">最后同步</span><span class="mc-val" id="v-lastsync" style="font-size:10px;">${STATE.lastSync}</span></div>
                            <div class="mc-row"><span class="mc-label">累计启动</span><span class="mc-val">${STATE.injectCount} 次</span></div>
                            <div class="mc-row"><span class="mc-label">工具调用</span><span class="mc-val">${STATE.toolCallCount} 次</span></div>
                        </div>
                        <div class="mc">
                            <div class="mc-title">📋 版本历史时间轴</div>
                            <div class="tl">
                                ${CONFIG.CHANGELOG.map((l, i) => {
                                    const dotCls = ['#6366f1','#34d399','#fbbf24','#f87171','#8b5cf6'][i % 5];
                                    return `
                                    <div class="tl-item">
                                        <div class="tl-dot-col">
                                            <div class="tl-dot" style="background:${dotCls};box-shadow:0 0 8px ${dotCls}40;"></div>
                                            <div class="tl-line"></div>
                                        </div>
                                        <div style="flex:1;padding-bottom:4px;">
                                            <div class="tl-v">v${l.v} <span class="badge-s ${tagColors[l.tag] || 'b-gray'}" style="font-size:8px;">${l.tag}</span></div>
                                            <div class="tl-d">${l.d}</div>
                                            <div class="tl-c">${l.c}</div>
                                        </div>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                        <button class="hap-btn btn-indigo" id="hap-btn-upd2">🔄 立即检查云端维护更新</button>
                        <button class="hap-btn btn-ghost" id="hap-btn-repo">📂 前往 GitHub 源码仓库</button>
                    </div>

                </div><!-- hap-body -->
            </div><!-- hap-collapsible -->
        </div><!-- hap-inner -->
        `;

        document.body.appendChild(root);

        // ── 事件绑定 ──
        document.getElementById('hap-header').onclick = (e) => {
            if (e.target.closest('.hap-tab')) return;
            const isMin = root.classList.toggle('min');
            document.getElementById('hap-collapsible').style.display = isMin ? 'none' : '';
            document.getElementById('hap-tog').textContent = isMin ? '展开 ▲' : '最小化 ▼';
            GM_setValue('is_minimized', isMin);
        };

        document.getElementById('hap-tabs').onclick = (e) => {
            const tab = e.target.closest('.hap-tab');
            if (!tab) return;
            document.querySelectorAll('.hap-tab').forEach(t => t.classList.remove('on'));
            document.querySelectorAll('.hap-pane').forEach(p => p.classList.remove('on'));
            tab.classList.add('on');
            document.getElementById(`pane-${tab.dataset.p}`).classList.add('on');
        };

        const bindTool = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => { STATE.toolCallCount++; GM_setValue('tool_calls', STATE.toolCallCount); fn(); };
        };

        bindTool('ti-note', Tools.sticky);
        bindTool('ti-pwd', Tools.pwd);
        bindTool('ti-img', Tools.images);
        bindTool('ti-qr', Tools.qr);
        bindTool('ti-dark', Tools.dark);
        bindTool('ti-link', Tools.links);
        document.getElementById('hap-btn-update').onclick = () => checkUpdate(true);
        document.getElementById('hap-btn-diag').onclick = () => Tools.diag();
        document.getElementById('hap-btn-upd2').onclick = () => checkUpdate(true);
        document.getElementById('hap-btn-repo').onclick = () => GM_openInTab(CONFIG.REPO_URL);

        // 时钟
        const updateClock = () => {
            const n = new Date();
            const cEl = document.getElementById('hap-clock');
            const dEl = document.getElementById('hap-date');
            const stEl = document.getElementById('hap-stime');
            if (cEl) cEl.textContent = n.toLocaleTimeString('zh-CN', { hour12: false });
            if (dEl) dEl.textContent = n.toLocaleDateString('zh-CN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
            if (stEl) stEl.textContent = n.toLocaleTimeString('zh-CN', { hour12: false });
        };
        updateClock(); setInterval(updateClock, 1000);

        // 内存实时更新
        if (performance.memory) {
            setInterval(() => {
                const m = SYS.memory();
                const mEl = document.getElementById('m-mem');
                const bEl = document.getElementById('m-mbar');
                const dEl = document.getElementById('m-dom');
                if (mEl) mEl.textContent = `${m.used}MB / ${m.total}MB`;
                if (bEl) bEl.style.width = m.pct + '%';
                if (dEl) dEl.textContent = SYS.dom() + ' 个';
            }, 2000);
        }
    }

    // 因模板字符串需要先计算管理器信息
    const CONFIG_MGRINF = `${GM_info.scriptHandler || 'Tampermonkey'} v${GM_info.version || '未知'}`;

    // ===================== 工具集 =====================
    const Tools = {
        sticky() {
            let n = document.getElementById('h-pn');
            if (!n) {
                n = document.createElement('div'); n.id = 'h-pn';
                n.style.cssText = `position:fixed;top:130px;left:40px;width:230px;height:250px;background:rgba(15,17,26,0.92);z-index:9999999;border-radius:22px;box-shadow:0 20px 60px rgba(0,0,0,0.4);padding:20px;cursor:move;backdrop-filter:blur(30px);border:1px solid rgba(99,102,241,0.3);`;
                n.innerHTML = `<div style="font-size:10px;font-weight:800;color:rgba(165,180,252,0.8);margin-bottom:12px;letter-spacing:1px;">📝 网页笔记 · 域名绑定存储</div><textarea id="h-ta" style="width:100%;height:180px;background:transparent;border:none;outline:none;resize:none;font-size:13px;color:rgba(255,255,255,0.8);font-family:'Inter',sans-serif;line-height:1.6;"></textarea>`;
                document.body.appendChild(n);
                const ta = document.getElementById('h-ta');
                ta.value = GM_getValue(`n_${location.hostname}`, '');
                ta.oninput = () => GM_setValue(`n_${location.hostname}`, ta.value);
                let dragging = false, ox = 0, oy = 0;
                n.onmousedown = (e) => { if (e.target === ta) return; dragging = true; ox = n.offsetLeft - e.clientX; oy = n.offsetTop - e.clientY; };
                document.onmousemove = (e) => { if (dragging) { n.style.left = (e.clientX + ox) + 'px'; n.style.top = (e.clientY + oy) + 'px'; } };
                document.onmouseup = () => dragging = false;
                Notify.show('📝 随手贴已挂载，内容实时保存', 'success');
            } else { n.style.display = n.style.display === 'none' ? 'block' : 'none'; Notify.show(n.style.display === 'none' ? '便签已隐藏' : '便签已显示', 'info'); }
        },

        pwd() {
            const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
            let r = ''; for (let i = 0; i < 20; i++) r += c[Math.floor(Math.random() * c.length)];
            navigator.clipboard.writeText(r).then(() => Notify.show(`🔑 已生成并复制: ${r.slice(0,10)}...`, 'success'));
        },

        images() {
            Notify.show('🖼️ 正在扫描页面所有图像资源...', 'info');
            const srcs = [...new Set([...document.querySelectorAll('img')].map(i => i.src))].filter(s => s.startsWith('http'));
            if (!srcs.length) return Notify.show('未检测到图像资源', 'warning');
            const over = document.createElement('div');
            over.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999999;backdrop-filter:blur(30px);overflow-y:auto;padding:50px;`;
            over.innerHTML = `<div style="max-width:900px;margin:0 auto;"><h2 style="color:white;font-size:20px;font-weight:900;margin-bottom:30px;">🖼️ 图像采集清单 · 共 ${srcs.length} 张</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;">${srcs.map(s => `<img src="${s}" style="width:100%;height:140px;object-fit:cover;border-radius:16px;border:2px solid rgba(255,255,255,0.08);cursor:pointer;transition:.2s;" onmouseover="this.style.border='2px solid #6366f1'" onmouseout="this.style.border='2px solid rgba(255,255,255,0.08)'" onclick="window.open('${s}')">`).join('')}</div><button id="img-cl" style="margin-top:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;padding:14px 40px;border-radius:16px;font-size:14px;font-weight:800;cursor:pointer;">关闭预览</button></div>`;
            document.body.appendChild(over);
            document.getElementById('img-cl').onclick = () => over.remove();
        },

        qr() {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(location.href)}`;
            const over = document.createElement('div');
            over.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(20px);`;
            over.innerHTML = `<div style="background:rgba(15,17,26,0.96);padding:35px;border-radius:32px;text-align:center;border:1px solid rgba(255,255,255,0.08);box-shadow:0 40px 100px rgba(0,0,0,0.5);"><div style="color:rgba(255,255,255,0.5);font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:20px;">📱 多端网址同步二维码</div><img src="${url}" style="width:180px;border-radius:18px;border:10px solid rgba(255,255,255,0.05);"><div style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:15px;">${location.hostname}</div><button id="qr-cl" style="margin-top:20px;background:#6366f1;color:white;border:none;padding:12px 30px;border-radius:14px;font-size:12px;font-weight:800;cursor:pointer;">关闭</button></div>`;
            document.body.appendChild(over);
            document.getElementById('qr-cl').onclick = () => over.remove();
            Notify.show('📱 二维码已生成，扫码即可跨端访问', 'success');
        },

        dark() {
            const isD = !GM_getValue('dark_mode', false);
            GM_setValue('dark_mode', isD);
            const id = 'h-dark-css', el = document.getElementById(id);
            if (isD) {
                if (!el) { const s = document.createElement('style'); s.id = id; s.innerHTML = `html{filter:invert(.95) hue-rotate(180deg)!important}img,video,iframe,canvas{filter:invert(1.05) hue-rotate(180deg)!important}#hap-root,#hap-notifs{filter:invert(1.05) hue-rotate(180deg)!important}`; document.head.appendChild(s); }
                Notify.show('◑ 暗黑模式已激活，所有色彩自动反转', 'info');
            } else { if (el) el.remove(); Notify.show('◑ 已恢复常规视觉模式', 'info'); }
        },

        links() {
            const ls = [...new Set([...document.querySelectorAll('a')].map(a => a.href).filter(h => h.startsWith('http')))];
            const b = new Blob([ls.join('\n')], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `links-${location.hostname}.txt`; a.click();
            Notify.show(`🔗 链接清单已导出，共 ${ls.length} 条`, 'success');
        },

        diag() {
            const latEl = document.getElementById('m-lat');
            Notify.show('🛡️ 全系统诊断启动，正在测量节点延迟...', 'info');
            const s = Date.now();
            GM_xmlhttpRequest({
                method: 'HEAD', url: 'https://github.com/favicon.ico?t=' + s, timeout: 6000,
                onload: () => {
                    const l = Date.now() - s;
                    STATE.latency = l; STATE.latencyChecked = true;
                    if (latEl) { latEl.textContent = l + 'ms'; latEl.className = 'badge-s ' + (l < 200 ? 'b-green' : l < 500 ? 'b-yellow' : 'b-red'); }
                    updateStatusBar('ok', `系统诊断完成 · 延迟 ${l}ms · 状态极佳`);
                    Notify.show(`🛡️ 诊断完成：链路延迟 ${l}ms，安全评级 [A级]`, 'success');
                },
                onerror: () => { Notify.show('⚠️ 诊断失败，请检查代理设置', 'error'); }
            });
        }
    };

    // ===================== 更新检测 =====================
    function updateStatusBar(type, text) {
        const dot = document.getElementById('hap-sdot');
        const txt = document.getElementById('hap-stext');
        if (!dot || !txt) return;
        dot.className = 'hap-sdot ' + ({ ok: 'sdot-ok', wait: 'sdot-wait', bad: 'sdot-bad', unk: 'sdot-unk' }[type] || 'sdot-unk');
        txt.textContent = text;
    }

    function checkUpdate(manual = false) {
        updateStatusBar('wait', '正在连接 GitHub 全球维护镜像...');
        if (manual) Notify.show('⚡ 正在请求云端版本信息...', 'info');

        const vRemote = document.getElementById('v-remote');
        const vStatus = document.getElementById('v-status');

        GM_xmlhttpRequest({
            method: 'GET', url: CONFIG.UPDATE_URL + '?t=' + Date.now(),
            timeout: 12000,
            onload(res) {
                if (res.status === 200) {
                    const m = res.responseText.match(/@version\s+([\d.]+)/i);
                    if (m) {
                        const rv = m[1];
                        if (vRemote) vRemote.innerHTML = `<span class="badge-s b-blue">v${rv}</span>`;

                        if (isNewer(rv, CONFIG.VERSION)) {
                            if (vStatus) vStatus.innerHTML = `<span class="badge-s b-red">🔴 发现新版本</span>`;
                            updateStatusBar('bad', `⚠️ 发现维护补丁 v${rv}，建议立即更新`);
                            if (confirm(`🚀 发现云端维护版本 v${rv}\n当前本地版本 v${CONFIG.VERSION}\n\n是否立即跳转 GitHub 同步？`)) GM_openInTab(CONFIG.UPDATE_URL);
                        } else {
                            if (vStatus) vStatus.innerHTML = `<span class="badge-s b-green">✅ 已是最新</span>`;
                            const now = new Date().toLocaleString('zh-CN');
                            GM_setValue('last_sync', now);
                            const lsEl = document.getElementById('v-lastsync');
                            if (lsEl) lsEl.textContent = now;
                            updateStatusBar('ok', '云端同步完成 · 本地版本已是最新');
                            if (manual) Notify.show('✅ 已是最新版本，无需更新', 'success');
                        }
                    }
                } else {
                    updateStatusBar('unk', '服务器响应异常，请稍后重试');
                    if (manual) Notify.show('❌ 服务器响应异常: ' + res.status, 'error');
                }
            },
            onerror() {
                updateStatusBar('unk', '网络连接失败，请检查代理设置');
                if (manual) Notify.show('⚠️ 网络连接失败', 'error');
            }
        });
    }

    function isNewer(r, c) {
        const a = r.split('.').map(Number), b = c.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            if ((a[i] || 0) > (b[i] || 0)) return true;
            if ((a[i] || 0) < (b[i] || 0)) return false;
        }
        return false;
    }

    // ===================== 入口 =====================
    function init() {
        const lastV = GM_getValue('lv', '');
        if (lastV && isNewer(CONFIG.VERSION, lastV)) {
            Notify.show(`🎉 脚本已升级至 v${CONFIG.VERSION}，正在刷新运行环境...`, 'success');
            GM_setValue('lv', CONFIG.VERSION);
            setTimeout(() => location.reload(true), 1500);
            return;
        }
        GM_setValue('lv', CONFIG.VERSION);
        buildUI();
        if (GM_getValue('dark_mode', false)) document.getElementById('ti-dark')?.click();
        updateStatusBar('wait', '正在建立云端检测连接...');
        setTimeout(() => checkUpdate(false), 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();
