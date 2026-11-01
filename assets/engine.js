/*
 * Pli — moteur de jeu pur (sans DOM), partagé navigateur / tests Node.
 * Papier rectangulaire ; cases : encre (1), grain (2), cible (4) — bits cumulables.
 * Pli le long d'une gouttière (entre deux colonnes/lignes) dans 4 directions ;
 * la partie mobile (la plus petite ou égale) se retourne en miroir sur la fixe.
 * Chevauchements interdits : grain+grain, encre+grain → le pli est refusé.
 * Encre+encre → fusion. Victoire : une seule tache d'encre, posée sur la cible.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PliEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var INK = 1, GRAIN = 2, TARGET = 4;

  function parseLevel(level) {
    var rows = level.grid, h = rows.length, w = rows[0].length;
    var cells = new Array(w * h).fill(0);
    for (var r = 0; r < h; r++) {
      if (rows[r].length !== w) throw new Error('grille non rectangulaire : ' + level.name);
      for (var c = 0; c < w; c++) {
        var ch = rows[r][c], v = 0;
        if (ch === 'i') v = INK;
        else if (ch === '#') v = GRAIN;
        else if (ch === 't') v = TARGET;
        else if (ch !== '.') throw new Error('caractère inconnu « ' + ch + ' » : ' + level.name);
        cells[r * w + c] = v;
      }
    }
    var targets = 0, inks = 0;
    for (var k = 0; k < cells.length; k++) {
      if (cells[k] & TARGET) targets++;
      if (cells[k] & INK) inks++;
    }
    if (targets !== 1) throw new Error(level.name + ' : il faut exactement une cible (' + targets + ')');
    if (inks < 1) throw new Error(level.name + ' : aucune encre');
    return { w: w, h: h, cells: cells, name: level.name, par: level.par || null };
  }

  function createState(level) {
    var p = parseLevel(level);
    return { w: p.w, h: p.h, cells: p.cells, name: p.name, par: p.par,
             folds: 0, won: false, history: [] };
  }

  function countInk(state) {
    var n = 0;
    for (var k = 0; k < state.cells.length; k++) if (state.cells[k] & INK) n++;
    return n;
  }

  function checkWon(state) {
    if (countInk(state) !== 1) return false;
    for (var k = 0; k < state.cells.length; k++)
      if ((state.cells[k] & INK) && (state.cells[k] & TARGET)) return true;
    return false;
  }

  /*
   * Pli. axis 'v' (gouttière verticale, g ∈ [1, w-1]) ou 'h' (g ∈ [1, h-1]).
   * dir 'L' (partie droite se replie vers la gauche), 'R', 'U' (bas vers haut), 'D'.
   * Légalité : la partie mobile ne doit pas être plus grande que la partie fixe.
   * Chevauchements : grain+grain et encre+grain interdits (pli refusé entier).
   * Chaque case du nouveau rectangle fusionne sa case fixe et, si elle est
   * couverte, la case mobile miroir.
   */
  function attemptFold(state, axis, g, dir) {
    if (state.won) return { ok: false, reason: 'won' };
    var len = axis === 'v' ? state.w : state.h;
    if (!(g >= 1 && g <= len - 1)) return { ok: false, reason: 'gutter' };
    var mobile = ((axis === 'v' && dir === 'L') || (axis === 'h' && dir === 'U')) ? len - g : g;
    var fixed = len - mobile;
    if (mobile > fixed) return { ok: false, reason: 'too-big' };

    state.history.push({ cells: state.cells.slice(), w: state.w, h: state.h, folds: state.folds });

    var nw = axis === 'v' ? fixed : state.w;
    var nh = axis === 'h' ? fixed : state.h;
    var out = new Array(nw * nh).fill(0);

    for (var r = 0; r < nh; r++) {
      for (var c = 0; c < nw; c++) {
        // case fixe (ancien repère) : le côté ancré reste en place
        var fc = c, fr = r;
        // case mobile miroir (ancien repère), si la case est couverte
        var mc = -1, mr = -1;
        if (axis === 'v') {
          if (dir === 'L') { mc = 2 * fixed - 1 - c; mr = r; }        // ancre colonnes 0..fixed-1
          else { fc = c + mobile; mc = mobile - 1 - c; mr = r; }      // ancre colonnes mobile..len-1
        } else {
          if (dir === 'U') { mr = 2 * fixed - 1 - r; mc = c; }        // ancre lignes 0..fixed-1
          else { fr = r + mobile; mr = mobile - 1 - r; mc = c; }      // ancre lignes mobile..len-1
        }
        var fv = state.cells[fr * state.w + fc];
        var mv = 0;
        if (mc >= 0 && mc < state.w && mr >= 0 && mr < state.h)
          mv = state.cells[mr * state.w + mc];

        if ((fv & GRAIN) && (mv & GRAIN)) { restore(state); return { ok: false, reason: 'grain+grain' }; }
        if (((fv & GRAIN) && (mv & INK)) || ((fv & INK) && (mv & GRAIN))) { restore(state); return { ok: false, reason: 'ink+grain' }; }

        out[r * nw + c] = fv | mv;
      }
    }

    state.cells = out; state.w = nw; state.h = nh; state.folds++;
    state.won = checkWon(state);
    return { ok: true, won: state.won, w: nw, h: nh };
  }

  function restore(state) {
    var prev = state.history.pop();
    state.cells = prev.cells; state.w = prev.w; state.h = prev.h; state.folds = prev.folds;
  }

  function undo(state) {
    if (!state.history.length || state.won) return false;
    var prev = state.history.pop();
    state.cells = prev.cells; state.w = prev.w; state.h = prev.h; state.folds = prev.folds;
    state.won = checkWon(state);
    return true;
  }

  // Solveur BFS (tests) : liste des plis légaux pour l'état.
  function legalFolds(state) {
    var res = [];
    ['v', 'h'].forEach(function (axis) {
      var len = axis === 'v' ? state.w : state.h;
      for (var g = 1; g <= len - 1; g++) {
        var dirs = axis === 'v' ? ['L', 'R'] : ['U', 'D'];
        dirs.forEach(function (dir) {
          var probe = { w: state.w, h: state.h, cells: state.cells, folds: state.folds,
                        won: false, history: [] };
          var r = attemptFold(probe, axis, g, dir);
          if (r.ok) res.push({ axis: axis, g: g, dir: dir });
        });
      }
    });
    return res;
  }

  function stateKey(state) {
    return state.w + 'x' + state.h + ':' + state.cells.join(',');
  }

  function solve(state) {
    var init = { w: state.w, h: state.h, cells: state.cells, folds: 0, won: checkWon(state), history: [] };
    if (init.won) return 0;
    var dist = {}; dist[stateKey(init)] = 0;
    var queue = [init], head = 0;
    while (head < queue.length) {
      var cur = queue[head++];
      var moves = legalFolds(cur);
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        var probe = { w: cur.w, h: cur.h, cells: cur.cells, folds: cur.folds,
                      won: cur.won, history: [] };
        var r = attemptFold(probe, m.axis, m.g, m.dir);
        if (!r.ok) continue;
        if (probe.won) return dist[stateKey(cur)] + 1;
        var k = stateKey(probe);
        if (dist[k] === undefined) { dist[k] = dist[stateKey(cur)] + 1; queue.push(probe); }
      }
    }
    return -1;
  }

  return { INK: INK, GRAIN: GRAIN, TARGET: TARGET, parseLevel: parseLevel,
           createState: createState, attemptFold: attemptFold, undo: undo,
           countInk: countInk, checkWon: checkWon, legalFolds: legalFolds,
           stateKey: stateKey, solve: solve };
});
