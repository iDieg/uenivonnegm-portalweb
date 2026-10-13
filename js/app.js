// js/app.js
import { supabase } from './config.js';

let todosLosComunicados = [];

// Elementos de la modal
const modal = document.getElementById('modal-comunicado');
const modalImg = document.getElementById('modal-com-img');
const modalBadge = document.getElementById('modal-com-badge');
const modalFecha = document.getElementById('modal-com-fecha');
const modalTitulo = document.getElementById('modal-com-titulo');
const modalEmisor = document.getElementById('modal-com-emisor');
const modalContenido = document.getElementById('modal-com-contenido');
const modalClose = document.getElementById('modal-com-close');
const modalCloseBtn = document.getElementById('modal-com-close-btn');

async function cargarComunicados() {
  const grid = document.getElementById('comunicados-grid');

  try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    todosLosComunicados = data || [];
    renderizar(todosLosComunicados);
  } catch (err) {
    console.error('Error al cargar comunicados:', err);
    grid.innerHTML = `
      <div class="col-span-full bg-red-50 text-red-700 p-4 rounded-lg text-center text-xs">
        No se pudieron cargar los comunicados. Verifique la conexión a internet.
      </div>
    `;
  }
}

function renderizar(lista) {
  const grid = document.getElementById('comunicados-grid');
  grid.innerHTML = '';

  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-400 text-xs">
        No hay comunicados publicados en esta categoría actualmente.
      </div>
    `;
    return;
  }

  lista.forEach(c => {
    // Tarjeta con interacción completa
    const card = document.createElement('article');
    card.className = 'cursor-pointer bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-200 flex flex-col justify-between group';

    let badgeClass = 'bg-blue-100 text-blue-900';
    if (c.categoria === 'Primaria') badgeClass = 'bg-emerald-100 text-emerald-800';
    if (c.categoria === 'Media General') badgeClass = 'bg-indigo-100 text-indigo-900';

    const fechaFormateada = new Date(c.created_at).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    const imagenHTML = c.imagen_url
      ? `<div class="w-full h-44 bg-slate-100 overflow-hidden border-b border-slate-100">
           <img src="${c.imagen_url}" alt="${c.titulo}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
         </div>`
      : '';

    card.innerHTML = `
      <div>
        ${imagenHTML}
        <div class="p-5">
          <div class="flex justify-between items-center mb-2">
            <span class="${badgeClass} text-[10px] font-bold uppercase px-2 py-0.5 rounded">${c.categoria}</span>
            <span class="text-[11px] text-slate-400">${fechaFormateada}</span>
          </div>
          <h3 class="font-bold text-base text-slate-900 mb-2 leading-snug group-hover:text-blue-900 transition line-clamp-2">
            ${c.titulo}
          </h3>
          <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-3 mb-4">
            ${c.contenido}
          </p>
        </div>
      </div>
      <div class="px-5 py-3 border-t border-slate-100 text-[11px] font-medium bg-slate-50 flex justify-between items-center text-slate-500">
        <span>Emite: ${c.emisor || 'Dirección'}</span>
        <span class="text-blue-700 font-bold group-hover:underline flex items-center gap-1">
          Leer nota &rarr;
        </span>
      </div>
    `;

    // Clic en cualquier parte del recuadro abre el detalle
    card.addEventListener('click', () => abrirModalComunicado(c));
    grid.appendChild(card);
  });
}

function abrirModalComunicado(c) {
  if (!modal) return;

  const fechaFormateada = new Date(c.created_at).toLocaleDateString('es-VE', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  modalTitulo.textContent = c.titulo;
  modalFecha.textContent = fechaFormateada;
  modalEmisor.textContent = c.emisor || 'Dirección del Plantel';
  modalContenido.textContent = c.contenido;

  // Manejo de la foto
  if (c.imagen_url) {
    modalImg.src = c.imagen_url;
    modalImg.classList.remove('hidden');
  } else {
    modalImg.src = '';
    modalImg.classList.add('hidden');
  }

  // Estilo de badge
  modalBadge.textContent = c.categoria;
  modalBadge.className = 'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ' +
    (c.categoria === 'Primaria' ? 'bg-emerald-100 text-emerald-800' :
     c.categoria === 'Media General' ? 'bg-indigo-100 text-indigo-900' : 'bg-blue-100 text-blue-900');

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function cerrarModalComunicado() {
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

// Eventos de cierre modal
if (modalClose) modalClose.addEventListener('click', cerrarModalComunicado);
if (modalCloseBtn) modalCloseBtn.addEventListener('click', cerrarModalComunicado);

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModalComunicado();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    cerrarModalComunicado();
  }
});

// Filtros por Categoría
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.className = 'filter-btn bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium hover:bg-slate-300';
    });
    btn.className = 'filter-btn bg-blue-900 text-white px-3 py-1.5 rounded font-medium';

    const cat = btn.getAttribute('data-cat');
    if (cat === 'todos') {
      renderizar(todosLosComunicados);
    } else {
      const filtrados = todosLosComunicados.filter(c => c.categoria === cat);
      renderizar(filtrados);
    }
  });
});

document.addEventListener('DOMContentLoaded', cargarComunicados);