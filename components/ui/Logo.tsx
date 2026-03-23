interface LogoProps {
  size?: number
  className?: string
}

export default function Logo({ size = 28, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="28" height="28" rx="8" fill="#4F46E5" />
      {/* Lightning bolt */}
      <path
        d="M16 4L9 15H14L12 24L20 13H15L16 4Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  )
}
