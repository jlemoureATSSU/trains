import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

function firstValue(
  value: number | readonly number[] | undefined,
  fallback: number,
): number {
  if (typeof value === 'number') return value
  if (Array.isArray(value)) return value[0] ?? fallback
  return fallback
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const thumbs = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min]
  const current = firstValue(value ?? defaultValue, min)
  const percent = max === min ? 0 : ((current - min) / (max - min)) * 100

  return (
    <SliderPrimitive.Root
      className={cn('w-full', className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-4 w-full touch-none items-center select-none">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-white/20"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-400"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbs.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3.5 shrink-0 rounded-full border border-white bg-sky-400 select-none after:absolute after:-inset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
