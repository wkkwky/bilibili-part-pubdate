// ==UserScript==
// @name         B站分P发布时间显示
// @name:en      Bilibili Multi-Part Video Publish Time
// @namespace    https://github.com/wkkwky/bilibili-part-pubdate
// @version      1.0.2
// @description  多分P视频在标题下方已有时间后，追加显示当前选中分P的发布时间
// @description:en  Append the publish time of the currently selected part (P) next to the date on multi-part Bilibili videos
// @author       wkkwky
// @license      MIT
// @homepageURL  https://github.com/wkkwky/bilibili-part-pubdate
// @supportURL   https://github.com/wkkwky/bilibili-part-pubdate/issues
// @downloadURL  https://raw.githubusercontent.com/wkkwky/bilibili-part-pubdate/main/bilibili-part-pubdate.user.js
// @updateURL    https://raw.githubusercontent.com/wkkwky/bilibili-part-pubdate/main/bilibili-part-pubdate.user.js
// @match        https://www.bilibili.com/video/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const viewCache = {}; // bvid -> Promise，同一稿件只请求一次

  function getView(bvid) {
    if (!viewCache[bvid]) {
      viewCache[bvid] = fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
        .then(r => r.json())
        .then(j => j.data)
        .catch(() => null); // 网络失败吞掉，否则轮询每秒抛一条未处理的 rejection
    }
    return viewCache[bvid];
  }

  function fmt(ts) {
    const d = new Date(ts * 1000), z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  }

  // 页面存在多个 .pubdate-ip-text：一个在标题下方信息行，其余在隐藏的 .overflow-panel 副本里。
  // 两处都写，站点在两种布局间切换时都能直接看到。
  const LABEL = 'bili-part-ctime';

  async function update() {
    const bvid = location.pathname.match(/BV\w+/)?.[0];
    if (!bvid) return;
    const p = +(new URLSearchParams(location.search).get('p') || 1);
    const key = `${bvid}?p=${p}`;

    const hosts = [...document.querySelectorAll('.pubdate-ip-text')];
    if (!hosts.length) return;

    // 只处理还没标注到当前P的容器
    const stale = hosts.filter(h => h.querySelector(`.${LABEL}`)?.dataset.key !== key);
    if (!stale.length) return;

    const data = await getView(bvid);
    if (!data || !data.pages || data.pages.length < 2) { // 单P视频不显示
      document.querySelectorAll(`.${LABEL}`).forEach(el => el.remove());
      return;
    }
    const page = data.pages.find(x => x.page === p);
    if (!page) return;

    const text = `（本P发布于 ${fmt(page.ctime)}）`;
    for (const host of stale) {
      let label = host.querySelector(`.${LABEL}`);
      if (!label) {
        label = document.createElement('span');
        label.className = LABEL;
        label.style.marginLeft = '8px';
        host.appendChild(label);
      }
      label.dataset.key = key;
      label.textContent = text;
    }
  }

  // 1s 轮询兜底 B 站切换分P时的 SPA 无刷新跳转；每秒一次选择器查询，开销可忽略
  setInterval(update, 1000);
})();
