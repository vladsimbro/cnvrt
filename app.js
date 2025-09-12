/* app.js
   Полная логика приложения для UUID Converter
   - Палитра акцента (presets + color picker)
   - Тема (light/dark) с сохранением в localStorage
   - Конвертация (нормализация строк -> JSON-массив)
   - Локальная история (localStorage) + экспорт
   - Модалки (история, хотkeы) + базовая доступность
   - Автосохранение ввода (debounced)
   Принцип: не менять стили элементов вручную при анимации — только добавлять/убирать классы.
*/

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM references =====
  const input = document.getElementById('input');
  const output = document.getElementById('output');
  const convertBtn = document.getElementById('convert');
  const clearBtn = document.getElementById('clear');
  const copyBtn = document.getElementById('copy');
  const historyBtn = document.getElementById('historyBtn');
  const historyModal = document.getElementById('historyModal');
  const closeHistory = document.getElementById('closeHistory');
  const historyContent = document.getElementById('historyContent');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyCountEl = document.getElementById('historyCount');
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
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');

  // ===== Storage keys & defaults =====
  const historyKey = 'uuid_converter_history';
  const prefsKey = 'uuid_converter_prefs';
  const inputSaveKey = 'uuid_converter_input';

  const defaultAccent = '#2b7be4';
  const defaultAccent600 = '#1a5fc1';
  const presets = ['#2b7be4','#16a34a','#7c3aed','#f97316','#ef4444','#0ea5a4'];

  // ===== Utilities: color conversions (pure) =====
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

  // ===== Theme (light/dark) management =====
  function setTheme(theme){
    if(theme === 'dark'){
      document.documentElement.setAttribute('data-theme','dark');
      if(themeToggle) themeToggle.setAttribute('aria-pressed','true');
    } else {
      document.documentElement.setAttribute('data-theme','light');
      if(themeToggle) themeToggle.setAttribute('aria-pressed','false');
    }
    savePrefs();
  }

  if(themeToggle){
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ===== Prefs persistence =====
  function savePrefs(){
    const prefs = {
      theme: document.documentElement.getAttribute('data-theme') || 'light',
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || defaultAccent
    };
    try { localStorage.setItem(prefsKey, JSON.stringify(prefs)); } catch(e){}
  }

  function loadPrefs(){
    try{
      const raw = localStorage.getItem(prefsKey);
      if(!raw) return;
      const p = JSON.parse(raw);
      if(p.theme) setTheme(p.theme);
      if(p.accent) applyAccent(p.accent);
      else applyAccent(defaultAccent);
    }catch(e){
      // fallback
      applyAccent(defaultAccent);
      setTheme('light');
    }
  }

  // ===== Palette UI =====
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
      btn.addEventListener('click', ()=> applyAccent(col));
      palettePresetsContainer.appendChild(btn);
    });
  }

  function markActiveSwatch(hex){
    document.querySelectorAll('.swatch').forEach(s=>{
      if(s.dataset.color && s.dataset.color.toLowerCase() === String(hex || '').toLowerCase()) s.classList.add('active');
      else s.classList.remove('active');
    });
  }

  function applyAccent(hex){
    if(!hex) return;
    const darker = darkenHex(hex, 18);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-600', darker);
    if(paletteColor && paletteColor.value.toLowerCase() !== hex.toLowerCase()) paletteColor.value = hex;
    markActiveSwatch(hex);
    savePrefs();
  }

  if(paletteToggle){
    paletteToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const expanded = paletteToggle.getAttribute('aria-expanded') === 'true';
      paletteToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if(palettePopover){
        palettePopover.setAttribute('aria-hidden', expanded ? 'true' : 'false');
        palettePopover.classList.toggle('open');
      }
    });
  }

  // close palette when clicking outside
  document.addEventListener('click', (ev) => {
    if(paletteControl && !paletteControl.contains(ev.target)){
      if(palettePopover){
        palettePopover.classList.remove('open');
        paletteToggle && paletteToggle.setAttribute('aria-expanded','false');
        palettePopover.setAttribute('aria-hidden','true');
      }
    }
  });

  paletteColor && paletteColor.addEventListener('input', (e) => applyAccent(e.target.value));
  paletteReset && paletteReset.addEventListener('click', () => applyAccent(defaultAccent));

  // ===== History (localStorage) =====
  function addToHistory(inputText, outputText){
    const now = new Date();
    const rec = { time: now.toLocaleString(), input: inputText, output: outputText };
    let history = [];
    try{ history = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ history = []; }
    history.unshift(rec);
    try{ localStorage.setItem(historyKey, JSON.stringify(history)); }catch(e){}
    updateHistoryBadge(history.length);
  }

  function updateHistoryBadge(len){
    if(!historyCountEl) return;
    historyCountEl.textContent = String(len || 0);
    if(len && len>0) historyCountEl.classList.add('visible'); else historyCountEl.classList.remove('visible');
  }

  function escapeHtml(unsafe){
    return String(unsafe)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function renderHistory(){
    let history = [];
    try{ history = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ history = []; }
    if(!historyContent) return;
    if(history.length === 0){ historyContent.textContent = 'Нет записей'; return; }

    historyContent.innerHTML = history.map((it, idx)=>`
      <div class="history-item">
        <div class="history-header" data-idx="${idx}" tabindex="0" aria-expanded="false">${escapeHtml(it.time)}</div>
        <div class="history-body" id="body-${idx}"><u>Ввод:</u><pre>${escapeHtml(it.input)}</pre><u>Результат:</u><pre>${escapeHtml(it.output)}</pre></div>
      </div>
    `).join('');

    document.querySelectorAll('.history-header').forEach(h=>{
      h.addEventListener('click', () => {
        const idx = h.dataset.idx;
        const body = document.getElementById('body-'+idx);
        if(!body) return;
        if(body.classList.contains('open')){
          body.style.maxHeight = null;
          body.classList.remove('open');
          h.setAttribute('aria-expanded','false');
        } else {
          body.classList.add('open');
          body.style.maxHeight = body.scrollHeight + 'px';
          h.setAttribute('aria-expanded','true');
        }
      });
      h.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); }});
    });
  }

  if(historyBtn){
    historyBtn.addEventListener('click', () => {
      renderHistory();
      if(!historyModal) return;
      historyModal.style.display = 'flex';
      requestAnimationFrame(() => {
        historyModal.classList.add('show');
        historyModal.setAttribute('aria-hidden','false');
        // focus primary control (close) for accessibility
        (closeHistory || clearHistoryBtn)?.focus();
      });
    });
  }

  if(closeHistory){
    closeHistory.addEventListener('click', () => {
      if(!historyModal) return;
      historyModal.classList.remove('show');
      historyModal.setAttribute('aria-hidden','true');
      setTimeout(()=> historyModal.style.display='none', 320);
    });
  }

  if(clearHistoryBtn){
    clearHistoryBtn.addEventListener('click', () => {
      if(!confirm('Вы уверены, что хотите очистить историю?')) return;
      try{ localStorage.removeItem(historyKey); }catch(e){}
      renderHistory();
      updateHistoryBadge(0);
    });
  }

  // Export history: copy JSON to clipboard + download file
  if(exportHistoryBtn){
    exportHistoryBtn.addEventListener('click', async () => {
      let history = [];
      try{ history = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ history = []; }
      if(!history || history.length === 0){ alert('Нет записей для экспорта.'); return; }

      const json = JSON.stringify(history, null, 2);

      // try copy to clipboard
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(json);
          exportHistoryBtn.textContent = 'Скопировано!';
          setTimeout(()=> exportHistoryBtn.textContent = 'Экспорт', 1200);
        }
      }catch(e){
        // ignore clipboard errors
      }

      // trigger download
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
      }catch(e){
        alert('Не удалось экспортировать файл. Попробуйте скопировать вручную.');
      }
    });
  }

  // ===== Hotkeys modal =====
  if(hotkeysBtn){
    hotkeysBtn.addEventListener('click', () => {
      if(!hotkeysModal) return;
      hotkeysModal.style.display = 'flex';
      requestAnimationFrame(() => {
        hotkeysModal.classList.add('show');
        hotkeysModal.setAttribute('aria-hidden','false');
        (closeHotkeys)?.focus();
      });
    });
  }

  if(closeHotkeys){
    closeHotkeys.addEventListener('click', () => {
      if(!hotkeysModal) return;
      hotkeysModal.classList.remove('show');
      hotkeysModal.setAttribute('aria-hidden','true');
      setTimeout(()=> hotkeysModal.style.display='none', 320);
    });
  }

  // Close modals by clicking backdrop
  [historyModal, hotkeysModal].forEach(mod => {
    if(!mod) return;
    mod.addEventListener('click', (e) => {
      if(e.target === mod){
        mod.classList.remove('show');
        mod.setAttribute('aria-hidden','true');
        setTimeout(()=> mod.style.display='none', 320);
      }
    });
  });

  // ===== Normalize & parsing =====
  function normalizeLine(s){
    let str = String(s || '').replace(/\r/g,'').trim();
    if(str.length >= 2){
      const first = str[0], last = str[str.length-1];
      if((first === '"' && last === '"') || (first === "'" && last === "'")) return str.slice(1,-1);
      if(str.startsWith('\\"') && str.endsWith('\\"')) return str.slice(2,-2);
      if(str.startsWith("\\'") && str.endsWith("\\'")) return str.slice(2,-2);
    }
    return str;
  }

  function linesFromInput(text){
    if(text == null) return [];
    const raw = String(text).replace(/\r/g,'').split(/\n/);
    return raw.map(s => normalizeLine(s)).filter(s => s.length > 0);
  }

  // ===== Convert & UI feedback (safe for dark theme) =====
  function showConvertSuccess(){
    if(!mainPanel || !convertBtn) return;
    // add class that triggers CSS-only animation (CSS decides visuals per theme)
    mainPanel.classList.remove('converted'); // restart animation
    void mainPanel.offsetWidth; // reflow
    mainPanel.classList.add('converted');
    convertBtn.classList.add('success');
    setTimeout(()=> { convertBtn.classList.remove('success'); }, 900);
  }

  function convert(){
    if(!input || !output) return;
    const arr = linesFromInput(input.value);
    const content = arr.map(s => `"${s.replace(/"/g,'\\"')}"`).join(',\n');
    output.value = '[\n' + content + '\n]';
    output.placeholder = '';
    addToHistory(input.value, output.value);
    showConvertSuccess();
  }

  convertBtn && convertBtn.addEventListener('click', convert);

  // ===== Clear & Copy =====
  clearBtn && clearBtn.addEventListener('click', () => {
    if(input) input.value = '';
    if(output) output.value = '';
    if(input) input.placeholder = 'Введите строки...';
    if(output) output.placeholder = 'Здесь появится результат';
    saveInputDebounced();
  });

  const copyBtnOriginal = copyBtn ? copyBtn.innerHTML : '';
  copyBtn && copyBtn.addEventListener('click', async () => {
    try{
      if(!navigator.clipboard || !navigator.clipboard.writeText){
        const ta = document.createElement('textarea');
        ta.value = output.value || '';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } else {
        await navigator.clipboard.writeText(output.value || '');
      }

      copyBtn.classList.add('copied');
      copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="1.6"/></svg></span><span class="copy-label">Скопировано!</span>';
      setTimeout(()=> { copyBtn.classList.remove('copied'); if(copyBtnOriginal) copyBtn.innerHTML = copyBtnOriginal; }, 1200);
    }catch(e){
      alert('Не удалось скопировать — используйте Ctrl+C.');
    }
  });

  // ===== Autosave input (debounced) =====
  let autosaveTimer = null;
  function saveInput(){ try{ localStorage.setItem(inputSaveKey, input.value || ''); }catch(e){} }
  function saveInputDebounced(){ clearTimeout(autosaveTimer); autosaveTimer = setTimeout(()=> saveInput(), 700); }
  input && input.addEventListener('input', () => { saveInputDebounced(); });

  // ===== Keyboard shortcuts =====
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      if(historyModal && historyModal.classList.contains('show')) closeHistory && closeHistory.click();
      if(hotkeysModal && hotkeysModal.classList.contains('show')) closeHotkeys && closeHotkeys.click();
    }
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      e.preventDefault();
      convert();
    }
  });

  // ===== Restore saved input & init =====
  function restoreInput(){
    try{
      const saved = localStorage.getItem(inputSaveKey);
      if(saved && input) input.value = saved;
    }catch(e){}
  }

  function init(){
    buildPalettePresets();
    // set safe defaults
    document.documentElement.style.setProperty('--accent', defaultAccent);
    document.documentElement.style.setProperty('--accent-600', defaultAccent600);
    loadPrefs();
    restoreInput();
    let hist = [];
    try{ hist = JSON.parse(localStorage.getItem(historyKey)) || []; }catch(e){ hist = []; }
    updateHistoryBadge(hist.length);

    if(palettePopover) { palettePopover.setAttribute('aria-hidden','true'); palettePopover.classList.remove('open'); }

    // ensure themeToggle aria-pressed matches state
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    if(themeToggle) themeToggle.setAttribute('aria-pressed', currentTheme === 'dark' ? 'true' : 'false');
  }

  init();
});
