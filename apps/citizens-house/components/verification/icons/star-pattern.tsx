// Star pattern SVG - decorative element for verification hero
// Features a grid of 4-pointed stars with concave inward-curving edges
export function StarPattern({ className, idPrefix = "starPattern" }: { className?: string; idPrefix?: string }) {
  const gradientId = `${idPrefix}-fade`
  const maskId = `${idPrefix}-mask`
  const stars = []

  const rows = 12
  const cols = 12
  const cellWidth = 48
  const cellHeight = 48

  // 4-pointed star with inner/outer radius for concave edges
  const outerRadius = 16 // distance to star tips
  const innerRadius = 4 // distance to waist (smaller = more dramatic concave)

  // Creates a 4-pointed star path with 8 points (4 tips + 4 waist points)
  // Using quadratic bezier curves with control point at center for smooth concave edges
  const getStarPath = (cx: number, cy: number) => {
    const points: { x: number; y: number }[] = []

    // Generate 8 points: alternating outer (tips) and inner (waist)
    for (let i = 0; i < 8; i++) {
      const angle = ((i * 45 - 90) * Math.PI) / 180 // Start at top, go clockwise
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      points.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      })
    }

    // Build path with quadratic bezier curves
    // Control point is at center (cx, cy) for smooth concave curves
    let path = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < 8; i++) {
      path += ` Q ${cx} ${cy} ${points[i].x} ${points[i].y}`
    }
    path += ` Q ${cx} ${cy} ${points[0].x} ${points[0].y} Z`

    return path
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellWidth + 24
      const y = row * cellHeight + 24
      stars.push(<path key={`${row}-${col}`} d={getStarPath(x, y)} fill="currentColor" />)
    }
  }

  const width = cols * cellWidth
  const height = rows * cellHeight

  return (
    <svg viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        {/* Radial gradient mask for circular fading effect */}
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="50%" stopColor="white" stopOpacity="0.8" />
          <stop offset="75%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width={width} height={height} fill={`url(#${gradientId})`} />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>{stars}</g>
    </svg>
  )
}
