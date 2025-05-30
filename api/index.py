# api/index.py - Backend melhorado com padrões das Delegacias Cidadãs e geração de PDF
import os
import json
from datetime import datetime
from io import BytesIO
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Importações para geração de PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import mm, inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas

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

# Mapeamento de forças baseado na análise do CEA
FORCE_MAPPING = {
    'Corpo de Bombeiros Militar': 'CBMPR',
    'Polícia Militar': 'PMPR', 
    'Polícia Civil': 'PCPR',
    'Polícia Penal': 'DEPPEN',
    'Polícia Científica': 'PCP'
}

# Mapeamento de tamanhos baseado no PDF das Delegacias Cidadãs e especificações
TAMANHOS_POR_UNIDADE = {
    # Polícia Civil - baseado no PDF das Delegacias Cidadãs
    'Delegacia Cidadã Padrão IA (376,73 m²)': {
        'area': 376.73,
        'investimento': 2768965.50,
        'pavimentos': 1,
        'categoria': 'pequeno',
        'lote_minimo': 1400,
        'complexidade': 'baixa'
    },
    'Delegacia Cidadã Padrão I (642,29 m²)': {
        'area': 642.29,
        'investimento': 4720831.50,
        'pavimentos': 1,
        'categoria': 'medio',
        'lote_minimo': 1500,
        'complexidade': 'media'
    },
    'Delegacia Cidadã Padrão II (1.207,48 m²)': {
        'area': 1207.48,
        'investimento': 8874978.00,
        'pavimentos': 2,
        'categoria': 'grande',
        'lote_minimo': 1500,
        'complexidade': 'alta'
    },
    'Delegacia Cidadã Padrão III (1.791,23 m²)': {
        'area': 1791.23,
        'investimento': 13165540.50,
        'pavimentos': 3,
        'categoria': 'muito_grande',
        'lote_minimo': 1500,
        'complexidade': 'muito_alta'
    },
    
    # Polícia Penal - estimativas baseadas em complexidade
    'Casa de Custódia': {
        'area': 800,
        'categoria': 'medio',
        'complexidade_seguranca': 'alta',
        'complexidade': 'alta'
    },
    'Penitenciária': {
        'area': 2500,
        'categoria': 'muito_grande',
        'complexidade_seguranca': 'maxima',
        'complexidade': 'muito_alta'
    },
    
    # Polícia Científica - sem informações de tamanho específicas
    'UETC Básica': {
        'categoria': 'pequeno',
        'complexidade_tecnica': 'baixa',
        'complexidade': 'media'
    },
    'UETC Intermediária': {
        'categoria': 'medio',
        'complexidade_tecnica': 'media',
        'complexidade': 'alta'
    },
    'Posto Avançado': {
        'categoria': 'pequeno',
        'complexidade_tecnica': 'baixa',
        'complexidade': 'baixa'
    },
    
    # CBMPR e PMPR
    'Pelotão': {'area': 400, 'categoria': 'pequeno', 'complexidade': 'baixa'},
    'Companhia': {'area': 800, 'categoria': 'medio', 'complexidade': 'media'},
    'Companhia Independente': {'area': 1000, 'categoria': 'grande', 'complexidade': 'alta'},
    'Batalhão': {'area': 1500, 'categoria': 'grande', 'complexidade': 'alta'},
    'Comando Regional': {'area': 300, 'categoria': 'pequeno', 'complexidade': 'baixa'}  # Corrigido: pequeno (estrutura administrativa)
}

def obter_tamanho_info(tipo_unidade):
    """Obtém informações de tamanho e complexidade da unidade."""
    return TAMANHOS_POR_UNIDADE.get(tipo_unidade, {'categoria': 'medio', 'area': 0, 'complexidade': 'media'})

def obter_cor_risco(nivel_risco):
    """Retorna a cor correspondente ao nível de risco."""
    if nivel_risco >= 15:
        return HexColor('#fef2f2'), HexColor('#dc2626')  # bg-red-50, text-red-600
    elif nivel_risco >= 8:
        return HexColor('#fff7ed'), HexColor('#ea580c')  # bg-orange-50, text-orange-600
    elif nivel_risco >= 3:
        return HexColor('#fefce8'), HexColor('#ca8a04')  # bg-yellow-50, text-yellow-600
    else:
        return HexColor('#eff6ff'), HexColor('#2563eb')  # bg-blue-50, text-blue-600

def obter_texto_nivel_risco(nivel_risco, classificacao=None):
    """Retorna o texto do nível de risco."""
    if classificacao:
        return f"{classificacao} ({nivel_risco})"
    if nivel_risco >= 15:
        return f"Extremo ({nivel_risco})"
    elif nivel_risco >= 8:
        return f"Alto ({nivel_risco})"
    elif nivel_risco >= 3:
        return f"Moderado ({nivel_risco})"
    else:
        return f"Baixo ({nivel_risco})"

def gerar_pdf_riscos(dados_projeto, riscos_selecionados, metadados_selecao):
    """Gera o PDF com a matriz de riscos."""
    
    # Criar buffer para o PDF
    buffer = BytesIO()
    
    # Configurar o documento
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, 
                           topMargin=25*mm, bottomMargin=25*mm)
    
    # Estilos
    styles = getSampleStyleSheet()
    
    # Estilos personalizados
    titulo_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=12,
        textColor=HexColor('#1e3a8a'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitulo_style = ParagraphStyle(
        'CustomSubtitle', 
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=10,
        textColor=HexColor('#374151'),
        alignment=TA_CENTER
    )
    
    info_style = ParagraphStyle(
        'InfoStyle',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        textColor=HexColor('#6b7280'),
        alignment=TA_CENTER
    )
    
    risco_titulo_style = ParagraphStyle(
        'RiscoTitulo',
        parent=styles['Heading3'],
        fontSize=12,
        spaceAfter=6,
        textColor=black,
        fontName='Helvetica-Bold'
    )
    
    risco_texto_style = ParagraphStyle(
        'RiscoTexto',
        parent=styles['Normal'],
        fontSize=9,
        spaceAfter=4,
        alignment=TA_JUSTIFY,
        leading=11
    )
    
    # Conteúdo do documento
    story = []
    
    # Cabeçalho
    story.append(Paragraph("MATRIZ DE RISCO - SESP/PR", titulo_style))
    story.append(Paragraph("Centro de Engenharia e Arquitetura", subtitulo_style))
    story.append(Spacer(1, 10*mm))
    
    # Informações do projeto
    projeto_info = [
        f"<b>Força:</b> {dados_projeto.get('forca', 'N/A')}",
        f"<b>Tipo de Unidade:</b> {dados_projeto.get('tipoUnidade', 'N/A')}",
        f"<b>Tipo de Intervenção:</b> {dados_projeto.get('tipoIntervencao', 'N/A')}",
        f"<b>Regime de Execução:</b> {dados_projeto.get('regimeExecucao', 'N/A')}",
        f"<b>Valor Estimado:</b> {dados_projeto.get('valor', 'N/A')}",
    ]
    
    # Adicionar informações de porte se disponível
    tamanho_info = metadados_selecao.get('tamanho_info', {})
    if tamanho_info.get('area'):
        projeto_info.append(f"<b>Área:</b> {tamanho_info['area']} m²")
    if tamanho_info.get('categoria'):
        projeto_info.append(f"<b>Porte:</b> {tamanho_info['categoria'].replace('_', ' ').title()}")
    
    for info in projeto_info:
        story.append(Paragraph(info, info_style))
    
    story.append(Spacer(1, 8*mm))
    
    # Resumo dos riscos
    total_riscos = len(riscos_selecionados)
    distribuicao = metadados_selecao.get('risk_distribution', {})
    
    resumo_texto = f"""
    <b>Resumo da Análise:</b><br/>
    • Total de riscos identificados: {total_riscos}<br/>
    • Riscos Extremos: {distribuicao.get('extremo', 0)}<br/>
    • Riscos Altos: {distribuicao.get('alto', 0)}<br/>
    • Riscos Moderados: {distribuicao.get('moderado', 0)}<br/>
    • Riscos Baixos: {distribuicao.get('baixo', 0)}<br/>
    • Base de dados: 557 obras analisadas pelo CEA-SESP/PR
    """
    
    story.append(Paragraph(resumo_texto, info_style))
    story.append(Spacer(1, 10*mm))
    
    # Legenda dos níveis de risco
    legenda_data = [
        ['Nível de Risco', 'Pontuação', 'Descrição'],
        ['Extremo', '15-25', 'Impacto máximo nos objetivos, sem possibilidade de recuperação'],
        ['Alto', '8-14', 'Impacto significativo, com possibilidade mínima de recuperação'],
        ['Moderado', '3-7', 'Impacto moderado, com plena possibilidade de recuperação'],
        ['Baixo', '1-2', 'Impacto mínimo nos objetivos']
    ]
    
    legenda_table = Table(legenda_data, colWidths=[30*mm, 20*mm, 120*mm])
    legenda_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), white),
        ('GRID', (0, 0), (-1, -1), 1, black)
    ]))
    
    story.append(Paragraph("<b>Legenda dos Níveis de Risco:</b>", risco_titulo_style))
    story.append(legenda_table)
    story.append(Spacer(1, 8*mm))
    
    # Lista de riscos
    story.append(Paragraph("<b>RISCOS IDENTIFICADOS</b>", titulo_style))
    story.append(Spacer(1, 6*mm))
    
    for i, risco in enumerate(riscos_selecionados):
        if i > 0:
            story.append(Spacer(1, 6*mm))
        
        # Cabeçalho do risco
        bg_color, text_color = obter_cor_risco(risco.get('nivel_risco', 0))
        nivel_texto = obter_texto_nivel_risco(risco.get('nivel_risco', 0), risco.get('classificacao'))
        
        # Informações do cabeçalho
        cabecalho_data = [[
            f"#{risco.get('id', 'N/A')}",
            nivel_texto,
            risco.get('fase', 'N/A'),
            risco.get('responsavel', 'N/A')
        ]]
        
        cabecalho_table = Table(cabecalho_data, colWidths=[20*mm, 40*mm, 60*mm, 50*mm])
        cabecalho_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), text_color),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, text_color)
        ]))
        
        story.append(cabecalho_table)
        
        # Título do evento
        story.append(Spacer(1, 3*mm))
        story.append(Paragraph(f"<b>{risco.get('evento', 'N/A')}</b>", risco_titulo_style))
        
        # Descrição
        story.append(Paragraph(f"<b>Descrição:</b> {risco.get('descricao', 'N/A')}", risco_texto_style))
        
        # Impacto
        if risco.get('impacto'):
            story.append(Paragraph(f"<b>Impacto:</b> {risco.get('impacto')}", risco_texto_style))
        
        # Mitigação e Correção em tabela
        mitigacao_data = [
            ['🛡️ Mitigação', '🔧 Correção'],
            [risco.get('mitigacao', 'N/A'), risco.get('correcao', 'N/A')]
        ]
        
        mitigacao_table = Table(mitigacao_data, colWidths=[85*mm, 85*mm])
        mitigacao_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#f9fafb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, HexColor('#e5e7eb'))
        ]))
        
        story.append(Spacer(1, 3*mm))
        story.append(mitigacao_table)
        
        # Probabilidade e Impacto
        prob_impacto_data = [
            ['Probabilidade', 'Impacto'],
            [f"{risco.get('probabilidade', 0)}/5", f"{risco.get('impacto_nivel', 0)}/5"]
        ]
        
        prob_impacto_table = Table(prob_impacto_data, colWidths=[85*mm, 85*mm])
        prob_impacto_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#f3f4f6')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 1, HexColor('#d1d5db'))
        ]))
        
        story.append(Spacer(1, 2*mm))
        story.append(prob_impacto_table)
        
        # Adicionar quebra de página a cada 3 riscos para melhor legibilidade
        if (i + 1) % 3 == 0 and i < len(riscos_selecionados) - 1:
            story.append(PageBreak())
    
    # Rodapé com informações do CEA
    story.append(Spacer(1, 10*mm))
    rodape_texto = f"""
    <b>Informações da Análise:</b><br/>
    • Documento gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}<br/>
    • Base de dados: Análise de 557 obras do CEA-SESP/PR<br/>
    • Metodologia: Seleção inteligente baseada em histórico de obras similares<br/>
    • Versão do sistema: 3.2-CEA-DELEGACIAS-CORRIGIDA
    """
    
    story.append(Paragraph(rodape_texto, info_style))
    
    # Gerar o PDF
    doc.build(story)
    
    # Retornar o buffer
    buffer.seek(0)
    return buffer

def mapear_tipo_obra(forca, tipo_unidade):
    """Mapeia a combinação força + unidade para tipo de obra."""
    if forca == 'Polícia Penal':
        if tipo_unidade in ['Casa de Custódia', 'Penitenciária']:
            return 'presidios'
    elif forca == 'Polícia Civil':
        if 'Delegacia' in tipo_unidade:
            return 'delegacias'
    elif forca in ['Corpo de Bombeiros Militar', 'Polícia Militar']:
        if tipo_unidade in ['Pelotão', 'Companhia', 'Companhia Independente', 'Batalhão', 'Comando Regional']:
            return 'quarteis'
    elif forca == 'Polícia Científica':
        if tipo_unidade in ['UETC Básica', 'Posto Avançado']:
            return 'centros_treinamento'
        elif tipo_unidade == 'UETC Intermediária':
            return 'centrais_operacionais'
    
    return None

def ajustar_riscos_por_tamanho(riscos_ids, tamanho_info, debug_logic):
    """Ajusta a lista de riscos baseado no tamanho e complexidade do empreendimento."""
    categoria = tamanho_info.get('categoria', 'medio')
    complexidade = tamanho_info.get('complexidade', 'media')
    area = tamanho_info.get('area', 0)
    
    riscos_adicionar = set()
    riscos_remover = set()
    
    # Ajustes por categoria de tamanho
    if categoria == 'pequeno':
        # Obras pequenas - reduzir complexidade
        riscos_remover.update([1, 4, 23, 37, 46, 56, 73])
        debug_logic.append(f"- Riscos de alta complexidade (obra pequena: {area} m²)")
        
    elif categoria == 'medio':
        # Obras médias - complexidade moderada
        riscos_adicionar.update([37])  # Fiscalização adequada
        debug_logic.append(f"+ Fiscalização adequada (obra média: {area} m²)")
        
    elif categoria == 'grande':
        # Obras grandes - mais complexidade
        riscos_adicionar.update([1, 23, 37, 56])
        debug_logic.append(f"+ Riscos de alta complexidade (obra grande: {area} m²)")
        
    elif categoria == 'muito_grande':
        # Obras muito grandes - máxima complexidade
        riscos_adicionar.update([1, 4, 9, 23, 37, 46, 56, 73, 78, 79])
        debug_logic.append(f"+ Riscos de máxima complexidade (obra muito grande: {area} m²)")
    
    # Ajustes por complexidade específica
    if complexidade == 'muito_alta':
        riscos_adicionar.update([1, 9, 23, 37, 46])
        debug_logic.append("+ Riscos de complexidade muito alta")
    elif complexidade == 'alta':
        riscos_adicionar.update([23, 37])
        debug_logic.append("+ Riscos de alta complexidade")
    elif complexidade == 'baixa':
        riscos_remover.update([1, 4, 9, 23])
        debug_logic.append("- Riscos desnecessários (baixa complexidade)")
    
    # Ajustes específicos para investimentos altos (Delegacias)
    investimento = tamanho_info.get('investimento', 0)
    if investimento > 10000000:  # Acima de 10 milhões
        riscos_adicionar.update([56, 70, 73])  # Riscos financeiros e de custeio
        debug_logic.append(f"+ Riscos financeiros (investimento: R$ {investimento:,.2f})")
    
    # Ajustes para obras com múltiplos pavimentos
    pavimentos = tamanho_info.get('pavimentos', 1)
    if pavimentos > 1:
        riscos_adicionar.update([62, 77])  # Riscos estruturais e de compatibilização
        debug_logic.append(f"+ Riscos estruturais ({pavimentos} pavimentos)")
    
    # Aplicar ajustes
    riscos_ids.update(riscos_adicionar)
    riscos_ids.difference_update(riscos_remover)
    
    return riscos_ids

def ajustar_riscos_por_especialidade(riscos_ids, tipo_unidade, tamanho_info, debug_logic):
    """Adiciona riscos específicos baseados no tipo de unidade e suas especialidades."""
    
    # Polícia Penal - riscos de segurança baseados no tipo
    if tipo_unidade == 'Penitenciária':
        riscos_ids.update([10, 12, 13, 15, 30, 49, 70, 71])  # Segurança máxima
        debug_logic.append("+ Riscos de segurança máxima (Penitenciária)")
    elif tipo_unidade == 'Casa de Custódia':
        riscos_ids.update([10, 12, 25, 38])  # Segurança alta, funcionamento
        debug_logic.append("+ Riscos de alta segurança (Casa de Custódia)")
    
    # Delegacias - riscos baseados no padrão
    elif 'Padrão IA' in tipo_unidade:
        # Menor complexidade
        riscos_ids.difference_update([1, 4, 23, 37, 46])
        debug_logic.append("- Complexidade reduzida (Padrão IA)")
    elif 'Padrão I' in tipo_unidade and 'IA' not in tipo_unidade:
        # Complexidade média
        debug_logic.append("Padrão I - complexidade padrão")
    elif 'Padrão II' in tipo_unidade:
        # 2 pavimentos - mais complexidade
        riscos_ids.update([23, 37, 62, 77])
        debug_logic.append("+ Riscos de múltiplos pavimentos (Padrão II)")
    elif 'Padrão III' in tipo_unidade:
        # 3 pavimentos - alta complexidade
        riscos_ids.update([1, 4, 23, 37, 46, 62, 77])
        debug_logic.append("+ Alta complexidade (Padrão III - 3 pavimentos)")
    
    # CBMPR e PMPR - Comando Regional (só estrutura administrativa)
    elif tipo_unidade == 'Comando Regional':
        riscos_ids.difference_update([1, 4, 9, 23])  # Reduzir complexidade significativamente
        debug_logic.append("- Complexidade reduzida (Comando Regional - estrutura administrativa)")
    
    # Polícia Científica - riscos técnicos
    elif tipo_unidade == 'UETC Intermediária':
        riscos_ids.update([2, 14, 18, 63])  # Sistemas especializados
        debug_logic.append("+ Sistemas técnicos especializados (UETC Intermediária)")
    elif tipo_unidade == 'UETC Básica':
        riscos_ids.difference_update([1, 4])  # Menos complexidade
        debug_logic.append("- Complexidade reduzida (UETC Básica)")
    elif tipo_unidade == 'Posto Avançado':
        riscos_ids.difference_update([1, 4, 9, 23])  # Muito simples
        debug_logic.append("- Obra simples (Posto Avançado)")
    
    # Complexidade por segurança
    complexidade_seguranca = tamanho_info.get('complexidade_seguranca')
    if complexidade_seguranca == 'maxima':
        riscos_ids.update([10, 12, 13, 15, 30, 49, 70, 71])
        debug_logic.append("+ Riscos de segurança máxima")
    elif complexidade_seguranca == 'alta':
        riscos_ids.update([10, 12, 25, 38])
        debug_logic.append("+ Riscos de alta segurança")
    
    # Complexidade técnica
    complexidade_tecnica = tamanho_info.get('complexidade_tecnica')
    if complexidade_tecnica == 'media':
        riscos_ids.update([2, 14, 18])
        debug_logic.append("+ Riscos de sistemas técnicos")
    
    return riscos_ids

# Função auxiliar para processar critérios avançados baseados nos dados do CEA + tamanhos
def processar_criterios_cea(project_data):
    """
    Processa os critérios avançados baseados na análise real dos dados do CEA (557 obras)
    e nas especificações de tamanho dos empreendimentos.
    """
    todos_os_riscos = RISK_DATABASE.get('riscos', [])
    tipos_obra = RISK_DATABASE.get('tipos_obra', {})
    
    # Extrair critérios do frontend
    forca = project_data.get('forca')
    tipo_unidade = project_data.get('tipoUnidade')
    tipo_intervencao = project_data.get('tipoIntervencao')
    regime_execucao = project_data.get('regimeExecucao')
    valor = project_data.get('valor')
    caracteristicas = project_data.get('caracteristicas', [])
    additional_risks = project_data.get('additional_risks', [])
    excluded_risks = project_data.get('excluded_risks', [])
    debug_logic = project_data.get('debug_logic', [])
    
    # Obter informações de tamanho
    tamanho_info = obter_tamanho_info(tipo_unidade)
    debug_logic.append(f"Unidade: {tipo_unidade}")
    debug_logic.append(f"Tamanho identificado: {tamanho_info.get('categoria')} ({tamanho_info.get('area', 'N/A')} m²)")
    
    # Dados da análise CEA para contextualização
    cea_stats = {
        'total_obras': 557,
        'distribuicao_tipos': {
            'Construção': 191,  # 34.3%
            'Reparos': 172,     # 30.9% 
            'Reforma': 167      # 30.0%
        },
        'distribuicao_forcas': {
            'CBMPR': 161,       # 28.9%
            'PCPR': 136,        # 24.4%
            'DEPPEN': 106,      # 19.0%
            'PMPR': 97,         # 17.4%
            'PCP': 50           # 9.0%
        }
    }
    
    # Log detalhado para debug
    print(f"=== PROCESSAMENTO BASEADO EM DADOS CEA + TAMANHOS ===")
    print(f"Projeto: {forca} - {tipo_unidade}")
    print(f"Tamanho: {tamanho_info.get('categoria')} ({tamanho_info.get('area')} m²)")
    print(f"Complexidade: {tamanho_info.get('complexidade')}")
    
    # 1. Começar com riscos base do tipo de obra
    riscos_selecionados_ids = set()
    
    # Mapear tipo de obra
    tipo_obra_chave = mapear_tipo_obra(forca, tipo_unidade)
    debug_logic.append(f"Mapeamento: {forca} + {tipo_unidade} → {tipo_obra_chave}")
    
    if tipo_obra_chave and tipo_obra_chave in tipos_obra:
        riscos_base = tipos_obra[tipo_obra_chave].get("riscos_especificos", [])
        riscos_selecionados_ids.update(riscos_base)
        print(f"Riscos base para {tipo_obra_chave}: {len(riscos_base)}")
    
    # 2. Ajustar riscos por tamanho e complexidade
    riscos_selecionados_ids = ajustar_riscos_por_tamanho(riscos_selecionados_ids, tamanho_info, debug_logic)
    
    # 3. Ajustar riscos por especialidade da unidade
    riscos_selecionados_ids = ajustar_riscos_por_especialidade(riscos_selecionados_ids, tipo_unidade, tamanho_info, debug_logic)
    
    # 4. Adicionar riscos por tipo de intervenção
    if tipo_intervencao == 'Construção':
        riscos_selecionados_ids.update([1, 9, 21, 22, 54, 55, 58])
        debug_logic.append('+ Riscos de construção nova (34.3% das obras CEA)')
    elif tipo_intervencao == 'Reforma':
        riscos_selecionados_ids.update([25, 29, 38, 44, 59, 68, 77])
        debug_logic.append('+ Riscos de reforma (30% das obras CEA)')
    elif tipo_intervencao == 'Reparos':
        riscos_selecionados_ids.update([11, 28, 32, 60])
        riscos_selecionados_ids.difference_update([1, 4, 9, 51])
        debug_logic.append('+ Riscos de reparos (30.9% das obras CEA) / - Riscos de planejamento complexo')
    
    # 5. Adicionar riscos por regime de execução
    if regime_execucao == 'Empreitada por preço global':
        riscos_selecionados_ids.update([3, 5, 8, 53, 67])
        debug_logic.append('+ Riscos de preço global')
    elif regime_execucao == 'Empreitada por preço unitário':
        riscos_selecionados_ids.update([20, 40, 64, 72])
        debug_logic.append('+ Riscos de preço unitário')
    elif regime_execucao == 'Contratação integrada':
        riscos_selecionados_ids.update([1, 2, 23, 37, 51, 52])
        debug_logic.append('+ Riscos de contratação integrada')
    elif regime_execucao == 'Contratação semi-integrada':
        riscos_selecionados_ids.update([1, 23, 37, 51])
        debug_logic.append('+ Riscos de contratação semi-integrada')
    elif regime_execucao == 'Empreitada integral':
        riscos_selecionados_ids.update([1, 9, 28, 42, 51, 76])
        debug_logic.append('+ Riscos de empreitada integral')
    elif regime_execucao == 'Contratação por tarefa':
        riscos_selecionados_ids.difference_update([1, 4, 9, 51, 52])
        debug_logic.append('- Riscos de alta complexidade (tarefa)')
    
    # 6. Adicionar riscos por características especiais
    for caracteristica in caracteristicas:
        if caracteristica == 'Obra em unidade em funcionamento':
            riscos_selecionados_ids.update([25, 38, 59, 68])
            debug_logic.append('+ Riscos de obra em funcionamento')
        elif caracteristica == 'Necessita licenciamento ambiental':
            riscos_selecionados_ids.update([9, 36, 55, 69])
            debug_logic.append('+ Riscos ambientais')
        elif caracteristica == 'Área de segurança máxima':
            riscos_selecionados_ids.update([10, 12, 13, 15, 58, 70, 71])
            debug_logic.append('+ Riscos de segurança máxima')
        elif caracteristica == 'Integração com sistemas existentes':
            riscos_selecionados_ids.update([14, 29, 34, 44, 65, 77])
            debug_logic.append('+ Riscos de integração')
        elif caracteristica == 'Demolição de estruturas':
            riscos_selecionados_ids.update([19, 36, 66, 75])
            debug_logic.append('+ Riscos de demolição')
        elif caracteristica == 'Obra em área urbana densamente povoada':
            riscos_selecionados_ids.update([36, 47])
            debug_logic.append('+ Riscos de obra em área urbana')
        elif caracteristica == 'Necessita relocação temporária':
            riscos_selecionados_ids.update([25, 38, 47])
            debug_logic.append('+ Riscos de relocação temporária')
    
    # 7. Adicionar riscos adicionais do frontend
    riscos_selecionados_ids.update(additional_risks)
    
    # 8. Remover riscos excluídos do frontend
    riscos_selecionados_ids.difference_update(excluded_risks)
    
    # 9. Filtrar a lista de riscos pelos IDs selecionados
    riscos_finais = [
        risco for risco in todos_os_riscos 
        if risco.get("id") in riscos_selecionados_ids
    ]
    
    # 10. Ordenar por nível de risco (mais críticos primeiro) + fase
    def ordenar_riscos(risco):
        nivel = risco.get('nivel_risco', 0)
        fase_ordem = {
            'Preliminar à Licitação': 1, 
            'Planejamento da Contratação': 2, 
            'Externa da Licitação': 3, 
            'Contratual (Execução)': 4, 
            'Posterior à Contratação': 5
        }
        fase = fase_ordem.get(risco.get('fase', ''), 6)
        return (-nivel, fase)
    
    riscos_finais.sort(key=ordenar_riscos)
    
    # 11. Preparar resposta com metadados CEA + tamanho
    response_data = {
        "selected_risks": riscos_finais,
        "selection_metadata": {
            "tipo_obra_base": tipo_obra_chave,
            "tamanho_info": tamanho_info,
            "total_risks_selected": len(riscos_finais),
            "additional_risks_count": len(additional_risks),
            "excluded_risks_count": len(excluded_risks),
            "debug_logic": debug_logic,
            "cea_context": {
                "total_obras_analisadas": cea_stats['total_obras'],
                "relevancia_tipo": cea_stats['distribuicao_tipos'].get(tipo_intervencao, 0),
                "relevancia_forca": cea_stats['distribuicao_forcas'].get(FORCE_MAPPING.get(forca, ''), 0)
            },
            "risk_distribution": {
                "extremo": len([r for r in riscos_finais if r.get('nivel_risco', 0) >= 15]),
                "alto": len([r for r in riscos_finais if 8 <= r.get('nivel_risco', 0) < 15]),
                "moderado": len([r for r in riscos_finais if 3 <= r.get('nivel_risco', 0) < 8]),
                "baixo": len([r for r in riscos_finais if r.get('nivel_risco', 0) < 3])
            },
            "phases_distribution": {
                "preliminar": len([r for r in riscos_finais if 'Preliminar' in r.get('fase', '')]),
                "planejamento": len([r for r in riscos_finais if 'Planejamento' in r.get('fase', '')]),
                "licitacao": len([r for r in riscos_finais if 'Licitação' in r.get('fase', '') or 'Externa' in r.get('fase', '')]),
                "execucao": len([r for r in riscos_finais if 'Execução' in r.get('fase', '') or 'Contratual' in r.get('fase', '')]),
                "posterior": len([r for r in riscos_finais if 'Posterior' in r.get('fase', '')])
            }
        }
    }
    
    return response_data

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de verificação de saúde com informações sobre os dados CEA."""
    return jsonify({
        "status": "ok", 
        "message": "API de Riscos da SESP/PR CEA está operacional!",
        "version": "3.2-CEA-DELEGACIAS-CORRIGIDA",
        "features": [
            "advanced_risk_selection", 
            "debug_info", 
            "regime_execucao", 
            "cea_data_integration",
            "size_based_risk_adjustment",
            "delegacia_patterns_pdf",
            "penal_security_levels",
            "scientific_police_types",
            "cbmpr_pmpr_units",
            "comando_regional_pequeno"
        ],
        "cea_data": {
            "total_obras_analisadas": 557,
            "forcas_identificadas": 5,
            "tipos_intervencao": 3,
            "delegacia_patterns": 4,
            "data_base": "2025-05-29"
        },
        "delegacia_patterns": {
            "padrao_ia": "376.73 m² - R$ 2.8M",
            "padrao_i": "642.29 m² - R$ 4.7M", 
            "padrao_ii": "1.207.48 m² - R$ 8.9M",
            "padrao_iii": "1.791.23 m² - R$ 13.2M"
        }
    })

@app.route('/api/risk-metadata', methods=['GET'])
def get_risk_metadata():
    """Retorna metadados incluindo informações baseadas nos dados CEA e padrões de delegacias."""
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500
    
    metadata_response = {
        "metadata": RISK_DATABASE.get("metadata", {}),
        "escala_probabilidade": RISK_DATABASE.get("escala_probabilidade", {}),
        "escala_impacto": RISK_DATABASE.get("escala_impacto", {}),
        "nivel_risco_definicoes": RISK_DATABASE.get("nivel_risco", {}),
        "tipos_obra_disponiveis": list(RISK_DATABASE.get("tipos_obra", {}).keys()),
        "total_riscos_base": len(RISK_DATABASE.get("riscos", [])),
        "cea_insights": {
            "total_obras_analisadas": 557,
            "distribuicao_tipos": {
                "construcao": {"count": 191, "percent": 34.3},
                "reparos": {"count": 172, "percent": 30.9},
                "reforma": {"count": 167, "percent": 30.0}
            },
            "distribuicao_forcas": {
                "cbmpr": {"count": 161, "percent": 28.9},
                "pcpr": {"count": 136, "percent": 24.4},
                "deppen": {"count": 106, "percent": 19.0},
                "pmpr": {"count": 97, "percent": 17.4},
                "pcp": {"count": 50, "percent": 9.0}
            }
        },
        "delegacia_patterns": {
            "padrao_ia": {
                "area": 376.73,
                "investimento": 2768965.50,
                "pavimentos": 1,
                "categoria": "pequeno"
            },
            "padrao_i": {
                "area": 642.29,
                "investimento": 4720831.50,
                "pavimentos": 1,
                "categoria": "medio"
            },
            "padrao_ii": {
                "area": 1207.48,
                "investimento": 8874978.00,
                "pavimentos": 2,
                "categoria": "grande"
            },
            "padrao_iii": {
                "area": 1791.23,
                "investimento": 13165540.50,
                "pavimentos": 3,
                "categoria": "muito_grande"
            }
        },
        "tamanhos_suportados": list(TAMANHOS_POR_UNIDADE.keys())
    }
    return jsonify(metadata_response)

@app.route('/api/project-risks', methods=['POST'])
def get_project_risks():
    """
    Endpoint melhorado que usa dados reais do CEA e considera tamanhos dos empreendimentos.
    """
    if not RISK_DATABASE:
        return jsonify({"error": "A base de dados de riscos não pôde ser carregada."}), 500

    project_data = request.get_json()
    if not project_data:
        return jsonify({"error": "Nenhum dado do projeto foi recebido no corpo da requisição."}), 400

    try:
        # Processar critérios baseados nos dados CEA + tamanhos
        result = processar_criterios_cea(project_data)
        
        # Verificar se algum risco foi selecionado
        if not result["selected_risks"]:
            return jsonify({
                "warning": "Nenhum risco foi identificado para os critérios informados.",
                "selected_risks": [],
                "selection_metadata": result["selection_metadata"],
                "cea_suggestions": [
                    "Baseado na análise de 557 obras do CEA, verifique:",
                    "• Se o tipo de obra está corretamente mapeado",
                    "• Se as características especiais se aplicam ao projeto",
                    "• Se o regime de execução está adequado ao escopo",
                    "• Se o porte do empreendimento foi identificado corretamente"
                ]
            }), 200
        
        # Resposta de sucesso com contexto CEA + tamanho
        tamanho_info = result["selection_metadata"]["tamanho_info"]
        return jsonify({
            "message": f"Riscos selecionados com base na análise de 557 obras do CEA, considerando porte {tamanho_info.get('categoria', 'indefinido')}.",
            "selected_risks": result["selected_risks"],
            "selection_metadata": result["selection_metadata"],
            "project_data_received": {
                "forca": project_data.get("forca"),
                "tipoUnidade": project_data.get("tipoUnidade"),
                "tipoIntervencao": project_data.get("tipoIntervencao"),
                "regimeExecucao": project_data.get("regimeExecucao"),
                "valor": project_data.get("valor"),
                "caracteristicas_count": len(project_data.get("caracteristicas", [])),
                "tamanho_categoria": tamanho_info.get('categoria'),
                "area_m2": tamanho_info.get('area')
            },
            "cea_context": f"Este projeto ({tamanho_info.get('categoria')}) se alinha com {result['selection_metadata']['cea_context']['relevancia_tipo']} obras similares do CEA.",
            "size_context": f"Área: {tamanho_info.get('area', 'N/A')} m² - Porte: {tamanho_info.get('categoria', 'indefinido')}"
        })
    
    except Exception as e:
        print(f"Erro ao processar critérios de risco baseados no CEA + tamanhos: {e}")
        return jsonify({
            "error": "Erro interno ao processar critérios de seleção de riscos.",
            "details": str(e)
        }), 500

@app.route('/api/cea-insights', methods=['GET'])
def get_cea_insights():
    """
    Endpoint que retorna insights específicos baseados na análise dos dados CEA + padrões de delegacias.
    """
    insights = {
        "overview": {
            "total_obras_analisadas": 557,
            "periodo_analise": "Histórico completo das obras do CEA",
            "data_atualizacao": "2025-05-29",
            "nova_versao": "3.1 - Com padrões de Delegacias Cidadãs"
        },
        "distribuicao_forcas": {
            "corpo_bombeiros": {"obras": 161, "percentual": 28.9, "foco": "Segurança e emergência"},
            "policia_civil": {"obras": 136, "percentual": 24.4, "foco": "Investigação e atendimento", "padroes_delegacia": 4},
            "policia_penal": {"obras": 106, "percentual": 19.0, "foco": "Segurança máxima", "tipos_estabelecimento": 2},
            "policia_militar": {"obras": 97, "percentual": 17.4, "foco": "Ostensivo e patrulhamento"},
            "policia_cientifica": {"obras": 50, "percentual": 9.0, "foco": "Perícia e laboratórios", "tipos_uetc": 3}
        },
        "tipos_intervencao": {
            "construcao": {"obras": 191, "percentual": 34.3, "caracteristica": "Maior categoria - projetos novos"},
            "reparos": {"obras": 172, "percentual": 30.9, "caracteristica": "Manutenção e correções"},
            "reforma": {"obras": 167, "percentual": 30.0, "caracteristica": "Adequações e melhorias"}
        },
        "delegacia_patterns": {
            "padrao_ia": {
                "area": "376,73 m²",
                "investimento": "R$ 2.768.965,50",
                "pavimentos": 1,
                "aplicacao": "Unidades menores, menor complexidade"
            },
            "padrao_i": {
                "area": "642,29 m²", 
                "investimento": "R$ 4.720.831,50",
                "pavimentos": 1,
                "aplicacao": "Unidades médias padrão"
            },
            "padrao_ii": {
                "area": "1.207,48 m²",
                "investimento": "R$ 8.874.978,00", 
                "pavimentos": 2,
                "aplicacao": "Unidades grandes, riscos estruturais"
            },
            "padrao_iii": {
                "area": "1.791,23 m²",
                "investimento": "R$ 13.165.540,50",
                "pavimentos": 3,
                "aplicacao": "Unidades muito grandes, máxima complexidade"
            }
        },
        "insights_riscos": {
            "construcao_nova": "Riscos de planejamento e licenciamento são predominantes",
            "obras_funcionamento": "30% das reformas ocorrem em unidades operacionais",
            "seguranca_maxima": "Penitenciárias têm riscos únicos de segurança",
            "tamanho_impacto": "Porte do empreendimento influencia diretamente o perfil de riscos",
            "delegacias_grandes": "Padrões II e III requerem riscos estruturais adicionais"
        },
        "size_impact_analysis": {
            "pequeno": "Até 400 m² - Riscos reduzidos, menos complexidade",
            "medio": "400-1000 m² - Riscos moderados, fiscalização adequada",
            "grande": "1000-1500 m² - Riscos elevados, complexidade estrutural",
            "muito_grande": "Acima de 1500 m² - Todos os riscos, máxima complexidade"
        }
    }
    
    return jsonify(insights)

@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf_endpoint():
    """
    Endpoint para geração de PDF real com os riscos identificados.
    """
    try:
        dados_para_pdf = request.get_json()
        
        if not dados_para_pdf:
            return jsonify({"error": "Nenhum dado recebido para geração do PDF."}), 400
        
        # Extrair dados
        project_data = dados_para_pdf.get("projectData", {})
        selected_risks = dados_para_pdf.get("selectedRisks", [])
        debug_info = dados_para_pdf.get("debugInfo", {})
        
        # Validar dados essenciais
        if not selected_risks:
            return jsonify({"error": "Nenhum risco foi selecionado para o PDF."}), 400
        
        if not project_data.get('forca') or not project_data.get('tipoUnidade'):
            return jsonify({"error": "Informações do projeto incompletas."}), 400
        
        # Log para debug
        print("=== GERANDO PDF REAL ===")
        print(f"Projeto: {project_data.get('forca')} - {project_data.get('tipoUnidade')}")
        print(f"Riscos: {len(selected_risks)}")
        
        # Gerar o PDF
        pdf_buffer = gerar_pdf_riscos(project_data, selected_risks, debug_info)
        
        # Criar nome do arquivo
        forca_abrev = {
            'Corpo de Bombeiros Militar': 'CBMPR',
            'Polícia Militar': 'PMPR',
            'Polícia Civil': 'PCPR', 
            'Polícia Penal': 'DEPPEN',
            'Polícia Científica': 'PCP'
        }.get(project_data.get('forca', ''), 'SESP')
        
        tipo_unidade = project_data.get('tipoUnidade', 'Unidade').replace(' ', '_').replace('(', '').replace(')', '').replace(',', '')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"Matriz_Risco_{forca_abrev}_{tipo_unidade}_{timestamp}.pdf"
        
        # Retornar o arquivo PDF
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Erro ao gerar PDF: {str(e)}")
        return jsonify({
            "error": "Erro interno ao gerar PDF.",
            "details": str(e)
        }), 500

# Endpoint para estatísticas baseadas no CEA + tamanhos
@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Retorna estatísticas enriquecidas com dados CEA + análise de tamanhos."""
    if not RISK_DATABASE:
        return jsonify({"error": "Base de dados não disponível."}), 500
    
    riscos = RISK_DATABASE.get('riscos', [])
    tipos_obra = RISK_DATABASE.get('tipos_obra', {})
    
    stats = {
        "database_info": RISK_DATABASE.get('metadata', {}),
        "total_risks": len(riscos),
        "risk_types": len(tipos_obra),
        "cea_integration": {
            "total_obras_base": 557,
            "tipos_obra_mapeados": 5,
            "forcas_mapeadas": 5,
            "criterios_aplicados": 8,
            "size_categories": 4,
            "delegacia_patterns": 4
        },
        "size_distribution": {
            "pequeno": len([k for k, v in TAMANHOS_POR_UNIDADE.items() if v.get('categoria') == 'pequeno']),
            "medio": len([k for k, v in TAMANHOS_POR_UNIDADE.items() if v.get('categoria') == 'medio']),
            "grande": len([k for k, v in TAMANHOS_POR_UNIDADE.items() if v.get('categoria') == 'grande']),
            "muito_grande": len([k for k, v in TAMANHOS_POR_UNIDADE.items() if v.get('categoria') == 'muito_grande'])
        },
        "risk_distribution": {
            "by_level": {},
            "by_phase": {},
            "by_responsible": {},
            "by_category": {}
        },
        "obra_types": {
            name: {
                "description": info.get("descricao", ""),
                "specific_risks": len(info.get("riscos_especificos", [])),
                "cea_mapping": f"Baseado em obras reais do CEA"
            }
            for name, info in tipos_obra.items()
        },
        "delegacia_investment_range": {
            "minimo": 2768965.50,
            "maximo": 13165540.50,
            "patterns": 4
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
    print("=== INICIANDO API COM PADRÕES DE DELEGACIAS + TAMANHOS (CORRIGIDA) ===")
    print("Base de dados: 557 obras analisadas")
    print("Padrões de Delegacias: IA, I, II, III")
    print("Polícia Penal: Casa de Custódia, Penitenciária") 
    print("Polícia Científica: UETC Básica, Intermediária, Posto Avançado")
    print("CBMPR/PMPR: Pelotão, Companhia, Batalhão, Comando Regional (pequeno)")
    print("Versão: 3.2-CEA-DELEGACIAS-CORRIGIDA")
    app.run(host='0.0.0.0', port=port, debug=True)
