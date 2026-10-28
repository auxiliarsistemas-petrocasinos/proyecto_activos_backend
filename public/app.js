const state = { items: [], locations: [], movements: [], balances: [], fields: [] }
const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]
const driver = window.driver?.js?.driver
const labels = { INITIAL_BALANCE: 'Inventario inicial', PURCHASE: 'Compra', TRANSFER: 'Traslado', WRITE_OFF: 'Baja' }
const locationLabels = { GENERAL_WAREHOUSE: 'Bodega general', SECONDARY_WAREHOUSE: 'Bodega secundaria', DINING_ROOM: 'Comedor' }

function localDateValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function prepareDatePicker() {
  const legacyField = $('#movement-date')
  if (!legacyField || legacyField.tagName === 'INPUT') return
  const datePicker = document.createElement('input')
  datePicker.type = 'date'
  datePicker.name = 'exerciseDate'
  datePicker.id = 'movement-date'
  datePicker.required = true
  datePicker.max = localDateValue()
  legacyField.replaceWith(datePicker)
}

const startDashboardTour = () => {
  if (!driver) {
    showToast('No se pudo cargar el tutorial')
    return
  }

  navigate('dashboard')

  driver({
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
    steps: [
      {
        element: '.sidebar',
        popover: {
          title: 'Menú principal',
          description: 'Desde aquí puedes navegar entre resumen, inventario, movimientos y la estructura operativa.',
          side: 'right'
        }
      },
      {
        element: '#stat-items',
        popover: {
          title: 'Elementos activos',
          description: 'Esta métrica muestra cuántos elementos están registrados para operar.',
          side: 'bottom'
        }
      },
      {
        element: '#location-summary',
        popover: {
          title: 'Existencias por ubicación',
          description: 'Aquí puedes revisar cómo se distribuye el inventario entre bodegas y comedores.',
          side: 'top'
        }
      },
      {
        element: '#quick-movement',
        popover: {
          title: 'Registrar movimiento',
          description: 'Usa este botón para registrar compras, traslados o bajas de inventario.',
          side: 'bottom'
        }
      }
    ]
  }).drive()
}

const startInventoryTour = () => {
  if (!driver) {
    showToast('No se pudo cargar el tutorial')
    return
  }

  navigate('inventory')

  driver({
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
    steps: [
      {
        element: '#inventory-view h1',
        popover: {
          title: 'Inventario',
          description: 'Aquí puedes consultar las existencias actuales de cada elemento por ubicación.',
          side: 'bottom'
        }
      },
      {
        element: '#inventory-search',
        popover: {
          title: 'Buscar elementos',
          description: 'Escribe el nombre o la categoría para encontrar rápidamente un elemento.',
          side: 'bottom'
        }
      },
      {
        element: '#location-filter',
        popover: {
          title: 'Filtrar por ubicación',
          description: 'Selecciona una bodega o comedor para revisar únicamente sus existencias.',
          side: 'bottom'
        }
      },
      {
        element: '#inventory-table',
        popover: {
          title: 'Detalle de existencias',
          description: 'La tabla muestra el elemento, su ubicación, el saldo actual y la unidad de medida.',
          side: 'top'
        }
      },
      {
        element: '#inventory-refresh',
        popover: {
          title: 'Actualizar datos',
          description: 'Pulsa este botón después de registrar un movimiento para consultar los saldos actualizados.',
          side: 'left'
        }
      }
    ]
  }).drive()
}

const startMovementsTour = () => {
  if (!driver) {
    showToast('No se pudo cargar el tutorial')
    return
  }

  navigate('movements')

  driver({
    showProgress: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Terminar',
    steps: [
      {
        element: '#movements-view h1',
        popover: {
          title: 'Historial de movimientos',
          description: 'Aquí queda registrada cada compra, traslado y baja realizada en el inventario.',
          side: 'bottom'
        }
      },
      {
        element: '#movement-search',
        popover: {
          title: 'Buscar movimientos',
          description: 'Busca por nombre del elemento o por el motivo registrado.',
          side: 'bottom'
        }
      },
      {
        element: '#movement-filter',
        popover: {
          title: 'Filtrar por tipo',
          description: 'Puedes mostrar únicamente compras, traslados o bajas.',
          side: 'bottom'
        }
      },
      {
        element: '#movements-table',
        popover: {
          title: 'Detalle y trazabilidad',
          description: 'Consulta la fecha, tipo, elemento, cantidad, ruta y motivo de cada operación.',
          side: 'top'
        }
      },
      {
        element: '#movement-page-button',
        popover: {
          title: 'Registrar movimiento',
          description: 'Abre el formulario para registrar una compra, un traslado o una baja.',
          side: 'left'
        }
      }
    ]
  }).drive()
}

const startTour = () => {
  const activeView = $('.view.active')?.id
  if (activeView === 'inventory-view') return startInventoryTour()
  if (activeView === 'movements-view') return startMovementsTour()
  startDashboardTour()
}

const formatDate = (date) => new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date)).replace('.', '')
const showToast = (message) => { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000) }
const api = async (path, options) => { const response = await fetch(path, options); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación'); return data }

async function loadData() {
  try {
    const [items, locations, movements, fields] = await Promise.all([api('/api/items'), api('/api/locations'), api('/api/movements'), api('/api/fields')])
    state.items = items; state.locations = locations; state.movements = movements; state.fields = fields
    renderAll();
    await loadBalances()
  } catch (error) { showToast(error.message); renderAll() }
}

async function loadBalances() {
  if (!state.items.length || !state.locations.length) return
  const combinations = state.items.flatMap(item => state.locations.map(location => ({ item, location })))
  const balances = await Promise.all(combinations.map(async ({ item, location }) => { try { const result = await api(`/api/inventory?itemId=${item.id}&locationId=${location.id}`); return { ...result, item, location } } catch { return { quantity: 0, item, location } } }))
  state.balances = balances.filter(balance => balance.quantity > 0); renderLocationSummary(); renderInventoryTable()
}

function renderAll() { $('#stat-items').textContent = state.items.length; $('#stat-locations').textContent = state.locations.length; $('#stat-movements').textContent = state.movements.length; $('#today').textContent = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date()); renderRecentMovements(); renderMovementsTable(); renderAdminModules(); populateSelects() }
function renderLocationSummary() { const totals = state.locations.map(location => ({ location, quantity: state.balances.filter(balance => balance.location.id === location.id).reduce((sum, balance) => sum + balance.quantity, 0) })).sort((a,b) => b.quantity - a.quantity); const max = Math.max(...totals.map(row => row.quantity), 1); $('#location-summary').innerHTML = totals.length ? totals.map(({ location, quantity }) => `<div class="location-row"><span class="location-name" title="${location.name}">${location.name}</span><div class="location-bar"><span style="width:${Math.max(quantity / max * 100, quantity ? 5 : 0)}%"></span></div><span class="location-qty">${quantity}</span></div>`).join('') : '<div class="empty-state">Aún no hay ubicaciones registradas.</div>' }
function movementIcon(type) { return type === 'INITIAL_BALANCE' ? '+' : type === 'PURCHASE' ? '↓' : type === 'TRANSFER' ? '↗' : '−' }
function renderRecentMovements() { $('#recent-movements').innerHTML = state.movements.length ? state.movements.slice(0, 5).map(movement => `<div class="activity-item"><span class="activity-icon ${movement.type.toLowerCase()}">${movementIcon(movement.type)}</span><div class="activity-copy"><strong>${labels[movement.type]} · ${movement.item.name}</strong><small>${movement.quantity} ${movement.item.unit}${movement.reason ? ` · ${movement.reason}` : ''}</small></div><span class="activity-date">${formatDate(movement.exerciseDate)}</span></div>`).join('') : '<div class="empty-state">Todavía no hay movimientos registrados.</div>' }
function renderMovementsTable() { const query = ($('#movement-search')?.value || '').toLowerCase(); const filter = $('#movement-filter')?.value || ''; const rows = state.movements.filter(m => (!filter || m.type === filter) && (!query || `${m.item.name} ${m.reason || ''}`.toLowerCase().includes(query))); $('#movements-table').innerHTML = rows.length ? rows.map(m => `<tr><td class="sub-cell">${formatDate(m.exerciseDate)}</td><td><span class="type-pill ${m.type.toLowerCase()}">${labels[m.type]}</span></td><td><div class="item-cell">${m.item.name}</div><div class="sub-cell">${m.item.category || 'Sin categoría'}</div></td><td class="qty-cell">${m.quantity} ${m.item.unit}</td><td class="sub-cell">${m.sourceLocation?.name || '—'} ${m.targetLocation ? `→ ${m.targetLocation.name}` : ''}</td><td class="sub-cell">${m.reason || '—'}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">No hay movimientos que coincidan con la búsqueda.</div></td></tr>' }
function renderInventoryTable() { const query = ($('#inventory-search')?.value || '').toLowerCase(); const locationId = $('#location-filter')?.value || ''; const rows = state.balances.filter(b => (!locationId || b.location.id === locationId) && (!query || `${b.item.name} ${b.item.category || ''}`.toLowerCase().includes(query))); $('#inventory-table').innerHTML = rows.length ? rows.map(b => `<tr><td><div class="item-cell">${b.item.name}</div></td><td class="sub-cell">${b.item.category || 'Sin categoría'}</td><td>${b.location.name}</td><td class="qty-cell">${b.quantity}</td><td class="sub-cell">${b.item.unit}</td></tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No hay existencias que coincidan.</div></td></tr>' }
const entityState = { kind: null, id: null }
const warehouseTypes = ['GENERAL_WAREHOUSE', 'SECONDARY_WAREHOUSE']
const entityTypeLabels = { GENERAL_WAREHOUSE: 'Bodega general', SECONDARY_WAREHOUSE: 'Bodega secundaria' }
const entityEmpty = '<tr><td colspan="5" class="table-empty">No hay registros para mostrar.</td></tr>'
function actionButtons(kind, id) { return `<div class="row-actions"><button class="table-action" data-entity-edit="${kind}" data-id="${id}">Editar</button><button class="table-action danger" data-entity-delete="${kind}" data-id="${id}">Eliminar</button></div>` }
function renderAdminModules() {
  $('#fields-table').innerHTML = state.fields.length ? state.fields.map(field => `<tr><td class="item-cell">${field.name}</td><td class="sub-cell">${field.description || '—'}</td><td class="qty-cell">${field.locationCount || 0}</td><td>${actionButtons('field', field.id)}</td></tr>`).join('') : entityEmpty
  const warehouses = state.locations.filter(location => warehouseTypes.includes(location.type))
  $('#warehouses-table').innerHTML = warehouses.length ? warehouses.map(location => `<tr><td class="item-cell">${location.name}</td><td><span class="type-pill transfer">${entityTypeLabels[location.type]}</span></td><td>${location.field?.name || 'Sin asignar'}</td><td class="sub-cell">${location.parent?.name || '—'}</td><td>${actionButtons('warehouse', location.id)}</td></tr>`).join('') : entityEmpty
  const diningRooms = state.locations.filter(location => location.type === 'DINING_ROOM')
  $('#dining-rooms-table').innerHTML = diningRooms.length ? diningRooms.map(location => `<tr><td class="item-cell">${location.name}</td><td>${location.parent?.name || 'Sin asignar'}</td><td>${location.parent?.field?.name || location.field?.name || 'Sin asignar'}</td><td>${actionButtons('dining-room', location.id)}</td></tr>`).join('') : '<tr><td colspan="4" class="table-empty">No hay comedores para mostrar.</td></tr>'
}
function entityField(label, input, full = false) { return `<label class="entity-field${full ? ' full' : ''}">${label}${input}</label>` }
function entitySelectOptions(options, selected = '') { return options.map(option => `<option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.label}</option>`).join('') }
function updateEntityLocationFields() { const type = $('#entity-location-type')?.value; const parentSelect = $('#entity-fields select[name="parentId"]'); const parentField = parentSelect?.closest('label'); if (parentField) parentField.style.display = type === 'SECONDARY_WAREHOUSE' ? '' : 'none'; if (parentSelect) parentSelect.required = type === 'SECONDARY_WAREHOUSE' }
function openEntityModal(kind, id = null) {
  entityState.kind = kind; entityState.id = id
  const warehouseLocations = state.locations.filter(location => warehouseTypes.includes(location.type))
  const generalWarehouses = state.locations.filter(location => location.type === 'GENERAL_WAREHOUSE')
  const current = id ? (kind === 'field' ? state.fields.find(field => field.id === id) : state.locations.find(location => location.id === id)) : null
  let fields = ''
  if (kind === 'field') {
    const assignableWarehouses = state.locations.filter(location => warehouseTypes.includes(location.type) && (!location.fieldId || location.fieldId === current?.id))
    const selectedWarehouseIds = new Set(state.locations.filter(location => location.fieldId === current?.id).map(location => location.id))
    const warehouseOptions = assignableWarehouses.map(location => `<option value="${location.id}" ${selectedWarehouseIds.has(location.id) ? 'selected' : ''}>${location.name}</option>`).join('')
    fields = entityField('Nombre del campo', `<input name="name" value="${current?.name || ''}" placeholder="Ej. Campo Norte" required />`, true) + entityField('Descripción <span class="optional">opcional</span>', `<input name="description" value="${current?.description || ''}" placeholder="Ej. Zona de operación" />`, true) + entityField('Bodegas asignadas <span class="optional">mantén Ctrl para seleccionar varias</span>', `<select name="warehouseIds" multiple size="4">${warehouseOptions || '<option disabled>No hay bodegas disponibles</option>'}</select>`, true)
  } else if (kind === 'warehouse') {
    const type = current?.type || 'GENERAL_WAREHOUSE'
    fields = entityField('Nombre de la bodega', `<input name="name" value="${current?.name || ''}" placeholder="Ej. Bodega Central" required />`, true) + entityField('Tipo', `<select name="type" id="entity-location-type" ${id ? 'disabled' : ''}>${entitySelectOptions(warehouseTypes.map(value => ({ value, label: entityTypeLabels[value] })), type)}</select>`) + entityField('Campo asignado', `<select name="fieldId" required><option value="">Seleccionar campo</option>${entitySelectOptions(state.fields.map(field => ({ value: field.id, label: field.name })), current?.fieldId || '')}</select>`) + entityField('Bodega superior', `<select name="parentId"><option value="">Sin bodega superior</option>${entitySelectOptions(generalWarehouses.map(location => ({ value: location.id, label: location.name })), current?.parentId || '')}</select>`, false)
  } else {
    fields = entityField('Nombre del comedor', `<input name="name" value="${current?.name || ''}" placeholder="Ej. Comedor Principal" required />`, true) + entityField('Bodega asignada', `<select name="parentId" required><option value="">Seleccionar bodega</option>${entitySelectOptions(warehouseLocations.map(location => ({ value: location.id, label: location.name })), current?.parentId || '')}</select>`, true)
  }
  $('#entity-modal-title').textContent = id ? 'Editar registro' : ({ field: 'Nuevo campo', warehouse: 'Nueva bodega', 'dining-room': 'Nuevo comedor' }[kind])
  $('#entity-fields').innerHTML = fields
  $('#entity-feedback').textContent = ''
  $('#entity-modal').classList.add('open'); $('#entity-modal').setAttribute('aria-hidden', 'false')
  updateEntityLocationFields()
  $('#entity-location-type')?.addEventListener('change', updateEntityLocationFields)
}
function closeEntityModal() { $('#entity-modal').classList.remove('open'); $('#entity-modal').setAttribute('aria-hidden', 'true'); $('#entity-form').reset(); entityState.kind = null; entityState.id = null }
function populateSelects() { const locationOptions = state.locations.map(l => `<option value="${l.id}">${l.name}</option>`).join(''); $('#location-filter').innerHTML = '<option value="">Todas las ubicaciones</option>' + locationOptions; $('#movement-source').innerHTML = '<option value="">Seleccionar ubicación</option>' + locationOptions; $('#movement-target').innerHTML = '<option value="">Seleccionar ubicación</option>' + locationOptions; const itemField = $('#movement-item'); if (itemField?.tagName === 'SELECT') itemField.innerHTML = state.items.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); updateMovementItemField($('#movement-type').value) }
function openModal() { $('#movement-modal').classList.add('open'); $('#movement-modal').setAttribute('aria-hidden', 'false'); $('#movement-date').max = localDateValue(); $('#movement-date').value = localDateValue(); updateMovementFields() }
function closeModal() { $('#movement-modal').classList.remove('open'); $('#movement-modal').setAttribute('aria-hidden', 'true'); $('#movement-form').reset(); $('#form-feedback').textContent = '' }
function updateMovementItemField(type) { const current = $('#movement-item'); if (!current) return; if (type === 'PURCHASE' && current.tagName !== 'INPUT') { const input = document.createElement('input'); input.type = 'text'; input.name = 'itemName'; input.id = 'movement-item'; input.placeholder = 'Ej. Cuchara sopera'; input.required = true; current.replaceWith(input) } else if (type !== 'PURCHASE' && current.tagName !== 'SELECT') { const select = document.createElement('select'); select.name = 'itemId'; select.id = 'movement-item'; select.required = true; select.innerHTML = state.items.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); current.replaceWith(select) } }
function updateMovementFields() { const type = $('#movement-type').value; $('#source-field').style.display = type === 'PURCHASE' ? 'none' : ''; $('#target-field').style.display = type === 'WRITE_OFF' ? 'none' : ''; updateMovementItemField(type) }
function navigate(view) { $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view)); $$('.view').forEach(section => section.classList.toggle('active', section.id === `${view}-view`)); $('#page-label').textContent = { dashboard: 'Resumen', fields: 'Campos', warehouses: 'Bodegas', 'dining-rooms': 'Comedores', inventory: 'Inventario', movements: 'Movimientos' }[view] || 'Resumen' }

async function saveEntity(event) {
  event.preventDefault()
  const form = new FormData(event.target)
  const { kind, id } = entityState
  try {
    let endpoint = ''
    let method = id ? 'PATCH' : 'POST'
    let payload = {}
    if (kind === 'field') {
      endpoint = id ? `/api/fields/${id}` : '/api/fields'
      payload = { name: String(form.get('name')).trim(), description: String(form.get('description') || '').trim() || undefined }
    } else if (kind === 'warehouse') {
      endpoint = id ? `/api/locations/${id}` : '/api/locations'
      const type = id ? state.locations.find(location => location.id === id).type : form.get('type')
      payload = { name: String(form.get('name')).trim(), fieldId: form.get('fieldId') || undefined }
      if (!id) payload.type = type
      if (type === 'SECONDARY_WAREHOUSE') payload.parentId = form.get('parentId') || undefined
    } else if (kind === 'dining-room') {
      endpoint = id ? `/api/locations/${id}` : '/api/locations'
      payload = { name: String(form.get('name')).trim(), parentId: form.get('parentId') || undefined }
      if (!id) payload.type = 'DINING_ROOM'
    }
    const saved = await api(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (kind === 'field') {
      const fieldId = saved.id
      const warehouseIds = form.getAll('warehouseIds')
      await Promise.all(warehouseIds.map(locationId => api(`/api/locations/${locationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fieldId }) })))
    }
    closeEntityModal(); showToast('Registro guardado correctamente'); await loadData()
  } catch (error) { $('#entity-feedback').textContent = error.message }
}
$$('.entity-add').forEach(button => button.addEventListener('click', () => openEntityModal(button.dataset.entity)))
$('#close-entity-modal').addEventListener('click', closeEntityModal)
$('#cancel-entity-modal').addEventListener('click', closeEntityModal)
$('#entity-form').addEventListener('submit', saveEntity)
document.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-entity-edit]')
  const deleteButton = event.target.closest('[data-entity-delete]')
  if (editButton) openEntityModal(editButton.dataset.entityEdit, editButton.dataset.id)
  if (deleteButton) {
    const kind = deleteButton.dataset.entityDelete; const id = deleteButton.dataset.id
    if (!window.confirm('¿Deseas eliminar este registro?')) return
    try { await api(kind === 'field' ? `/api/fields/${id}` : `/api/locations/${id}`, { method: 'DELETE' }); showToast('Registro eliminado'); await loadData() } catch (error) { showToast(error.message) }
  }
})
$$('[data-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)))
$('#help-button').addEventListener('click', startTour)
$('#quick-movement').addEventListener('click', openModal); $('#movement-page-button').addEventListener('click', openModal); $('#close-modal').addEventListener('click', closeModal); $('#cancel-modal').addEventListener('click', closeModal); $('#movement-type').addEventListener('change', updateMovementFields); $('#refresh-button').addEventListener('click', loadData); $('#inventory-refresh').addEventListener('click', loadData); $('#inventory-search').addEventListener('input', renderInventoryTable); $('#location-filter').addEventListener('change', renderInventoryTable); $('#movement-search').addEventListener('input', renderMovementsTable); $('#movement-filter').addEventListener('change', renderMovementsTable)
$('#movement-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.target); const type = form.get('type'); const payload = { type, itemId: form.get('itemId'), quantity: Number(form.get('quantity')), reason: form.get('reason') || undefined, exerciseDate: new Date().toISOString() }; if (type !== 'PURCHASE') payload.sourceLocationId = form.get('sourceLocationId') || undefined; if (type !== 'WRITE_OFF') payload.targetLocationId = form.get('targetLocationId') || undefined; try { await api('/api/movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closeModal(); showToast('Movimiento guardado correctamente'); await loadData() } catch (error) { $('#form-feedback').textContent = error.message } })
prepareDatePicker()

document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'movement-form') return
  event.preventDefault()
  event.stopPropagation()
  const form = new FormData(event.target)
  const type = form.get('type')
  let itemId = form.get('itemId')
  if (type === 'PURCHASE') {
    const itemName = String(form.get('itemName') || '').trim()
    if (!itemName) {
      $('#form-feedback').textContent = 'Escribe el nombre del elemento'
      return
    }
    const existingItem = state.items.find(item => item.name.toLowerCase() === itemName.toLowerCase())
    if (existingItem) {
      itemId = existingItem.id
    } else {
      const createdItem = await api('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: itemName, unit: 'unidad' }) })
      itemId = createdItem.id
    }
  }
  const selectedDate = form.get('exerciseDate')
  const payload = {
    type,
    itemId,
    quantity: Number(form.get('quantity')),
    reason: form.get('reason') || undefined,
    exerciseDate: selectedDate ? new Date(`${selectedDate}T12:00:00`).toISOString() : new Date().toISOString()
  }
  if (type !== 'PURCHASE') payload.sourceLocationId = form.get('sourceLocationId') || undefined
  if (type !== 'WRITE_OFF') payload.targetLocationId = form.get('targetLocationId') || undefined
  try {
    await api('/api/movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    closeModal()
    showToast('Movimiento guardado correctamente')
    await loadData()
  } catch (error) {
    $('#form-feedback').textContent = error.message
  }
}, true)

loadData()
