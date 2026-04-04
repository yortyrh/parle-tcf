'use client';

import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { ArrowsClockwise, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { ExerciseImageData } from '@/types/exercise-image';

interface ExerciseImageViewerProps {
  exerciseImage: ExerciseImageData | null;
}

/**
 * TEF exercise scan with zoom controls and touch pinch / pan (react-zoom-pan-pinch).
 */
export function ExerciseImageViewer({ exerciseImage }: ExerciseImageViewerProps) {
  if (!exerciseImage) return null;

  const { filename, section, id } = exerciseImage;
  const folder = section === 'A' ? 'TEF-A' : 'TEF-B';
  const src = `/tef-exercices/${folder}/${filename}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-card relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 pt-4 shadow-md ring-1 ring-black/5">
        <TransformWrapper
          initialScale={1}
          minScale={0.6}
          maxScale={4}
          centerOnInit
          centerZoomedOut
          limitToBounds={false}
          wheel={{ step: 0.12 }}
          panning={{ velocityDisabled: true }}
          doubleClick={{ mode: 'zoomIn', step: 0.7 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div
                className="absolute top-6 right-2 z-10 flex flex-col gap-1.5 sm:top-8 sm:right-3"
                role="toolbar"
                aria-label="Contrôles du zoom de l’image"
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="border-border/80 bg-card/95 size-10 border shadow-md backdrop-blur-sm"
                  aria-label="Zoom avant"
                  onClick={() => zoomIn(0.2)}
                >
                  <MagnifyingGlassPlus weight="bold" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="border-border/80 bg-card/95 size-10 border shadow-md backdrop-blur-sm"
                  aria-label="Zoom arrière"
                  onClick={() => zoomOut(0.2)}
                >
                  <MagnifyingGlassMinus weight="bold" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="border-border/80 bg-card/95 size-10 border shadow-md backdrop-blur-sm"
                  aria-label="Réinitialiser la vue"
                  onClick={() => resetTransform(200)}
                >
                  <ArrowsClockwise weight="bold" aria-hidden />
                </Button>
              </div>
              <TransformComponent
                wrapperClass="!size-full"
                contentClass="flex w-full justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- natural dimensions, zoomed inside viewport */}
                <img
                  src={src}
                  alt={`Exercice ${id}`}
                  className="block h-auto max-w-full min-w-0 touch-manipulation select-none"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
