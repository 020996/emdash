import { useId } from 'react';

export const NATURAL_WIDTH = 58;
export const NATURAL_HEIGHT = 70;

/** Full-color agent mark (icon only, no wordmark). */
export function LogoShapes() {
  const gradientId = `logo-mark-${useId().replace(/:/g, '')}`;
  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c1c3" />
          <stop offset="1" stopColor="#5b5bf0" />
        </linearGradient>
      </defs>
      <rect x="0" y="12" width="58" height="58" rx="13" fill={`url(#${gradientId})`} />
      <rect
        x="10.7"
        y="27.4"
        width="36.6"
        height="28.8"
        rx="9.8"
        fill="#0e1020"
        fillOpacity="0.86"
      />
      <line
        x1="29"
        y1="27.4"
        x2="29"
        y2="6"
        stroke="#22c1c3"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <circle cx="29" cy="5" r="4.5" fill="#22c1c3" />
      <rect x="19.9" y="37.6" width="4.7" height="7.9" rx="2.3" fill="#7ef9ff" />
      <rect x="33.5" y="37.6" width="4.7" height="7.9" rx="2.3" fill="#7ef9ff" />
    </>
  );
}

export function EmdashLogo({
  className,
  height = NATURAL_HEIGHT,
  color = 'currentColor',
}: {
  className?: string;
  height?: number;
  color?: string;
}) {
  const width = (height / NATURAL_HEIGHT) * NATURAL_WIDTH;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${NATURAL_WIDTH} ${NATURAL_HEIGHT}`}
      fill={color}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <LogoShapes />
    </svg>
  );
}
