// js/auth.js
import { supabase } from './config.js';

// Utilidad para renderizar alertas en la interfaz
function mostrarAlerta(tipo, mensaje) {
  const box = document.getElementById('alert-box');
  const icon = document.getElementById('alert-icon');
  const msg = document.getElementById('alert-msg');

  if (!box || !msg) return;

  box.classList.remove('hidden', 'bg-red-50', 'text-red-800', 'border-red-200', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200');

  if (tipo === 'error') {
    box.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
    if (icon) icon.textContent = '✕';
  } else {
    box.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    if (icon) icon.textContent = '✓';
  }

  msg.textContent = mensaje;
}

// 1. Inicio de Sesión
export async function iniciarSesion(email, password) {
  const btn = document.getElementById('btn-submit');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  try {
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Verificando...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Correo o contraseña incorrectos. Verifique sus datos.');
      } else if (error.message.includes('Email not confirmed')) {
        throw new Error('El correo no ha sido confirmado en la base de datos.');
      }
      throw error;
    }

    mostrarAlerta('exito', 'Acceso concedido. Redirigiendo al panel...');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 800);

  } catch (err) {
    mostrarAlerta('error', err.message || 'Error al iniciar sesión.');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.textContent = 'Iniciar Sesión';
      if (btnSpinner) btnSpinner.classList.add('hidden');
    }
  }
}

// 2. Cierre de Sesión
export async function cerrarSesion() {
  try {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Error cerrando sesión:', err);
    window.location.href = 'login.html';
  }
}

// 3. Guardián de Ruta Protegida (Para invocar en dashboard.html)
export async function verificarSesionProtegida() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

// 4. Solicitar enlace de restablecimiento por correo
export async function solicitarRecuperacion(email) {
  const btn = document.getElementById('btn-solicitar');
  const btnText = document.getElementById('btn-solicitar-text');
  const btnSpinner = document.getElementById('btn-solicitar-spinner');

  try {
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Enviando...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');
    }

    // El enlace redirigirá al usuario directamente a la misma página para fijar su nueva clave
    const redirectTo = window.location.origin + window.location.pathname;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo
    });

    if (error) throw error;

    mostrarAlerta('exito', 'Se ha enviado un enlace de recuperación a su correo. Revise su bandeja de entrada o spam.');
    const form = document.getElementById('form-solicitar');
    if (form) form.reset();

  } catch (err) {
    mostrarAlerta('error', err.message || 'Error al solicitar recuperación.');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.textContent = 'Enviar Enlace de Recuperación';
      if (btnSpinner) btnSpinner.classList.add('hidden');
    }
  }
}

// 5. Actualizar la contraseña en Supabase
export async function actualizarContrasena(nuevaClave) {
  const btn = document.getElementById('btn-actualizar');
  const btnText = document.getElementById('btn-actualizar-text');
  const btnSpinner = document.getElementById('btn-actualizar-spinner');

  try {
    if (btn) {
      btn.disabled = true;
      if (btnText) btnText.textContent = 'Actualizando...';
      if (btnSpinner) btnSpinner.classList.remove('hidden');
    }

    const { error } = await supabase.auth.updateUser({
      password: nuevaClave
    });

    if (error) throw error;

    mostrarAlerta('exito', 'Contraseña actualizada con éxito. Redirigiendo al panel...');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (err) {
    mostrarAlerta('error', err.message || 'No se pudo actualizar la contraseña.');
  } finally {
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.textContent = 'Guardar Nueva Contraseña';
      if (btnSpinner) btnSpinner.classList.add('hidden');
    }
  }
}

// ==========================================
// DETECCIÓN DE EVENTOS SEGÚN LA PÁGINA ACTIVA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  
  // Handler en login.html
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Si ya existe sesión activa previa, llevar directo al dashboard
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.href = 'dashboard.html';
      return;
    }

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      iniciarSesion(email, pass);
    });
  }

  // Handler en recuperar.html
  const formSolicitar = document.getElementById('form-solicitar');
  const formActualizar = document.getElementById('form-actualizar');

  if (formSolicitar && formActualizar) {
    // Escuchar si Supabase detecta el token de recuperación en la URL
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && window.location.hash.includes('type=recovery'))) {
        formSolicitar.classList.add('hidden');
        formActualizar.classList.remove('hidden');
        const title = document.getElementById('panel-title');
        const desc = document.getElementById('panel-desc');
        if (title) title.textContent = 'Asignar Nueva Contraseña';
        if (desc) desc.textContent = 'Ingrese y confirme su nueva clave de acceso';
      }
    });

    formSolicitar.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('recovery-email').value;
      solicitarRecuperacion(email);
    });

    formActualizar.addEventListener('submit', (e) => {
      e.preventDefault();
      const p1 = document.getElementById('new-password').value;
      const p2 = document.getElementById('confirm-password').value;

      if (p1 !== p2) {
        mostrarAlerta('error', 'Las contraseñas no coinciden. Inténtelo nuevamente.');
        return;
      }
      actualizarContrasena(p1);
    });
  }
});