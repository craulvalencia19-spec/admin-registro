// ============================================================
// CONFIGURACIÓN: datos de tu proyecto Firebase
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
    apiKey: "AIzaSyBlhfF_cdiVZ6Q8esIQNKLpit53ADxLTdA",
    authDomain: "registro-estudiantil-unicen-ia.firebaseapp.com",
    projectId: "registro-estudiantil-unicen-ia",
    storageBucket: "registro-estudiantil-unicen-ia.firebasestorage.app",
    messagingSenderId: "821501124316",
    appId: "1:821501124316:web:bfcaeda376f23bea36de19"
};

// ============================================================
// CORREO DE CONFIRMACIÓN (EmailJS). Déjalo así si no lo vas a usar todavía.
// ============================================================
export const EMAILJS = {
    serviceId: "PEGA_AQUI_SERVICE_ID",
    templateId: "PEGA_AQUI_TEMPLATE_ID",
    publicKey: "PEGA_AQUI_PUBLIC_KEY"
};

export const firebaseListo = !firebaseConfig.apiKey.startsWith("PEGA");
export const emailListo = !EMAILJS.publicKey.startsWith("PEGA");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);