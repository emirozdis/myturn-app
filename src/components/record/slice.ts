import { File, FileMode } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

export const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;
const COPY_BUFFER_SIZE = 256 * 1024;

export interface SlicedChunk {
  partNumber: number;
  tempPath: string;
  byteSize: number;
}

export interface LogicalFileRange {
  uri: string;
  offset: number;
  length: number;
}

export function buildLogicalFileRanges(
  sources: Array<{ uri: string; size: number }>,
): LogicalFileRange[] {
  let offset = 0;
  return sources.map((source) => {
    if (!source.uri || !Number.isSafeInteger(source.size) || source.size <= 0) {
      throw new Error('Invalid recording source file.');
    }
    const range = { uri: source.uri, offset, length: source.size };
    offset += source.size;
    return range;
  });
}

/**
 * Streams several physical recording segments into one logical multipart
 * object. Every non-final part is exactly 5 MiB, even when a segment boundary
 * falls in the middle of that part, so the result is valid for S3/R2.
 */
export async function sliceFiles(fileUris: string[], taskId: string): Promise<SlicedChunk[]> {
  if (!fileUris.length) throw new Error('No recording sources were provided.');

  const chunkDir = `${FileSystem.cacheDirectory}uploads/${taskId}/`;
  await FileSystem.makeDirectoryAsync(chunkDir, { intermediates: true }).catch(() => {});

  const chunks: SlicedChunk[] = [];
  let outputHandle: ReturnType<File['open']> | null = null;
  let outputPath = '';
  let outputBytes = 0;

  const openOutput = () => {
    outputPath = `${chunkDir}part_${chunks.length + 1}.tmp`;
    const outputFile = new File(outputPath);
    if (outputFile.exists) outputFile.delete();
    outputFile.create({ intermediates: true });
    outputHandle = outputFile.open(FileMode.Truncate);
    outputBytes = 0;
  };

  const closeOutput = () => {
    if (!outputHandle) return;
    outputHandle.close();
    outputHandle = null;
    if (outputBytes > 0) {
      chunks.push({
        partNumber: chunks.length + 1,
        tempPath: outputPath,
        byteSize: outputBytes,
      });
    }
  };

  try {
    openOutput();
    for (const uri of fileUris) {
      const sourceFile = new File(uri);
      if (!sourceFile.exists || sourceFile.size <= 0) {
        throw new Error(`Recording source file is missing: ${uri}`);
      }

      const sourceHandle = sourceFile.open(FileMode.ReadOnly);
      try {
        let sourceRemaining = sourceFile.size;
        while (sourceRemaining > 0) {
          if (!outputHandle) openOutput();
          const chunkRemaining = UPLOAD_CHUNK_SIZE - outputBytes;
          const readLength = Math.min(COPY_BUFFER_SIZE, chunkRemaining, sourceRemaining);
          const bytes = sourceHandle.readBytes(readLength);
          if (!bytes.length) throw new Error(`Unexpected end of recording source: ${uri}`);
          outputHandle!.writeBytes(bytes);
          outputBytes += bytes.length;
          sourceRemaining -= bytes.length;

          if (outputBytes === UPLOAD_CHUNK_SIZE) closeOutput();
        }
      } finally {
        sourceHandle.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    closeOutput();
    return chunks;
  } catch (error) {
    try { closeOutput(); } catch {}
    await FileSystem.deleteAsync(chunkDir, { idempotent: true }).catch(() => {});
    console.error('[Slicer] Failed to create logical multipart chunks:', error);
    throw error;
  }
}

export async function sliceFile(fileUri: string, taskId: string): Promise<SlicedChunk[]> {
  return sliceFiles([fileUri], taskId);
}
