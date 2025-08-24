import { MockNameData, mockNamesByType } from '@/lib/mock';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '@/lib/firebaseAdmin';

interface GenerateNamesRequest {
  petDescription?: string;
  petTypes?: string[];
  petCharacteristics?: string[];
  nameStyles?: string[];
  uploadedImages?: string[];
  previouslyGeneratedNames?: string[];
}

interface PetName {
  id: string;
  name: string;
  meaning?: string;
  origin?: string;
}

interface GenerationResult {
  names: PetName[];
  source: 'llm' | 'database' | 'local';
  fallback: boolean;
}

// Initialize AI client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Main generation function with fallback chain
async function generateNames(request: GenerateNamesRequest): Promise<GenerationResult> {
  const cleanRequest = validateRequest(request);
  
  // Try LLM first (primary method)
  try {
    console.log('🤖 Attempting LLM generation');
    const names = await generateWithLLM(cleanRequest);
    await saveToDatabase(names, cleanRequest);
    return { names, source: 'llm', fallback: false };
  } catch (error) {
    console.log('❌ LLM failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Fallback to database
  try {
    console.log('🗄️ Attempting database retrieval');
    const names = await getFromDatabase(cleanRequest);
    if (names.length > 0) {
      return { names, source: 'database', fallback: true };
    }
  } catch (error) {
    console.log('❌ Database failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Final fallback to local mock data
  console.log('📁 Using local mock data');
  const names = generateFromLocalData(cleanRequest);
  return { names, source: 'local', fallback: true };
}

function validateRequest(request: GenerateNamesRequest): GenerateNamesRequest {
  const cleaned = { ...request };
  
  // Ensure we have a description
  if (!cleaned.petDescription?.trim()) {
    cleaned.petDescription = cleaned.petTypes?.length 
      ? `A ${cleaned.petTypes.join(', ')} pet` 
      : 'A wonderful pet';
  }

  return cleaned;
}

async function generateWithLLM(request: GenerateNamesRequest): Promise<PetName[]> {
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const nameCount = parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10);
  const prompt = buildPrompt(request, nameCount);
  const model = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-lite';

  console.log('ℹ️ Using model', model);
  console.log('ℹ️ Using prompt', prompt);

  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            origin: { type: Type.STRING },
            meaning: { type: Type.STRING }
          },
          propertyOrdering: ["name", "origin", "meaning"]
        }
      },
      systemInstruction: "You are a creative pet name generator that responds with detailed, meaningful name suggestions in structured JSON format."
    }
  });

  if (!result.text) {
    throw new Error('No response from Gemini API');
  }

  const parsedResponse = parseGeminiResponse(result.text, nameCount);
  console.log(`✅ Model Generated ${parsedResponse.length} names from LLM`);
  return parsedResponse;
}

function buildPrompt(request: GenerateNamesRequest, nameCount: number): string {
  const parts = [
    `Generate ${nameCount} unique and meaningful pet names based on the following criteria:`,
    request.petDescription ? `Description: ${request.petDescription}` : '',
    request.petTypes?.length ? `Pet type: ${request.petTypes.join(', ')}` : '',
    request.petCharacteristics?.length ? `Pet characteristics: ${request.petCharacteristics.join(', ')}` : '',
    request.nameStyles?.length ? `Name style: ${request.nameStyles.join(', ')}` : '',
    '',
    'For each name, provide:',
    '1. The name itself',
    '2. Its cultural or linguistic origin',
    '3. The meaning or symbolism behind the name',
    '',
    'Ensure each name:',
    '- Is memorable and unique',
    '- Has cultural or historical significance',
    '- Reflects the pet\'s characteristics',
    '- Is easy to pronounce',
    '- Has a positive meaning or association'
  ];

  if (request.previouslyGeneratedNames?.length) {
    parts.push('', `Avoid these previously generated names: ${request.previouslyGeneratedNames.join(', ')}`);
  }

  return parts.filter(Boolean).join('\n');
}

function parseGeminiResponse(response: string, nameCount: number): PetName[] {
  try {
    const parsedResponse = JSON.parse(response);
    
    if (!Array.isArray(parsedResponse)) {
      throw new Error('Invalid response structure - expected array');
    }

    const validNames = parsedResponse
      .filter(nameData => 
        nameData && 
        typeof nameData.name === 'string' && 
        typeof nameData.origin === 'string' && 
        typeof nameData.meaning === 'string'
      )
      .slice(0, nameCount)
      .map(nameData => ({
        id: uuidv4(),
        name: nameData.name,
        meaning: nameData.meaning,
        origin: nameData.origin
      }));

    if (validNames.length === 0) {
      throw new Error('No valid names in response');
    }

    return validNames;
  } catch {
    throw new Error('Failed to parse LLM response');
  }
}

async function saveToDatabase(names: PetName[], request: GenerateNamesRequest): Promise<void> {
  try {
    const batch = db.batch();
    
    names.forEach(name => {
      const docRef = db.collection('names').doc();
      batch.set(docRef, {
        nameId: name.id,
        name: name.name,
        meaning: name.meaning,
        origin: name.origin,
        petDescription: request.petDescription,
        petTypes: request.petTypes || [],
        petCharacteristics: request.petCharacteristics || [],
        nameStyles: request.nameStyles || [],
        numberOfImagesAttached: request.uploadedImages?.length || 0,
        createdAt: new Date(),
        generatedBy: 'llm'
      });
    });
    
    await batch.commit();
    console.log(`✅ Saved ${names.length} names to database`);
  } catch (error) {
    console.error('❌ Failed to save to database:', error instanceof Error ? error.message : 'Unknown error');
    // Don't throw - saving is not critical
  }
}

async function getFromDatabase(request: GenerateNamesRequest): Promise<PetName[]> {
  const nameCount = parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10);
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('names');
  
  // Apply the most specific filter
  const filters = [
    { field: 'petTypes', values: request.petTypes },
    { field: 'nameStyles', values: request.nameStyles },
    { field: 'petCharacteristics', values: request.petCharacteristics }
  ];
  
  const primaryFilter = filters.find(f => f.values && f.values.length > 0);
  if (primaryFilter) {
    query = query.where(primaryFilter.field, 'array-contains-any', primaryFilter.values);
  }
  
  query = query.orderBy('createdAt', 'desc').limit(nameCount * 3);
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    return [];
  }
  
  // Filter results in memory for additional criteria
  const filteredNames = snapshot.docs
    .map(doc => ({
      doc,
      data: doc.data(),
      matches: calculateMatches(doc.data(), request, filters.filter(f => f !== primaryFilter))
    }))
    .filter(item => item.matches > 0)
    .sort((a, b) => b.matches - a.matches || (b.data.createdAt?.toDate?.() || 0) - (a.data.createdAt?.toDate?.() || 0))
    .slice(0, nameCount)
    .map(item => ({
      id: item.doc.id,
      name: item.data.name,
      meaning: item.data.meaning || '',
      origin: item.data.origin || ''
    }));

  return filteredNames;
}

function calculateMatches(data: any, request: GenerateNamesRequest, additionalFilters: any[]): number {
  let matches = 1; // Base match since it passed primary filter
  
  additionalFilters.forEach(filter => {
    if (filter.values && filter.values.length > 0) {
      const docValues = data[filter.field] || [];
      if (filter.values.some((value: string) => docValues.includes(value))) {
        matches++;
      }
    }
  });
  
  return matches;
}

function generateFromLocalData(request: GenerateNamesRequest): PetName[] {
  const nameCount = parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10);
  
  // Collect names from pet types
  let namePool: MockNameData[] = [];
  request.petTypes?.forEach(type => {
    if (mockNamesByType[type]) {
      namePool.push(...mockNamesByType[type]);
    }
  });
  
  // Fallback to 'other' if no names collected
  if (namePool.length === 0) {
    namePool = mockNamesByType.other || [];
  }
  
  // Score names based on matches
  const scored = namePool.map(nameData => ({
    ...nameData,
    score: scoreLocalName(nameData, request)
  }));
  
  // Sort by score, then randomly within same score
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
  
  return scored.slice(0, nameCount).map((nameData, index) => ({
    id: `local-${Date.now()}-${index}`,
    name: nameData.name,
    meaning: nameData.meaning,
    origin: nameData.origin
  }));
}

function scoreLocalName(nameData: MockNameData, request: GenerateNamesRequest): number {
  const text = `${nameData.name} ${nameData.meaning}`.toLowerCase();
  const description = request.petDescription?.toLowerCase() || '';
  let score = 0;
  
  // Match description
  if (description && text.includes(description)) score += 2;
  
  // Match name styles
  if (request.nameStyles?.some(style => text.includes(style.toLowerCase()))) {
    score += 1;
  }
  
  // Match characteristics
  const characteristicKeywords: Record<string, string[]> = {
    'white': ['white', 'light', 'bright', 'pure', 'snow', 'cloud'],
    'brown': ['brown', 'earth', 'wood', 'warm', 'coffee', 'chocolate'],
    'small': ['small', 'tiny', 'little', 'mini', 'petite', 'delicate'],
    'big': ['big', 'large', 'huge', 'giant', 'strong', 'mighty']
  };
  
  request.petCharacteristics?.forEach(characteristic => {
    const keywords = characteristicKeywords[characteristic] || [];
    if (keywords.some(keyword => text.includes(keyword))) {
      score += 1;
    }
  });
  
  return score;
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const body: GenerateNamesRequest = await request.json();
    
    console.log('ℹ️ Name generation request received');
    console.log('ℹ️ Pet Description:', body.petDescription);
    console.log('ℹ️ Pet Types:', body.petTypes);
    console.log('ℹ️ Pet Characteristics:', body.petCharacteristics);
    console.log('ℹ️ Name Styles:', body.nameStyles);
    console.log('ℹ️ Images:', body.uploadedImages?.length || 0);
    console.log('ℹ️ PreviouslyGeneratedName:', body.previouslyGeneratedNames?.length ? body.previouslyGeneratedNames.join(',') : 0);

    const result = await generateNames(body);

    console.log(`✅ Returning ${result.names.length} names from ${result.source} to client`);

    return NextResponse.json({
      success: true,
      names: result.names,
      count: result.names.length,
      timestamp: new Date().toISOString(),
      source: process.env.NODE_ENV === 'production' ? undefined : result.source,
      fallback: result.fallback
    });

  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to generate names' },
      { status: 500 }
    );
  }
}