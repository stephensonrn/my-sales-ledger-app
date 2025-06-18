// src/hooks/useAdminAuth.ts
import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';

export function useAdminAuth() {
  const oidc = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);

    try {
      const profile = oidc.user?.profile;
      console.log('Full OIDC User Profile:', profile);

      const groups: string[] | undefined = 
        profile?.['cognito:groups'] || profile?.['groups'];

      console.log('User groups (from ID token):', groups);

      setIsAdmin(groups?.includes('Admin') ?? false);
    } catch (err) {
      console.warn('Error checking admin group:', err);
      setIsAdmin(false);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [oidc.user]);

  return { isAdmin, isLoading, error };
}
