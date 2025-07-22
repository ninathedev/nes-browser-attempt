// ppu.js
export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
const TILE_SIZE = 8;

let chrData = new Uint8Array(0x1000);      // 4KB of pattern table
let nameTable = new Uint8Array(32 * 30);   // 960 tiles for background

// NES color palette (simplified)
const palette = [
  [84, 84, 84],    // Color 0 - gray
  [0, 30, 116],    // Color 1 - blue
  [8, 76, 156],    // Color 2 - cyan
  [48, 50, 236]    // Color 3 - violet-blue
];

// Load simulated CHR data (e.g. from cartridge or dummy pattern)
export function loadCHR(data) {
  chrData = data;
}

// Fill nametable with repeating tile indices
export function fillTestNameTable() {
  for (let i = 0; i < nameTable.length; i++) {
    nameTable[i] = i % 256;
  }
}

// Convert 8x8 tile at index to pixel data
function drawTile(p, tileIndex, x, y) {
  const base = tileIndex * 16;

  for (let row = 0; row < 8; row++) {
    const plane0 = chrData[base + row];
    const plane1 = chrData[base + row + 8];

    for (let col = 0; col < 8; col++) {
      const bit0 = (plane0 >> (7 - col)) & 1;
      const bit1 = (plane1 >> (7 - col)) & 1;
      const colorIndex = (bit1 << 1) | bit0;

      const [r, g, b] = palette[colorIndex];
      p.fill(r, g, b);
      p.noStroke();
      p.rect(x + col, y + row, 1, 1);
    }
  }
}

// Draw full background from nametable
export function drawPPU(p) {
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 32; col++) {
      const tileIndex = nameTable[row * 32 + col];
      drawTile(p, tileIndex, col * TILE_SIZE, row * TILE_SIZE);
    }
  }
}

export function writeRegister(addr, value) {
  switch (addr) {
    case 0x2000: // PPUCTRL
      // Set PPUCTRL flags
      // e.g., name table base, NMI enable
      break;

    case 0x2001: // PPUMASK
      // Set rendering flags (greyscale, show bg/sprites)
      break;

    case 0x2003: // OAMADDR
      // Set the address for sprite RAM
      break;

    case 0x2004: // OAMDATA
      // Write to sprite RAM at OAMADDR
      break;

    case 0x2005: // PPUSCROLL
      // Handle scroll x/y writes
      break;

    case 0x2006: // PPUADDR
      // Handle high/low address write toggle
      break;

    case 0x2007: // PPUDATA
      // Write to PPU memory (VRAM) at internal address
      break;

    default:
      console.warn(`Unhandled PPU register write: ${addr.toString(16)}`);
  }
}