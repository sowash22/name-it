/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '@/lib/firebaseAdmin';
import fs from 'fs';
import path from 'path';


const localDbPath = path.resolve(process.cwd(), 'localdb.json')
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
    // Always save to Firestore
    await saveToDatabase(names, cleanRequest);

    // If local mode, also save to JSON DB
    try {
      // saveto local database in local dev
      await saveToLocalDatabse(names, cleanRequest);
    }
    catch (error) {
      console.log('❌ Saving to local database failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return { names, source: 'llm', fallback: false };
  } catch (error) {
    console.log('❌ LLM failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Fallback to Firestore
  try {
    console.log('🗄️ Attempting database retrieval');
    const names = await getFromDatabase(cleanRequest);
    if (names.length > 0) {
      return { names, source: 'database', fallback: true };
    }
  } catch (error) {
    console.log('❌ Database failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // Final fallback → Local JSON DB
  console.log('📁 Using local database fallback');
  const names = await getFromLocalDatabase(cleanRequest);
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



async function saveToLocalDatabse(names: PetName[], request: GenerateNamesRequest) {
  try {
    // 1. Fetch everything from Firestore
    const snapshot = await db.collection('names').get();
    const firestoreRecords = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2. Map newly generated names into same format
    const newRecords = names.map(n => ({
      ...n,
      petDescription: request.petDescription,
      petTypes: request.petTypes || [],
      petCharacteristics: request.petCharacteristics || [],
      nameStyles: request.nameStyles || [],
      numberOfImagesAttached: request.uploadedImages?.length || 0,
      createdAt: new Date().toISOString(),
      generatedBy: 'llm-local'
    }));

    // 3. Merge Firestore + new local records (avoid duplicates by ID)
    const allRecords = [...firestoreRecords, ...newRecords];
    const uniqueRecords = Object.values(
      allRecords.reduce((acc, rec) => {
        acc[rec.id || uuidv4()] = rec;
        return acc;
      }, {} as Record<string, any>)
    );

    // 4. Write to local JSON file
    await fs.promises.writeFile(localDbPath, JSON.stringify(uniqueRecords, null, 2));
    console.log(`✅ Dumped ${uniqueRecords.length} records from Firestore into local database`);

  } catch (err) {
    console.error('❌ Failed to dump Firestore into local database:', err);
  }
}


async function getFromLocalDatabase(request: GenerateNamesRequest): Promise<PetName[]> {
  try {
    if (!fs.existsSync(localDbPath)) return [];

    const content = await fs.promises.readFile(localDbPath, 'utf-8');
    const records = JSON.parse(content || '[]');

    const nameCount = parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10);

    // filter in-memory same as Firestore fallback
    const filtered = records.filter((rec: any) => {
      if (request.petTypes?.length && !rec.petTypes.some((t: string) => request.petTypes!.includes(t))) return false;
      if (request.nameStyles?.length && !rec.nameStyles.some((s: string) => request.nameStyles!.includes(s))) return false;
      if (request.petCharacteristics?.length && !rec.petCharacteristics.some((c: string) => request.petCharacteristics!.includes(c))) return false;
      return true;
    });

    return filtered.slice(0, nameCount).map((rec: any) => ({
      id: rec.id || uuidv4(),
      name: rec.name,
      meaning: rec.meaning,
      origin: rec.origin
    }));
  } catch (err) {
    console.error('❌ Failed to read from local database:', err);
    return [];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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