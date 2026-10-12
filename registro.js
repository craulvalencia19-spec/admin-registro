import { db, firebaseListo, emailListo, EMAILJS } from './firebase-config.js';
import { doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const $ = (s) => document.querySelector(s);
const form = $('#reg-form');
const msg = $('#msg');
const btn = $('#btn-enviar');
const extras = $('#extras-externo');

const PREFIJO = { openhouse: 'OH', externo: 'EX' };
const ETIQUETA = { openhouse: 'Open House', externo: 'Estudiante externo' };

// El QR puede apuntar a registro.html?tipo=externo  y la tablet del evento a registro.html?tipo=openhouse
const tipoUrl = new URLSearchParams(location.search).get('tipo');
function aplicarTipoUrl() {
    if (tipoUrl === 'openhouse' || tipoUrl === 'externo') {
        form.querySelector(`input[name=tipo][value=${tipoUrl}]`).checked = true;
    }
}
aplicarTipoUrl();
const tipoActual = () => form.querySelector('input[name=tipo]:checked').value;
const syncTipo = () => { extras.hidden = tipoActual() !== 'externo'; };
form.querySelectorAll('input[name=tipo]').forEach((r) => r.addEventListener('change', syncTipo));
syncTipo();

function mostrarError(texto) {
    msg.textContent = texto;
    msg.hidden = !texto;
    if (texto) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const limpiar = (v) => String(v || '').trim().replace(/\s+/g, ' ');

function leerDatos() {
    const tipo = tipoActual();
    const d = {
        tipo,
        nombres: limpiar($('#nombres').value),
        apellidos: limpiar($('#apellidos').value),
        ci: limpiar($('#ci').value).toUpperCase().replace(/\s/g, ''),
        celular: limpiar($('#celular').value).replace(/[\s-]/g, ''),
        correo: limpiar($('#correo').value).toLowerCase(),
        ciudad: limpiar($('#ciudad').value),
        colegio: limpiar($('#colegio').value),
        curso: $('#curso').value
    };
    if (tipo === 'externo') {
        d.como = $('#como').value;
        d.interes = limpiar($('#interes').value).slice(0, 400);
    }
    return d;
}

function validar(d) {
    if (!d.nombres || !d.apellidos) return 'Escribe tus nombres y apellidos.';
    if (!/^[0-9A-Z-]{5,15}$/.test(d.ci)) return 'Revisa tu CI: usa solo números y letras (entre 5 y 15 caracteres).';
    if (!/^\+?[0-9]{7,15}$/.test(d.celular)) return 'Revisa tu número de celular.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return 'Escribe un correo válido (ej: tucorreo@gmail.com).';
    if (!d.ciudad || !d.colegio) return 'Completa tu ciudad y colegio de procedencia.';
    if (!d.curso) return 'Selecciona tu curso o situación actual.';
    if (d.tipo === 'externo' && !d.como) return 'Cuéntanos cómo te enteraste de la carrera.';
    if (!$('#acepto').checked) return 'Debes aceptar el uso de tus datos para registrarte.';
    return '';
}

// Genera N° de registro (global) y cupo (por tipo) de forma atómica, y guarda el registro
async function registrar(d) {
    const contRef = doc(db, 'contadores', 'main');
    const unicoRef = doc(db, 'unicos', `${d.tipo}_${d.ci}`);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(contRef);
        const c = snap.exists() ? snap.data() : { registro: 0, openhouse: 0, externo: 0 };
        const registro = (c.registro || 0) + 1;
        const secuencia = (c[d.tipo] || 0) + 1;
        const cupo = `${PREFIJO[d.tipo]}-${String(secuencia).padStart(4, '0')}`;

        tx.set(unicoRef, { registro });
        tx.set(contRef, {
            registro,
            openhouse: d.tipo === 'openhouse' ? secuencia : (c.openhouse || 0),
            externo: d.tipo === 'externo' ? secuencia : (c.externo || 0)
        });
        tx.set(doc(collection(db, 'registros'), String(registro).padStart(5, '0')), {
            ...d, registro, cupo, creado: serverTimestamp()
        });
        return { registro, cupo };
    });
}

async function enviarCorreo(d, r) {
    if (!emailListo || !window.emailjs) return 'sin-configurar';
    try {
        await window.emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
            to_email: d.correo,
            nombre: `${d.nombres} ${d.apellidos}`,
            cupo: r.cupo,
            registro: String(r.registro).padStart(5, '0'),
            tipo: ETIQUETA[d.tipo]
        }, { publicKey: EMAILJS.publicKey });
        return 'ok';
    } catch (e) {
        console.error('EmailJS:', e);
        return 'error';
    }
}

function mostrarComprobante(d, r, estadoCorreo) {
    $('#t-cupo').textContent = r.cupo;
    $('#t-registro').textContent = String(r.registro).padStart(5, '0');
    $('#t-quien').textContent = `${d.nombres} ${d.apellidos} · ${ETIQUETA[d.tipo]}`;
    $('#t-mail').textContent =
        estadoCorreo === 'ok' ? `Te enviamos la confirmación a ${d.correo}.` :
        estadoCorreo === 'error' ? 'No pudimos enviar el correo de confirmación. Guarda o toma captura de esta pantalla.' :
        'Guarda o toma captura de esta pantalla como comprobante.';
    $('#form-card').hidden = true;
    $('#ticket-card').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function textoError(e) {
    if (e && e.code === 'permission-denied') return 'No se pudo completar el registro. Es posible que este CI ya esté registrado como ese tipo de estudiante.';
    if (e && e.code === 'unavailable') return 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
    return 'Ocurrió un error al registrar. Inténtalo de nuevo en unos segundos.';
}

form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarError('');
    if (!firebaseListo) return mostrarError('Falta configurar Firebase en el archivo firebase-config.js');
    const d = leerDatos();
    const error = validar(d);
    if (error) return mostrarError(error);

    btn.disabled = true;
    btn.textContent = 'GENERANDO CUPO...';
    try {
        const r = await registrar(d);
        const estadoCorreo = await enviarCorreo(d, r);
        mostrarComprobante(d, r, estadoCorreo);
        form.reset();
        aplicarTipoUrl();
        syncTipo();
    } catch (e) {
        console.error(e);
        mostrarError(textoError(e));
    } finally {
        btn.disabled = false;
        btn.textContent = 'REGISTRARME';
    }
});

$('#btn-print').addEventListener('click', () => window.print());
$('#btn-otro').addEventListener('click', () => {
    $('#ticket-card').hidden = true;
    $('#form-card').hidden = false;
    window.scrollTo({ top: 0 });
});