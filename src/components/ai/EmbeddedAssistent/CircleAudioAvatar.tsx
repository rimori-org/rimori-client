import { useEffect, useRef } from 'react';
import { EventBus, EventBusMessage } from '../../../fromRimori/EventBus';

interface CircleAudioAvatarProps {
  width?: string;
  imageUrl: string;
  className?: string;
  isDarkTheme?: boolean;
}

export function CircleAudioAvatar({
  imageUrl,
  className,
  isDarkTheme = false,
  width = '150px',
}: CircleAudioAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLoudnessRef = useRef(0);
  const targetLoudnessRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const image = new Image();
        image.src = imageUrl;
        let isMounted = true;

        image.onload = () => {
          if (!isMounted) return;
          draw(ctx, canvas, image, 0);
          const animate = () => {
            const decayRate = 0.06;
            if (currentLoudnessRef.current > targetLoudnessRef.current) {
              currentLoudnessRef.current = Math.max(
                targetLoudnessRef.current,
                currentLoudnessRef.current - decayRate * currentLoudnessRef.current,
              );
            } else {
              currentLoudnessRef.current = targetLoudnessRef.current;
            }
            draw(ctx, canvas, image, currentLoudnessRef.current);
            animationFrameRef.current = requestAnimationFrame(animate);
          };
          animationFrameRef.current = requestAnimationFrame(animate);
        };

        const handleLoudness = ({ data }: EventBusMessage) => {
          const newLoudness = data.loudness;
          if (newLoudness > currentLoudnessRef.current) {
            currentLoudnessRef.current = newLoudness;
          }
          targetLoudnessRef.current = newLoudness;
        };

        const listener = EventBus.on('self.avatar.triggerLoudness', handleLoudness);

        return () => {
          isMounted = false;
          listener.off();
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        };
      }
    }
  }, [imageUrl]);

  const draw = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    loudness: number,
  ) => {
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const radius = Math.min(canvas.width, canvas.height) / 3;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const pulseRadius = radius + loudness / 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2, true);
      ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, centerX - radius, centerY - radius, radius * 2, radius * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
      ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  };

  return <canvas ref={canvasRef} className={className} width={500} height={500} style={{ width }} />;
}
