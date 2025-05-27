# api/index.py
import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Carregamento da Base de Dados JSON
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
JSON_FILE_PATH = os.path.join(BASE_DIR, 'base_riscos_cea.json')

def carregar_dados_riscos():
    """Carrega os dados do arquivo JSON."""
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        return dados.get("base_riscos_cea", {})
    except FileNotFoundError:
        print(f"ERRO CRÍTICO: Arquivo JSON de riscos não encontrado em {JSON_FILE_PATH}")
        return {}
    except json.JSONDecodeError:
        print(f"ERRO CRÍTICO: Falha ao decodificar o arquivo JSON em {JSON_FILE_PATH}")
        return {}
    except Exception as e:
        print(f"ERRO CRÍTICO inesperado ao carregar dados de riscos: {e}")
        return {}

RISK_DATABASE = carregar_dados_riscos()

if not RISK_DATABASE:
    print("AVISO: A base de dados de riscos está vazia. A API pode não funcionar como esperado.")

# Função auxiliar para processar critérios avançados
def processar_criterios_avancados(project_data):
    """
    Processa os critérios avançados vindos do frontend e aplica a lógica de seleção.
    """
    todos_os_riscos = RISK_DATABASE.get('riscos', [])
    tipos_obra = RISK_DATABASE.get('tipos_obra', {})
    
    # Extrair critérios do frontend
    tipo_obra_chave = project_data.get('tipo_obra_chave')
    additional_risks = project_data.get('additional_risks', [])
    excluded_risks = project_data.get('excluded_risks', [])
    debug_logic = project_data.get('debug_logic', [])
    
    # Log para debug
    print(f"Processando critérios: tipo_obra={tipo_obra_chave}, +{len(additional_risks)}, -{len(excluded_risks)}")
    
    # 1. Começar com riscos base do tipo de obra
    riscos_selecionados_ids = set()
    
    if tipo_obra_chave and tipo_obra_chave in tipos_obra:
        riscos_base = tipos_obra[tipo_obra_chave].get("riscos_especificos", [])
        riscos_selecionados_ids.update(riscos_base)
        print(f"Riscos base para {tipo_obra_chave}: {len(riscos_base)}")
    
    # 2. Adicionar riscos adicionais
    riscos_selecionados_ids.update(additional_risks)
    print(f"Após adicionar riscos extras: {len(riscos_selecionados_ids)}")
    
    # 3. Remover riscos excluídos
    riscos_selecionados_ids.difference_update(excluded_risks)
    print(f"Após remover riscos excluídos: {len(riscos_selecionados_ids)}")
    
    # 4. Filtrar a lista de riscos pelos IDs selecionados
    riscos_finais = [
        risco for risco in todos_os_riscos 
        if risco.get("id") in riscos_selecionados_ids
    ]
    
    # 5. Ordenar por nível de risco (mais críticos primeiro)
    riscos_finais.sort(key=lambda r: r.get('nivel_risco', 0), reverse=True)
    
    # 6. Preparar resposta com metadados
    response_data = {
        "selected_risks": riscos_finais,
        "selection_metadata": {
            "tipo_obra_base": tipo_obra_chave,
            "total_risks_selected": len(riscos_finais),
            "additional_risks_count": len(additional_risks),
            "excluded_risks_count": len(excluded_risks),
            "debug_logic": debug_logic,
            "risk_distribution": {
                "extremo": len([r for r in riscos_finais if r.get('nivel_risco', 0) >= 15]),
                "alto": len([r for r in riscos_finais if 8 <= r.get('nivel_risco', 0) < 15]),
                "moderado": len([r for r in riscos_finais if 3 <= r.get('nivel_risco', 0) < 8]),
                "baixo": len([r for r in riscos_finais if r.get('nivel_risco', 0) < 3])
            }
        }
    }
    
    return response_data

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint simples para verificar se a API está respondendo."""
    return jsonify({
        "status": "ok", 
        "message": "API de Riscos da SESP/PR CEA está operacional!",
        "version": "2.0",
        "features": ["advanced_risk_selection", "debug_info", "regime_execucao"]
    })

@app.route('/api/risk-metadata', methods=['GET'])
def get_risk_metadata():
    """Retorna os metadados gerais, escalas de probabilidade, impacto e definições de nível de risco."""
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500
    
    metadata_response = {
        "metadata": RISK_DATABASE.get("metadata", {"error": "Metadados não encontrados"}),
        "escala_probabilidade": RISK_DATABASE.get("escala_probabilidade", {"error": "Escala de probabilidade não encontrada"}),
        "escala_impacto": RISK_DATABASE.get("escala_impacto", {"error": "Escala de impacto não encontrada"}),
        "nivel_risco_definicoes": RISK_DATABASE.get("nivel_risco", {"error": "Definições de nível de risco não encontradas"}),
        "tipos_obra_disponiveis": list(RISK_DATABASE.get("tipos_obra", {}).keys()),
        "total_riscos_base": len(RISK_DATABASE.get("riscos", []))
    }
    return jsonify(metadata_response)

@app.route('/api/risks', methods=['GET'])
def get_all_risks():
    """Retorna a lista completa de todos os riscos cadastrados."""
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500
    
    riscos = RISK_DATABASE.get('riscos', [])
    if not riscos:
         return jsonify({"warning": "Nenhum risco encontrado na base de dados.", "risks": []}), 200
    
    # Adicionar estatísticas dos riscos
    response = {
        "risks": riscos,
        "statistics": {
            "total": len(riscos),
            "by_level": {
                "extremo": len([r for r in riscos if r.get('nivel_risco', 0) >= 15]),
                "alto": len([r for r in riscos if 8 <= r.get('nivel_risco', 0) < 15]),
                "moderado": len([r for r in riscos if 3 <= r.get('nivel_risco', 0) < 8]),
                "baixo": len([r for r in riscos if r.get('nivel_risco', 0) < 3])
            },
            "by_phase": {},
            "by_responsible": {}
        }
    }
    
    # Calcular estatísticas por fase e responsável
    for risco in riscos:
        fase = risco.get('fase', 'Não informado')
        responsavel = risco.get('responsavel', 'Não informado')
        
        response["statistics"]["by_phase"][fase] = response["statistics"]["by_phase"].get(fase, 0) + 1
        response["statistics"]["by_responsible"][responsavel] = response["statistics"]["by_responsible"].get(responsavel, 0) + 1
    
    return jsonify(response)

@app.route('/api/project-risks', methods=['POST'])
def get_project_risks():
    """
    Endpoint melhorado que recebe critérios avançados do frontend
    e aplica lógica sofisticada de seleção de riscos.
    """
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500

    project_data = request.get_json()
    if not project_data:
        return jsonify({"error": "Nenhum dado do projeto foi recebido no corpo da requisição."}), 400

    try:
        # Processar critérios avançados
        result = processar_criterios_avancados(project_data)
        
        # Verificar se algum risco foi selecionado
        if not result["selected_risks"]:
            return jsonify({
                "warning": "Nenhum risco foi identificado para os critérios informados.",
                "selected_risks": [],
                "selection_metadata": result["selection_metadata"],
                "suggestions": [
                    "Verifique se o tipo de obra está corretamente mapeado",
                    "Considere ajustar as características especiais",
                    "Revise o tipo de intervenção selecionado"
                ]
            }), 200
        
        # Resposta de sucesso
        return jsonify({
            "message": f"Riscos selecionados com sucesso usando critérios avançados.",
            "selected_risks": result["selected_risks"],
            "selection_metadata": result["selection_metadata"],
            "project_data_received": {
                "forca": project_data.get("forca"),
                "tipoUnidade": project_data.get("tipoUnidade"),
                "tipoIntervencao": project_data.get("tipoIntervencao"),
                "regimeExecucao": project_data.get("regimeExecucao"),
                "valor": project_data.get("valor"),
                "prazo": project_data.get("prazo"),
                "caracteristicas_count": len(project_data.get("caracteristicas", []))
            }
        })
    
    except Exception as e:
        print(f"Erro ao processar critérios de risco: {e}")
        return jsonify({
            "error": "Erro interno ao processar critérios de seleção de riscos.",
            "details": str(e)
        }), 500

@app.route('/api/risk-analysis', methods=['POST'])
def analyze_risk_selection():
    """
    Novo endpoint para análise detalhada da seleção de riscos.
    Útil para debugging e otimização da lógica.
    """
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500

    project_data = request.get_json()
    if not project_data:
        return jsonify({"error": "Nenhum dado do projeto foi recebido."}), 400

    try:
        # Processar e retornar análise detalhada
        result = processar_criterios_avancados(project_data)
        
        # Análise adicional
        all_risks = RISK_DATABASE.get('riscos', [])
        analysis = {
            "selection_summary": result["selection_metadata"],
            "detailed_analysis": {
                "total_risks_in_database": len(all_risks),
                "selection_percentage": (len(result["selected_risks"]) / len(all_risks) * 100) if all_risks else 0,
                "risk_coverage": {
                    "planning": len([r for r in result["selected_risks"] if "Planejamento" in r.get("fase", "")]),
                    "selection": len([r for r in result["selected_risks"] if "Seleção" in r.get("fase", "")]),
                    "execution": len([r for r in result["selected_risks"] if "Execução" in r.get("fase", "")])
                },
                "responsibility_split": {
                    "contratante": len([r for r in result["selected_risks"] if r.get("responsavel") == "Contratante"]),
                    "contratada": len([r for r in result["selected_risks"] if r.get("responsavel") == "Contratada"])
                }
            },
            "recommendations": []
        }
        
        # Gerar recomendações baseadas na análise
        if analysis["detailed_analysis"]["selection_percentage"] < 10:
            analysis["recommendations"].append("Seleção muito restritiva - considere ampliar critérios")
        elif analysis["detailed_analysis"]["selection_percentage"] > 80:
            analysis["recommendations"].append("Seleção muito ampla - considere refinar critérios")
        
        if analysis["detailed_analysis"]["responsibility_split"]["contratante"] == 0:
            analysis["recommendations"].append("Nenhum risco identificado para o contratante - revisar critérios")
        
        return jsonify(analysis)
    
    except Exception as e:
        return jsonify({"error": f"Erro na análise: {str(e)}"}), 500

@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf_endpoint():
    """
    Endpoint melhorado para geração de PDF com informações de debug.
    """
    dados_para_pdf = request.get_json()
    
    # Log melhorado
    print("=== GERAÇÃO DE PDF ===")
    print("Dados do Projeto:", dados_para_pdf.get("projectData", {}).keys())
    print("Riscos Selecionados:", len(dados_para_pdf.get("selectedRisks", [])))
    print("Debug Info:", bool(dados_para_pdf.get("debugInfo")))
    
    # Aqui seria implementada a lógica real de geração de PDF
    # Por enquanto, retornamos uma resposta de sucesso
    
    return jsonify({
        "message": "Solicitação de geração de PDF recebida com sucesso.",
        "status": "processed",
        "data_summary": {
            "project_fields": len(dados_para_pdf.get("projectData", {})),
            "selected_risks": len(dados_para_pdf.get("selectedRisks", [])),
            "has_debug_info": bool(dados_para_pdf.get("debugInfo"))
        },
        "next_steps": [
            "Implementar biblioteca de geração de PDF (WeasyPrint/ReportLab)",
            "Criar template HTML para o relatório",
            "Configurar sistema de download de arquivos"
        ]
    }), 200

# Endpoint adicional para estatísticas
@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Retorna estatísticas gerais da base de riscos."""
    if not RISK_DATABASE:
        return jsonify({"error": "Base de dados não disponível."}), 500
    
    riscos = RISK_DATABASE.get('riscos', [])
    tipos_obra = RISK_DATABASE.get('tipos_obra', {})
    
    stats = {
        "database_info": RISK_DATABASE.get('metadata', {}),
        "total_risks": len(riscos),
        "risk_types": len(tipos_obra),
        "risk_distribution": {
            "by_level": {},
            "by_phase": {},
            "by_responsible": {},
            "by_category": {}
        },
        "obra_types": {
            name: {
                "description": info.get("descricao", ""),
                "specific_risks": len(info.get("riscos_especificos", []))
            }
            for name, info in tipos_obra.items()
        }
    }
    
    # Calcular distribuições
    for risco in riscos:
        nivel = risco.get('nivel_risco', 0)
        if nivel >= 15:
            level = "extremo"
        elif nivel >= 8:
            level = "alto"
        elif nivel >= 3:
            level = "moderado"
        else:
            level = "baixo"
        
        stats["risk_distribution"]["by_level"][level] = stats["risk_distribution"]["by_level"].get(level, 0) + 1
        
        fase = risco.get('fase', 'Não informado')
        stats["risk_distribution"]["by_phase"][fase] = stats["risk_distribution"]["by_phase"].get(fase, 0) + 1
        
        responsavel = risco.get('responsavel', 'Não informado')
        stats["risk_distribution"]["by_responsible"][responsavel] = stats["risk_distribution"]["by_responsible"].get(responsavel, 0) + 1
        
        categoria = risco.get('categoria', 'Não informado')
        stats["risk_distribution"]["by_category"][categoria] = stats["risk_distribution"]["by_category"].get(categoria, 0) + 1
    
    return jsonify(stats)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
