(function(){
  const APP_VERSION = window.APP_VERSION || '1.3.0';

  const historyKey = 'uuid_converter_history';
  const historyCounterKey = 'uuid_converter_history_counter';
  const prefsKey = 'uuid_converter_prefs';
  const inputSaveKey = 'uuid_converter_input';
  const versionKey = 'uuid_converter_version';

  const MAX_HISTORY = 2000;

  // Version migration notice
  try {
    const prev = localStorage.getItem(versionKey);
    if (prev !== APP_VERSION) {
      localStorage.setItem(versionKey, APP_VERSION);


      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('updateNotice');
        if(!el) return;
        el.style.display = 'block';
        el.innerHTML = 'Обновление: загружена версия ' + APP_VERSION +
          '. Если интерфейс отображается некорректно — <button id="reloadForUpdate" type="button">Перезагрузить</button>.';
        const btn = document.getElementById('reloadForUpdate');
        if(btn) btn.addEventListener('click', () => location.reload());
      });
    }
  } catch (e) {}

  // semver
  function compareSemver(a,b){
    if(!a || !b) return 0;
    const pa = String(a).split('.').map(n=>parseInt(n,10)||0);
    const pb = String(b).split('.').map(n=>parseInt(n,10)||0);
    for(let i=0;i<Math.max(pa.length,pb.length);i++){
      const na = pa[i]||0, nb = pb[i]||0;
      if(na>nb) return 1;
      if(na<nb) return -1;
    }
    return 0;
  }

  function showUpdateToast(remoteVer){
    const root = document.getElementById('updateToastRoot');
    if(!root) return;
    if(root.querySelector('.update-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.innerHTML = `
      <div class="ut-message">Доступна новая версия: <strong>${remoteVer}</strong>. Обновить интерфейс?</div>
      <div class="ut-actions">
        <button class="ut-btn primary" id="updateNow" type="button">Обновить</button>
        <button class="ut-btn ghost" id="dismissUpdate" type="button" aria-label="Закрыть">Закрыть</button>
      </div>
    `;

    root.appendChild(toast);
    requestAnimationFrame(()=> toast.classList.add('show'));

    const btn = toast.querySelector('#updateNow');
    const dismiss = toast.querySelector('#dismissUpdate');

    if(btn) btn.addEventListener('click', ()=> location.reload());
    if(dismiss) dismiss.addEventListener('click', ()=>{
      toast.classList.remove('show');
      setTimeout(()=> toast.remove(), 220);
    });

    setTimeout(()=>{
      if(toast && toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(()=> toast.remove(), 220);
      }
    }, 120000);
  }

  async function checkRemoteVersion(){
    try{
      const res = await fetch('version.js?cb=' + Date.now(), { cache: 'no-store' });
      if(!res.ok) return;
      const text = await res.text();
      let parsed;
      try{ parsed = JSON.parse(text); }catch(e){ return; }
      const remote = parsed && parsed.version ? String(parsed.version) : null;
      if(!remote) return;
      if(compareSemver(remote, APP_VERSION) > 0){
        showUpdateToast(remote);
      }
    }catch(e){}
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(checkRemoteVersion, 1500);
  });

  document.addEventListener('DOMContentLoaded', () => {
    // DOM refs
    const input = document.getElementById('input');
    const output = document.getElementById('output');
    const inputLineCount = document.getElementById('inputLineCount');
    const outputLineCount = document.getElementById('outputLineCount');
    const treeUuidsLineCount = document.getElementById('treeUuidsLineCount');
    const convertBtn = document.getElementById('convert');
    const clearBtn = document.getElementById('clear');
    const copyBtn = document.getElementById('copy');

    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistory = document.getElementById('closeHistory');
    const historyContent = document.getElementById('historyContent');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');

    const mainPanel = document.getElementById('mainPanel');

    const hotkeysBtn = document.getElementById('hotkeysBtn');
    const hotkeysModal = document.getElementById('hotkeysModal');
    const closeHotkeys = document.getElementById('closeHotkeys');

    const paletteControl = document.getElementById('paletteControl');
    const paletteToggle = document.getElementById('paletteToggle');
    const palettePopover = document.getElementById('palettePopover');
    const paletteColor = document.getElementById('paletteColor');
    const palettePresetsContainer = document.getElementById('palettePresets');
    const paletteReset = document.getElementById('paletteReset');

    const themeToggle = document.getElementById('themeToggle');
    const appVersionEl = document.getElementById('appVersion');

    // tabs
    const tabUuid = document.getElementById('tabUuid');
    const tabTree = document.getElementById('tabTree');
    const panelUuid = document.getElementById('panelUuid');
    const panelTree = document.getElementById('panelTree');

    // ===== UUID converter actions =====
    function setUuidPlaceholders(){
      if(input && !input.value) input.placeholder = 'Введите строки...';
      if(output && !output.value) output.placeholder = 'Здесь появится результат...';
    }

    function showUuidConvertSuccess(){
      updateOutputLineCount();
      if(mainPanel){
        mainPanel.classList.remove('converted');
        void mainPanel.offsetWidth;
        mainPanel.classList.add('converted');
      }
      if(convertBtn){
        convertBtn.classList.add('success');
        convertBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 10-9 9" stroke="currentColor" stroke-width="1.4"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="1.4"/></svg></span>Сконвертировали!';
        setTimeout(()=> {
          convertBtn.classList.remove('success');
          if(convertBtnOriginal) convertBtn.innerHTML = convertBtnOriginal;
        }, 900);
      }
    }

    function uuidConvert(){
      if(!input || !output) return;
      const arr = linesFromInput(input.value);
      if(!arr || arr.length === 0){
        toast('Введите хотя бы одну строку', 'danger');
        input.focus();
        return;
      }

      // overwrite result (no stacking)
      output.value = '';
      const content = arr.map(s => `"${jsonEscape(s)}"`).join(',\n');
      const out = `[\n${content}\n]`;
      output.value = out;
      output.placeholder = '';
      output.scrollTop = 0;

      addToHistory(input.value, out);
      if(historyModal.classList.contains('show')) renderHistory();
      showUuidConvertSuccess();
    }

    convertBtn && convertBtn.addEventListener('click', uuidConvert);

    clearBtn && clearBtn.addEventListener('click', () => {
      if(input){ input.value = ''; input.placeholder = 'Введите строки...'; }
      if(output){ output.value = ''; output.placeholder = 'Здесь появится результат...'; output.scrollTop = 0; }
      toast('Очищено', 'success');
      updateInputLineCount();
      updateOutputLineCount();
      input && input.focus();
    });

    copyBtn && copyBtn.addEventListener('click', async () => {
      if(!output) return;
      const text = String(output.value || '').trim();
      if(!text){
        toast('Нет результата для копирования', 'danger');
        return;
      }
      try{
        if(!navigator.clipboard || !navigator.clipboard.writeText){
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } else {
          await navigator.clipboard.writeText(text);
        }

        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="1.6"/></svg></span><span class="copy-label">Скопировано!</span>';
        setTimeout(()=> {
          copyBtn.classList.remove('copied');
          if(copyBtnOriginal) copyBtn.innerHTML = copyBtnOriginal;
        }, 1200);
      }catch(e){
        toast('Не удалось скопировать', 'danger');
      }
    });
    // line counters
    input && input.addEventListener('input', updateInputLineCount);
    // update immediately when switching focus (paste etc.)
    input && input.addEventListener('change', updateInputLineCount);




    // hotkeys: Ctrl/Cmd+Enter => Конвертировать (активная вкладка)
    function isTreeTabActive(){
      return !!(panelTree && !panelTree.hasAttribute('hidden'));
    }
    function isUuidTabActive(){
      return !!(panelUuid && !panelUuid.hasAttribute('hidden'));
    }
    window.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        try{
          if(palettePopover && palettePopover.classList.contains('open')) closePalette();
        }catch(err){}

        if(confirmModal && confirmModal.classList.contains('show')){
          e.preventDefault();
          try{ confirmCancel && confirmCancel.click(); }catch(err){}
          return;
        }

        const open = document.querySelector('.modal.show');
        if(open){
          e.preventDefault();
          if(open === historyModal) closeModal(historyModal, historyBtn);
          if(open === hotkeysModal) closeModal(hotkeysModal, hotkeysBtn);
          if(open === treeHistoryModal) closeModal(treeHistoryModal, treeHistoryBtn);
        }
      }

      if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        // if any modal is open, don't trigger conversion
        const openModal = document.querySelector('.modal.show');
        if(openModal) return;

        e.preventDefault();
        if(isTreeTabActive()){
          // treeBuild may be declared later; safe at runtime
          try{ treeBuild && treeBuild.click(); }catch(err){}
        } else if(isUuidTabActive()){
          try{ uuidConvert(); }catch(err){}
        } else {
          // fallback
          try{ uuidConvert(); }catch(err){}
        }
      }
    });



    // tree converter
    const treeAction = document.getElementById('treeAction');
    const treeDayDate = document.getElementById('treeDayDate');
    const treeFromDT = document.getElementById('treeFromDT');
    const treeToDT = document.getElementById('treeToDT');
    const treeToWrap = document.getElementById('treeToWrap');
    const treeNow = document.getElementById('treeNow');
    const treeToken = document.getElementById('treeToken');
const treeUuids = document.getElementById('treeUuids');
    const treeOutput = document.getElementById('treeOutput');
    const treeBuild = document.getElementById('treeBuild');
    const treeCopy = document.getElementById('treeCopy');
    const treeClear = document.getElementById('treeClear');
    const treeHistoryBtn = document.getElementById('treeHistoryBtn');
    const treeHistoryModal = document.getElementById('treeHistoryModal');
    const closeTreeHistory = document.getElementById('closeTreeHistory');
    const treeHistoryContent = document.getElementById('treeHistoryContent');
    const clearTreeHistoryBtn = document.getElementById('clearTreeHistoryBtn');
    const treeHistoryCountEl = document.getElementById('treeHistoryCount');


    // confirm modal
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmClose = document.getElementById('confirmClose');

    // defaults
    const treePrefsKey = 'uuid_converter_tree_prefs';

    const defaultAccent = '#2b7be4';
    const defaultAccent600 = '#1a5fc1';
    const presets = ['#2b7be4','#16a34a','#7c3aed','#f97316','#ef4444','#0ea5a4'];

    if(appVersionEl) appVersionEl.textContent = 'Версия: ' + APP_VERSION;

    const convertBtnOriginal = convertBtn ? convertBtn.innerHTML : '';
    const copyBtnOriginal = copyBtn ? copyBtn.innerHTML : '';

    // toast (no alert)
    function toast(message, kind='info'){
      const root = document.getElementById('appToastRoot');
      if(!root) return;

      const t = document.createElement('div');
      t.className = 'app-toast ' + (kind || 'info');
      t.textContent = message;
      root.appendChild(t);

      requestAnimationFrame(()=> t.classList.add('show'));
      setTimeout(()=>{
        t.classList.remove('show');
        setTimeout(()=> t.remove(), 240);
      }, 1700);
    }


    function setActiveTab(which){
      const isTree = which === 'tree';

      if(tabUuid){
        tabUuid.classList.toggle('active', !isTree);
        tabUuid.setAttribute('aria-selected', isTree ? 'false' : 'true');
        tabUuid.tabIndex = isTree ? -1 : 0;
      }
      if(tabTree){
        tabTree.classList.toggle('active', isTree);
        tabTree.setAttribute('aria-selected', isTree ? 'true' : 'false');
        tabTree.tabIndex = isTree ? 0 : -1;
      }

      if(panelUuid){
        panelUuid.classList.toggle('active', !isTree);
        if(isTree) panelUuid.setAttribute('hidden','');
        else panelUuid.removeAttribute('hidden');
      }
      if(panelTree){
        panelTree.classList.toggle('active', isTree);
        if(isTree) panelTree.removeAttribute('hidden');
        else panelTree.setAttribute('hidden','');
      }

      try{ localStorage.setItem('uuid_converter_active_tab', isTree ? 'tree' : 'uuid'); }catch(e){}
    }

    function initTabs(){
      const saved = (function(){ try{ return localStorage.getItem('uuid_converter_active_tab'); }catch(e){ return null; } })();
      setActiveTab(saved === 'tree' ? 'tree' : 'uuid');

      tabUuid && tabUuid.addEventListener('click', () => setActiveTab('uuid'));
      tabTree && tabTree.addEventListener('click', () => setActiveTab('tree'));

      const tabs = [tabUuid, tabTree].filter(Boolean);
      tabs.forEach((t, idx) => {
        t.addEventListener('keydown', (e) => {
          if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = tabs[(idx + dir + tabs.length) % tabs.length];
            next.focus();
            next.click();
          }
        });
      });
    }

    // utilities

    function hexToRgb(hex){
      hex = String(hex || '').replace('#','');
      if(hex.length === 3) hex = hex.split('').map(ch=>ch+ch).join('');
      const bigint = parseInt(hex,16) || 0;
      return { r: (bigint>>16)&255, g: (bigint>>8)&255, b: bigint&255 };
    }
    function rgbToHex(r,g,b){
      const toHex = n => ('0'+Math.round(n).toString(16)).slice(-2);
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    function rgbToHsl(r,g,b){
      r/=255; g/=255; b/=255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      let h=0, s=0, l=(max+min)/2;
      if(max!==min){
        const d = max-min;
        s = l>0.5 ? d/(2-max-min) : d/(max+min);
        switch(max){
          case r: h = (g-b)/d + (g<b?6:0); break;
          case g: h = (b-r)/d + 2; break;
          case b: h = (r-g)/d + 4; break;
        }
        h /= 6;
      }
      return { h: h*360, s: s*100, l: l*100 };
    }
    function hslToRgb(h,s,l){
      h/=360; s/=100; l/=100;
      if(s===0){ const v = Math.round(l*255); return { r:v,g:v,b:v }; }
      function hue2rgb(p,q,t){
        if(t<0) t+=1; if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3-t)*6;
        return p;
      }
      const q = l<0.5 ? l*(1+s) : l+s - l*s;
      const p = 2*l - q;
      const r = hue2rgb(p,q,h+1/3);
      const g = hue2rgb(p,q,h);
      const b = hue2rgb(p,q,h-1/3);
      return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    }
    function darkenHex(hex, amountPercent=15){
      const {r,g,b} = hexToRgb(hex);
      const hsl = rgbToHsl(r,g,b);
      hsl.l = Math.max(0, hsl.l - amountPercent);
      const rgb = hslToRgb(hsl.h,hsl.s,hsl.l);
      return rgbToHex(rgb.r,rgb.g,rgb.b);
    }

    // prefs
    let suspendSave = false;

    function savePrefs(){
      if(suspendSave) return;
      const prefs = {
        theme: document.documentElement.getAttribute('data-theme') || 'light',
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || defaultAccent
      };
      try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch(e){}
    }

    function setTheme(theme, persist=true){
      if(theme === 'dark'){
        document.documentElement.setAttribute('data-theme','dark');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','true');
      } else {
        document.documentElement.setAttribute('data-theme','light');
        if(themeToggle) themeToggle.setAttribute('aria-pressed','false');
      }
      if(persist) savePrefs();
    }

    function applyAccent(hex, persist=true){
      if(!hex) return;
      const darker = darkenHex(hex, 18);
      document.documentElement.style.setProperty('--accent', hex);
      document.documentElement.style.setProperty('--accent-600', darker);
      const {r,g,b} = hexToRgb(hex);
      document.documentElement.style.setProperty('--accent-r', r);
      document.documentElement.style.setProperty('--accent-g', g);
      document.documentElement.style.setProperty('--accent-b', b);

      document.querySelectorAll('.swatch').forEach(s=>{
        if(s.dataset.color && s.dataset.color.toLowerCase() === String(hex || '').toLowerCase()) s.classList.add('active');
        else s.classList.remove('active');
      });

      if(paletteColor && paletteColor.value.toLowerCase() !== hex.toLowerCase()) paletteColor.value = hex;
      if(persist) savePrefs();
    }

    function loadPrefs(){
      suspendSave = true;
      try{
        const raw = localStorage.getItem(prefsKey);
        if(!raw){
          setTheme('light', false);
          applyAccent(defaultAccent, false);
        } else {
          const p = JSON.parse(raw);
          setTheme(p?.theme || 'light', false);
          applyAccent(p?.accent || defaultAccent, false);
        }
      }catch(e){
        setTheme('light', false);
        applyAccent(defaultAccent, false);
      }finally{
        suspendSave = false;
        savePrefs();
      }
    }

    if(themeToggle){
      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        setTheme(current === 'dark' ? 'light' : 'dark', true);
        toast(document.documentElement.getAttribute('data-theme') === 'dark' ? 'Тема: тёмная' : 'Тема: светлая');
      });
    }

    // palette
    function buildPalettePresets(){
      if(!palettePresetsContainer) return;
      palettePresetsContainer.innerHTML = '';
      presets.forEach(col=>{
        const btn = document.createElement('button');
        btn.className = 'swatch';
        btn.style.background = col;
        btn.dataset.color = col;
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Выбрать ' + col);
        btn.addEventListener('click', ()=> { applyAccent(col, true); toast('Цвет акцента сохранён'); });
        palettePresetsContainer.appendChild(btn);
      });
    }

    function openPalette(){
      if(!palettePopover) return;
      palettePopover.classList.add('open');
      palettePopover.setAttribute('aria-hidden','false');
      paletteToggle && paletteToggle.setAttribute('aria-expanded','true');
    }
    function closePalette(){
      if(!palettePopover) return;
      palettePopover.classList.remove('open');
      palettePopover.setAttribute('aria-hidden','true');
      paletteToggle && paletteToggle.setAttribute('aria-expanded','false');
    }

    if(paletteToggle){
      paletteToggle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const expanded = paletteToggle.getAttribute('aria-expanded') === 'true';
        expanded ? closePalette() : openPalette();
      });
    }

    document.addEventListener('click', (ev) => {
      if(paletteControl && !paletteControl.contains(ev.target)){
        closePalette();
      }
    });

    paletteColor && paletteColor.addEventListener('input', (e) => { applyAccent(e.target.value, true); });
    paletteReset && paletteReset.addEventListener('click', () => { applyAccent(defaultAccent, true); toast('Цвет сброшен'); });

    // history helpers
    function escapeHtml(unsafe){
      return String(unsafe)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }

    function makeId(){
      try{ if(crypto?.randomUUID) return crypto.randomUUID(); }catch(e){}
      return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    }

    function parseNumberedName(name){
      const m = String(name || '').match(/^Запись\s+(\d+)$/i);
      if(!m) return null;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    function getHistoryCounterSeed(history){
      let maxN = 0;
      for(const it of (history || [])){
        const n = parseNumberedName(it?.name);
        if(n && n > maxN) maxN = n;
      }
      return maxN + 1;
    }

    function nextHistoryIndex(){
      let n = 1;
      try{
        const raw = localStorage.getItem(historyCounterKey);
        n = raw ? (parseInt(raw, 10) || 1) : 1;
      }catch(e){ n = 1; }

      // ensure not less than max+1 of existing history
      try{
        const history = readHistoryRaw();
        const seed = getHistoryCounterSeed(history);
        if(n < seed) n = seed;
      }catch(e){}

      try{ localStorage.setItem(historyCounterKey, String(n + 1)); }catch(e){}
      return n;
    }

    function migrateHistoryItems(items){
      const history = (items || []).map(it => ({
        ...it,
        id: it?.id || makeId(),
        time: it?.time || new Date().toISOString(),
        name: (it?.name && String(it.name).trim()) ? String(it.name).trim() : 'Без названия',
        input: it?.input ?? '',
        output: it?.output ?? ''
      }));

      // Ensure any "Без названия" becomes "Запись N" (sequential, no reuse)
      let maxN = 0;
      for(const it of history){
        const n = parseNumberedName(it.name);
        if(n && n > maxN) maxN = n;
      }
      for(const it of history){
        if(!it.name || it.name === 'Без названия'){
          maxN += 1;
          it.name = 'Запись ' + maxN;
        }
      }

      // keep counter >= maxN+1
      try{
        const raw = localStorage.getItem(historyCounterKey);
        const cur = raw ? (parseInt(raw,10) || 1) : 1;
        const need = maxN + 1;
        if(cur < need) localStorage.setItem(historyCounterKey, String(need));
      }catch(e){}

      return history;
    }

    const historyCache = new Map();
    function readStoredHistory(key){
      if(historyCache.has(key)) return historyCache.get(key);
      try{
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        const items = Array.isArray(data) ? data : [];
        historyCache.set(key, items);
        return items;
      }catch(e){ toast('Не удалось прочитать историю. Исходные данные сохранены.', 'danger'); return []; }
    }
    function persistHistory(key, items){
      historyCache.set(key, items);
      try{ localStorage.setItem(key, JSON.stringify(items)); return true; }
      catch(e){ toast('Хранилище заполнено. Экспортируйте историю: изменения пока доступны только в этой вкладке.', 'danger'); return false; }
    }
    window.addEventListener('storage', e => {
      if(e.key === historyKey || e.key === treeHistoryKey){ historyCache.delete(e.key); updateHistoryBadge(readHistory().length); updateTreeHistoryBadge(); }
    });
    function readHistoryRaw(){ return readStoredHistory(historyKey); }
    function readHistory(){
      const items = readHistoryRaw();
      if(!items.every(it => it.id && it.name && it.time)){
        const migrated = migrateHistoryItems(items);
        historyCache.set(historyKey, migrated);
        return migrated;
      }
      return items;
    }
    function writeHistory(history){ persistHistory(historyKey, history); updateHistoryBadge(history.length); }

    function updateHistoryBadge(len){
      const el = document.getElementById('historyCount');
      if(!el) return;
      el.textContent = String(len || 0);
      if(len && len>0) el.classList.add('visible'); else el.classList.remove('visible');
    }

    function formatTime(t){
      const d = new Date(t);
      if(Number.isNaN(d.getTime())) return String(t || '');
      return d.toLocaleString();
    }

    // NG history (for НГ tab)
    const treeHistoryKey = 'uuid_converter_tree_history';

    function readTreeHistory(){ return readStoredHistory(treeHistoryKey); }
    function writeTreeHistory(arr){ persistHistory(treeHistoryKey, arr || []); }
    function updateTreeHistoryBadge(){
      const hist = readTreeHistory();
      if(!treeHistoryCountEl) return;
      treeHistoryCountEl.textContent = String(hist.length || 0);
      if(hist.length > 0) treeHistoryCountEl.classList.add('visible'); else treeHistoryCountEl.classList.remove('visible');
    }
    function addTreeHistoryRecord(rec){
      const hist = readTreeHistory();
      if(hist[0]?.output === rec.output) return;
      if(hist.length >= MAX_HISTORY){ toast('Лимит новых записей НГ достигнут. Экспортируйте историю и удалите ненужные записи.', 'danger'); return; }
      hist.unshift(rec);
      writeTreeHistory(hist);
      updateTreeHistoryBadge();
    }

    function renderTreeHistory(){ renderHistoryList(true); }
    const historyViews = [{query:'', limit:40}, {query:'', limit:40}];
    function renderHistoryList(tree){
      const host = tree ? treeHistoryContent : historyContent;
      if(!host) return;
      const items = tree ? readTreeHistory() : readHistory();
      const state = historyViews[tree ? 1 : 0];
      const query = state.query.toLocaleLowerCase();
      const matches = [];
      for(let idx=0; idx<items.length; idx++){
        const it=items[idx];
        if(!query || [it.name,it.input,it.output].some(v=>String(v || '').toLocaleLowerCase().includes(query))) matches.push(idx);
      }
      host.innerHTML = matches.slice(0,state.limit).map(idx=>{
        const it=items[idx];
        return `<article class="history-item"><div class="history-header" data-idx="${idx}" tabindex="0" aria-expanded="false"><div class="hh-left"><div class="hh-name">${escapeHtml(it.name || 'Запись')}</div><div class="hh-time">${escapeHtml(formatTime(it.time))}</div></div><div class="hh-actions"><button class="ghost small" data-action="copy" data-idx="${idx}">Копировать</button><button class="ghost small" data-action="rename" data-idx="${idx}">Переименовать</button><button class="ghost small danger" data-action="delete" data-idx="${idx}">Удалить</button></div></div><div class="history-body"></div></article>`;
      }).join('') || 'Нет записей';
      if(matches.length>state.limit) host.insertAdjacentHTML('beforeend', `<button class="ghost history-more">Показать ещё 40 · ${Math.min(state.limit,matches.length)} / ${matches.length}</button>`);
    }
    function setupHistory(tree){
      const host=tree ? treeHistoryContent : historyContent;
      if(!host) return;
      const search=document.createElement('input'); search.type='search'; search.className='text-input history-search'; search.placeholder='Поиск по названию, вводу и результату'; search.setAttribute('aria-label','Поиск по истории'); host.before(search);
      let timer;
      search.addEventListener('input',()=>{ clearTimeout(timer); timer=setTimeout(()=>{ const state=historyViews[tree?1:0]; state.query=search.value; state.limit=40; renderHistoryList(tree); },150); });
      host.addEventListener('keydown',e=>{if(e.target.matches('.history-header') && ['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();}});
      host.addEventListener('click',async e=>{
        if(e.target.closest('.history-more')){ historyViews[tree?1:0].limit+=40; renderHistoryList(tree); return; }
        const header=e.target.closest('.history-header'); if(!header || e.target.closest('input')) return;
        const idx=Number(header.dataset.idx); const items=tree?readTreeHistory():readHistory(); const it=items[idx]; if(!it)return;
        const button=e.target.closest('[data-action]');
        if(button){
          const action=button.dataset.action;
          if(action==='copy'){try{await copyTextToClipboard(it.output || '');toast('Скопировано','success');}catch{toast('Не удалось скопировать','danger');}return;}
          if(action==='rename'){
            const input=document.createElement('input');input.className='hh-input';input.value=it.name || '';input.maxLength=64;input.setAttribute('aria-label','Название записи');
            const name=header.querySelector('.hh-name');name.replaceChildren(input);input.focus();input.select();
            let finished=false;
            const save=()=>{if(finished)return;finished=true;it.name=input.value.trim() || it.name;(tree?writeTreeHistory:writeHistory)(items);renderHistoryList(tree);};
            input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();save();}if(ev.key==='Escape'){finished=true;ev.stopPropagation();renderHistoryList(tree);}});input.addEventListener('change',save,{once:true});return;
          }
          if(action==='delete' && await confirmUI({title:'Удалить запись',message:'Удалить запись из истории?',okText:'Удалить',danger:true})){
            const current=items.indexOf(it); if(current<0)return;items.splice(current,1);(tree?writeTreeHistory:writeHistory)(items);updateTreeHistoryBadge();renderHistoryList(tree);
          }
          return;
        }
        const body=header.nextElementSibling;const open=header.getAttribute('aria-expanded')!=='true';header.setAttribute('aria-expanded',String(open));body.classList.toggle('open',open);
        if(open){
          body.replaceChildren();
          for(const [label,value] of tree?[['Результат',it.output]]:[['Ввод',it.input],['Результат',it.output]]){const title=document.createElement('strong');title.textContent=label;const pre=document.createElement('pre');pre.textContent=value || '';body.append(title,pre);}
        }else body.replaceChildren();
      });
    }

    // modals helpers (focus restore)
    document.addEventListener('keydown', e=>{
      if(e.key!=='Tab') return;
      const modal=Array.from(document.querySelectorAll('.modal.show')).at(-1);
      if(!modal) return;
      const focusable=Array.from(modal.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
    });

    function openModal(modal, openerBtn, focusEl){
      if(!modal) return;
      modal._opener = openerBtn || document.activeElement;
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.classList.add('show');
        modal.setAttribute('aria-hidden','false');
        openerBtn && openerBtn.setAttribute('aria-expanded','true');
        (focusEl || modal.querySelector('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'))?.focus();
      });
    }
    function closeModal(modal, openerBtn){
      if(!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
      openerBtn && openerBtn.setAttribute('aria-expanded','false');
      setTimeout(()=> { if(!modal.classList.contains('show')) modal.style.display='none'; }, 220);
      modal._opener?.focus();
    }

    function confirmUI({ title='Подтверждение', message='Вы уверены?', okText='Ок', cancelText='Отмена', danger=false }){
      return new Promise(resolve => {
        if(!confirmModal) return resolve(false);

        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmOk.textContent = okText;
        confirmCancel.textContent = cancelText;

        // quick danger hint (no extra CSS)
        if(danger){
          confirmOk.style.background = 'linear-gradient(90deg,#ef4444,#f97316)';
        } else {
          confirmOk.style.background = '';
        }

        const cleanup = () => {
          confirmOk.removeEventListener('click', onOk);
          confirmCancel.removeEventListener('click', onCancel);
          confirmClose.removeEventListener('click', onCancel);
          confirmModal.removeEventListener('click', onOverlay);
          window.removeEventListener('keydown', onKey);
        };

        const onOk = () => { cleanup(); closeModal(confirmModal); resolve(true); };
        const onCancel = () => { cleanup(); closeModal(confirmModal); resolve(false); };
        const onOverlay = (e) => { if(e.target === confirmModal) onCancel(); };
        const onKey = (e) => { if(e.key === 'Escape' && confirmModal.classList.contains('show')) onCancel(); };

        confirmOk.addEventListener('click', onOk);
        confirmCancel.addEventListener('click', onCancel);
        confirmClose.addEventListener('click', onCancel);
        confirmModal.addEventListener('click', onOverlay);
        window.addEventListener('keydown', onKey);

        openModal(confirmModal, document.activeElement, confirmCancel);
      });
    }

    // history operations
    function addToHistory(inputText, outputText){
      const history = readHistory();

      // dedupe same as last
      const top = history[0];
      if(top && top.input === inputText && top.output === outputText){
        updateHistoryBadge(history.length);
        return;
      }

      // get next free index for "Запись N"
      const n = nextHistoryIndex();
      const rec = {
        id: makeId(),
        time: new Date().toISOString(),
        name: 'Запись ' + n,
        input: inputText,
        output: outputText
      };

      history.unshift(rec);

      writeHistory(history);

      toast('Добавлено в историю: ' + rec.name, 'success');
    }

    function renderHistory(){ renderHistoryList(false); }

    if(historyBtn){
      historyBtn.addEventListener('click', () => {
        renderHistory();
        openModal(historyModal, historyBtn, closeHistory || clearHistoryBtn);
      });
    }

    if(closeHistory){
      closeHistory.addEventListener('click', () => closeModal(historyModal, historyBtn));
    }

    if(exportHistoryBtn){
      exportHistoryBtn.addEventListener('click', () => {
        const history = readHistory();
        if(!history || history.length === 0){
          toast('Нет записей для экспорта', 'danger');
          return;
        }
        const json = JSON.stringify(history, null, 2);
        try{
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'uuid-converter-history.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast('Экспорт готов', 'success');
        }catch(e){
          toast('Не удалось экспортировать', 'danger');
        }
      });
    }

    if(clearHistoryBtn){
      clearHistoryBtn.addEventListener('click', async () => {
        const ok = await confirmUI({
          title: 'Очистить историю',
          message: 'Удалить все записи истории? Это действие нельзя отменить.',
          okText: 'Удалить всё',
          cancelText: 'Отмена',
          danger: true
        });
        if(!ok) return;

        writeHistory([]);
        try{ localStorage.setItem(historyCounterKey, '1'); }catch(e){}
        renderHistory();
        updateHistoryBadge(0);
        toast('История очищена', 'success');
      });
    }

    function downloadJson(value, name){
      const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    for(const tree of [false,true]){
      const modal=tree?treeHistoryModal:historyModal;
      const actions=modal.querySelector('.modal-actions');
      if(tree){const btn=document.createElement('button');btn.className='ghost';btn.textContent='Экспорт';btn.onclick=()=>downloadJson(JSON.stringify(readTreeHistory(),null,2),'cnvrt-ng-history.json');actions.prepend(btn);}
      const btn=document.createElement('button');btn.className='ghost';btn.textContent='Импорт';
      const file=document.createElement('input');file.type='file';file.accept='application/json';file.hidden=true;actions.prepend(btn,file);btn.onclick=()=>file.click();
      file.onchange=async()=>{
        try{
          if(!file.files[0])return;
          if(file.files[0].size>20*1024*1024)throw Error();
          const imported=JSON.parse(await file.files[0].text());
          if(!Array.isArray(imported) || imported.some(it=>!it || typeof it.output!=='string' || (!tree && typeof it.input!=='string')))throw Error();
          const items=tree?readTreeHistory():readHistory(); const ids=new Set(items.map(it=>it.id));
          for(const it of imported){if(it.id && ids.has(it.id))continue;const rec={...it,id:it.id||makeId(),name:it.name||'Импорт',time:it.time||new Date().toISOString()};items.push(rec);ids.add(rec.id);}
          (tree?writeTreeHistory:writeHistory)(items);updateTreeHistoryBadge();renderHistoryList(tree);toast('История импортирована','success');
        }catch{toast('Неверный формат файла истории (JSON, до 20 МБ)','danger');}finally{file.value='';}
      };
      const outputEl=tree?treeOutput:output;
      const download=document.createElement('button');download.className='ghost';download.textContent='Скачать';download.onclick=()=>{if(outputEl.value)downloadJson(outputEl.value,tree?'cnvrt-ng.json':'cnvrt.json');else toast('Нет результата','danger');};
      document.querySelector(tree?'#panelTree .controls-right':'#panelUuid .controls-right').append(download);
    }
    setupHistory(false);
    setupHistory(true);

    // hotkeys modal


    if(hotkeysBtn){
      hotkeysBtn.addEventListener('click', () => openModal(hotkeysModal, hotkeysBtn, closeHotkeys));
    }
    if(closeHotkeys){
      closeHotkeys.addEventListener('click', () => closeModal(hotkeysModal, hotkeysBtn));
    }

    // click outside to close modals
    [historyModal, hotkeysModal, treeHistoryModal].forEach(mod => {
      if(!mod) return;
      mod.addEventListener('click', (e) => {
        if(e.target === mod){
          if(mod === historyModal) closeModal(historyModal, historyBtn);
          if(mod === hotkeysModal) closeModal(hotkeysModal, hotkeysBtn);
          if(mod === treeHistoryModal) closeModal(treeHistoryModal, treeHistoryBtn);
        }
      });
    });

    // normalize input lines
    function normalizeLine(s){
      let str = String(s || '').replace(/\r/g,'').trim();
      if(str.length >= 2){
        const first = str[0], last = str[str.length-1];
        if((first === '"' && last === '"') || (first === "'" && last === "'")) str = str.slice(1,-1);
        else if(str.startsWith('\\"') && str.endsWith('\\"')) str = str.slice(2,-2);
        else if(str.startsWith("\\'") && str.endsWith("\\'")) str = str.slice(2,-2);
      }
      str = str.replace(/["',]/g,'');
      return str;
    }

    function linesFromInput(text){
      if(text == null) return [];
      const raw = String(text).replace(/\r/g,'').split(/\n/);
      return raw.map(s => normalizeLine(s)).filter(s => s.length > 0);
    }


    function countNonEmptyLines(text){
      try{
        return linesFromInput(text).length;
      }catch(e){
        return 0;
      }
    }

    function updateInputLineCount(){
      if(!inputLineCount || !input) return;
      const n = countNonEmptyLines(input.value);
      inputLineCount.textContent = 'Кол-во строк: ' + n;
    }

    function updateOutputLineCount(){
      if(!outputLineCount || !output) return;
      // Each converted value occupies one line; the surrounding JSON brackets are not data.
      const text = output.value;
      let newlines = 0;
      for(let i = 0; i < text.length; i++){
        if(text.charCodeAt(i) === 10) newlines++;
      }
      outputLineCount.textContent = 'Кол-во строк: ' + Math.max(0, newlines - 1);
    }

    function updateTreeUuidsLineCount(){
      if(!treeUuidsLineCount || !treeUuids) return;
      // same normalisation rules as conversion
      let n = 0;
      try{
        n = linesFromTextarea(treeUuids.value).length;
      }catch(e){ n = 0; }
      treeUuidsLineCount.textContent = 'Кол-во строк: ' + n;
    }

    // JSON escaping
    function jsonEscape(s){
      return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    }

    async function copyTextToClipboard(text){
      const value = String(text || '');
      if(!value.trim()) throw new Error('empty');
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(value);
        return;
      }
      // fallback
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly','');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if(!ok) throw new Error('copy_failed');
    }




    function readTreePrefs(){
      try{
        const raw = localStorage.getItem(treePrefsKey);
        if(!raw) return null;
        return JSON.parse(raw);
      }catch(e){ return null; }
    }

    function saveTreePrefs(){
      try{
        const prefs = {
          action: treeAction ? String(treeAction.value || 'disable') : 'disable',
          dayDate: treeDayDate ? String(treeDayDate.value || '') : '',
          fromDT: treeFromDT ? String(treeFromDT.value || '') : '',
          toDT: treeToDT ? String(treeToDT.value || '') : ''
        };
        localStorage.setItem(treePrefsKey, JSON.stringify(prefs));
      }catch(e){}
    }

    function loadTreePrefs(){
      const p = readTreePrefs();
      if(!p) return;
      try{
        if(treeAction && p.action) treeAction.value = p.action;
        // migration from older prefs (fromDate/fromTime/toDate/toTime)
        const legacyFrom = (p.fromDate && p.fromTime) ? `${p.fromDate}T${p.fromTime}` : '';
        const legacyTo = (p.toDate && p.toTime) ? `${p.toDate}T${p.toTime}` : '';

        if(treeDayDate && (p.dayDate || p.fromDate)) treeDayDate.value = String(p.dayDate || p.fromDate || '');
        if(treeFromDT && (p.fromDT || legacyFrom)) treeFromDT.value = String(p.fromDT || legacyFrom || '');
        if(treeToDT && (p.toDT || legacyTo)) treeToDT.value = String(p.toDT || legacyTo || '');
}catch(e){}
    }

    
    function pad2(n){ return String(n).padStart(2,'0'); }
    function pad4(n){ return String(n).padStart(4,'0'); }

    function parseDateTimeLocal(value){
      const v = String(value || '').trim();
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
      if(!m) return null;
      return {
        y: parseInt(m[1],10),
        mo: parseInt(m[2],10),
        d: parseInt(m[3],10),
        h: parseInt(m[4],10),
        mi: parseInt(m[5],10),
        s: parseInt(m[6] || '0',10)
      };
    }

    function isoNoMs(date){
      return date.toISOString().replace('.000Z','Z');
    }

    function combineDateTime(dateValue, timeValue){
      const d = String(dateValue || '').trim();
      const t = String(timeValue || '').trim();
      if(!d) return null;
      const tt = t ? t : '00:00';
      return `${d}T${tt}`;
    }

    function mskLocalToUtcIso(value){
      const p = parseDateTimeLocal(value);
      if(!p) return null;
      // МСК = UTC+3 => subtract 3 hours
      const ms = Date.UTC(p.y, p.mo-1, p.d, p.h - 3, p.mi, p.s);
      return isoNoMs(new Date(ms));
    }

    function datePartFromLocal(value){
      const p = parseDateTimeLocal(value);
      if(!p) return null;
      return { y: p.y, mo: p.mo, d: p.d };
    }

    function utcMidnightWindow(dp){
      const y = pad4(dp.y), mo = pad2(dp.mo), d = pad2(dp.d);
      return {
        left: `${y}-${mo}-${d}T00:00:02Z`,
        right: `${y}-${mo}-${d}T00:00:03Z`
      };
    }

    function linesFromTextarea(text){
      return String(text || '')
        .replace(/\r/g,'')
        .split(/[\n,]/)
        .map(s => String(s).trim().replace(/["']/g,''))
        .filter(s => s.length > 0);
    }

    function formatTreeJson(payload){
      const token = jsonEscape(payload.access_token || '');
      const uuids = Array.isArray(payload.store_uuids) ? payload.store_uuids : [];
      const uu = uuids.map(s => `"${jsonEscape(String(s))}"`).join(',\n');
      const uuSection = uu ? (uu + '\n') : '';
      const de = payload.disable_eta ? 'true' : 'false';
      const ds = payload.disable_slot ? 'true' : 'false';

      // Формат строго как просили: ключи с отступом 4 пробела,
      // элементы массива — без отступов, закрывающая ] — тоже без отступа.
      return `{
    "access_token": "${token}",
    "store_uuids": [
${uuSection}],
    "disable_eta": ${de},
    "disable_slot": ${ds},
    "left_border": "${jsonEscape(payload.left_border)}",
    "right_border": "${jsonEscape(payload.right_border)}"
}
`;
    }

function buildTreePayload(){
      const token = (treeToken && treeToken.value !== undefined && treeToken.value !== null && String(treeToken.value).replace(/\s+/g,'').trim() !== '') ? String(treeToken.value).replace(/\s+/g,'').trim() : 'secret_access_token';
      const uuids = treeUuids ? linesFromTextarea(treeUuids.value) : [];
      const action = treeAction ? String(treeAction.value) : 'disable';

      if(!uuids || uuids.length === 0){
        toast('Введите хотя бы один store_uuid', 'danger');
        treeUuids && treeUuids.focus();
        return null;
      }

      
      let left = null;
      let right = null;

      function parseDayDate(){
        const d = String(treeDayDate ? treeDayDate.value : '').trim();
        const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if(!m) return null;
        const y = parseInt(m[1],10);
        if(y < 2000 || y > 2100) return null;
        return { y, mo: parseInt(m[2],10), d: parseInt(m[3],10) };
      }

      function parseMskDatetimeLocal(v){
        const s = String(v || '').trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if(!m) return null;
        const y = parseInt(m[1],10);
        if(y < 2000 || y > 2100) return null;
        const mo = parseInt(m[2],10);
        const d = parseInt(m[3],10);
        const hh = parseInt(m[4],10);
        const mm = parseInt(m[5],10);
        // MSK -> UTC (минус 3 часа)
        const dt = new Date(Date.UTC(y, mo-1, d, hh-3, mm, 0));
        return dt.toISOString().slice(0,19) + 'Z';
      }

      if(action === 'enable'){
        const dp = parseDayDate();
        if(!dp){
          toast('Выберите корректную дату (МСК)', 'danger');
          treeDayDate && treeDayDate.focus();
          return null;
        }
        const w = utcMidnightWindow(dp);
        left = w.left;
        right = w.right;
      } else {
        const fromRaw = treeFromDT ? treeFromDT.value : '';
        const toRaw = treeToDT ? treeToDT.value : '';
        left = parseMskDatetimeLocal(fromRaw);
        right = parseMskDatetimeLocal(toRaw);

        if(!left || !right){
          toast('Заполните период "С" и "По" (МСК)', 'danger');
          (treeFromDT || treeToDT) && (treeFromDT ? treeFromDT.focus() : treeToDT.focus());
          return null;
        }
        if(new Date(left).getTime() >= new Date(right).getTime()){
          toast('"По" должно быть позже "С"', 'danger');
          treeToDT && treeToDT.focus();
          return null;
        }
      }


const payload = {
        access_token: token,
        store_uuids: uuids,
        disable_eta: true,
        disable_slot: true,
        left_border: left,
        right_border: right
      };

      saveTreePrefs();
      return payload;
    }

    function initTree(){
      if(!treeAction) return;

      loadTreePrefs();

      // не сохраняем store_uuids между перезагрузками (как в окне результата)
      if(treeUuids){
        treeUuids.value = '';
        treeUuids.placeholder = 'Введите строки...';
        updateTreeUuidsLineCount();
      }
      // перезапишем prefs без store_uuids, чтобы убрать старые сохранённые значения
      saveTreePrefs();

      // set default range in MSK (better UX)
      try{
        const now = new Date();
        const msk = new Date(now.getTime() + 3*60*60*1000);
        const y = msk.getUTCFullYear();
        const mo = String(msk.getUTCMonth()+1).padStart(2,'0');
        const d = String(msk.getUTCDate()).padStart(2,'0');
        const h = String(msk.getUTCHours()).padStart(2,'0');
        const mi = String(msk.getUTCMinutes()).padStart(2,'0');
        const dateStr = `${y}-${mo}-${d}`;
        const dtStr = `${dateStr}T${h}:${mi}`;

        // defaults for enable (day)
        if(treeDayDate && !treeDayDate.value) treeDayDate.value = dateStr;

        // defaults for disable (range)
        if(treeFromDT && !treeFromDT.value) treeFromDT.value = dtStr;

        const msk2 = new Date(msk.getTime() + 60*60*1000);
        const y2 = msk2.getUTCFullYear();
        const mo2 = String(msk2.getUTCMonth()+1).padStart(2,'0');
        const d2 = String(msk2.getUTCDate()).padStart(2,'0');
        const h2 = String(msk2.getUTCHours()).padStart(2,'0');
        const mi2 = String(msk2.getUTCMinutes()).padStart(2,'0');
        const dtStr2 = `${y2}-${mo2}-${d2}T${h2}:${mi2}`;
        if(treeToDT && !treeToDT.value) treeToDT.value = dtStr2;
      }catch(e){}

      treeNow && treeNow.addEventListener('click', () => {
        try{
          const now = new Date();
          const msk = new Date(now.getTime() + 3*60*60*1000);

          const y = msk.getUTCFullYear();
          const mo = String(msk.getUTCMonth()+1).padStart(2,'0');
          const d = String(msk.getUTCDate()).padStart(2,'0');
          const h = String(msk.getUTCHours()).padStart(2,'0');
          const mi = String(msk.getUTCMinutes()).padStart(2,'0');

          const dateStr = `${y}-${mo}-${d}`;
          const fromStr = `${dateStr}T${h}:${mi}`;

          // always update day picker (for "Включить")
          if(treeDayDate){
            treeDayDate.value = dateStr;
            try{ treeDayDate.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){}
          }

          // update range (for "Выключить")
          if(treeFromDT){
            treeFromDT.value = fromStr;
            try{
              treeFromDT.dispatchEvent(new Event('input', { bubbles:true }));
              treeFromDT.dispatchEvent(new Event('change', { bubbles:true }));
            }catch(e){}
          }

          const msk2 = new Date(msk.getTime() + 60*60*1000);
          const y2 = msk2.getUTCFullYear();
          const mo2 = String(msk2.getUTCMonth()+1).padStart(2,'0');
          const d2 = String(msk2.getUTCDate()).padStart(2,'0');
          const h2 = String(msk2.getUTCHours()).padStart(2,'0');
          const mi2 = String(msk2.getUTCMinutes()).padStart(2,'0');
          const toStr = `${y2}-${mo2}-${d2}T${h2}:${mi2}`;

          if(treeToDT){
            treeToDT.value = toStr;
            try{
              treeToDT.dispatchEvent(new Event('input', { bubbles:true }));
              treeToDT.dispatchEvent(new Event('change', { bubbles:true }));
            }catch(e){}
          }

          saveTreePrefs();
          toast('Период: сейчас + 1ч (МСК)', 'success');
        }catch(e){}
      });

      const applyActionUI = () => {
        const a = String(treeAction.value || 'disable');
        const isEnable = (a === 'enable');

        // enable => day mode, disable => range mode
        const dayWrap = document.getElementById('treeDayWrap');
        const rangeWrap = document.getElementById('treeRangeWrap');
        if(dayWrap) dayWrap.style.display = isEnable ? '' : 'none';
        if(rangeWrap) rangeWrap.style.display = isEnable ? 'none' : '';

        if(treeToWrap){ treeToWrap.style.display = isEnable ? 'none' : ''; }
        if(treeDayDate) treeDayDate.disabled = !isEnable;
        if(treeFromDT) treeFromDT.disabled = isEnable;
        if(treeToDT) treeToDT.disabled = isEnable;

        if(isEnable){
          if(treeToDT) treeToDT.value = '';
        }
      };
      applyActionUI();

      // autosave prefs
      treeDayDate && treeDayDate.addEventListener('change', saveTreePrefs);
      treeFromDT && treeFromDT.addEventListener('change', saveTreePrefs);
      treeToDT && treeToDT.addEventListener('change', saveTreePrefs);
      treeUuids && treeUuids.addEventListener('input', () => { try{ saveTreePrefs(); }catch(e){} });
      treeUuids && treeUuids.addEventListener('input', updateTreeUuidsLineCount);
      treeUuids && treeUuids.addEventListener('change', updateTreeUuidsLineCount);

      treeAction.addEventListener('change', () => {
        applyActionUI();
        saveTreePrefs();
        if(treeAction.value === 'enable'){
          toast('ВКЛ: ставим окно 00:00:02–00:00:03Z', 'info');
        }
      });


      treeBuild && treeBuild.addEventListener('click', () => {
        if(treeOutput){ treeOutput.value = ''; treeOutput.placeholder = ''; treeOutput.scrollTop = 0; }
        const payload = buildTreePayload();
        if(!payload) return;
        const out = formatTreeJson(payload);
        if(treeOutput) treeOutput.value = out;
        addTreeHistoryRecord({
          id: 't-' + Math.random().toString(16).slice(2),
          time: Date.now(),
          name: (treeAction && treeAction.value === 'enable') ? ('ВКЛ • ' + (payload.left_border || '').slice(0,10)) : ('ВЫКЛ • ' + (payload.left_border || '').slice(0,10)),
          output: out
        });
        toast('JSON готов', 'success');
      });

      treeClear && treeClear.addEventListener('click', () => {
        if(treeUuids){ treeUuids.value = ''; treeUuids.placeholder = 'Введите строки...';
        updateTreeUuidsLineCount(); }
        if(treeOutput){ treeOutput.value = ''; treeOutput.placeholder = 'Здесь появится результат...'; treeOutput.scrollTop = 0; }
        toast('Очищено', 'success');
      });

      treeHistoryBtn && treeHistoryBtn.addEventListener('click', () => {
        updateTreeHistoryBadge();
        renderTreeHistory();
        openModal(treeHistoryModal, treeHistoryBtn, closeTreeHistory || clearTreeHistoryBtn);
      });

      closeTreeHistory && closeTreeHistory.addEventListener('click', () => {
        closeModal(treeHistoryModal, treeHistoryBtn);
      });

      clearTreeHistoryBtn && clearTreeHistoryBtn.addEventListener('click', async () => {
        const hist = readTreeHistory();
        if(!hist || hist.length === 0){ toast('История НГ пустая', 'info'); return; }
        const ok = await confirmUI({
          title: 'Очистить историю НГ',
          message: 'Удалить все записи истории НГ?',
          okText: 'Очистить',
          cancelText: 'Отмена',
          danger: true
        });
        if(!ok) return;
        writeTreeHistory([]);
        updateTreeHistoryBadge();
        renderTreeHistory();
        toast('Очищено', 'success');
      });

      treeCopy && treeCopy.addEventListener('click', async () => {
        try{
          const text = treeOutput ? String(treeOutput.value || '') : '';
          if(text.trim().length === 0){
            toast('Нечего копировать', 'danger');
            return;
          }
          if(!navigator.clipboard || !navigator.clipboard.writeText){
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          } else {
            await navigator.clipboard.writeText(text);
          }
          toast('Скопировано', 'success');
        }catch(e){
          toast('Не удалось скопировать', 'danger');
        }
      });
    }


    // init
    function init(){
      buildPalettePresets();
      initTabs();
      initTree();
      loadPrefs();

      const hist = readHistory();
      writeHistory(hist);
      try{
        const raw = localStorage.getItem(historyCounterKey);
        const cur = raw ? (parseInt(raw,10) || 1) : 1;
        const need = getHistoryCounterSeed(hist);
        if(cur < need) localStorage.setItem(historyCounterKey, String(need));
      }catch(e){}

      if(palettePopover) { palettePopover.setAttribute('aria-hidden','true'); palettePopover.classList.remove('open'); }
      const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      if(themeToggle) themeToggle.setAttribute('aria-pressed', currentTheme === 'dark' ? 'true' : 'false');

      const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if(!currentAccent){
        document.documentElement.style.setProperty('--accent', defaultAccent);
        document.documentElement.style.setProperty('--accent-600', defaultAccent600);
      }
    }

    init();
  });
})();
