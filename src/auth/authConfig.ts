import { LogLevel } from '@azure/msal-browser';

export const msalConfig = {
    auth: {
        clientId: 'cabdbfaf-b291-4927-b676-6d96f3c189c3',
        authority: 'https://login.microsoftonline.com/85707f27-830a-4b92-aa8c-3830bfb6c6f5/',
        redirectUri: 'http://localhost:5173/',
        postLogoutRedirectUri: 'http://localhost:5173/',
        // redirectUri: 'https://mechlinhrms.netlify.app/',
        // postLogoutRedirectUri: 'https://mechlinhrms.netlify.app/',
        // redirectUri: 'https://dev.hrms.mechlintech.com/',
        // postLogoutRedirectUri: 'https://dev.hrms.mechlintech.com/',
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level: any, message: any, containsPii: any) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }
            },
        },
    },
};

export const loginRequest = {
    scopes: ['User.Read','openid', 'profile', 'email'],
    prompt: 'select_account',
};
