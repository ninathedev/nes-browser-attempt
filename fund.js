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
  // No operation, does nothing
  // This is a placeholder for NOP instruction
}

function staZeroPage() {
  let addr = fetchByte(); // Just one byte for zero-page address
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

  // Overflow detection (signed)
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
    if (offset & 0x80) offset = offset - 0x100; // signed conversion
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

function incZeroPage() {
  const addr = fetchByte();
  const result = (readByte(addr) + 1) & 0xFF;
  writeByte(addr, result);
  updateZeroNegativeFlags(result);
}

function decZeroPage() {
  const addr = fetchByte();
  const result = (readByte(addr) - 1) & 0xFF;
  writeByte(addr, result);
  updateZeroNegativeFlags(result);
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


function clc() { flags.C = 0; }
function sec() { flags.C = 1; }

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
  0xE6: incZeroPage,
  0xC6: decZeroPage,
  0x8A: txa,
  0x98: tya,
  0xAA: tax,
  0xA8: tay,

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

let testProgram = [
  0xA9, 0x0F,       // LDA #$0F
  0xAA,             // TAX (A -> X)
  0xA8,             // TAY (A -> Y)
  0x18,             // CLC (clear carry)
  0x69, 0x01,       // ADC #$01 => A = 0F + 01 = 10
  0x29, 0xF0,       // AND #$F0 => A = 10 & F0 = 10
  0x09, 0x0F,       // ORA #$0F => A = 10 | 0F = 1F
  0x49, 0xFF,       // EOR #$FF => A = 1F ^ FF = E0
  0x0A,             // ASL A => A <<= 1 => C = 1, A = C0
  0x4A,             // LSR A => A >>= 1 => C = 0, A = 60
  0x2A,             // ROL A => A = (A << 1 | C) => A = C0, C = 0
  0x6A,             // ROR A => A = (A >> 1 | C << 7)
  0x85, 0x10,       // STA $10 (store A)
  0x86, 0x11,       // STX $11 (store X)
  0x87, 0x12,       // STY $12 (store Y)
  0xE6, 0x11,       // INC $11 => X+1
  0xC6, 0x12,       // DEC $12 => Y-1
  0xA9, 0x01,       // LDA #$01
  0xC9, 0x01,       // CMP #$01 => sets Z=1
  0xF0, 0x02,       // BEQ skip next
  0xA9, 0xFF,       // (skipped if equal)
  0x85, 0x20,       // STA $20
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
console.log("\n--- Test Program Results ---");
console.log("memory[0x10] (final A):", memory[0x10].toString(16).padStart(2, '0'));
console.log("memory[0x11] (X after INC):", memory[0x11].toString(16).padStart(2, '0'));
console.log("memory[0x12] (Y after DEC):", memory[0x12].toString(16).padStart(2, '0'));
console.log("memory[0x20] (BEQ test passed):", memory[0x20].toString(16).padStart(2, '0'));
console.log(`Final Flags: Z=${flags.Z} N=${flags.N} C=${flags.C} V=${flags.V}`);
console.log(`Final A=${registers.A.toString(16)} X=${registers.X.toString(16)} Y=${registers.Y.toString(16)}`);

console.log(`Total cycles done: ${cycle}`);