export function getSessionId(): string | null {
    if (typeof window === 'undefined') return null; // not in client
  
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID(); // modern way to generate a UUID
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
}
  