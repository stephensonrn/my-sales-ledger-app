// src/hooks/useAdminAuth.ts
import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth'; // Import v6 function

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Optional: Add state to store the actual groups if needed elsewhere
  // const [groups, setGroups] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts

    const checkAdminStatus = async () => {
      setIsLoading(true);
      try {
        // fetchAuthSession retrieves the current session including ID and Access tokens
        const session = await fetchAuthSession();

        // Access group claims from the ID token payload
        // The groups claim might not exist if the user is in no groups or if Cognito isn't configured to add it
        const cognitoGroups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;

        if (!isMounted) return; // Exit if component unmounted

        console.log('User groups from session in useAdminAuth:', cognitoGroups); // For debugging

        // Check if the 'Admin' group is present in the array
        if (cognitoGroups && cognitoGroups.includes('Admin')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
        // setGroups(cognitoGroups); // Optional: store groups if needed

      } catch (error) {
        // If fetchAuthSession fails, it usually means the user is not authenticated
        console.warn('Could not fetch auth session in useAdminAuth (likely not logged in):', error);
        if (isMounted) {
          setIsAdmin(false); // Assume not admin if session can't be fetched
          // setGroups(undefined);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false); // Mark loading as complete
        }
      }
    };

    checkAdminStatus();

    // Cleanup function to set isMounted to false when the component unmounts
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array ensures this runs only once when the hook mounts

  // Return the loading state and the admin status
  return { isAdmin, isLoading };
}

// Optional: Export the hook as default if preferred
// export default useAdminAuth;