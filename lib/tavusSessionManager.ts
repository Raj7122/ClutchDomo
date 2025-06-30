/**
 * TavusSessionManager - Client-side session management
 * This module handles Tavus session creation by calling the robust backend API.
 */

// Cache for pending session requests to prevent duplicate API calls from the same client.
const pendingSessionRequests = new Map<string, Promise<any>>();

/**
 * Creates or retrieves a Tavus session.
 * This function deduplicates concurrent requests from the same client and relies on the
 * backend API to handle race conditions and session resolution.
 * 
 * @param demoId The demo ID to create a session for
 * @param demoData The demo data required for session creation
 * @returns Promise with session data
 */
export async function createTavusSession(demoId: string, demoData: any): Promise<any> {
  // 1. Deduplicate concurrent client-side requests
  if (pendingSessionRequests.has(demoId)) {
    console.log(`Request already in progress for demo ${demoId}, reusing pending request.`);
    return pendingSessionRequests.get(demoId)!;
  }

  // 2. Create and cache the request promise
  const requestPromise = (async () => {
    try {
      console.log(`Requesting new Tavus session for demo: ${demoId}`);
      
      // 3. Call the robust backend API
      const response = await fetch('/api/tavus/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoId, demoData })
      });

      // 4. Handle non-OK responses
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Error: ${response.status}`, errorBody);
        throw new Error(`Failed to create session: ${response.status} ${errorBody}`);
      }

      // 5. Parse and return the successful response
      const data = await response.json();
      console.log('Tavus session obtained successfully:', data.conversation_id);
      return data;

    } catch (error) {
      console.error('Error creating Tavus session:', error);
      // Re-throw the error to be caught by the calling component
      throw new Error('Failed to create Tavus session. Please try again.');
    }
  })();

  pendingSessionRequests.set(demoId, requestPromise);

  // 6. Execute the request and clean up the cache
  try {
    return await requestPromise;
  } finally {
    pendingSessionRequests.delete(demoId);
  }
}


