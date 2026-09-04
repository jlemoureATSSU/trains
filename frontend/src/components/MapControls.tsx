import { Compass, LocateFixed, Menu, MoveVertical, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export const MAP_STYLES = {
  liberty: {
    label: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    swatch: ['#c9b89a', '#6aa84f', '#3d7ab8'],
  },
  bright: {
    label: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    swatch: ['#f0d36c', '#62c36b', '#4f9ad8'],
  },
  dark: {
    label: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
    swatch: ['#2a2a2a', '#6b6b6b', '#c8c8c8'],
  },
  fiord: {
    label: 'Fiord',
    url: 'https://tiles.openfreemap.org/styles/fiord',
    swatch: ['#3b5a6c', '#7f9eb2', '#c5d5de'],
  },
} as const

export type MapStyleId = keyof typeof MAP_STYLES

const LINE_BAR = ['#00843D', '#ED8B00', '#DA291C', '#003DA5', '#80276C']

function sliderValue(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : (value[0] ?? 0)
}

type MapControlsProps = {
  styleId: MapStyleId
  pitch: number
  bearing: number
  onStyleChange: (styleId: MapStyleId) => void
  onPitchChange: (pitch: number) => void
  onBearingChange: (bearing: number) => void
  onReset: () => void
  onResetLocation: () => void
}

export function MapControls({
  styleId,
  pitch,
  bearing,
  onStyleChange,
  onPitchChange,
  onBearingChange,
  onReset,
  onResetLocation,
}: MapControlsProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Open map menu"
            className="size-9 border-white bg-[#1d1d1d] text-white hover:bg-white/10"
          />
        }
      >
        <Menu />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-72 gap-0 overflow-hidden p-0"
      >
        <div className="flex h-1">
          {LINE_BAR.map((color) => (
            <span
              key={color}
              className="h-full flex-1"
              style={{ background: color }}
            />
          ))}
        </div>

        <div className="px-3 pt-2.5 pb-2">
          <p className="text-[11px] font-medium tracking-wide text-white/55 uppercase">
            View
          </p>
          <PopoverTitle className="text-sm font-semibold tracking-tight">
            Camera
          </PopoverTitle>
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-3">
          {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => {
            const style = MAP_STYLES[id]
            const selected = id === styleId
            return (
              <button
                key={id}
                type="button"
                onClick={() => onStyleChange(id)}
                className={cn(
                  'overflow-hidden rounded-md text-left ring-1 transition-colors',
                  selected
                    ? 'bg-sky-500/15 ring-sky-400/50'
                    : 'bg-white/5 ring-white/15 hover:bg-white/10',
                )}
              >
                <span className="flex h-1.5">
                  {style.swatch.map((color) => (
                    <span
                      key={color}
                      className="h-full flex-1"
                      style={{ background: color }}
                    />
                  ))}
                </span>
                <span className="flex items-center justify-between px-2 py-1.5 text-xs font-medium">
                  {style.label}
                  {selected && (
                    <span className="size-1.5 rounded-full bg-sky-300" />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-px bg-white/10">
          <div className="bg-popover px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] tracking-wide text-white/40 uppercase">
              <MoveVertical className="size-3" />
              Pitch
            </p>
            <p className="mt-0.5 text-lg leading-none font-semibold tabular-nums">
              {Math.round(pitch)}
              <span className="ml-0.5 text-[10px] font-medium text-white/40">
                °
              </span>
            </p>
          </div>
          <div className="bg-popover px-3 py-2.5">
            <p className="flex items-center gap-1 text-[10px] tracking-wide text-white/40 uppercase">
              <Compass className="size-3" />
              Bearing
            </p>
            <p className="mt-0.5 text-lg leading-none font-semibold tabular-nums">
              {Math.round(bearing)}
              <span className="ml-0.5 text-[10px] font-medium text-white/40">
                °
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-3 pt-3">
          <Slider
            aria-label="Pitch"
            min={0}
            max={85}
            step={1}
            value={[pitch]}
            onValueChange={(value) => onPitchChange(sliderValue(value))}
          />
          <Slider
            aria-label="Bearing"
            min={-180}
            max={180}
            step={1}
            value={[bearing]}
            onValueChange={(value) => onBearingChange(sliderValue(value))}
          />
        </div>

        <div className="mt-2">
          <button
            type="button"
            onClick={onReset}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <RotateCcw className="size-3" />
            Reset pitch and bearing
          </button>
          <button
            type="button"
            onClick={onResetLocation}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <LocateFixed className="size-3" />
            Reset location
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
