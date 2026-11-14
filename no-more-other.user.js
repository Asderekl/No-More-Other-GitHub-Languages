// ==UserScript==
// @name         No More Other: GitHub Languages
// @namespace    https://github.com/Asderekl/no-more-other-github-languages
// @version      1.0.0
// @description  Reveals hidden languages in GitHub statistics
// @match        https://github.com/*
// @grant        none
// @connect      api.github.com
// @run-at       document-idle
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/Asderekl/No-More-Other-GitHub-Languages/main/no-more-other.user.js
// @downloadURL  https://raw.githubusercontent.com/Asderekl/No-More-Other-GitHub-Languages/main/no-more-other.user.js
// ==/UserScript==

(function() {
    'use strict';

    const LANG_COLORS = {
        "Java": "#b07219", "Kotlin": "#A97BFF", "XML": "#0060ac", "Groovy": "#4298b8",
        "JavaScript": "#f1e05a", "TypeScript": "#3178c6", "Python": "#3572A5",
        "C": "#555555", "C++": "#f34b7d", "C#": "#178600", "Shell": "#89e051",
        "HTML": "#e34c26", "CSS": "#563d7c", "Other": "#8b949e"
    };

    function hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    function getDeterministicColor(lang) {
        let hash = 0;
        for (let i = 0; i < lang.length; i++) {
            hash = lang.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return hslToHex(hue, 75, 55);
    }

    function formatPercent(p) {
        if (p > 0 && p < 0.01) return "< 0.01";
        return p.toFixed(2);
    }

    function getRepoInfo() {
        const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
        if (!match) return null;
        if (['issues', 'pulls', 'settings', 'actions', 'projects', 'wiki'].includes(match[2])) return null;
        return { owner: match[1], repo: match[2] };
    }

    async function processLanguages(container, repoInfo) {
        if (container.getAttribute('data-lang-script-done')) return;
        container.setAttribute('data-lang-script-done', 'true');

        try {
            console.log(`[No More Other] Fetching languages for ${repoInfo.owner}/${repoInfo.repo}...`);
            const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/languages`);

            if (!response.ok) {
                console.error(`[No More Other] API Error: ${response.status} ${response.statusText}. Возможно, превышен лимит (60 запросов/час).`);
                return;
            }

            const langData = await response.json();
            if (Object.keys(langData).length === 0) return;

            const totalBytes = Object.values(langData).reduce((a, b) => a + b, 0);
            if (totalBytes === 0) return;

            const sortedLangs = Object.entries(langData).sort((a, b) => b[1] - a[1]);

            // Hide original elements (do not delete them to avoid React crashes)
            Array.from(container.children).forEach(child => {
                if (child.tagName !== 'H2' && !child.classList.contains('h4')) {
                    child.style.display = 'none';
                }
            });

            // Create a wrapper for our custom UI
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-lang-wrapper';

            const newBar = document.createElement('div');
            newBar.style.cssText = 'display:flex; height:8px; border-radius:4px; overflow:hidden; margin-top:12px; margin-bottom:8px; width:100%;';

            const newList = document.createElement('ul');
            newList.style.cssText = 'display:flex; flex-wrap:wrap; gap:16px; list-style:none; padding:0; margin:0; font-size:12px;';

            sortedLangs.forEach(([lang, bytes]) => {
                const percent = ((bytes / totalBytes) * 100);
                const color = LANG_COLORS[lang] || getDeterministicColor(lang);

                const segment = document.createElement('div');
                segment.style.backgroundColor = color;
                segment.style.flex = `${percent} 1 0%`;
                segment.style.minWidth = '2px';
                segment.title = `${lang} ${formatPercent(percent)}%`;
                newBar.appendChild(segment);

                const li = document.createElement('li');
                li.style.cssText = 'display:flex; align-items:center; gap:4px;';

                const dot = document.createElement('span');
                dot.style.cssText = `width:8px; height:8px; border-radius:50%; background-color:${color}`;

                const text = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = lang;
                text.appendChild(strong);
                text.appendChild(document.createTextNode(` ${formatPercent(percent)}%`));

                li.appendChild(dot);
                li.appendChild(text);
                newList.appendChild(li);
            });

            wrapper.appendChild(newBar);
            wrapper.appendChild(newList);
            container.appendChild(wrapper);
            console.log("[No More Other] Successfully rendered custom languages.");

        } catch (error) {
            console.error("[No More Other] Error:", error);
        }
    }

    function initObserver() {
        const repoInfo = getRepoInfo();
        if (!repoInfo) return;

        const observer = new MutationObserver(() => {
            let container = null;
            const headers = Array.from(document.querySelectorAll('h2, h3'));
            const langHeader = headers.find(el => el.textContent.trim() === 'Languages');

            if (langHeader) {
                container = langHeader.closest('.BorderGrid-cell') || langHeader.parentElement;
            } else {
                const spans = Array.from(document.querySelectorAll('span, li'));
                const otherSpan = spans.find(el => el.textContent.trim() === 'Other');
                if (otherSpan) {
                    container = otherSpan.closest('.BorderGrid-cell') || otherSpan.closest('ul')?.parentElement;
                }
            }

            if (container && !container.hasAttribute('data-lang-script-done')) {
                observer.disconnect(); // Disconnect once found to stop interfering with React
                processLanguages(container, repoInfo);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback for SPA transitions
        setTimeout(() => {
            const headers = Array.from(document.querySelectorAll('h2, h3'));
            const langHeader = headers.find(el => el.textContent.trim() === 'Languages');
            if (langHeader) {
                const container = langHeader.closest('.BorderGrid-cell') || langHeader.parentElement;
                if (container && !container.hasAttribute('data-lang-script-done')) {
                    processLanguages(container, repoInfo);
                }
            }
        }, 1500);
    }

    document.addEventListener('turbo:load', initObserver);
    window.addEventListener('load', initObserver);
})();
