import { db, auth, firebaseListo } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const $ = (s) => document.querySelector(s);
const COLUMNAS_BASE = [
    ['registro', 'N° REGISTRO'], ['cupo', 'CUPO'], ['nombres', 'NOMBRES'], ['apellidos', 'APELLIDOS'],
    ['ci', 'CI'], ['celular', 'CELULAR'], ['correo', 'CORREO'], ['ciudad', 'CIUDAD'],
    ['colegio', 'COLEGIO'], ['curso', 'CURSO']
];
const COLUMNAS = {
    openhouse: [...COLUMNAS_BASE, ['fecha', 'FECHA']],
    externo: [...COLUMNAS_BASE, ['como', '¿CÓMO SE ENTERÓ?'], ['interes', 'QUÉ QUIERE SABER'], ['fecha', 'FECHA']]
};

let registros = [];
let tabActual = 'openhouse';
let cancelarSnapshot = null;

const formatoFecha = (d) => (d.creado && d.creado.toDate) ? d.creado.toDate().toLocaleString('es-BO') : '';
const valor = (d, k) => k === 'fecha' ? formatoFecha(d) : k === 'registro' ? String(d.registro || '').padStart(5, '0') : (d[k] ?? '');

function mostrarMsg(el, texto) { el.textContent = texto; el.hidden = !texto; }

// ---------- LOGIN ----------
$('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lmsg = $('#l-msg');
    mostrarMsg(lmsg, '');
    if (!firebaseListo) return mostrarMsg(lmsg, 'Falta configurar Firebase en firebase-config.js');
    $('#l-btn').disabled = true;
    try {
        await signInWithEmailAndPassword(auth, $('#l-correo').value.trim(), $('#l-pass').value);
    } catch (err) {
        mostrarMsg(lmsg, 'Correo o contraseña incorrectos.');
    } finally { $('#l-btn').disabled = false; }
});
$('#btn-salir').addEventListener('click', () => signOut(auth));

if (firebaseListo) {
    onAuthStateChanged(auth, (user) => {
        if (user) iniciarPanel(); else cerrarPanel();
    });
}

function iniciarPanel() {
    $('#login-card').hidden = true;
    $('#panel').hidden = false;
    $('#btn-salir').hidden = false;
    $('#wrap').classList.add('wide');
    mostrarMsg($('#p-msg'), '');
    const q = query(collection(db, 'registros'), orderBy('registro', 'desc'));
    cancelarSnapshot = onSnapshot(q, (snap) => {
        registros = snap.docs.map((d) => d.data());
        render();
    }, (err) => {
        console.error(err);
        mostrarMsg($('#p-msg'), err.code === 'permission-denied'
            ? 'Esta cuenta no tiene permiso de administrador (revisa el correo en firestore.rules).'
            : 'No se pudieron cargar los registros.');
    });
}

function cerrarPanel() {
    if (cancelarSnapshot) { cancelarSnapshot(); cancelarSnapshot = null; }
    registros = [];
    $('#login-card').hidden = false;
    $('#panel').hidden = true;
    $('#btn-salir').hidden = true;
    $('#wrap').classList.remove('wide');
    $('#l-pass').value = '';
}

// ---------- TABLA ----------
function filtrados() {
    const t = $('#buscar').value.trim().toLowerCase();
    return registros.filter((r) => r.tipo === tabActual).filter((r) =>
        !t || COLUMNAS[tabActual].some(([k]) => String(valor(r, k)).toLowerCase().includes(t)));
}

function render() {
    const oh = registros.filter((r) => r.tipo === 'openhouse').length;
    const ex = registros.filter((r) => r.tipo === 'externo').length;
    $('#s-total').textContent = registros.length;
    $('#s-oh').textContent = oh;
    $('#s-ex').textContent = ex;
    $('#tab-oh').textContent = `OPEN HOUSE (${oh})`;
    $('#tab-ex').textContent = `EXTERNOS (QR / DIGITAL) (${ex})`;

    const tabla = $('#tabla');
    tabla.replaceChildren();
    const cols = COLUMNAS[tabActual];
    const thead = tabla.createTHead().insertRow();
    cols.forEach(([, titulo]) => { const th = document.createElement('th'); th.textContent = titulo; thead.appendChild(th); });

    const datos = filtrados();
    const tbody = tabla.createTBody();
    if (!datos.length) {
        const td = tbody.insertRow().insertCell();
        td.colSpan = cols.length; td.className = 'empty'; td.textContent = 'No hay registros para mostrar.';
        return;
    }
    datos.forEach((r) => {
        const tr = tbody.insertRow();
        cols.forEach(([k]) => {
            const td = tr.insertCell();
            td.textContent = valor(r, k);   // textContent: evita inyección de HTML
            if (k === 'cupo') td.className = 'cupo-cell';
            if (k === 'registro') td.className = 'reg-cell';
            if (k === 'interes') td.classList.add('wrapcell');
        });
    });
}

document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tabActual = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
    render();
}));
$('#buscar').addEventListener('input', render);

// ---------- CSV ----------
function celdaCsv(v) {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;      // evita fórmulas al abrir en Excel
    return '"' + t.replace(/"/g, '""') + '"';
}
$('#btn-csv').addEventListener('click', () => {
    const cols = COLUMNAS[tabActual];
    const filas = [cols.map(([, t]) => celdaCsv(t)).join(',')];
    filtrados().forEach((r) => filas.push(cols.map(([k]) => celdaCsv(valor(r, k))).join(',')));
    const blob = new Blob(['\ufeff' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `registros_${tabActual}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
});