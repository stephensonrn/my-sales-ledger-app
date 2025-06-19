// src/hooks/useAdminAuth.ts
// src/hooks/useAdminAuth.ts
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkGroups = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload['cognito:groups'];

        console.log('User groups from session:', groups);

        if (isMounted) {
          setIsAdmin(Array.isArray(groups) && groups.includes('Admin'));
        }
      } catch (err) {
        console.warn('Error fetching auth session:', err);
        if (isMounted) {
          setIsAdmin(false);
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isAdmin, isLoading, error };
}
