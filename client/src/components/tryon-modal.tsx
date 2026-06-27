import { useState, useRef, useCallback } from "react";
import { Upload, Download, RefreshCw, Check, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Jersey } from "@shared/schema";

interface TryOnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jerseys: Jersey[];
}

type Step = "upload" | "select" | "generating" | "result" | "error";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function TryOnModal({ open, onOpenChange, jerseys }: TryOnModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [selectedJersey, setSelectedJersey] = useState<Jersey | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setPersonImage(null);
    setPersonPreview(null);
    setSelectedJersey(null);
    setResultImageUrl(null);
    setErrorMessage("");
    setIsDragOver(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetState]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Formato inválido. Apenas JPG e PNG são aceitos.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Arquivo muito grande. O tamanho máximo é 50MB.";
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrorMessage(error);
      setStep("error");
      return;
    }
    setPersonImage(file);
    const url = URL.createObjectURL(file);
    setPersonPreview(url);
    setStep("select");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleGenerate = useCallback(async () => {
    if (!personImage || !selectedJersey) return;

    setStep("generating");

    try {
      const formData = new FormData();
      formData.append("personImage", personImage);

      if (selectedJersey.imageUrl) {
        formData.append("jerseyImageUrl", selectedJersey.imageUrl);
      }

      const response = await fetch("/api/tryon", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao gerar visualização");
      }

      const data = await response.json();
      setResultImageUrl(data.resultUrl || data.url || data.imageUrl);
      setStep("result");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao gerar visualização. Tente novamente.");
      setStep("error");
    }
  }, [personImage, selectedJersey]);

  const handleDownload = useCallback(async () => {
    if (!resultImageUrl) return;
    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tryon-result.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(resultImageUrl, "_blank");
    }
  }, [resultImageUrl]);

  const handleRetry = useCallback(() => {
    setErrorMessage("");
    setStep("upload");
    setPersonImage(null);
    setPersonPreview(null);
    setSelectedJersey(null);
    setResultImageUrl(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-tryon">
        <DialogHeader>
          <DialogTitle data-testid="text-tryon-title">Provador Virtual</DialogTitle>
          <DialogDescription data-testid="text-tryon-description">
            {step === "upload" && "Envie uma foto sua de corpo inteiro para experimentar o uniforme virtualmente."}
            {step === "select" && "Selecione o uniforme que deseja experimentar."}
            {step === "generating" && "Gerando visualização do uniforme... Isso pode levar alguns segundos."}
            {step === "result" && "Veja como o uniforme ficaria em você!"}
            {step === "error" && "Ocorreu um erro. Tente novamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-person-image"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleInputChange}
              data-testid="input-person-image"
            />
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Arraste uma foto aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Apenas JPG ou PNG, máximo 50MB. Use uma foto de corpo inteiro.
            </p>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4">
            {personPreview && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <img
                  src={personPreview}
                  alt="Sua foto"
                  className="w-16 h-16 object-cover rounded-md"
                  data-testid="img-person-preview"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-person-filename">
                    {personImage?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Foto enviada</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setPersonImage(null);
                    setPersonPreview(null);
                    setStep("upload");
                  }}
                  data-testid="button-change-photo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Selecione um uniforme:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="grid-jerseys">
                {jerseys.map((jersey) => (
                  <button
                    key={jersey.id}
                    onClick={() => setSelectedJersey(jersey)}
                    className={`relative p-2 rounded-md border-2 transition-colors text-left ${
                      selectedJersey?.id === jersey.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30 hover:bg-muted/50"
                    }`}
                    data-testid={`button-jersey-${jersey.id}`}
                  >
                    {selectedJersey?.id === jersey.id && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    {jersey.imageUrl ? (
                      <img
                        src={jersey.imageUrl}
                        alt={jersey.name}
                        className="w-full aspect-square object-cover rounded-md mb-2"
                        data-testid={`img-jersey-${jersey.id}`}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs font-medium truncate" data-testid={`text-jersey-name-${jersey.id}`}>
                      {jersey.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedJersey(null);
                  setStep("upload");
                }}
                data-testid="button-back-upload"
              >
                Voltar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedJersey}
                data-testid="button-generate-tryon"
              >
                Gerar Visualização
              </Button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="container-generating">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center" data-testid="text-generating-message">
              Gerando visualização do uniforme... Isso pode levar alguns segundos.
            </p>
          </div>
        )}

        {step === "result" && resultImageUrl && (
          <div className="space-y-4">
            <div className="rounded-md overflow-hidden bg-muted/30">
              <img
                src={resultImageUrl}
                alt="Resultado do provador virtual"
                className="w-full object-contain max-h-[60vh]"
                data-testid="img-tryon-result"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleRetry}
                data-testid="button-try-again"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button
                onClick={handleDownload}
                data-testid="button-download-result"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Imagem
              </Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4" data-testid="container-error">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-center text-muted-foreground" data-testid="text-error-message">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              onClick={handleRetry}
              data-testid="button-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}