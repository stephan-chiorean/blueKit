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
            dy="0"
            stdDeviation="3"
            floodColor="var(--chakra-colors-primary-500)"
            floodOpacity="0.6"
          />
        </filter>
      </defs>

      {/* Left compartment - tall light blue */}
      <rect
        x="25"
        y="25"
        width="20"
        height="50"
        rx="6"
        fill="#6BA3FF"
      />

      {/* Top right compartment */}
      <rect
        x="50"
        y="25"
        width="25"
        height="25"
        rx="6"
        fill="var(--chakra-colors-primary-500)"
        filter="url(#bluekit-glow)"
      />

      {/* Bottom right compartment */}
      <rect
        x="50"
        y="55"
        width="25"
        height="20"
        rx="6"
        fill="#5B8FFF"
      />
    </svg>
  );
}
