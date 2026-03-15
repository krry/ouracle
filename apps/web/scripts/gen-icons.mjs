import { writeFileSync } from 'fs';
import { resolve } from 'path';

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.12}" fill="#0a0e14"/>
  <text
    x="50%" y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="${size * 0.52}"
    fill="#6fa3cf"
    letter-spacing="-1"
  >О</text>
</svg>`;

writeFileSync(resolve('static/icon-192.svg'), svg(192));
writeFileSync(resolve('static/icon-512.svg'), svg(512));
console.log('SVGs written. Convert to PNG:');
console.log('  magick static/icon-192.svg static/icon-192.png');
console.log('  magick static/icon-512.svg static/icon-512.png');
