// --- 64KB Memory ---
const MEMORY_SIZE = 0x10000;
let memory = new Uint8Array(MEMORY_SIZE);

// --- CPU Registers ---
let registers = {
  A: 0x00,   // Accumulator
  X: 0x00,   // X register
  Y: 0x00,   // Y register
  SP: 0xFD,  // Stack Pointer
  PC: 0x8000,// Program Counter
  P: 0x24    // Status flags (packed byte)
};

// --- Status Flags (NV-BDIZC) ---
let flags = {
  N: 0,  // Negative
  V: 0,  // Overflow
  B: 0,  // Break
  D: 0,  // Decimal (unused)
  I: 1,  // Interrupt Disable
  Z: 0,  // Zero
  C: 0   // Carry
};

// --- Memory Helpers ---
function fetchByte() {
  let byte = memory[registers.PC];
  registers.PC = (registers.PC + 1) & 0xFFFF;
  return byte;
}

function fetchWord() {
  let lo = fetchByte();
  let hi = fetchByte();
  return (hi << 8) | lo;
}

function fetchSignedByte() {
  const value = fetchByte();
  return value < 0x80 ? value : value - 0x100;
}

function readByte(addr) {
  return memory[addr & 0xFFFF];
}

function writeByte(addr, val) {
  memory[addr & 0xFFFF] = val & 0xFF;
}

function updateZeroNegativeFlags(value) {
  flags.Z = value === 0 ? 1 : 0;
  flags.N = (value & 0x80) ? 1 : 0;
}

// --- Stack Helpers ---
function pushByte(value) {
  writeByte(0x0100 + registers.SP, value);
  registers.SP = (registers.SP - 1) & 0xFF;
}

function pullByte() {
  registers.SP = (registers.SP + 1) & 0xFF;
  return readByte(0x0100 + registers.SP);
}

function pushWord(value) {
  pushByte((value >> 8) & 0xFF);
  pushByte(value & 0xFF);
}

function pullWord() {
  let lo = pullByte();
  let hi = pullByte();
  return (hi << 8) | lo;
}

// --- Flag Helpers ---
function packFlags() {
  return (flags.N << 7) | (flags.V << 6) | (1 << 5) | (flags.B << 4) |
    (flags.D << 3) | (flags.I << 2) | (flags.Z << 1) | flags.C;
}

function unpackFlags(p) {
  flags.N = (p >> 7) & 1;
  flags.V = (p >> 6) & 1;
  flags.B = (p >> 4) & 1;
  flags.D = (p >> 3) & 1;
  flags.I = (p >> 2) & 1;
  flags.Z = (p >> 1) & 1;
  flags.C = p & 1;
}

// --- Reset CPU ---
function reset() {
  registers.SP = 0xFD;
  registers.P = 0x24;
  registers.PC = (memory[0xFFFD] << 8) | memory[0xFFFC];
}

// --- Instruction Implementations ---
function ldaImmediate() {
  let value = fetchByte();
  registers.A = value;
  updateZeroNegativeFlags(registers.A);
}

function ldxImmediate() {
  let value = fetchByte();
  registers.X = value;
  updateZeroNegativeFlags(registers.X);
}

function ldyImmediate() {
  let value = fetchByte();
  registers.Y = value;
  updateZeroNegativeFlags(registers.Y);
}

function staAbsolute() {
  let addr = fetchWord();
  writeByte(addr, registers.A);
}

function brk() {
  console.log("BRK reached. Halting.");
  running = false;
}

function inx() {
  registers.X = (registers.X + 1) & 0xFF;
  updateZeroNegativeFlags(registers.X);
}

function iny() {
  registers.Y = (registers.Y + 1) & 0xFF;
  updateZeroNegativeFlags(registers.Y);
}

function dex() {
  registers.X = (registers.X - 1) & 0xFF;
  updateZeroNegativeFlags(registers.X);
}

function dey() {
  registers.Y = (registers.Y - 1) & 0xFF;
  updateZeroNegativeFlags(registers.Y);
}

function jmpAbsolute() {
  let addr = fetchWord();
  registers.PC = addr;
}

function nop() {
  // No operation
}

function staZeroPage() {
  let addr = fetchByte();
  writeByte(addr, registers.A);
}

function stxZeroPage() {
  let addr = fetchByte();
  writeByte(addr, registers.X);
}

function styZeroPage() {
  let addr = fetchByte();
  writeByte(addr, registers.Y);
}

function adcImmediate() {
  let value = fetchByte();
  let carryIn = flags.C;
  let result = registers.A + value + carryIn;
  let overflow = (~(registers.A ^ value) & (registers.A ^ result)) & 0x80;
  flags.C = result > 0xFF ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function sbcImmediate() {
  let value = fetchByte();
  let carryIn = flags.C;
  let result = registers.A - value - (1 - carryIn);
  let overflow = ((registers.A ^ result) & (registers.A ^ value)) & 0x80;
  flags.C = result >= 0 ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function andImmediate() {
  let value = fetchByte();
  registers.A = registers.A & value;
  updateZeroNegativeFlags(registers.A);
}

function oraImmediate() {
  let value = fetchByte();
  registers.A = registers.A | value;
  updateZeroNegativeFlags(registers.A);
}

function eorImmediate() {
  let value = fetchByte();
  registers.A = registers.A ^ value;
  updateZeroNegativeFlags(registers.A);
}

function cmpImmediate() {
  let value = fetchByte();
  let result = registers.A - value;
  flags.C = registers.A >= value ? 1 : 0;
  flags.Z = (result & 0xFF) === 0 ? 1 : 0;
  flags.N = (result & 0x80) ? 1 : 0;
}

function bne() {
  let offset = fetchByte();
  if (flags.Z === 0) {
    if (offset & 0x80) offset = offset - 0x100;
    registers.PC = (registers.PC + offset) & 0xFFFF;
  }
}

function beq() {
  let offset = fetchByte();
  if (flags.Z === 1) {
    if (offset & 0x80) offset = offset - 0x100;
    registers.PC = (registers.PC + offset) & 0xFFFF;
  }
}

function incZeroPage() {
  let addr = fetchByte();
  let value = (readByte(addr) + 1) & 0xFF;
  writeByte(addr, value);
  updateZeroNegativeFlags(value);
}

function decZeroPage() {
  let addr = fetchByte();
  let value = (readByte(addr) - 1) & 0xFF;
  writeByte(addr, value);
  updateZeroNegativeFlags(value);
}

function aslAccumulator() {
  flags.C = (registers.A >> 7) & 1;
  registers.A = (registers.A << 1) & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function lsrAccumulator() {
  flags.C = registers.A & 1;
  registers.A = (registers.A >> 1) & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function rolAccumulator() {
  let newCarry = (registers.A >> 7) & 1;
  registers.A = ((registers.A << 1) | flags.C) & 0xFF;
  flags.C = newCarry;
  updateZeroNegativeFlags(registers.A);
}

function rorAccumulator() {
  let newCarry = registers.A & 1;
  registers.A = ((registers.A >> 1) | (flags.C << 7)) & 0xFF;
  flags.C = newCarry;
  updateZeroNegativeFlags(registers.A);
}

function txa() {
  registers.A = registers.X;
  updateZeroNegativeFlags(registers.A);
}

function tya() {
  registers.A = registers.Y;
  updateZeroNegativeFlags(registers.A);
}

function tax() {
  registers.X = registers.A;
  updateZeroNegativeFlags(registers.X);
}

function tay() {
  registers.Y = registers.A;
  updateZeroNegativeFlags(registers.Y);
}

function ldaZeroPage() {
  let addr = fetchByte();
  registers.A = readByte(addr);
  updateZeroNegativeFlags(registers.A);
}

function ldaAbsolute() {
  let addr = fetchWord();
  registers.A = readByte(addr);
  updateZeroNegativeFlags(registers.A);
}

function ldxZeroPage() {
  let addr = fetchByte();
  registers.X = readByte(addr);
  updateZeroNegativeFlags(registers.X);
}

function ldxAbsolute() {
  let addr = fetchWord();
  registers.X = readByte(addr);
  updateZeroNegativeFlags(registers.X);
}

function ldyZeroPage() {
  let addr = fetchByte();
  registers.Y = readByte(addr);
  updateZeroNegativeFlags(registers.Y);
}

function ldyAbsolute() {
  let addr = fetchWord();
  registers.Y = readByte(addr);
  updateZeroNegativeFlags(registers.Y);
}

function staAbsoluteX() {
  let base = fetchWord();
  let addr = (base + registers.X) & 0xFFFF;
  writeByte(addr, registers.A);
}

function adcZeroPage() {
  let addr = fetchByte();
  let value = readByte(addr);
  let carryIn = flags.C;
  let result = registers.A + value + carryIn;
  let overflow = (~(registers.A ^ value) & (registers.A ^ result)) & 0x80;
  flags.C = result > 0xFF ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function sbcZeroPage() {
  let addr = fetchByte();
  let value = readByte(addr);
  let carryIn = flags.C;
  let result = registers.A - value - (1 - carryIn);
  let overflow = ((registers.A ^ result) & (registers.A ^ value)) & 0x80;
  flags.C = result >= 0 ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function pha() {
  pushByte(registers.A);
}

function pla() {
  registers.A = pullByte();
  updateZeroNegativeFlags(registers.A);
}

function php() {
  pushByte(packFlags() | 0x10);
}

function plp() {
  unpackFlags(pullByte());
}

function jsr() {
  let addr = fetchWord();
  pushWord(registers.PC - 1);
  registers.PC = addr;
}

function rts() {
  registers.PC = (pullWord() + 1) & 0xFFFF;
}

function bitZeroPage() {
  let addr = fetchByte();
  let val = readByte(addr);
  flags.Z = (registers.A & val) === 0 ? 1 : 0;
  flags.N = (val & 0x80) ? 1 : 0;
  flags.V = (val & 0x40) ? 1 : 0;
}

function ldaZeroPageX() {
  let base = fetchByte();
  let addr = (base + registers.X) & 0xFF;
  registers.A = readByte(addr);
  updateZeroNegativeFlags(registers.A);
}

function aslZeroPage() {
  let addr = fetchByte();
  let value = readByte(addr);
  flags.C = (value >> 7) & 1;
  let result = (value << 1) & 0xFF;
  writeByte(addr, result);
  updateZeroNegativeFlags(result);
}

function lsrZeroPage() {
  let addr = fetchByte();
  let value = readByte(addr);
  flags.C = value & 1;
  let result = (value >> 1) & 0xFF;
  writeByte(addr, result);
  updateZeroNegativeFlags(result);
}

function txs() {
  registers.SP = registers.X;
}

function bpl() {
  const offset = fetchSignedByte();
  if (flags.N === 0) {
    registers.PC = (registers.PC + offset) & 0xFFFF;
  }
}


function sec() { flags.C = 1; }
function sed() { flags.D = 1; }
function sei() { flags.I = 1; }
function cld() { flags.D = 0; }
function cli() { flags.I = 0; }
function clv() { flags.V = 0; }
function clc() { flags.C = 0; }

// --- Opcode Table ---
const instructionTable = {
  0xA9: ldaImmediate, // LDA #imm
  0x8D: staAbsolute,  // STA abs
  0x00: brk,          // BRK
  0xE8: inx,          // INX
  0xC8: iny,          // INY
  0xCA: dex,          // DEX
  0x88: dey,          // DEY
  0x4C: jmpAbsolute,  // JMP abs
  0xEA: nop,          // NOP
  0xA2: ldxImmediate, // LDX #imm
  0xA0: ldyImmediate, // LDY #imm
  0x85: staZeroPage,  // STA zp
  0x86: stxZeroPage,  // STX zp
  0x87: styZeroPage,  // STY zp
  0x69: adcImmediate, // ADC #imm
  0xE9: sbcImmediate, // SBC #imm
  0x29: andImmediate, // AND #imm
  0x09: oraImmediate, // ORA #imm
  0x49: eorImmediate, // EOR #imm
  0x18: clc,          // CLC
  0xC9: cmpImmediate, // CMP #imm
  0xD0: bne,          // BNE rel
  0xF0: beq,          // BEQ rel
  0xE6: incZeroPage,  // INC zp
  0xC6: decZeroPage,  // DEC zp
  0x0A: aslAccumulator,
  0x4A: lsrAccumulator,
  0x2A: rolAccumulator,
  0x6A: rorAccumulator,
  0x8A: txa,
  0x98: tya,
  0xAA: tax,
  0xA8: tay,
  0xA5: ldaZeroPage,  // LDA zp
  0xAD: ldaAbsolute,  // LDA abs
  0xB5: ldaZeroPageX, // LDA zp,X
  0xBD: staAbsoluteX, // STA abs,X
  0x06: aslZeroPage,  // ASL zp
  0x46: lsrZeroPage,  // LSR zp
  0x9A: txs,          // TXS
  0x60: rts,          // RTS 
  0x48: pha,          // PHA
  0x68: pla,          // PLA
  0x08: php,          // PHP
  0x28: plp,          // PLP
  0x24: bitZeroPage,  // BIT zp
  0x38: sec,          // SEC
  0xF8: sed,          // SED
  0xD8: cld,          // CLD
  0x78: sei,          // SEI
  0x58: cli,          // CLI
  0xB8: clv,          // CLV
  0x10: bpl,          // BPL rel
};




// --- CPU Step ---
let cycle = 0;

function step() {
  cycle++;
  let opcode = fetchByte();
  let instruction = instructionTable[opcode];

  console.log(
    `PC=${(registers.PC - 1).toString(16).padStart(4, '0')} ` +
    `OP=${opcode.toString(16).padStart(2, '0')} ` +
    `A=${registers.A.toString(16).padStart(2, '0')} ` +
    `X=${registers.X.toString(16).padStart(2, '0')} ` +
    `Y=${registers.Y.toString(16).padStart(2, '0')} ` +
    `SP=${registers.SP.toString(16).padStart(2, '0')} ` +
    `Cycle=${cycle}`
  );

  if (instruction) {
    instruction();
  } else {
    console.log(`Unknown opcode: ${opcode.toString(16)} at PC=${(registers.PC - 1).toString(16)}`);
    running = false;
  }
}

const testProgram = [
  0xA9, 0x10,       // LDA #$10
  0x8D, 0x00, 0x02, // STA $0200

  0xA2, 0x05,       // LDX #$05
  0xA0, 0x03,       // LDY #$03

  0xAA,             // TAX (A -> X)
  0xA8,             // TAY (A -> Y)
  0x8A,             // TXA (X -> A)
  0x98,             // TYA (Y -> A)

  0x69, 0x05,       // ADC #$05
  0xE9, 0x01,       // SBC #$01
  0x29, 0x0F,       // AND #$0F
  0x09, 0xF0,       // ORA #$F0
  0x49, 0xFF,       // EOR #$FF

  0x85, 0x10,       // STA $0010
  0xA5, 0x10,       // LDA $0010

  0xB5, 0x00,       // LDA $00,X
  0x86, 0x11,       // STX $11
  0x87, 0x12,       // STY $12

  0x18,             // CLC
  0x38,             // SEC

  0xC9, 0x0F,       // CMP #$0F
  0xF0, 0x02,       // BEQ skip1
  0xEA,             // NOP
  0xD0, 0x02,       // BNE skip2
  0xEA,             // NOP

  0xE6, 0x10,       // INC $10
  0xC6, 0x10,       // DEC $10

  0x0A,             // ASL A
  0x4A,             // LSR A
  0x2A,             // ROL A
  0x6A,             // ROR A

  0x06, 0x10,       // ASL $10
  0x46, 0x10,       // LSR $10

  0x9A,             // TXS

  0x48,             // PHA
  0x68,             // PLA
  0x08,             // PHP
  0x28,             // PLP

  0x24, 0x10,       // BIT $10

  0xF8,             // SED
  0xD8,             // CLD
  0x78,             // SEI
  0x58,             // CLI
  0xB8,             // CLV

  0x60,             // RTS

  0x00              // BRK
];



// Load program into memory at $8000
for (let i = 0; i < testProgram.length; i++) {
  memory[0x8000 + i] = testProgram[i];
}

// Set reset vector to $8000
memory[0xFFFC] = 0x00;
memory[0xFFFD] = 0x80;

// --- Run Emulator ---
let running = true;
reset();

while (running) {
  step();
}
const A = registers.A;
const X = registers.X;
const Y = registers.Y;
const SP = registers.SP;

console.log(`A: ${A}`);
console.log(`X: ${X}`);
console.log(`Y: ${Y}`);
console.log(`SP: ${SP}`);
console.log(`Status: ${status.toString(2).padStart(8, '0')}`);
console.log(`Memory[0x0200]: ${memory[0x0200]}`);
console.log(`Total cycles: ${cycle}`);
console.log("Emulation complete.");