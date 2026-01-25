interface BlueKitLogoProps {
  className?: string;
  size?: number | string;
}

export function BlueKitLogo({ className, size = 64 }: BlueKitLogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          id="bluekit-glow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            floodColor="var(--chakra-colors-primary-500)"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      {/* Left compartment - tall light blue */}
      <g>
        {/* Depth layer */}
        <rect
          x="25"
          y="27"
          width="20"
          height="54"
          rx="6"
          fill="#4A7ACC"
        />
        {/* Top layer */}
        <rect
          x="25"
          y="23"
          width="20"
          height="54"
          rx="6"
          fill="#6BA3FF"
        />
      </g>

      {/* Top right compartment */}
      <g>
        {/* Depth layer */}
        <rect
          x="50"
          y="27"
          width="25"
          height="25"
          rx="6"
          fill="var(--chakra-colors-primary-700)"
        />
        {/* Top layer */}
        <rect
          x="50"
          y="23"
          width="25"
          height="25"
          rx="6"
          fill="var(--chakra-colors-primary-500)"
          filter="url(#bluekit-glow)"
        />
      </g>

      {/* Bottom right compartment */}
      <g>
        {/* Depth layer */}
        <rect
          x="50"
          y="61"
          width="25"
          height="20"
          rx="6"
          fill="#3B6FD9"
        />
        {/* Top layer */}
        <rect
          x="50"
          y="57"
          width="25"
          height="20"
          rx="6"
          fill="#5B8FFF"
        />
      </g>
    </svg>
  );
}
