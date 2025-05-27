# api/index.py
import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# Configuração do CORS: Permite que seu frontend React (rodando em outra porta/domínio)
# faça requisições para esta API.
# Para produção, você pode querer restringir as 'origins' permitidas.
CORS(app)

# --- Carregamento da Base de Dados JSON ---
# Determina o caminho absoluto para o diretório onde este script (index.py) está.
# Isso garante que o arquivo JSON seja encontrado corretamente pela Vercel.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
JSON_FILE_PATH = os.path.join(BASE_DIR, 'base_riscos_cea.json')

def carregar_dados_riscos():
    """Carrega os dados do arquivo JSON."""
    try:
        with open(JSON_FILE_PATH, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        # Retorna apenas o objeto principal que contém 'metadata', 'riscos', etc.
        return dados.get("base_riscos_cea", {})
    except FileNotFoundError:
        print(f"ERRO CRÍTICO: Arquivo JSON de riscos não encontrado em {JSON_FILE_PATH}")
        # Em um cenário real, você poderia levantar uma exceção ou ter um fallback.
        return {}
    except json.JSONDecodeError:
        print(f"ERRO CRÍTICO: Falha ao decodificar o arquivo JSON em {JSON_FILE_PATH}")
        return {}
    except Exception as e:
        print(f"ERRO CRÍTICO inesperado ao carregar dados de riscos: {e}")
        return {}

# Carrega os dados uma vez quando a aplicação (ou a instância da serverless function) inicia.
RISK_DATABASE = carregar_dados_riscos()

if not RISK_DATABASE:
    print("AVISO: A base de dados de riscos está vazia. A API pode não funcionar como esperado.")

# --- Endpoints da API ---

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint simples para verificar se a API está respondendo."""
    return jsonify({"status": "ok", "message": "API de Riscos da SESP/PR CEA está operacional!"})

@app.route('/api/risk-metadata', methods=['GET'])
def get_risk_metadata():
    """Retorna os metadados gerais, escalas de probabilidade, impacto e definições de nível de risco."""
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500
    
    metadata_response = {
        "metadata": RISK_DATABASE.get("metadata", {"error": "Metadados não encontrados"}),
        "escala_probabilidade": RISK_DATABASE.get("escala_probabilidade", {"error": "Escala de probabilidade não encontrada"}),
        "escala_impacto": RISK_DATABASE.get("escala_impacto", {"error": "Escala de impacto não encontrada"}),
        "nivel_risco_definicoes": RISK_DATABASE.get("nivel_risco", {"error": "Definições de nível de risco não encontradas"})
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
    return jsonify(riscos)

@app.route('/api/project-risks', methods=['POST'])
def get_project_risks():
    """
    Recebe dados do projeto do frontend, incluindo uma 'tipo_obra_chave',
    e retorna uma lista de riscos filtrados com base nessa chave.
    """
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500

    project_data_from_frontend = request.get_json()
    if not project_data_from_frontend:
        return jsonify({"error": "Nenhum dado do projeto foi recebido no corpo da requisição."}), 400

    # O frontend DEVE enviar uma 'tipo_obra_chave' que corresponda a uma chave em
    # 'tipos_obra' no seu JSON (ex: "presidios", "delegacias", "quarteis", etc.).
    tipo_obra_chave = project_data_from_frontend.get('tipo_obra_chave')

    todos_os_riscos_cadastrados = RISK_DATABASE.get('riscos', [])
    configuracao_tipos_obra = RISK_DATABASE.get('tipos_obra', {})
    
    riscos_selecionados_para_o_projeto = []

    if tipo_obra_chave and tipo_obra_chave in configuracao_tipos_obra:
        ids_dos_riscos_especificos = configuracao_tipos_obra[tipo_obra_chave].get("riscos_especificos", [])
        
        # Filtra a lista 'todos_os_riscos_cadastrados' para incluir apenas aqueles cujos IDs
        # estão presentes em 'ids_dos_riscos_especificos'.
        riscos_selecionados_para_o_projeto = [
            risco for risco in todos_os_riscos_cadastrados if risco.get("id") in ids_dos_riscos_especificos
        ]
    else:
        # Se 'tipo_obra_chave' não for fornecida ou for inválida,
        # a API retorna uma mensagem de aviso e uma lista vazia de riscos.
        # Você pode alterar este comportamento se desejar retornar um conjunto padrão de riscos.
        return jsonify({
            "warning": f"A chave 'tipo_obra_chave' ('{tipo_obra_chave}') não foi fornecida ou é inválida. Nenhum risco específico foi selecionado.",
            "selected_risks": []
        }), 200 # HTTP 200 OK, mas com um aviso. Poderia ser 400 Bad Request se a chave é obrigatória.

    # Futuramente, você pode adicionar mais lógica de filtragem aqui,
    # usando outros campos de 'project_data_from_frontend' como 'complexidade', 'valor', etc.,
    # para refinar ainda mais a lista 'riscos_selecionados_para_o_projeto'.
    # Por exemplo:
    # if project_data_from_frontend.get('complexidade', 0) > 3:
    #     # Adicionar ou modificar riscos para alta complexidade
    #     pass

    # Ordenar os riscos por ID para uma apresentação consistente no frontend.
    riscos_selecionados_para_o_projeto.sort(key=lambda r: r.get('id', float('inf')))
    
    return jsonify({
        "message": f"Riscos selecionados com base no tipo de obra: '{tipo_obra_chave}'.",
        "selected_risks": riscos_selecionados_para_o_projeto,
        "project_data_received": project_data_from_frontend # Para debug
    })


@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf_endpoint():
    """
    Endpoint placeholder para a funcionalidade de geração de PDF.
    A lógica real de geração de PDF (ex: com WeasyPrint, ReportLab) seria implementada aqui.
    """
    dados_para_pdf = request.get_json()
    
    # Apenas para log e simulação:
    print("Dados recebidos para geração de PDF:")
    # print("Dados do Projeto:", dados_para_pdf.get("projectData"))
    # print("Riscos Selecionados:", dados_para_pdf.get("selectedRisks"))
    
    # LÓGICA DE GERAÇÃO DE PDF SERIA AQUI
    # Exemplo conceitual (NÃO FUNCIONAL SEM BIBLIOTECA E TEMPLATE):
    # html_content = f"<h1>Matriz de Risco - {dados_para_pdf.get('projectData', {}).get('tipoUnidade','')}</h1>"
    # for risco in dados_para_pdf.get('selectedRisks', []):
    # html_content += f"<p><b>{risco.get('evento')}</b>: {risco.get('classificacao')}</p>"
    # pdf_file = HTML(string=html_content).write_pdf()
    # return send_file(io.BytesIO(pdf_file), mimetype='application/pdf', as_attachment=True, download_name='matriz_risco.pdf')

    return jsonify({
        "message": "Solicitação de geração de PDF recebida. Funcionalidade ainda não implementada no backend.",
        "status": "placeholder_success"
    }), 200


# Este bloco é útil para desenvolvimento local direto do 'python api/index.py',
# mas a Vercel usará um servidor WSGI como Gunicorn para rodar a aplicação 'app'.
if __name__ == '__main__':
    # Define a porta a partir da variável de ambiente PORT, ou 5001 como padrão.
    # A Vercel define a variável PORT automaticamente.
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
