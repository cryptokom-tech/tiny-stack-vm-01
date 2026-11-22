import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const T = '!2R%\'+,0        *******&***&*** ***             AEEA!           &)              %%"%';
const F = [(a, b) => a + b | 0, (a, b) => a - b | 0, Math.imul, , , , , , (a, b) => a & b, (a, b) => a | b, (a, b) => a ^ b, , (a, b) => a << (b & 31), (a, b) => a >> (b & 31), (a, b) => a >>> (b & 31) | 0, , (a, b) => a == b ? 1 : 0, (a, b) => a < b ? 1 : 0, (a, b) => a >>> 0 < b >>> 0 ? 1 : 0];
function run(p: Uint8Array, q: Uint8Array): [Uint8Array, number] {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), o = new Uint8Array(65536);
  let s = 0, c = 0, x = 0, i = 0, t = 0, n = 0;
  const R = (e: number): [Uint8Array, number] => [o.slice(0, n), e];
  for (;;) {
    if (t == 1e6) return R(10);
    if (x < 0 || x >= p.length) return R(9);
    const y = p[x], v = T.charCodeAt(y) - 33;
    if (!(v >= 0)) return R(5);
    const m = [0, 1, 2, 4][v >> 4], u = (v >> 2) & 3, w = v & 3;
    if (x + m >= p.length) return R(9);
    t++;
    if (s < u) return R(2);
    if (s - u + w > 256) return R(3);
    const k = x + 1 + m;
    x = k;
    switch (y) {
      case 0: return R(0);
      case 1: D[s++] = (p[k - 1] << 24) >> 24; break;
      case 2: D[s++] = p[k - 4] | p[k - 3] << 8 | p[k - 2] << 16 | p[k - 1] << 24; break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const a = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = a; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: {
        const r = ((p[k - 2] | p[k - 1] << 8) << 16) >> 16;
        let j = true;
        if (y != 48) { const z = D[--s]; j = y == 49 ? z == 0 : z != 0; }
        if (j) x = k + r;
        break;
      }
      case 51:
        if (c == 64) return R(7);
        C[c++] = k;
        x = p[k - 2] | p[k - 1] << 8;
        break;
      case 52:
        if (!c) return R(8);
        x = C[--c];
        break;
      case 64: {
        const a = D[s - 1];
        if (a < 0 || a > 255) return R(6);
        D[s - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[s - 1], z = D[s - 2];
        if (a < 0 || a > 255) return R(6);
        s -= 2; M[a] = z;
        break;
      }
      case 80: {
        const g = String(D[s - 1]);
        if (n + g.length > 65536) return R(11);
        s--;
        for (let h = 0; h < g.length; h++) o[n++] = g.charCodeAt(h);
        break;
      }
      case 81:
        if (n + 1 > 65536) return R(11);
        o[n++] = D[--s] & 255;
        break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return R(D[--s] & 255);
      default: {
        const b = D[s - 1], a = D[s - 2];
        let r: number;
        if (y > 18 && y < 23) {
          if (!b) return R(4);
          r = y == 19 ? a / b | 0 : y == 20 ? b == -1 ? 0 : a % b | 0 : y == 21 ? Math.floor((a >>> 0) / (b >>> 0)) | 0 : (a >>> 0) % (b >>> 0) | 0;
        } else r = F[y - 16]!(a, b);
        s -= 2; D[s++] = r;
        break;
      }
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const d of readdirSync(I).sort()) {
  const [a, e] = run(readFileSync(I + '/' + d + '/program.bin'), readFileSync(I + '/' + d + '/input.bin'));
  mkdirSync(O + '/' + d, { recursive: true });
  writeFileSync(O + '/' + d + '/stdout.bin', a);
  writeFileSync(O + '/' + d + '/exit.txt', e + '\n');
}
