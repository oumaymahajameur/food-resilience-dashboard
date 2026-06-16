// components/TimeSlider.tsx
import { useState } from 'react';

interface TimeSliderProps {
  year: number;
  onYearChange: (year: number) => void;
}

export default function TimeSlider({ year, onYearChange }: TimeSliderProps) {
  return (
    <div>
      <span>Year: {year}</span>
      <input
        type="range"
        min={2015}
        max={2025}
        step={1}
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
      />
    </div>
  );
}