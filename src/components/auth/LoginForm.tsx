import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Building2, Mail, RefreshCw } from 'lucide-react';
import { SignupForm } from './SignupForm';
import { loginRequest } from '@/auth/authConfig';
import { useMsal } from '@azure/msal-react';
import { msalInstance } from '@/hooks/MsalAuthProvider';
import mechlin_logo from '../../assets/mechlin_logo.svg';
import square_logo from '../../assets/square_logo.svg';

export function LoginForm() {
  const { login, loginWithProvider, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [hasAttemptedSync, setHasAttemptedSync] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [showInactivityMessage, setShowInactivityMessage] = useState(false);
  const { instance } = useMsal();
  const activeAccount = instance.getActiveAccount();

  // Check for inactivity logout reason in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reason') === 'inactivity') {
      setShowInactivityMessage(true);
      // Clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reason');
      window.history.replaceState({}, '', newUrl.toString());
      
      // Hide message after 10 seconds
      setTimeout(() => setShowInactivityMessage(false), 10000);
    }
  }, []);

  // Get available accounts when component mounts
  useEffect(() => {
    const accounts = instance.getAllAccounts();
    setAvailableAccounts(accounts);
  }, [instance]);

  // Refresh available accounts when activeAccount changes
  useEffect(() => {
    const accounts = instance.getAllAccounts();
    setAvailableAccounts(accounts);
  }, [activeAccount, instance]);

  const refreshAvailableAccounts = () => {
    const accounts = instance.getAllAccounts();
    setAvailableAccounts(accounts);
  };

  const handleMSLoginRedirect = () => {
    // Reset sync state when user manually tries to log in
    setHasAttemptedSync(false);
    setError('');
    
    instance
        .loginRedirect({
            ...loginRequest,
            prompt: 'select_account', // Force account selection
        })
        .catch((error: any) => console.log(error));
  };

  const handleSelectDifferentAccount = () => {
    // Clear all accounts and force fresh login
    instance.clearCache();
    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin + '/login'
    });
  };

  const handleSelectSpecificAccount = (account: any) => {
    // Set the selected account as active and attempt login
    instance.setActiveAccount(account);
    setHasAttemptedSync(false);
    setError('');
    // The sync effect will automatically trigger since activeAccount changed
  };

  const handleRetryMicrosoftLogin = () => {
    // Reset sync state and retry
    setHasAttemptedSync(false);
    setError('');
    handleMSLoginRedirect();
  };

  // Reset sync state when activeAccount changes significantly
  useEffect(() => {
    if (!activeAccount) {
      setHasAttemptedSync(false);
      setError('');
    }
  }, [activeAccount]);

  // After MSAL redirect, if an active Microsoft account exists, sync it to our AuthContext
  useEffect(() => {
    const syncMicrosoftAccount = async () => {
      if (!activeAccount) return;
      
      // Check if user just logged out (prevent auto re-login)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('logout') === 'true') {
        // Clean up the URL by removing the logout parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('logout');
        window.history.replaceState({}, '', newUrl.toString());
        return;
      }
      
      // Avoid re-sync if already logged into the app or if we've already attempted sync
      const existingToken = localStorage.getItem('hrms_token');
      if (existingToken || user || hasAttemptedSync) return;

      try {
        setLoading(true);
        setError(''); // Clear any previous errors
        const claims: any = (activeAccount as any).idTokenClaims || {};
        const email = claims.preferred_username || claims.email || activeAccount.username;
        const name = claims.name || email;
        const id = claims.oid || claims.sub || activeAccount.localAccountId || activeAccount.homeAccountId;

        await loginWithProvider('microsoft', { id, email, name });
        // No explicit navigate: the /login route redirects when user becomes truthy
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Microsoft SSO failed';
        setError(errorMessage);
        
        // Mark that we've attempted sync to prevent infinite retries
        setHasAttemptedSync(true);
        
        // If the account is pending or inactive, we should stop trying to sync
        if (errorMessage.includes('pending approval') || errorMessage.includes('inactive')) {
          console.log('Account not active, stopping sync attempts');
        }
      } finally {
        setLoading(false);
      }
    };

    void syncMicrosoftAccount();
  }, [activeAccount, loginWithProvider, user, hasAttemptedSync]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setHasAttemptedSync(false); // Reset sync state for manual login

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear errors when user starts typing
    if (error) {
      setError('');
      setHasAttemptedSync(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear errors when user starts typing
    if (error) {
      setError('');
      setHasAttemptedSync(false);
    }
  };

  const handleProviderLogin = async (provider: 'microsoft' | 'google') => {
    setLoading(true);
    setError('');
    setHasAttemptedSync(false); // Reset sync state for provider login

    try {
      // In a real app, this would redirect to OAuth provider
      // For demo, we'll simulate successful OAuth
      const mockUserData = {
        id: provider === 'microsoft' ? 'ms-123' : 'google-123',
        email: provider === 'microsoft' ? 'user@company.com' : 'candidate@gmail.com',
        name: 'Demo User'
      };
      
      await loginWithProvider(provider, mockUserData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showSignup) {
    return <SignupForm onBackToLogin={() => {
      setShowSignup(false);
      setError('');
      setHasAttemptedSync(false);
    }} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center items-center justify-center align-center">
          <CardTitle className="border border-orange-200/50 bg-white/70 backdrop-blur-sm shadow-md shadow-orange-100/20 p-3 px-4 rounded-xl">
            
            <div className="flex items-center gap-2">
              <div className="h-10 w-10">
                <img src={square_logo} alt="square logo"></img>
              </div>
              <span className="font-bold text-2xl bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">MECHLIN</span>
            </div>
            {/* <div className="flex items-center gap-2">
              <div className="h-full w-full">
                <img src={mechlin_logo} alt="mechlin logo" className='w-full h-10'></img>
              </div>
            </div> */}
          </CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showInactivityMessage && (
            <Alert variant="default" className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800">
                You were logged out due to 30 minutes of inactivity. Please sign in again.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {error && hasAttemptedSync ? (
              <div className="space-y-2">
                <Button
                  onClick={handleRetryMicrosoftLogin}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Retry Microsoft Sign In
                </Button>
                <Button
                  onClick={handleSelectDifferentAccount}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Select a different Microsoft account
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Your account may be pending approval or inactive. Please contact HR.
                </p>
              </div>
            ) : availableAccounts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground mb-3">
                  {availableAccounts.length === 1 
                    ? 'One Microsoft account found. Please select it or choose a different account:'
                    : 'Multiple Microsoft accounts found. Please select one:'
                  }
                </p>
                {availableAccounts.map((account, index) => (
                  <Button
                    key={index}
                    onClick={() => handleSelectSpecificAccount(account)}
                    disabled={loading}
                    className="w-full"
                    variant="outline"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    {account.username || account.name || `Account ${index + 1}`}
                  </Button>
                ))}
                <Button
                  onClick={handleSelectDifferentAccount}
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Use a different Microsoft account
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleMSLoginRedirect}
                disabled={loading}
                className="w-full"
                variant="default"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Sign in with Microsoft
              </Button>
            )}

            {/* <Button
              onClick={() => handleProviderLogin('google')}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button> */}
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Sign in
            </Button>
          </form>

          <div className="text-center">
            <Button 
              variant="link" 
              onClick={() => setShowSignup(true)}
              className="text-sm"
            >
              Don't have an account? Sign up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
