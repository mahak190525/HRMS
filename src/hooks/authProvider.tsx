import { PublicClientApplication, EventType } from '@azure/msal-browser';
import type { AuthenticationResult } from '@azure/msal-browser';
import { msalConfig } from '../auth/authConfig';
import { ReactNode } from 'react';
import { MsalProvider } from '@azure/msal-react';

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children } : AuthProviderProps) => {
  const msalInstance = new PublicClientApplication(msalConfig);
  
  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
      msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }
  
  msalInstance.addEventCallback((event) => {
    const authenticationResult = event.payload as AuthenticationResult;
    const account = authenticationResult?.account;
      if (event.eventType === EventType.LOGIN_SUCCESS && account) {
          msalInstance.setActiveAccount(account);
      }
  });
  return <MsalProvider instance={msalInstance}> {children} </MsalProvider>
};

export function useAuthProvider() {
  return { AuthProvider }
}