import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 70, 50];
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s: number;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
    h *= 360;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/* ------------------------------------------------------------------ */
/*  ColorWheel Component                                                */
/* ------------------------------------------------------------------ */

interface ColorWheelProps {
  value: string;
  onChange: (color: string) => void;
  size?: number;
  className?: string;
}

export function ColorWheel({
  value,
  onChange,
  size = 160,
  className,
}: ColorWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value));

  // Sync from external value
  useEffect(() => {
    setHsl(hexToHsl(value));
  }, [value]);

  const ringWidth = size * 0.15;
  const center = size / 2;
  const outerR = center - 2;
  const innerR = outerR - ringWidth;

  // Draw hue ring
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    // Draw hue ring
    for (let angle = 0; angle < 360; angle += 0.5) {
      const rad = (angle - 90) * (Math.PI / 180);
      ctx.beginPath();
      ctx.arc(center, center, outerR, rad, rad + 0.015);
      ctx.arc(center, center, innerR, rad + 0.015, rad, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 70%, 50%)`;
      ctx.fill();
    }

    // Draw saturation/lightness preview in center circle
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, innerR - 4);
    const hex = hslToHex(hsl[0], hsl[1], hsl[2]);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, hex);
    gradient.addColorStop(1, hex);
    ctx.beginPath();
    ctx.arc(center, center, innerR - 4, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
  }, [size, center, outerR, innerR, hsl]);

  // Get angle from mouse position
  const getAngle = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - center * (rect.width / size);
    const y = clientY - rect.top - center * (rect.height / size);
    const dist = Math.sqrt(x * x + y * y);
    const scale = rect.width / size;
    const scaledInner = innerR * scale;
    const scaledOuter = (outerR + 6) * scale;

    if (dist < scaledInner * 0.7 || dist > scaledOuter) return null;

    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    return angle;
  }, [center, innerR, outerR, size]);

  const updateFromAngle = useCallback((angle: number) => {
    const newHsl: [number, number, number] = [Math.round(angle), hsl[1], hsl[2]];
    setHsl(newHsl);
    onChange(hslToHex(newHsl[0], newHsl[1], newHsl[2]));
  }, [hsl, onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const angle = getAngle(e.clientX, e.clientY);
    if (angle == null) return;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromAngle(angle);
  }, [getAngle, updateFromAngle]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - center * (rect.width / size);
    const y = e.clientY - rect.top - center * (rect.height / size);
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    updateFromAngle(angle);
  }, [center, size, updateFromAngle]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Thumb position on the ring
  const thumbAngle = (hsl[0] - 90) * (Math.PI / 180);
  const thumbR = innerR + ringWidth / 2;
  const thumbX = center + thumbR * Math.cos(thumbAngle);
  const thumbY = center + thumbR * Math.sin(thumbAngle);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {/* Thumb indicator */}
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white shadow-md"
          style={{
            width: ringWidth + 2,
            height: ringWidth + 2,
            left: thumbX - (ringWidth + 2) / 2,
            top: thumbY - (ringWidth + 2) / 2,
            background: hslToHex(hsl[0], 70, 50),
            boxShadow: '0 0 0 1px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Saturation & Lightness sliders */}
      <div className="flex w-full items-center gap-3 px-1">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">饱和度</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{hsl[1]}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={hsl[1]}
            onChange={(e) => {
              const s = Number(e.target.value);
              const newHsl: [number, number, number] = [hsl[0], s, hsl[2]];
              setHsl(newHsl);
              onChange(hslToHex(newHsl[0], newHsl[1], newHsl[2]));
            }}
            className="color-slider w-full"
            style={{
              background: `linear-gradient(to right, ${hslToHex(hsl[0], 10, hsl[2])}, ${hslToHex(hsl[0], 100, hsl[2])})`,
            }}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">亮度</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{hsl[2]}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            value={hsl[2]}
            onChange={(e) => {
              const l = Number(e.target.value);
              const newHsl: [number, number, number] = [hsl[0], hsl[1], l];
              setHsl(newHsl);
              onChange(hslToHex(newHsl[0], newHsl[1], newHsl[2]));
            }}
            className="color-slider w-full"
            style={{
              background: `linear-gradient(to right, ${hslToHex(hsl[0], hsl[1], 20)}, ${hslToHex(hsl[0], hsl[1], 50)}, ${hslToHex(hsl[0], hsl[1], 80)})`,
            }}
          />
        </div>
      </div>

      {/* Hex preview */}
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full border border-border shadow-sm"
          style={{ background: value }}
        />
        <span className="text-xs font-mono text-muted-foreground uppercase">{value}</span>
      </div>
    </div>
  );
}
