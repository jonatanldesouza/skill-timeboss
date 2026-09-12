'use strict';

/**
 * make-icons.js - gera os icones que a Alexa exige para publicar
 * (108x108 e 512x512). Escreve PNG na mao (zlib + CRC32, sem dependencias),
 * com supersampling 4x para bordas suaves.
 *
 * Uso:    node tools/make-icons.js
 * Saida:  assets/icons/icon-108.png
 *         assets/icons/icon-512.png
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SS = 4; // supersampling

/* =============================== PNG =============================== */

const CRC = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** rgba: Buffer/Uint8Array RGBA (w*h*4 bytes). Retorna o tamanho do arquivo. */
function writePng(file, w, h, rgba) {
  const stride = w * 4;
  const src = Buffer.isBuffer(rgba) ? rgba : Buffer.from(rgba);
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filtro "None"
    src.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

/* ============================== CANVAS ============================= */

/** Canvas RGBA com anti-aliasing por cobertura + supersampling. */
function makeCanvas(size) {
  const w = size * SS;
  const px = new Float64Array(w * w * 4); // r,g,b em 0..255 | a em 0..1
  const a = (color) => color[3] === undefined ? 1 : color[3];

  function blend(x, y, c, cov) {
    if (cov <= 0) return;
    if (cov > 1) cov = 1;
    const i = (y * w + x) * 4;
    const ca = a(c) * cov;
    const ia = 1 - ca;
    px[i] = px[i] * ia + c[0] * ca;
    px[i + 1] = px[i + 1] * ia + c[1] * ca;
    px[i + 2] = px[i + 2] * ia + c[2] * ca;
    px[i + 3] = px[i + 3] * ia + ca;
  }

  function each(x0, y0, x1, y1, fn) {
    const ax = Math.max(0, Math.floor(x0));
    const ay = Math.max(0, Math.floor(y0));
    const bx = Math.min(w - 1, Math.ceil(x1));
    const by = Math.min(w - 1, Math.ceil(y1));
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) fn(x, y);
  }

  return {
    size,
    w,
    px,
    blend,
    /** Disco solido (cov em pixels de "suavizacao"). */
    disc(cx, cy, r, c, feather) {
      const f = feather || 1;
      each(cx - r - f, cy - r - f, cx + r + f, cy + r + f, (x, y) => {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        blend(x, y, c, (r - d) / f);
      });
    },
    /** Anel (contorno circular) de espessura fixa. */
    ring(cx, cy, r, width, c) {
      const hw = width / 2;
      each(cx - r - hw - 1, cy - r - hw - 1, cx + r + hw + 1, cy + r + hw + 1, (x, y) => {
        const d = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r);
        blend(x, y, c, hw + 0.5 - d);
      });
    },
    /** Traco de (x0,y0) a (x1,y1) com pontas retas. */
    line(x0, y0, x1, y1, width, c) {
      const hw = width / 2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1;
      each(
        Math.min(x0, x1) - hw - 1, Math.min(y0, y1) - hw - 1,
        Math.max(x0, x1) + hw + 1, Math.max(y0, y1) + hw + 1,
        (x, y) => {
          const vx = x + 0.5 - x0;
          const vy = y + 0.5 - y0;
          let t = (vx * dx + vy * dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          blend(x, y, c, hw + 0.5 - Math.hypot(vx - t * dx, vy - t * dy));
        }
      );
    },
  };
}

/** Reduz o canvas supersampleado para o tamanho final (box filter). */
function downsample(canvas) {
  const n = canvas.size;
  const w = canvas.w;
  const step = w / n;
  const out = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let sy = 0; sy < step; sy++) {
        for (let sx = 0; sx < step; sx++) {
          const i = ((y * step + sy) * w + (x * step + sx)) * 4;
          const ca = canvas.px[i + 3];
          const wa = ca;
          r += canvas.px[i] * wa;
          g += canvas.px[i + 1] * wa;
          b += canvas.px[i + 2] * wa;
          al += ca;
        }
      }
      const cnt = step * step;
      const o = (y * n + x) * 4;
      if (al > 0) {
        out[o] = Math.round(r / al);
        out[o + 1] = Math.round(g / al);
        out[o + 2] = Math.round(b / al);
      }
      out[o + 3] = Math.round((al / cnt) * 255);
    }
  }
  return out;
}

/* ============================== DESENHO ============================ */

/* Cores do icone */
const BG_IN = [10, 18, 42];      // azul quase preto (centro)
const BG_OUT = [29, 66, 152];    // azul (borda)
const GOLD = [241, 196, 74];     // dourado
const GOLD_DARK = [172, 128, 30];
const DIAL = [7, 12, 30];        // mostrador
const HAND = [252, 226, 140];    // ponteiros

/** Desenha o icone (relogio do time boss) e devolve o RGBA no tamanho final. */
function renderIcon(size) {
  const c = makeCanvas(size);
  const w = c.w;
  const k = w / 512; // 1 unidade do design = k pixels
  const cx = w / 2;
  const cy = w / 2;

  // fundo: gradiente radial
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(1, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (w * 0.62));
      const i = (y * w + x) * 4;
      c.px[i] = BG_IN[0] + (BG_OUT[0] - BG_IN[0]) * d;
      c.px[i + 1] = BG_IN[1] + (BG_OUT[1] - BG_IN[1]) * d;
      c.px[i + 2] = BG_IN[2] + (BG_OUT[2] - BG_IN[2]) * d;
      c.px[i + 3] = 1;
    }
  }

  const R = 186 * k; // raio do mostrador
  c.ring(cx, cy, R + 10 * k, 20 * k, GOLD);                        // aro dourado
  c.ring(cx, cy, R + 23 * k, 4 * k, [GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2], 0.9]);
  c.disc(cx, cy, R, DIAL);                                         // mostrador

  // marcadores das horas (maiores em 12, 3, 6 e 9)
  for (let i = 0; i < 12; i++) {
    const ang = (i * 30 * Math.PI) / 180;
    const big = i % 3 === 0;
    const inner = (big ? 138 : 148) * k;
    const outer = (big ? 172 : 168) * k;
    c.line(
      cx + Math.sin(ang) * inner, cy - Math.cos(ang) * inner,
      cx + Math.sin(ang) * outer, cy - Math.cos(ang) * outer,
      (big ? 13 : 7) * k,
      big ? GOLD : [GOLD[0], GOLD[1], GOLD[2], 0.75]
    );
  }

  // ponteiros: hora ~1h e minuto no 17 (o exemplo usado na skill)
  const hand = (deg, len, wdt, color) => {
    const rad = (deg * Math.PI) / 180;
    c.line(cx, cy, cx + Math.sin(rad) * len * k, cy - Math.cos(rad) * len * k, wdt * k, color);
  };
  hand(38.5, 96, 20, HAND);
  hand(102, 150, 15, HAND);

  c.disc(cx, cy, 17 * k, GOLD);       // eixo
  c.disc(cx, cy, 8 * k, [30, 22, 6, 1]);

  return downsample(c);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [size, nome] of [[108, 'icon-108.png'], [512, 'icon-512.png']]) {
    const bytes = writePng(path.join(OUT_DIR, nome), size, size, renderIcon(size));
    console.log('  [OK]    assets/icons/' + nome + '  (' + size + 'x' + size + ', ' + bytes + ' bytes)');
  }
  console.log('\nIcones gerados. Envie os dois em Alexa Developer Console > Distribution > Images.');
}

if (require.main === module) main();

module.exports = { writePng, makeCanvas, downsample, crc32, renderIcon };
