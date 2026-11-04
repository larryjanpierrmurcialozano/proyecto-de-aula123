-- PostgreSQL audit trigger for student deletion.
-- The estudiantes route sets app.user_id, app.ip and app.agent transaction-locally.
CREATE OR REPLACE FUNCTION log_estudiante_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_detalle_asistencia integer;
  v_asistencia integer;
  v_asistencias_periodo integer;
  v_justificantes integer;
  v_reportes integer;
  v_observador integer;
  v_notas integer;
  v_counts jsonb;
BEGIN
  v_counts := COALESCE(
    NULLIF(current_setting('app.student_delete_counts', true), '')::jsonb,
    '{}'::jsonb
  );
  SELECT
    COALESCE((v_counts ->> 'detalle_asistencia')::integer,
      (SELECT COUNT(*) FROM detalle_asistencia WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'asistencia')::integer,
      (SELECT COUNT(*) FROM asistencia WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'asistencias_por_periodo')::integer,
      (SELECT COUNT(*) FROM asistencias_por_periodo WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'justificantes_ausencia')::integer,
      (SELECT COUNT(*) FROM justificantes_ausencia WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'reportes_inasistencias')::integer,
      (SELECT COUNT(*) FROM reportes_inasistencias WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'observador')::integer,
      (SELECT COUNT(*) FROM observador WHERE id_estudiante = OLD.id_estudiante)),
    COALESCE((v_counts ->> 'notas')::integer,
      (SELECT COUNT(*) FROM notas WHERE id_estudiante = OLD.id_estudiante))
  INTO v_detalle_asistencia, v_asistencia, v_asistencias_periodo,
       v_justificantes, v_reportes, v_observador, v_notas;

  INSERT INTO log_registro (
    id_usuario, tipo_accion, tabla_afectada, registro_id, descripcion,
    ip_address, user_agent, timestamp_accion
  ) VALUES (
    NULLIF(current_setting('app.user_id', true), '')::integer,
    'DELETE', 'estudiantes', OLD.id_estudiante,
    CONCAT(
      'Eliminacion estudiante: ',
      'documento=', COALESCE(OLD.documento::text, ''),
      ', nombre=', COALESCE(OLD.nombre::text, ''),
      ', apellido=', COALESCE(OLD.apellido::text, ''),
      ', fecha_nacimiento=', COALESCE(to_char(OLD.fecha_nacimiento, 'YYYY-MM-DD'), ''),
      ', genero=', COALESCE(OLD.genero::text, ''),
      ', id_grupo=', COALESCE(OLD.id_grupo::text, '0'),
      ', acudiente_nombre=', COALESCE(OLD.acudiente_nombre::text, ''),
      ', acudiente_telefono=', COALESCE(OLD.acudiente_telefono::text, ''),
      ', correo=', COALESCE(OLD.correo::text, ''),
      ', direccion=', COALESCE(OLD.direccion::text, ''),
      ', estado=', COALESCE(OLD.estado::text, ''),
      ' | relaciones_borradas: ',
      'detalle_asistencia=', v_detalle_asistencia,
      ', asistencia=', v_asistencia,
      ', asistencias_por_periodo=', v_asistencias_periodo,
      ', justificantes_ausencia=', v_justificantes,
      ', reportes_inasistencias=', v_reportes,
      ', observador=', v_observador,
      ', notas=', v_notas
    ),
    left(NULLIF(current_setting('app.ip', true), ''), 45),
    left(NULLIF(current_setting('app.agent', true), ''), 255),
    CURRENT_TIMESTAMP
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_estudiantes_before_delete ON estudiantes;
CREATE TRIGGER trg_estudiantes_before_delete
BEFORE DELETE ON estudiantes
FOR EACH ROW EXECUTE FUNCTION log_estudiante_delete();
