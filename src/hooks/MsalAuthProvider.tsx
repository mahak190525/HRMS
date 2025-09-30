import { PublicClientApplication, EventType } from '@azure/msal-browser';
import type { AuthenticationResult } from '@azure/msal-browser';
import { msalConfig } from '../auth/authConfig';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { MsalProvider } from '@azure/msal-react';

interface MsalAuthProviderProps {
  children: ReactNode;
}

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.addEventCallback((event) => {
  const authResult = event.payload as AuthenticationResult;
  if (event.eventType === EventType.LOGIN_SUCCESS && authResult?.account) {
    msalInstance.setActiveAccount(authResult.account);
  }

  // Handle logout redirect
  if (event.eventType === EventType.LOGOUT_SUCCESS) {
    // Clear local storage when logout is successful
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_user');
  }
});

export const MsalAuthProvider = ({ children }: MsalAuthProviderProps) => {
  const [isMsalReady, setIsMsalReady] = useState(false);
  
  useEffect(() => {
  const initMsal = async () => {
    try {
      await msalInstance.initialize();

      const response = await msalInstance.handleRedirectPromise();

      if (response?.account) {
        msalInstance.setActiveAccount(response.account);
      } else {
        // Don't automatically select any account
        // Let the user choose which account to use
        const allAccounts = msalInstance.getAllAccounts();
        // No auto-selection - user must explicitly choose an account
      }
    } catch (error) {
      console.error('MSAL redirect handling error:', error);
    } finally {
      setIsMsalReady(true);
    }
  };

  initMsal();
}, []);

  if (!isMsalReady) return null;

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
};

export { msalInstance };
