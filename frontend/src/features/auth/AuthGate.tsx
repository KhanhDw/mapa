
import { useState } from 'react';
import { useAuth } from './useAuth';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';

type View = 'login' | 'register';


export function AuthGate() {
    const { signIn, signUp, error, clearError, signingIn, signingUp } = useAuth();
    const [view, setView] = useState<View>('login');

    const goTo = (v: View) => {
        clearError();
        setView(v);
    };

    if (view === 'register') {
        return (
            <RegisterPage
                onSwitchToLogin={() => goTo('login')}
                onRegisterSuccess={signUp}
                submitting={signingUp}
                serverError={error}
            />
        );
    }

    return (
        <LoginPage
            onSubmit={signIn}
            onSwitchToRegister={() => goTo('register')}
            submitting={signingIn}
            serverError={error}
        />
    );
}
