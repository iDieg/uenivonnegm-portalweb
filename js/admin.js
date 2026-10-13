// js/admin.js
import { supabase, BUCKET_NAME } from './config.js';
import { cerrarSesion, verificarSesionProtegida } from './auth.js';

let listaComunicadosCache = [];
let listaBitacoraCache = [];

// ==========================================
// UTILIDADES: TOAST NOTIFICATIONS & PREVIEWS
// ==========================================
function mostrarToast(tipo, mensaje) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msg = document.getElementById('toast-msg');

  if (!toast || !msg) return;

  toast.classList.remove('hidden', 'bg-red-50', 'text-red-900', 'border-red-200', 'bg-emerald-50', 'text-emerald-900', 'border-emerald-200');

  if (tipo === 'error') {
    toast.classList.add('bg-red-50', 'text-red-900', 'border-red-200');
    if (icon) icon.textContent = '✕';
  } else {
    toast.classList.add('bg-emerald-50', 'text-emerald-900', 'border-emerald-200');
    if (icon) icon.textContent = '✓';
  }

  msg.textContent = mensaje;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Subida de imagen al bucket Supabase Storage
async function subirImagen(file) {
  if (!file) return null;

  // Sanitización y nombre único con timestamp
  const extension = file.name.split('.').pop();
  const nombreLimpio = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  const ruta = `public/${nombreLimpio}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(ruta, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error subiendo archivo a Supabase Storage:', error);
    throw new Error('Fallo al subir la imagen al servidor de almacenamiento.');
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(ruta);

  return publicData.publicUrl;
}

// ==========================================
// SECCIÓN 1: CRUD COMUNICADOS
// ==========================================
async function cargarComunicados() {
  const contenedor = document.getElementById('lista-comunicados');
  const badgeCount = document.getElementById('badge-count-comunicados');

  try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    listaComunicadosCache = data || [];
    if (badgeCount) badgeCount.textContent = listaComunicadosCache.length;
    renderizarListaComunicados(listaComunicadosCache);
  } catch (err) {
    mostrarToast('error', err.message || 'Error cargando comunicados.');
    contenedor.innerHTML = '<div class="text-center py-6 text-red-500 text-xs">Error al sincronizar avisos.</div>';
  }
}

function renderizarListaComunicados(lista) {
  const contenedor = document.getElementById('lista-comunicados');
  contenedor.innerHTML = '';

  if (lista.length === 0) {
    contenedor.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">No hay avisos registrados en cartelera.</div>';
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white hover:bg-slate-50 transition shadow-sm';

    let badgeClass = 'bg-blue-100 text-blue-900';
    if (item.categoria === 'Primaria') badgeClass = 'bg-emerald-100 text-emerald-900';
    if (item.categoria === 'Media General') badgeClass = 'bg-indigo-100 text-indigo-900';

    const fecha = new Date(item.created_at).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const miniaturaHTML = item.imagen_url
      ? `<img src="${item.imagen_url}" alt="Foto" class="w-14 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0">`
      : `<div class="w-14 h-14 bg-slate-100 text-slate-400 flex items-center justify-center rounded-lg text-[10px] font-semibold flex-shrink-0">Sin Foto</div>`;

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1">
        ${miniaturaHTML}
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="${badgeClass} text-[10px] font-bold px-2 py-0.5 rounded">${item.categoria}</span>
            <span class="text-[11px] text-slate-400">${fecha}</span>
          </div>
          <h3 class="font-bold text-sm text-slate-900">${item.titulo}</h3>
          <p class="text-[11px] text-slate-500 line-clamp-2">${item.contenido}</p>
          <span class="text-[10px] text-slate-400 font-medium block">Emite: ${item.emisor}</span>
        </div>
      </div>
      <div class="flex sm:flex-col gap-2 w-full sm:w-auto justify-end">
        <button class="btn-edit-comunicado bg-slate-100 hover:bg-blue-50 text-blue-900 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition" data-id="${item.id}">
          Editar
        </button>
        <button class="btn-del-comunicado bg-slate-100 hover:bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition" data-id="${item.id}">
          Eliminar
        </button>
      </div>
    `;

    contenedor.appendChild(card);
  });

  // Event Listeners dinámicos
  document.querySelectorAll('.btn-edit-comunicado').forEach(btn => {
    btn.addEventListener('click', () => prepararEdicionComunicado(btn.getAttribute('data-id')));
  });

  document.querySelectorAll('.btn-del-comunicado').forEach(btn => {
    btn.addEventListener('click', () => eliminarComunicado(btn.getAttribute('data-id')));
  });
}

function prepararEdicionComunicado(id) {
  const item = listaComunicadosCache.find(c => c.id === id);
  if (!item) return;

  document.getElementById('comunicado-id').value = item.id;
  document.getElementById('comunicado-titulo').value = item.titulo;
  document.getElementById('comunicado-categoria').value = item.categoria;
  document.getElementById('comunicado-emisor').value = item.emisor;
  document.getElementById('comunicado-contenido').value = item.contenido;
  document.getElementById('comunicado-img-existente').value = item.imagen_url || '';

  const previewContainer = document.getElementById('comunicado-preview-container');
  const preview = document.getElementById('comunicado-preview');

  if (item.imagen_url) {
    preview.src = item.imagen_url;
    previewContainer.classList.remove('hidden');
  } else {
    previewContainer.classList.add('hidden');
  }

  document.getElementById('comunicado-form-title').textContent = 'Editar Aviso';
  document.getElementById('txt-submit-comunicado').textContent = 'Guardar Cambios';
  document.getElementById('cancel-edit-comunicado').classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionComunicado() {
  document.getElementById('form-comunicado').reset();
  document.getElementById('comunicado-id').value = '';
  document.getElementById('comunicado-img-existente').value = '';
  document.getElementById('comunicado-preview-container').classList.add('hidden');

  document.getElementById('comunicado-form-title').textContent = 'Nuevo Aviso Oficial';
  document.getElementById('txt-submit-comunicado').textContent = 'Publicar en Cartelera';
  document.getElementById('cancel-edit-comunicado').classList.add('hidden');
}

async function guardarComunicado(e) {
  e.preventDefault();

  const id = document.getElementById('comunicado-id').value;
  const titulo = document.getElementById('comunicado-titulo').value.trim();
  const categoria = document.getElementById('comunicado-categoria').value;
  const emisor = document.getElementById('comunicado-emisor').value.trim();
  const contenido = document.getElementById('comunicado-contenido').value.trim();
  const fileInput = document.getElementById('comunicado-file');
  let imagenUrl = document.getElementById('comunicado-img-existente').value;

  const btnSubmit = document.getElementById('btn-submit-comunicado');
  const btnSpinner = document.getElementById('spin-submit-comunicado');
  const btnText = document.getElementById('txt-submit-comunicado');

  try {
    btnSubmit.disabled = true;
    btnSpinner.classList.remove('hidden');
    btnText.textContent = 'Procesando...';

    // Subir nueva foto si fue seleccionada
    if (fileInput.files.length > 0) {
      imagenUrl = await subirImagen(fileInput.files[0]);
    }

    const payload = {
      titulo,
      categoria,
      emisor,
      contenido,
      imagen_url: imagenUrl || null
    };

    if (id) {
      // UPDATE
      const { error } = await supabase.from('comunicados').update(payload).eq('id', id);
      if (error) throw error;
      mostrarToast('exito', 'Aviso actualizado correctamente.');
    } else {
      // INSERT
      const { error } = await supabase.from('comunicados').insert([payload]);
      if (error) throw error;
      mostrarToast('exito', 'Nuevo aviso publicado en cartelera.');
    }

    cancelarEdicionComunicado();
    cargarComunicados();

  } catch (err) {
    mostrarToast('error', err.message || 'Error guardando aviso.');
  } finally {
    btnSubmit.disabled = false;
    btnSpinner.classList.add('hidden');
    btnText.textContent = id ? 'Guardar Cambios' : 'Publicar en Cartelera';
  }
}

async function eliminarComunicado(id) {
  if (!confirm('¿Confirma que desea eliminar este comunicado oficial?')) return;

  try {
    const { error } = await supabase.from('comunicados').delete().eq('id', id);
    if (error) throw error;
    mostrarToast('exito', 'Comunicado eliminado.');
    cargarComunicados();
  } catch (err) {
    mostrarToast('error', err.message || 'No se pudo eliminar el comunicado.');
  }
}

// ==========================================
// SECCIÓN 2: CRUD BITÁCORA
// ==========================================
async function cargarBitacora() {
  const contenedor = document.getElementById('lista-bitacora');
  const badgeCount = document.getElementById('badge-count-bitacora');

  try {
    const { data, error } = await supabase
      .from('bitacora')
      .select('*')
      .order('fecha_evento', { ascending: false });

    if (error) throw error;

    listaBitacoraCache = data || [];
    if (badgeCount) badgeCount.textContent = listaBitacoraCache.length;
    renderizarListaBitacora(listaBitacoraCache);
  } catch (err) {
    mostrarToast('error', err.message || 'Error cargando la bitácora.');
    contenedor.innerHTML = '<div class="text-center py-6 text-red-500 text-xs">Error al sincronizar bitácora.</div>';
  }
}

function renderizarListaBitacora(lista) {
  const contenedor = document.getElementById('lista-bitacora');
  contenedor.innerHTML = '';

  if (lista.length === 0) {
    contenedor.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">No hay notas publicadas en la bitácora escolar.</div>';
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white hover:bg-slate-50 transition shadow-sm';

    const fecha = item.fecha_evento ? new Date(item.fecha_evento + 'T00:00:00').toLocaleDateString('es-VE', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : 'Fecha no especificada';

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1">
        <img src="${item.imagen_url}" alt="Foto bitácora" class="w-16 h-16 object-cover rounded-lg border border-slate-200 flex-shrink-0">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">Nota Institucional</span>
            <span class="text-[11px] text-slate-400">${fecha}</span>
          </div>
          <h3 class="font-bold text-sm text-slate-900">${item.titulo}</h3>
          <p class="text-[11px] text-slate-500 line-clamp-2">${item.resumen}</p>
        </div>
      </div>
      <div class="flex sm:flex-col gap-2 w-full sm:w-auto justify-end">
        <button class="btn-edit-bitacora bg-slate-100 hover:bg-amber-50 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition" data-id="${item.id}">
          Editar
        </button>
        <button class="btn-del-bitacora bg-slate-100 hover:bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition" data-id="${item.id}">
          Eliminar
        </button>
      </div>
    `;

    contenedor.appendChild(card);
  });

  document.querySelectorAll('.btn-edit-bitacora').forEach(btn => {
    btn.addEventListener('click', () => prepararEdicionBitacora(btn.getAttribute('data-id')));
  });

  document.querySelectorAll('.btn-del-bitacora').forEach(btn => {
    btn.addEventListener('click', () => eliminarBitacora(btn.getAttribute('data-id')));
  });
}

function prepararEdicionBitacora(id) {
  const item = listaBitacoraCache.find(b => b.id === id);
  if (!item) return;

  document.getElementById('bitacora-id').value = item.id;
  document.getElementById('bitacora-titulo').value = item.titulo;
  document.getElementById('bitacora-fecha').value = item.fecha_evento;
  document.getElementById('bitacora-resumen').value = item.resumen;
  document.getElementById('bitacora-contenido').value = item.contenido;
  document.getElementById('bitacora-img-existente').value = item.imagen_url;

  const previewContainer = document.getElementById('bitacora-preview-container');
  const preview = document.getElementById('bitacora-preview');
  preview.src = item.imagen_url;
  previewContainer.classList.remove('hidden');

  document.getElementById('bitacora-form-title').textContent = 'Editar Entrada';
  document.getElementById('txt-submit-bitacora').textContent = 'Guardar Cambios';
  document.getElementById('cancel-edit-bitacora').classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicionBitacora() {
  document.getElementById('form-bitacora').reset();
  document.getElementById('bitacora-id').value = '';
  document.getElementById('bitacora-img-existente').value = '';
  document.getElementById('bitacora-preview-container').classList.add('hidden');
  document.getElementById('bitacora-fecha').valueAsDate = new Date();

  document.getElementById('bitacora-form-title').textContent = 'Nueva Entrada en Bitácora';
  document.getElementById('txt-submit-bitacora').textContent = 'Guardar en Bitácora';
  document.getElementById('cancel-edit-bitacora').classList.add('hidden');
}

async function guardarBitacora(e) {
  e.preventDefault();

  const id = document.getElementById('bitacora-id').value;
  const titulo = document.getElementById('bitacora-titulo').value.trim();
  const fechaEvento = document.getElementById('bitacora-fecha').value;
  const resumen = document.getElementById('bitacora-resumen').value.trim();
  const contenido = document.getElementById('bitacora-contenido').value.trim();
  const fileInput = document.getElementById('bitacora-file');
  let imagenUrl = document.getElementById('bitacora-img-existente').value;

  if (!id && fileInput.files.length === 0) {
    mostrarToast('error', 'La fotografía es obligatoria para las entradas de bitácora.');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-bitacora');
  const btnSpinner = document.getElementById('spin-submit-bitacora');
  const btnText = document.getElementById('txt-submit-bitacora');

  try {
    btnSubmit.disabled = true;
    btnSpinner.classList.remove('hidden');
    btnText.textContent = 'Procesando...';

    if (fileInput.files.length > 0) {
      imagenUrl = await subirImagen(fileInput.files[0]);
    }

    const payload = {
      titulo,
      fecha_evento: fechaEvento,
      resumen,
      contenido,
      imagen_url: imagenUrl
    };

    if (id) {
      const { error } = await supabase.from('bitacora').update(payload).eq('id', id);
      if (error) throw error;
      mostrarToast('exito', 'Entrada de bitácora actualizada.');
    } else {
      const { error } = await supabase.from('bitacora').insert([payload]);
      if (error) throw error;
      mostrarToast('exito', 'Nueva nota registrada en bitácora.');
    }

    cancelarEdicionBitacora();
    cargarBitacora();

  } catch (err) {
    mostrarToast('error', err.message || 'Error guardando en bitácora.');
  } finally {
    btnSubmit.disabled = false;
    btnSpinner.classList.add('hidden');
    btnText.textContent = id ? 'Guardar Cambios' : 'Guardar en Bitácora';
  }
}

async function eliminarBitacora(id) {
  if (!confirm('¿Confirma que desea eliminar esta nota de la bitácora escolar?')) return;

  try {
    const { error } = await supabase.from('bitacora').delete().eq('id', id);
    if (error) throw error;
    mostrarToast('exito', 'Nota eliminada.');
    cargarBitacora();
  } catch (err) {
    mostrarToast('error', err.message || 'No se pudo eliminar la nota.');
  }
}

// ==========================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guardián de seguridad: Redirigir a login si no hay sesión
  const usuario = await verificarSesionProtegida();
  if (!usuario) return;

  const userDisplay = document.getElementById('user-display');
  if (userDisplay) userDisplay.textContent = usuario.email;

  // Fecha por defecto hoy para bitácora
  const fechaBitacora = document.getElementById('bitacora-fecha');
  if (fechaBitacora) fechaBitacora.valueAsDate = new Date();

  // 2. Control de Pestañas (Tabs)
  const tabComunicadosBtn = document.getElementById('tab-comunicados-btn');
  const tabBitacoraBtn = document.getElementById('tab-bitacora-btn');
  const tabComunicados = document.getElementById('tab-comunicados');
  const tabBitacora = document.getElementById('tab-bitacora');

  tabComunicadosBtn.addEventListener('click', () => {
    tabComunicados.classList.remove('hidden');
    tabBitacora.classList.add('hidden');
    tabComunicadosBtn.className = 'tab-btn pb-3 px-3 text-blue-900 border-b-2 border-blue-900 flex items-center gap-2 transition font-bold';
    tabBitacoraBtn.className = 'tab-btn pb-3 px-3 text-slate-500 hover:text-slate-800 border-b-2 border-transparent flex items-center gap-2 transition font-bold';
  });

  tabBitacoraBtn.addEventListener('click', () => {
    tabBitacora.classList.remove('hidden');
    tabComunicados.classList.add('hidden');
    tabBitacoraBtn.className = 'tab-btn pb-3 px-3 text-amber-800 border-b-2 border-amber-800 flex items-center gap-2 transition font-bold';
    tabComunicadosBtn.className = 'tab-btn pb-3 px-3 text-slate-500 hover:text-slate-800 border-b-2 border-transparent flex items-center gap-2 transition font-bold';
  });

  // 3. Previsualizadores de archivos seleccionados
  const fileComunicado = document.getElementById('comunicado-file');
  const previewContainerCom = document.getElementById('comunicado-preview-container');
  const previewCom = document.getElementById('comunicado-preview');

  fileComunicado.addEventListener('change', () => {
    if (fileComunicado.files && fileComunicado.files[0]) {
      previewCom.src = URL.createObjectURL(fileComunicado.files[0]);
      previewContainerCom.classList.remove('hidden');
    }
  });

  document.getElementById('btn-remove-comunicado-img').addEventListener('click', () => {
    fileComunicado.value = '';
    document.getElementById('comunicado-img-existente').value = '';
    previewContainerCom.classList.add('hidden');
  });

  const fileBitacora = document.getElementById('bitacora-file');
  const previewContainerBit = document.getElementById('bitacora-preview-container');
  const previewBit = document.getElementById('bitacora-preview');

  fileBitacora.addEventListener('change', () => {
    if (fileBitacora.files && fileBitacora.files[0]) {
      previewBit.src = URL.createObjectURL(fileBitacora.files[0]);
      previewContainerBit.classList.remove('hidden');
    }
  });

  document.getElementById('btn-remove-bitacora-img').addEventListener('click', () => {
    fileBitacora.value = '';
    document.getElementById('bitacora-img-existente').value = '';
    previewContainerBit.classList.add('hidden');
  });

  // 4. Submit Forms y Botones de Cancelar
  document.getElementById('form-comunicado').addEventListener('submit', guardarComunicado);
  document.getElementById('cancel-edit-comunicado').addEventListener('click', cancelarEdicionComunicado);
  document.getElementById('btn-refresh-comunicados').addEventListener('click', cargarComunicados);

  document.getElementById('form-bitacora').addEventListener('submit', guardarBitacora);
  document.getElementById('cancel-edit-bitacora').addEventListener('click', cancelarEdicionBitacora);
  document.getElementById('btn-refresh-bitacora').addEventListener('click', cargarBitacora);

  // 5. Cerrar sesión
  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

  // 6. Carga inicial de datos
  cargarComunicados();
  cargarBitacora();
});