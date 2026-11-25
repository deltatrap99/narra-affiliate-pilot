import { number } from './model.js';

function sizeCanvas(canvas, context) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { width, height };
}

function drawSparkline(canvas, context, points) {
  if (!context || !canvas.clientWidth) return;
  const values = points.map(point => point[canvas.dataset.metric]);
  const { width, height } = sizeCanvas(canvas, context);
  const spread = Math.max(...values) - Math.min(...values);
  const low = Math.min(...values);
  const color = window.getComputedStyle(canvas).getPropertyValue('--kpi-ink').trim();
  context.beginPath();
  values.forEach((value, index) => {
    const x = values.length > 1 ? 1 + (width - 2) * index / (values.length - 1) : width / 2;
    const y = spread ? height - 3 - (value - low) / spread * (height - 6) : height / 2;
    if (index) context.lineTo(x, y);
    else context.moveTo(x, y);
  });
  context.lineWidth = 1.45;
  context.strokeStyle = color;
  context.globalAlpha = .42;
  context.stroke();
  context.globalAlpha = 1;
}

export function mountChart(points) {
  const canvas = document.querySelector('#trend');
  if (!canvas) return () => {};
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const tooltip = document.querySelector('#chart-tip');
  const readout = document.querySelector('#chart-readout');
  const series = [
    ['l0', 'L0 hợp lệ'],
    ['free', 'Free'],
    ['plus', 'Plus'],
  ];
  const maximum = Math.max(4, ...points.flatMap(point => series.map(([key]) => point[key])));
  const baseStep = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = Math.max(1, baseStep * [1, 2, 2.5, 5, 10].find(value => value >= maximum / (4 * baseStep)));
  const upper = step * 4;
  const sparklines = [...document.querySelectorAll('.kpi-spark')]
    .map(element => [element, element.getContext('2d')]);
  let hover = -1;
  let xAt = () => 0;
  let scheduled = 0;

  function plot() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const { width, height } = sizeCanvas(canvas, context);
    const style = window.getComputedStyle(canvas);
    const color = property => style.getPropertyValue(property).trim();
    const left = width < 360 ? 33 : 39;
    const top = 13;
    const right = width - 17;
    const bottom = height - 27;
    const text = color('--soft');
    xAt = index => points.length === 1 ? (left + right) / 2 : left + index * (right - left) / (points.length - 1);
    const yAt = value => bottom - (value / upper) * (bottom - top);
    context.font = "11px 'Be Vietnam Pro', sans-serif";
    context.lineWidth = 1;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    for (let tick = 0; tick <= 4; tick++) {
      const y = yAt(step * tick);
      context.strokeStyle = color('--line');
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

    for (const [key] of series) {
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
        fill.addColorStop(0, color('--chart-fill'));
        fill.addColorStop(1, 'transparent');
        line();
        context.lineTo(coords.at(-1)[0], bottom);
        context.lineTo(coords[0][0], bottom);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      }
      line();
      context.strokeStyle = color('--chart-' + key);
      context.lineWidth = 2.15;
      context.stroke();
      if (coords.length <= 8 || hover >= 0) {
        const visible = coords.length <= 8 ? coords : [coords[hover]];
        for (const [x, y] of visible) {
          context.beginPath();
          context.arc(x, y, 3.45, 0, Math.PI * 2);
          context.fillStyle = color('--paper');
          context.fill();
          context.stroke();
        }
      }
    }
    if (hover >= 0) {
      const x = xAt(hover);
      const point = points[hover];
      context.beginPath();
      context.strokeStyle = color('--focus');
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
  const drawSmallCharts = () => sparklines.forEach(([element, paint]) => drawSparkline(element, paint, points));
  const redraw = () => { schedule(); drawSmallCharts(); };
  const watcher = new ResizeObserver(redraw);
  watcher.observe(canvas);
  window.addEventListener('narra:theme', redraw);
  document.fonts.ready.then(() => { if (canvas.isConnected) schedule(); });
  redraw();
  return () => {
    watcher.disconnect();
    window.removeEventListener('narra:theme', redraw);
    if (scheduled) cancelAnimationFrame(scheduled);
  };
}
