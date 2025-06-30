import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

// Lightweight text extraction functions to avoid memory issues
async function extractText(file: File): Promise<string> {
  console.log('Extracting text from file:', file.name, 'type:', file.type, 'size:', file.size);
  
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('File converted to buffer, size:', buffer.length);
    
    switch (file.type) {
      case 'application/pdf':
        return await extractTextFromPDF(buffer);
      case 'text/plain':
        return await extractTextFromTXT(buffer);
      default:
        throw new Error(`Unsupported file type: ${file.type}`);
    }
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw error;
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting PDF text extraction, buffer size:', buffer.length);
    
    // Check buffer size to prevent memory issues
    const maxBufferSize = 5 * 1024 * 1024; // 5MB limit for PDF processing
    if (buffer.length > maxBufferSize) {
      throw new Error('PDF file is too large for processing. Please use a smaller file (max 5MB) or convert to TXT format.');
    }
    
    // Use dynamic import with error handling for memory constraints
    let pdfParse;
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch (importError) {
      console.error('Failed to import pdf-parse:', importError);
      throw new Error('PDF processing is temporarily unavailable. Please convert your PDF to a TXT file and try again.');
    }
    
    // Process with memory-conscious options
    const data = await pdfParse(buffer, {
      max: 100 // Limit to first 100 pages
    });
    
    console.log('PDF extraction successful, text length:', data.text.length);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
    }
    
    return data.text;
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    
    // Handle specific memory-related errors
    if (error instanceof Error) {
      if (error.message.includes('memory') || error.message.includes('WebAssembly')) {
        throw new Error('PDF processing failed due to memory constraints. Please try a smaller PDF file or convert to TXT format.');
      }
      if (error.message.includes('ENOENT')) {
        throw new Error('PDF processing dependencies are unavailable. Please convert your PDF to a TXT file.');
      }
    }
    
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the PDF contains selectable text and is not corrupted, or try converting to TXT format.`);
  }
}

async function extractTextFromTXT(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting TXT text extraction, buffer size:', buffer.length);
    const text = buffer.toString('utf-8');
    console.log('TXT extraction successful, text length:', text.length);
    return text;
  } catch (error) {
    console.error('Error extracting text from TXT:', error);
    throw new Error(`Failed to extract text from TXT file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function splitIntoChunks(text: string, maxChunkSize: number = 1500): string[] {
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

export async function POST(request: NextRequest) {
  console.log('=== Upload KB API Route Started ===');
  
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    // Get user from session
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized - missing auth header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - invalid token format' }, { status: 401 });
    }

    console.log('Verifying user token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ 
        error: 'Invalid authentication',
        details: authError.message 
      }, { status: 401 });
    }

    if (!user) {
      console.error('No user found for token');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    console.log('User authenticated:', user.id);

    // Parse form data
    console.log('Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const demoId = formData.get('demoId') as string;

    console.log('Form data extracted:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      demoId: demoId
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!demoId) {
      return NextResponse.json({ error: 'Demo ID is required' }, { status: 400 });
    }

    // Validate file type and size - reduced max size to prevent memory issues
    const allowedTypes = ['application/pdf', 'text/plain'];
    const maxSize = 5 * 1024 * 1024; // Reduced to 5MB to prevent memory issues

    if (!allowedTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF and TXT files are allowed.' 
      }, { status: 400 });
    }

    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB to ensure reliable processing.' 
      }, { status: 400 });
    }

    // Verify demo ownership
    console.log('Verifying demo ownership...');
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, user_id')
      .eq('id', demoId)
      .eq('user_id', user.id)
      .single();

    if (demoError) {
      console.error('Demo verification error:', demoError);
      return NextResponse.json({ 
        error: 'Demo not found or access denied',
        details: demoError.message
      }, { status: 404 });
    }

    if (!demo) {
      console.error('Demo not found for user');
      return NextResponse.json({ 
        error: 'Demo not found or you do not have permission to access it' 
      }, { status: 404 });
    }

    console.log('Demo ownership verified');

    // Extract text from file with error handling for memory issues
    console.log('Starting text extraction...');
    let extractedText: string;
    
    try {
      extractedText = await extractText(file);
      console.log('Text extraction successful, length:', extractedText.length);
    } catch (extractionError) {
      console.error('Text extraction failed:', extractionError);
      
      // Provide helpful error message for memory issues
      if (extractionError instanceof Error && 
          (extractionError.message.includes('memory') || 
           extractionError.message.includes('WebAssembly'))) {
        return NextResponse.json({ 
          error: 'File processing failed due to memory constraints. Please try uploading a smaller file or convert your PDF to TXT format for better compatibility.' 
        }, { status: 413 });
      }
      
      return NextResponse.json({ 
        error: extractionError instanceof Error ? extractionError.message : 'Failed to process file' 
      }, { status: 400 });
    }

    if (!extractedText || extractedText.trim().length < 50) {
      console.error('Insufficient text content:', extractedText?.length || 0);
      return NextResponse.json({ 
        error: 'File appears to be empty or contains insufficient text content (minimum 50 characters required)' 
      }, { status: 400 });
    }

    // Clean and normalize text
    console.log('Cleaning and normalizing text...');
    const cleanedText = extractedText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    console.log('Text cleaned, final length:', cleanedText.length);

    // Split text into smaller chunks to reduce memory usage
    console.log('Splitting text into chunks...');
    const chunks = splitIntoChunks(cleanedText, 1500); // Reduced chunk size
    console.log('Text chunking successful, chunks created:', chunks.length);

    if (chunks.length === 0) {
      console.error('No chunks created from text');
      return NextResponse.json({ 
        error: 'No valid text chunks could be created from the file' 
      }, { status: 400 });
    }

    // Store chunks in Supabase in smaller batches to prevent memory issues
    console.log('Storing chunks in database...');
    const processedChunks = chunks.map((chunk, index) => ({
      content: chunk,
      chunk_index: index,
      demo_id: demoId
    }));

    // Insert in batches to prevent memory issues
    const batchSize = 10;
    const insertedChunks = [];
    
    for (let i = 0; i < processedChunks.length; i += batchSize) {
      const batch = processedChunks.slice(i, i + batchSize);
      
      const { data: batchResult, error: insertError } = await supabase
        .from('knowledge_base_chunks')
        .insert(batch)
        .select();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return NextResponse.json({ 
          error: `Failed to save knowledge base to database: ${insertError.message}`,
          details: insertError
        }, { status: 500 });
      }

      if (batchResult) {
        insertedChunks.push(...batchResult);
      }
    }

    console.log('Chunks stored successfully:', insertedChunks.length);

    // Update demo with knowledge base info
    console.log('Updating demo with knowledge base info...');
    const { error: updateError } = await supabase
      .from('demos')
      .update({
        knowledge_base_filename: file.name,
        knowledge_base_content: cleanedText,
        updated_at: new Date().toISOString()
      })
      .eq('id', demoId);

    if (updateError) {
      console.error('Demo update error:', updateError);
      // Don't fail the request if demo update fails, chunks are already saved
    } else {
      console.log('Demo updated successfully');
    }

    // Return success response
    const response = {
      success: true,
      data: {
        filename: file.name,
        fileSize: file.size,
        textLength: cleanedText.length,
        chunksCreated: processedChunks.length,
        chunksStored: insertedChunks.length,
        preview: cleanedText.substring(0, 500) + (cleanedText.length > 500 ? '...' : '')
      }
    };

    console.log('=== Upload KB API Route Completed Successfully ===');
    return NextResponse.json(response);

  } catch (error) {
    console.error('=== Upload KB API Route Error ===');
    console.error('Error details:', error);
    
    // Handle memory-related errors specifically
    if (error instanceof Error && 
        (error.message.includes('memory') || 
         error.message.includes('WebAssembly') ||
         error.message.includes('Out of memory'))) {
      return NextResponse.json({ 
        error: 'Processing failed due to memory constraints. Please try uploading a smaller file or convert your PDF to TXT format.',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          type: 'memory_error'
        } : undefined
      }, { status: 413 });
    }
    
    return NextResponse.json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: process.env.NODE_ENV === 'development' ? {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      } : undefined
    }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}