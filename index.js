// main.js
import * as PPU from './ppu.js';

let p;

window.setup = function () {
  p = this;
  createCanvas(PPU.SCREEN_WIDTH, PPU.SCREEN_HEIGHT);
  noSmooth();

  // Dummy CHR data (diagonal pattern)
  const dummyCHR = new Uint8Array(0x1000);
  for (let i = 0; i < 256; i++) {
    const base = i * 16;
    for (let j = 0; j < 8; j++) {
      dummyCHR[base + j] = 0b10101010;       // Bitplane 0
      dummyCHR[base + j + 8] = 0b01010101;   // Bitplane 1
    }
  }

  PPU.loadCHR(dummyCHR);
  PPU.fillTestNameTable();
}

window.draw = function () {
  PPU.drawPPU(p);
}
