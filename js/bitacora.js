// js/bitacora.js
import { supabase } from './config.js';

let notasBitacora = [];

// Elementos de la modal de detalle
const grid = document.getElementById('bitacora-grid');
const contador = document.getElementById('contador-entradas');
const modal = document.getElementById('modal-detalle');
const modalImg = document.getElementById('modal-img');
const modalFecha = document.getElementById('modal-fecha');
const modalTitulo = document.getElementById('modal-titulo');
const modalResumen = document.getElementById('modal-resumen');
const modalContenido = document.getElementById('modal-contenido');
const modalClose = document.getElementById('modal-close');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalBitacoraImgContainer = document.getElementById('modal-bitacora-img-container');

// Elementos del visor de inspección
const visorModal = document.getElementById('visor-imagen-modal');
const visorImg = document.getElementById('visor-img');
const visorCanvas = document.getElementById('visor-canvas');
const visorZoomLevel = document.getElementById('visor-zoom-level');
const visorBtnZoomIn = document.getElementById('visor-btn-zoom-in');
const visorBtnZoomOut = document.getElementById('visor-btn-zoom-out');
const visorBtnReset = document.getElementById('visor-btn-reset');
const visorBtnClose = document.getElementById('visor-btn-close');

let zoomScale = 1;
let posX = 0;
let posY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

let initialPinchDistance = 0;
let initialPinchScale = 1;
let lastTapTime = 0;

function actualizarTransformacionVisor() {
  if (!visorImg) return;
  visorImg.style.transform = `translate(${posX}px, ${posY}px) scale(${zoomScale})`;
  if (visorZoomLevel) visorZoomLevel.textContent = `${Math.round(zoomScale * 100)}%`;
}

function abrirVisor(url) {
  if (!visorModal || !visorImg || !url) return;
  visorImg.src = url;
  zoomScale = 1;
  posX = 0;
  posY = 0;
  actualizarTransformacionVisor();
  visorModal.classList.remove('hidden');
}

function cerrarVisor() {
  if (!visorModal) return;
  visorModal.classList.add('hidden');
}

function aplicarZoom(delta) {
  zoomScale = Math.min(Math.max(1, zoomScale + delta), 4);
  if (zoomScale <= 1) {
    posX = 0;
    posY = 0;
  }
  actualizarTransformacionVisor();
}

if (visorCanvas) {
  visorCanvas.addEventListener('mousedown', (e) => {
    if (zoomScale <= 1) return;
    isDragging = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    posX = e.clientX - startX;
    posY = e.clientY - startY;
    actualizarTransformacionVisor();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  visorCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    aplicarZoom(e.deltaY < 0 ? 0.2 : -0.2);
  }, { passive: false });

  visorCanvas.addEventListener('dblclick', () => {
    if (zoomScale > 1) {
      zoomScale = 1;
      posX = 0;
      posY = 0;
    } else {
      zoomScale = 2;
    }
    actualizarTransformacionVisor();
  });

  visorCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - posX;
      startY = e.touches[0].clientY - posY;

      const now = Date.now();
      if (now - lastTapTime < 300) {
        if (zoomScale > 1) {
          zoomScale = 1;
          posX = 0;
          posY = 0;
        } else {
          zoomScale = 2;
        }
        actualizarTransformacionVisor();
      }
      lastTapTime = now;
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchScale = zoomScale;
    }
  }, { passive: true });

  visorCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging && zoomScale > 1) {
      posX = e.touches[0].clientX - startX;
      posY = e.touches[0].clientY - startY;
      actualizarTransformacionVisor();
    } else if (e.touches.length === 2 && initialPinchDistance > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialPinchDistance;
      zoomScale = Math.min(Math.max(1, initialPinchScale * factor), 4);
      if (zoomScale <= 1) {
        posX = 0;
        posY = 0;
      }
      actualizarTransformacionVisor();
    }
  }, { passive: true });

  visorCanvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = 0;
    if (e.touches.length === 0) isDragging = false;
  });
}

if (visorBtnZoomIn) visorBtnZoomIn.addEventListener('click', () => aplicarZoom(0.3));
if (visorBtnZoomOut) visorBtnZoomOut.addEventListener('click', () => aplicarZoom(-0.3));
if (visorBtnReset) visorBtnReset.addEventListener('click', () => {
  zoomScale = 1;
  posX = 0;
  posY = 0;
  actualizarTransformacionVisor();
});
if (visorBtnClose) visorBtnClose.addEventListener('click', cerrarVisor);

if (modalBitacoraImgContainer) {
  modalBitacoraImgContainer.addEventListener('click', (e) => {
    if (e.target.closest('#modal-close')) return;
    if (modalImg && modalImg.src) abrirVisor(modalImg.src);
  });
}

// Carga de la Bitácora con prioridad a notas fijadas
async function cargarBitacora() {
  try {
    const { data, error } = await supabase
      .from('bitacora')
      .select('*')
      .order('fijado', { ascending: false })
      .order('fecha_evento', { ascending: false });

    if (error) throw error;

    notasBitacora = data || [];
    renderizarBitacora(notasBitacora);
  } catch (err) {
    console.error('Error al consultar bitácora:', err);
    grid.innerHTML = `
      <div class="col-span-full bg-red-50 text-red-700 p-4 rounded-xl text-center text-xs">
        No se pudieron cargar las notas de la bitácora. Verifique su conexión a internet.
      </div>
    `;
    if (contador) contador.textContent = 'Error';
  }
}

function renderizarBitacora(lista) {
  grid.innerHTML = '';

  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-16 text-slate-400 text-xs">
        Aún no se han registrado crónicas u obras en la bitácora escolar.
      </div>
    `;
    if (contador) contador.textContent = '0 Notas';
    return;
  }

  if (contador) contador.textContent = `${lista.length} ${lista.length === 1 ? 'Nota' : 'Notas'}`;

  lista.forEach(nota => {
    const card = document.createElement('article');
    const borderClass = nota.fijado 
      ? 'border-amber-300 ring-1 ring-amber-200/70 bg-gradient-to-b from-amber-50/20 to-white' 
      : 'border-slate-200 bg-white';

    card.className = `cursor-pointer ${borderClass} rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-200 flex flex-col justify-between group relative`;

    const fechaObj = nota.fecha_evento ? new Date(nota.fecha_evento + 'T00:00:00') : new Date(nota.created_at);
    const fechaFormateada = fechaObj.toLocaleDateString('es-VE', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const pinBadgeHTML = nota.fijado
      ? `<span class="absolute top-3 right-3 bg-amber-400 text-slate-900 border border-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 backdrop-blur-sm z-10">
           📌 Fijado
         </span>`
      : '';

    card.innerHTML = `
      <div>
        <div class="w-full h-48 bg-slate-100 overflow-hidden relative">
          <img src="${nota.imagen_url}" alt="${nota.titulo}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          ${pinBadgeHTML}
          <span class="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] font-medium px-2 py-0.5 rounded backdrop-blur-sm">
            ${fechaFormateada}
          </span>
        </div>
        <div class="p-5">
          <h3 class="font-bold text-base text-slate-900 mb-2 leading-snug line-clamp-2 group-hover:text-amber-700 transition">
            ${nota.titulo}
          </h3>
          <p class="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
            ${nota.resumen}
          </p>
        </div>
      </div>
      <div class="px-5 pb-5 pt-0">
        <div class="w-full bg-amber-50 group-hover:bg-amber-100 text-amber-900 font-semibold text-xs py-2.5 px-3 rounded-xl border border-amber-200/60 transition flex items-center justify-center gap-1.5 shadow-sm">
          <span>Leer nota completa</span>
          <span class="group-hover:translate-x-1 transition-transform">&rarr;</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => abrirModal(nota.id));
    grid.appendChild(card);
  });
}

function abrirModal(id) {
  const nota = notasBitacora.find(n => n.id === id);
  if (!nota || !modal) return;

  const fechaObj = nota.fecha_evento ? new Date(nota.fecha_evento + 'T00:00:00') : new Date(nota.created_at);
  const fechaFormateada = fechaObj.toLocaleDateString('es-VE', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  modalImg.src = nota.imagen_url;
  modalFecha.textContent = `Acontecido el: ${fechaFormateada}`;
  modalTitulo.textContent = nota.titulo;
  modalResumen.textContent = nota.resumen;
  modalContenido.textContent = nota.contenido;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function cerrarModal() {
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

if (modalClose) modalClose.addEventListener('click', cerrarModal);
if (modalCloseBtn) modalCloseBtn.addEventListener('click', cerrarModal);

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (visorModal && !visorModal.classList.contains('hidden')) {
      cerrarVisor();
    } else if (modal && !modal.classList.contains('hidden')) {
      cerrarModal();
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarBitacora);
} else {
  cargarBitacora();
}