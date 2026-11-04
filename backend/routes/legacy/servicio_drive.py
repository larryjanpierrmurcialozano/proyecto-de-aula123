# import os
# import io
# import json
# import pandas as pd
# from google.oauth2.credentials import Credentials
# from google_auth_oauthlib.flow import InstalledAppFlow
# from google.auth.transport.requests import Request
# from googleapiclient.discovery import build
# from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
# from openpyxl import load_workbook
# 
# # Importación de la conexión real del proyecto
# from utils.database import db_pool, SafeConnection
# 
# # Si modificas estos scopes, debes borrar los archivos token_{user_id}.json.
# SCOPES = ['https://www.googleapis.com/auth/drive.file']
# CREDENTIALS_FILE = os.path.join('backend', 'credentials.json')
# TOKENS_DIR = os.path.join('backend', 'tokens')
# 
# def get_service(user_id):
#     """
#     Gestiona el flujo de autenticacion OAuth 2.0 por usuario.
#     Guarda y recupera un archivo token_{user_id}.json en el directorio /tokens/.
#     """
#     creds = None
#     token_path = os.path.join(TOKENS_DIR, f'token_{user_id}.json')
#     
#     if os.path.exists(token_path):
#         creds = Credentials.from_authorized_user_file(token_path, SCOPES)
#         
#     if not creds or not creds.valid:
#         if creds and creds.expired and creds.refresh_token:
#             creds.refresh(Request())
#         else:
#             flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
#             # Nota: para un backend de produccion, usa Authorization Code Flow en lugar de run_local_server
#             creds = flow.run_local_server(port=0)
#             
#         with open(token_path, 'w') as token_file:
#             token_file.write(creds.to_json())
#             
#     return build('drive', 'v3', credentials=creds)
# 
# def get_or_create_folder(service, folder_name, parent_id=None):
#     """Verifica si la carpeta existe. Si no, la crea y retorna el ID."""
#     query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
#     if parent_id:
#         query += f" and '{parent_id}' in parents"
#         
#     results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
#     items = results.get('files', [])
#     
#     if items:
#         return items[0]['id']
#     else:
#         folder_metadata = {
#             'name': folder_name,
#             'mimeType': 'application/vnd.google-apps.folder'
#         }
#         if parent_id:
#             folder_metadata['parents'] = [parent_id]
#             
#         folder = service.files().create(body=folder_metadata, fields='id').execute()
#         return folder.get('id')
# 
# def setup_folder_structure(user_id, año, periodo_nombre):
#     """
#     Estructura en Drive: Docstry > [Año] > [Periodo] > [Calificaciones, Asistencias, Reportes]
#     """
#     service = get_service(user_id)
#     
#     # 1. Carpeta raíz 'Docstry'
#     docstry_id = get_or_create_folder(service, 'Docstry')
#     
#     # 2. Año
#     año_id = get_or_create_folder(service, str(año), docstry_id)
#     
#     # 3. Periodo
#     periodo_id = get_or_create_folder(service, periodo_nombre, año_id)
#     
#     # 4. Subcarpetas
#     subcarpetas = {}
#     for sub in ['Calificaciones', 'Asistencias', 'Reportes']:
#         subcarpetas[sub] = get_or_create_folder(service, sub, periodo_id)
#         
#     return subcarpetas
# 
# def generate_excel_template(user_id, grupo_id, materia_id, periodo_id):
#     """
#     Genera una plantilla Excel dinámica.
#     Consulta los estudiantes y las actividades configuradas para esa materia y grupo en la BD real.
#     La sube a Google Drive asumiendo la estructura del Docente.
#     """
#     conn = db_pool.get_connection()
#     try:
#         cursor = conn.cursor(dictionary=True)
#         # 1. Obtener estudiantes del grupo (id_grupo según tu DB)
#         cursor.execute("SELECT id_estudiante, nombre, apellido FROM estudiantes WHERE id_grupo = %s AND estado = 'Activo'", (grupo_id,))
#         estudiantes = cursor.fetchall()
#         
#         # 2. Obtener actividades reales configuradas para esa materia y grupo (de la tabla actividades)
#         cursor.execute("SELECT id_actividad, nombre_actividad, ponderacion FROM actividades WHERE id_grupo = %s AND id_materia = %s", (grupo_id, materia_id))
#         actividades = cursor.fetchall()
#     finally:
#         conn.close()
# 
#     if not estudiantes:
#         raise ValueError("No se encontraron estudiantes para este grupo.")
# 
#     # Preparar las cabeceras dinámicas basadas en la tabla actividades
#     cabeceras_actividades = []
#     for act in actividades:
#         pond_str = f"({act['ponderacion']}%)" if act['ponderacion'] else ""
#         # Escondemos el id_actividad en la cabecera e.g. 'Examen Final (40.00%) ID_5'
#         cabeceras_actividades.append(f"{act['nombre_actividad']} {pond_str} ID_{act['id_actividad']}")
# 
#     if not cabeceras_actividades:
#         # Failsafe en caso de que no haya actividades aun, poner al menos una de relleno o dar error
#         cabeceras_actividades.append('Actividad Generica ID_0')
# 
#     # Llenar listado de estudiantes
#     data_list = []
#     for est in estudiantes:
#         fila = {
#             'ID_Secreto': est['id_estudiante'],
#             'Nombres y Apellidos': f"{est['apellido']} {est['nombre']}"
#         }
#         for cabecera in cabeceras_actividades:
#             fila[cabecera] = None
#         fila['Nota Final (Aprox)'] = None
#         data_list.append(fila)
# 
#     df = pd.DataFrame(data_list)
#     file_stream = io.BytesIO()
# 
#     # Escribir con openpyxl para inyectar formulas nativas
#     with pd.ExcelWriter(file_stream, engine='openpyxl') as writer:
#         df.to_excel(writer, index=False, sheet_name='Planilla')
#         workbook = writer.book
#         worksheet = writer.sheets['Planilla']
# 
#         # Ocultar la primera columna (ID_Secreto) que es la 'A' de Excel
#         worksheet.column_dimensions['A'].hidden = True
# 
#         # Inyectar una formula de suma basica visual para la nota final. 
#         # (En la DB, recordamos que se guarda por id_actividad especifico, no la nota final como tal que es calculada).
#         col_start = 3 
#         col_end = col_start + len(cabeceras_actividades) - 1
#         num_col_final = col_end + 1
#         # Convertimos index de columna a letra (1->A, 2->B, etc...) hasta Z
#         letra_col_final = chr(64 + num_col_final) if num_col_final <= 26 else 'Z' 
#         
#         for row_num in range(2, len(df) + 2):
#             # Ejemplo de formula base: suma todo. Tu sistema en BD hara el calculo final real.
#             worksheet[f'{letra_col_final}{row_num}'] = f'=SUM(C{row_num}:{chr(64+col_end)}{row_num})'
# 
#     file_stream.seek(0)
#     
#     # Subimos el archivo a Google Drive
#     service = get_service(user_id)
#     # Ejemplo hardcodeado de año y periodo para crear la carpeta
#     carpetas = setup_folder_structure(user_id, '2026', f'Periodo_{periodo_id}')
#     
#     file_metadata = {
#         'name': f'Grupo_{grupo_id}_Materia_{materia_id}_P{periodo_id}.xlsx',
#         'parents': [carpetas['Calificaciones']]
#     }
# 
#     media = MediaIoBaseUpload(file_stream, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
#     file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
#     return file.get('id')
# 
# def sync_grades_from_drive(user_id, file_id, periodo_id, materia_id):
#     """
#     Descarga el Excel de Drive y actualiza la tabla 'notas' (que es la real en tu DB).
#     Escanea las columnas en búsqueda de 'ID_xxx' para relacionar cada nota con su actividad correspondiente.
#     """
#     service = get_service(user_id)
#     request = service.files().get_media(fileId=file_id)
#     file_stream = io.BytesIO()
#     downloader = MediaIoBaseDownload(file_stream, request)
#     done = False
#     while done is False:
#         status, done = downloader.next_chunk()
#         
#     file_stream.seek(0)
#     df = pd.read_excel(file_stream, sheet_name='Planilla')
#     
#     conn = db_pool.get_connection()
#     try:
#         cursor = conn.cursor()
#         
#         # Reconocer todas las columnas que representan una actividad valida (extraer el ID)
#         columnas_actividades = []
#         for col in df.columns:
#             if " ID_" in col:
#                 try:
#                     act_id = int(col.split(" ID_")[-1])
#                     if act_id != 0: # Saltamos nuestra genérica si no hay actividades
#                         columnas_actividades.append({"nombre": col, "id": act_id})
#                 except ValueError:
#                     pass
# 
#         # Parsear filas e insertar/actualizar la tabla 'notas' (usando id_estudiante, id_actividad, id_materia, id_periodo)
#         for index, row in df.iterrows():
#             est_id = row['ID_Secreto']
#             if pd.notna(est_id):
#                 for col_act in columnas_actividades:
#                     puntaje = row[col_act["nombre"]]
#                     
#                     if pd.notna(puntaje):
#                         update_query = """
#                             INSERT INTO notas (id_estudiante, id_actividad, id_materia, id_periodo, puntaje_obtenido)
#                             VALUES (%s, %s, %s, %s, %s)
#                             ON DUPLICATE KEY UPDATE puntaje_obtenido = VALUES(puntaje_obtenido)
#                         """
#                         cursor.execute(update_query, (int(est_id), col_act["id"], materia_id, periodo_id, float(puntaje)))
#                         
#         conn.commit()
#     except Exception as e:
#         conn.rollback()
#         raise e
#     finally:
#         conn.close()
#         
#     return True
# 
# # ==============================================================================
# # RUTAS DE FLASK PARA PRUEBA DE SINCRONIZACI�N CON DRIVE
# # ==============================================================================
# from flask import Blueprint, jsonify, request
# 
# drive_bp = Blueprint('drive_bp', __name__)
# 
# @drive_bp.route('/api/drive/test', methods=['GET'])
# def test_drive_auth():
#     """ Prueba inicial de autenticación para un usuario (ej. Docente ID 1) """
#     user_id = request.args.get('user_id', 1) # Por defecto id 1 si no se env�a
#     try:
#         # Esto iniciar� el flujo de OAuth si no existe token, o se conectar� si ya existe
#         service = get_service(user_id)
#         return jsonify({'status': 'success', 'message': f'Autenticaci�n exitosa para el usuario {user_id}'})
#     except Exception as e:
#         return jsonify({'status': 'error', 'message': str(e)}), 500
# 
# @drive_bp.route('/pruebadrive', methods=['POST'])
# # @login_required  <-- Comenta esto con un # solo para la prueba
# def test_drive_upload():
#     """ Generar y subir una planilla de prueba para el Docente ID 1 """   
#     user_id = request.args.get('user_id', 1)
#     grupo_id = request.json.get('grupo_id', 1)
#     materia_id = request.json.get('materia_id', 1)
#     periodo_id = request.json.get('periodo_id', 1)
#     try:
#         file_id = generate_excel_template(user_id, grupo_id, materia_id, periodo_id)
#         return jsonify({'status': 'success', 'message': 'Planilla subida correctamente a Drive.', 'file_id': file_id})
#     except Exception as e:
#         return jsonify({'status': 'error', 'message': str(e)}), 500
