/*
 * Pli — niveaux. '.' papier, 'i' tache d'encre, '#' grain de sable, 't' cible.
 * Niveaux 3-12 générés par dépliage inverse (games/pli-dev/tools/gen.mjs,
 * solvabilité garantie par construction) puis optimaux recalculés par BFS.
 * `par` = nombre de plis optimal, prouvé par BFS (games/pli-dev/tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PliLevels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    levels: [
      { name: 'Premier pli', par: 1, grid: [
        'it'
      ]},
      { name: 'Croisé', par: 2, grid: [
        'i.',
        '.t'
      ]},
      { name: 'Le ticket', par: 2, grid: [
        '..',
        'i.',
        'i.',
        'i.',
        't#',
        '##'
      ]},
      { name: 'Le billet', par: 3, grid: [
        'ii..',
        'ti..',
        'ii#.',
        '#.#.'
      ]},
      { name: 'L’enveloppe', par: 3, grid: [
        'ii.',
        'i..',
        'ti#',
        '.#.'
      ]},
      { name: 'Le paravent', par: 4, grid: [
        'iii.#i',
        'ii...t',
        '.....#'
      ]},
      { name: 'La lettre', par: 5, grid: [
        '......',
        '.....i',
        '.i.i..',
        't.....'
      ]},
      { name: 'Le carton', par: 5, grid: [
        'i..i..',
        'ii.ii.',
        '....t.',
        '.#...#'
      ]},
      { name: 'L’affiche', par: 5, grid: [
        '.it.',
        '.i..',
        'ii..',
        '..#.',
        '...#',
        'i..#'
      ]},
      { name: 'Le grand cahier', par: 6, grid: [
        '...ti.',
        'i...i.',
        'i...i.',
        '......',
        '..#..#',
        '.i....'
      ]},
      { name: 'La fresque', par: 6, grid: [
        '..i...',
        '..i#.i',
        'it....',
        '......',
        '....#.',
        '..i..i'
      ]},
      { name: 'L’atelier', par: 6, grid: [
        't.....',
        '......',
        'iii..i',
        '#...#.',
        '......',
        '.i....'
      ]}
    ]
  };
});
