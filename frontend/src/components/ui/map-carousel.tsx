'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ChevronDown, MapPin, Maximize2, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { demoMapLocations, demoMapCenter, demoMapZoom } from './demo/map'

/**
 * Represents a location/hotel to display on the map.
 * @interface Location
 * @property {string} [name] - Location name
 * @property {string} [subtitle] - Subtitle (e.g., neighborhood)
 * @property {string} [image] - Location image URL
 * @property {number} [price] - Price value
 * @property {string} [priceLabel] - Full price text (e.g., "$284 total Jan 29 - Feb 1")
 * @property {string} [priceSubtext] - Additional price info (e.g., "USD • Includes taxes")
 * @property {number} [rating] - Rating value (e.g., 8.6)
 * @property {[number, number]} coordinates - Lat/lng coordinates
 * @property {string} [link] - External link URL
 */
export interface Location {
  name?: string
  subtitle?: string
  image?: string
  price?: number
  priceLabel?: string
  priceSubtext?: string
  rating?: number
  coordinates: [number, number] // [lat, lng]
  link?: string
}

/**
 * Available map tile styles.
 * @typedef {"voyager" | "voyager-smooth" | "positron" | "dark-matter" | "openstreetmap"} MapStyle
 */
export type MapStyle =
  | 'voyager'
  | 'voyager-smooth'
  | 'positron'
  | 'dark-matter'
  | 'openstreetmap'

// Filter configuration for fullscreen variant
/**
 * Configuration for a single filter section.
 * @interface FilterSectionConfig
 */
export interface FilterSectionConfig {
  /** Unique identifier for this filter (used in filter state). */
  id: string
  /** Display title for the filter section. */
  title: string
  /** Available options for this filter. */
  options: string[]
  /**
   * Function to check if a location matches the selected filter values.
   * @param location - The location to check
   * @param selectedValues - Currently selected filter values
   * @returns true if location matches, false otherwise
   */
  matchFn?: (location: Location, selectedValues: string[]) => boolean
}

/** State tracking selected values for each filter by id. */
export type FilterState = Record<string, string[]>

const createEmptyFilterState = (filters: FilterSectionConfig[]): FilterState => {
  return filters.reduce((acc, filter) => {
    acc[filter.id] = []
    return acc
  }, {} as FilterState)
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MapCarouselProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring an interactive map with a horizontal carousel of
 * location cards. Clicking a marker or card selects that location.
 * Supports inline (map with carousel) and fullscreen (split-screen) modes.
 */
export interface MapCarouselProps {
  data?: {
    /** Array of locations to display on the map with price markers. */
    locations?: Location[]
    /**
     * Map center coordinates as [latitude, longitude].
     * @default [37.7899, -122.4034]
     */
    center?: [number, number]
    /**
     * Initial zoom level for the map.
     * @default 14
     */
    zoom?: number
    /**
     * Map tile style (voyager, positron, dark-matter, etc.).
     * @default "voyager"
     */
    mapStyle?: MapStyle
    /** Optional title displayed above the list in fullscreen mode. */
    title?: string
    /**
     * Filter sections configuration for fullscreen mode.
     * Each filter section has an id, title, options, and optional matchFn.
     * If not provided, no filters will be shown.
     */
    filters?: FilterSectionConfig[]
    /** Whether to show heat dots instead of price markers. */
    useHeatmap?: boolean
  }
  actions?: {
    /** Called when a user selects a location via marker or card click. */
    onSelectLocation?: (location: Location) => void
  }
  appearance?: {
    /**
     * Height of the map container (inline mode only).
     * @default "504px"
     */
    mapHeight?: string
    /**
     * Display mode for the component.
     * - inline: Map with carousel cards at bottom
     * - pip: Same as inline (compact view)
     * - fullscreen: Split-screen with cards on left, filters, map on right
     * @default "inline"
     */
    displayMode?: 'inline' | 'pip' | 'fullscreen'
    /** Whether to hide the sidebar in fullscreen mode. */
    hideSidebar?: boolean
  }
}


// Hotel card component
function HotelCard({
  location,
  isSelected,
  onClick
}: {
  location: Location
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex gap-3 p-2 rounded-xl border bg-card min-w-[300px] max-w-[300px] text-left transition-all shrink-0 cursor-pointer select-none shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
        isSelected
          ? 'ring-1 ring-foreground border-foreground'
          : 'hover:border-foreground/30'
      )}
    >
      {/* Rating badge - top right */}
      {location.rating && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5">
          {location.rating}
        </div>
      )}

      {/* Image */}
      {location.image && (
        <div className="relative shrink-0">
          <img
            src={location.image}
            alt={location.name || 'Location image'}
            className="w-24 h-20 rounded-lg object-cover pointer-events-none"
            draggable={false}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0 flex-1 pointer-events-none">
        {location.name && (
          <h3 className="font-medium text-sm leading-tight truncate pr-8">
            {location.name}
          </h3>
        )}
        {location.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {location.subtitle}
          </p>
        )}
        <div className="mt-1.5">
          {location.price !== undefined && (
            <p className="text-sm">
              {location.priceLabel ? (
                <span className="font-semibold">{location.priceLabel}</span>
              ) : (
                <span className="font-semibold">${location.price} total</span>
              )}
            </p>
          )}
          {location.priceSubtext && (
            <p className="text-[10px] text-muted-foreground">
              {location.priceSubtext}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// Location card for fullscreen list view
function LocationListCard({
  location,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave
}: {
  location: Location
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'flex gap-3 p-3 border-b transition-colors cursor-pointer',
        isSelected && 'bg-accent'
      )}
    >
      {/* Thumbnail */}
      {location.image && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <img
            src={location.image}
            alt={location.name || 'Location image'}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {/* Location Info */}
      <div className="flex-1 min-w-0">
        {location.price !== undefined && (
          <p className="font-semibold text-sm">${location.price} total</p>
        )}
        {location.priceSubtext && (
          <p className="text-xs text-muted-foreground">{location.priceSubtext}</p>
        )}
        {location.name && (
          <p className="text-sm font-medium mt-1 line-clamp-1">{location.name}</p>
        )}
        {location.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {location.subtitle}
          </p>
        )}
        {location.rating && (
          <div className="flex items-center gap-1 mt-1">
            <span className="bg-green-600 text-white text-[10px] font-bold rounded-md px-1.5 py-0.5">
              {location.rating}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Filter section component with expandable checkbox list
function FilterSection({
  title,
  options,
  selected,
  onChange,
  defaultExpanded = true,
  showLimit = 5
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  defaultExpanded?: boolean
  showLimit?: number
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const visibleOptions = showAll ? options : options.slice(0, showLimit)
  const hasMore = options.length > showLimit

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-4 text-sm font-medium hover:text-foreground/80 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          expanded && "rotate-180"
        )} />
      </button>
      <div className={cn(
        "grid transition-all duration-200 ease-out",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden">
          <div className="space-y-2 pb-4">
            {visibleOptions.map(option => (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggleOption(option)}
                  className="h-4 w-4"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {option}
                </span>
              </label>
            ))}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {showAll ? 'Show less' : `View ${options.length - showLimit} more`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Filter panel that slides over the location list
function FilterPanel({
  isOpen,
  onClose,
  filterConfigs,
  filterState,
  onFiltersChange,
  onApply,
  onReset,
  resultCount
}: {
  isOpen: boolean
  onClose: () => void
  filterConfigs: FilterSectionConfig[]
  filterState: FilterState
  onFiltersChange: (filters: FilterState) => void
  onApply: () => void
  onReset: () => void
  resultCount: number
}) {
  const activeFiltersCount = Object.values(filterState).flat().length

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-background/60 backdrop-blur-[2px] transition-opacity duration-300 z-10",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "absolute inset-0 bg-background z-20 flex flex-col transition-all duration-300 ease-out",
          isOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter sections - dynamically rendered */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {filterConfigs.map((config) => (
            <FilterSection
              key={config.id}
              title={config.title}
              options={config.options}
              selected={filterState[config.id] || []}
              onChange={(values) => onFiltersChange({ ...filterState, [config.id]: values })}
            />
          ))}
        </div>

        {/* Footer with actions */}
        <div className="border-t px-4 py-3 space-y-2">
          <Button
            className="w-full"
            onClick={onApply}
          >
            Show {resultCount} locations
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              Reset all filters
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

// Map placeholder shown during SSR or when Leaflet isn't loaded
function MapPlaceholder({ height }: { height?: string }) {
  return (
    <div
      className="bg-muted/30 flex items-center justify-center"
      style={{ height: height || '100%' }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-8 w-8" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
}

// Vanilla Leaflet map – bypasses react-leaflet entirely to avoid dual-React hook errors.
// Uses the leaflet JS API directly via refs so only the consumer's React copy exists.
interface LeafletMapConfig {
  center: [number, number]
  zoom: number
  tileConfig: { url: string; attribution: string }
  locations: Location[]
  selectedIndex: number | null
  onSelectLocation: (location: Location, index: number) => void
  style?: React.CSSProperties
  useHeatmap?: boolean
}

function VanillaLeafletMap({
  center,
  zoom,
  tileConfig,
  locations,
  selectedIndex,
  onSelectLocation,
  style,
  useHeatmap
}: LeafletMapConfig) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zipCirclesRef = useRef<Array<{ circle: any; intensity: number }>>([])
  const zoomHandlerRef = useRef<(() => void) | null>(null)
  const callbackRef = useRef(onSelectLocation)
  const [ready, setReady] = useState(false)

  callbackRef.current = onSelectLocation

  // Initialize the Leaflet map once on mount
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      const LEAFLET_CSS_ID = 'leaflet-css-1.9.4'
      if (!document.getElementById(LEAFLET_CSS_ID)) {
        const link = document.createElement('link')
        link.id = LEAFLET_CSS_ID
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        scrollWheelZoom: true
      })
      L.tileLayer(tileConfig.url, { attribution: tileConfig.attribution }).addTo(map)

      leafletRef.current = L
      mapInstanceRef.current = map
      setReady(true)
    })()

    return () => {
      cancelled = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      leafletRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-center the map smoothly when the requested center changes
  // (e.g. switching from the Intel demo to the Microchip WARN event).
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !ready) return
    map.flyTo(center, zoom, { animate: true, duration: 0.8 })
  }, [center[0], center[1], zoom, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers whenever locations or selection change
  useEffect(() => {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return

    markersRef.current.forEach((m: { remove: () => void }) => m.remove())
    markersRef.current = []
    zipCirclesRef.current = []

    if (zoomHandlerRef.current) {
      map.off('zoomend', zoomHandlerRef.current)
      zoomHandlerRef.current = null
    }

    // Add animation + tooltip styles to head
    const STYLE_ID = 'heatmap-pulse-style'
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.innerHTML = `
        @keyframes marker-bounce {
          0%, 100% { transform: translate(-50%, -100%) scale(1); }
          50% { transform: translate(-50%, -100%) scale(1.1); }
        }
        .business-marker:hover {
          transform: translate(-50%, -100%) scale(1.15) !important;
          z-index: 9999 !important;
        }
        /* ZIP region tooltip — clean white pill, no leaflet chrome */
        .leaflet-tooltip.zip-tooltip-wrapper {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          white-space: nowrap;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .leaflet-tooltip.zip-tooltip-wrapper:before {
          display: none !important;
        }
        .zip-tooltip {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(31, 41, 55, 0.85);
          border-radius: 6px;
          padding: 4px 9px;
          font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Inter", ui-sans-serif, system-ui, sans-serif;
          text-align: center;
          line-height: 1.2;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        }
        .zip-tooltip-impact {
          color: #1F2937;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.01em;
          font-feature-settings: "tnum" 1, "lnum" 1;
        }
        .zip-tooltip-zip {
          color: #6B7280;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 1px;
        }
      `
      document.head.appendChild(style)
    }

    // Category icons (SVG paths)
    const categoryIcons: Record<string, string> = {
      restaurant: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>',
      cafe: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>',
      childcare: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>',
      personal_services: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>',
      retail: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
      fitness: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>',
      zip: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
    }

    // Category colors
    const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
      restaurant: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
      cafe: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
      childcare: { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' },
      personal_services: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
      retail: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
      fitness: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
      zip: { bg: '#1F2937', border: '#F59E0B', text: '#FFFFFF' },
    }

    locations.forEach((location, index) => {
      const isSelected = selectedIndex === index
      const locAny = location as any
      const markerType = locAny.markerType || 'zip'
      const category = locAny.category || 'zip'
      const intensity = location.rating ? Math.min(location.rating / 40, 1) : 0.5
      const colors = categoryColors[category] || categoryColors.zip
      const icon = categoryIcons[category] || categoryIcons.zip

      if (markerType === 'epicenter') {
        // Source-employer marker: bold red pin sitting above everything else.
        const html = `
          <div class="epicenter-marker" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -100%);
            z-index: 5000;
          ">
            <div style="
              background: #DC2626;
              border: 2.5px solid #7F1D1D;
              border-radius: 9px;
              padding: 5px 11px;
              display: flex;
              align-items: center;
              gap: 6px;
              box-shadow: 0 6px 18px rgba(220, 38, 38, 0.45), 0 2px 6px rgba(0,0,0,0.25);
              white-space: nowrap;
            ">
              <span style="
                width: 7px;
                height: 7px;
                background: #FFF;
                border-radius: 50%;
                box-shadow: 0 0 6px rgba(255,255,255,0.95);
              "></span>
              <span style="
                font-size: 11px;
                font-weight: 700;
                color: #FFF;
                letter-spacing: 0.04em;
                font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Inter', ui-sans-serif, system-ui, sans-serif;
              ">${location.priceLabel || 'EPICENTER'}</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 7px solid transparent;
              border-right: 7px solid transparent;
              border-top: 9px solid #7F1D1D;
              margin-top: -1px;
            "></div>
            <div style="
              width: 12px;
              height: 12px;
              background: #DC2626;
              border: 2px solid #FFF;
              border-radius: 50%;
              margin-top: -3px;
              box-shadow: 0 0 14px rgba(220, 38, 38, 0.7);
            "></div>
          </div>
        `

        const epicenterIcon = L.divIcon({
          className: 'custom-div-icon',
          html: html,
          iconSize: [120, 60],
          iconAnchor: [60, 60],
        })

        const marker = L.marker(location.coordinates, {
          icon: epicenterIcon,
          zIndexOffset: 5000,
        })
        marker.on('click', () => callbackRef.current(location, index))
        marker.addTo(map)
        markersRef.current.push(marker)
        return
      }

      if (markerType === 'zip') {
        // Render ZIP as a real geographic circle (radius in meters).
        // Phoenix-area ZCTAs span ~1–3 miles. Scale by impact intensity.
        const radiusMeters = 1600 + intensity * 2400 // ~1mi to ~2.5mi
        const fillColor = isSelected ? '#DC2626' : '#F59E0B'
        const strokeColor = isSelected ? '#7F1D1D' : '#B45309'

        const circle = L.circle(location.coordinates, {
          radius: radiusMeters,
          fillColor,
          fillOpacity: 0.18,
          color: strokeColor,
          weight: isSelected ? 2 : 1.25,
          opacity: 0.55,
        })

        const tooltipHtml = `
          <div class="zip-tooltip">
            <div class="zip-tooltip-impact">${location.priceLabel || ''}</div>
            <div class="zip-tooltip-zip">ZIP ${locAny.zipData?.zip_code || ''}</div>
          </div>
        `
        circle.bindTooltip(tooltipHtml, {
          permanent: true,
          direction: 'center',
          className: 'zip-tooltip-wrapper',
          opacity: 1,
        })

        circle.on('click', () => callbackRef.current(location, index))
        circle.addTo(map)
        markersRef.current.push(circle)
        zipCirclesRef.current.push({ circle, intensity })
        return
      }

      // Business marker - pin style with icon
      const impactPct = location.price || 0
      const urgencyColor = impactPct > 30 ? '#EF4444' : impactPct > 20 ? '#F59E0B' : '#10B981'
      const html = `
        <div class="business-marker" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -100%);
          z-index: ${isSelected ? 1000 : 10};
        ">
          <div style="
            background: ${isSelected ? '#1F2937' : colors.bg};
            border: 2px solid ${isSelected ? '#000' : colors.border};
            border-radius: 8px;
            padding: 4px 8px;
            display: flex;
            align-items: center;
            gap: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            white-space: nowrap;
          ">
            <span style="color: ${isSelected ? '#FFF' : colors.text}; display: flex; align-items: center;">
              ${icon}
            </span>
            <span style="
              font-size: 11px;
              font-weight: 600;
              color: ${isSelected ? '#FFF' : urgencyColor};
              font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Inter', ui-sans-serif, system-ui, sans-serif;
              font-feature-settings: 'tnum' 1, 'lnum' 1;
            ">${location.priceLabel || ''}</span>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid ${isSelected ? '#000' : colors.border};
            margin-top: -1px;
          "></div>
        </div>
      `

      const markerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: html,
        iconSize: [80, 40],
        iconAnchor: [40, 40],
      })

      const marker = L.marker(location.coordinates, {
        icon: markerIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      })
      marker.on('click', () => callbackRef.current(location, index))
      marker.addTo(map)
      markersRef.current.push(marker)
    })

    // Zoom-responsive ZIP circles: as user zooms in, fade the fill so
    // the businesses inside become readable. Tooltip hides at deep zoom.
    const updateZipStyles = () => {
      const z = map.getZoom()
      // zoom 11 (metro) -> light tint, zoom 14+ (street) -> nearly invisible
      const fillOpacity =
        z <= 11 ? 0.20 :
        z === 12 ? 0.14 :
        z === 13 ? 0.08 :
        z === 14 ? 0.04 :
        0.02
      const strokeOpacity =
        z <= 11 ? 0.55 :
        z === 12 ? 0.45 :
        z === 13 ? 0.32 :
        z === 14 ? 0.20 :
        0.12
      const tooltipOpacity = z >= 14 ? 0 : 1
      zipCirclesRef.current.forEach(({ circle }) => {
        circle.setStyle({ fillOpacity, opacity: strokeOpacity })
        const tt = circle.getTooltip?.()
        if (tt) {
          const el = tt.getElement?.()
          if (el) el.style.opacity = String(tooltipOpacity)
        }
      })
    }
    updateZipStyles()
    map.on('zoomend', updateZipStyles)
    zoomHandlerRef.current = updateZipStyles
  }, [locations, selectedIndex, ready])

  return (
    <div className="relative" style={style ?? { height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {!ready && (
        <div className="absolute inset-0">
          <MapPlaceholder />
        </div>
      )}
    </div>
  )
}

/**
 * Gets the tile configuration for a given map style.
 * @param {MapStyle} style - The map style to use
 * @returns {{ url: string; attribution: string }} The tile URL and attribution
 */
const getTileConfig = (style: MapStyle) => {
  const configs: Record<MapStyle, { url: string; attribution: string }> = {
    // Voyager - Colorful, detailed, Apple Maps-like (recommended default)
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Voyager with labels under roads - cleaner look
    'voyager-smooth': {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Positron - Light, minimal, clean
    positron: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // Dark Matter - Dark theme
    'dark-matter': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    // OpenStreetMap - Standard, detailed
    openstreetmap: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  }
  return configs[style]
}

/**
 * An interactive map with a horizontal carousel of location cards.
 * Clicking a marker or card selects that location and syncs the view.
 *
 * Features:
 * - Leaflet map with multiple tile style options
 * - Price markers on map locations
 * - Inline mode: Map with draggable carousel at bottom
 * - Fullscreen mode: Split-screen with cards on left, filters, map on right
 * - Location cards with image, rating, and price
 * - Selection sync between map and carousel/list
 * - MCP Apps display mode integration
 *
 * @component
 * @example
 * ```tsx
 * <MapCarousel
 *   data={{
 *     locations: [
 *       {
 *         name: "Hotel Carlton",
 *         subtitle: "Downtown",
 *         image: "/hotel.jpg",
 *         price: 284,
 *         rating: 8.6,
 *         coordinates: [37.7879, -122.4137]
 *       }
 *     ],
 *     center: [37.7899, -122.4034],
 *     zoom: 14,
 *     mapStyle: "voyager",
 *     title: "Hotels in San Francisco"
 *   }}
 *   actions={{
 *     onSelectLocation: (loc) => console.log("Selected:", loc.name),
 *     onExpand: () => console.log("Expand to fullscreen")
 *   }}
 *   appearance={{
 *     mapHeight: "504px",
 *     displayMode: "inline"
 *   }}
 * />
 * ```
 */
export function MapCarousel({ data, actions, appearance }: MapCarouselProps) {
  const resolvedData: NonNullable<MapCarouselProps['data']> = data ?? { locations: demoMapLocations, center: demoMapCenter, zoom: demoMapZoom }
  const {
    locations = [],
    center = [37.7899, -122.4034], // San Francisco
    zoom = 14,
    mapStyle = 'voyager',
    title,
    filters: filterConfigs = []
  } = resolvedData

  const tileConfig = getTileConfig(mapStyle)
  const { onSelectLocation } = actions ?? {}
  const { mapHeight = '504px' } = appearance ?? {}

  const displayMode = appearance?.displayMode ?? 'inline'

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Filter state for fullscreen mode - initialized from filter configs
  const emptyFilterState = createEmptyFilterState(filterConfigs)
  const [showFilters, setShowFilters] = useState(false)
  const [filterState, setFilterState] = useState<FilterState>(emptyFilterState)
  const [appliedFilterState, setAppliedFilterState] = useState<FilterState>(emptyFilterState)

  // Refs for fullscreen scroll functionality
  const listContainerRef = useRef<HTMLDivElement>(null)
  const locationItemRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Filter locations based on applied filters using dynamic matchFn
  const filterLocations = useCallback((locationsToFilter: Location[], filtersToApply: FilterState): Location[] => {
    // If no filter configs, return all locations
    if (filterConfigs.length === 0) return locationsToFilter

    return locationsToFilter.filter(location => {
      // Check each filter section
      for (const config of filterConfigs) {
        const selectedValues = filtersToApply[config.id] || []
        // Skip if no values selected for this filter
        if (selectedValues.length === 0) continue

        // Use the matchFn if provided, otherwise skip this filter
        if (config.matchFn) {
          if (!config.matchFn(location, selectedValues)) {
            return false
          }
        }
      }
      return true
    })
  }, [filterConfigs])

  // Scroll to location in list when selected from map
  const scrollToLocation = useCallback((locationIndex: number) => {
    const locationElement = locationItemRefs.current.get(locationIndex)
    if (locationElement && listContainerRef.current) {
      const container = listContainerRef.current
      const elementTop = locationElement.offsetTop
      const elementHeight = locationElement.offsetHeight
      const containerHeight = container.offsetHeight
      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2

      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      })
    }
  }, [])

  // Handle location selection
  const handleSelectLocation = useCallback(
    (location: Location, index: number) => {
      setSelectedIndex(index)
      onSelectLocation?.(location)

      // Scroll to the selected card (inline mode)
      const cardElement = cardRefs.current.get(index)
      if (cardElement && carouselRef.current) {
        const container = carouselRef.current
        const cardLeft = cardElement.offsetLeft
        const cardWidth = cardElement.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollTo = cardLeft - containerWidth / 2 + cardWidth / 2

        container.scrollTo({
          left: scrollTo,
          behavior: 'smooth'
        })
      }
    },
    [onSelectLocation]
  )

  // Handle expand button click — display mode changes handled by host wrapper
  const handleExpand = () => {
    // No-op: display mode is managed by the HostAPIProvider
  }

  // Drag handlers for carousel
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!carouselRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.pageX - carouselRef.current.offsetLeft)
    setScrollLeft(carouselRef.current.scrollLeft)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !carouselRef.current) return
      e.preventDefault()
      const x = e.pageX - carouselRef.current.offsetLeft
      const walk = (x - startX) * 1.5
      if (Math.abs(walk) > 5) {
        setHasDragged(true)
      }
      carouselRef.current.scrollLeft = scrollLeft - walk
    },
    [isDragging, startX, scrollLeft]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!carouselRef.current) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.touches[0].pageX - carouselRef.current.offsetLeft)
    setScrollLeft(carouselRef.current.scrollLeft)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !carouselRef.current) return
      const x = e.touches[0].pageX - carouselRef.current.offsetLeft
      const walk = (x - startX) * 1.5
      if (Math.abs(walk) > 5) {
        setHasDragged(true)
      }
      carouselRef.current.scrollLeft = scrollLeft - walk
    },
    [isDragging, startX, scrollLeft]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle card click (only if not dragging)
  const handleCardClick = useCallback(
    (location: Location, index: number) => {
      if (hasDragged) return
      handleSelectLocation(location, index)
      if (location.link) {
        window.open(location.link, '_blank', 'noopener,noreferrer')
      }
    },
    [hasDragged, handleSelectLocation]
  )

  // Fullscreen mode - split-screen with cards on left, map on right
  if (displayMode === 'fullscreen') {
    const handleLocationHover = (locationIndex: number | null) => {
      setSelectedIndex(locationIndex)
    }

    const handleLocationClick = (location: Location, index: number) => {
      setSelectedIndex(index)
      onSelectLocation?.(location)
      if (location.link) {
        window.open(location.link, '_blank', 'noopener,noreferrer')
      }
    }

    const handleMapMarkerClick = (location: Location, index: number) => {
      setSelectedIndex(index)
      scrollToLocation(index)
      onSelectLocation?.(location)
    }

    const handleFilterButtonClick = () => {
      setFilterState(appliedFilterState)
      setShowFilters(true)
    }

    const handleApplyFilters = () => {
      setAppliedFilterState(filterState)
      setShowFilters(false)
    }

    const handleResetFilters = () => {
      setFilterState(emptyFilterState)
      setAppliedFilterState(emptyFilterState)
    }

    // Get filtered locations
    const filteredLocations = filterLocations(locations, appliedFilterState)
    // Get preview count for filter panel
    const previewFilteredCount = filterLocations(locations, filterState).length
    // Count of active filters
    const activeFiltersCount = Object.values(appliedFilterState).flat().length
    // Check if filters are configured
    const hasFilters = filterConfigs.length > 0

    return (
      <div className="flex w-full h-full min-h-[600px] bg-background">
        {displayMode === 'fullscreen' && !appearance?.hideSidebar && (
          <div
            ref={listContainerRef}
            className="w-[350px] border-r overflow-y-auto bg-card shrink-0 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                {title && <span className="font-semibold truncate">{title}</span>}
                <span className="text-muted-foreground text-xs whitespace-nowrap">| {filteredLocations.length}</span>
              </div>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-shrink-0"
                  onClick={handleFilterButtonClick}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              )}
            </div>

            {/* Scrollable Location List */}
            <div className="flex-1 overflow-y-auto">
              {filteredLocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <p className="text-muted-foreground">No locations match your filters</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={handleResetFilters}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : (
                filteredLocations.map((location, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      if (el) locationItemRefs.current.set(index, el)
                    }}
                  >
                    <LocationListCard
                      location={location}
                      isSelected={selectedIndex === index}
                      onClick={() => handleLocationClick(location, index)}
                      onMouseEnter={() => handleLocationHover(index)}
                      onMouseLeave={() => handleLocationHover(null)}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Filter Panel Overlay */}
            {hasFilters && (
              <FilterPanel
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                filterConfigs={filterConfigs}
                filterState={filterState}
                onFiltersChange={setFilterState}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                resultCount={previewFilteredCount}
              />
            )}
          </div>
        )}

        {/* Right Panel - Map */}
        <div className="flex flex-1 min-w-0 relative">
          <VanillaLeafletMap
            center={center}
            zoom={zoom}
            tileConfig={tileConfig}
            locations={filteredLocations}
            selectedIndex={selectedIndex}
            onSelectLocation={handleMapMarkerClick}
            useHeatmap={data?.useHeatmap}
          />
        </div>
      </div>
    )
  }

  // Inline and PiP modes - Map with carousel at bottom
  return (
    <div
      className="relative w-full rounded-xl border bg-card overflow-hidden"
      style={{ height: mapHeight }}
    >
      {/* Expand button in top right */}
      <div className="absolute top-3 right-3 z-[1001]">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-md"
          onClick={handleExpand}
          aria-label="Expand to fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Section - Full size */}
      <VanillaLeafletMap
        center={center}
        zoom={zoom}
        tileConfig={tileConfig}
        locations={locations}
        selectedIndex={selectedIndex}
        onSelectLocation={handleSelectLocation}
      />

      {/* Carousel Section - Overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div
          ref={carouselRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={cn(
            'flex gap-3 p-3 overflow-x-auto scrollbar-hide',
            isDragging ? 'cursor-grabbing' : 'cursor-grab',
            'select-none'
          )}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {locations.map((location, index) => (
            <div
              key={index}
              ref={(el) => {
                if (el)
                  cardRefs.current.set(
                    index,
                    el as unknown as HTMLButtonElement
                  )
              }}
            >
              <HotelCard
                location={location}
                isSelected={selectedIndex === index}
                onClick={() => handleCardClick(location, index)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
