import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Building2, Mail } from 'lucide-react';
import { SignupForm } from './SignupForm';
import { loginRequest } from '@/auth/authConfig';
import { useMsal } from '@azure/msal-react';

export function LoginForm() {
  const { login, loginWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const { instance } = useMsal();
  const activeAccount = instance.getActiveAccount();

  if (showSignup) {
    return <SignupForm onBackToLogin={() => setShowSignup(false)} />;
  }
  
  const handleMSLoginRedirect = () => {
    instance
        .loginRedirect({
            ...loginRequest,
            prompt: 'create',
        })
        .catch((error: any) => console.log(error));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderLogin = async (provider: 'microsoft' | 'google') => {
    setLoading(true);
    setError('');

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Mechlin HRMS</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleMSLoginRedirect}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Sign in with Microsoft
            </Button>

            <Button
              onClick={() => handleProviderLogin('google')}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
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
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="text-center text-sm text-gray-600">
            <p>Demo credentials:</p>
            <p>Email: admin@company.com | Password: admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}