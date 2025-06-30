// Simple text processing utilities (no OpenAI dependency needed for basic chunking)

// Simple text chunking for knowledge base storage (no embeddings)
export function splitIntoChunks(text: string, maxChunkSize: number = 2000): string[] {
  console.log('Starting text chunking, input length:', text.length, 'max chunk size:', maxChunkSize);
  
  if (!text || text.trim().length === 0) {
    console.log('Empty text provided for chunking');
    return [];
  }

  // Split by paragraphs first, then by sentences if needed
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  console.log('Split into paragraphs:', paragraphs.length);
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // If adding this paragraph would exceed max size, start new chunk
    if (currentChunk.length + trimmedParagraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedParagraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  const filteredChunks = chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
  console.log('Chunking completed:', filteredChunks.length, 'chunks created');
  
  return filteredChunks;
}

// Convert chunks back to plain text for Tavus context
export function chunksToPlainText(chunks: string[]): string {
  return chunks.join('\n\n');
}