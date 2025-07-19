// ppu.js

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;

let patternTable = new Uint8Array(0x1000); // Dummy CHR ROM data (4 KB)
export let nameTable = new Uint8Array(960); // 32 x 30 tile map

const NES_PALETTE = [
  [124, 124, 124], [0, 0, 252], [0, 0, 188], [68, 40, 188],
  [148, 0, 132], [168, 0, 32], [168, 16, 0], [136, 20, 0],
  [80, 48, 0], [0, 120, 0], [0, 104, 0], [0, 88, 0],
  [0, 64, 88], [0, 0, 0], [0, 0, 0], [0, 0, 0]
];

export function loadCHR(data) {
  patternTable.set(data.slice(0x0000, 0x1000));
}

export function fillTestNameTable() {
  for (let i = 0; i < nameTable.length; i++) {
    nameTable[i] = i % 256;
  }
}

export function drawPPU(p) {
  p.background(255);
  drawScreen(p);
}

function drawScreen(p) {
  const tileSize = 8;
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 32; col++) {
      const tileIndex = nameTable[row * 32 + col];
      drawTile(p, tileIndex, col * tileSize, row * tileSize);
    }
  }
}

function drawTile(p, index, x, y) {
  const tileAddr = index * 16;
  for (let row = 0; row < 8; row++) {
    const lowByte = patternTable[tileAddr + row];
    const highByte = patternTable[tileAddr + row + 8];
    for (let col = 0; col < 8; col++) {
      const bit0 = (lowByte >> (7 - col)) & 1;
      const bit1 = (highByte >> (7 - col)) & 1;
      const colorIndex = (bit1 << 1) | bit0;
      const color = NES_PALETTE[colorIndex];

      p.fill(...color);
      p.noStroke();
      p.rect(x + col, y + row, 1, 1);
    }
  }
}
