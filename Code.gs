/**
 * Backend de "Parking · Pagos" — Google Apps Script vinculado a una Google Sheet.
 * Lectura: abierta (GET). Escritura: solo con contraseña (POST), verificada aquí en el servidor.
 * Nada se borra: las eliminaciones marcan la fila como "anulado" y cada cambio queda en la hoja "Historial".
 */
const CLAVE_DEFECTO = '5113';
const H_PAGOS = 'Pagos', H_LOG = 'Historial';
const COLS = ['id', 'fecha', 'mes', 'importe', 'nota', 'estado', 'creado', 'modificado'];

// Funciona tanto si el script está vinculado a una hoja como si es independiente:
// en ese caso crea la hoja "Parking · Pagos" la primera vez y recuerda su ID.
function ss_() {
  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const nueva = SpreadsheetApp.create('Parking · Pagos');
  props.setProperty('SHEET_ID', nueva.getId());
  return nueva;
}

function hoja_(nombre, cab) {
  const ss = ss_();
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(cab);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, cab.length).setFontWeight('bold');
  }
  return h;
}

/** Ejecutar UNA vez a mano: crea las hojas e importa los datos históricos. */
function inicializar() {
  const h = hoja_(H_PAGOS, COLS);
  h.getRange('A:C').setNumberFormat('@');
  h.getRange('G:H').setNumberFormat('@');
  hoja_(H_LOG, ['cuando', 'accion', 'id', 'antes', 'despues']);
  if (h.getLastRow() < 2) {
    const ahora = new Date().toISOString();
    const filas = SEMILLA.map(s => [Utilities.getUuid().slice(0, 8), s[0], s[1], s[2], s[3], 'activo', ahora, ahora]);
    h.getRange(2, 1, filas.length, COLS.length).setValues(filas);
    log_('importación inicial', '', '', filas.length + ' pagos');
  }
  Logger.log('Hoja de datos: ' + ss_().getUrl());
}

function txt_(x) {
  return x instanceof Date ? Utilities.formatDate(x, 'Europe/Madrid', 'yyyy-MM-dd') : String(x);
}
function log_(accion, id, antes, despues) {
  hoja_(H_LOG, ['cuando', 'accion', 'id', 'antes', 'despues'])
    .appendRow([new Date().toISOString(), accion, id, antes, despues]);
}
function hash_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'parking:' + s));
}
function claveOk_(c) {
  const guardado = PropertiesService.getScriptProperties().getProperty('CLAVE_HASH');
  return hash_(String(c || '')) === (guardado || hash_(CLAVE_DEFECTO));
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function listar_() {
  const v = hoja_(H_PAGOS, COLS).getDataRange().getValues();
  v.shift();
  return v.filter(r => r[5] === 'activo').map(r => ({
    id: String(r[0]), fecha: txt_(r[1]), mes: txt_(r[2]).slice(0, 7),
    importe: Number(r[3]), nota: String(r[4] || '')
  }));
}
function validar_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '')) throw new Error('Fecha no válida');
  if (!/^\d{4}-\d{2}$/.test(d.mes || '')) throw new Error('Mes no válido');
  if (!(Number(d.importe) > 0)) throw new Error('Importe no válido');
  return [d.fecha, d.mes, Number(d.importe), String(d.nota || '').slice(0, 500)];
}
function fila_(h, id) {
  const v = h.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === id && v[i][5] === 'activo') return { n: i + 1, datos: v[i] };
  throw new Error('Pago no encontrado');
}

function doGet() {
  return json_({ ok: true, pagos: listar_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (!claveOk_(d.clave)) return json_({ ok: false, error: 'Contraseña incorrecta' });
    const h = hoja_(H_PAGOS, COLS);
    const ahora = new Date().toISOString();

    if (d.action === 'add') {
      const [fecha, mes, importe, nota] = validar_(d);
      const id = Utilities.getUuid().slice(0, 8);
      h.appendRow([id, fecha, mes, importe, nota, 'activo', ahora, ahora]);
      log_('alta', id, '', JSON.stringify({ fecha, mes, importe, nota }));
    } else if (d.action === 'update') {
      const f = fila_(h, String(d.id));
      const [fecha, mes, importe, nota] = validar_(d);
      h.getRange(f.n, 2, 1, 4).setValues([[fecha, mes, importe, nota]]);
      h.getRange(f.n, 8).setValue(ahora);
      log_('modificación', d.id,
        JSON.stringify({ fecha: txt_(f.datos[1]), mes: txt_(f.datos[2]), importe: f.datos[3], nota: f.datos[4] }),
        JSON.stringify({ fecha, mes, importe, nota }));
    } else if (d.action === 'delete') {
      const f = fila_(h, String(d.id));
      h.getRange(f.n, 6).setValue('anulado');
      h.getRange(f.n, 8).setValue(ahora);
      log_('anulación', d.id, JSON.stringify(f.datos.slice(1, 5)), '');
    } else if (d.action === 'cambiarClave') {
      if (String(d.nueva || '').length < 4) throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
      PropertiesService.getScriptProperties().setProperty('CLAVE_HASH', hash_(String(d.nueva)));
      log_('cambio de contraseña', '', '', '');
    } else {
      throw new Error('Acción desconocida');
    }
    return json_({ ok: true, pagos: listar_() });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// Datos importados del export (fecha de pago, mes cubierto, importe, nota)
const SEMILLA = [
  ['2025-04-01', '2025-04', 100, 'Sin saldo pendiente en el export original (Splitwise)'],
  ['2025-05-08', '2025-05', 100, 'Sin saldo pendiente en el export original (Splitwise)'],
  ['2025-06-14', '2025-06', 100, ''],
  ['2025-08-29', '2025-07', 100, 'Pagado junto con agosto (pago de 200 €)'],
  ['2025-08-29', '2025-08', 100, 'Pagado junto con julio (pago de 200 €)'],
  ['2025-09-07', '2025-09', 100, ''],
  ['2025-10-24', '2025-10', 100, ''],
  ['2025-11-21', '2025-11', 100, ''],
  ['2025-12-23', '2025-12', 100, ''],
  ['2026-01-03', '2026-01', 100, ''],
  ['2026-02-19', '2026-02', 100, ''],
  ['2026-03-11', '2026-03', 100, ''],
  ['2026-04-15', '2026-04', 100, ''],
  ['2026-05-13', '2026-05', 100, ''],
  ['2026-06-22', '2026-06', 100, ''],
  ['2026-07-16', '2026-07', 100, ''],
  ['2026-08-19', '2026-08', 100, ''],
  ['2026-09-08', '2026-09', 100, ''],
  ['2026-10-16', '2026-10', 100, ''],
  ['2026-10-31', '2026-11', 100, 'Pagado por adelantado']
];
