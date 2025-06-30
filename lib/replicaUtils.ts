/**
 * Utility functions for managing Tavus replicas
 */

/**
 * Fetches valid replica IDs from Tavus API
 * This helps diagnose invalid replica issues by providing a list of available options
 */
export async function getValidReplicas() {
  try {
    console.log('Fetching valid Tavus replicas...');
    const response = await fetch('https://tavusapi.com/v2/replicas', {
      headers: {
        'x-api-key': process.env.TAVUS_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`Tavus API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Log available replicas for easy reference
    console.log('Available Tavus replicas:', data.data.map((r: any) => ({
      id: r.replica_id,
      name: r.replica_name,
      status: r.status
    })));
    
    return data.data;
  } catch (error) {
    console.error('Error fetching Tavus replicas:', error);
    // Return stock replicas that are known to work
    return [
      {
        replica_id: 'r1fbfc941b',
        replica_name: 'Nathan (Stock)',
        status: 'ready'
      },
      {
        replica_id: 'r4c41453d2',
        replica_name: 'Anna (Stock)',
        status: 'ready'
      }
    ];
  }
}

/**
 * Validates if a replica ID exists and is ready for use
 */
export async function validateReplicaId(replicaId: string): Promise<boolean> {
  try {
    const replicas = await getValidReplicas();
    const valid = replicas.some((r: any) => 
      r.replica_id === replicaId && r.status === 'ready'
    );
    
    if (!valid) {
      console.warn(`Replica ID ${replicaId} is not valid or not ready`);
    }
    
    return valid;
  } catch (error) {
    console.error('Error validating replica ID:', error);
    return false;
  }
}

/**
 * Gets a default valid replica ID
 */
export function getDefaultReplicaId(): string {
  // Nathan is recommended by Tavus for CVI (Conversational Video Intelligence)
  return 'r1fbfc941b';
}
