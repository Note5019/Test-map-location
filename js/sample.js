/* สร้างภาพแปลนตัวอย่าง (SVG) สำหรับทดลองใช้งานโดยไม่ต้องมีไฟล์จริง */
window.SamplePlan = (() => {
  const W = 1600, H = 1100;
  const FONT = "Tahoma, 'Noto Sans Thai', 'Leelawadee UI', sans-serif";
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function plots(x, y, w, h, cols, rows, gap, start, special = {}) {
    const pw = (w - gap * (cols - 1)) / cols;
    const ph = (h - gap * (rows - 1)) / rows;
    let out = '', n = start;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x + c * (pw + gap), py = y + r * (ph + gap);
        const sp = special[`${r},${c}`];
        const fill = sp ? sp.fill : '#fbfbf6';
        const label = sp ? sp.label : `แปลง ${n++}`;
        out += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fill}" stroke="#7a7a72" stroke-width="2.5"/>`;
        out += `<text x="${px + pw / 2}" y="${py + ph / 2 + 8}" text-anchor="middle" font-size="23" font-weight="700" fill="#3a3a36">${esc(label)}</text>`;
      }
    }
    return { svg: out, next: n };
  }

  function frame(unitName, floor, inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#f5f5f1"/>
${inner}
<g transform="translate(1470 120)">
  <circle r="42" fill="#fff" stroke="#9e9e94" stroke-width="2"/>
  <path d="M0 -34 L12 4 L0 -4 L-12 4 Z" fill="#c62828"/>
  <path d="M0 34 L12 4 L0 -4 L-12 4 Z" fill="#9e9e94"/>
  <text y="-48" text-anchor="middle" font-size="20" font-weight="700" fill="#555">N</text>
</g>
<g transform="translate(1130 1010)">
  <rect width="440" height="70" rx="6" fill="#fff" stroke="#9e9e94" stroke-width="2"/>
  <text x="20" y="30" font-size="22" font-weight="700" fill="#333">ผังตัวอย่าง · ${esc(unitName)}</text>
  <text x="20" y="56" font-size="17" fill="#666">ชั้น ${floor} · ใช้เพื่อทดลองระบบเท่านั้น</text>
</g>
</svg>`;
  }

  function site(unitName, unitIndex) {
    let n = unitIndex * 100 + 1;
    let g = '';
    g += `<rect x="60" y="70" width="1480" height="960" fill="#e4eed6" stroke="#b5c69e" stroke-width="3"/>`;
    g += `<rect x="742" y="30" width="92" height="1040" fill="#c3c3c0"/>`;
    g += `<rect x="20" y="498" width="1560" height="84" fill="#c3c3c0"/>`;
    g += `<path d="M788 40V1060M30 540H1570" stroke="#fff" stroke-width="3" stroke-dasharray="26 22"/>`;
    g += `<text x="140" y="565" font-size="24" fill="#5f5f5a">ถนนเมน</text>`;
    let r;
    r = plots(92, 98, 620, 372, 4, 2, 18, n); g += r.svg; n = r.next;
    r = plots(864, 98, 646, 372, 4, 2, 18, n, { '0,2': { fill: '#d4e8c0', label: 'สวนส่วนกลาง' } }); g += r.svg; n = r.next;
    r = plots(92, 612, 620, 392, 4, 2, 18, n); g += r.svg; n = r.next;
    r = plots(864, 612, 646, 392, 4, 2, 18, n, { '1,3': { fill: '#e2dbef', label: 'คลับเฮาส์' } }); g += r.svg;
    g += `<g transform="translate(788 1052)"><rect x="-70" y="-8" width="140" height="34" rx="6" fill="#455a64"/><text y="16" text-anchor="middle" font-size="19" fill="#fff" font-weight="700">ทางเข้าโครงการ</text></g>`;
    return frame(unitName, 1, `<g transform="rotate(-6 800 560)">${g}</g>`);
  }

  function building(unitName, floor) {
    let g = '';
    g += `<rect x="180" y="170" width="1240" height="760" fill="#fafaf8" stroke="#4e4e4a" stroke-width="7"/>`;
    g += `<rect x="184" y="510" width="1232" height="80" fill="#ebebe6"/>`;
    g += `<text x="300" y="558" font-size="22" fill="#77776f">ทางเดิน</text>`;
    const rw = 1240 / 6;
    for (let i = 0; i < 6; i++) {
      const x = 180 + i * rw;
      g += `<rect x="${x}" y="170" width="${rw}" height="340" fill="none" stroke="#6b6b65" stroke-width="3"/>`;
      g += `<text x="${x + rw / 2}" y="350" text-anchor="middle" font-size="23" font-weight="700" fill="#3a3a36">ห้อง ${floor}${String(i + 1).padStart(2, '0')}</text>`;
      g += `<path d="M${x + rw / 2 - 30} 510 a40 40 0 0 1 40 -40" fill="none" stroke="#9a9a92" stroke-width="2"/>`;
      if (i === 2) {
        g += `<rect x="${x}" y="590" width="${rw}" height="340" fill="#e8e3d6" stroke="#6b6b65" stroke-width="3"/>`;
        g += `<text x="${x + rw / 2}" y="760" text-anchor="middle" font-size="20" fill="#5a5a52">ลิฟต์ / บันได</text>`;
        g += `<path d="M${x + 20} 900 h40 v-30 h40 v-30 h40 v-30 h40" fill="none" stroke="#9a9a92" stroke-width="3"/>`;
      } else {
        const no = i < 2 ? i + 7 : i + 6;
        g += `<rect x="${x}" y="590" width="${rw}" height="340" fill="none" stroke="#6b6b65" stroke-width="3"/>`;
        g += `<text x="${x + rw / 2}" y="770" text-anchor="middle" font-size="23" font-weight="700" fill="#3a3a36">ห้อง ${floor}${String(no).padStart(2, '0')}</text>`;
        g += `<path d="M${x + rw / 2 - 30} 590 a40 40 0 0 0 40 40" fill="none" stroke="#9a9a92" stroke-width="2"/>`;
      }
    }
    return frame(unitName, floor, `<g transform="rotate(4 800 550)">${g}</g>`);
  }

  function make(unitName, unitIndex, floor) {
    const svg = floor === 1 ? site(unitName, unitIndex) : building(unitName, floor);
    return { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), w: W, h: H };
  }

  return { make, W, H };
})();
