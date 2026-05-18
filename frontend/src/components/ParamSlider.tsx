import { useEffect, useId } from 'react';

export interface ParamSliderProps {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  description?: string;
  onChange: (name: string, value: number) => void;
}

const SLIDER_CSS = `
.ps-range {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.15s;
}
.ps-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2563eb;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}
.ps-range:hover::-webkit-slider-thumb,
.ps-range:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(37,99,235,0.15), 0 1px 3px rgba(0,0,0,0.15);
  transform: scale(1.15);
}
.ps-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2563eb;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}
.ps-range:hover::-moz-range-thumb {
  box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
}
.ps-range:focus { outline: none; }
`;

let sliderStyleInjected = false;

function formatValue(value: number, step: number): string {
  if (Number.isInteger(step)) return String(value);
  const decimals = String(step).split('.')[1]?.length ?? 2;
  return value.toFixed(decimals);
}

export default function ParamSlider({
  label,
  name,
  value,
  min,
  max,
  step,
  unit,
  description,
  onChange,
}: ParamSliderProps) {
  const inputId = useId();

  useEffect(() => {
    if (sliderStyleInjected) return;
    sliderStyleInjected = true;
    const el = document.createElement('style');
    el.textContent = SLIDER_CSS;
    document.head.appendChild(el);
  }, []);

  const fillPct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2">
      {/* Row: label + value */}
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="font-display text-sm text-text-secondary flex-1 cursor-pointer select-none"
        >
          {label}
        </label>

        <div className="flex items-baseline gap-1 min-w-[4.5rem] justify-end">
          <span className="font-mono text-sm font-medium text-text-primary tabular-nums">
            {formatValue(value, step)}
          </span>
          {unit && (
            <span className="font-mono text-xs text-text-muted">{unit}</span>
          )}
        </div>
      </div>

      {/* Range input — fill color via inline style */}
      <input
        id={inputId}
        type="range"
        name={name}
        value={value}
        min={min}
        max={max}
        step={step}
        className="ps-range"
        style={{
          background: `linear-gradient(to right, #2563eb ${fillPct}%, #e2e8f0 ${fillPct}%)`,
        }}
        onChange={(e) => onChange(name, Number(e.target.value))}
      />

      {/* Optional description */}
      {description && (
        <p className="font-body text-xs italic text-text-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
