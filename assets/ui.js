/*
 * Pli — contrôleur d'interface : écrans, feuille de papier, gouttières, plis.
 */
(function () {
  'use strict';
  var E = window.PliEngine, LV = window.PliLevels.levels, I18N = window.PliI18n, AU = window.PliAudio;

  var SAVE_KEY = 'pli.save.v1';
  var save = { unlocked: 1, stars: {}, best: {}, lang: 'en', sound: true };
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      save = { unlocked: parsed.unlocked || 1, stars: parsed.stars || {},
               best: parsed.best || {}, lang: parsed.lang || 'en', sound: parsed.sound !== false };
    }
  } catch (e) { /* stockage indisponible */ }

  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  function t(key) { return I18N.get(save.lang, key); }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function show(node, on) { node.classList.toggle('hidden', !on); }

  var state = null;       // état moteur de la feuille courante
  var levelIndex = 0;
  var busy = false;       // animation / victoire en cours
  var cell = 64;          // taille de case en px
  var selGutter = null;   // { axis, g } sélectionnée

  // ------------------------------------------------------------------ i18n
  function renderTexts() {
    document.documentElement.lang = save.lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    $('tagline').textContent = t('tagline');
    $('btn-play').textContent = save.unlocked > 1 ? t('continueGame') : t('play');
    $('btn-howto').textContent = t('howTo');
    $('btn-sound').textContent = (save.sound ? '♪ ' : '✕ ') + t(save.sound ? 'soundOn' : 'soundOff');
    $('btn-undo').textContent = '⟲ ' + t('undo');
    $('btn-restart').textContent = t('restart');
    $('btn-menu').textContent = t('menu');
    renderLangPills();
    renderLevelGrid();
    if (state) { renderHud(); renderGutterButtons(); }
  }

  function renderLangPills() {
    var box = $('langs');
    box.textContent = '';
    I18N.langs.forEach(function (code) {
      var b = el('button', 'pill' + (save.lang === code ? ' active' : ''), code.toUpperCase());
      b.addEventListener('click', function () { save.lang = code; persist(); AU.ui(); renderTexts(); });
      box.appendChild(b);
    });
  }

  function renderLevelGrid() {
    var grid = $('levelgrid');
    grid.textContent = '';
    LV.forEach(function (lvl, i) {
      var locked = i + 1 > save.unlocked;
      var chip = el('button', 'chip' + (locked ? ' locked' : ''), locked ? '•' : String(i + 1));
      if (!locked) {
        var stars = save.stars[i] || 0;
        chip.appendChild(el('span', 'chip-stars', stars ? '★'.repeat(stars) : ' '));
        chip.addEventListener('click', function () { AU.ui(); openLevel(i); });
      }
      grid.appendChild(chip);
    });
  }

  // ------------------------------------------------------------------ rendu
  function cellSize() {
    var availW = Math.min(window.innerWidth - 30, 520);
    var availH = window.innerHeight - 330;
    return Math.max(34, Math.floor(Math.min(availW / state.w, availH / state.h, 70)));
  }

  // une tache d'encre : div organique (rayon irrégulier + rotation + taille ∝ rien)
  function inkStyle(node, seedIdx) {
    var rots = [8, -12, 20, -5, 14];
    var rad = ['38% 62% 55% 45% / 55% 42% 58% 45%',
               '55% 45% 40% 60% / 45% 55% 42% 58%',
               '48% 52% 60% 40% / 58% 40% 55% 45%',
               '60% 40% 48% 52% / 42% 58% 45% 55%',
               '45% 55% 52% 48% / 52% 48% 60% 40%'];
    node.style.borderRadius = rad[seedIdx % rad.length];
    node.style.transform = 'rotate(' + rots[seedIdx % rots.length] + 'deg)';
  }

  function buildSheet(instant) {
    var sheet = $('sheet');
    sheet.textContent = '';
    cell = cellSize();
    var w = state.w, h = state.h;
    sheet.style.width = w * cell + 'px';
    sheet.style.height = h * cell + 'px';

    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var v = state.cells[r * w + c];
        var sq = el('div', 'sq');
        sq.style.left = c * cell + 'px';
        sq.style.top = r * cell + 'px';
        sq.style.width = cell + 'px';
        sq.style.height = cell + 'px';
        if (v & E.TARGET) {
          var tg = el('div', 'target');
          sq.appendChild(tg);
        }
        if (v & E.INK) {
          var ink = el('div', 'ink');
          inkStyle(ink, r * w + c);
          sq.appendChild(ink);
        }
        if (v & E.GRAIN) sq.appendChild(el('div', 'grain'));
        sheet.appendChild(sq);
      }
    }

    // gouttières cliquables : lignes pointillées entre colonnes / rangées
    var gutters = el('div', 'gutters');
    for (var g = 1; g < w; g++) {
      (function (g) {
        var line = el('div', 'gutter gv');
        line.style.left = g * cell + 'px';
        line.style.height = h * cell + 'px';
        line.setAttribute('data-axis', 'v');
        line.setAttribute('data-g', g);
        line.addEventListener('click', function () { pickGutter('v', g); });
        gutters.appendChild(line);
      })(g);
    }
    for (var g2 = 1; g2 < h; g2++) {
      (function (g2) {
        var line = el('div', 'gutter gh');
        line.style.top = g2 * cell + 'px';
        line.style.width = w * cell + 'px';
        line.setAttribute('data-axis', 'h');
        line.setAttribute('data-g', g2);
        line.addEventListener('click', function () { pickGutter('h', g2); });
        gutters.appendChild(line);
      })(g2);
    }
    sheet.appendChild(gutters);
    renderGutterSelection();
    void instant;
  }

  function renderGutterSelection() {
    var lines = document.querySelectorAll('.gutter');
    for (var i = 0; i < lines.length; i++) {
      var on = selGutter && lines[i].getAttribute('data-axis') === selGutter.axis &&
               Number(lines[i].getAttribute('data-g')) === selGutter.g;
      lines[i].classList.toggle('sel', !!on);
    }
  }

  function pickGutter(axis, g) {
    AU.unlock();
    AU.ui();
    selGutter = (selGutter && selGutter.axis === axis && selGutter.g === g) ? null : { axis: axis, g: g };
    renderGutterSelection();
    renderGutterButtons();
  }

  function renderGutterButtons() {
    var box = $('foldbtns');
    box.textContent = '';
    $('fold-hint').textContent = selGutter ? '' : t('foldHint');
    if (!selGutter) return;
    var vertical = selGutter.axis === 'v';
    var dirs = vertical ? ['L', 'R'] : ['U', 'D'];
    dirs.forEach(function (d) {
      var label = vertical ? (d === 'L' ? '◀ ' + t('foldLeft') : t('foldRight') + ' ▶')
                           : (d === 'U' ? '▲ ' + t('foldUp') : t('foldDown') + ' ▼');
      var b = el('button', 'foldbtn primary' + (d === 'L' || d === 'U' ? '' : ' alt'), label);
      b.addEventListener('click', function () { doFold(selGutter.axis, selGutter.g, d); });
      box.appendChild(b);
    });
  }

  function renderHud() {
    var lvl = LV[levelIndex];
    $('hud-level').textContent = t('level') + ' ' + (levelIndex + 1) + ' — ' + lvl.name;
    $('hud-moves').textContent = state.folds + ' ' + t(state.folds === 1 ? 'movesOne' : 'moves') +
                                 ' · ' + t('par') + ' ' + lvl.par;
  }

  function openLevel(i) {
    levelIndex = i;
    state = E.createState(LV[i]);
    busy = false;
    selGutter = null;
    show($('home'), false);
    show($('game'), true);
    renderHud();
    buildSheet(true);
    renderGutterButtons();
  }

  function goMenu() {
    state = null; busy = false; selGutter = null;
    show($('game'), false);
    show($('home'), true);
    renderTexts();
  }

  // ------------------------------------------------------------------ pli
  function reasonText(reason) {
    if (reason === 'grain+grain') return t('blockedGrainGrain');
    if (reason === 'ink+grain') return t('blockedInkGrain');
    if (reason === 'too-big') return t('blockedTooBig');
    if (reason === 'gutter') return t('blockedGutter');
    return '';
  }

  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { box.classList.remove('on'); }, 1900);
  }

  function doFold(axis, g, dir) {
    if (!state || busy) return;
    var before = { w: state.w, h: state.h, cells: state.cells.slice() };
    var r = E.attemptFold(state, axis, g, dir);
    if (!r.ok) {
      AU.blocked();
      toast(reasonText(r.reason));
      $('sheet').classList.remove('shake');
      void $('sheet').offsetWidth;
      $('sheet').classList.add('shake');
      return;
    }
    selGutter = null;
    AU.fold();
    if (r.won) {
      busy = true;
      animateFold(before, axis, g, dir, function () {
        AU.win();
        var stars = starsFor(state.folds, LV[levelIndex].par);
        save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
        save.best[levelIndex] = Math.min(save.best[levelIndex] || Infinity, state.folds);
        if (levelIndex + 2 > save.unlocked) save.unlocked = Math.min(LV.length, levelIndex + 2);
        persist();
        setTimeout(function () { showWin(stars); }, 350);
      });
      return;
    }
    animateFold(before, axis, g, dir, function () {
      renderHud();
      buildSheet(true);
      renderGutterButtons();
    });
  }

  // volet qui se rabat : copie de la partie mobile, rotation 3D CSS, puis re-rendu
  function animateFold(before, axis, g, dir, done) {
    var sheet = $('sheet');
    var moving = axis === 'v'
      ? (dir === 'L' ? before.w - g : g)
      : (dir === 'U' ? before.h - g : g);
    var flap = el('div', 'flap');
    var sizeV = axis === 'v' ? moving * cell : before.w * cell;
    var sizeH = axis === 'h' ? moving * cell : before.h * cell;
    // partie mobile : colonnes/lignes [g..] pour L/U, [0..g-1] pour R/D
    var left = (axis === 'v' && dir === 'L') ? g * cell : 0;
    var top = (axis === 'h' && dir === 'U') ? g * cell : 0;

    flap.style.left = left + 'px';
    flap.style.top = top + 'px';
    flap.style.width = sizeV + 'px';
    flap.style.height = sizeH + 'px';
    // contenu de la partie mobile (avant pli)
    for (var r2 = 0; r2 < before.h; r2++) {
      for (var c2 = 0; c2 < before.w; c2++) {
        var inPart = axis === 'v'
          ? (dir === 'L' ? c2 >= g : c2 < g)
          : (dir === 'U' ? r2 >= g : r2 < g);
        if (!inPart) continue;
        var v = before.cells[r2 * before.w + c2];
        if (!v) continue;
        var sq = el('div', 'sq');
        sq.style.left = (c2 * cell - left) + 'px';
        sq.style.top = (r2 * cell - top) + 'px';
        sq.style.width = cell + 'px';
        sq.style.height = cell + 'px';
        if (v & E.INK) { var ink = el('div', 'ink'); inkStyle(ink, r2 * before.w + c2); sq.appendChild(ink); }
        if (v & E.GRAIN) sq.appendChild(el('div', 'grain'));
        if (v & E.TARGET) sq.appendChild(el('div', 'target'));
        flap.appendChild(sq);
      }
    }
    // transformation : rotation autour de la gouttière
    var originX = axis === 'v' ? ((dir === 'L') ? 0 : sizeV) : 0;
    var originY = axis === 'h' ? ((dir === 'U') ? 0 : sizeH) : 0;
    flap.style.transformOrigin = originX + 'px ' + originY + 'px';
    sheet.appendChild(flap);
    var rot = axis === 'v' ? 'rotateY(' + (dir === 'L' ? '-' : '') + '180deg)'
                           : 'rotateX(' + (dir === 'U' ? '' : '-') + '180deg)';
    void flap.offsetWidth;
    flap.style.transform = rot;
    setTimeout(function () {
      flap.remove();
      done();
    }, 340);
  }

  function starsFor(folds, par) {
    if (folds <= par) return 3;
    if (folds <= par + 1) return 2;
    return 1;
  }

  // ------------------------------------------------------------------ overlays
  function overlay(content) {
    var card = $('overlay-card');
    card.textContent = '';
    card.appendChild(content);
    show($('overlay'), true);
  }
  function closeOverlay() { show($('overlay'), false); }

  function showRules() {
    var box = el('div', 'rules');
    box.appendChild(el('h2', null, t('rulesTitle')));
    [1, 2, 3, 4].forEach(function (n) { box.appendChild(el('p', null, t('rule' + n))); });
    var btn = el('button', 'primary', t('gotIt'));
    btn.addEventListener('click', function () { AU.ui(); closeOverlay(); });
    box.appendChild(btn);
    overlay(box);
  }

  function showWin(stars) {
    for (var i = 0; i < stars; i++) setTimeout(AU.star.bind(null, i), 250 + i * 180);
    var box = el('div', 'modal');
    var isLast = levelIndex === LV.length - 1;
    if (isLast) {
      var total = 0;
      LV.forEach(function (_, i) { total += save.best[i] || 0; });
      box.appendChild(el('h2', null, t('finalTitle')));
      box.appendChild(el('p', null, t('finalBody')));
      box.appendChild(el('p', 'big', t('total') + ' : ' + total));
      var again = el('button', 'primary', t('replayAll'));
      again.addEventListener('click', function () {
        AU.ui(); closeOverlay();
        save.unlocked = 1; save.stars = {}; save.best = {}; persist();
        openLevel(0);
      });
      box.appendChild(again);
    } else {
      box.appendChild(el('h2', null, t('wonTitle')));
      var row = el('div', 'star-row');
      for (var s = 0; s < 3; s++) row.appendChild(el('span', 'star' + (s < stars ? ' on' : ''), '★'));
      box.appendChild(row);
      box.appendChild(el('p', null, state.folds + ' ' + t(state.folds === 1 ? 'movesOne' : 'moves') +
        ' · ' + t('par') + ' ' + LV[levelIndex].par));
      var next = el('button', 'primary', t('next'));
      next.addEventListener('click', function () { AU.ui(); closeOverlay(); openLevel(levelIndex + 1); });
      box.appendChild(next);
    }
    var replay = el('button', null, t('replay'));
    replay.addEventListener('click', function () { AU.ui(); closeOverlay(); openLevel(levelIndex); });
    var menu = el('button', null, t('menu'));
    menu.addEventListener('click', function () { AU.ui(); closeOverlay(); goMenu(); });
    var row2 = el('div', 'btn-row');
    row2.appendChild(replay); row2.appendChild(menu);
    box.appendChild(row2);
    overlay(box);
  }

  // ------------------------------------------------------------------ entrées
  document.addEventListener('keydown', function (ev) {
    if (!state) return;
    var k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === 'u') { ev.preventDefault(); doUndo(); }
    if (k === 'r') { ev.preventDefault(); doRestart(); }
    if (k === 'Escape') closeOverlay();
    // flèches : pli par la gouttière médiane (arrondie) dans la direction choisie
    var dirMap = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' };
    if (dirMap[k]) {
      ev.preventDefault();
      AU.unlock();
      var d = dirMap[k];
      var axis = (d === 'L' || d === 'R') ? 'v' : 'h';
      var len = axis === 'v' ? state.w : state.h;
      if (len < 2) return;
      var g = Math.round(len / 2);
      if (g < 1) g = 1;
      if (g > len - 1) g = len - 1;
      doFold(axis, g, d);
    }
  });

  function doUndo() {
    if (!state || busy) return;
    if (E.undo(state)) { AU.ui(); selGutter = null; renderHud(); buildSheet(true); renderGutterButtons(); }
  }
  function doRestart() {
    if (!state || busy) return;
    AU.ui(); openLevel(levelIndex);
  }

  // ------------------------------------------------------------------ boutons
  $('btn-play').addEventListener('click', function () {
    AU.ui(); AU.unlock();
    openLevel(Math.min(save.unlocked, LV.length) - 1);
  });
  $('btn-howto').addEventListener('click', function () { AU.ui(); showRules(); });
  $('btn-sound').addEventListener('click', function () {
    save.sound = !save.sound; persist();
    AU.setEnabled(save.sound);
    renderTexts();
    if (save.sound) AU.ui();
  });
  $('btn-undo').addEventListener('click', function () { AU.unlock(); doUndo(); });
  $('btn-restart').addEventListener('click', function () { AU.unlock(); doRestart(); });
  $('btn-menu').addEventListener('click', function () { AU.ui(); goMenu(); });
  $('overlay').addEventListener('click', function (ev) { if (ev.target === $('overlay')) closeOverlay(); });

  window.addEventListener('resize', function () { if (state && !busy) buildSheet(true); });

  // hook QA (?debug=1) : tests DOM automatisés sans dépendre du rAF
  if (location.search.indexOf('debug=1') !== -1) {
    window.__pli = {
      state: function () { return state; },
      engine: E,
      levels: LV,
      open: openLevel,
      fold: function (axis, g, dir) { doFold(axis, g, dir); },
      save: save
    };
  }

  // ------------------------------------------------------------------ démarrage
  AU.setEnabled(save.sound);
  renderTexts();
  show($('home'), true);
})();
