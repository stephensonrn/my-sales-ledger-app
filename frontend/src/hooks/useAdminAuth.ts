import { useEffect, useState } from 'react';
import { useOidc } from 'react-oidc-context';

export function useAdminAuth() {
  const { user, isLoading: oidcLoading } = useOidc();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (oidcLoading) return;

    if (user && user.profile) {
      // This assumes that the user's groups are in the 'cognito:groups' claim
      const groups: string[] | undefined = user.profile['cognito:groups'];

      console.log('User groups from OIDC profile:', groups);

      setIsAdmin(groups?.includes('Admin') || false);
    } else {
      setIsAdmin(false);
    }

    setIsLoading(false);
  }, [user, oidcLoading]);

  return { isAdmin, isLoading };
}
