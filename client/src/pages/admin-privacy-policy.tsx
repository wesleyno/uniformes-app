import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Shield, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function safeRichText(text: string): string {
  const stripped = text.replace(/<[^>]*>/g, '');
  return stripped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, label: string, url: string) => {
      const safeUrl = url.startsWith('http://') || url.startsWith('https://') ? url : '#';
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">${label.replace(/<[^>]*>/g, '')}</a>`;
    })
    .replace(/\n/g, '<br/>');
}

function renderRichText(text: string) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="prose prose-sm max-w-none">
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: safeRichText(p) }} />
      ))}
    </div>
  );
}

export default function AdminPrivacyPolicy() {
  const { isLoading: authLoading } = useRequireAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery<{ content: string }>({
    queryKey: ["/api/admin/privacy-policy"],
  });

  useEffect(() => {
    if (data) {
      setContent(data.content || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/privacy-policy", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/privacy-policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy-policy"] });
      toast({ title: "Política de privacidade salva!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <Link href="/admin/settings">
            <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-page-title">
              <Shield className="w-5 h-5" />
              Política de Privacidade
            </h1>
            <p className="text-sm text-muted-foreground">
              Edite a política de privacidade exibida em todos os formulários
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="rounded-lg"
              data-testid="button-preview-policy"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-lg shadow-sm"
              data-testid="button-save-policy"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Conteúdo da Política de Privacidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Texto da Política</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={"**Política de Privacidade**\n\nDescreva aqui a política de privacidade da sua organização.\n\nUse **negrito** para destaque, [texto](url) para links, e separe parágrafos com linha em branco."}
                className="rounded-lg min-h-[400px] font-mono text-sm"
                data-testid="input-privacy-policy"
              />
              <p className="text-xs text-muted-foreground">
                Suporta formatação: **negrito**, [texto do link](url) e parágrafos separados por linha em branco.
                Esta política será compartilhada em todos os formulários.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Política de Privacidade
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4" data-testid="preview-privacy-policy">
            {content ? renderRichText(content) : (
              <p className="text-muted-foreground text-sm">Nenhum conteúdo definido.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
