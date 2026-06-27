import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

export interface AdminUser {
  id: number;
  email: string;
  name?: string;
  role: "admin" | "subadmin";
  workspaceId?: number;
  permissions?: {
    canManageForms: boolean;
    canManageCustomers: boolean;
    canViewReports: boolean;
    canManagePayments: boolean;
    canConfigureAsaas: boolean;
  };
}

export function useAuth() {
  const query = useQuery<AdminUser>({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  const admin = query.data;
  const isSuperAdmin = admin?.role === "admin";
  const isSubAdmin = admin?.role === "subadmin";

  const can = (permission: keyof NonNullable<AdminUser["permissions"]>) => {
    if (isSuperAdmin) return true;
    return admin?.permissions?.[permission] ?? false;
  };

  return {
    admin,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data?.id,
    isSuperAdmin,
    isSubAdmin,
    can,
    error: query.error,
  };
}

export function useRequireAuth() {
  const { admin, isLoading, isAuthenticated, isSuperAdmin, isSubAdmin, can } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  return { admin, isLoading, isAuthenticated, isSuperAdmin, isSubAdmin, can };
}
