// js/admin.js
import { supabase, BUCKET_NAME } from './config.js';
import { cerrarSesion, verificarSesionProtegida } from './auth.js';

let listaComunicadosCache = [];
let listaBitacoraCache = [];

// ==========================================
// 1. UTILIDADES Y OPTIMIZACIÓN DE ESPACIO
// ==========================================

// Notificaciones flotantes tipo Toast
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

// Reducción de peso y resolución en el cliente antes de subir a Supabase
function optimizarImagen(archivoOriginal, maxAncho = 1200, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    if (!archivoOriginal.type.startsWith('image/')) {
      return resolve(archivoOriginal);
    }

    const reader = new FileReader();
    reader.readAsDataURL(archivoOriginal);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxAncho) {
          height = Math.round((height * maxAncho) / width);
          width = maxAncho;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Fallo al comprimir la imagen.'));
            const archivoComprimido = new File([blob], archivoOriginal.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(archivoComprimido);
          },
          'image/jpeg',
          calidad
        );
      };
      img.onerror = () => reject(new Error('Error al decodificar la imagen.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
  });
}

// Subida al bucket Storage de Supabase
async function subirImagen(file) {
  if (!file) return null;

  const archivoLigero = await optimizarImagen(file, 1200, 0.75);
  const nombreLimpio = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
  const ruta = `public/${nombreLimpio}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(ruta, archivoLigero, {
      cacheControl: '31536000',
      upsert: false
    });

  if (error) {
    console.error('Error subiendo al Storage:', error);
    throw new Error('Fallo al subir el archivo al almacenamiento en la nube.');
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(ruta);

  return publicData.publicUrl;
}

// Eliminación de archivo huérfano en Storage
async function eliminarArchivoDeStorage(urlPublica) {
  if (!urlPublica) return;
  try {
    const partes = urlPublica.split(`${BUCKET_NAME}/`);
    if (partes.length > 1) {
      const rutaArchivo = decodeURIComponent(partes[1]);
      await supabase.storage.from(BUCKET_NAME).remove([rutaArchivo]);
    }
  } catch (err) {
    console.warn('Advertencia al remover archivo del bucket:', err);
  }
}

// ==========================================
// 2. MÓDULO CRUD: COMUNICADOS OFICIALES
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
  let imagenUrlActual = document.getElementById('comunicado-img-existente').value;

  const btnSubmit = document.getElementById('btn-submit-comunicado');
  const btnSpinner = document.getElementById('spin-submit-comunicado');
  const btnText = document.getElementById('txt-submit-comunicado');

  try {
    btnSubmit.disabled = true;
    btnSpinner.classList.remove('hidden');
    btnText.textContent = 'Procesando...';

    // Subir imagen optimizada si se seleccionó archivo
    if (fileInput.files.length > 0) {
      const nuevaUrl = await subirImagen(fileInput.files[0]);
      // Si ya tenía imagen previa en modo edición, eliminar la antigua del Storage
      if (id && imagenUrlActual) {
        await eliminarArchivoDeStorage(imagenUrlActual);
      }
      imagenUrlActual = nuevaUrl;
    }

    const payload = {
      titulo,
      categoria,
      emisor,
      contenido,
      imagen_url: imagenUrlActual || null
    };

    if (id) {
      const { error } = await supabase.from('comunicados').update(payload).eq('id', id);
      if (error) throw error;
      mostrarToast('exito', 'Aviso actualizado correctamente.');
    } else {
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
    const item = listaComunicadosCache.find(c => c.id === id);

    const { error } = await supabase.from('comunicados').delete().eq('id', id);
    if (error) throw error;

    if (item && item.imagen_url) {
      await eliminarArchivoDeStorage(item.imagen_url);
    }

    mostrarToast('exito', 'Comunicado e imagen eliminados.');
    cargarComunicados();
  } catch (err) {
    mostrarToast('error', err.message || 'No se pudo eliminar el comunicado.');
  }
}

// ==========================================
// 3. MÓDULO CRUD: BITÁCORA INSTITUCIONAL
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
  let imagenUrlActual = document.getElementById('bitacora-img-existente').value;

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
      const nuevaUrl = await subirImagen(fileInput.files[0]);
      if (id && imagenUrlActual) {
        await eliminarArchivoDeStorage(imagenUrlActual);
      }
      imagenUrlActual = nuevaUrl;
    }

    const payload = {
      titulo,
      fecha_evento: fechaEvento,
      resumen,
      contenido,
      imagen_url: imagenUrlActual
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
    const item = listaBitacoraCache.find(b => b.id === id);

    const { error } = await supabase.from('bitacora').delete().eq('id', id);
    if (error) throw error;

    if (item && item.imagen_url) {
      await eliminarArchivoDeStorage(item.imagen_url);
    }

    mostrarToast('exito', 'Nota e imagen eliminadas.');
    cargarBitacora();
  } catch (err) {
    mostrarToast('error', err.message || 'No se pudo eliminar la nota.');
  }
}

// ==========================================
// 4. INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verificación de credenciales activas
  const usuario = await verificarSesionProtegida();
  if (!usuario) return;

  const userDisplay = document.getElementById('user-display');
  if (userDisplay) userDisplay.textContent = usuario.email;

  const fechaBitacora = document.getElementById('bitacora-fecha');
  if (fechaBitacora) fechaBitacora.valueAsDate = new Date();

  // Control de pestañas (Tabs)
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

  // Previsualización y descarte de imágenes en formularios
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

  // Eventos de formularios y botones
  document.getElementById('form-comunicado').addEventListener('submit', guardarComunicado);
  document.getElementById('cancel-edit-comunicado').addEventListener('click', cancelarEdicionComunicado);
  document.getElementById('btn-refresh-comunicados').addEventListener('click', cargarComunicados);

  document.getElementById('form-bitacora').addEventListener('submit', guardarBitacora);
  document.getElementById('cancel-edit-bitacora').addEventListener('click', cancelarEdicionBitacora);
  document.getElementById('btn-refresh-bitacora').addEventListener('click', cargarBitacora);

  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

  // Sincronización inicial
  cargarComunicados();
  cargarBitacora();
});