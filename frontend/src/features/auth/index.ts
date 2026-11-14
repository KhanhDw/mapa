// frontend\src\features\auth\index.ts
// Provider + hook
export { AuthProvider } from './AuthContext';
export type { AuthContextValue } from './AuthContext';
export { useAuth } from './useAuth';

// Screen
export { AuthGate } from './AuthGate';

// API types (nguồn duy nhất)
export type { AuthResult, LoginPayload, RegisterPayload } from './api/auth';

// Domain
export type { User } from './types';

