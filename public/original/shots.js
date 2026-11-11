

(function (global) {
  'use strict';

  var el = U.el, words = U.words, lines = U.lines, photo = U.photo;
  var SHOTS = {};

  

  SHOTS.title = function (root, d) {
    root.classList.add('s-title');
    var wrap = el('div', 'wrap');

    if (d.roman) {
      var r = el('p', 'roman');
      r.style.setProperty('--d', '0ms');
      r.classList.add('ln');
      r.innerHTML = d.roman;
      wrap.appendChild(r);
    }
    var rule = el('i', 'rule');
    rule.style.setProperty('--d', '420ms');
    wrap.appendChild(rule);

    var h = el('h2', 'headline');
    words(h, d.title, { delay: 700, step: 110 });
    wrap.appendChild(h);

    if (d.date) {
      var dt = el('p', 'datestamp ln');
      dt.style.setProperty('--d', '1500ms');
      dt.innerHTML = d.date;
      wrap.appendChild(dt);
    }
    if (d.sub) {
      var s = el('p', 'subhead ln');
      s.style.setProperty('--d', (d.date ? 2000 : 1600) + 'ms');
      s.innerHTML = d.sub;
      wrap.appendChild(s);
    }
    root.appendChild(wrap);
  };

  

  SHOTS.lines = function (root, d) {
    root.classList.add('s-lines');
    var wrap = el('div', 'wrap');
    lines(wrap, d.lines, {
      delay: d.delay || 500,
      gap: d.gap || 2100,
      gaps: d.gaps,
      cls: d.cls || 'body-line'
    });
    root.appendChild(wrap);
  };

  

  SHOTS.letter = function (root, d) {
    root.classList.add('s-letter');

    var env = el('div', 'envelope');
    
    env.appendChild(el('div', 'env__body'));
    env.appendChild(el('div', 'env__flap'));
    env.appendChild(el('div', 'env__stamp', d.stamp));

    var paper = el('div', 'env__paper');
    paper.appendChild(el('p', 'to', d.to));
    var ink = el('p', 'ink');
    var at = 4900;
    d.body.forEach(function (line) {
      var row = el('span');
      row.style.display = 'block';
      row.style.setProperty('--d', at + 'ms');
      row.innerHTML = line;
      ink.appendChild(row);
      at += 620;
    });
    paper.appendChild(ink);
    env.appendChild(paper);
    root.appendChild(env);

    if (d.cap) {
      var cap = el('div', 'letter__caption');
      var p = el('p', 'subhead ln');
      p.style.setProperty('--d', (d.capAt || 7600) + 'ms');
      p.innerHTML = d.cap;
      cap.appendChild(p);
      root.appendChild(cap);
    }
  };

  

  var GLOBE = { lat0: 44, lon0: 74, r: 180 };

  function project(lat, lon) {
    var d = Math.PI / 180;
    var la = lat * d, lo = (lon - GLOBE.lon0) * d, la0 = GLOBE.lat0 * d;
    var cosc = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo);
    return {
      x: GLOBE.r * Math.cos(la) * Math.sin(lo),
      y: -GLOBE.r * (Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo)),
      front: cosc > 0
    };
  }

  
  function arcPath(a, b, steps) {
    var d = Math.PI / 180;
    var la1 = a[0] * d, lo1 = a[1] * d, la2 = b[0] * d, lo2 = b[1] * d;
    var dd = 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((la1 - la2) / 2), 2) +
      Math.cos(la1) * Math.cos(la2) * Math.pow(Math.sin((lo1 - lo2) / 2), 2)
    ));
    var out = [];
    for (var i = 0; i <= steps; i++) {
      var f = i / steps;
      var A = Math.sin((1 - f) * dd) / Math.sin(dd);
      var B = Math.sin(f * dd) / Math.sin(dd);
      var x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
      var y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
      var z = A * Math.sin(la1) + B * Math.sin(la2);
      
      var p = project(Math.atan2(z, Math.sqrt(x * x + y * y)) / d, Math.atan2(y, x) / d);
      out.push((i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1));
    }
    return out.join(' ');
  }

  function graticule() {
    var paths = [], lat, lon, i, seg;
    for (lat = -60; lat <= 75; lat += 15) {
      seg = [];
      for (i = -180; i <= 180; i += 4) {
        var p = project(lat, i);
        seg.push(p.front ? (seg.length && seg[seg.length - 1] !== 'gap' ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) : 'gap');
      }
      paths.push(seg.filter(function (s) { return s !== 'gap'; }).join(' '));
    }
    for (lon = -180; lon < 180; lon += 20) {
      seg = [];
      for (i = -80; i <= 80; i += 4) {
        var q = project(i, lon);
        seg.push(q.front ? (seg.length && seg[seg.length - 1] !== 'gap' ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1) : 'gap');
      }
      paths.push(seg.filter(function (s) { return s !== 'gap'; }).join(' '));
    }
    return paths;
  }

  var START_CITY = [51.5074, -0.1278], END_CITY = [48.8566, 2.3522];

  SHOTS.map = function (root, d) {
    root.classList.add('s-map');
    var wrap = el('div', 'wrap');

    var R = GLOBE.r, vb = -R - 40, size = (R + 40) * 2;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mapfig');
    svg.setAttribute('viewBox', vb + ' ' + vb + ' ' + size + ' ' + size);
    svg.style.maxHeight = '52vh';

    var path = arcPath(d.from || START_CITY, d.toPoint || END_CITY, 96);
    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0%" stop-color="#ff6f8d"/><stop offset="52%" stop-color="#f0c37a"/>' +
          '<stop offset="100%" stop-color="#63c9dd"/>' +
        '</linearGradient>' +
        '<radialGradient id="ocean" cx="38%" cy="32%">' +
          '<stop offset="0%" stop-color="rgba(99,201,221,.14)"/>' +
          '<stop offset="100%" stop-color="rgba(10,12,22,.5)"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<circle r="' + R + '" fill="url(#ocean)" stroke="rgba(246,239,228,.18)" stroke-width="1"/>' +
      '<g fill="none" stroke="rgba(246,239,228,.09)" stroke-width=".8">' +
        graticule().map(function (p) { return '<path d="' + p + '"/>'; }).join('') +
      '</g>' +
      '<path class="arc" pathLength="1" d="' + path + '"/>';

    [[d.from || START_CITY, d.leftLabel || 'Home', 0, 'end', -14], [d.toPoint || END_CITY, d.rightLabel || 'Together', 900, 'start', 14]]
      .forEach(function (cfg) {
        var p = project(cfg[0][0], cfg[0][1]);
        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'pin');
        g.style.setProperty('--d', (3400 + cfg[2]) + 'ms');
        g.innerHTML =
          '<circle class="halo" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="5" fill="none" stroke="#f0c37a" stroke-width="1.2"/>' +
          '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.4" fill="#ffd9a0"/>' +
          '<text class="label" x="' + (p.x + cfg[4]).toFixed(1) + '" y="' + (p.y - 12).toFixed(1) +
            '" text-anchor="' + cfg[3] + '">' + cfg[1] + '</text>';
        svg.appendChild(g);
      });

    if (d.plane) {
      var jet = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      jet.setAttribute('class', 'plane');
      jet.style.setProperty('--path', 'path("' + path + '")');
      jet.innerHTML = '<path d="M-7 0 L7 0 M0 -4 L6 0 L0 4 Z" fill="#fff" stroke="#fff" stroke-width="1.4" ' +
                      'stroke-linejoin="round" filter="drop-shadow(0 0 8px rgba(255,255,255,.9))"/>';
      svg.appendChild(jet);
    }
    wrap.appendChild(svg);

    if (d.stats) {
      var box = el('div', 'stats');
      d.stats.forEach(function (s, i) {
        var one = el('div', 'stat');
        one.style.setProperty('--d', (4200 + i * 420) + 'ms');
        one.appendChild(el('b', '', s[0]));
        one.appendChild(el('span', '', s[1]));
        box.appendChild(one);
      });
      wrap.appendChild(box);
    }

    if (d.caption) {
      var cap = el('p', 'subhead ln');
      cap.style.setProperty('--d', (d.captionAt || 5600) + 'ms');
      cap.style.textAlign = 'center';
      cap.innerHTML = d.caption;
      wrap.appendChild(cap);
    }
    root.appendChild(wrap);
  };

  

  SHOTS.clocks = function (root, d) {
    root.classList.add('s-lines');
    var wrap = el('div', 'wrap');

    var box = el('div', 'clocks');
    d.clocks.forEach(function (c, i) {
      var one = el('div', 'clock');
      one.style.setProperty('--d', (400 + i * 400) + 'ms');
      var ticks = '';
      for (var t = 0; t < 12; t++) {
        var a = t * Math.PI / 6;
        ticks += '<line class="tick" x1="' + (50 + 40 * Math.sin(a)).toFixed(1) + '" y1="' + (50 - 40 * Math.cos(a)).toFixed(1) +
                 '" x2="' + (50 + 44 * Math.sin(a)).toFixed(1) + '" y2="' + (50 - 44 * Math.cos(a)).toFixed(1) + '"/>';
      }
      one.innerHTML =
        '<svg viewBox="0 0 100 100"><circle class="face" cx="50" cy="50" r="46"/>' + ticks +
        '<line class="hand h" style="--r:' + c.h + 'deg" x1="50" y1="50" x2="50" y2="26"/>' +
        '<line class="hand m" style="--r:' + c.m + 'deg" x1="50" y1="50" x2="50" y2="14"/>' +
        '<circle cx="50" cy="50" r="2.6" fill="#f0c37a"/></svg>' +
        '<b>' + c.time + '</b><span>' + c.city + '</span>';
      box.appendChild(one);
    });
    wrap.appendChild(box);

    lines(wrap, d.lines, { delay: d.delay || 1600, gap: d.gap || 2300, cls: 'body-line' });
    root.appendChild(wrap);
  };

  

  SHOTS.chat = function (root, d) {
    root.classList.add('s-chat');
    var wrap = el('div', 'wrap');

    var win = el('div', 'chatwin');
    var bar = el('div', 'chatwin__bar');
    bar.innerHTML = '<i></i><i></i><i></i>';
    bar.appendChild(el('b', '', d.channel || 'Our conversation'));
    win.appendChild(bar);

    var body = el('div', 'chatwin__body');
    var at = d.delay || 700;
    d.messages.forEach(function (m) {
      var row = el('div', 'msg ' + (m[0] === 'me' ? 'me' : ''));
      row.style.setProperty('--d', at + 'ms');
      row.appendChild(el('span', 'av', m[0] === 'me' ? d.initialFrom : d.initialTo));
      row.appendChild(el('p', '', m[1]));
      if (m[2]) row.appendChild(el('time', '', m[2]));
      body.appendChild(row);
      (function (delay) {
        setTimeout(function () {
          try { body.scrollTop = body.scrollHeight; } catch (e) {}
        }, delay + 80);
      })(at);
      at += m[3] || d.step || 900;
    });
    win.appendChild(body);
    wrap.appendChild(win);

    if (d.caption) {
      var cap = el('p', 'subhead ln');
      cap.style.setProperty('--d', (at + 400) + 'ms');
      cap.style.textAlign = 'center';
      cap.innerHTML = d.caption;
      wrap.appendChild(cap);
    }
    root.appendChild(wrap);
  };

  

  SHOTS.count = function (root, d, ctx) {
    root.classList.add('s-count');
    var wrap = el('div', 'wrap');

    if (d.over) {
      var o = el('p', 'eyebrow ln');
      o.style.setProperty('--d', '200ms');
      o.innerHTML = d.over;
      wrap.appendChild(o);
    }

    var n = el('div', 'bignum');
    n.textContent = '0';
    wrap.appendChild(n);

    if (d.under) {
      var u = el('p', 'subhead ln');
      u.style.setProperty('--d', (d.underAt || 2600) + 'ms');
      u.innerHTML = d.under;
      wrap.appendChild(u);
    }
    root.appendChild(wrap);

    
    var target = d.to, dur = d.rampMs || 2600, t0 = null;
    ctx.raf(function (now) {
      if (t0 === null) t0 = now;
      var k = U.clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      n.textContent = Math.round(target * e).toLocaleString('en-US');
      return k < 1;
    });
  };

  
  SHOTS.ticker = function (root, d) {
    root.classList.add('s-count');
    var wrap = el('div', 'wrap');
    var box = el('div', 'tickers');
    var at = d.delay || 400;

    d.rows.forEach(function (row) {
      var r = el('div', 'tick-row gone');
      r.innerHTML = row[0];
      r.style.setProperty('--d', at + 'ms');
      r.style.setProperty('--dout', (at + (row[1] || 700)) + 'ms');
      r.style.position = 'absolute';
      box.appendChild(r);
      at += row[1] || 700;
    });
    box.style.position = 'relative';
    box.style.minHeight = 'clamp(90px,16vw,170px)';
    box.style.display = 'grid';
    box.style.placeItems = 'center';
    wrap.appendChild(box);

    if (d.under) {
      var u = el('p', 'subhead ln');
      u.style.setProperty('--d', (at + 200) + 'ms');
      u.innerHTML = d.under;
      wrap.appendChild(u);
    }
    root.appendChild(wrap);
  };

  

  function caption(d, delay) {
    var cap = el('div', 'caption ' + (d.capCenter ? 'center' : ''));
    if (d.date) {
      var dt = el('span', 'datestamp ln');
      dt.style.setProperty('--d', delay + 'ms');
      dt.innerHTML = d.date;
      cap.appendChild(dt);
    }
    if (d.cap) {
      var s = el('p', 'say');
      words(s, d.cap, { delay: delay + (d.date ? 500 : 0), step: 78 });
      cap.appendChild(s);
    }
    return cap;
  }

  SHOTS.solo = function (root, d, ctx) {
    root.classList.add('s-solo');

    var frame = el('div', 'frame');
    frame.style.background = P.tint(d.idx);
    var meta = P.get(d.idx);
    var img = new Image();
    if (meta && meta.ratio) img.style.aspectRatio = String(meta.ratio);
    img.src = P.src(d.idx, 'large');
    img.alt = '';
    frame.appendChild(img);
    root.appendChild(frame);
    root.appendChild(el('div', 'scrim'));

    if (d.cap || d.date) root.appendChild(caption(d, d.capAt || 900));
  };

  

  SHOTS.duo = function (root, d) {
    root.classList.add('s-duo');
    var wrap = el('div', 'wrap');
    d.idx.forEach(function (i) { wrap.appendChild(photo(i, 'large')); });
    root.appendChild(wrap);
    if (d.cap || d.date) root.appendChild(caption(d, d.capAt || 1100));
  };

  

  SHOTS.split = function (root, d) {
    root.classList.add('s-split');
    if (d.flip) root.classList.add('flip');

    var wrap = el('div', 'wrap');
    var media = el('div', 'media');
    media.style.background = P.tint(d.idx);
    var meta = P.get(d.idx);
    var img = new Image();
    if (meta && meta.ratio) img.style.aspectRatio = String(meta.ratio);
    img.src = P.src(d.idx, 'large');
    img.alt = '';
    media.appendChild(img);
    wrap.appendChild(media);

    var box = el('div', 'words');
    var at = d.delay || 800;
    if (d.date) {
      var dt = el('span', 'datestamp ln');
      dt.style.setProperty('--d', at + 'ms');
      dt.innerHTML = d.date;
      box.appendChild(dt); at += 600;
    }
    if (d.title) {
      var h = el('h3', 'headline');
      words(h, d.title, { delay: at, step: 100 });
      box.appendChild(h); at += 900;
    }
    if (d.lines) lines(box, d.lines, { delay: at, gap: d.gap || 1500, cls: 'subhead' });
    wrap.appendChild(box);
    root.appendChild(wrap);
  };

  

  SHOTS.grid = function (root, d, ctx) {
    root.classList.add('s-grid');
    var pool = d.pool, cols = d.cols || Math.ceil(Math.sqrt(pool.length * 1.4));
    var wrap = el('div', 'wrap');
    wrap.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';

    
    var rows = Math.ceil(pool.length / cols);
    var gap = U.clamp(window.innerWidth * 0.009, 6, 13);
    var availW = Math.min(1500, window.innerWidth * 0.95);
    var availH = window.innerHeight * (d.title ? 0.64 : 0.82);
    var cell = Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows);
    wrap.style.gap = gap + 'px';
    wrap.style.width = (cell * cols + gap * (cols - 1)) + 'px';
    if (d.title) wrap.style.marginTop = window.innerHeight * 0.09 + 'px';

    var order = U.shuffle(pool.map(function (_, i) { return i; }), d.seed || 42);
    var span = Math.max(600, (ctx.dur - 1800));
    pool.forEach(function (i, k) {
      var cell = photo(i, 'thumb');
      cell.style.setProperty('--d', (300 + order[k] / pool.length * span) + 'ms');
      wrap.appendChild(cell);
    });
    root.appendChild(wrap);

    if (d.title) {
      var head = el('div', 'heading');
      var h = el('h3', 'headline');
      h.style.fontSize = 'clamp(26px,4vw,58px)';
      h.style.textShadow = '0 6px 50px rgba(0,0,0,.9)';
      words(h, d.title, { delay: 200, step: 90 });
      head.appendChild(h);
      root.appendChild(head);
    }
  };

  

  SHOTS.scatter = function (root, d, ctx) {
    root.classList.add('s-scatter');
    var wrap = el('div', 'wrap');
    var pool = d.pool, n = pool.length;
    var r = U.seeded(d.seed || 7);

    var vw = window.innerWidth, vh = window.innerHeight;
    var cols = Math.max(2, Math.round(Math.sqrt(n * vw / vh)));
    var rows = Math.ceil(n / cols);
    var cellW = vw * 0.90 / cols, cellH = vh * 0.80 / rows;

    
    var cardW = Math.min(cellW * 1.16, cellH / 1.19 * 1.16);
    var cardH = cardW * 1.19;
    var pad = cardW * 0.035;

    pool.forEach(function (i, k) {
      var c = k % cols, rw = Math.floor(k / cols);
      var pol = el('div', 'polaroid');
      
      pol.style.width = cardW + 'px';
      pol.style.padding = pad + 'px ' + pad + 'px ' + (cardW * 0.14) + 'px';
      pol.style.left = (vw * 0.05 + (c + .5) * cellW - cardW / 2 + (r() - .5) * cellW * 0.22) + 'px';
      pol.style.top = (vh * 0.10 + (rw + .5) * cellH - cardH / 2 + (r() - .5) * cellH * 0.18) + 'px';
      pol.style.setProperty('--r', ((r() - .5) * 20).toFixed(1) + 'deg');
      pol.style.setProperty('--fr', ((r() - .5) * 120).toFixed(1) + 'deg');
      pol.style.setProperty('--fx', ((r() - .5) * 60).toFixed(1) + 'vw');
      pol.style.setProperty('--fy', (-70 - r() * 40).toFixed(1) + 'vh');
      pol.style.setProperty('--d', (200 + k * Math.max(90, (ctx.dur - 2200) / n)) + 'ms');
      pol.style.zIndex = String(k);

      var img = new Image();
      img.src = P.src(i, 'thumb');
      img.alt = '';
      pol.appendChild(img);
      if (d.notes && d.notes[k]) pol.appendChild(el('b', '', d.notes[k]));
      wrap.appendChild(pol);
    });
    root.appendChild(wrap);
  };

  

  SHOTS.mosaic = function (root, d, ctx) {
    root.classList.add('s-mosaic');
    var pool = d.pool, n = pool.length;
    var ar = window.innerWidth / window.innerHeight;

    
    var ideal = Math.sqrt(n * ar), cols = Math.max(3, Math.round(ideal)), best = 1e9;
    for (var c = Math.max(3, Math.round(ideal) - 3); c <= Math.round(ideal) + 3; c++) {
      var score = (c * Math.ceil(n / c) - n) * 3 + Math.abs(c - ideal);
      if (score < best) { best = score; cols = c; }
    }
    var rows = Math.ceil(n / cols);

    var wrap = el('div', 'wrap');
    wrap.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    wrap.style.gridTemplateRows = 'repeat(' + rows + ',1fr)';
    wrap.style.setProperty('--t', (ctx.dur / 1000 + 1) + 's');

    var span = Math.max(500, ctx.dur - 2400);
    var order = U.shuffle(pool.map(function (_, i) { return i; }), d.seed || 11);
    pool.forEach(function (i, k) {
      var cell = photo(i, 'thumb');
      cell.style.setProperty('--d', (200 + order[k] / n * span) + 'ms');
      wrap.appendChild(cell);
    });
    root.appendChild(wrap);

    if (d.title || d.cap) {
      var over = el('div', 'overtitle');
      var inner = el('div');
      inner.style.display = 'grid';
      inner.style.gap = '1em';
      inner.style.justifyItems = 'center';
      if (d.title) {
        var h = el('h3', 'headline');
        words(h, d.title, { delay: (d.titleAt || 600), step: 100 });
        inner.appendChild(h);
      }
      if (d.cap) {
        var s = el('p', 'subhead ln');
        s.style.setProperty('--d', (d.capAt || 1800) + 'ms');
        s.innerHTML = d.cap;
        inner.appendChild(s);
      }
      over.appendChild(inner);
      root.appendChild(over);
    }
  };

  

  SHOTS.strip = function (root, d, ctx) {
    root.classList.add('s-strip');
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.padding = '0';

    root.appendChild(el('i', 'perf t'));
    root.appendChild(el('i', 'perf b'));

    var rail = el('div', 'rail');
    rail.style.setProperty('--t', (ctx.dur / 1000) + 's');
    d.pool.forEach(function (i) {
      var box = photo(i, 'thumb');
      box.style.setProperty('--ar', (P.get(i).ratio || .75).toFixed(3));
      rail.appendChild(box);
    });
    root.appendChild(rail);

    requestAnimationFrame(function () {
      var over = rail.scrollWidth - window.innerWidth;
      rail.style.setProperty('--shift', (-Math.max(over, 0) - 40) + 'px');
    });

    if (d.cap) {
      var cap = el('div', 'caption center');
      var s = el('p', 'say');
      s.style.fontSize = 'clamp(17px,2.4vw,32px)';
      words(s, d.cap, { delay: d.capAt || 600, step: 80 });
      cap.appendChild(s);
      root.appendChild(cap);
    }
  };

  

  SHOTS.stack = function (root, d, ctx) {
    root.classList.add('s-stack');
    var wrap = el('div', 'wrap');
    var r = U.seeded(d.seed || 5), n = d.pool.length;

    d.pool.forEach(function (i, k) {
      var card = photo(i, 'thumb');
      card.style.setProperty('--tx', ((r() - .5) * 52).toFixed(1) + 'vw');
      card.style.setProperty('--ty', ((r() - .5) * 20).toFixed(1) + 'vh');
      card.style.setProperty('--r', ((r() - .5) * 26).toFixed(1) + 'deg');
      card.style.setProperty('--r0', ((r() - .5) * 60).toFixed(1) + 'deg');
      card.style.setProperty('--d', (200 + k * Math.max(110, (ctx.dur - 1600) / n)) + 'ms');
      card.style.zIndex = String(k);
      wrap.appendChild(card);
    });
    root.appendChild(wrap);

    if (d.cap) {
      var cap = el('div', 'caption center');
      var s = el('p', 'say');
      words(s, d.cap, { delay: d.capAt || 800, step: 80 });
      cap.appendChild(s);
      root.appendChild(cap);
    }
  };

  

  SHOTS.video = function (root, d, ctx) {
    root.classList.add('s-video');
    var withSound = !!d.sound;
    if (withSound) root.classList.add('has-sound');

    var v = document.createElement('video');
    v.src = d.src;
    v.poster = d.poster || '';
    v.muted = !withSound;
    if (withSound) {
      v.volume = d.volume == null ? 1 : d.volume;
      v.removeAttribute('muted');
    } else {
      v.setAttribute('muted', '');
    }
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.loop = withSound ? false : (d.loop !== false);
    v.autoplay = true;
    v.preload = 'auto';
    
    v.style.width = 'auto';
    v.style.height = 'auto';
    v.style.maxWidth = '100%';
    v.style.maxHeight = '100%';
    v.style.objectFit = 'contain';
    v.style.objectPosition = 'center';
    v.addEventListener('loadedmetadata', function () {
      if (v.videoWidth && v.videoHeight) {
        v.style.aspectRatio = (v.videoWidth / v.videoHeight).toFixed(4);
      }
    });
    if (d.filter) v.style.filter = d.filter;
    root.appendChild(v);
    if (!d.noScrim) root.appendChild(el('div', 'scrim'));

    ctx.onEnter(function () {
      if (document.body.classList.contains('paused')) return;
      try { v.currentTime = 0; } catch (e) {}
      if (withSound) {
        var m = document.getElementById('music');
        if (m && !m.paused) {
          m.dataset.pausedForClip = '1';
          m.pause();
        }
      }
      v.muted = !withSound;
      var p = v.play();
      if (p && p.catch) {
        p.catch(function (error) {
          
          if (error && error.name !== 'AbortError') v.controls = true;
        });
      }
    });
    ctx.onExit(function () {
      v.pause();
      if (withSound) {
        var m = document.getElementById('music');
        if (m && m.dataset.pausedForClip === '1') {
          m.dataset.pausedForClip = '';
          var r = m.play();
          if (r && r.catch) r.catch(function () {});
        }
      }
    });

    if (d.cap || d.date) root.appendChild(caption(d, d.capAt || 1200));
  };

  

  SHOTS.booth = function (root, d) {
    root.classList.add('s-booth');
    var wrap = el('div', 'wrap');

    var box = photo(d.idx, 'large');
    box.style.setProperty('--ar', (P.get(d.idx).ratio || .34).toFixed(3));
    wrap.appendChild(box);

    var words_ = el('div', 'words');
    var at = d.delay || 1200;
    if (d.date) {
      var dt = el('span', 'datestamp ln');
      dt.style.setProperty('--d', at + 'ms');
      dt.innerHTML = d.date;
      words_.appendChild(dt); at += 700;
    }
    if (d.lines) lines(words_, d.lines, { delay: at, gap: d.gap || 1700, cls: 'subhead' });
    wrap.appendChild(words_);
    root.appendChild(wrap);
  };

  

  SHOTS.goodbye = function (root, d) {
    root.classList.add('s-goodbye');
    var wrap = el('div', 'wrap');

    if (d.date) {
      var dt = el('p', 'datestamp ln');
      dt.style.setProperty('--d', '300ms');
      dt.innerHTML = d.date;
      wrap.appendChild(dt);
    }
    if (d.title) {
      var h = el('h2', 'headline');
      words(h, d.title, { delay: 900, step: 110 });
      wrap.appendChild(h);
    }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'trail');
    svg.setAttribute('viewBox', '0 0 720 120');
    var pd = 'M12 96 C 190 96, 300 78, 420 48 S 640 6, 712 8';
    svg.innerHTML = '<path d="' + pd + '"/>';
    var jet = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    jet.setAttribute('class', 'jet');
    jet.style.setProperty('--path', 'path("' + pd + '")');
    jet.innerHTML = '<path d="M-9 0 L9 0 M0 -5 L8 0 L0 5 Z" fill="#f6efe4" stroke="#f6efe4" stroke-width="1.5" stroke-linejoin="round"/>';
    svg.appendChild(jet);
    wrap.appendChild(svg);

    lines(wrap, d.lines, { delay: d.delay || 2600, gap: d.gap || 2400, cls: 'body-line' });
    root.appendChild(wrap);
  };

  

  SHOTS.vows = function (root, d) {
    root.classList.add('s-vows');
    var wrap = el('div', 'wrap');
    var at = d.delay || 700;

    d.vows.forEach(function (v, i) {
      var row = el('div', 'vow');
      row.style.setProperty('--d', at + 'ms');
      row.appendChild(el('i', '', U.pad(i + 1)));
      row.appendChild(el('p', '', v));
      wrap.appendChild(row);
      at += d.gap || 2500;
    });

    var sign = el('div', 'sign');
    sign.style.setProperty('--d', (at + 400) + 'ms');
    sign.appendChild(el('span', 'name', d.name || 'Me'));
    sign.appendChild(el('span', 'datestamp when', d.when || ''));
    wrap.appendChild(sign);
    root.appendChild(wrap);
  };

  global.SHOTS = SHOTS;
})(window);
