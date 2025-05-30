import React, { useState } from 'react';
import { ChevronRight, Download, Edit2, AlertTriangle, CheckCircle, Building2, DollarSign, Settings, Info, FileText, Database, Plus, ArrowLeft, Send, Eye } from 'lucide-react';

// Constantes baseadas na análise dos dados do CEA
const forcas = [
  'Corpo de Bombeiros Militar',
  'Polícia Civil', 
  'Polícia Militar',
  'Polícia Penal',
  'Polícia Científica'
];

// Tipos de unidades ATUALIZADOS baseados no PDF e especificações
const tiposUnidade = {
  'Corpo de Bombeiros Militar': [
    'Pelotão',
    'Companhia', 
    'Companhia Independente',
    'Batalhão',
    'Comando Regional'
  ],
  'Polícia Militar': [
    'Pelotão',
    'Companhia',
    'Companhia Independente', 
    'Batalhão',
    'Comando Regional'
  ],
  'Polícia Civil': [
    'Delegacia Cidadã Padrão IA (376,73 m²)',
    'Delegacia Cidadã Padrão I (642,29 m²)',
    'Delegacia Cidadã Padrão II (1.207,48 m²)',
    'Delegacia Cidadã Padrão III (1.791,23 m²)'
  ],
  'Polícia Penal': [
    'Casa de Custódia',
    'Penitenciária'
  ],
  'Polícia Científica': [
    'UETC Básica',
    'UETC Intermediária', 
    'Posto Avançado'
  ]
};

// Mapeamento de tamanhos dos empreendimentos baseado no PDF
const tamanhosPorUnidade = {
  // Polícia Civil - baseado no PDF das Delegacias Cidadãs
  'Delegacia Cidadã Padrão IA (376,73 m²)': {
    area: 376.73,
    investimento: 2768965.50,
    pavimentos: 1,
    categoria: 'pequeno',
    lote_minimo: 1400
  },
  'Delegacia Cidadã Padrão I (642,29 m²)': {
    area: 642.29,
    investimento: 4720831.50,
    pavimentos: 1,
    categoria: 'medio',
    lote_minimo: 1500
  },
  'Delegacia Cidadã Padrão II (1.207,48 m²)': {
    area: 1207.48,
    investimento: 8874978.00,
    pavimentos: 2,
    categoria: 'grande',
    lote_minimo: 1500
  },
  'Delegacia Cidadã Padrão III (1.791,23 m²)': {
    area: 1791.23,
    investimento: 13165540.50,
    pavimentos: 3,
    categoria: 'muito_grande',
    lote_minimo: 1500
  },
  
  // Polícia Penal - estimativas baseadas em complexidade
  'Casa de Custódia': {
    area: 800,
    categoria: 'medio',
    complexidade_seguranca: 'alta'
  },
  'Penitenciária': {
    area: 2500,
    categoria: 'muito_grande',
    complexidade_seguranca: 'maxima'
  },
  
  // Polícia Científica - sem informações de tamanho específicas
  'UETC Básica': {
    categoria: 'pequeno',
    complexidade_tecnica: 'baixa'
  },
  'UETC Intermediária': {
    categoria: 'medio',
    complexidade_tecnica: 'media'
  },
  'Posto Avançado': {
    categoria: 'pequeno',
    complexidade_tecnica: 'baixa'
  },
  
  // CBMPR e PMPR
  'Pelotão': { area: 400, categoria: 'pequeno' },
  'Companhia': { area: 800, categoria: 'medio' },
  'Companhia Independente': { area: 1000, categoria: 'grande' },
  'Batalhão': { area: 1500, categoria: 'grande' },
  'Comando Regional': { area: 300, categoria: 'pequeno' } // Corrigido: pequeno (só estrutura administrativa)
};

// Tipos de intervenção baseados nos dados do CEA
const tiposIntervencao = ['Construção', 'Reforma', 'Reparos'];

// Regimes de execução incluindo contratação semi-integrada
const regimesExecucao = [
  'Empreitada por preço global',
  'Empreitada por preço unitário',
  'Contratação por tarefa',
  'Contratação integrada',
  'Contratação semi-integrada',
  'Empreitada integral'
];

// Características especiais organizadas por ordem alfabética
const caracteristicasEspeciais = [
  'Área de segurança máxima',
  'Demolição de estruturas',
  'Necessita licenciamento ambiental',
  'Necessita relocação temporária',
  'Obra em área urbana densamente povoada',
  'Obra em unidade em funcionamento'
];

// Função para obter a URL base da API
const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  return 'http://localhost:5001';
};

const RiskMatrixApp = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [currentPage, setCurrentPage] = useState('form'); // 'form', 'all-risks', 'suggest'
  const [projectData, setProjectData] = useState({
    forca: '',
    tipoUnidade: '',
    tipoIntervencao: '',
    regimeExecucao: '',
    valor: '',
    caracteristicas: []
  });
  const [selectedRisks, setSelectedRisks] = useState([]);
  const [allRisks, setAllRisks] = useState(null);
  const [allRisksStats, setAllRisksStats] = useState(null);
  const [selectedRiskForSuggestion, setSelectedRiskForSuggestion] = useState(null);
  const [suggestionForm, setSuggestionForm] = useState({
    tipo_sugestao: '',
    nome_sugerinte: '',
    email_sugerinte: '',
    risco_id: '',
    descricao_alteracao: '',
    novo_evento: '',
    nova_descricao: '',
    nova_mitigacao: '',
    nova_correcao: '',
    justificativa: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingAllRisks, setIsLoadingAllRisks] = useState(false);
  const [isSendingSuggestion, setIsSendingSuggestion] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [suggestionSuccess, setSuggestionSuccess] = useState(null);

  const handleInputChange = (field, value) => {
    setProjectData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'forca') {
        newData.tipoUnidade = '';
      }
      return newData;
    });
  };

  const handleCaracteristicaToggle = (caracteristica) => {
    setProjectData(prev => ({
      ...prev,
      caracteristicas: prev.caracteristicas.includes(caracteristica)
        ? prev.caracteristicas.filter(c => c !== caracteristica)
        : [...prev.caracteristicas, caracteristica]
    }));
  };

  // Função para obter informações do tamanho da unidade
  const getTamanhoInfo = (tipoUnidade) => {
    return tamanhosPorUnidade[tipoUnidade] || { categoria: 'medio', area: 0 };
  };

  // Lógica APRIMORADA de seleção de riscos baseada nos dados do CEA E TAMANHOS
  const getAdvancedRiskCriteria = (projData) => {
    const criteria = {
      tipo_obra_chave: null,
      risk_multipliers: {},
      additional_risks: [],
      excluded_risks: [],
      debug_logic: [],
      tamanho_info: getTamanhoInfo(projData.tipoUnidade)
    };

    // Adicionar informações de tamanho aos critérios
    const tamanhoInfo = criteria.tamanho_info;
    criteria.debug_logic.push(`Tamanho identificado: ${tamanhoInfo.categoria} (${tamanhoInfo.area || 'N/A'} m²)`);

    // 1. MAPEAMENTO PRINCIPAL - Baseado nos dados reais do CEA
    if (projData.forca === 'Polícia Penal') {
      if (['Casa de Custódia', 'Penitenciária'].includes(projData.tipoUnidade)) {
        criteria.tipo_obra_chave = 'presidios';
        criteria.debug_logic.push('Mapeamento: Polícia Penal → presidios');
        
        // Riscos específicos baseados no tipo de estabelecimento penal
        if (projData.tipoUnidade === 'Penitenciária') {
          criteria.additional_risks.push(...[10, 12, 13, 15, 30, 49]); // Segurança máxima
          criteria.debug_logic.push('+ Riscos de segurança máxima (Penitenciária)');
        } else if (projData.tipoUnidade === 'Casa de Custódia') {
          criteria.additional_risks.push(...[10, 12, 25]); // Segurança alta
          criteria.debug_logic.push('+ Riscos de segurança alta (Casa de Custódia)');
        }
      }
    } else if (projData.forca === 'Polícia Civil') {
      if (projData.tipoUnidade?.includes('Delegacia')) {
        criteria.tipo_obra_chave = 'delegacias';
        criteria.debug_logic.push('Mapeamento: Polícia Civil → delegacias');
        
        // Riscos específicos baseados no padrão da delegacia
        if (projData.tipoUnidade.includes('Padrão IA')) {
          criteria.excluded_risks.push(...[1, 4, 23, 37]); // Obra pequena, menos complexidade
          criteria.debug_logic.push('- Riscos de alta complexidade (Padrão IA - pequeno)');
        } else if (projData.tipoUnidade.includes('Padrão I') && !projData.tipoUnidade.includes('IA')) {
          criteria.debug_logic.push('Padrão I - complexidade média');
        } else if (projData.tipoUnidade.includes('Padrão II')) {
          criteria.additional_risks.push(...[23, 37]); // Mais pavimentos, mais complexidade
          criteria.debug_logic.push('+ Riscos de múltiplos pavimentos (Padrão II)');
        } else if (projData.tipoUnidade.includes('Padrão III')) {
          criteria.additional_risks.push(...[1, 4, 23, 37, 46]); // Obra grande, todos os riscos
          criteria.debug_logic.push('+ Riscos de alta complexidade (Padrão III - 3 pavimentos)');
        }
      }
    } else if (projData.forca === 'Corpo de Bombeiros Militar' || projData.forca === 'Polícia Militar') {
      if (['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional'].includes(projData.tipoUnidade)) {
        criteria.tipo_obra_chave = 'quarteis';
        criteria.debug_logic.push(`Mapeamento: ${projData.forca} → quarteis`);
        
        // Comando Regional é pequeno (só estrutura administrativa)
        if (projData.tipoUnidade === 'Comando Regional') {
          criteria.excluded_risks.push(...[1, 4, 9]); // Reduzir complexidade
          criteria.debug_logic.push('- Complexidade reduzida (Comando Regional - estrutura administrativa)');
        }
      }
    } else if (projData.forca === 'Polícia Científica') {
      if (projData.tipoUnidade === 'UETC Básica') {
        criteria.tipo_obra_chave = 'centros_treinamento';
        criteria.excluded_risks.push(...[1, 4]); // Menos complexidade
        criteria.debug_logic.push('Mapeamento: UETC Básica → centros_treinamento (baixa complexidade)');
      } else if (projData.tipoUnidade === 'UETC Intermediária') {
        criteria.tipo_obra_chave = 'centrais_operacionais';
        criteria.additional_risks.push(...[2, 14, 63]); // Sistemas especializados
        criteria.debug_logic.push('Mapeamento: UETC Intermediária → centrais (sistemas especializados)');
      } else if (projData.tipoUnidade === 'Posto Avançado') {
        criteria.tipo_obra_chave = 'centros_treinamento';
        criteria.excluded_risks.push(...[1, 4, 9, 23]); // Obra muito pequena
        criteria.debug_logic.push('Mapeamento: Posto Avançado → centros (obra pequena)');
      }
    }

    // 2. MODIFICADORES POR CATEGORIA DE TAMANHO
    switch (tamanhoInfo.categoria) {
      case 'pequeno':
        criteria.excluded_risks.push(...[1, 4, 23, 37, 46]); // Reduz complexidade
        criteria.debug_logic.push('- Riscos de alta complexidade (empreendimento pequeno)');
        break;
      case 'medio':
        criteria.additional_risks.push(...[37]); // Fiscalização adequada
        criteria.debug_logic.push('+ Riscos de fiscalização (empreendimento médio)');
        break;
      case 'grande':
        criteria.additional_risks.push(...[1, 23, 37]); // Mais complexidade
        criteria.debug_logic.push('+ Riscos de complexidade (empreendimento grande)');
        break;
      case 'muito_grande':
        criteria.additional_risks.push(...[1, 4, 9, 23, 37, 46, 78, 79]); // Todos os riscos
        criteria.debug_logic.push('+ Riscos de alta complexidade (grande empreendimento)');
        break;
    }

    // 3. MODIFICADORES ESPECÍFICOS BASEADOS NO INVESTIMENTO (para Delegacias)
    if (tamanhoInfo.investimento) {
      if (tamanhoInfo.investimento > 10000000) { // Acima de 10 milhões
        criteria.additional_risks.push(...[56, 73]); // Riscos financeiros
        criteria.debug_logic.push('+ Riscos financeiros (alto investimento)');
      }
    }

    // 4. MODIFICADORES POR COMPLEXIDADE ESPECIAL
    if (tamanhoInfo.complexidade_seguranca === 'maxima') {
      criteria.additional_risks.push(...[10, 12, 13, 15, 30, 49, 70, 71]);
      criteria.debug_logic.push('+ Riscos de segurança máxima');
    } else if (tamanhoInfo.complexidade_seguranca === 'alta') {
      criteria.additional_risks.push(...[10, 12, 25, 38]);
      criteria.debug_logic.push('+ Riscos de alta segurança');
    }

    if (tamanhoInfo.complexidade_tecnica === 'media') {
      criteria.additional_risks.push(...[2, 14, 18]);
      criteria.debug_logic.push('+ Riscos de sistemas técnicos');
    }

    // 5. MODIFICADORES POR TIPO DE INTERVENÇÃO
    if (projData.tipoIntervencao === 'Construção') {
      criteria.additional_risks.push(...[1, 9, 21, 22]);
      criteria.debug_logic.push('+ Riscos de construção nova (34.3% das obras CEA)');
    } else if (projData.tipoIntervencao === 'Reforma') {
      criteria.additional_risks.push(...[25, 29, 38, 44]);
      criteria.debug_logic.push('+ Riscos de reforma (30% das obras CEA)');
    } else if (projData.tipoIntervencao === 'Reparos') {
      criteria.additional_risks.push(...[11, 28, 32]);
      criteria.excluded_risks.push(...[1, 4, 9]);
      criteria.debug_logic.push('+ Riscos de reparos (30.9% das obras CEA) / - Riscos de planejamento complexo');
    }

    // 6. MODIFICADORES POR REGIME DE EXECUÇÃO
    switch (projData.regimeExecucao) {
      case 'Empreitada por preço global':
        criteria.additional_risks.push(...[3, 5, 8]);
        criteria.debug_logic.push('+ Riscos de preço global (orçamento, qualificação)');
        break;
      case 'Empreitada por preço unitário':
        criteria.additional_risks.push(...[20, 40]);
        criteria.debug_logic.push('+ Riscos de preço unitário (medição, comissionamento)');
        break;
      case 'Contratação integrada':
        criteria.additional_risks.push(...[1, 2, 23, 37]);
        criteria.debug_logic.push('+ Riscos de contratação integrada (projeto, fiscalização especializada)');
        break;
      case 'Contratação semi-integrada':
        criteria.additional_risks.push(...[1, 23, 37]);
        criteria.debug_logic.push('+ Riscos de contratação semi-integrada (projeto básico + executivo)');
        break;
      case 'Empreitada integral':
        criteria.additional_risks.push(...[1, 9, 28, 42]);
        criteria.debug_logic.push('+ Riscos de empreitada integral (gestão ampla, garantias)');
        break;
      case 'Contratação por tarefa':
        criteria.excluded_risks.push(...[1, 4, 9]);
        criteria.debug_logic.push('- Riscos de planejamento complexo (tarefa simples)');
        break;
    }

    // 7. MODIFICADORES POR CARACTERÍSTICAS ESPECIAIS
    projData.caracteristicas.forEach(caracteristica => {
      switch (caracteristica) {
        case 'Obra em unidade em funcionamento':
          criteria.additional_risks.push(...[25, 38]);
          criteria.debug_logic.push('+ Riscos de obra em funcionamento');
          break;
        case 'Necessita licenciamento ambiental':
          criteria.additional_risks.push(...[9, 36]);
          criteria.debug_logic.push('+ Riscos ambientais e de licenciamento');
          break;
        case 'Área de segurança máxima':
          criteria.additional_risks.push(...[10, 12, 13, 15]);
          criteria.debug_logic.push('+ Riscos de alta segurança');
          break;
        case 'Demolição de estruturas':
          criteria.additional_risks.push(...[19, 36]);
          criteria.debug_logic.push('+ Riscos de demolição');
          break;
        case 'Instalações especiais (blindagem, etc.)':
          criteria.additional_risks.push(...[2, 15, 18]);
          criteria.debug_logic.push('+ Riscos de instalações especializadas');
          break;
        case 'Obra em área urbana densamente povoada':
          criteria.additional_risks.push(...[36, 47]);
          criteria.debug_logic.push('+ Riscos de obra em área urbana');
          break;
        case 'Necessita relocação temporária':
          criteria.additional_risks.push(...[25, 38, 47]);
          criteria.debug_logic.push('+ Riscos de relocação temporária');
          break;
      }
    });

    // 8. REMOVER DUPLICATAS
    criteria.additional_risks = [...new Set(criteria.additional_risks)];
    criteria.excluded_risks = [...new Set(criteria.excluded_risks)];

    return criteria;
  };

  const generateRisks = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Obter critérios avançados
      const advancedCriteria = getAdvancedRiskCriteria(projectData);
      setDebugInfo(advancedCriteria);
      
      const payload = {
        ...projectData,
        ...advancedCriteria
      };

      const response = await fetch(`${getApiUrl()}/api/project-risks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro da API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        setError(`Erro do servidor: ${data.error}`);
        setSelectedRisks([]);
      } else if (data.warning) {
        console.warn(`Aviso do servidor: ${data.warning}`);
        setSelectedRisks(data.selected_risks || []);
        setCurrentStep(2);
      } else {
        setSelectedRisks(data.selected_risks || []);
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Erro ao gerar riscos via API:', error);
      setError('Falha ao comunicar com o servidor. Tente novamente.');
      setSelectedRisks([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskColor = (nivel) => {
    if (nivel >= 15) return 'bg-red-100 text-red-800 border-red-300';
    if (nivel >= 8) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (nivel >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getRiskLevelText = (nivelOuClassificacao, nivelNumerico) => {
    if (typeof nivelOuClassificacao === 'string') {
        return `${nivelOuClassificacao} (${nivelNumerico})`;
    }
    if (nivelNumerico >= 15) return `Extremo (${nivelNumerico})`;
    if (nivelNumerico >= 8) return `Alto (${nivelNumerico})`;
    if (nivelNumerico >= 3) return `Moderado (${nivelNumerico})`;
    if (nivelNumerico >= 1) return `Baixo (${nivelNumerico})`;
    return `Desconhecido (${nivelNumerico})`;
  };

  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      
      const response = await fetch(`${getApiUrl()}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectData, 
          selectedRisks, 
          debugInfo 
        }),
      });

      if (!response.ok) {
        // Se não foi ok, tentar ler como JSON para pegar a mensagem de erro
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      // Se foi ok, tratar como PDF (blob)
      const blob = await response.blob();
      
      // Verificar se realmente recebemos um PDF
      if (blob.type !== 'application/pdf') {
        throw new Error('Resposta não é um PDF válido');
      }
      
      // Criar URL para download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Gerar nome do arquivo
      const forcaAbrev = {
        'Corpo de Bombeiros Militar': 'CBMPR',
        'Polícia Militar': 'PMPR',
        'Polícia Civil': 'PCPR',
        'Polícia Penal': 'DEPPEN',
        'Polícia Científica': 'PCP'
      }[projectData.forca] || 'SESP';
      
      const tipoUnidade = projectData.tipoUnidade.replace(/\s+/g, '_').replace(/[(),.]/g, '');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
      const filename = `Matriz_Risco_${forcaAbrev}_${tipoUnidade}_${timestamp}.pdf`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Limpeza
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setCurrentStep(3);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setError(`Erro ao gerar PDF: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const isFormValid = () => {
    return projectData.forca && 
           projectData.tipoUnidade && 
           projectData.tipoIntervencao && 
           projectData.regimeExecucao && 
           projectData.valor;
  };

  // Função para carregar todos os riscos da base de dados
  const loadAllRisks = async () => {
    setIsLoadingAllRisks(true);
    setError(null);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/all-risks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro da API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        setError(`Erro do servidor: ${data.error}`);
      } else {
        setAllRisks(data.riscos_por_fase);
        setAllRisksStats(data.estatisticas);
        setCurrentPage('all-risks');
      }
    } catch (error) {
      console.error('Erro ao carregar todos os riscos:', error);
      setError('Falha ao comunicar com o servidor. Tente novamente.');
    } finally {
      setIsLoadingAllRisks(false);
    }
  };

  // Função para enviar sugestão
  const sendSuggestion = async () => {
    setIsSendingSuggestion(true);
    setError(null);
    
    try {
      const response = await fetch(`${getApiUrl()}/api/suggest-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(suggestionForm),
      });

      if (!response.ok) {
        throw new Error(`Erro da API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        setError(`Erro do servidor: ${data.error}`);
      } else {
        setSuggestionSuccess(data);
        // Limpar formulário
        setSuggestionForm({
          tipo_sugestao: '',
          nome_sugerinte: '',
          email_sugerinte: '',
          risco_id: '',
          descricao_alteracao: '',
          novo_evento: '',
          nova_descricao: '',
          nova_mitigacao: '',
          nova_correcao: '',
          justificativa: ''
        });
        setSelectedRiskForSuggestion(null);
      }
    } catch (error) {
      console.error('Erro ao enviar sugestão:', error);
      setError('Falha ao enviar sugestão. Tente novamente.');
    } finally {
      setIsSendingSuggestion(false);
    }
  };

  // Função para abrir formulário de sugestão para um risco específico
  const openSuggestionForm = (risco = null) => {
    if (risco) {
      setSelectedRiskForSuggestion(risco);
      setSuggestionForm(prev => ({
        ...prev,
        tipo_sugestao: 'alteracao',
        risco_id: risco.id.toString()
      }));
    } else {
      setSelectedRiskForSuggestion(null);
      setSuggestionForm(prev => ({
        ...prev,
        tipo_sugestao: 'novo_risco',
        risco_id: ''
      }));
    }
    setCurrentPage('suggest');
  };

  // Função para voltar à página inicial
  const goToHome = () => {
    setCurrentPage('form');
    setCurrentStep(1);
    setError(null);
    setSuggestionSuccess(null);
  };
  const getUnidadeInfo = () => {
    if (!projectData.tipoUnidade) return null;
    const info = getTamanhoInfo(projectData.tipoUnidade);
    return info;
  };

  // Função para formatar valores monetários
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header com gradiente */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  Matriz de Risco - SESP/PR
                </h1>
                <p className="text-blue-200 text-lg">Centro de Engenharia e Arquitetura</p>
                <p className="text-blue-300 text-sm">Baseado em análise de 557 obras do CEA</p>
              </div>
            </div>
            
            {/* Botões de navegação */}
            <div className="flex items-center space-x-3">
              <button
                onClick={goToHome}
                className={`p-3 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  currentPage === 'form' 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'bg-white bg-opacity-10 text-blue-200 hover:bg-white hover:bg-opacity-20 hover:text-white'
                }`}
                title="Matriz de Risco"
              >
                <Building2 className="w-5 h-5" />
                <span className="hidden md:block text-sm">Matriz</span>
              </button>
              
              <button
                onClick={loadAllRisks}
                disabled={isLoadingAllRisks}
                className={`p-3 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  currentPage === 'all-risks' 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'bg-white bg-opacity-10 text-blue-200 hover:bg-white hover:bg-opacity-20 hover:text-white'
                }`}
                title="Ver todos os riscos"
              >
                {isLoadingAllRisks ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                <span className="hidden md:block text-sm">Todos os Riscos</span>
              </button>
              
              <button
                onClick={() => openSuggestionForm()}
                className={`p-3 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  currentPage === 'suggest' 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'bg-white bg-opacity-10 text-blue-200 hover:bg-white hover:bg-opacity-20 hover:text-white'
                }`}
                title="Sugerir melhorias"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:block text-sm">Sugerir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Display melhorado */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg mr-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Erro encontrado</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 ml-2"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Success Display para sugestões */}
        {suggestionSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-green-800">Sugestão enviada com sucesso!</h3>
                <p className="text-green-700 text-sm">{suggestionSuccess.message}</p>
                <p className="text-green-600 text-xs mt-1">ID: {suggestionSuccess.id_interno}</p>
              </div>
              <button 
                onClick={() => setSuggestionSuccess(null)}
                className="text-green-400 hover:text-green-600 ml-2"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Página: Ver Todos os Riscos */}
        {currentPage === 'all-risks' && allRisks && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Database className="w-6 h-6 mr-3 text-purple-600" />
                    Base de Dados de Riscos
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Total de <span className="font-semibold text-purple-600">{allRisksStats?.total_riscos || 0}</span> riscos cadastrados na base do CEA
                  </p>
                </div>
                <button
                  onClick={() => openSuggestionForm()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sugerir Novo</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Estatísticas */}
              {allRisksStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="text-red-600 text-2xl font-bold">{allRisksStats.por_nivel?.extremo || 0}</div>
                    <div className="text-red-800 text-sm">Extremos</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-orange-600 text-2xl font-bold">{allRisksStats.por_nivel?.alto || 0}</div>
                    <div className="text-orange-800 text-sm">Altos</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="text-yellow-600 text-2xl font-bold">{allRisksStats.por_nivel?.moderado || 0}</div>
                    <div className="text-yellow-800 text-sm">Moderados</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-blue-600 text-2xl font-bold">{allRisksStats.por_nivel?.baixo || 0}</div>
                    <div className="text-blue-800 text-sm">Baixos</div>
                  </div>
                </div>
              )}

              {/* Lista de riscos por fase */}
              <div className="space-y-6">
                {Object.entries(allRisks).map(([fase, riscos]) => (
                  <div key={fase} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b">
                      <h3 className="font-semibold text-gray-900 flex items-center justify-between">
                        <span>{fase}</span>
                        <span className="text-sm bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          {riscos.length} riscos
                        </span>
                      </h3>
                    </div>
                    <div className="divide-y">
                      {riscos.map((risco) => (
                        <div key={risco.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-medium text-gray-500">#{risco.id}</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(risco.nivel_risco)}`}>
                                  {getRiskLevelText(risco.classificacao, risco.nivel_risco)}
                                </span>
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                                  {risco.categoria}
                                </span>
                              </div>
                              <h4 className="font-medium text-gray-900 mb-1">{risco.evento}</h4>
                              <p className="text-sm text-gray-600 leading-relaxed">{risco.descricao}</p>
                            </div>
                            <button 
                              onClick={() => openSuggestionForm(risco)}
                              className="ml-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Sugerir alteração"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Página: Sugerir Melhorias */}
        {currentPage === 'suggest' && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Send className="w-6 h-6 mr-3 text-green-600" />
                    Sugerir Melhorias
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {selectedRiskForSuggestion 
                      ? `Sugerindo alteração para o risco #${selectedRiskForSuggestion.id}`
                      : 'Contribua com a base de dados sugerindo novos riscos ou melhorias'
                    }
                  </p>
                </div>
                <button
                  onClick={goToHome}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <form className="space-y-6" onSubmit={(e) => {
                e.preventDefault();
                if (suggestionForm.nome_sugerinte && suggestionForm.email_sugerinte && suggestionForm.tipo_sugestao) {
                  sendSuggestion();
                }
              }}>
                {/* Tipo de sugestão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Sugestão *</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="tipo_sugestao"
                        value="alteracao"
                        checked={suggestionForm.tipo_sugestao === 'alteracao'}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, tipo_sugestao: e.target.value }))}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Alterar Risco Existente</div>
                        <div className="text-sm text-gray-600">Sugerir melhorias em um risco já cadastrado</div>
                      </div>
                    </label>
                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="tipo_sugestao"
                        value="novo_risco"
                        checked={suggestionForm.tipo_sugestao === 'novo_risco'}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, tipo_sugestao: e.target.value }))}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Novo Risco</div>
                        <div className="text-sm text-gray-600">Propor um risco não cadastrado na base</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Dados pessoais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                    <input
                      type="text"
                      value={suggestionForm.nome_sugerinte}
                      onChange={(e) => setSuggestionForm(prev => ({ ...prev, nome_sugerinte: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={suggestionForm.email_sugerinte}
                      onChange={(e) => setSuggestionForm(prev => ({ ...prev, email_sugerinte: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="seu.email@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Campos específicos para alteração */}
                {suggestionForm.tipo_sugestao === 'alteracao' && (
                  <>
                    {selectedRiskForSuggestion && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-900 mb-2">Risco Selecionado:</h4>
                        <p className="text-sm text-blue-800">#{selectedRiskForSuggestion.id} - {selectedRiskForSuggestion.evento}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {selectedRiskForSuggestion ? 'Descrição da Alteração Sugerida *' : 'ID do Risco *'}
                      </label>
                      {selectedRiskForSuggestion ? (
                        <textarea
                          value={suggestionForm.descricao_alteracao}
                          onChange={(e) => setSuggestionForm(prev => ({ ...prev, descricao_alteracao: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows="4"
                          placeholder="Descreva as alterações que você sugere para este risco..."
                          required
                        />
                      ) : (
                        <input
                          type="number"
                          value={suggestionForm.risco_id}
                          onChange={(e) => setSuggestionForm(prev => ({ ...prev, risco_id: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Digite o ID do risco (ex: 15)"
                          required
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Campos específicos para novo risco */}
                {suggestionForm.tipo_sugestao === 'novo_risco' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Evento do Novo Risco *</label>
                      <input
                        type="text"
                        value={suggestionForm.novo_evento}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, novo_evento: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Ex: Falhas na integração de sistemas de monitoramento"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Descrição do Risco *</label>
                      <textarea
                        value={suggestionForm.nova_descricao}
                        onChange={(e) => setSuggestionForm(prev => ({ ...prev, nova_descricao: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        rows="4"
                        placeholder="Descreva detalhadamente o risco, suas causas e contexto..."
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mitigação Sugerida</label>
                        <textarea
                          value={suggestionForm.nova_mitigacao}
                          onChange={(e) => setSuggestionForm(prev => ({ ...prev, nova_mitigacao: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows="3"
                          placeholder="Como prevenir ou reduzir este risco..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Correção Sugerida</label>
                        <textarea
                          value={suggestionForm.nova_correcao}
                          onChange={(e) => setSuggestionForm(prev => ({ ...prev, nova_correcao: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows="3"
                          placeholder="Como corrigir se o risco ocorrer..."
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Justificativa */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Justificativa</label>
                  <textarea
                    value={suggestionForm.justificativa}
                    onChange={(e) => setSuggestionForm(prev => ({ ...prev, justificativa: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows="3"
                    placeholder="Explique o motivo da sua sugestão, experiências relevantes, referências..."
                  />
                </div>

                {/* Botões */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage('form');
                      setSuggestionForm({
                        tipo_sugestao: '',
                        nome_sugerinte: '',
                        email_sugerinte: '',
                        risco_id: '',
                        descricao_alteracao: '',
                        novo_evento: '',
                        nova_descricao: '',
                        nova_mitigacao: '',
                        nova_correcao: '',
                        justificativa: ''
                      });
                      setSelectedRiskForSuggestion(null);
                    }}
                    className="px-6 py-3 text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!suggestionForm.nome_sugerinte || !suggestionForm.email_sugerinte || !suggestionForm.tipo_sugestao || isSendingSuggestion}
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200"
                  >
                    {isSendingSuggestion ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Sugestão</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Progress Bar melhorado - só mostra no formulário */}
        {currentPage === 'form' && (
          <div className="bg-white border-b shadow-sm mb-8 rounded-xl">
            <div className="px-6 py-6">
              <div className="flex items-center justify-between">
                <div className={`flex items-center space-x-3 transition-all duration-300 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                    currentStep >= 1 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>1</div>
                  <span className="font-medium text-sm md:text-base">Dados do Projeto</span>
                </div>
                
                <ChevronRight className={`w-5 h-5 transition-colors ${currentStep >= 2 ? 'text-blue-400' : 'text-gray-300'}`} />
                
                <div className={`flex items-center space-x-3 transition-all duration-300 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                    currentStep >= 2 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>2</div>
                  <span className="font-medium text-sm md:text-base">Revisão de Riscos</span>
                </div>
                
                <ChevronRight className={`w-5 h-5 transition-colors ${currentStep >= 3 ? 'text-blue-400' : 'text-gray-300'}`} />
                
                <div className={`flex items-center space-x-3 transition-all duration-300 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                    currentStep >= 3 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>3</div>
                  <span className="font-medium text-sm md:text-base">Geração do PDF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Dados do Projeto */}
        {currentPage === 'form' && currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 border-b">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Informações do Projeto</h2>
                  <p className="text-gray-600">Preencha os dados para gerar a matriz de risco personalizada</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Características Técnicas */}
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                      <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                      Identificação da Obra
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Força *</label>
                        <select
                          value={projectData.forca}
                          onChange={(e) => handleInputChange('forca', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                        >
                          <option value="">Selecione a força</option>
                          {forcas.map((forca, index) => (
                            <option key={index} value={forca}>{forca}</option>
                          ))}
                        </select>
                      </div>
                      
                      {projectData.forca && (
                        <div className="animate-fadeIn">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Unidade *</label>
                          <select
                            value={projectData.tipoUnidade}
                            onChange={(e) => handleInputChange('tipoUnidade', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                          >
                            <option value="">Selecione o tipo de unidade</option>
                            {tiposUnidade[projectData.forca]?.map((tipo, index) => (
                              <option key={index} value={tipo}>{tipo}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Informações detalhadas da unidade selecionada */}
                      {projectData.tipoUnidade && getUnidadeInfo() && (
                        <div className="animate-fadeIn bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                            <Info className="w-4 h-4 mr-2" />
                            Especificações da Unidade
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {getUnidadeInfo().area && (
                              <p><span className="font-medium">Área:</span> {getUnidadeInfo().area} m²</p>
                            )}
                            {getUnidadeInfo().pavimentos && (
                              <p><span className="font-medium">Pavimentos:</span> {getUnidadeInfo().pavimentos}</p>
                            )}
                            {getUnidadeInfo().investimento && (
                              <p className="col-span-2"><span className="font-medium">Investimento:</span> {formatCurrency(getUnidadeInfo().investimento)}</p>
                            )}
                            <p className="col-span-2"><span className="font-medium">Porte:</span> {getUnidadeInfo().categoria.replace('_', ' ')}</p>
                            {getUnidadeInfo().lote_minimo && (
                              <p className="col-span-2"><span className="font-medium">Lote mínimo:</span> {getUnidadeInfo().lote_minimo} m²</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Resumo dos padrões de delegacias quando Polícia Civil for selecionada */}
                      {projectData.forca === 'Polícia Civil' && !projectData.tipoUnidade && (
                        <div className="animate-fadeIn bg-green-50 rounded-lg p-4 border border-green-200">
                          <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                            <Building2 className="w-4 h-4 mr-2" />
                            Padrões de Delegacias Cidadãs
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-4 gap-2 font-medium text-green-800 pb-1 border-b border-green-200">
                              <span>Padrão</span>
                              <span>Área</span>
                              <span>Pavimentos</span>
                              <span>Investimento</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-green-700">
                              <span>IA</span>
                              <span>377 m²</span>
                              <span>1</span>
                              <span>R$ 2,8M</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-green-700">
                              <span>I</span>
                              <span>642 m²</span>
                              <span>1</span>
                              <span>R$ 4,7M</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-green-700">
                              <span>II</span>
                              <span>1.207 m²</span>
                              <span>2</span>
                              <span>R$ 8,9M</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-green-700">
                              <span>III</span>
                              <span>1.791 m²</span>
                              <span>3</span>
                              <span>R$ 13,2M</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Informações sobre Polícia Penal */}
                      {projectData.forca === 'Polícia Penal' && !projectData.tipoUnidade && (
                        <div className="animate-fadeIn bg-orange-50 rounded-lg p-4 border border-orange-200">
                          <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Tipos de Estabelecimentos Penais
                          </h4>
                          <div className="space-y-2 text-sm text-orange-800">
                            <div className="border-b border-orange-200 pb-2">
                              <p className="font-medium">Casa de Custódia</p>
                              <p className="text-xs">• Estabelecimento para custodiados provisórios</p>
                              <p className="text-xs">• Nível de segurança: Alto</p>
                              <p className="text-xs">• Porte estimado: Médio (~800 m²)</p>
                            </div>
                            <div>
                              <p className="font-medium">Penitenciária</p>
                              <p className="text-xs">• Estabelecimento para cumprimento de pena</p>
                              <p className="text-xs">• Nível de segurança: Máximo</p>
                              <p className="text-xs">• Porte estimado: Muito Grande (~2.500 m²)</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Informações sobre CBMPR */}
                      {projectData.forca === 'Corpo de Bombeiros Militar' && !projectData.tipoUnidade && (
                        <div className="animate-fadeIn bg-red-50 rounded-lg p-4 border border-red-200">
                          <h4 className="font-semibold text-red-900 mb-3 flex items-center">
                            <Building2 className="w-4 h-4 mr-2" />
                            Unidades do Corpo de Bombeiros Militar
                          </h4>
                          <div className="space-y-2 text-sm text-red-800">
                            <div className="border-b border-red-200 pb-2">
                              <p className="font-medium">Pelotão</p>
                              <p className="text-xs">• Unidade básica operacional</p>
                              <p className="text-xs">• Porte: Pequeno</p>
                            </div>
                            <div className="border-b border-red-200 pb-2">
                              <p className="font-medium">Companhia</p>
                              <p className="text-xs">• Unidade operacional intermediária</p>
                              <p className="text-xs">• Porte: Médio</p>
                            </div>
                            <div className="border-b border-red-200 pb-2">
                              <p className="font-medium">Companhia Independente</p>
                              <p className="text-xs">• Unidade especializada autônoma</p>
                              <p className="text-xs">• Porte: Grande</p>
                            </div>
                            <div className="border-b border-red-200 pb-2">
                              <p className="font-medium">Batalhão</p>
                              <p className="text-xs">• Unidade de grande porte operacional</p>
                              <p className="text-xs">• Porte: Grande</p>
                            </div>
                            <div>
                              <p className="font-medium">Comando Regional</p>
                              <p className="text-xs">• Estrutura administrativa regional</p>
                              <p className="text-xs">• Porte: Pequeno (administrativa)</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Informações sobre PMPR */}
                      {projectData.forca === 'Polícia Militar' && !projectData.tipoUnidade && (
                        <div className="animate-fadeIn bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                          <h4 className="font-semibold text-yellow-900 mb-3 flex items-center">
                            <Building2 className="w-4 h-4 mr-2" />
                            Unidades da Polícia Militar
                          </h4>
                          <div className="space-y-2 text-sm text-yellow-800">
                            <div className="border-b border-yellow-200 pb-2">
                              <p className="font-medium">Pelotão</p>
                              <p className="text-xs">• Unidade básica de policiamento</p>
                              <p className="text-xs">• Porte: Pequeno</p>
                            </div>
                            <div className="border-b border-yellow-200 pb-2">
                              <p className="font-medium">Companhia</p>
                              <p className="text-xs">• Unidade intermediária de policiamento</p>
                              <p className="text-xs">• Porte: Médio</p>
                            </div>
                            <div className="border-b border-yellow-200 pb-2">
                              <p className="font-medium">Companhia Independente</p>
                              <p className="text-xs">• Unidade especializada (ROTAM, BOPE, etc.)</p>
                              <p className="text-xs">• Porte: Grande</p>
                            </div>
                            <div className="border-b border-yellow-200 pb-2">
                              <p className="font-medium">Batalhão</p>
                              <p className="text-xs">• Grande unidade operacional</p>
                              <p className="text-xs">• Porte: Grande</p>
                            </div>
                            <div>
                              <p className="font-medium">Comando Regional</p>
                              <p className="text-xs">• Estrutura administrativa regional</p>
                              <p className="text-xs">• Porte: Pequeno (administrativa)</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {projectData.forca === 'Polícia Científica' && !projectData.tipoUnidade && (
                        <div className="animate-fadeIn bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Tipos de Unidades Técnico-Científicas
                          </h4>
                          <div className="space-y-2 text-sm text-purple-800">
                            <div className="border-b border-purple-200 pb-2">
                              <p className="font-medium">UETC Básica</p>
                              <p className="text-xs">• Unidade básica para perícias essenciais</p>
                              <p className="text-xs">• Complexidade técnica: Baixa</p>
                            </div>
                            <div className="border-b border-purple-200 pb-2">
                              <p className="font-medium">UETC Intermediária</p>
                              <p className="text-xs">• Unidade com laboratórios especializados</p>
                              <p className="text-xs">• Complexidade técnica: Média</p>
                            </div>
                            <div>
                              <p className="font-medium">Posto Avançado</p>
                              <p className="text-xs">• Unidade para atendimento local</p>
                              <p className="text-xs">• Complexidade técnica: Baixa</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {projectData.tipoUnidade && (
                        <div className="animate-fadeIn">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Intervenção *</label>
                          <select
                            value={projectData.tipoIntervencao}
                            onChange={(e) => handleInputChange('tipoIntervencao', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                          >
                            <option value="">Selecione o tipo de intervenção</option>
                            {tiposIntervencao.map((tipo, index) => (
                              <option key={index} value={tipo}>{tipo}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {projectData.tipoIntervencao && (
                        <div className="animate-fadeIn">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Regime de Execução *</label>
                          <select
                            value={projectData.regimeExecucao}
                            onChange={(e) => handleInputChange('regimeExecucao', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                          >
                            <option value="">Selecione o regime de execução</option>
                            {regimesExecucao.map((regime, index) => (
                              <option key={index} value={regime}>{regime}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-green-600" />
                      Características Especiais
                    </h3>
                    <div className="space-y-3">
                      {caracteristicasEspeciais.map((caracteristica, index) => (
                        <label key={index} className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-colors duration-200">
                          <input
                            type="checkbox"
                            checked={projectData.caracteristicas.includes(caracteristica)}
                            onChange={() => handleCaracteristicaToggle(caracteristica)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                          />
                          <span className="text-sm text-gray-700 leading-relaxed">{caracteristica}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Informações do Contrato */}
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                      Informações do Contrato
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Valor Estimado *</label>
                        <select
                          value={projectData.valor}
                          onChange={(e) => handleInputChange('valor', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                        >
                          <option value="">Selecione a faixa de valor</option>
                          <option value="ate-50k">Até R$ 50.000</option>
                          <option value="50k-200k">R$ 50.001 a R$ 200.000</option>
                          <option value="200k-500k">R$ 200.001 a R$ 500.000</option>
                          <option value="500k-1.5m">R$ 500.001 a R$ 1.500.000</option>
                          <option value="1.5m-5m">R$ 1.500.001 a R$ 5.000.000</option>
                          <option value="acima-5m">Acima de R$ 5.000.000</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Resumo do projeto ATUALIZADO */}
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      Resumo do Projeto
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Força:</span> {projectData.forca || 'Não informado'}</p>
                      <p><span className="font-medium">Unidade:</span> {projectData.tipoUnidade || 'Não informado'}</p>
                      <p><span className="font-medium">Intervenção:</span> {projectData.tipoIntervencao || 'Não informado'}</p>
                      <p><span className="font-medium">Regime:</span> {projectData.regimeExecucao || 'Não informado'}</p>
                      <p><span className="font-medium">Valor:</span> {projectData.valor || 'Não informado'}</p>
                      <p><span className="font-medium">Características:</span> {projectData.caracteristicas.length} selecionadas</p>
                      {getUnidadeInfo() && (
                        <p><span className="font-medium">Porte:</span> {getUnidadeInfo().categoria.replace('_', ' ')}</p>
                      )}
                    </div>
                  </div>

                  {/* Info box com dados do CEA */}
                  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      Dados do CEA
                    </h4>
                    <div className="space-y-1 text-xs text-green-800">
                      <p>• 557 obras analisadas do histórico CEA</p>
                      <p>• Padrões de Delegacias Cidadãs (IA, I, II, III)</p>
                      <p>• Polícia Penal: Casa de Custódia e Penitenciária</p>
                      <p>• Polícia Científica: UETC Básica, Intermediária, Posto Avançado</p>
                      <p>• CBMPR e PMPR: Pelotão, Companhia, Batalhão, Comando Regional</p>
                      <p>• Riscos ajustados por porte (pequeno a muito grande)</p>
                      <p className="pt-1 border-t border-green-200">
                        <strong>💡 Dica:</strong> Use "Ver Todos os Riscos" no topo para explorar a base completa
                      </p>
                    </div>
                  </div>

                  {/* Explicação da lógica de seleção ATUALIZADA */}
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                      <Settings className="w-4 h-4 mr-2" />
                      Como Funciona a Seleção de Riscos
                    </h4>
                    <div className="space-y-2 text-xs text-blue-800">
                      <p><strong>1. Base por Tipo de Obra:</strong> Cada combinação força + unidade define riscos específicos</p>
                      <p><strong>2. Ajuste por Porte:</strong> Pequeno reduz complexidade, grande adiciona mais riscos</p>
                      <p><strong>3. Ajuste por Intervenção:</strong> Construção adiciona riscos de planejamento, reparos reduz complexidade</p>
                      <p><strong>4. Regime de Execução:</strong> Contratação integrada adiciona riscos de projeto, tarefa simplifica</p>
                      <p><strong>5. Características Especiais:</strong> Cada item selecionado adiciona riscos específicos</p>
                      <p className="pt-1 border-t border-blue-200"><em>Resultado: Lista personalizada considerando o porte e complexidade do empreendimento</em></p>
                    </div>
                  </div>

                  {/* Seção sobre contribuições */}
                  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Contribua com a Base de Dados
                    </h4>
                    <div className="space-y-2 text-xs text-green-800">
                      <p>Nossa base de riscos é constantemente atualizada com a contribuição de especialistas.</p>
                      <p><strong>Você pode:</strong></p>
                      <p>• Visualizar todos os riscos cadastrados na base de dados</p>
                      <p>• Sugerir alterações em riscos existentes</p>
                      <p>• Propor novos riscos baseados em sua experiência</p>
                      <p>• Melhorar descrições, mitigações e correções</p>
                      <p className="pt-1 border-t border-green-200">
                        <em>Suas sugestões são analisadas pela equipe técnica do CEA em até 15 dias úteis</em>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={generateRisks}
                  disabled={!isFormValid() || isGenerating}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center space-x-3 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Gerando Riscos...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Gerar Matriz de Risco</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Revisão de Riscos */}
        {currentPage === 'form' && currentStep === 2 && (
          <div className="space-y-6">
            {/* Debug Info - Mostrar lógica de seleção ATUALIZADA */}
            {debugInfo && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Lógica de Seleção Aplicada (Baseada nos Dados CEA + Porte)
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Tipo de Obra Base:</span> {debugInfo.tipo_obra_chave || 'Não identificado'}</p>
                  <p><span className="font-medium">Porte do Empreendimento:</span> {debugInfo.tamanho_info?.categoria?.replace('_', ' ') || 'Não definido'}</p>
                  {debugInfo.tamanho_info?.area && (
                    <p><span className="font-medium">Área:</span> {debugInfo.tamanho_info.area} m²</p>
                  )}
                  <p><span className="font-medium">Riscos Adicionais:</span> {debugInfo.additional_risks.length} identificados</p>
                  <p><span className="font-medium">Riscos Excluídos:</span> {debugInfo.excluded_risks.length} removidos</p>
                  <div className="mt-3">
                    <span className="font-medium">Critérios Aplicados:</span>
                    <ul className="mt-1 space-y-1 ml-4">
                      {debugInfo.debug_logic.map((logic, index) => (
                        <li key={index} className="text-xs text-gray-600">• {logic}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Riscos Identificados</h2>
                    <p className="text-gray-600">
                      <span className="font-semibold text-blue-600">{selectedRisks.length}</span> riscos selecionados para: 
                      <span className="font-medium"> {projectData.tipoIntervencao} de {projectData.tipoUnidade} - {projectData.forca}</span>
                    </p>
                    {debugInfo?.tamanho_info && (
                      <p className="text-sm text-gray-500 mt-1">
                        Porte: {debugInfo.tamanho_info.categoria.replace('_', ' ')} 
                        {debugInfo.tamanho_info.area && ` (${debugInfo.tamanho_info.area} m²)`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={generatePDF}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Gerar PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-700">Legenda dos Níveis de Risco:</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full border border-red-200">Extremo (15-25)</span>
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full border border-orange-200">Alto (8-12)</span>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">Moderado (3-6)</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full border border-blue-200">Baixo (1-2)</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedRisks.length > 0 ? selectedRisks.map((risco) => (
                    <div key={risco.id} className={`border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-200 ${getRiskColor(risco.nivel_risco)}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-gray-500 bg-white px-2 py-1 rounded">#{risco.id}</span>
                            <span className={`px-3 py-1 text-sm font-medium rounded-full border-2 ${getRiskColor(risco.nivel_risco)}`}>
                              {getRiskLevelText(risco.classificacao, risco.nivel_risco)}
                            </span>
                            <span className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full">
                              {risco.fase}
                            </span>
                             <span className={`px-3 py-1 text-sm rounded-full ${
                              risco.responsavel === 'Contratante' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                             }`}>
                              {risco.responsavel}
                             </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2 text-lg">{risco.evento}</h3>
                          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                            <span className="font-medium">Descrição:</span> {risco.descricao}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-white bg-opacity-50 rounded-lg">
                              <span className="font-medium text-gray-800 block mb-1">🛡️ Mitigação:</span>
                              <p className="text-gray-700 leading-relaxed">{risco.mitigacao}</p>
                            </div>
                            <div className="p-3 bg-white bg-opacity-50 rounded-lg">
                              <span className="font-medium text-gray-800 block mb-1">🔧 Correção:</span>
                              <p className="text-gray-700 leading-relaxed">{risco.correcao}</p>
                            </div>
                          </div>
                        </div>
                        <button className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0 text-sm border-t border-white border-opacity-50 pt-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600 font-medium">Probabilidade:</span>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-colors ${
                                  i <= risco.probabilidade ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-gray-800 font-semibold">{risco.probabilidade}/5</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600 font-medium">Impacto:</span>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-colors ${
                                  i <= risco.impacto_nivel ? 'bg-red-500' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-gray-800 font-semibold">{risco.impacto_nivel}/5</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">Nenhum risco identificado</h3>
                      <p className="text-gray-600">Nenhum risco foi selecionado para os critérios informados.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={selectedRisks.length === 0 || isGenerating}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Gerar Matriz em PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Geração PDF */}
        {currentPage === 'form' && currentStep === 3 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
            <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">PDF Gerado com Sucesso!</h2>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
              Sua Matriz de Risco foi gerada e baixada com sucesso! O documento contém todos os {selectedRisks.length} riscos 
              identificados para o projeto, baseado na análise de 557 obras do CEA e considerando o porte específico do empreendimento.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-8 py-3 text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
              >
                ← Revisar Riscos
              </button>
              <button
                onClick={() => {
                  setCurrentStep(1);
                  setSelectedRisks([]);
                  setDebugInfo(null);
                  setProjectData({
                    forca: '',
                    tipoUnidade: '',
                    tipoIntervencao: '',
                    regimeExecucao: '',
                    valor: '',
                    caracteristicas: []
                  });
                }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🚀 Novo Projeto
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RiskMatrixApp;
