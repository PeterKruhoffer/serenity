import styles from "./calendar-hero.module.css";

// Isometric September 2026 calendar: event blocks drop onto their days, and
// the draft on the 16th turns green midway through, the moment it goes live.
const C = Math.cos(Math.PI / 6);
const f = (n: number) => +n.toFixed(1);
const project = (x: number, y: number, z = 0) => [(x - y) * C, (x + y) / 2 - z];
const points = (corners: number[][]) =>
  corners.map(([x, y, z]) => project(x, y, z).map(f).join(",")).join(" ");
const polygon = (corners: number[][], className: string) =>
  `<polygon class="${className}" points="${points(corners)}"/>`;
const shades = {
  paper: [styles.f0, styles.f1, styles.f2],
  green: [styles.a0, styles.a1, styles.a2],
};

function box(x: number, y: number, z: number, w: number, d: number, h: number, shade: string[]) {
  return (
    polygon(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      shade[1],
    ) +
    polygon(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      shade[2],
    ) +
    polygon(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      shade[0],
    )
  );
}

function onFace(matrix: string, x: number, y: number, z: number, inner: string) {
  const [a, b] = project(x, y, z);
  return `<g transform="matrix(${matrix} ${f(a)} ${f(b)})">${inner}</g>`;
}
const onTop = (x: number, y: number, z: number, inner: string) =>
  onFace(`${f(C)} .5 ${f(-C)} .5`, x, y, z, inner);
const onLeft = (x: number, y: number, z: number, inner: string) =>
  onFace(`${f(C)} .5 0 1`, x, y, z, inner);
const label = (x: number, y: number, size: number, text: string | number) =>
  `<text class="${styles.label}" x="${x}" y="${y}" font-size="${size}">${text}</text>`;

function pawn(x: number, y: number, z: number) {
  const [a, b] = project(x, y, z).map(f);
  return `<g class="${styles.pawn}"><ellipse cx="${a}" cy="${b}" rx="7" ry="3.6"/><path d="M${a - 6} ${b} C${a - 6} ${b - 8} ${a - 3.5} ${b - 12} ${a - 3} ${b - 14} L${a + 3} ${b - 14} C${a + 3.5} ${b - 12} ${a + 6} ${b - 8} ${a + 6} ${b} Z"/><circle cx="${a}" cy="${b - 19}" r="5"/></g>`;
}

function scene() {
  const cell = 26;
  let grid = "";
  for (let i = 1; i < 7; i++)
    grid += `<path class="${styles.grid}" d="M${i * cell} 0V${5 * cell}"/>`;
  for (let j = 1; j < 5; j++)
    grid += `<path class="${styles.grid}" d="M0 ${j * cell}H${7 * cell}"/>`;
  for (let day = 1; day <= 30; day++) {
    grid += label((day % 7) * cell + 2.5, Math.floor(day / 7) * cell + 6.5, 4.5, day);
  }
  let markup =
    box(0, 0, 0, 7 * cell, 5 * cell, 10, shades.paper) +
    onTop(0, 0, 10, grid) +
    onLeft(0, 5 * cell, 10, label(5, 7.5, 5.5, "SEPTEMBER 2026"));

  // Days and states of the events in the September 2026 calendar screenshot.
  const events: Array<[day: number, published: boolean, height: number]> = [
    [2, true, 26],
    [6, false, 14],
    [7, false, 20],
    [11, false, 16],
    [12, true, 34],
    [16, false, 22],
    [20, true, 40],
    [25, false, 12],
  ];
  const items = events.map(([day, published, height], index) => {
    const column = day % 7;
    const row = Math.floor(day / 7);
    const className = day === 16 ? `${styles.drop} ${styles.goesLive}` : styles.drop;
    return {
      depth: column + row,
      markup: `<g class="${className}" style="animation-delay:${index * 0.35}s">${box(column * cell + 8, row * cell + 8, 10, 15, 15, height, published ? shades.green : shades.paper)}</g>`,
    };
  });
  items.push({ depth: 4.5, markup: pawn(cell + 13, 3 * cell + 13, 10) });
  for (const item of items.sort((a, b) => a.depth - b.depth)) markup += item.markup;

  return `<defs><filter id="calendar-hero-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter></defs><g filter="url(#calendar-hero-rough)">${markup}</g>`;
}

const markup = scene();

export const CalendarHero = () => (
  <svg
    class={styles.calendarHero}
    viewBox="-145 -52 336 232"
    aria-hidden="true"
    innerHTML={markup}
  />
);
