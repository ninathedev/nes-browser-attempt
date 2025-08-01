import { writeRegister } from './ppu.js';

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
  addr &= 0xFFFF;

  // PPU registers
  if (addr >= 0x2000 && addr <= 0x3FFF) {
    writeRegister(0x2000 + (addr % 8), val);
    return;
  }

  memory[addr] = val & 0xFF;
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
  let result = (registers.A - value) & 0xFF;
  flags.C = registers.A >= value ? 1 : 0;
  flags.Z = result === 0 ? 1 : 0;
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

function adcAbsolute() {
  let addr = fetchWord();
  let value = readByte(addr);
  let carryIn = flags.C;
  let result = registers.A + value + carryIn;
  let overflow = (~(registers.A ^ value) & (registers.A ^ result)) & 0x80;
  flags.C = result > 0xFF ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
}

function sbcAbsolute() {
  let addr = fetchWord();
  let value = readByte(addr);
  let carryIn = flags.C;
  let result = registers.A - value - (1 - carryIn);
  let overflow = ((registers.A ^ result) & (registers.A ^ value)) & 0x80;
  flags.C = result >= 0 ? 1 : 0;
  flags.V = overflow ? 1 : 0;
  registers.A = result & 0xFF;
  updateZeroNegativeFlags(registers.A);
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
  0x20: jsr,          // JSR abs
  0xA6: ldxZeroPage,  // LDX zp
  0xAE: ldxAbsolute,  // LDX abs
  0xB6: ldyZeroPage,  // LDY zp
  0xBE: ldyAbsolute,  // LDY abs
  0x65: adcZeroPage,  // ADC zp
  0x75: adcZeroPage,  // ADC zp,X
  0x6D: adcAbsolute,  // ADC abs
  0x7D: adcAbsolute,  // ADC abs,X
  0x61: sbcZeroPage,  // SBC zp
  0x71: sbcZeroPage,  // SBC zp,Y
  0x6E: sbcAbsolute,  // SBC abs
  0x7E: sbcAbsolute,  // SBC abs,X
};




// --- CPU Step ---
let cycle = 0;

function step() {
  cycle++;
  let opcode = fetchByte();
  let instruction = instructionTable[opcode];

  /*console.log(
    `PC=${(registers.PC - 1).toString(16).padStart(4, '0')} ` +
    `OP=${opcode.toString(16).padStart(2, '0')} ` +
    `A=${registers.A.toString(16).padStart(2, '0')} ` +
    `X=${registers.X.toString(16).padStart(2, '0')} ` +
    `Y=${registers.Y.toString(16).padStart(2, '0')} ` +
    `SP=${registers.SP.toString(16).padStart(2, '0')} ` +
    `Cycle=${cycle}`
  );*/

  if (instruction) {
    instruction();
    console.log(`0x${opcode.toString(16).padStart(2, '0')} executed at PC=${(registers.PC - 1).toString(16)}`);
  } else {
    console.log(`Unknown opcode: ${opcode.toString(16).padStart(2, '0')} at PC=${(registers.PC - 1).toString(16)}`);
    running = false;
  }

  
}

/*
const testProgram = [
  0xA9, 0x10,       // LDA #$10
  0x8D, 0x00, 0x02, // STA $0200
  0xA2, 0x10,       // LDX #$10
  0xA0, 0x10,       // LDY #$10
  0xAA,             // TAX (X = A)
  0xA8,             // TAY (Y = A)
  0x8A,             // TXA (A = X)
  0x98,             // TYA (A = Y)
  0x69, 0x05,       // ADC #$05 (A += 0x05)
  0xE9, 0x02,       // SBC #$02 (A -= 0x02)
  0x29, 0x13,       // AND #$13
  0x09, 0x03,       // ORA #$03
  0x49, 0xFF,       // EOR #$FF
  0x85, 0x0C,       // STA $0C
  0xA5, 0x0C,       // LDA $0C
  0xB5, 0x0C,       // LDA $0C,X (Zero page, X=0x10)
  0x86, 0x0C,       // STX $0C
  0x87, 0x0C,       // SAX $0C
  0x18,             // CLC (Clear Carry)
  0x38,             // SEC (Set Carry)
  0xC9, 0x0C,       // CMP #$0C
  0xF0, 0x01,       // BEQ $01 (skip next NOP if equal)
  0xEA,             // NOP
  0xD0, 0x03,       // BNE $03 (if not equal, jump 3 ahead)
  0x10, 0x00,       // BPL $00 (final branch, unknown outcome)
  0x00              // BRK (break, end of program)
];



let program = ``;
// Load program into memory at $8000
for (let i = 0; i < testProgram.length; i++) {
  memory[0x8000 + i] = testProgram[i];
  program += `0x${testProgram[i].toString(16).padStart(2, '0')} `;
}

// Set reset vector to $8000
memory[0xFFFC] = 0x00;
memory[0xFFFD] = 0x80;

// --- Run Emulator ---
let running = true;
reset();
console.log(`Running program: ${program}`);

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
console.log(`Status: ${packFlags().toString(2).padStart(8, '0')}`);
console.log(`Memory[0x0200]: ${memory[0x0200]}`);
console.log(`Total cycles: ${cycle}`);
console.log("Emulation complete.");*/