import { ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface ProtectedAdminRouteProps {
  user: User | null;
  children: ReactNode;
  fallback?: ReactNode;
}

export const ProtectedAdminRoute = ({ user, children, fallback }: ProtectedAdminRouteProps) => {
  const { hasAdminAccess, loading } = useUserRole(user);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this admin area.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};