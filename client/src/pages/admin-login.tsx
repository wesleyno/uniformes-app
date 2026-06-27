import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { data: adminStatus, isLoading } = useQuery<{ hasAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      toast({ title: "Login realizado com sucesso!" });
      navigate("/");
    },
    onError: (err: any) => {
      toast({ title: err.message || "Credenciais inválidas", variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) throw new Error("As senhas não coincidem");
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
      const res = await apiRequest("POST", "/api/admin/register", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/status"] });
      toast({ title: "Administrador criado com sucesso!" });
      navigate("/");
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao criar administrador", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Skeleton className="h-96 w-full max-w-md rounded-xl" />
      </div>
    );
  }

  const isRegister = !adminStatus?.hasAdmin;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md lg:max-w-lg rounded-xl shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold" data-testid="text-login-title">
            {isRegister ? "Crie o administrador do sistema" : "Entrar no Painel"}
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            {isRegister
              ? "Configure a conta de administrador para começar a usar o NTeamKit"
              : "Entre com suas credenciais para acessar o painel de administração"
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@exemplo.com"
              className="rounded-lg"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-lg pr-10"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {isRegister && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-lg"
                data-testid="input-confirm-password"
              />
            </div>
          )}
          <Button
            className="w-full rounded-lg mt-2"
            size="lg"
            onClick={() => isRegister ? registerMutation.mutate() : loginMutation.mutate()}
            disabled={loginMutation.isPending || registerMutation.isPending || !email || !password}
            data-testid="button-submit-login"
          >
            {isRegister ? (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                {registerMutation.isPending ? "Criando..." : "Criar Administrador"}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
