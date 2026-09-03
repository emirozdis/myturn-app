export type RecordingFacing = 'front' | 'back';
export type RecordingSpeed = 1 | 2;

export interface RecordingSegment {
  id: string;
  uri: string;
  byteLength: number;
  durationMs: number;
  speed: RecordingSpeed;
  facing: RecordingFacing;
}

export interface RecordingCompositionSegment {
  offset: number;
  length: number;
  durationMs: number;
  speed: RecordingSpeed;
  facingMode: 'user' | 'environment';
}

export interface RecordingCompositionMetadata {
  composition: {
    version: 1;
    totalBytes: number;
    totalSourceDurationMs: number;
    segments: RecordingCompositionSegment[];
  };
  speedBaked: true;
}

export function createCompositionMetadata(
  segments: RecordingSegment[],
): RecordingCompositionMetadata {
  let offset = 0;
  const manifestSegments = segments.map((segment) => {
    const manifestSegment: RecordingCompositionSegment = {
      offset,
      length: segment.byteLength,
      durationMs: segment.durationMs,
      speed: segment.speed,
      facingMode: segment.facing === 'front' ? 'user' : 'environment',
    };
    offset += segment.byteLength;
    return manifestSegment;
  });

  return {
    composition: {
      version: 1,
      totalBytes: offset,
      totalSourceDurationMs: segments.reduce((sum, segment) => sum + segment.durationMs, 0),
      segments: manifestSegments,
    },
    speedBaked: true,
  };
}
