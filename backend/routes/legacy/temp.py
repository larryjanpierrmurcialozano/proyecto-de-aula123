import os
import io
import json
import pandas as pd
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from openpyxl import load_workbook

# Importación de la conexión real del proyecto
from utils.database import db_pool, SafeConnection

# Si modificas estos scopes, debes borrar los archivos token_{user_id}.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file']
CREDENTIALS_FILE = os.path.join('backend', 'credentials.json')
TOKENS_DIR = os.path.join('backend', 'tokens')

def get_service(user_id):
    """
    Gestiona el flujo de autenticacion OAuth 2.0 por usuario.
    Guarda y recupera un archivo token_{user_id}.json en el directorio /tokens/.
    """
    creds = None
    token_path = os.path.join(TOKENS_DIR, f'token_{user_id}.json')
    
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            # Nota: para un backend de produccion, usa Authorization Code Flow en lugar de run_local_server
            creds = flow.run_local_server(port=0)
            
        with open(token_path, 'w') as token_file:
            token_file.write(creds.to_json())
            
    return build('drive', 'v3', credentials=creds)

def get_or_create_folder(service, folder_name, parent_id=None):
    """Verifica si la carpeta existe. Si no, la crea y retorna el ID."""
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
        
    results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
    items = results.get('files', [])
    
    if items:
        return items[0]['id']
    else:
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            folder_metadata['parents'] = [parent_id]
            
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        return folder.get('id')

def setup_folder_structure(user_id, año, periodo_nombre):
    """
    Estructura en Drive: Docstry > [Año] > [Periodo] > [Calificaciones, Asistencias, Reportes]
    """
    service = get_service(user_id)
    
    # 1. Carpeta raíz 'Docstry'
    docstry_id = get_or_create_folder(service, 'Docstry')
    
    # 2. Año
    año_id = get_or_create_folder(service, str(año), docstry_id)
    
    # 3. Periodo
    periodo_id = get_or_create_folder(service, periodo_nombre, año_id)
    
    # 4. Subcarpetas
    subcarpetas = {}
    for sub in ['Calificaciones', 'Asistencias', 'Reportes']:
        subcarpetas[sub] = get_or_create_folder(service, sub, periodo_id)
        
    return subcarpetas

# REPLACE_START
def generate_excel_template(user_id, grado_id, materia_id, periodo_id):
    """
    Genera una plantilla Excel con Pandas, inyecta formulas nativas con openpyxl 
    y la sube a Google Drive a la subcarpeta 'Calificaciones'.
    """
    estudiantes = []
    # Consultas usando la conexión real (mysql-connector)
    conn = db_pool.get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        print(f"DEBUG: Buscando estudiantes con id_grupo = {grado_id}")
        # 1. Obtener estudiantes del grado (usando id_group)
        cursor.execute("SELECT id_estudiante, nombre, apellido FROM estudiantes WHERE id_grupo = %s", (grado_id,))
        estudiantes = cursor.fetchall()
        print(f"DEBUG: Estudiantes encontrados: {len(estudiantes)}")
        # 2. (Opcional) Obtener actividades configuradas para la materia si tienes tabla de actividades.
        # Aquí lo simularemos con 3 notas estándar si no hay dinámica.
    finally:
        conn.close()
        
    if not estudiantes:
        raise ValueError("No se encontraron estudiantes para este grado.")

    # Preparar el DataFrame
    data_list = []
    for est in estudiantes:
        data_list.append({
            'ID_Secreto': est['id_estudiante'],
            'Nombres y Apellidos': f"{est['apellido']} {est['nombre']}",
            'Actividad 1 (30%)': None,
            'Actividad 2 (30%)': None,
            'Examen (40%)': None,
            'Nota Final': None
        })
        
    df = pd.DataFrame(data_list)
    
    file_stream = io.BytesIO()
    
    # Crear el Excel
    with pd.ExcelWriter(file_stream, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Planilla')
        workbook = writer.book
        worksheet = writer.sheets['Planilla']
        
        # Ocultar la primera columna (ID_Secreto) asumiendo que es la 'A'
        worksheet.column_dimensions['A'].hidden = True
        
        # Inyectar la fórmula para la Nota Final. 
        # Suponiendo columnas C, D, E para notas y F para Nota Final. Fila 2 en adelante.
        for row_num in range(2, len(df) + 2):
            worksheet[f'F{row_num}'] = f'=(C{row_num}*0.3) + (D{row_num}*0.3) + (E{row_num}*0.4)'

    file_stream.seek(0)
    
    # Subir a Drive
    service = get_service(user_id)
    
    # Obtener el ID de la subcarpeta 'Calificaciones' (esto puede mejorarse guardando el ID en Base de datos)
    # Por ahora recalculamos la estructura. Asumiendo Año 2026, Periodo 1 para la demo.
    carpetas = setup_folder_structure(user_id, '2026', 'Periodo_1')
    folder_calificaciones_id = carpetas['Calificaciones']
    
    file_metadata = {
        'name': f'Grado_{grado_id}_Materia_{materia_id}_P{periodo_id}.xlsx',
        'parents': [folder_calificaciones_id]
    }
    
    media = MediaIoBaseUpload(file_stream, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def sync_grades_from_drive(user_id, file_id, periodo_id, materia_id):
    """
    Descarga el Excel de Drive, lo procesa con pandas y actualiza/inserta las calificaciones 
    con mysql-connector, tal como funciona 'Docstry'.
    """
    service = get_service(user_id)
    
    request = service.files().get_media(fileId=file_id)
    file_stream = io.BytesIO()
    downloader = MediaIoBaseDownload(file_stream, request)
    done = False
    while done is False:
        status, done = downloader.next_chunk()
        
    file_stream.seek(0)
    
    # Leer el Excel, ignorando formulas y tomando solo datos
    df = pd.read_excel(file_stream, sheet_name='Planilla')
    
    conn = db_pool.get_connection()
    try:
        cursor = conn.cursor()
        
        # Iterar cada registro del excel y actualizar (o insertar)
        for index, row in df.iterrows():
            est_id = row['ID_Secreto']
            # Obtener las notas, controlando que no vengan vacias en cuyo caso asignamos None
            nota1 = float(row['Actividad 1 (30%)']) if pd.notna(row['Actividad 1 (30%)']) else None
            nota2 = float(row['Actividad 2 (30%)']) if pd.notna(row['Actividad 2 (30%)']) else None
            examen = float(row['Examen (40%)']) if pd.notna(row['Examen (40%)']) else None
            nota_final = float(row['Nota Final']) if pd.notna(row['Nota Final']) else None
            
            # Aqui ajustamos el query a tus nombres de columnas reales 
            # (suponiendo notas_actividad1, notas_actividad2 dentro de la tabla calificaciones)
            if pd.notna(est_id):
                update_query = """
                    INSERT INTO calificaciones (estudiante_id, materia_id, periodo_id, examen1, examen2, examen_final, nota_final)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        examen1 = VALUES(examen1), 
                        examen2 = VALUES(examen2),
                        examen_final = VALUES(examen_final),
                        nota_final = VALUES(nota_final)
                """
                cursor.execute(update_query, (int(est_id), materia_id, periodo_id, nota1, nota2, examen, nota_final))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
    
    return True

# ==============================================================================
# RUTAS DE FLASK PARA PRUEBA DE SINCRONIZACI�N CON DRIVE
# ==============================================================================
# REPLACE_END
from flask import Blueprint, jsonify, request

# drive_bp = Blueprint('drive_bp', __name__)

# @drive_bp.route('/api/drive/test', methods=['GET'])
def test_drive_auth():
    """ Prueba inicial de autenticación para un usuario (ej. Docente ID 1) """
    user_id = request.args.get('user_id', 1) # Por defecto id 1 si no se env�a
    try:
        # Esto iniciar� el flujo de OAuth si no existe token, o se conectar� si ya existe
        service = get_service(user_id)
        return jsonify({'status': 'success', 'message': f'Autenticaci�n exitosa para el usuario {user_id}'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# @drive_bp.route('/pruebadrive', methods=['POST'])
# @login_required  <-- Comenta esto con un # solo para la prueba
def test_drive_upload():
    """ Generar y subir una planilla de prueba para el Docente ID 1 """   
    user_id = request.args.get('user_id', 1)
    grado_id = request.json.get('grado_id', 1)
    materia_id = request.json.get('materia_id', 1)
    periodo_id = request.json.get('periodo_id', 1)
    try:
        file_id = generate_excel_template(user_id, grado_id, materia_id, periodo_id)
        return jsonify({'status': 'success', 'message': 'Planilla subida correctamente a Drive.', 'file_id': file_id})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

