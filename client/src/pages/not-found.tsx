import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full rounded-xl shadow-lg">
        <CardContent className="pt-10 pb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Página Não Encontrada</h1>
          <p className="text-muted-foreground mb-6">
            A página que você está procurando não existe ou foi removida.
          </p>
          <Link href="/">
            <Button className="rounded-lg" data-testid="button-go-home">Voltar ao Início</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
