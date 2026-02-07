'use client';

import { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  analyserData: Uint8Array | null;
  isRecording: boolean;
  width?: number;
  height?: number;
  barColor?: string;
  barWidth?: number;
  barGap?: number;
}

export function WaveformVisualizer({
  analyserData,
  isRecording,
  width = 300,
  height = 60,
  barColor = 'hsl(221.2, 83.2%, 53.3%)',
  barWidth = 3,
  barGap = 2,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const totalBarWidth = barWidth + barGap;
    const barCount = Math.floor(width / totalBarWidth);

    if (!isRecording || !analyserData) {
      // Draw flat idle bars
      ctx.fillStyle = 'hsl(215, 16.3%, 76.9%)';
      for (let i = 0; i < barCount; i++) {
        const x = i * totalBarWidth;
        const barHeight = 4;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      return;
    }

    // Draw active waveform
    ctx.fillStyle = barColor;
    const step = Math.floor(analyserData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.min(i * step, analyserData.length - 1);
      const value = analyserData[dataIndex] / 255;
      const barHeight = Math.max(4, value * height * 0.9);
      const x = i * totalBarWidth;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [analyserData, isRecording, width, height, barColor, barWidth, barGap]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="mx-auto block"
    />
  );
}
