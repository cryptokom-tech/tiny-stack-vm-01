import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

// Tiny stack VM for make.fun's ISA v1: one run answers every instance.

const STEP_MAX = 1000000;
const OUT_MAX = 65536;
const STACK_CAP = 256;
const CALL_CAP = 64;
const MEM_WORDS = 256;

// Per opcode byte: [immediate bytes, values popped, values pushed].
const META = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0],
  4: [0, 1, 2], 5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3],
  16: [0, 2, 1], 17: [0, 2, 1], 18: [0, 2, 1], 19: [0, 2, 1],
  20: [0, 2, 1], 21: [0, 2, 1], 22: [0, 2, 1], 23: [0, 1, 1],
  24: [0, 2, 1], 25: [0, 2, 1], 26: [0, 2, 1], 27: [0, 1, 1],
  28: [0, 2, 1], 29: [0, 2, 1], 30: [0, 2, 1], 32: [0, 2, 1],
  33: [0, 2, 1], 34: [0, 2, 1], 48: [2, 0, 0], 49: [2, 1, 0],
  50: [2, 1, 0], 51: [2, 0, 0], 52: [0, 0, 0], 64: [0, 1, 1],
  65: [0, 2, 0], 80: [0, 1, 0], 81: [0, 1, 0], 82: [0, 0, 1],
  83: [0, 1, 0],
};

// Two-operand arithmetic. Returns null only for division by zero,
// which the caller turns into trap 4.
function binop(op, a, b) {
  switch (op) {
    case 16: return (a + b) | 0;
    case 17: return (a - b) | 0;
    case 18: return Math.imul(a, b);
    case 19:
      if (b === 0) return null;
      return (a / b) | 0;
    case 20:
      if (b === 0) return null;
      return b === -1 ? 0 : (a % b) | 0;
    case 21:
      if (b === 0) return null;
      return Math.floor((a >>> 0) / (b >>> 0)) | 0;
    case 22:
      if (b === 0) return null;
      return ((a >>> 0) % (b >>> 0)) | 0;
    case 24: return a & b;
    case 25: return a | b;
    case 26: return a ^ b;
    case 28: return a << (b & 31);
    case 29: return a >> (b & 31);
    case 30: return (a >>> (b & 31)) | 0;
    case 32: return a === b ? 1 : 0;
    case 33: return a < b ? 1 : 0;
    default: return (a >>> 0) < (b >>> 0) ? 1 : 0;
  }
}

// Runs one program on its input bytes; returns [output bytes, exit code].
function execute(prog, input) {
  const code = prog;
  const size = code.length;
  const stack = new Int32Array(STACK_CAP);
  const calls = new Int32Array(CALL_CAP);
  const mem = new Int32Array(MEM_WORDS);
  const output = new Uint8Array(OUT_MAX);
  let sp = 0;
  let cp = 0;
  let pc = 0;
  let steps = 0;
  let used = 0;
  let read = 0;
  const finish = (exitCode) => [output.slice(0, used), exitCode];

  for (;;) {
    if (steps === STEP_MAX) return finish(10);
    if (pc < 0 || pc >= size) return finish(9);
    const op = code[pc];
    const meta = META[op];
    if (meta === undefined) return finish(5);
    const imm = meta[0];
    if (pc + imm >= size) return finish(9);
    steps += 1;
    const after = pc + 1 + imm;
    if (sp < meta[1]) return finish(2);
    if (sp - meta[1] + meta[2] > STACK_CAP) return finish(3);
    pc = after;

    switch (op) {
      case 0:
        return finish(0);
      case 1:
        stack[sp++] = (code[after - 1] << 24) >> 24;
        break;
      case 2:
        stack[sp++] = code[after - 4] | (code[after - 3] << 8) | (code[after - 2] << 16) | (code[after - 1] << 24);
        break;
      case 3:
        sp -= 1;
        break;
      case 4:
        stack[sp] = stack[sp - 1];
        sp += 1;
        break;
      case 5: {
        const t = stack[sp - 1];
        stack[sp - 1] = stack[sp - 2];
        stack[sp - 2] = t;
        break;
      }
      case 6:
        stack[sp] = stack[sp - 2];
        sp += 1;
        break;
      case 7: {
        const a = stack[sp - 3];
        stack[sp - 3] = stack[sp - 2];
        stack[sp - 2] = stack[sp - 1];
        stack[sp - 1] = a;
        break;
      }
      case 23:
        stack[sp - 1] = (-stack[sp - 1]) | 0;
        break;
      case 27:
        stack[sp - 1] = ~stack[sp - 1];
        break;
      case 48:
      case 49:
      case 50: {
        const rel = ((code[after - 2] | (code[after - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 48) {
          const v = stack[--sp];
          take = op === 49 ? v === 0 : v !== 0;
        }
        if (take) pc = after + rel;
        break;
      }
      case 51:
        if (cp === CALL_CAP) return finish(7);
        calls[cp++] = after;
        pc = code[after - 2] | (code[after - 1] << 8);
        break;
      case 52:
        if (cp === 0) return finish(8);
        pc = calls[--cp];
        break;
      case 64: {
        const addr = stack[sp - 1];
        if (addr < 0 || addr >= MEM_WORDS) return finish(6);
        stack[sp - 1] = mem[addr];
        break;
      }
      case 65: {
        const addr = stack[sp - 1];
        const val = stack[sp - 2];
        if (addr < 0 || addr >= MEM_WORDS) return finish(6);
        sp -= 2;
        mem[addr] = val;
        break;
      }
      case 80: {
        const text = String(stack[sp - 1]);
        if (used + text.length > OUT_MAX) return finish(11);
        sp -= 1;
        for (let j = 0; j < text.length; j += 1) output[used++] = text.charCodeAt(j);
        break;
      }
      case 81:
        if (used + 1 > OUT_MAX) return finish(11);
        output[used++] = stack[--sp] & 255;
        break;
      case 82:
        stack[sp++] = read < input.length ? input[read++] : -1;
        break;
      case 83:
        return finish(stack[--sp] & 255);
      default: {
        const b = stack[sp - 1];
        const a = stack[sp - 2];
        const r = binop(op, a, b);
        if (r === null) return finish(4);
        sp -= 2;
        stack[sp++] = r;
        break;
      }
    }
  }
}

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(inDir).sort()) {
  const [bytes, exitCode] = execute(
    readFileSync(inDir + '/' + id + '/program.bin'),
    readFileSync(inDir + '/' + id + '/input.bin'),
  );
  mkdirSync(outDir + '/' + id, { recursive: true });
  writeFileSync(outDir + '/' + id + '/stdout.bin', bytes);
  writeFileSync(outDir + '/' + id + '/exit.txt', exitCode + '\n');
}
