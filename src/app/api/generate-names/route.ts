import { MockNameData, mockNamesByType } from '@/lib/mock';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/firebaseAdmin';
interface GenerateNamesRequest {
  petDescription?: string;
  petTypes?: string[];
  petCharacteristics?: string[];
  nameStyles?: string[];
  uploadedImages?: string[];
}

// Initialize OpenAI client if API key is available
const openai = process.env.NVIDIA_API_KEY ? new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1',
}) : null;

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
    console.error('❌ Failed to save names to database:', error);
    // Don't throw error here - we still want to return names to user
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

    } catch (parseError) {
      console.log('❌ Failed to parse Gemini API response - invalid JSON structure');
      throw new Error('Failed to parse structured JSON response from Gemini');
    }

  } catch (error) {
    console.log(`❌ Gemini API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}



async function generateNamesWithLLMNvidia(request: GenerateNamesRequest): Promise<PetName[]> {
  if (!openai) {
    throw new Error('OpenAI client is not initialized. Check your API_KEY and API_URL environment variables.');
  }

const prompt = `Generate ${process.env.NEXT_PUBLIC_TOP_NAMES || '5'} unique and meaningful pet names based on the following criteria:
${request.petDescription ? `Description: ${request.petDescription}` : ''}
${request.petTypes && request.petTypes.length > 0 ? `Pet type: ${request.petTypes.join(', ')}` : ''}
${request.petCharacteristics && request.petCharacteristics.length > 0 ? `Pet characteristics: ${request.petCharacteristics.join(', ')}` : ''}
${request.nameStyles && request.nameStyles.length > 0 ? `Name style: ${request.nameStyles.join(', ')}` : ''}

For each name, provide:
1. The name itself
2. Its cultural or linguistic origin
3. The meaning

Format your response as JSON:
{
  "names": [
    {
      "name": "Luna",
      "origin": "Latin",
      "meaning": "Moon - representing mystery and grace",
    }
  ]
}

Ensure each name:
- Is memorable and unique
- Has cultural or historical significance
- Reflects the pet's characteristics
- Is easy to pronounce
- Has a positive meaning or association`;

  try {
    console.log('ℹ️ Calling NVIDIA API for name generation');
    const completion = await openai.chat.completions.create({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' || process.env.NVIDIA_MODEL || "nvidia/nvidia-nemotron-nano-9b-v2",
      messages: [
        { role: "system", content: "You are a creative pet name generator that responds with detailed, meaningful name suggestions in JSON format. Each name should include its cultural origin and meaning. Always format your response as a JSON object with a 'names' array." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 256,
      stream: false,
      response_format: {
        type: 'json_object'
      }
    });

    // Parse the response into an array of names
    const response = completion.choices[0]?.message?.content || '';
    let parsedNames;
    try {
      // Clean up the response to ensure valid JSON
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsedResponse = JSON.parse(cleanResponse);
      parsedNames = Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.names;
      
      // Validate the structure of the parsed names
      if (!Array.isArray(parsedNames) || 
          !parsedNames.every(name => 
            name && 
            typeof name.name === 'string' && 
            typeof name.origin === 'string' && 
            typeof name.meaning === 'string' &&
            (!name.personalizedReason || typeof name.personalizedReason === 'string'))) {
        console.log('❌ Invalid name data structure from NVIDIA API');
        throw new Error('Invalid name data structure');
      }
    } catch (error) {
      console.log('❌ Failed to parse NVIDIA API response - falling back to mock data');
      throw new Error('Invalid response format from LLM');
    }

    const names = parsedNames
      .slice(0, parseInt(process.env.NEXT_PUBLIC_TOP_NAMES || '5', 10))
      .map((nameData, index) => ({
        id: `name-${Date.now()}-${index}`,
        name: nameData.name,
        meaning: `${nameData.meaning}. ${nameData.personalizedReason || ''}`.trim(),
        origin: nameData.origin
      }));

    console.log(`✅ Generated ${names.length} names from NVIDIA API`);
    return names;
  } catch (error) {
    console.log(`❌ NVIDIA API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      names = generateMockNames(body);
      // Save mock names to database as well
      await saveNamesToDatabase(names, body);
      // Simulate API processing time
      // await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      try {
        console.log('ℹ️ Using LLM to generate names');
        names = await generateNamesWithLLMGoogle(body);

        // Save names to database
        await saveNamesToDatabase(names, body);

      } catch (error) {
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
      model: (useMock || wasFallback) ? 'mock' : (process.env.NVIDIA_MODEL || 'nvidia/nvidia-nemotron-nano-9b-v2'),
      fallback: wasFallback
    });

  } catch (error) {
    console.log(`❌ Fatal error in name generation: ${error.message}`);
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
    const text = `${nameData.name} ${nameData.meaning} ${nameData.personalizedReason}`.toLowerCase();
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
    meaning: `${nameData.meaning}. ${nameData.personalizedReason}`,
    origin: nameData.origin
  }));
}