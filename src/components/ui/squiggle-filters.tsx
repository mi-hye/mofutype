export function SquiggleFilters() {
  return (
    <svg
      className="svg-filters"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {[0, 1, 2, 3, 4].map((seed) => (
          <filter id={`text-squiggly-${seed}`} key={`text-squiggly-${seed}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves={3}
              result={`text-squiggly-noise-${seed}`}
              seed={seed}
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2={`text-squiggly-noise-${seed}`}
              scale={5}
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
