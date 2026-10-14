// js/admin.js
import { supabase, BUCKET_NAME } from './config.js';
import { cerrarSesion, verificarSesionProtegida } from './auth.js';

let listaComunicadosCache = [];
let listaBitacoraCache = [];
let accionConfirmarEliminacion = null;

// ==========================================
// 1. UTILIDADES, TOAST Y MODAL DE CONFIRMACIÓN
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

function abrirModalEliminar(titulo, descripcion, callbackEliminar) {
  const modal = document.getElementById('modal-eliminar');
  const card = document.getElementById('modal-eliminar-card');
  const txtTitulo = document.getElementById('modal-eliminar-titulo');
  const txtDesc = document.getElementById('modal-eliminar-desc');

  txtTitulo.textContent = titulo;
  txtDesc.textContent = descripcion;
  accionConfirmarEliminacion = callbackEliminar;

  modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');

  setTimeout(() => {
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }, 10);
}

function cerrarModalEliminar() {
  const modal = document.getElementById('modal-eliminar');
  const card = document.getElementById('modal-eliminar-card');

  card.classList.remove('scale-100');
  card.classList.add('scale-95');

  modal.classList.remove('opacity-100', 'pointer-events-auto');
  modal.classList.add('opacity-0', 'pointer-events-none');

  setTimeout(() => {
    modal.classList.add('hidden');
    accionConfirmarEliminacion = null;
    const spinner = document.getElementById('spin-confirmar-eliminar');
    const txt = document.getElementById('txt-confirmar-eliminar');
    const btn = document.getElementById('btn-confirmar-eliminar');
    if (spinner) spinner.classList.add('hidden');
    if (txt) txt.textContent = 'Eliminar';
    if (btn) btn.disabled = false;
  }, 250);
}

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
      .order('fijado', { ascending: false })
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
    const borderClass = item.fijado ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white';
    card.className = `border ${borderClass} rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition`;

    let badgeClass = 'bg-blue-100 text-blue-900';
    if (item.categoria === 'Primaria') badgeClass = 'bg-emerald-100 text-emerald-900';
    if (item.categoria === 'Media General') badgeClass = 'bg-indigo-100 text-indigo-900';

    const fecha = new Date(item.created_at).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const pinBadge = item.fijado
      ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">📌 Fijado</span>`
      : '';

    const miniaturaHTML = item.imagen_url
      ? `<img src="${item.imagen_url}" alt="Foto" class="w-14 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0">`
      : `<div class="w-14 h-14 bg-slate-100 text-slate-400 flex items-center justify-center rounded-lg text-[10px] font-semibold flex-shrink-0">Sin Foto</div>`;

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1">
        ${miniaturaHTML}
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            ${pinBadge}
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
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      abrirModalEliminar(
        '¿Eliminar comunicado oficial?',
        'Esta acción retirará el aviso de la cartelera pública y liberará el espacio de almacenamiento.',
        () => ejecutarEliminarComunicado(id)
      );
    });
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
  document.getElementById('comunicado-fijado').checked = Boolean(item.fijado);

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
  document.getElementById('comunicado-fijado').checked = false;
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
  const fijado = document.getElementById('comunicado-fijado').checked;
  let imagenUrlActual = document.getElementById('comunicado-img-existente').value;

  // Validación de límite de 3 avisos fijados
  if (fijado) {
    const fijadosPrevios = listaComunicadosCache.filter(c => c.fijado && c.id !== id).length;
    if (fijadosPrevios >= 3) {
      mostrarToast('error', 'Límite alcanzado: Ya existen 3 comunicados fijados. Desmarca uno para fijar este.');
      return;
    }
  }

  const btnSubmit = document.getElementById('btn-submit-comunicado');
  const btnSpinner = document.getElementById('spin-submit-comunicado');
  const btnText = document.getElementById('txt-submit-comunicado');

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
      categoria,
      emisor,
      contenido,
      imagen_url: imagenUrlActual || null,
      fijado: fijado
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

async function ejecutarEliminarComunicado(id) {
  try {
    const item = listaComunicadosCache.find(c => c.id === id);

    const { error } = await supabase.from('comunicados').delete().eq('id', id);
    if (error) throw error;

    if (item && item.imagen_url) {
      await eliminarArchivoDeStorage(item.imagen_url);
    }

    cerrarModalEliminar();
    mostrarToast('exito', 'Comunicado e imagen eliminados.');
    cargarComunicados();
  } catch (err) {
    cerrarModalEliminar();
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
      .order('fijado', { ascending: false })
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
    const borderClass = item.fijado ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white';
    card.className = `border ${borderClass} rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition`;

    const fecha = item.fecha_evento ? new Date(item.fecha_evento + 'T00:00:00').toLocaleDateString('es-VE', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : 'Fecha no especificada';

    const pinBadge = item.fijado
      ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">📌 Fijado</span>`
      : '';

    card.innerHTML = `
      <div class="flex items-start gap-3 flex-1">
        <img src="${item.imagen_url}" alt="Foto bitácora" class="w-16 h-16 object-cover rounded-lg border border-slate-200 flex-shrink-0">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            ${pinBadge}
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
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      abrirModalEliminar(
        '¿Eliminar nota de la bitácora?',
        'Esta acción borrará la crónica institucional y la fotografía alojada en la nube.',
        () => ejecutarEliminarBitacora(id)
      );
    });
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
  document.getElementById('bitacora-fijado').checked = Boolean(item.fijado);

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
  document.getElementById('bitacora-fijado').checked = false;
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
  const fijado = document.getElementById('bitacora-fijado').checked;
  let imagenUrlActual = document.getElementById('bitacora-img-existente').value;

  if (!id && fileInput.files.length === 0) {
    mostrarToast('error', 'La fotografía es obligatoria para las entradas de bitácora.');
    return;
  }

  // Validación de límite de 3 notas fijadas
  if (fijado) {
    const fijadasPrevias = listaBitacoraCache.filter(b => b.fijado && b.id !== id).length;
    if (fijadasPrevias >= 3) {
      mostrarToast('error', 'Límite alcanzado: Ya existen 3 notas fijadas en bitácora. Desmarca una para fijar esta.');
      return;
    }
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
      imagen_url: imagenUrlActual,
      fijado: fijado
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

async function ejecutarEliminarBitacora(id) {
  try {
    const item = listaBitacoraCache.find(b => b.id === id);

    const { error } = await supabase.from('bitacora').delete().eq('id', id);
    if (error) throw error;

    if (item && item.imagen_url) {
      await eliminarArchivoDeStorage(item.imagen_url);
    }

    cerrarModalEliminar();
    mostrarToast('exito', 'Nota e imagen eliminadas.');
    cargarBitacora();
  } catch (err) {
    cerrarModalEliminar();
    mostrarToast('error', err.message || 'No se pudo eliminar la nota.');
  }
}

// ==========================================
// 4. INICIALIZACIÓN Y EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await verificarSesionProtegida();
  if (!usuario) return;

  const userDisplay = document.getElementById('user-display');
  if (userDisplay) userDisplay.textContent = usuario.email;

  const fechaBitacora = document.getElementById('bitacora-fecha');
  if (fechaBitacora) fechaBitacora.valueAsDate = new Date();

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

  document.getElementById('btn-cancelar-eliminar').addEventListener('click', cerrarModalEliminar);
  document.getElementById('modal-eliminar-backdrop').addEventListener('click', cerrarModalEliminar);
  
  document.getElementById('btn-confirmar-eliminar').addEventListener('click', async () => {
    if (typeof accionConfirmarEliminacion === 'function') {
      const btn = document.getElementById('btn-confirmar-eliminar');
      const spinner = document.getElementById('spin-confirmar-eliminar');
      const txt = document.getElementById('txt-confirmar-eliminar');
      btn.disabled = true;
      spinner.classList.remove('hidden');
      txt.textContent = 'Borrando...';
      await accionConfirmarEliminacion();
    }
  });

  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-eliminar');
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      cerrarModalEliminar();
    }
  });

  document.getElementById('form-comunicado').addEventListener('submit', guardarComunicado);
  document.getElementById('cancel-edit-comunicado').addEventListener('click', cancelarEdicionComunicado);
  document.getElementById('btn-refresh-comunicados').addEventListener('click', cargarComunicados);

  document.getElementById('form-bitacora').addEventListener('submit', guardarBitacora);
  document.getElementById('cancel-edit-bitacora').addEventListener('click', cancelarEdicionBitacora);
  document.getElementById('btn-refresh-bitacora').addEventListener('click', cargarBitacora);

  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

  cargarComunicados();
  cargarBitacora();
});