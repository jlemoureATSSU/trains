import { RotateCcw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'

export const MAP_STYLES = {
  liberty: {
    label: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  bright: {
    label: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
  },
  dark: {
    label: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
  },
  fiord: {
    label: 'Fiord',
    url: 'https://tiles.openfreemap.org/styles/fiord',
  },
} as const

export type MapStyleId = keyof typeof MAP_STYLES

const STYLE_ITEMS = Object.fromEntries(
  (Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => [
    id,
    MAP_STYLES[id].label,
  ]),
) as Record<MapStyleId, string>

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
}

export function MapControls({
  styleId,
  pitch,
  bearing,
  onStyleChange,
  onPitchChange,
  onBearingChange,
  onReset,
}: MapControlsProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="icon" aria-label="Map settings" />}
      >
        <Settings />
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-72">
        <div className="flex flex-col gap-2">
          <Label htmlFor="map-style">Style</Label>
          <Select
            value={styleId}
            onValueChange={(value) => {
              if (value) onStyleChange(value as MapStyleId)
            }}
            items={STYLE_ITEMS}
            modal={false}
          >
            <SelectTrigger id="map-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MAP_STYLES) as MapStyleId[]).map((id) => (
                <SelectItem key={id} value={id}>
                  {MAP_STYLES[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pitch">Pitch</Label>
              <span className="text-muted-foreground tabular-nums text-xs">
                {Math.round(pitch)}°
              </span>
            </div>
            <Slider
              id="pitch"
              min={0}
              max={85}
              step={1}
              value={[pitch]}
              onValueChange={(value) => onPitchChange(sliderValue(value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bearing">Bearing</Label>
              <span className="text-muted-foreground tabular-nums text-xs">
                {Math.round(bearing)}°
              </span>
            </div>
            <Slider
              id="bearing"
              min={-180}
              max={180}
              step={1}
              value={[bearing]}
              onValueChange={(value) => onBearingChange(sliderValue(value))}
            />
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={onReset}>
          <RotateCcw />
          Reset view
        </Button>
      </PopoverContent>
    </Popover>
  )
}
