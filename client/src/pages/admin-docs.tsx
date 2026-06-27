import { useState } from "react";
import { useRequireAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shirt, ArrowLeft, Database, Server, CreditCard, Webhook,
  Layout, Shield, FileText, Layers, Users, ClipboardList,
  Hash, Star, Eye, Settings, BookOpen, ChevronDown, ChevronRight,
  ShoppingCart, Smartphone, Lock, ImageIcon, Sparkles
} from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm font-mono leading-relaxed" data-testid="code-block">
      <code>{children}</code>
    </pre>
  );
}

function Section({ icon: Icon, title, id, children }: { icon: any; title: string; id: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-xl shadow-md" id={id} data-testid={`section-${id}`}>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function StepItem({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-bold text-primary">{number}</span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground mb-1">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 bg-muted/30 text-left"
        onClick={() => setOpen(!open)}
        data-testid={`collapse-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="font-semibold text-foreground text-sm">{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="p-3 space-y-3 border-t">{children}</div>}
    </div>
  );
}

const tocItems = [
  { id: "visao-geral", label: "Visão Geral", icon: Shirt },
  { id: "primeiro-acesso", label: "Primeiro Acesso", icon: Lock },
  { id: "dashboard", label: "Dashboard Principal", icon: Layout },
  { id: "criar-formulario", label: "Criar Formulário", icon: ClipboardList },
  { id: "editar-formulario", label: "Editar Formulário", icon: Settings },
  { id: "camisetas", label: "Gerenciar Camisetas", icon: Shirt },
  { id: "patrocinadores", label: "Patrocinadores", icon: Star },
  { id: "tryon", label: "Provador Virtual (Try-On)", icon: Sparkles },
  { id: "compartilhar", label: "Compartilhar Formulário", icon: Smartphone },
  { id: "fluxo-atleta", label: "Fluxo do Atleta", icon: Users },
  { id: "respostas", label: "Gerenciar Respostas", icon: ClipboardList },
  { id: "numeros", label: "Mapa de Números", icon: Hash },
  { id: "pedidos", label: "Pedidos e Pagamentos", icon: ShoppingCart },
  { id: "producao", label: "Lista de Produção", icon: Layers },
  { id: "clientes", label: "Gestão de Clientes", icon: Users },
  { id: "relatorios", label: "Relatórios Financeiros", icon: CreditCard },
  { id: "pagamento-config", label: "Configurações de Pagamento", icon: Settings },
  { id: "webhook", label: "Configuração do Webhook", icon: Webhook },
  { id: "privacidade", label: "Política de Privacidade", icon: Shield },
  { id: "meus-pedidos", label: "Meus Pedidos (Público)", icon: Eye },
  { id: "arquitetura", label: "Arquitetura Técnica", icon: Server },
  { id: "banco-dados", label: "Banco de Dados", icon: Database },
  { id: "api", label: "Referência da API", icon: BookOpen },
];

export default function AdminDocs() {
  const { isLoading: authLoading } = useRequireAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-[1000]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back-dashboard">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-docs-title">Documentação NTeamKit</h1>
              <p className="text-sm text-muted-foreground">Tutorial completo e referência técnica</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <nav className="sticky top-24 space-y-1 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2" data-testid="nav-toc">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Índice</p>
            {tocItems.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground"
                data-testid={`toc-${item.id}`}
              >
                <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 space-y-6">

          <Section icon={Shirt} title="Visão Geral do Sistema" id="visao-geral">
            <p>
              O <strong className="text-foreground">NTeamKit</strong> é uma plataforma web completa para gestão de uniformes esportivos.
              Através dela, administradores criam formulários personalizados para que atletas selecionem e configurem seus uniformes
              (modelo, tamanho, número e nome), com integração de pagamento automática via Asaas.
            </p>
            <div className="bg-primary/5 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-foreground">Principais funcionalidades:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Criação de formulários de pedido com múltiplas camisetas</li>
                <li>Formulário público com link compartilhável para atletas</li>
                <li>Seleção de tamanho, número e apelido por camiseta</li>
                <li>Reserva de número em tempo real (evita conflitos)</li>
                <li>Provador Virtual com inteligência artificial</li>
                <li>Integração de pagamento automática (Asaas)</li>
                <li>Gestão de clientes, pedidos e relatórios financeiros</li>
                <li>Lista de produção com filtros e exportação</li>
                <li>Patrocinadores e política de privacidade</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Badge variant="secondary">React</Badge>
              <Badge variant="secondary">Express.js</Badge>
              <Badge variant="secondary">PostgreSQL</Badge>
              <Badge variant="secondary">Drizzle ORM</Badge>
              <Badge variant="secondary">TailwindCSS</Badge>
              <Badge variant="secondary">Shadcn UI</Badge>
              <Badge variant="secondary">Asaas API</Badge>
              <Badge variant="secondary">Replicate AI</Badge>
            </div>
          </Section>

          <Section icon={Lock} title="Primeiro Acesso e Login" id="primeiro-acesso">
            <p>Ao acessar o sistema pela primeira vez:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Acesse a página de login">
                <p>Navegue até <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/admin/login</code>. Na primeira vez, a tela exibirá o formulário de <strong className="text-foreground">registro</strong>.</p>
              </StepItem>
              <StepItem number={2} title="Crie sua conta de administrador">
                <p>Preencha o <strong className="text-foreground">e-mail</strong> e uma <strong className="text-foreground">senha segura</strong>. Clique em <strong className="text-foreground">"Criar Conta"</strong>.</p>
              </StepItem>
              <StepItem number={3} title="Faça login">
                <p>Após o registro, use suas credenciais para entrar. A sessão é mantida automaticamente até você sair.</p>
              </StepItem>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs">
              <strong>Importante:</strong> Apenas a primeira conta registrada se torna administradora. Para adicionar mais administradores, entre em contato com o suporte técnico.
            </div>
          </Section>

          <Section icon={Layout} title="Dashboard Principal" id="dashboard">
            <p>O dashboard é a tela inicial do painel administrativo. Nele você encontra:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Lista de Formulários">
                <p>Todos os formulários criados aparecem como cards. Cada card mostra o <strong className="text-foreground">nome do time</strong>, <strong className="text-foreground">logo</strong>, <strong className="text-foreground">tema visual</strong>, <strong className="text-foreground">prazo final</strong> e <strong className="text-foreground">quantidade de respostas</strong>.</p>
              </StepItem>
              <StepItem number={2} title="Criar Novo Formulário">
                <p>Clique no botão <strong className="text-foreground">"+ Novo Formulário"</strong> no canto superior direito para iniciar a criação de um novo formulário de uniformes.</p>
              </StepItem>
              <StepItem number={3} title="Acessar Formulário">
                <p>Clique em qualquer card de formulário para ver seus detalhes, respostas, pedidos e mapa de números.</p>
              </StepItem>
              <StepItem number={4} title="Menu de Navegação">
                <p>Use o menu lateral (sidebar) para acessar: <strong className="text-foreground">Clientes</strong>, <strong className="text-foreground">Relatórios</strong>, <strong className="text-foreground">Configurações</strong>, <strong className="text-foreground">Documentação</strong> e <strong className="text-foreground">Política de Privacidade</strong>.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={ClipboardList} title="Criar Formulário" id="criar-formulario">
            <p>Para criar um novo formulário de uniformes:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Informações do Time">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Nome do Time:</strong> Nome que aparecerá no topo do formulário público (obrigatório).</li>
                  <li><strong className="text-foreground">Tema Visual:</strong> Escolha entre temas de cores (Blue, Green, Red, Purple, Orange) que definem a aparência do formulário.</li>
                  <li><strong className="text-foreground">Prazo Final:</strong> Data limite para preenchimento do formulário (opcional). Após esta data, o formulário exibe um aviso de prazo expirado.</li>
                  <li><strong className="text-foreground">Logo do Time:</strong> Clique em "Alterar" para fazer upload da logo. Formatos aceitos: JPG, PNG. A logo aparece no cabeçalho do formulário público.</li>
                </ul>
              </StepItem>
              <StepItem number={2} title="Números Únicos">
                <p>Ative o switch <strong className="text-foreground">"Números únicos por formulário"</strong> para impedir que dois jogadores do mesmo gênero escolham o mesmo número na mesma camiseta. Quando ativo, o sistema reserva números em tempo real.</p>
              </StepItem>
              <StepItem number={3} title="WhatsApp de Suporte">
                <p>Informe um número de WhatsApp no formato <strong className="text-foreground">DDD + número</strong> (ex: 62994591234). Um botão flutuante de WhatsApp aparecerá no formulário público para que atletas entrem em contato.</p>
              </StepItem>
              <StepItem number={4} title="Tempo de Reserva de Número">
                <p>Defina por quanto tempo um número fica reservado enquanto o atleta preenche o formulário. Opções: <strong className="text-foreground">segundos, minutos ou horas</strong>. Após o tempo, o número é liberado automaticamente.</p>
              </StepItem>
              <StepItem number={5} title="Try-On Virtual">
                <p>Ative o switch para habilitar o <strong className="text-foreground">Provador Virtual</strong>. Quando ativo, atletas podem enviar uma foto e ver como a camiseta ficaria neles usando inteligência artificial.</p>
              </StepItem>
              <StepItem number={6} title="Adicionar Camisetas">
                <p>Na seção <strong className="text-foreground">"Camisetas"</strong>, clique em <strong className="text-foreground">"+ Adicionar Camiseta"</strong> para incluir modelos. Veja a seção "Gerenciar Camisetas" para detalhes.</p>
              </StepItem>
              <StepItem number={7} title="Salvar">
                <p>Clique em <strong className="text-foreground">"Salvar Formulário"</strong> no topo direito. Após salvar, o formulário recebe um link único de compartilhamento.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Settings} title="Editar Formulário" id="editar-formulario">
            <p>Para editar um formulário existente:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Acesse o formulário">
                <p>No dashboard, clique no card do formulário desejado para abrir a página de detalhes.</p>
              </StepItem>
              <StepItem number={2} title="Clique em Editar">
                <p>Clique no botão <strong className="text-foreground">"Editar"</strong> (ícone de lápis) no canto superior direito da página de detalhes.</p>
              </StepItem>
              <StepItem number={3} title="Faça as alterações">
                <p>Modifique qualquer campo: nome, tema, prazo, logo, camisetas, patrocinadores, etc. Todas as opções são as mesmas da criação.</p>
              </StepItem>
              <StepItem number={4} title="Salve as alterações">
                <p>Clique em <strong className="text-foreground">"Salvar Formulário"</strong>. As mudanças são refletidas imediatamente no formulário público.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Shirt} title="Gerenciar Camisetas" id="camisetas">
            <p>Cada formulário pode ter múltiplas camisetas. Para cada uma, configure:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Informações Básicas">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Nome da Camiseta:</strong> Ex: "Camiseta Padrão Preta (Time)", "Camiseta Dourada (Líbero)".</li>
                  <li><strong className="text-foreground">Preço:</strong> Valor em reais (ex: 45.99). Se for 0, a camiseta é gratuita.</li>
                  <li><strong className="text-foreground">Tipo de Modelo:</strong> "Com manga", "Sem manga", "Regata", etc.</li>
                </ul>
              </StepItem>
              <StepItem number={2} title="Gênero e Público">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Gênero:</strong> Masculino, Feminino ou Unisex. Define para quais atletas esta camiseta aparece.</li>
                  <li><strong className="text-foreground">Público:</strong> Adulto, Infantil ou Misto. Afeta as opções de tamanho disponíveis.</li>
                </ul>
              </StepItem>
              <StepItem number={3} title="Imagem da Camiseta">
                <p>Faça upload da imagem principal da camiseta. Esta imagem aparece no formulário público e também é usada no Provador Virtual. Formatos aceitos: JPG, PNG.</p>
              </StepItem>
              <StepItem number={4} title="Galeria de Imagens">
                <p>Além da imagem principal, você pode adicionar imagens adicionais na galeria. Os atletas podem navegar por todas as imagens ao selecionar a camiseta.</p>
              </StepItem>
              <StepItem number={5} title="Números Permitidos">
                <p>Opcionalmente, defina quais números estão disponíveis para esta camiseta. Use o formato: <code className="bg-muted px-1 rounded text-xs">1-25, 30, 99</code>. Se vazio, os números padrão (01-25 + personalizado) são usados.</p>
              </StepItem>
              <StepItem number={6} title="Remover Camiseta">
                <p>Clique no botão de lixeira ao lado da camiseta para removê-la. A remoção só é efetivada ao salvar o formulário.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Star} title="Patrocinadores" id="patrocinadores">
            <p>Adicione logos e descrições de patrocinadores que serão exibidos no formulário público:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Adicionar Logo">
                <p>Na seção <strong className="text-foreground">"Patrocinadores"</strong> do formulário, clique no botão <strong className="text-foreground">"+"</strong> para fazer upload de uma logo de patrocinador. Formatos aceitos: JPG, PNG, SVG.</p>
              </StepItem>
              <StepItem number={2} title="Múltiplos Patrocinadores">
                <p>Você pode adicionar quantos patrocinadores quiser. As logos são exibidas lado a lado no formulário público.</p>
              </StepItem>
              <StepItem number={3} title="Descrição dos Patrocinadores">
                <p>No campo <strong className="text-foreground">"Descrição dos Patrocinadores"</strong>, use formatação rich text:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><code className="bg-muted px-1 rounded text-xs">**texto**</code> para <strong>negrito</strong></li>
                  <li><code className="bg-muted px-1 rounded text-xs">[texto](https://url.com)</code> para links</li>
                  <li>Linhas em branco para separar parágrafos</li>
                </ul>
              </StepItem>
              <StepItem number={4} title="Remover Patrocinador">
                <p>Clique no <strong className="text-foreground">"X"</strong> sobre a logo do patrocinador para removê-lo.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Sparkles} title="Provador Virtual (Try-On)" id="tryon">
            <p>O Provador Virtual usa inteligência artificial para mostrar como a camiseta ficaria no corpo do atleta:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Ativar no Formulário">
                <p>No editor do formulário, ative o switch <strong className="text-foreground">"Try-On Virtual"</strong>. Isso habilita o botão "Testar uniforme em mim" no formulário público.</p>
              </StepItem>
              <StepItem number={2} title="Como o Atleta Usa">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Na etapa de seleção de camisetas, o atleta clica em <strong className="text-foreground">"Testar uniforme em mim"</strong>.</li>
                  <li>Um modal se abre pedindo uma <strong className="text-foreground">foto de corpo inteiro</strong> (JPG ou PNG, máximo 50MB).</li>
                  <li>O atleta arrasta ou seleciona a foto, depois escolhe a camiseta desejada.</li>
                  <li>Clica em <strong className="text-foreground">"Gerar Visualização"</strong> e aguarda (pode levar até 30 segundos).</li>
                  <li>O resultado mostra a camiseta "vestida" no corpo do atleta.</li>
                  <li>O atleta pode baixar a imagem gerada ou tentar novamente.</li>
                </ul>
              </StepItem>
              <StepItem number={3} title="Tecnologia">
                <p>Usa o modelo de IA <strong className="text-foreground">IDM-VTON</strong> via Replicate API. O processamento é feito na nuvem e requer o token <code className="bg-muted px-1 rounded text-xs">REPLICATE_API_TOKEN</code> configurado.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Smartphone} title="Compartilhar Formulário" id="compartilhar">
            <p>Após criar e salvar o formulário, compartilhe com os atletas:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Obter o Link">
                <p>Na página de detalhes do formulário, encontre o <strong className="text-foreground">link público</strong> no topo. O formato é: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://seu-dominio.com/form/CODIGO_UNICO</code></p>
              </StepItem>
              <StepItem number={2} title="Copiar e Enviar">
                <p>Clique no botão <strong className="text-foreground">"Copiar"</strong> ao lado do link. Envie por WhatsApp, e-mail, ou qualquer meio de comunicação para os atletas.</p>
              </StepItem>
              <StepItem number={3} title="QR Code">
                <p>Use o QR Code gerado automaticamente para compartilhar de forma visual em cartazes, grupos, etc.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Users} title="Fluxo do Atleta (Formulário Público)" id="fluxo-atleta">
            <p>Quando o atleta acessa o link do formulário, ele passa pelas seguintes etapas:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Etapa 1 — CPF">
                <ul className="list-disc pl-5 space-y-1">
                  <li>O atleta digita seu <strong className="text-foreground">CPF</strong>.</li>
                  <li>O sistema verifica se já existe um pedido com esse CPF neste formulário.</li>
                  <li>Se existir, mostra os pedidos anteriores com opção de <strong className="text-foreground">"Ir para Pagamento"</strong> (se pendente) ou <strong className="text-foreground">"Editar pedido"</strong>.</li>
                  <li>Se não existir, pode clicar em <strong className="text-foreground">"Continuar"</strong> para fazer um novo pedido.</li>
                  <li>Se houver um rascunho salvo localmente, oferece restaurá-lo.</li>
                </ul>
              </StepItem>
              <StepItem number={2} title="Etapa 2 — Dados Pessoais">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Nome Completo:</strong> Preenchimento obrigatório. Automaticamente convertido para MAIÚSCULAS.</li>
                  <li><strong className="text-foreground">Telefone/WhatsApp:</strong> Formato com DDD. Usado para identificação do pedido.</li>
                  <li><strong className="text-foreground">Sexo:</strong> Masculino ou Feminino. Define quais camisetas e números estarão disponíveis.</li>
                </ul>
              </StepItem>
              <StepItem number={3} title="Etapa 3 — Seleção de Camisetas">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Todas as camisetas disponíveis para o gênero selecionado são exibidas.</li>
                  <li>Para cada camiseta, o atleta define: <strong className="text-foreground">quantidade</strong>, <strong className="text-foreground">tamanho</strong> (PP a GGG), <strong className="text-foreground">número</strong> e <strong className="text-foreground">apelido/nome</strong>.</li>
                  <li>Ao selecionar um número, ele é <strong className="text-foreground">reservado em tempo real</strong> por um período configurado pelo admin.</li>
                  <li>Números já escolhidos por outros atletas aparecem como indisponíveis.</li>
                  <li>Se o Provador Virtual estiver ativo, o botão <strong className="text-foreground">"Testar uniforme em mim"</strong> aparece no topo.</li>
                  <li>O <strong className="text-foreground">Resumo do Pedido</strong> aparece na lateral (desktop) ou no rodapé (mobile) com valores totais.</li>
                </ul>
              </StepItem>
              <StepItem number={4} title="Etapa 4 — Resumo e Confirmação">
                <ul className="list-disc pl-5 space-y-1">
                  <li>O atleta revisa todos os itens selecionados, com detalhes de cada camiseta.</li>
                  <li>O valor total é calculado automaticamente.</li>
                  <li>Ao clicar em <strong className="text-foreground">"Confirmar Pedido"</strong>, o sistema cria a resposta e gera a cobrança no Asaas.</li>
                  <li>Uma tela de sucesso exibe o status do pagamento e um botão para <strong className="text-foreground">"Pagar Agora"</strong>, que abre a página de pagamento do Asaas.</li>
                </ul>
              </StepItem>
            </div>
          </Section>

          <Section icon={ClipboardList} title="Gerenciar Respostas" id="respostas">
            <p>Na página de detalhes de um formulário, a aba <strong className="text-foreground">"Respostas"</strong> mostra todas as submissões dos atletas:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Visualizar Respostas">
                <p>Lista com <strong className="text-foreground">nome</strong>, <strong className="text-foreground">CPF</strong>, <strong className="text-foreground">telefone</strong>, <strong className="text-foreground">gênero</strong> e <strong className="text-foreground">data</strong> de cada resposta. Clique em uma resposta para expandir os detalhes dos pedidos.</p>
              </StepItem>
              <StepItem number={2} title="Alterar Gênero">
                <p>Use o seletor de gênero ao lado de cada resposta para alterar entre Masculino e Feminino. A alteração propaga automaticamente para pedidos, reservas de número e é registrada no log de auditoria.</p>
              </StepItem>
              <StepItem number={3} title="Excluir Resposta">
                <p>Clique no ícone de lixeira para excluir uma resposta. Isso remove todos os pedidos e reservas de número associados. A ação é irreversível.</p>
              </StepItem>
              <StepItem number={4} title="Filtrar por Gênero">
                <p>Use os botões <strong className="text-foreground">"Todos"</strong>, <strong className="text-foreground">"Masculino"</strong> e <strong className="text-foreground">"Feminino"</strong> para filtrar as respostas exibidas.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Hash} title="Mapa de Números" id="numeros">
            <p>A aba <strong className="text-foreground">"Números"</strong> na página de detalhes mostra uma grade visual de todos os números:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Visualização em Grade">
                <p>Cada número aparece como um quadrado colorido: <strong className="text-foreground">verde</strong> (disponível), <strong className="text-foreground">azul</strong> (ocupado com nome do atleta), <strong className="text-foreground">amarelo</strong> (reservado temporariamente).</p>
              </StepItem>
              <StepItem number={2} title="Filtrar por Gênero">
                <p>Use os botões <strong className="text-foreground">"Todos"</strong>, <strong className="text-foreground">"Masculino"</strong>, <strong className="text-foreground">"Feminino"</strong> para ver os números por gênero. Cada gênero tem seu próprio mapa independente.</p>
              </StepItem>
              <StepItem number={3} title="Filtrar por Camiseta">
                <p>Selecione uma camiseta específica para ver quais números estão disponíveis nela.</p>
              </StepItem>
              <StepItem number={4} title="Liberar Número">
                <p>Clique em um número ocupado ou reservado para liberá-lo manualmente. Útil em casos de cancelamento ou erro.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={ShoppingCart} title="Pedidos e Pagamentos" id="pedidos">
            <p>A aba <strong className="text-foreground">"Pedidos"</strong> mostra todos os pedidos de pagamento do formulário:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Lista de Pedidos">
                <p>Cada pedido mostra: <strong className="text-foreground">nome do cliente</strong>, <strong className="text-foreground">CPF</strong>, <strong className="text-foreground">valor total</strong>, <strong className="text-foreground">status do pagamento</strong> e <strong className="text-foreground">data</strong>.</p>
              </StepItem>
              <StepItem number={2} title="Status de Pagamento">
                <ul className="list-disc pl-5 space-y-1">
                  <li><Badge className="bg-gray-100 text-gray-700 text-xs">PENDENTE</Badge> Aguardando configuração de pagamento</li>
                  <li><Badge className="bg-yellow-100 text-yellow-700 text-xs">AGUARDANDO</Badge> Cobrança criada, aguardando pagamento</li>
                  <li><Badge className="bg-green-100 text-green-700 text-xs">PAGO</Badge> Pagamento confirmado</li>
                  <li><Badge className="bg-red-100 text-red-700 text-xs">VENCIDO</Badge> Pagamento não realizado no prazo</li>
                  <li><Badge className="bg-gray-100 text-gray-700 text-xs">CANCELADO</Badge> Pagamento cancelado</li>
                </ul>
              </StepItem>
              <StepItem number={3} title="Detalhes do Pedido">
                <p>Clique em um pedido para ver todos os itens (camisetas, tamanhos, números, apelidos), valores e link de pagamento.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Layers} title="Lista de Produção" id="producao">
            <p>A aba <strong className="text-foreground">"Produção"</strong> organiza os pedidos para facilitar a produção dos uniformes:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Filtrar por Status">
                <p>Filtre para ver apenas pedidos <strong className="text-foreground">pagos</strong>, <strong className="text-foreground">pendentes</strong> ou <strong className="text-foreground">todos</strong>.</p>
              </StepItem>
              <StepItem number={2} title="Filtrar por Gênero">
                <p>Filtre por <strong className="text-foreground">Masculino</strong> ou <strong className="text-foreground">Feminino</strong> para separar a produção.</p>
              </StepItem>
              <StepItem number={3} title="Exportar">
                <p>Exporte a lista de produção em <strong className="text-foreground">CSV</strong> ou <strong className="text-foreground">PDF</strong> para enviar à fábrica ou gráfica.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Users} title="Gestão de Clientes" id="clientes">
            <p>Acesse pelo menu lateral: <strong className="text-foreground">"Clientes"</strong>. A página lista todos os clientes cadastrados automaticamente:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Lista de Clientes">
                <p>Busque por <strong className="text-foreground">nome</strong>, <strong className="text-foreground">CPF</strong> ou <strong className="text-foreground">telefone</strong>. A lista mostra todos os atletas que já fizeram pedidos.</p>
              </StepItem>
              <StepItem number={2} title="Detalhes do Cliente">
                <p>Clique em um cliente para ver: dados pessoais, histórico de pedidos em todos os formulários e log de auditoria (alterações feitas).</p>
              </StepItem>
              <StepItem number={3} title="Editar Dados">
                <p>Edite o <strong className="text-foreground">nome</strong> e <strong className="text-foreground">telefone</strong> do cliente. Todas as alterações são registradas no log de auditoria com valores antigos e novos.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={CreditCard} title="Relatórios Financeiros" id="relatorios">
            <p>Acesse pelo menu lateral: <strong className="text-foreground">"Relatórios"</strong>. Visão financeira completa:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Resumo Financeiro">
                <p>Cards com <strong className="text-foreground">Total Recebido</strong>, <strong className="text-foreground">Total Pendente</strong> e <strong className="text-foreground">Total de Pedidos</strong> de todos os formulários.</p>
              </StepItem>
              <StepItem number={2} title="Lista de Pedidos">
                <p>Todos os pedidos do sistema com filtros por status de pagamento e busca por nome/CPF.</p>
              </StepItem>
              <StepItem number={3} title="Exportação">
                <p>Exporte relatórios em CSV para análise em planilhas.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Settings} title="Configurações de Pagamento (Asaas)" id="pagamento-config">
            <p>Acesse pelo menu lateral: <strong className="text-foreground">"Configurações"</strong>. Configure a integração com o Asaas:</p>
            <div className="space-y-4">
              <StepItem number={1} title="API Key do Asaas">
                <p>Insira a chave de API do Asaas. Obtenha em: <code className="bg-muted px-1 rounded text-xs">Painel Asaas → Integrações → API</code>.</p>
              </StepItem>
              <StepItem number={2} title="Ambiente">
                <p>Selecione <strong className="text-foreground">Sandbox</strong> para testes ou <strong className="text-foreground">Produção</strong> para cobranças reais.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Sandbox:</strong> <code className="bg-muted px-1 rounded text-xs">https://sandbox.asaas.com</code> — Use para testar sem cobranças reais.</li>
                  <li><strong className="text-foreground">Produção:</strong> <code className="bg-muted px-1 rounded text-xs">https://api.asaas.com</code> — Cobranças reais com PIX, boleto e cartão.</li>
                </ul>
              </StepItem>
              <StepItem number={3} title="URL do Webhook">
                <p>O webhook é configurado automaticamente. A URL é: <code className="bg-muted px-1 rounded text-xs">https://seu-dominio.com/api/webhooks/asaas</code>.</p>
              </StepItem>
              <StepItem number={4} title="Salvar">
                <p>Clique em <strong className="text-foreground">"Salvar Configurações"</strong>. As configurações são usadas em todos os formulários.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Webhook} title="Configuração do Webhook" id="webhook">
            <p>O webhook permite que o Asaas notifique o sistema automaticamente quando um pagamento é realizado:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Acesse o Painel Asaas">
                <p>Entre no painel do Asaas (sandbox ou produção) e navegue até <strong className="text-foreground">Integrações → Webhooks</strong>.</p>
              </StepItem>
              <StepItem number={2} title="Adicione a URL">
                <p>Cole a URL: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://seu-dominio.com/api/webhooks/asaas</code></p>
              </StepItem>
              <StepItem number={3} title="Selecione os Eventos">
                <p>Marque os eventos de pagamento para receber notificações automáticas.</p>
              </StepItem>
            </div>
            <CodeBlock>{`Eventos tratados pelo sistema:
PAYMENT_RECEIVED   → Status atualizado para PAGO
PAYMENT_CONFIRMED  → Status atualizado para PAGO
PAYMENT_OVERDUE    → Status atualizado para VENCIDO
PAYMENT_DELETED    → Status atualizado para CANCELADO
PAYMENT_REFUNDED   → Status atualizado para CANCELADO
PAYMENT_RESTORED   → Status atualizado para AGUARDANDO`}</CodeBlock>
          </Section>

          <Section icon={Shield} title="Política de Privacidade" id="privacidade">
            <p>Configure a política de privacidade que é exibida nos formulários públicos:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Acesse o Editor">
                <p>No menu lateral, clique em <strong className="text-foreground">"Política de Privacidade"</strong> (dentro de Configurações).</p>
              </StepItem>
              <StepItem number={2} title="Edite o Conteúdo">
                <p>Use o editor de texto para escrever sua política de privacidade. Suporta formatação rich text com <strong>negrito</strong>, links e parágrafos.</p>
              </StepItem>
              <StepItem number={3} title="Salve">
                <p>Clique em <strong className="text-foreground">"Salvar"</strong>. A política aparece como um link no rodapé de todos os formulários públicos. Ao clicar, abre um modal com o texto completo.</p>
              </StepItem>
            </div>
          </Section>

          <Section icon={Eye} title="Meus Pedidos (Página Pública)" id="meus-pedidos">
            <p>Atletas podem consultar e pagar seus pedidos sem precisar do admin:</p>
            <div className="space-y-4">
              <StepItem number={1} title="Página 'Pagar Pedido'">
                <p>Acesse <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/pay</code>. O atleta informa <strong className="text-foreground">CPF</strong> e <strong className="text-foreground">Telefone</strong> para buscar seus pedidos.</p>
              </StepItem>
              <StepItem number={2} title="Página 'Meus Pedidos'">
                <p>Acesse <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/meus-pedidos/CPF</code>. Lista todos os pedidos do atleta com status, valores e botões de ação.</p>
              </StepItem>
              <StepItem number={3} title="Ações Disponíveis">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">Pagar:</strong> Abre a página de pagamento do Asaas (para pedidos pendentes).</li>
                  <li><strong className="text-foreground">Ver Detalhes:</strong> Mostra todos os itens do pedido.</li>
                  <li><strong className="text-foreground">Cancelar:</strong> Cancela um pedido pendente.</li>
                </ul>
              </StepItem>
            </div>
          </Section>

          <Section icon={Server} title="Arquitetura Técnica" id="arquitetura">
            <p>A aplicação segue uma arquitetura fullstack JavaScript:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Frontend:</strong> React + Vite + TailwindCSS + Shadcn UI + Wouter (roteamento)</li>
              <li><strong className="text-foreground">Backend:</strong> Express.js + Drizzle ORM + express-session</li>
              <li><strong className="text-foreground">Banco de Dados:</strong> PostgreSQL</li>
              <li><strong className="text-foreground">Autenticação:</strong> bcrypt + express-session + connect-pg-simple</li>
              <li><strong className="text-foreground">Pagamentos:</strong> Integração com API Asaas (sandbox/produção)</li>
              <li><strong className="text-foreground">Upload de Arquivos:</strong> Multer (armazenamento em base64 no banco)</li>
              <li><strong className="text-foreground">Tempo Real:</strong> WebSocket (ws) para reservas de número</li>
              <li><strong className="text-foreground">IA:</strong> Replicate API para Provador Virtual</li>
            </ul>
            <CodeBlock>{`Estrutura de diretórios:
├── client/src/
│   ├── pages/          # Páginas da aplicação
│   ├── components/     # Componentes reutilizáveis (TryOnModal, etc.)
│   ├── lib/            # Utilitários (auth, queryClient)
│   └── hooks/          # Custom hooks
├── server/
│   ├── routes.ts       # Rotas da API
│   ├── storage.ts      # Interface de armazenamento (CRUD)
│   ├── asaas.ts        # Integração com Asaas
│   ├── db.ts           # Conexão com banco de dados
│   └── index.ts        # Configuração do Express
└── shared/
    └── schema.ts       # Esquema do banco (Drizzle ORM)`}</CodeBlock>
          </Section>

          <Section icon={Database} title="Estrutura do Banco de Dados" id="banco-dados">
            <p>O banco de dados PostgreSQL contém as seguintes tabelas:</p>
            <div className="space-y-2">
              <CollapsibleSection title="admins — Contas de administradores">
                <p>Contas de administradores com email e senha hash (bcrypt).</p>
                <CodeBlock>{`id (PK serial), email (unique), password_hash, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="forms — Formulários de uniformes">
                <p>Formulários criados pelo administrador. Cada formulário possui um share_id único para acesso público.</p>
                <CodeBlock>{`id (PK serial), team_name, logo_url, theme, deadline,
number_rule_unique, support_whatsapp, share_id (unique),
reservation_time_value, reservation_time_unit,
sponsor_description, tryon_enabled, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="jerseys — Modelos de camisetas">
                <p>Modelos de camisas disponíveis em cada formulário, com preço, tipo de modelo e gênero.</p>
                <CodeBlock>{`id (PK serial), form_id (FK), name, price, model_type,
gender_type (male/female/unisex), audience_type (adult/child/mixed),
allowed_numbers, image_url`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="responses — Respostas dos atletas">
                <p>Respostas dos atletas com dados pessoais. Único por CPF + telefone por formulário.</p>
                <CodeBlock>{`id (PK serial), form_id (FK), athlete_name, cpf, phone,
gender (male/female), created_at, updated_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="jersey_orders — Pedidos de camisetas">
                <p>Pedidos individuais de camisas com tamanho, número e nome personalizado.</p>
                <CodeBlock>{`id (PK serial), response_id (FK), jersey_id (FK), form_id (FK),
quantity, size, number, nickname, gender,
extra_numbers (JSONB array)`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="orders — Pedidos de pagamento">
                <p>Pedidos de pagamento vinculados às respostas, com status e IDs do Asaas.</p>
                <CodeBlock>{`id (PK serial), response_id (FK), form_id (FK), customer_name,
cpf, phone, total_amount, payment_status,
asaas_payment_id, asaas_customer_id, asaas_payment_url, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="number_reservations — Reservas de número">
                <p>Reservas temporárias de números para evitar conflitos entre atletas.</p>
                <CodeBlock>{`id (PK serial), form_id (FK), jersey_id (FK), number,
gender, session_id, expires_at, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="customers — Cadastro de clientes">
                <p>Registros de clientes criados automaticamente a partir das respostas.</p>
                <CodeBlock>{`id (PK serial), name, cpf (unique), phone, notes, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="audit_logs — Logs de auditoria">
                <p>Registros de todas as alterações feitas em dados de clientes e respostas.</p>
                <CodeBlock>{`id (PK serial), entity_type, entity_id, action,
old_value (JSONB), new_value (JSONB), admin_id, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="payment_settings — Configurações de pagamento">
                <p>Configurações da API Asaas (chave, ambiente, URL do webhook).</p>
                <CodeBlock>{`id (PK serial), asaas_api_key, environment, webhook_url, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="form_sponsors — Logos de patrocinadores">
                <p>Logos de patrocinadores vinculados a formulários.</p>
                <CodeBlock>{`id (PK serial), form_id (FK), logo_url, created_at`}</CodeBlock>
              </CollapsibleSection>
              <CollapsibleSection title="system_settings — Configurações globais">
                <p>Armazena configurações globais como a política de privacidade.</p>
                <CodeBlock>{`id (PK serial), key (unique), value (text), created_at`}</CodeBlock>
              </CollapsibleSection>
            </div>
          </Section>

          <Section icon={BookOpen} title="Referência da API" id="api">
            <p>Referência completa das rotas disponíveis na API:</p>
            <div className="space-y-4">
              <CollapsibleSection title="Rotas Públicas (sem autenticação)">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/share/:shareId</code> <span className="text-xs">Obter formulário pelo link público</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/jerseys</code> <span className="text-xs">Listar camisas do formulário</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/numbers</code> <span className="text-xs">Números ocupados</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/reservations</code> <span className="text-xs">Reservas ativas</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/responses</code> <span className="text-xs">Submeter resposta do atleta</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">PUT</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/responses/:id</code> <span className="text-xs">Atualizar resposta existente</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/check-number</code> <span className="text-xs">Verificar disponibilidade de número</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/responses/lookup</code> <span className="text-xs">Buscar resposta por CPF + telefone</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/orders/lookup-cpf</code> <span className="text-xs">Buscar pedidos por CPF</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/orders/by-cpf</code> <span className="text-xs">Buscar pedidos por CPF (global)</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/orders/:id</code> <span className="text-xs">Obter pedido por ID</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/orders/:id/detail</code> <span className="text-xs">Detalhes completos do pedido</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/webhooks/asaas</code> <span className="text-xs">Webhook do Asaas</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/tryon</code> <span className="text-xs">Gerar visualização virtual (Try-On)</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/privacy-policy</code> <span className="text-xs">Obter política de privacidade</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/sponsors</code> <span className="text-xs">Listar patrocinadores</span></div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Rotas Protegidas (requer autenticação)">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/register</code> <span className="text-xs">Registrar administrador</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/login</code> <span className="text-xs">Login do administrador</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/me</code> <span className="text-xs">Dados do admin logado</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms</code> <span className="text-xs">Listar formulários</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms</code> <span className="text-xs">Criar formulário</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">PATCH</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id</code> <span className="text-xs">Atualizar formulário</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">DELETE</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id</code> <span className="text-xs">Excluir formulário</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/jerseys</code> <span className="text-xs">Criar camiseta</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">PATCH</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/jerseys/:id</code> <span className="text-xs">Atualizar camiseta</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">DELETE</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/jerseys/:id</code> <span className="text-xs">Excluir camiseta</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/responses</code> <span className="text-xs">Listar respostas</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">DELETE</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/responses/:id</code> <span className="text-xs">Excluir resposta</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/all-orders</code> <span className="text-xs">Todos os pedidos</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET/POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/payment-settings</code> <span className="text-xs">Configurações de pagamento</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET/POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/privacy-policy</code> <span className="text-xs">Política de privacidade</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">GET</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/customers</code> <span className="text-xs">Listar clientes</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">PATCH</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/customers/:id</code> <span className="text-xs">Atualizar cliente</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">POST</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/forms/:id/sponsors</code> <span className="text-xs">Adicionar patrocinador</span></div>
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="secondary" className="text-xs">DELETE</Badge> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/sponsors/:id</code> <span className="text-xs">Remover patrocinador</span></div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Páginas de Navegação">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Painel Administrativo</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/login</code> <span className="text-xs">Login / Registro do administrador</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/</code> <span className="text-xs">Dashboard principal com formulários</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/forms/new</code> <span className="text-xs">Criar novo formulário</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/forms/:id</code> <span className="text-xs">Detalhes do formulário (respostas, números, pedidos, produção)</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/forms/:id/edit</code> <span className="text-xs">Editar formulário</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/customers</code> <span className="text-xs">Gestão de clientes</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/orders/:id</code> <span className="text-xs">Detalhes de um pedido</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/reports</code> <span className="text-xs">Relatórios financeiros</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/settings</code> <span className="text-xs">Configurações de pagamento</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/privacy-policy</code> <span className="text-xs">Editor da política de privacidade</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/admin/docs</code> <span className="text-xs">Documentação do sistema</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Páginas Públicas</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/form/:shareId</code> <span className="text-xs">Formulário público do atleta</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/pay</code> <span className="text-xs">Buscar e pagar pedidos por CPF</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/meus-pedidos/:cpf</code> <span className="text-xs">Meus pedidos (histórico do atleta)</span></div>
                      <div className="flex items-center gap-2 flex-wrap"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">/pedido/:id</code> <span className="text-xs">Detalhes de um pedido específico</span></div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </Section>

          <div className="border-t pt-6 mt-8">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">NTeamKit</strong> — Sistema de Gestão de Uniformes Esportivos
              </p>
              <p className="text-xs text-muted-foreground">
                <a href="/admin/privacy-policy" className="text-primary hover:underline" data-testid="link-footer-privacy">
                  Política de Privacidade
                </a>
              </p>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}