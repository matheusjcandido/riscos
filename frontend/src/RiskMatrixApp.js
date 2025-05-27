import React, { useState } from 'react';
import { ChevronRight, Download, Edit2, AlertTriangle, CheckCircle, Building2, DollarSign, Settings } from 'lucide-react';

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
    return ''; // Na Vercel, usar URL relativa
  }
  return 'http://localhost:5001'; // Para desenvolvimento local
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
    if (nivel >= 15) return 'bg-red-100 text-red-800 border-red-200';
    if (nivel >= 8) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (nivel >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
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
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Building2 className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Matriz de Risco - SESP/PR</h1>
              <p className="text-blue-200">Centro de Engenharia e Arquitetura</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
              <span className="font-medium">Dados do Projeto</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
              <span className="font-medium">Revisão de Riscos</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>3</div>
              <span className="font-medium">Geração do PDF</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Step 1: Dados do Projeto */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Informações do Projeto</h2>
              <p className="text-gray-600">Preencha os dados para gerar a matriz de risco personalizada</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Características Técnicas */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Building2 className="w-5 h-5 mr-2" />
                    Identificação da Obra
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Força *</label>
                      <select
                        value={projectData.forca}
                        onChange={(e) => handleInputChange('forca', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione a força</option>
                        {forcas.map((forca, index) => (
                          <option key={index} value={forca}>{forca}</option>
                        ))}
                      </select>
                    </div>
                    
                    {projectData.forca && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Unidade *</label>
                        <select
                          value={projectData.tipoUnidade}
                          onChange={(e) => handleInputChange('tipoUnidade', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o tipo de unidade</option>
                          {tiposUnidade[projectData.forca]?.map((tipo, index) => (
                            <option key={index} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {projectData.tipoUnidade && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Intervenção *</label>
                        <select
                          value={projectData.tipoIntervencao}
                          onChange={(e) => handleInputChange('tipoIntervencao', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o tipo de intervenção</option>
                          {tiposIntervencao.map((tipo, index) => (
                            <option key={index} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Complexidade Técnica</label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={projectData.complexidade}
                          onChange={(e) => handleInputChange('complexidade', parseInt(e.target.value))}
                          className="flex-1"
                          style={{ accentColor: '#2563eb' }}
                        />
                        <span className="text-sm font-medium text-gray-700 w-16">
                          {projectData.complexidade}/5
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Simples</span>
                        <span>Complexa</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Características Especiais
                  </h3>
                  <div className="space-y-3">
                    {caracteristicasEspeciais.map((caracteristica, index) => (
                      <label key={index} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={projectData.caracteristicas.includes(caracteristica)}
                          onChange={() => handleCaracteristicaToggle(caracteristica)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{caracteristica}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Informações do Contrato */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Informações do Contrato
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado *</label>
                      <select
                        value={projectData.valor}
                        onChange={(e) => handleInputChange('valor', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de Execução *</label>
                      <select
                        value={projectData.prazo}
                        onChange={(e) => handleInputChange('prazo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={generateRisks}
                disabled={!isFormValid() || isGenerating}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Gerando Riscos...</span>
                  </>
                ) : (
                  <>
                    <span>Gerar Matriz de Risco</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Revisão de Riscos */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Riscos Identificados</h2>
                  <p className="text-gray-600">
                    {selectedRisks.length} riscos selecionados para: {projectData.tipoIntervencao} de {projectData.tipoUnidade} - {projectData.forca}
                  </p>
                </div>
                <button
                  onClick={generatePDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Gerar PDF</span>
                </button>
              </div>

              <div className="mb-4 text-sm text-gray-600">
                <strong>Legenda:</strong> Extremo (15-25) | Alto (8-12) | Moderado (3-6) | Baixo (1-2)
              </div>

              <div className="space-y-4">
                {selectedRisks.length > 0 ? selectedRisks.map((risco) => (
                  <div key={risco.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${getRiskColor(risco.nivel_risco)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-sm font-medium text-gray-500">#{risco.id}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRiskColor(risco.nivel_risco)}`}>
                            {getRiskLevelText(risco.classificacao, risco.nivel_risco)}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                            {risco.fase}
                          </span>
                           <span className={`px-2 py-1 text-xs rounded-full ${
                            risco.responsavel === 'Contratante' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                           }`}>
                            {risco.responsavel}
                           </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-2">{risco.evento}</h3>
                        <p className="text-sm text-gray-600 mb-2"><strong>Descrição:</strong> {risco.descricao}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Mitigação:</span>
                            <p className="text-gray-600 mt-1">{risco.mitigacao}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Correção:</span>
                            <p className="text-gray-600 mt-1">{risco.correcao}</p>
                          </div>
                        </div>
                      </div>
                      <button className="ml-4 p-2 text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500">Probabilidade:</span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${
                                i <= risco.probabilidade ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-700">{risco.probabilidade}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500">Impacto:</span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-full ${
                                i <= risco.impacto_nivel ? 'bg-red-500' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-700">{risco.impacto_nivel}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum risco foi selecionado para os critérios informados.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={generatePDF}
                  disabled={selectedRisks.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Gerar Matriz em PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Geração PDF */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Matriz de Risco Processada!</h2>
            <p className="text-gray-600 mb-6">
              A sua Matriz de Risco foi processada com sucesso. A funcionalidade de download do PDF será implementada em breve.
            </p>
            <div className="space-x-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
              >
                Revisar Riscos
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
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Novo Projeto
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RiskMatrixApp;
