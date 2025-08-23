import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

interface FeedbackRequest {
  description?: string;
  positives?: string[];
  negatives?: string[];
  petNameId?: string;
  sessionId?: string;
  locale?: string;
  screenSize?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();

    if (!body.description && (!body.positives || body.positives.length === 0) && (!body.negatives || body.negatives.length === 0) ) {
      return NextResponse.json({ error: 'Feedback is empty' }, { status: 400 });
    }

    const feedbackDoc = db.collection('feedback').doc();

    await feedbackDoc.set({
      description: body.description || '',
      positives: body.positives || [],
      negatives: body.negatives || [],
      petNameId: body.petNameId || null,
      sessionId: body.sessionId || null,
      locale: body.locale || null,
      screenSize: body.screenSize || null,
      userAgent: body.userAgent || null,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, id: feedbackDoc.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to save feedback:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
