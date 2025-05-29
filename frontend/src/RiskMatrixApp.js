import React, { useState } from 'react';
import { ChevronRight, Download, Edit2, AlertTriangle, CheckCircle, Building2, DollarSign, Settings, Info, FileText } from 'lucide-react';

// Constantes baseadas na análise dos dados do CEA
const forcas = [
  'Corpo de Bombeiros Militar',
  'Polícia Civil', 
  'Polícia Militar',
  'Polícia Penal',
  'Polícia Científica'
];

// Tipos de unidades baseados nos dados reais das obras do CEA
const tiposUnidade = {
  'Corpo de Bombeiros Militar': [
    'Pelotão',
    'Companhia', 
    'Companhia Independente',
    'Batalhão',
    'Comando Regional',
    'Posto de Bombeiros Comunitário'
  ],
  'Polícia Militar': [
    'Pelotão',
    'Companhia',
    'Companhia Independente', 
    'Batalhão',
    'Comando Regional'
  ],
  'Polícia Civil': [
    'Delegacia Cidadã Tipo I',
    'Delegacia Cidadã Tipo II',
    'Delegacia Cidadã Tipo III',
    'Delegacia Especializada',
    'Núcleo Regional'
  ],
  'Polícia Penal': [
    'Cadeia Pública',
    'Penitenciária Estadual',
    'Centro Socioeducativo'
  ],
  'Polícia Científica': [
    'Posto Regional',
    'UETC (Unidade Especializada Técnico-Científica)'
  ]
};

// Tipos de intervenção baseados nos dados do CEA
const tiposIntervencao = ['Construção', 'Reforma', 'Reparos'];

// Regimes de execução incluindo contratação semi-integrada
const regimesExecucao = [
  'Empreitada por preço global',
  'Empreitada por preço unitário',
  'Contratação por tarefa',
  'Contratação integrada',
  'Contratação semi-integrada', // NOVO
  'Empreitada integral'
];

// Características especiais expandidas baseadas na análise
const caracteristicasEspeciais = [
  'Obra em unidade em funcionamento',
  'Necessita licenciamento ambiental',
  'Área de segurança máxima',
  'Integração com sistemas existentes',
  'Demolição de estruturas',
  'Instalações especiais (blindagem, etc.)',
  'Obra em área urbana densamente povoada', // NOVO
  'Necessita relocação temporária' // NOVO
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
  const [projectData, setProjectData] = useState({
    forca: '',
    tipoUnidade: '',
    tipoIntervencao: '',
    regimeExecucao: '',
    valor: '',
    prazo: '',
    caracteristicas: []
  });
  const [selectedRisks, setSelectedRisks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

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

  // Lógica APRIMORADA de seleção de riscos baseada nos dados do CEA
  const getAdvancedRiskCriteria = (projData) => {
    const criteria = {
      tipo_obra_chave: null,
      risk_multipliers: {},
      additional_risks: [],
      excluded_risks: [],
      debug_logic: []
    };

    // 1. MAPEAMENTO PRINCIPAL - Baseado nos dados reais do CEA
    if (projData.forca === 'Polícia Penal') {
      if (['Cadeia Pública', 'Penitenciária Estadual', 'Centro Socioeducativo'].includes(projData.tipoUnidade)) {
        criteria.tipo_obra_chave = 'presidios';
        criteria.debug_logic.push('Mapeamento: Polícia Penal → presidios');
      }
    } else if (projData.forca === 'Polícia Civil') {
      if (projData.tipoUnidade?.includes('Delegacia') || projData.tipoUnidade?.includes('Núcleo Regional')) {
        criteria.tipo_obra_chave = 'delegacias';
        criteria.debug_logic.push('Mapeamento: Polícia Civil → delegacias');
      }
    } else if (projData.forca === 'Corpo de Bombeiros Militar' || projData.forca === 'Polícia Militar') {
      if (['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional'].includes(projData.tipoUnidade)) {
        criteria.tipo_obra_chave = 'quarteis';
        criteria.debug_logic.push(`Mapeamento: ${projData.forca} → quarteis`);
      } else if (projData.tipoUnidade === 'Posto de Bombeiros Comunitário') {
        criteria.tipo_obra_chave = 'centros_treinamento'; // Obras menores
        criteria.debug_logic.push('Mapeamento: PBC → centros_treinamento');
      }
    } else if (projData.forca === 'Polícia Científica') {
      if (projData.tipoUnidade === 'UETC (Unidade Especializada Técnico-Científica)') {
        criteria.tipo_obra_chave = 'centrais_operacionais';
        criteria.debug_logic.push('Mapeamento: Polícia Científica UETC → centrais_operacionais');
      } else if (projData.tipoUnidade === 'Posto Regional') {
        criteria.tipo_obra_chave = 'centros_treinamento';
        criteria.debug_logic.push('Mapeamento: Posto Regional → centros_treinamento');
      }
    }

    // 2. MODIFICADORES POR TIPO DE INTERVENÇÃO - Baseado na análise CEA
    if (projData.tipoIntervencao === 'Construção') {
      criteria.additional_risks.push(...[1, 9, 21, 22]); // Riscos específicos de construção nova
      criteria.debug_logic.push('+ Riscos de construção nova (34.3% das obras CEA)');
    } else if (projData.tipoIntervencao === 'Reforma') {
      criteria.additional_risks.push(...[25, 29, 38, 44]); // Riscos de integração e operação
      criteria.debug_logic.push('+ Riscos de reforma (30% das obras CEA)');
    } else if (projData.tipoIntervencao === 'Reparos') {
      criteria.additional_risks.push(...[11, 28, 32]); // Riscos menores, mais técnicos
      criteria.excluded_risks.push(...[1, 4, 9]); // Exclui riscos de planejamento complexo
      criteria.debug_logic.push('+ Riscos de reparos (30.9% das obras CEA) / - Riscos de planejamento complexo');
    }

    // 3. MODIFICADORES POR REGIME DE EXECUÇÃO - Incluindo semi-integrada
    switch (projData.regimeExecucao) {
      case 'Empreitada por preço global':
        criteria.additional_risks.push(...[3, 5, 8]); // Riscos de orçamento e qualificação
        criteria.debug_logic.push('+ Riscos de preço global (orçamento, qualificação)');
        break;
      case 'Empreitada por preço unitário':
        criteria.additional_risks.push(...[20, 40]); // Riscos de medição e comissionamento
        criteria.debug_logic.push('+ Riscos de preço unitário (medição, comissionamento)');
        break;
      case 'Contratação integrada':
        criteria.additional_risks.push(...[1, 2, 23, 37]); // Riscos de projeto e fiscalização
        criteria.debug_logic.push('+ Riscos de contratação integrada (projeto, fiscalização especializada)');
        break;
      case 'Contratação semi-integrada':
        criteria.additional_risks.push(...[1, 23, 37]); // Riscos de projeto parcial
        criteria.debug_logic.push('+ Riscos de contratação semi-integrada (projeto básico + executivo)');
        break;
      case 'Empreitada integral':
        criteria.additional_risks.push(...[1, 9, 28, 42]); // Riscos amplos de gestão
        criteria.debug_logic.push('+ Riscos de empreitada integral (gestão ampla, garantias)');
        break;
      case 'Contratação por tarefa':
        criteria.excluded_risks.push(...[1, 4, 9]); // Exclui riscos de planejamento complexo
        criteria.debug_logic.push('- Riscos de planejamento complexo (tarefa simples)');
        break;
      default:
        criteria.debug_logic.push('Regime de execução não reconhecido ou não informado');
        break;
    }

    // 4. MODIFICADORES POR FAIXA DE VALOR - Baseado no padrão CEA
    switch (projData.valor) {
      case 'ate-50k':
        criteria.excluded_risks.push(...[1, 4, 23, 37]); // Obra pequena, menos complexidade
        criteria.debug_logic.push('- Riscos de alta complexidade (obra pequena)');
        break;
      case '200k-500k':
        criteria.additional_risks.push(...[23]); // Análise técnica mais rigorosa
        criteria.debug_logic.push('+ Risco de análise técnica (obra média)');
        break;
      case '1.5m-5m':
        criteria.additional_risks.push(...[1, 4, 23, 37]); // Obra grande, mais riscos
        criteria.debug_logic.push('+ Riscos de alta complexidade (obra grande)');
        break;
      case 'acima-5m':
        criteria.additional_risks.push(...[1, 4, 9, 23, 37, 46]); // Obra muito grande, todos os riscos
        criteria.debug_logic.push('+ Riscos de alta complexidade (grande empreendimento)');
        break;
      default:
        criteria.debug_logic.push('Faixa de valor intermediária - sem modificadores específicos');
        break;
    }

    // 5. MODIFICADORES POR PRAZO - Ajustado para o padrão CEA
    switch (projData.prazo) {
      case 'ate-3m':
        criteria.additional_risks.push(...[10, 12, 19]); // Riscos de cronograma muito apertado
        criteria.debug_logic.push('+ Riscos de prazo muito apertado');
        break;
      case '3m-6m':
        criteria.additional_risks.push(...[10, 19]); // Riscos de cronograma apertado
        criteria.debug_logic.push('+ Riscos de prazo apertado');
        break;
      case 'acima-24m':
        criteria.additional_risks.push(...[11, 35, 48]); // Riscos de longo prazo
        criteria.debug_logic.push('+ Riscos de longo prazo (obsolescência, atualizações)');
        break;
      default:
        criteria.debug_logic.push('Prazo intermediário - sem modificadores específicos');
        break;
    }

    // 6. MODIFICADORES POR CARACTERÍSTICAS ESPECIAIS - Expandido
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
        case 'Integração com sistemas existentes':
          criteria.additional_risks.push(...[14, 29, 34, 44]);
          criteria.debug_logic.push('+ Riscos de integração sistêmica');
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
        default:
          criteria.debug_logic.push(`Característica não reconhecida: ${caracteristica}`);
          break;
      }
    });

    // 7. REMOVER DUPLICATAS
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
      const response = await fetch(`${getApiUrl()}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData, selectedRisks, debugInfo }),
      });

      if (response.ok) {
        alert('Solicitação de PDF enviada com sucesso!');
      } else {
        throw new Error('Falha ao gerar PDF no backend.');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Funcionalidade de PDF ainda não implementada completamente.');
    }
    setCurrentStep(3);
  };

  const isFormValid = () => {
    return projectData.forca && 
           projectData.tipoUnidade && 
           projectData.tipoIntervencao && 
           projectData.regimeExecucao && 
           projectData.valor && 
           projectData.prazo;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header com gradiente */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
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
        </div>
      </header>

      {/* Progress Bar melhorado */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Display melhorado */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg mr-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-red-800">Erro encontrado</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Dados do Projeto */}
        {currentStep === 1 && (
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Prazo de Execução *</label>
                        <select
                          value={projectData.prazo}
                          onChange={(e) => handleInputChange('prazo', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                        >
                          <option value="">Selecione o prazo</option>
                          <option value="ate-3m">Até 3 meses</option>
                          <option value="3m-6m">3 a 6 meses</option>
                          <option value="6m-12m">6 a 12 meses</option>
                          <option value="12m-24m">12 a 24 meses</option>
                          <option value="acima-24m">Acima de 24 meses</option>
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
                      <p><span className="font-medium">Prazo:</span> {projectData.prazo || 'Não informado'}</p>
                      <p><span className="font-medium">Características:</span> {projectData.caracteristicas.length} selecionadas</p>
                    </div>
                  </div>

                  {/* Info box com dados do CEA */}
                  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                      <Info className="w-4 h-4 mr-2" />
                      Dados do CEA
                    </h4>
                    <div className="space-y-1 text-xs text-green-800">
                      <p>• 557 obras analisadas</p>
                      <p>• 34.3% construções, 30.9% reparos, 30% reformas</p>
                      <p>• Baseado no histórico real de obras do SESP/PR</p>
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
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Debug Info - Mostrar lógica de seleção */}
            {debugInfo && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Lógica de Seleção Aplicada (Baseada nos Dados CEA)
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Tipo de Obra Base:</span> {debugInfo.tipo_obra_chave || 'Não identificado'}</p>
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
                  </div>
                  <button
                    onClick={generatePDF}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-4 h-4" />
                    <span>Gerar PDF</span>
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
                    disabled={selectedRisks.length === 0}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Download className="w-4 h-4" />
                    <span>Gerar Matriz em PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Geração PDF */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
            <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Matriz de Risco Processada!</h2>
            <p className="text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
              A sua Matriz de Risco foi processada com sucesso baseada na análise de 557 obras do CEA. 
              A funcionalidade de download do PDF será implementada em breve.
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
                    prazo: '',
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
