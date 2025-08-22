import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    let query = db.collection('names');
    
    // If type is specified, filter by petTypes array
    if (type) {
      query = query.where('petTypes', 'array-contains', type);
    }
    
    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc');
    
    const snapshot = await query.limit(100).get();
    const names = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));

    return NextResponse.json(names);
  } catch (error) {
    console.error('Error fetching names:', error);
    return NextResponse.json(
      { error: 'Failed to fetch names' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, meaning, origin, petDescription, petTypes, genders, nameStyles } = body;

    // Validate required fields
    if (!name || !meaning || !origin) {
      return NextResponse.json(
        { error: 'Missing required fields: name, meaning, origin' },
        { status: 400 }
      );
    }

    const docRef = await db.collection('names').add({
      name,
      meaning,
      origin,
      petDescription: petDescription || '',
      petTypes: petTypes || [],
      genders: genders || [],
      nameStyles: nameStyles || [],
      createdAt: new Date(),
      generatedBy: 'manual'
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Name added successfully'
    });

  } catch (error) {
    console.error('Error adding name:', error);
    return NextResponse.json(
      { error: 'Failed to add name' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing name ID' },
        { status: 400 }
      );
    }

    await db.collection('names').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Name deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting name:', error);
    return NextResponse.json(
      { error: 'Failed to delete name' },
      { status: 500 }
    );
  }
}
