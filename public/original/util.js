

(function (global) {
  'use strict';

  var PHOTOS = global.PHOTOS || [];

  

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function frag() { return document.createDocumentFragment(); }

  
  function words(node, html, opts) {
    opts = opts || {};
    var start = opts.delay || 0;
    var step = opts.step || 85;
    var i = 0;

    var src = document.createElement('div');
    src.innerHTML = String(html);

    (function walk(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) {
          n.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part || /^\s+$/.test(part)) return;
            var s = el('span', 'w');
            s.style.setProperty('--d', (start + i * step) + 'ms');
            s.textContent = part;
            to.appendChild(s);
            i++;
          });
        } else if (n.nodeType === 1) {
          var clone = n.cloneNode(false);
          to.appendChild(clone);
          walk(n, clone);
        }
      });
    })(src, node);

    return start + i * step + 900;
  }

  
  function lines(node, list, opts) {
    opts = opts || {};
    var at = opts.delay || 0;
    var gap = opts.gap || 1400;
    list.forEach(function (text, i) {
      var p = el('span', 'ln ' + (opts.cls || ''));
      p.innerHTML = text;
      p.style.setProperty('--d', at + 'ms');
      if (opts.fadeAfter) {
        p.classList.add('fades');
        p.style.setProperty('--dout', (at + opts.fadeAfter) + 'ms');
      }
      node.appendChild(p);
      at += (opts.gaps && opts.gaps[i]) || gap;
    });
    return at;
  }

  

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function shuffle(arr, seed) {
    var a = arr.slice(), r = seeded(seed == null ? 1 : seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  
  function seeded(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  

  var P = {
    all: PHOTOS,
    count: PHOTOS.length,

    get: function (i) { return PHOTOS[i]; },

    src: function (i, size) {
      var p = PHOTOS[i];
      return p ? 'media/' + (size || 'large') + '/' + p.file : '';
    },

    
    range: function (a, b) {
      var out = [];
      for (var i = a; i <= b && i < PHOTOS.length; i++) out.push(i);
      return out;
    },

    
    days: function () {
      var want = Array.prototype.slice.call(arguments), out = [];
      PHOTOS.forEach(function (p, i) {
        if (p.date && want.indexOf(p.date.slice(0, 10)) !== -1) out.push(i);
      });
      return out;
    },

    
    without: function (pool, taken) {
      return pool.filter(function (i) { return taken.indexOf(i) === -1; });
    },

    tint: function (i) {
      var c = (PHOTOS[i] && PHOTOS[i].rgb) || [140, 130, 130];
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    },

    isPortrait: function (i) {
      var p = PHOTOS[i];
      return p ? p.h > p.w : true;
    }
  };

  
  function photo(i, size, cls) {
    var box = el('figure', 'ph ' + (cls || ''));
    var meta = P.get(i);
    box.style.background = P.tint(i);
    if (meta && meta.ratio) box.style.setProperty('--ar', String(meta.ratio));
    var img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.alt = '';
    img.src = P.src(i, size || 'large');
    box.appendChild(img);
    return box;
  }

  

  var cache = Object.create(null);

  function preload(indices, size) {
    (indices || []).forEach(function (i) {
      var url = P.src(i, size || 'large');
      if (!url || cache[url]) return;
      var img = new Image();
      img.decoding = 'async';
      img.src = url;
      cache[url] = img;
    });
  }

  function preloadUrls(urls) {
    (urls || []).forEach(function (url) {
      if (cache[url]) return;
      var img = new Image();
      img.src = url;
      cache[url] = img;
    });
  }

  

  var MS_DAY = 86400000;

  function daysBetween(a, b) {
    return Math.floor((b - a) / MS_DAY);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  global.U = {
    el: el, frag: frag, words: words, lines: lines,
    rand: rand, randInt: randInt, clamp: clamp, shuffle: shuffle, seeded: seeded,
    photo: photo, preload: preload, preloadUrls: preloadUrls,
    daysBetween: daysBetween, pad: pad, MS_DAY: MS_DAY
  };
  global.P = P;
})(window);
