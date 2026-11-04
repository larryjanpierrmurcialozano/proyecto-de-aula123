# 📧 Configuración del Sistema de Envío de Correos

## Requisitos

El sistema utiliza **Gmail SMTP** para enviar reportes por correo. Necesitas:
1. Una cuenta de Gmail
2. Una contraseña de aplicación (no la contraseña de Gmail normal)

---

## Pasos de Configuración

### 1️⃣ Habilitar Autenticación de 2 Pasos en Gmail

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. En el menú izquierdo, selecciona **Seguridad**
3. Habilita **Autenticación de dos pasos**

### 2️⃣ Generar Contraseña de Aplicación

1. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Si no lo ves, primero debes habilitar "Autenticación de 2 Pasos"
3. Selecciona:
   - **App**: Correo
   - **Dispositivo**: Windows (u otro que uses)
4. Google generará una contraseña de 16 caracteres
5. **Copia esa contraseña** (sin espacios)

### 3️⃣ Configurar el Archivo `.env`

Edita el archivo `backend/.env` y actualiza estas líneas:

```env
# Configuracion SMTP para envío de correos
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
EMAIL_CUENTA=tu_email@gmail.com
EMAIL_PASSWORD=contraseña_app_generada_sin_espacios
```

**Ejemplo:**
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
EMAIL_CUENTA=docstry@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
```
(Sin espacios en la contraseña)

---

## Prueba de Conexión

Ejecuta el backend normalmente:
```bash
python iniciador.py
```

El servidor debería iniciar sin errores. Cuando intentes enviar un reporte desde la interfaz, verificarás que funciona.

---

## 🔧 Solución de Problemas

### Error: "535-5.7.8 Username and Password not accepted"
- ✅ Verifica que la contraseña sea la **contraseña de aplicación** (no la contraseña de Gmail)
- ✅ Quita espacios de la contraseña si los tiene

### Error: "SMTPAuthenticationError"
- ✅ Verifica que la autenticación de 2 pasos está habilitada
- ✅ Verifica que la contraseña de aplicación es correcta

### El correo no se envía pero no hay error
- ✅ Revisa la consola de Flask para mensajes de error
- ✅ Verifica que el usuario esté autenticado en la aplicación

---

## 📝 Nota Importante

- Esta contraseña es **para la aplicación**, no para acceder a Gmail directamente
- No compartas este archivo `.env` públicamente
- Puedes generar múltiples contraseñas de aplicación para diferentes servicios

---

## Características del Sistema

✅ Envío a correo específico
✅ Envío masivo a todos los estudiantes de un grado
✅ Mensaje personalizable  
✅ HTML formateado automáticamente
✅ Registro de acción en logs
✅ Validación de correos
