type DualRangeSliderProps = {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

export function DualRangeSlider({ min, max, step, value, onChange }: DualRangeSliderProps) {
  const [low, high] = value;
  const span = max - min || 1;
  const minGap = step;

  const handleLowChange = (next: number) => {
    const clamped = Math.min(next, high - minGap);
    onChange([clamped, high]);
  };

  const handleHighChange = (next: number) => {
    const clamped = Math.max(next, low + minGap);
    onChange([low, clamped]);
  };

  const leftPct = ((low - min) / span) * 100;
  const rightPct = ((high - min) / span) * 100;

  return (
    <div className="dual-range">
      <div className="dual-range-track" />
      <div
        className="dual-range-fill"
        style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
      />
      {/* <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={low}
        aria-label="Valor minimo del eje"
        onChange={(event) => handleLowChange(Number(event.target.value))}
      /> */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={high}
        aria-label="Valor maximo del eje"
        onChange={(event) => handleHighChange(Number(event.target.value))}
      />
    </div>
  );
}