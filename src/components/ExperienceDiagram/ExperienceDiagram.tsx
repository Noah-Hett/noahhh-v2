import { useEffect, useState, type CSSProperties } from 'react';
import './ExperienceDiagram.css';
import { useInView } from './useInView';

// Unstyled by design: the component carries no paint of its own. Ink
// follows `color` (currentColor) and hosts theme it with:
//   --xd-halo  knockout colour for dot halos + logo cutouts (match section bg)
//   --xd-font  label typeface
//   --xd-mute  label opacity
// Fallbacks in ExperienceDiagram.css preserve the original look standalone.
type Vars = CSSProperties & { '--del'?: string; '--dur'?: string };

/** Actual Imperial wordmark, traced from Figma node 127:153 (Group 6) */
function ImperialMark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label="Imperial logo">
      <path
        d="M51.4238 0V13.5208H60.2727V11.1583H54.0089V7.77357H59.7282V5.47469H54.0089V2.36706H60.2727V0H51.4238Z"
        fill="currentColor"
      />
      <path
        d="M40.6669 2.18533H38.7589V6.74227H40.6669C42.1584 6.74227 43.2566 6.02442 43.2566 4.46153C43.2566 2.89863 42.1584 2.18079 40.6669 2.18079M40.8041 8.92304H38.7635V13.5208H36.1738V0H40.8041C43.7049 0 45.9789 1.30393 45.9789 4.46153C45.9789 7.61915 43.6913 8.92304 40.8041 8.92304Z"
        fill="currentColor"
      />
      <path
        d="M82.7451 0V2.36706H85.9438V11.1583H82.7451V13.5208H91.7316V11.1583H88.533V2.36706H91.7316V0H82.7451Z"
        fill="currentColor"
      />
      <path
        d="M74.0649 4.19347C74.0649 5.82452 73.1131 6.33791 71.475 6.33791H69.297V2.18533H71.475C73.2504 2.18533 74.0649 2.83956 74.0649 4.19347ZM76.7915 4.19347C76.7915 1.03587 74.6088 0 71.7498 0H66.7119V13.5208H69.3016V8.51872H71.4792C71.5983 8.51872 71.7174 8.51872 71.8364 8.51417L74.4721 13.5254H77.3403L74.4172 7.97804C75.8397 7.35105 76.7964 6.14255 76.7964 4.19347"
        fill="currentColor"
      />
      <path
        d="M103.087 2.39886L104.949 8.36423H101.225L103.087 2.39886ZM101.385 0L96.8916 13.5208H99.614L100.543 10.545H105.631L106.56 13.5208H109.282L104.789 0H101.385Z"
        fill="currentColor"
      />
      <path d="M115.124 0V13.5208H124.001V11.1583H117.714V0H115.124Z" fill="currentColor" />
      <path
        d="M25.9106 0L22.6438 7.95081L19.377 0H15.6982V13.5208H18.1507V3.41202L21.2803 10.5496H21.4176H23.87H24.0073L27.1369 3.41202V13.5208H29.5893V0H25.9106Z"
        fill="currentColor"
      />
      <path
        d="M0 0V2.36706H3.19823V11.1583H0V13.5208H8.98613V11.1583H5.78793V2.36706H8.98613V0H0Z"
        fill="currentColor"
      />
    </g>
  );
}

/** Isometric ICH cube mark, traced from Figma node 127:167 */
function IchMark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label="ICH logo">
      <path
        d="M20.1796 21.7182L26.2109 18.1961L26.2297 12.4958L30 10.2957L29.9562 26.0713L26.1858 28.2746L26.2015 22.5775L20.1702 26.1028L20.1545 31.7999L16.3842 34L16.4249 18.2244L20.1952 16.0211L20.1796 21.7182Z"
        fill="currentColor"
      />
      <path
        d="M15.0032 4.40345L8.96873 7.92557L18.8361 13.651L15.0658 15.8543L1.40612 7.92557L14.9781 0L28.6378 7.92872L24.8674 10.1289L15.0032 4.40345Z"
        fill="currentColor"
      />
      <path
        d="M4.96345 17.5414L0.0313151 14.6802L0.0438412 10.2957L13.7035 18.2244L13.691 22.6058L8.75884 19.7415L8.74005 26.7543L13.6722 29.6186L13.6597 34L0 26.0744L0.0125261 21.6899L4.94466 24.5542L4.96345 17.5414Z"
        fill="currentColor"
      />
    </g>
  );
}

/** RCA wordmark, traced from Figma node 127:130 (Group 5) */
function RcaMark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label="RCA logo">
      <path
        d="M7.33737 13.8709C8.83626 13.8431 10.4195 13.8695 11.9248 13.8693L13.7359 13.8675C14.5485 13.8663 15.2014 13.8298 16.0043 14.0246C17.2984 14.3386 18.4141 15.0657 19.1082 16.216C19.4458 16.785 19.671 17.4136 19.7715 18.0675C19.8737 18.7032 19.8629 19.3269 19.8631 19.9684L19.8619 21.8426L19.8637 23.5827C19.8641 24.1732 19.8944 24.8528 19.751 25.4214C19.4667 26.5489 18.6775 27.3625 17.705 27.9477C18.4625 28.3983 19.0223 28.8747 19.477 29.6409C20.0867 30.6682 19.949 31.8826 19.9483 33.0368L19.9472 35.7626C19.9469 37.1873 19.9661 38.4544 20.3343 39.8436C20.4397 40.2416 20.5782 40.7271 20.641 41.1257C19.5648 41.1641 18.4477 41.1071 17.3681 41.1321C16.9522 41.1418 16.4468 41.1472 16.0356 41.116C15.2446 40.6248 15.0593 38.7318 14.9609 37.8595C14.8694 35.8021 14.9729 33.7009 14.9319 31.6393C14.8962 29.8445 13.9701 30.0346 12.6132 30.0448C12.5879 31.2284 12.6113 32.5037 12.6114 33.6934L12.6095 41.1289C10.8749 41.1498 9.06485 41.1391 7.32835 41.1278L7.32824 22.6549V16.7647L7.32607 14.9332C7.32555 14.612 7.31229 14.1791 7.33737 13.8709Z"
        fill="currentColor"
      />
      <path
        d="M12.6138 18.3047C14.7895 18.2898 14.8029 18.1647 14.8046 20.4133L14.8052 22.3871L14.8047 24.0703C14.8043 24.6288 14.8733 25.2209 14.5664 25.7084C14.1761 26.1066 13.1655 25.98 12.6119 25.9751L12.6138 18.3047Z"
        className="xd-paper"
      />
      <path
        d="M37.6861 13.8698L43.7605 13.871L46.4754 32.7179L47.2477 38.071C47.3925 39.0751 47.5587 40.1219 47.6793 41.1263C45.9796 41.1712 44.1051 41.1314 42.3871 41.1295L42.1468 38.2753C42.1046 37.7761 42.0525 37.2575 42.0241 36.7588H38.9241C38.8229 38.1491 38.6201 39.7285 38.4794 41.129C36.9234 41.1456 35.2645 41.147 33.7101 41.126L36.4306 22.4487L37.2341 16.9285C37.3802 15.9255 37.518 14.8663 37.6861 13.8698Z"
        fill="currentColor"
      />
      <path
        d="M40.6772 22.1209C40.7277 22.3657 40.7642 22.9812 40.7868 23.2544L40.9723 25.4758L41.5642 32.4751H40.4309L39.4993 32.4737C39.8165 30.0551 40.0243 27.5662 40.3251 25.1405C40.4476 24.1543 40.5249 23.0965 40.6772 22.1209Z"
        className="xd-paper"
      />
      <path
        d="M27.2422 13.3577C27.4186 13.3386 27.7028 13.3429 27.8846 13.3392C29.4881 13.3066 31.1005 13.8197 32.2502 14.9696C33.3486 16.068 33.8892 17.624 33.9636 19.1551C33.9915 19.7282 33.9751 20.3402 33.9751 20.9178L33.9735 23.7793C32.4825 23.8081 30.8752 23.784 29.3804 23.7808L29.3815 20.8482C29.3815 19.5447 29.6192 18.0289 27.6987 18.147C27.409 18.1594 27.0953 18.3014 26.8743 18.4886C26.3017 18.9735 26.445 20.0727 26.445 20.7562L26.446 22.9608L26.4463 29.6774L26.4451 33.7511C26.445 34.3914 26.4323 35.0767 26.4643 35.7153C26.5039 35.9637 26.6233 36.2629 26.8015 36.4423C27.5363 37.1824 29.2045 36.9577 29.342 35.7685C29.4084 35.1941 29.3804 34.6212 29.3788 34.0527L29.3799 31.1778L31.7295 31.1768L33.9741 31.1786L33.9751 34.0468C33.9754 36.0798 33.9953 37.9929 32.6366 39.5941C29.1519 43.7019 21.4807 41.4049 21.1055 35.8783C21.0344 34.8307 21.0673 33.8451 21.0674 32.8367L21.0674 27.2618L21.0669 22.0327C21.0661 21.0758 21.0155 19.5394 21.1698 18.6478C21.3524 17.5745 21.8101 16.5668 22.4982 15.7231C23.7062 14.2549 25.382 13.5369 27.2422 13.3577Z"
        fill="currentColor"
      />
    </g>
  );
}

function Desc({
  x,
  y,
  children,
  anchor = 'start',
  del = '0s',
  year = false,
}: {
  x: number;
  y: number;
  children: string;
  anchor?: 'start' | 'end';
  del?: string;
  year?: boolean;
}) {
  // Label size is 17 viewBox units: at 390px mobile widths an 854-wide
  // viewBox shrinks 15-unit type to ~7px effective, so the viewBox was
  // widened (42 150 900 730, spine still centred on 492) and the three
  // start-anchored labels nearest a stroke were nudged to hold clearance.
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill="currentColor"
      fontSize={17}
      className={`xd-rise xd-desc${year ? ' xd-year' : ''}`}
      style={{ '--del': del } as Vars}
    >
      {children}
    </text>
  );
}

/** Timeline dot with background halo, as Figma Ellipse 15 (r=2.5 + BG stroke).
    No stroke attribute here: the halo colour is CSS-owned
    (.exp-svg .xd-pop { stroke: var(--xd-halo, ...) }) so theming stays in
    one place and the TSX keeps its no-hardcoded-paint contract. */
function Dot({ x, y, del = '0s' }: { x: number; y: number; del?: string }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={2.5}
      fill="currentColor"
      strokeWidth={1.5}
      className="xd-pop"
      style={{ '--del': del } as Vars}
      data-testid="timeline-dot"
    />
  );
}

function DrawLine({
  x1,
  y1,
  x2,
  y2,
  stroke = 'currentColor',
  del = '0s',
  dur = '0.6s',
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string;
  del?: string;
  dur?: string;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={1}
      pathLength={1}
      className="xd-draw"
      style={{ '--del': del, '--dur': dur } as Vars}
    />
  );
}

// Exact branch elbows from Figma (Vector 223/226: r15 double-curve with
// vertical tangents). Absolute coords so the spine-side vertical sits
// EXACTLY on cx=492 — a 0.5-unit offset renders as a doubled segment.
const ELBOW_RIGHT =
  'M492 493V530.24C492 538.52 498.72 545.24 507 545.24H603C611.28 545.24 618 551.96 618 560.24V583.5';
const ELBOW_LEFT =
  'M492 428V465.24C492 473.52 485.28 480.24 477 480.24H382C373.72 480.24 367 486.96 367 495.24V518.5';

export function ExperienceDiagram({ animate = true }: { animate?: boolean }) {
  const cx = 492;
  const lx = 367;
  const { ref, inView } = useInView<HTMLDivElement>(0.25);
  const on = !animate || inView;

  // Mobile hides non-year labels (see CSS), leaving wide empty margins
  // in the desktop viewBox — so swap to a tighter one centred on the
  // spine (492) to let the timeline render ~1.45x larger.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(max-width: 600px)');
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const viewBox = isMobile ? '182 150 620 730' : '42 150 900 730';

  return (
    <div className="exp-diagram" data-testid="experience-diagram">
      {/* animate=false renders .in immediately AND .no-anim kills the
          transitions (see CSS): without it the labels would fade in on a
          1s delay instead of resolving to the end state instantly. */}
      <div ref={ref} className={`exp-svg${on ? ' in' : ''}${animate ? '' : ' no-anim'}`}>
        <svg
          viewBox={viewBox}
          role="img"
          aria-label="Education and work timeline: Imperial MEng 2024 to 2028, with ICH branding roles and RCA summer 2026"
        >
          <defs>
            {/* userSpaceOnUse: objectBoundingBox gradients fail on
                zero-width vertical lines in Chromium, so each fade is
                pinned to absolute coords like Figma's own exports */}
            <linearGradient
              id="fadeTop"
              gradientUnits="userSpaceOnUse"
              x1={cx}
              y1={191}
              x2={cx}
              y2={257}
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="1" stopColor="currentColor" stopOpacity="1" />
            </linearGradient>
            <linearGradient
              id="fadeBottomC"
              gradientUnits="userSpaceOnUse"
              x1={cx}
              y1={785}
              x2={cx}
              y2={843}
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="1" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="fadeBottomL"
              gradientUnits="userSpaceOnUse"
              x1={lx}
              y1={659}
              x2={lx}
              y2={717}
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="1" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="fadeBottomR"
              gradientUnits="userSpaceOnUse"
              x1={618}
              y1={633}
              x2={618}
              y2={691}
            >
              <stop offset="0" stopColor="currentColor" stopOpacity="1" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* draw sequence runs top to bottom, ~1.3s total.
              Linear strokes overlapped tightly so it reads as one
              continuous motion rather than discrete steps. */}
          <DrawLine x1={cx} y1={191} x2={cx} y2={257} stroke="url(#fadeTop)" del="0s" dur="0.25s" />

          {/* spine, split at the dots so each leg draws in sequence */}
          <DrawLine x1={cx} y1={299} x2={cx} y2={411} del="0.05s" dur="0.3s" />
          <DrawLine x1={cx} y1={411} x2={cx} y2={535} del="0.3s" dur="0.25s" />
          <DrawLine x1={cx} y1={535} x2={cx} y2={659} del="0.55s" dur="0.25s" />
          <DrawLine x1={cx} y1={659} x2={cx} y2={785} del="0.8s" dur="0.25s" />
          <DrawLine x1={cx} y1={785} x2={cx} y2={843} stroke="url(#fadeBottomC)" del="1s" dur="0.25s" />

          <path
            d={ELBOW_LEFT}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            pathLength={1}
            className="xd-draw"
            style={{ '--del': '0.25s', '--dur': '0.3s' } as Vars}
          />
          <DrawLine x1={lx} y1={566} x2={lx} y2={659} del="0.55s" dur="0.25s" />
          <DrawLine x1={lx} y1={659} x2={lx} y2={717} stroke="url(#fadeBottomL)" del="1s" dur="0.25s" />

          <path
            d={ELBOW_RIGHT}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            pathLength={1}
            className="xd-draw"
            style={{ '--del': '0.5s', '--dur': '0.3s' } as Vars}
          />
          <DrawLine x1={618} y1={633} x2={618} y2={691} stroke="url(#fadeBottomR)" del="0.8s" dur="0.2s" />

          <Dot x={cx} y={411} del="0.3s" />
          <Dot x={cx} y={535} del="0.5s" />
          <Dot x={cx} y={659} del="0.8s" />
          <Dot x={lx} y={659} del="0.8s" />
          <Dot x={cx} y={783} del="1s" />

          <g className="xd-fade" style={{ '--del': '0.1s' } as Vars}>
            <ImperialMark x={429} y={275.5} />
          </g>
          <g className="xd-fade" style={{ '--del': '0.5s' } as Vars}>
            <IchMark x={352} y={524} />
          </g>
          <g className="xd-fade" style={{ '--del': '0.75s' } as Vars}>
            <RcaMark x={592} y={576} />
          </g>

          <Desc x={268} y={322} del="0.15s">
            MEng Design Engineering
          </Desc>
          <Desc x={529} y={322} del="0.15s" year>
            2024-2028
          </Desc>
          <Desc x={246} y={583} del="0.6s" year>
            Winter 2025/6
          </Desc>
          <Desc x={331} y={607} anchor="end" del="0.65s">
            Member of Branding Team
          </Desc>
          <Desc x={247} y={661} del="0.85s" year>
            Winter 2026/7
          </Desc>
          <Desc x={331} y={683} anchor="end" del="0.9s">
            Branding Team Lead
          </Desc>
          <Desc x={650} y={632} del="0.85s" year>
            Summer 2026
          </Desc>
          <Desc x={650} y={657} del="0.9s">
            Dynamic and Accessible Visualisation
          </Desc>
          <Desc x={650} y={676} del="0.95s">
            - Helen Hamlyn Centre for Design
          </Desc>
        </svg>
      </div>
    </div>
  );
}
