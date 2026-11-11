

(function (global) {
  'use strict';

  

  function inHeart(x, y) {
    var a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  }

  
  function heartCells(want) {
    var lo = 0.02, hi = 0.5, mid, n, i;
    for (i = 0; i < 34; i++) {
      mid = (lo + hi) / 2;
      n = countCells(mid);
      if (n > want) lo = mid; else hi = mid;
    }
    return collectCells(lo);
  }

  function countCells(step) {
    var n = 0;
    for (var y = -1.35; y <= 1.1; y += step)
      for (var x = -1.25; x <= 1.25; x += step)
        if (inHeart(x + step / 2, y + step / 2)) n++;
    return n;
  }

  function collectCells(step) {
    var out = [];
    for (var y = -1.35; y <= 1.1; y += step)
      for (var x = -1.25; x <= 1.25; x += step) {
        var cx = x + step / 2, cy = y + step / 2;
        if (inHeart(cx, cy)) out.push({ nx: cx, ny: cy, ns: step });
      }
    return out;
  }

  

  
  function vivid(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    
    s = Math.min(1, s * 2.4 + .5);
    l = 0.30 + l * 0.22;
    return hsl(h, s, l);
  }

  function hsl(h, s, l) {
    function hue(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [
      Math.round(hue(p, q, h + 1 / 3) * 255),
      Math.round(hue(p, q, h) * 255),
      Math.round(hue(p, q, h - 1 / 3) * 255)
    ];
  }

  

  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { var c = 1.24; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function inOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  
  function heartbeat(t) {
    var p = (t % 1.25) / 1.25;
    if (p < .12) return Math.sin(p / .12 * Math.PI);
    if (p > .2 && p < .34) return .62 * Math.sin((p - .2) / .14 * Math.PI);
    return 0;
  }

  

  function Finale(canvas, opts) {
    this.c = canvas;
    this.x = canvas.getContext('2d', { alpha: true });
    this.opts = opts || {};
    this.raf = 0;
    this.running = false;
    this.beatsShown = {};
  }

  Finale.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 1.6);
    this.W = global.innerWidth; this.H = global.innerHeight;
    this.c.width = Math.round(this.W * dpr);
    this.c.height = Math.round(this.H * dpr);
    this.c.style.width = this.W + 'px';
    this.c.style.height = this.H + 'px';
    this.x.setTransform(dpr, 0, 0, dpr, 0, 0);

    
    this.cx = this.W / 2;
    this.cy = this.H * 0.62;
    this.S = Math.min(this.W * 0.82 / 2.5, this.H * 0.78 / 2.45);

    var self = this;
    if (this.cells) {
      this.cells.forEach(function (c) {
        c.tx = self.cx + c.nx * self.S;
        c.ty = self.cy - c.ny * self.S;
        c.ts = c.ns * self.S * 1.06;
      });
    }
    if (this.phase >= 2) this.buildTextTargets(this.textIndex);
  };

  

  Finale.prototype.build = function () {
    var self = this;
    var mobile = Math.min(global.innerWidth, global.innerHeight) < 700;
    var want = mobile ? 200 : 330;

    this.cells = heartCells(want);
    this.resize();

    
    var order = U.shuffle(P.all.map(function (_, i) { return i; }), 1337);
    var diag = Math.sqrt(this.W * this.W + this.H * this.H);

    this.cells.forEach(function (c, k) {
      var idx = order[k % order.length];
      c.idx = idx;
      c.img = new Image();
      c.img.src = P.src(idx, 'micro');
      c.rgb = vivid(P.get(idx).rgb || [150, 130, 130]);

      var a = Math.random() * Math.PI * 2;
      c.sx = self.cx + Math.cos(a) * diag * U.rand(.62, 1.05);
      c.sy = self.cy + Math.sin(a) * diag * U.rand(.62, 1.05);
      c.sr = U.rand(-Math.PI, Math.PI);
      c.rr = U.rand(-.22, .22);
      
      var dist = Math.sqrt(c.nx * c.nx + c.ny * c.ny) / 1.5;
      c.delay = 300 + dist * 1500 + Math.random() * 500;
      c.dur = U.rand(1200, 1700);
    });

    
    var per = U.clamp(Math.round((mobile ? 5200 : 16000) / this.cells.length), 12, 60);
    var n = this.cells.length * per;
    this.per = per;
    this.n = n;

    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);
    this.sp = new Float32Array(n);
    this.sz = new Float32Array(n);
    this.hot = new Uint8Array(n);

    for (var i = 0; i < n; i++) {
      this.sp[i] = U.rand(.045, .115);
      this.sz[i] = Math.random() < .08 ? 2.4 : 1.4;
      this.hot[i] = Math.random() < .14 ? 1 : 0;
    }

    this.fireworks = [];
    this.phase = 0;
    this.textIndex = -1;
    return this;
  };

  

  Finale.prototype.buildTextTargets = function (which) {
    if (which < 0 || !this.TEXTS[which]) return;
    var spec = this.TEXTS[which];
    var scale = .5;
    var w = Math.max(320, Math.round(this.W * scale)), h = Math.max(200, Math.round(this.H * scale));

    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    var rows = spec.lines;
    var fam = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Inter","Segoe UI",sans-serif';
    var weight = spec.weight || 700;
    var size = Math.min(h / (rows.length * 1.5), w / 8);
    if (spec.track) g.letterSpacing = spec.track;

    
    for (var guard = 0; guard < 40; guard++) {
      g.font = weight + ' ' + size + 'px ' + fam;
      var widest = 0;
      rows.forEach(function (r) { widest = Math.max(widest, g.measureText(r).width); });
      if (widest <= w * 0.82) break;
      size *= 0.94;
    }
    g.font = weight + ' ' + size + 'px ' + fam;

    var lh = size * 1.18;
    var top = h / 2 - (rows.length - 1) * lh / 2;
    rows.forEach(function (r, i) { g.fillText(r, w / 2, top + i * lh); });

    
    var data = g.getImageData(0, 0, w, h).data;
    var pts = [];
    for (var y = 0; y < h; y += 2)
      for (var xx = 0; xx < w; xx += 2)
        if (data[(y * w + xx) * 4 + 3] > 128) pts.push(xx / scale, y / scale);

    var count = pts.length / 2;
    if (!count) return;

    
    var jitter = 1.6;
    for (var i2 = 0, k = 0; i2 < this.n; i2++) {
      k = (i2 * 7919) % count;
      this.tx[i2] = pts[k * 2] + U.rand(-jitter, jitter);
      this.ty[i2] = pts[k * 2 + 1] + U.rand(-jitter, jitter);
    }
  };

  

  Finale.prototype.shatter = function () {
    var i = 0, self = this;
    this.cells.forEach(function (c) {
      for (var k = 0; k < self.per; k++, i++) {
        var ox = U.rand(-.5, .5) * c.ts, oy = U.rand(-.5, .5) * c.ts;
        self.px[i] = c.tx + ox;
        self.py[i] = c.ty + oy;
        var a = Math.atan2(self.py[i] - self.cy, self.px[i] - self.cx);
        var force = U.rand(2.6, 9.5);
        self.vx[i] = Math.cos(a) * force + U.rand(-1.6, 1.6);
        self.vy[i] = Math.sin(a) * force + U.rand(-2.4, .8);
      }
    });
  };

  

  Finale.prototype.TEXTS = []; 

  
  var T = {
    assemble: 0,
    beat: 4200,
    shatter: 10200,
    text0: 10900,
    text1: 15200,
    text2: 19400,
    text3: 23400,
    collapse: 27600,
    embers: 29000,
    card: 30200
  };

  Finale.prototype.start = function () {
    var self = this;
    this.t0 = null;
    this.running = true;
    this.phase = 0;
    this.c.classList.add('on');

    function loop(now) {
      if (!self.running) return;
      if (self.t0 === null) self.t0 = now;
      var t = now - self.t0;
      self.tick(t, now);
      self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
  };

  Finale.prototype.stop = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.c.classList.remove('on');
  };

  Finale.prototype.cue = function (name, t, at, fn) {
    if (t >= at && !this.beatsShown[name]) { this.beatsShown[name] = 1; fn(); }
  };

  Finale.prototype.tick = function (t, now) {
    var x = this.x, self = this;

    
    this.cue('shatter', t, T.shatter, function () {
      self.phase = 1;
      self.shatter();
      if (self.opts.onBeat) self.opts.onBeat('shatter');
    });
    this.cue('text0', t, T.text0, function () { self.phase = 2; self.textIndex = 0; self.buildTextTargets(0); });
    this.cue('text1', t, T.text1, function () { self.textIndex = 1; self.buildTextTargets(1); self.burst(7); });
    this.cue('text2', t, T.text2, function () { self.textIndex = 2; self.buildTextTargets(2); self.burst(8); });
    this.cue('text3', t, T.text3, function () { self.textIndex = 3; self.buildTextTargets(3); self.burst(10); });
    this.cue('collapse', t, T.collapse, function () { self.phase = 3; self.burst(16); });
    this.cue('embers', t, T.embers, function () {
      self.phase = 4;
      
      for (var k = 0; k < self.n; k++) {
        self.vx[k] *= .16;
        self.vy[k] = self.vy[k] * .16 + U.rand(0, .5);
      }
      self.burst(5);
    });
    this.cue('card', t, T.card, function () { if (self.opts.onDone) self.opts.onDone(); });

    
    if (this.phase === 0) {
      x.setTransform(this.c.width / this.W, 0, 0, this.c.height / this.H, 0, 0);
      x.clearRect(0, 0, this.W, this.H);
      this.drawHeart(t);
    } else {
      x.globalCompositeOperation = 'source-over';
      
      x.fillStyle = 'rgba(7,7,11,' + (this.phase >= 4 ? .32 : .26) + ')';
      x.fillRect(0, 0, this.W, this.H);

      
      var fade = 1 - U.clamp((t - T.shatter) / 620, 0, 1);
      if (fade > 0) {
        x.globalAlpha = fade;
        this.drawHeart(t);
        x.globalAlpha = 1;
      }
      this.stepParticles(t);
      this.drawParticles();
      this.stepFireworks();
    }
  };

  

  Finale.prototype.drawHeart = function (t) {
    var x = this.x, self = this;

    var beat = t > T.beat ? heartbeat((t - T.beat) / 1000) : 0;

    
    var grow = U.clamp((t - 900) / 2600, 0, 1);
    if (grow > 0) {
      var rad = this.S * (1.45 + beat * .1) * grow;
      var g = x.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, rad);
      g.addColorStop(0, 'rgba(255,111,141,' + (.20 + beat * .16) * grow + ')');
      g.addColorStop(.55, 'rgba(240,120,110,' + .07 * grow + ')');
      g.addColorStop(1, 'rgba(255,111,141,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, this.W, this.H);
    }

    var pulse = 1;
    if (t > T.beat) pulse = 1 + heartbeat((t - T.beat) / 1000) * .035;

    x.save();
    x.translate(this.cx, this.cy);
    x.scale(pulse, pulse);
    x.translate(-this.cx, -this.cy);

    this.cells.forEach(function (c) {
      var k = U.clamp((t - c.delay) / c.dur, 0, 1);
      if (k <= 0) return;
      var e = outBack(k);
      var px = c.sx + (c.tx - c.sx) * e;
      var py = c.sy + (c.ty - c.sy) * e;
      var rot = c.sr * (1 - e) + c.rr * (1 - k);
      var s = c.ts * (0.35 + 0.65 * outCubic(k));

      x.save();
      x.translate(px, py);
      x.rotate(rot);
      x.globalAlpha = U.clamp(k * 2.2, 0, 1);
      if (c.img.complete && c.img.naturalWidth) {
        
        var iw = c.img.naturalWidth, ih = c.img.naturalHeight, m = Math.min(iw, ih);
        x.drawImage(c.img, (iw - m) / 2, (ih - m) / 2, m, m, -s / 2, -s / 2, s, s);
      } else {
        x.fillStyle = 'rgb(' + c.rgb[0] + ',' + c.rgb[1] + ',' + c.rgb[2] + ')';
        x.fillRect(-s / 2, -s / 2, s, s);
      }
      x.restore();
    });

    x.globalAlpha = 1;

    x.restore();
  };

  

  Finale.prototype.stepParticles = function (t) {
    var n = this.n, px = this.px, py = this.py, vx = this.vx, vy = this.vy,
        tx = this.tx, ty = this.ty, sp = this.sp, i;

    if (this.phase === 1) {
      
      for (i = 0; i < n; i++) {
        px[i] += vx[i]; py[i] += vy[i];
        vx[i] *= .955; vy[i] = vy[i] * .955 + .04;
      }
      return;
    }

    if (this.phase === 2) {
      
      for (i = 0; i < n; i++) {
        var dx = tx[i] - px[i], dy = ty[i] - py[i];
        vx[i] = (vx[i] + dx * sp[i] * .34) * .82;
        vy[i] = (vy[i] + dy * sp[i] * .34) * .82;
        px[i] += vx[i]; py[i] += vy[i];
      }
      return;
    }

    if (this.phase === 3) {
      
      var cx = this.cx, cy = this.cy;
      for (i = 0; i < n; i++) {
        vx[i] = (vx[i] + (cx - px[i]) * .055) * .845;
        vy[i] = (vy[i] + (cy - py[i]) * .055) * .845;
        px[i] += vx[i]; py[i] += vy[i];
      }
      return;
    }

    
    var H = this.H, W = this.W;
    for (i = 0; i < n; i++) {
      vy[i] = vy[i] * .99 + .022;
      vx[i] = vx[i] * .99 + Math.sin((py[i] + t * .0007) * .01) * .012;
      px[i] += vx[i]; py[i] += vy[i];
      if (py[i] > H + 24) { py[i] = -20; px[i] = Math.random() * W; vy[i] = U.rand(.2, .9); vx[i] = U.rand(-.3, .3); }
    }
  };

  Finale.prototype.drawParticles = function () {
    var x = this.x, cells = this.cells, per = this.per;
    var px = this.px, py = this.py, sz = this.sz, hot = this.hot;

    x.globalCompositeOperation = 'lighter';
    
    x.globalAlpha = this.phase >= 4 ? .45 : 1;

    for (var c = 0, i = 0; c < cells.length; c++) {
      var rgb = cells[c].rgb;
      x.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      var end = i + per;
      for (; i < end; i++) {
        var s = sz[i];
        x.fillRect(px[i], py[i], s, s);
      }
    }

    
    x.fillStyle = 'rgba(255,224,170,.9)';
    for (var k = 0; k < this.n; k += 7) {
      if (!hot[k]) continue;
      x.fillRect(px[k], py[k], sz[k] + .8, sz[k] + .8);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
  };

  

  Finale.prototype.burst = function (count) {
    for (var i = 0; i < count; i++) {
      this.fireworks.push(this.makeShell(
        U.rand(.12, .88) * this.W,
        U.rand(.12, .55) * this.H,
        i * U.rand(90, 320)
      ));
    }
  };

  Finale.prototype.makeShell = function (x, y, delay) {
    var hue = [[255, 111, 141], [240, 195, 122], [120, 205, 230], [255, 165, 190], [255, 240, 210]][U.randInt(0, 4)];
    var n = U.randInt(60, 120), pts = new Float32Array(n * 4);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = U.rand(1.2, 6.4) * (Math.random() < .3 ? .5 : 1);
      pts[i * 4] = x; pts[i * 4 + 1] = y;
      pts[i * 4 + 2] = Math.cos(a) * v; pts[i * 4 + 3] = Math.sin(a) * v;
    }
    return { pts: pts, n: n, rgb: hue, life: 0, max: U.rand(70, 115), delay: delay, started: false };
  };

  Finale.prototype.stepFireworks = function () {
    var x = this.x, list = this.fireworks;
    x.globalCompositeOperation = 'lighter';

    for (var f = list.length - 1; f >= 0; f--) {
      var s = list[f];
      if (s.delay > 0) { s.delay -= 16.7; continue; }
      s.life++;
      var a = U.clamp(1 - s.life / s.max, 0, 1);
      x.fillStyle = 'rgba(' + s.rgb[0] + ',' + s.rgb[1] + ',' + s.rgb[2] + ',' + (a * a) + ')';
      for (var i = 0; i < s.n; i++) {
        var o = i * 4;
        s.pts[o] += s.pts[o + 2];
        s.pts[o + 1] += s.pts[o + 3];
        s.pts[o + 2] *= .975;
        s.pts[o + 3] = s.pts[o + 3] * .975 + .045;
        x.fillRect(s.pts[o], s.pts[o + 1], 2.1, 2.1);
      }
      if (s.life > s.max) list.splice(f, 1);
    }
    x.globalCompositeOperation = 'source-over';

    
    if (this.phase >= 4 && Math.random() < .022 && list.length < 8) this.burst(1);
  };

  global.Finale = Finale;
  global.FINALE_T = T;
})(window);
