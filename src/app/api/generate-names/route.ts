import { MockNameData, mockNamesByType } from '@/lib/mock';
import { NextRequest, NextResponse } from 'next/server';

import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/firebaseAdmin';
interface GenerateNamesRequest {
  petDescription?: string;
  petTypes?: string[];
  petCharacteristics?: string[];
  nameStyles?: string[];
  uploadedImages?: string[];
}



interface PetName {
  id: string;
  name: string;
  meaning?: string;
  origin?: string;
}

// Function to save names to Firebase database
async function saveNamesToDatabase(names: PetName[], requestData: GenerateNamesRequest): Promise<void> {
  try {
    const batch = db.batch();
    
    names.forEach((name) => {
      const docRef = db.collection('names').doc();
      batch.set(docRef, {
        name: name.name,
        meaning: name.meaning,
        origin: name.origin,
        petDescription: requestData.petDescription,
        petTypes: requestData.petTypes || [],
        petCharacteristics: requestData.petCharacteristics || [],
        nameStyles: requestData.nameStyles || [],
        numberOfImagesAttached: requestData.uploadedImages?.length,
        createdAt: new Date(),
        generatedBy: 'llm'
      });
    });
    
    await batch.commit();
    console.log(`✅ Successfully saved ${names.length} names to database`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to save names to database:', errorMessage);
    // Don't throw error here - we still want to return names to user
  }
}

// Function to read names from Firebase database
async function readNamesFromDatabase(requestData: GenerateNamesRequest): Promise<PetName[]> {
  try {
    console.log('ℹ️ Reading names from database...');
    
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('names');
    
    // Build query based on request criteria
    if (requestData.petTypes && requestData.petTypes.length > 0) {
      query = query.where('petTypes', 'array-contains-any', requestData.petTypes);
    }
    
    if (requestData.petCharacteristics && requestData.petCharacteristics.length > 0) {
      query = query.where('petCharacteristics', 'array-contains-any', requestData.petCharacteristics);
    }
    
    if (requestData.nameStyles && requestData.nameStyles.length > 0) {
      query = query.where('nameStyles', 'array-contains-any', requestData.nameStyles);
    }
    
    // Add limit and order by creation date (most recent first)
    query = query.orderBy('createdAt', 'desc').limit(parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10));
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('ℹ️ No matching names in database');
      return [];
    }
    
    const names: PetName[] = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        meaning: data.meaning || '',
        origin: data.origin || ''
      };
    });
    
    console.log(`✅ Found ${names.length} names in database`);
    return names;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to read names from database:', errorMessage);
    return [];
  }
}

const geminiApiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
});

async function generateNamesWithLLMGoogle(request: GenerateNamesRequest): Promise<PetName[]> {
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key is not initialized. Check your GEMINI_API_KEY environment variable.');
  }

  // Define the JSON schema for structured response
  const jsonSchema = {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            origin: { type: "string" },
            meaning: { type: "string" }
          },
          required: ["name", "origin", "meaning"]
        }
      }
    },
    required: ["names"]
  };

  const prompt = `Generate ${process.env.NEXT_PUBLIC_TOP_NAMES || '5'} unique and meaningful pet names based on the following criteria:
${request.petDescription ? `Description: ${request.petDescription}` : ''}
${request.petTypes && request.petTypes.length > 0 ? `Pet type: ${request.petTypes.join(', ')}` : ''}
${request.petCharacteristics && request.petCharacteristics.length > 0 ? `Pet characteristics: ${request.petCharacteristics.join(', ')}` : ''}
${request.nameStyles && request.nameStyles.length > 0 ? `Name style: ${request.nameStyles.join(', ')}` : ''}

For each name, provide:
1. The name itself
2. Its cultural or linguistic origin
3. The meaning or symbolism behind the name

Return the response as valid JSON following this exact schema:
${JSON.stringify(jsonSchema)}

Ensure each name:
- Is memorable and unique
- Has cultural or historical significance
- Reflects the pet's characteristics
- Is easy to pronounce
- Has a positive meaning or association`;

  try {    
    const config = {
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: jsonSchema
      },
      systemInstruction: "You are a creative pet name generator that responds with detailed, meaningful name suggestions in structured JSON format. Each name should include its cultural origin and meaning."
    };

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    console.log('ℹ️ Calling Gemini API for name generation');
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      config,
      contents
    });
    
    if (!result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log('❌ No response received from Gemini API');
      throw new Error('No response text received from Gemini API');
    }
    
    const response = result.candidates[0].content.parts[0].text;

    try {
      // Clean up the response to remove markdown code blocks
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsedResponse = JSON.parse(cleanResponse);
      const parsedNames = parsedResponse.names;
      
      // With structured response, the format should be guaranteed, but add basic validation
      if (!Array.isArray(parsedNames)) {
        console.log('❌ Invalid response structure - missing names array');
        throw new Error('Invalid response structure');
      }

      // Validate that each name has required properties
      const validNames = parsedNames.filter(nameData => 
        nameData && 
        typeof nameData.name === 'string' && 
        typeof nameData.origin === 'string' && 
        typeof nameData.meaning === 'string'
      );

      if (validNames.length === 0) {
        console.log('❌ No valid names found in API response');
        throw new Error('No valid names in response');
      }

      const names = validNames
        .slice(0, parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10))
        .map((nameData, index) => ({
          id: `name-${Date.now()}-${index}`,
          name: nameData.name,
          meaning: nameData.meaning,
          origin: nameData.origin
        }));

      console.log(`✅ Generated ${names.length} names from Gemini API`);
      return names;

    } catch {
      console.log('❌ Failed to parse Gemini API response - invalid JSON structure');
      throw new Error('Failed to parse structured JSON response from Gemini');
    }

  } catch (error) {
    console.log(`❌ Gemini API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}





export async function POST(request: NextRequest) {
  try {
    const body: GenerateNamesRequest = await request.json();

    console.log('ℹ️ Received request');
    console.log('ℹ️ Pet Type : ' + JSON.stringify(body.petTypes));
    console.log('ℹ️ Pet characteristics : ' + JSON.stringify(body.petCharacteristics));
    console.log('ℹ️ Pet Description: ' + JSON.stringify(body.petDescription));
    console.log('ℹ️ Name Styles : ' + JSON.stringify(body.nameStyles));
    console.log('ℹ️ Uploaded files : ' + JSON.stringify(body.uploadedImages?.length || 0));
    
    // Validate required fields
    if (!body.petDescription || !body.petDescription.trim()) {
          // If no description, use a default or generate names based on pet types only
    body.petDescription = body.petTypes && body.petTypes.length > 0 
      ? `A ${body.petTypes.join(', ')} pet` 
      : 'A wonderful pet';
    }

    // Determine whether to use mock data based on environment variables
    const useMock = process.env.MOCK === 'true';
    let names;
    let wasFallback = false;

    if (useMock) {
      console.log('ℹ️ Using mock data (configured via MOCK=true)');

      // Try to read from database first
      names = await readNamesFromDatabase(body);
      
      // If no names found in database, fall back to mock data
      if (names.length === 0) {
        console.log('ℹ️ No names found in database, using mock data');
        names = generateMockNames(body);
        wasFallback = true;
      } else {
        console.log('ℹ️ Using names from database');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      try {
        console.log('ℹ️ Using LLM to generate names');
        names = await generateNamesWithLLMGoogle(body);

        // Save names to database
        await saveNamesToDatabase(names, body);

      } catch {
        console.log('ℹ️ LLM generation failed - falling back to mock data');
        names = generateMockNames(body);
        wasFallback = true;
      }
    }

    console.log(`✅ Returning ${names.length} names to client`);
    return NextResponse.json({
      success: true,
      names: names,
      count: names.length,
      timestamp: new Date().toISOString(),
      mock: useMock || wasFallback,
      model: (useMock || wasFallback) ? 'mock' : 'gemini-2.0-flash-exp',
      fallback: wasFallback,
      source: useMock ? (names.length > 0 && !wasFallback ? 'database' : 'mock') : 'llm'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Fatal error in name generation: ${errorMessage}`);
    return NextResponse.json(
      { error: 'Failed to generate names' },
      { status: 500 }
    );
  }
}

// Generate mock names based on predefined data
function generateMockNames(request: {
  petDescription?: string;
  petTypes?: string[];
  nameStyles?: string[];
  petCharacteristics?: string[];
}): PetName[] {
  const { petDescription, petTypes = [], nameStyles = [], petCharacteristics = [] } = request;

  console.log('ℹ️ Generating mock names from local data');

  // Collect names from petTypes
  let namePool: MockNameData[] = [];
  petTypes.forEach(type => {
    if (mockNamesByType[type]) {
      namePool.push(...mockNamesByType[type]);
    }
  });

  // Fallback to 'other' if nothing collected
  if (namePool.length === 0) {
    namePool = mockNamesByType.other;
  }

  const characteristicKeywords = {
    'white': ['white', 'light', 'bright', 'pure', 'snow', 'cloud'],
    'brown': ['brown', 'earth', 'wood', 'warm', 'coffee', 'chocolate'],
    'small': ['small', 'tiny', 'little', 'mini', 'petite', 'delicate'],
    'big': ['big', 'large', 'huge', 'giant', 'strong', 'mighty']
  };
  const descLower = petDescription?.toLowerCase() || '';
  const stylesLower = (nameStyles || []).map(style => style.toLowerCase());

  // Score each name by how many filters it matches
  const scored = namePool.map(nameData => {
    const text = `${nameData.name} ${nameData.meaning}`.toLowerCase();
    let score = 0;

    // Match petDescription
    if (descLower && text.includes(descLower)) score += 2;

    // Match name styles
    if (stylesLower.some(style => text.includes(style))) score += 1;

    // Match any of the pet characteristics
    if (petCharacteristics && petCharacteristics.length > 0) {
      petCharacteristics.forEach(characteristic => {
        const keywords = characteristicKeywords[characteristic as keyof typeof characteristicKeywords] || [];
        if (keywords.some(k => text.includes(k))) score += 1;
      });
    }

    return { ...nameData, _score: score };
  });

  // Sort by score (desc), then shuffle within same score
  scored.sort((a, b) => b._score - a._score || Math.random() - 0.5);

  const topNames = parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10);

  return scored.slice(0, topNames).map((nameData, index) => ({
    id: `name-${Date.now()}-${index}`,
    name: nameData.name,
    meaning: nameData.meaning,
    origin: nameData.origin
  }));
}