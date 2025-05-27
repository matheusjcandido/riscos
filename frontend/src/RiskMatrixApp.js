import React, { useState } from 'react';
import { ChevronRight, Download, Edit2, AlertTriangle, CheckCircle, Building2, DollarSign, Settings, Info } from 'lucide-react';

// Constantes de dados
const forcas = [
  'Corpo de Bombeiros (CBMPR)',
  'Polícia Científica',
  'Polícia Civil',
  'Polícia Militar (PMPR)',
  'Polícia Penal'
];

const tiposUnidade = {
  'Corpo de Bombeiros (CBMPR)': ['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional'],
  'Polícia Militar (PMPR)': ['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional'],
  'Polícia Civil': ['Delegacia Cidadã Tipo IA', 'Delegacia Cidadã Tipo II', 'Delegacia Cidadã Tipo III'],
  'Polícia Penal': ['Cadeia Pública', 'Penitenciária Estadual'],
  'Polícia Científica': ['Posto Avançado', 'UETC (Unidade Especializada Técnico-Científica)']
};

const tiposIntervencao = ['Construção', 'Reforma', 'Reparos'];

const caracteristicasEspeciais = [
  'Obra em unidade em funcionamento',
  'Necessita licenciamento ambiental',
  'Área de segurança máxima',
  'Integração com sistemas existentes',
  'Demolição de estruturas',
  'Instalações especiais (blindagem, etc.)'
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
    valor: '',
    prazo: '',
    complexidade: 3,
    caracteristicas: []
  });
  const [selectedRisks, setSelectedRisks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

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

  const getTipoObraChave = (projData) => {
    if (projData.forca === 'Polícia Penal' && (projData.tipoUnidade === 'Cadeia Pública' || projData.tipoUnidade === 'Penitenciária Estadual')) {
      return 'presidios';
    }
    if (projData.forca === 'Polícia Civil' && projData.tipoUnidade?.startsWith('Delegacia')) {
      return 'delegacias';
    }
    if ((projData.forca === 'Corpo de Bombeiros (CBMPR)' || projData.forca === 'Polícia Militar (PMPR)')) {
      if (['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional'].includes(projData.tipoUnidade)) {
          return 'quarteis'; 
      }
    }
    if (projData.forca === 'Polícia Científica' && projData.tipoUnidade === 'UETC (Unidade Especializada Técnico-Científica)') {
      return 'centrais_operacionais';
    }
    
    console.warn("Não foi possível mapear 'tipoUnidade' para 'tipo_obra_chave'. Tipo Unidade:", projData.tipoUnidade);
    return null;
  };

  const generateRisks = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const tipo_obra_chave = getTipoObraChave(projectData);
      
      const payload = {
        ...projectData,
        tipo_obra_chave: tipo_obra_chave
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
        body: JSON.stringify({ projectData, selectedRisks }),
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Complexidade Técnica: <span className="text-blue-600 font-semibold">{projectData.complexidade}/5</span>
                        </label>
                        <div className="px-2">
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={projectData.complexidade}
                            onChange={(e) => handleInputChange('complexidade', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Simples</span>
                            <span>Complexa</span>
                          </div>
                        </div>
                      </div>
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
                          <option value="ate-100k">Até R$ 100.000</option>
                          <option value="100k-500k">R$ 100.001 a R$ 500.000</option>
                          <option value="500k-1m">R$ 500.001 a R$ 1.000.000</option>
                          <option value="1m-5m">R$ 1.000.001 a R$ 5.000.000</option>
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
                          <option value="ate-6m">Até 6 meses</option>
                          <option value="6m-12m">6 a 12 meses</option>
                          <option value="12m-24m">12 a 24 meses</option>
                          <option value="acima-24m">Acima de 24 meses</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Resumo do projeto */}
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3">Resumo do Projeto</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Força:</span> {projectData.forca || 'Não informado'}</p>
                      <p><span className="font-medium">Unidade:</span> {projectData.tipoUnidade || 'Não informado'}</p>
                      <p><span className="font-medium">Intervenção:</span> {projectData.tipoIntervencao || 'Não informado'}</p>
                      <p><span className="font-medium">Características:</span> {projectData.caracteristicas.length} selecionadas</p>
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
              A sua Matriz de Risco foi processada com sucesso. A funcionalidade de download do PDF será implementada em breve.
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
                  setProjectData({
                    forca: '',
                    tipoUnidade: '',
                    tipoIntervencao: '',
                    valor: '',
                    prazo: '',
                    complexidade: 3,
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
