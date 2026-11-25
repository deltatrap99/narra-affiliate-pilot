import { number } from './model.js';

export function mountChart(points) {
  const canvas = document.querySelector('#trend');
  if (!canvas) return () => {};
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const tooltip = document.querySelector('#chart-tip');
  const readout = document.querySelector('#chart-readout');
  const series = [
    ['l0', 'L0 hợp lệ', '#7141d6'],
    ['free', 'Free', '#a681e8'],
    ['plus', 'Plus', '#739542'],
  ];
  const maximum = Math.max(4, ...points.map(point => point.l0));
  const step = Math.ceil(maximum / 4);
  const upper = step * 4;
  let hover = -1;
  let xAt = () => 0;
  let scheduled = 0;

  function plot() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);
    const left = width < 360 ? 33 : 39;
    const top = 13;
    const right = width - 17;
    const bottom = height - 27;
    const text = '#786b85';
    xAt = index => points.length === 1 ? (left + right) / 2 : left + index * (right - left) / (points.length - 1);
    const yAt = value => bottom - (value / upper) * (bottom - top);
    context.font = "11px 'Be Vietnam Pro', sans-serif";
    context.lineWidth = 1;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (let tick = 0; tick <= 4; tick++) {
      const y = yAt(step * tick);
      context.strokeStyle = '#eee8f3';
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
      context.fillStyle = text;
      const value = tick * step;
      context.fillText(value > 999 ? (value / 1000).toFixed(1) + 'k' : String(value), left - 7, y);
    }
    context.textAlign = 'center';
    const maxLabels = Math.max(2, Math.floor((right - left) / 69));
    const every = Math.max(1, Math.ceil((points.length - 1) / maxLabels));
    points.forEach((point, index) => {
      if (index === points.length - 1 || (index % every === 0 && points.length - 1 - index >= every / 2)) {
        context.fillText(point.label, xAt(index), height - 11);
      }
    });

    for (const [key, , color] of series) {
      const coords = points.map((point, index) => [xAt(index), yAt(point[key])]);
      if (!coords.length) continue;
      const line = () => {
        context.beginPath();
        context.moveTo(...coords[0]);
        for (let i = 1; i < coords.length; i++) {
          const [px, py] = coords[i - 1];
          const [x, y] = coords[i];
          const middle = (px + x) / 2;
          context.bezierCurveTo(middle, py, middle, y, x, y);
        }
      };
      if (key === 'l0' && coords.length > 1) {
        const fill = context.createLinearGradient(0, top, 0, bottom);
        fill.addColorStop(0, '#9e75ea40');
        fill.addColorStop(1, '#ab81ed04');
        line();
        context.lineTo(coords.at(-1)[0], bottom);
        context.lineTo(coords[0][0], bottom);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      }
      line();
      context.strokeStyle = color;
      context.lineWidth = 2.15;
      context.stroke();
      if (coords.length <= 8 || hover >= 0) {
        const visible = coords.length <= 8 ? coords : [coords[hover]];
        for (const [x, y] of visible) {
          context.beginPath();
          context.arc(x, y, 3.45, 0, Math.PI * 2);
          context.fillStyle = '#fff';
          context.fill();
          context.stroke();
        }
      }
    }
    if (hover >= 0) {
      const x = xAt(hover);
      const point = points[hover];
      context.beginPath();
      context.strokeStyle = '#bea6df';
      context.lineWidth = 1;
      context.setLineDash([3, 4]);
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.stroke();
      context.setLineDash([]);
      tooltip.hidden = false;
      tooltip.style.left = Math.max(2, Math.min(x + 10, width - 151)) + 'px';
      tooltip.innerHTML = `<strong>${point.span}</strong>${series.map(([key, name]) => `<span>${name} · ${number(point[key])}</span>`).join('')}`;
    } else {
      tooltip.hidden = true;
    }
  }

  const schedule = () => {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => { scheduled = 0; plot(); });
  };

  function select(index, announce = false) {
    const next = Math.max(-1, Math.min(index, points.length - 1));
    if (hover === next) return;
    hover = next;
    if (announce && hover >= 0) {
      const point = points[hover];
      readout.textContent = `${point.span}. ${series.map(([key, name]) => name + ' ' + number(point[key])).join(', ')}.`;
    }
    schedule();
  }

  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const x = event.offsetX;
    const index = points.reduce((best, _, i) => Math.abs(x - xAt(i)) < Math.abs(x - xAt(best)) ? i : best, 0);
    select(index);
  });
  canvas.addEventListener('pointerleave', () => select(-1));
  canvas.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch') return;
    const x = event.offsetX;
    const index = points.reduce((best, _, i) => Math.abs(x - xAt(i)) < Math.abs(x - xAt(best)) ? i : best, 0);
    select(hover === index ? -1 : index);
  });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 :
      Math.max(0, hover + (event.key === 'ArrowLeft' ? -1 : 1));
    select(index, true);
  });
  canvas.addEventListener('blur', () => select(-1));
  const watcher = new ResizeObserver(schedule);
  watcher.observe(canvas);
  document.fonts.ready.then(() => { if (canvas.isConnected) schedule(); });
  schedule();
  return () => {
    watcher.disconnect();
    if (scheduled) cancelAnimationFrame(scheduled);
  };
}
