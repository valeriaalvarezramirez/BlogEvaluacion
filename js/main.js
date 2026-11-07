(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Revelado al entrar en pantalla ---------- */
  var revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealItems.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Enlace activo del menú ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function setActive(id) {
    navLinks.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { if (s) spy.observe(s); });
  }
  setActive('inicio');

  /* ---------- Botón volver arriba ---------- */
  var toTop = document.querySelector('[data-to-top]');
  var sentinel = document.querySelector('[data-top-sentinel]');
  if (toTop && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      toTop.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(sentinel);
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Carrusel ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var dotsBox = root.querySelector('[data-dots]');
    var live = root.querySelector('[data-live]');
    var viewport = root.querySelector('.carousel__viewport');
    var current = 0;
    var swiped = false;

    var dots = slides.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ir a la línea de tiempo de ' + (slides[i].dataset.name || (i + 1)));
      b.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(b);
      return b;
    });

    function go(n) {
      var next = (n + slides.length) % slides.length;
      if (next === current) return;
      slides.forEach(function (s, i) {
        s.classList.toggle('is-active', i === next);
        s.classList.toggle('is-prev', i < next);
      });
      current = next;
      render();
      syncHeight();
      var top = viewport.getBoundingClientRect().top;
      if (top < 90) { window.scrollTo({ top: window.scrollY + top - 100, behavior: reduceMotion ? 'auto' : 'smooth' }); }
      live.textContent = 'Línea de tiempo de ' + (slides[current].dataset.name || (current + 1)) + ', ' + (current + 1) + ' de ' + slides.length;
    }
    function syncHeight() {
      var pb = parseFloat(getComputedStyle(viewport).paddingBottom) || 0;
      viewport.style.height = (slides[current].offsetHeight + pb + 4) + 'px';
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { syncHeight(); });
      slides.forEach(function (s) { ro.observe(s); });
    }
    window.addEventListener('load', syncHeight);
    function render() {
      dots.forEach(function (d, i) {
        if (i === current) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }

    root.querySelector('[data-prev]').addEventListener('click', function () { go(current - 1); });
    root.querySelector('[data-next]').addEventListener('click', function () { go(current + 1); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(current - 1); }
      if (e.key === 'ArrowRight') { go(current + 1); }
    });

    var startX = null;
    viewport.addEventListener('pointerdown', function (e) { startX = e.clientX; swiped = false; });
    viewport.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) { swiped = true; go(current + (dx < 0 ? 1 : -1)); }
    });
    viewport.addEventListener('pointercancel', function () { startX = null; });
    viewport.addEventListener('click', function (e) {
      if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
    }, true);

    render();
    syncHeight();
  });

  /* ---------- Imagen ampliada ---------- */
  var box = document.getElementById('lightbox');
  var boxImg = box && box.querySelector('[data-lightbox-img]');
  if (box && boxImg && typeof box.showModal === 'function') {
    document.querySelectorAll('[data-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var img = btn.querySelector('img');
        if (!img || img.hidden || btn.classList.contains('is-missing')) return;
        boxImg.src = img.currentSrc || img.src;
        boxImg.alt = img.alt;
        box.showModal();
      });
    });
    box.querySelector('[data-close]').addEventListener('click', function () { box.close(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  }

  /* ---------- Glosario: filtro por letra y buscador ---------- */
  var gl = document.querySelector('[data-glossary]');
  if (gl) {
    var input = gl.querySelector('input');
    var list = gl.querySelector('[data-list]');
    var groups = Array.prototype.slice.call(gl.querySelectorAll('.g-group'));
    var letterBtns = Array.prototype.slice.call(gl.querySelectorAll('.g-index button'));
    var empty = gl.querySelector('[data-empty]');
    var activeLetter = 'all';
    var fold = function (s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };

    function applyGlossary() {
      var q = fold(input.value.trim());
      var shown = 0;
      groups.forEach(function (g) {
        var letter = g.id.replace('g-', '');
        var hits = 0;
        g.querySelectorAll('.g-term').forEach(function (t) {
          var hit = !q || fold(t.textContent).indexOf(q) !== -1;
          t.hidden = !hit;
          if (hit) hits++;
        });
        var letterBtn = gl.querySelector('.g-index button[data-letter="' + letter + '"]');
        if (letterBtn) letterBtn.hidden = hits === 0;
        var visible = hits > 0 && (activeLetter === 'all' || activeLetter === letter);
        g.hidden = !visible;
        if (visible) shown += hits;
      });
      letterBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.letter === activeLetter ? 'true' : 'false');
      });
      list.classList.toggle('is-filtered', activeLetter !== 'all');
      empty.hidden = shown !== 0;
    }

    letterBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var letter = b.dataset.letter;
        activeLetter = (letter === activeLetter && letter !== 'all') ? 'all' : letter;
        input.value = '';
        applyGlossary();
      });
    });
    input.addEventListener('input', function () {
      activeLetter = 'all';
      applyGlossary();
    });
    applyGlossary();
  }})();
