useEffect(() => {
  setIsLoading(true);

  try {
    const profile = oidc.user?.profile;
    console.log('Full OIDC User Profile:', profile);

    const groups = Array.isArray(profile?.['cognito:groups'])
      ? profile['cognito:groups']
      : Array.isArray(profile?.['groups'])
        ? profile['groups']
        : [];

    console.log('User groups (from ID token):', groups);

    setIsAdmin(groups.includes('Admin'));
  } catch (err) {
    console.warn('Error checking admin group:', err);
    setIsAdmin(false);
    setError(err as Error);
  } finally {
    setIsLoading(false);
  }
}, [oidc.user]);
