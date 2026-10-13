// js/app.js
import { supabase } from './config.js';

let todosLosComunicados = [];

async function cargarComunicados() {
  const grid = document.getElementById('comunicados-grid');

  try {
    const { data, error } = await supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    todosLosComunicados = data;
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
    const card = document.createElement('article');
    card.className = 'bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition';

    // Badge según categoría
    let badgeClass = 'bg-blue-100 text-blue-900';
    if (c.categoria === 'Primaria') badgeClass = 'bg-emerald-100 text-emerald-800';
    if (c.categoria === 'Media General') badgeClass = 'bg-indigo-100 text-indigo-900';

    const fechaFormateada = new Date(c.created_at).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // Render de imagen si existe
    const imagenHTML = c.imagen_url
      ? `<div class="w-full h-44 bg-slate-100 overflow-hidden border-b border-slate-100">
           <img src="${c.imagen_url}" alt="${c.titulo}" class="w-full h-full object-cover">
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
          <h3 class="font-bold text-base text-slate-900 mb-2 leading-snug">${c.titulo}</h3>
          <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">${c.contenido}</p>
        </div>
      </div>
      <div class="px-5 py-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium bg-slate-50/50">
        Emite: ${c.emisor || 'Dirección del Plantel'}
      </div>
    `;

    grid.appendChild(card);
  });
}

// Configuración de filtros por categoría
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