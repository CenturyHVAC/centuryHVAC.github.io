document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');

  let map; // Declare map globally to be accessible across functions

  // Define custom icons
  const greenIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const yellowIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Function to set marker icon based on status
  function setMarkerIcon(marker) {
    if (marker.markerData) {
      if (marker.markerData.status === 'down') {
        marker.setIcon(redIcon);
      } else if (marker.markerData.status === 'limited') {
        marker.setIcon(yellowIcon);
      } else if (marker.markerData.status === 'up') {
        marker.setIcon(greenIcon);
      } else {
        marker.setIcon(greenIcon); // Default to green for unknown status
      }
    }
  }

  // Function to load saved map progress
  function loadMapProgress() {
    const savedProgress = localStorage.getItem('mapProgress');
    if (savedProgress) {
      const mapState = JSON.parse(savedProgress);

      // Restore map view
      map.setView(mapState.center, mapState.zoom);
      map.setBearing(mapState.bearing);

      // Restore rotation slider
      const rotationSlider = document.getElementById('rotation-slider');
      const rotationDisplay = document.getElementById('rotation-display');
      rotationSlider.value = mapState.bearing;
      rotationDisplay.textContent = `${mapState.bearing}°`;

      // Restore markers
      mapState.markers.forEach(markerData => {
        const marker = L.marker(markerData.latlng, {
          draggable: false
        }).addTo(map)
        .on('click', function(markerEvent) {
          markerEvent.originalEvent.stopPropagation();
          if (!this.markerData) {
            // Initialize marker data if it doesn't exist
            this.markerData = {
              unitId: markerData.markerData.unitId,
              status: markerData.markerData.status,
              notes: markerData.markerData.notes,
              details: markerData.markerData.details,
              parts: markerData.markerData.parts,
              history: {
                status: markerData.markerData.history.status,
                parts: markerData.markerData.history.parts
              }
            };
          }
          currentMarker = this;
          showContextMenu(markerEvent);
        });

        // Initialize marker data when creating the marker
        marker.markerData = {
          unitId: markerData.markerData.unitId,
          status: markerData.markerData.status,
          notes: markerData.markerData.notes,
          details: markerData.markerData.details,
          parts: markerData.markerData.parts,
          history: {
            status: markerData.markerData.history.status,
            parts: markerData.markerData.history.parts
          }
        };

        // Set marker icon based on loaded status
        setMarkerIcon(marker);
      });
    }
  }

  // Function to save map progress
  function saveMapProgress() {
    if (map) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();
      
      // Get all markers and their data
      const markers = [];
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          markers.push({
            latlng: layer.getLatLng(),
            markerData: layer.markerData
          });
        }
      });

      // Create map state object
      const mapState = {
        center: center,
        zoom: zoom,
        bearing: bearing,
        markers: markers
      };

      // Save to localStorage
      localStorage.setItem('mapProgress', JSON.stringify(mapState));
    }
  }

  const latitude = 35.31062486972806;
  const longitude = -81.84777052479605;

  // Calculate bounds (approximately 1000 feet in all directions)
  // 1 degree of latitude = ~364,000 feet
  // 1 degree of longitude = ~288,200 feet (at this latitude)
  const feetPerLatDegree = 364000;  // ~364,000 feet per degree of latitude
  const feetPerLngDegree = Math.cos(latitude * Math.PI/180) * 364000; // Adjust for longitude at this latitude

  const latOffset = 1000 / feetPerLatDegree;
  const lngOffset = 1000 / feetPerLngDegree;

  const bounds = L.latLngBounds(
    [latitude - latOffset, longitude - lngOffset], // Southwest corner
    [latitude + latOffset, longitude + lngOffset]  // Northeast corner
  );

  // Create map with rotation plugin and increased max zoom
  map = L.map('map', {
    center: [latitude, longitude],
    zoom: 19,
    minZoom: 19,
    maxZoom: 20.25,
    rotate: true,
    rotateControl: {
      closeOnZeroBearing: false
    },
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,  // Make the bounds absolutely solid
    inertia: false  // Disable map inertia to prevent overshooting bounds
  });

  // Set initial bearing to 163 degrees
  map.setBearing(163);

  // Load saved progress after map initialization
  loadMapProgress();

  // Add the satellite tile layer after loading saved progress
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles Esri',
    maxZoom: 22
  }).addTo(map);

  // Get rotation slider and display
  const rotationSlider = document.getElementById('rotation-slider');
  const rotationDisplay = document.getElementById('rotation-display');

  // Set initial slider and display to 163 degrees
  rotationSlider.value = 163;
  rotationDisplay.textContent = '163°';

  // Add event listener to rotate map
  rotationSlider.addEventListener('input', (e) => {
    const rotation = e.target.value;
    map.setBearing(rotation);
    rotationDisplay.textContent = `${rotation}°`;
    saveMapProgress(); // Save state after rotation change
  });

  // Add event listeners for map state changes
  map.on('moveend', saveMapProgress);
  map.on('zoomend', saveMapProgress);
  map.on('rotate', saveMapProgress);

  // Keyboard control for rotation slider
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault(); // Prevent default scrolling behavior
        let currentValue = parseInt(rotationSlider.value, 10);
        rotationSlider.value = Math.max(0, currentValue - 1); // Decrement, but not below 0
        rotationSlider.dispatchEvent(new Event('input')); // Manually trigger input event
      } else if (event.key === 'ArrowRight') {
        event.preventDefault(); // Prevent default scrolling behavior
        let currentValue = parseInt(rotationSlider.value, 10);
        rotationSlider.value = Math.min(360, currentValue + 1); // Increment, but not above 360
        rotationSlider.dispatchEvent(new Event('input')); // Manually trigger input event
      }
    }
  });

  let currentMarker = null;
  let isAddingMarker = false;
  const addMarkerButton = document.getElementById('add-marker-button');

  addMarkerButton.addEventListener('click', () => {
    if (!isAddingMarker) {
      // Enter "adding marker" mode
      isAddingMarker = true;
      addMarkerButton.classList.add('active');
      addMarkerButton.textContent = 'Click Map to Add Unit';

      // Temporary event listener for map click
      function onMapClick(e) {
        // Open the multiple markers modal at the clicked location
        rightClickPoint = e.latlng;
        openMultipleMarkersModal();
        
        // Remove this temporary event listener
        map.off('click', onMapClick);
        
        // Reset button state
        isAddingMarker = false;
        addMarkerButton.classList.remove('active');
        addMarkerButton.textContent = 'Add Unit';
      }

      // Add the one-time map click listener
      map.on('click', onMapClick);
    }
  });

  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;

      // Update active tab buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Update active tab panels
      tabPanels.forEach(panel => panel.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // Status editing functionality
  const editStatusBtn = document.getElementById('edit-status-btn');
  const statusEditSection = document.getElementById('status-edit-section');
  const saveStatusBtn = document.getElementById('save-status-btn');
  const currentStatusDisplay = document.getElementById('current-status-display');
  const unitStatusSelect = document.getElementById('unit-status');
  const statusNotesTextarea = document.getElementById('status-notes');
  const statusHistoryContainer = document.getElementById('status-history');
  const contextMenuHeader = document.getElementById('context-menu-header');

  editStatusBtn.addEventListener('click', () => {
    statusEditSection.classList.remove('hidden');
  });

  saveStatusBtn.addEventListener('click', () => {
    if (currentMarker && currentMarker.markerData) {
      const newStatus = unitStatusSelect.value;
      const newNotes = statusNotesTextarea.value;

      // Update marker data
      currentMarker.markerData.status = newStatus;
      currentMarker.markerData.notes = newNotes;

      // Update marker icon based on status
      setMarkerIcon(currentMarker);

      // Update status display
      currentStatusDisplay.textContent = newStatus.toUpperCase();
      currentStatusDisplay.className = `status-text status-${newStatus}`;

      // Update latest notes display
      const latestNotesDisplay = document.getElementById('latest-notes-display');
      latestNotesDisplay.textContent = newNotes ? `Notes: ${newNotes}` : '';
      latestNotesDisplay.classList.toggle('has-notes', !!newNotes);

      // Add to history
      const now = new Date();
      const historyEntry = {
        date: now,
        status: newStatus,
        notes: newNotes
      };
      currentMarker.markerData.history.status.unshift(historyEntry);

      // Update history display
      updateStatusHistory(statusHistoryContainer, currentMarker);

      // Hide edit section
      statusEditSection.classList.add('hidden');
      saveMapProgress(); // Save state after updating status
    }
  });

  const contextMenu = document.getElementById('context-menu');
  const mapContextMenu = document.getElementById('map-context-menu');
  const addUnitMarkerBtn = document.getElementById('add-unit-marker-btn');
  let rightClickPoint = null;

  map.on('contextmenu', function(e) {
    // Prevent the default browser context menu
    e.originalEvent.preventDefault();
    
    // Store the clicked point
    rightClickPoint = e.latlng;
    
    // Position the context menu at the click point
    const x = e.containerPoint.x;
    const y = e.containerPoint.y;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get menu dimensions
    const menuWidth = 150; // Approximate width of the context menu
    const menuHeight = 35; // Approximate height of the context menu
    
    // Adjust position if menu would go off screen
    let left = x;
    let top = y;
    
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 5;
    }
    
    if (top + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 5;
    }
    
    // Show the context menu at the adjusted position
    mapContextMenu.style.left = left + 'px';
    mapContextMenu.style.top = top + 'px';
    mapContextMenu.classList.remove('hidden');
  });

  // Hide the map context menu when clicking anywhere else
  map.on('click', function() {
    mapContextMenu.classList.add('hidden');
    rightClickPoint = null;
  });

  // Add unit marker when clicking the menu item
  addUnitMarkerBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent the click from bubbling up
    if (rightClickPoint) {
      openMultipleMarkersModal();
    }
  });

  // Parts functionality
  const partNameInput = document.getElementById('part-name');
  const partNumberInput = document.getElementById('part-number');
  const partReplacementDateInput = document.getElementById('part-replacement-date');
  const saveNewPartBtn = document.getElementById('save-new-part-btn');
  const showAddPartsBtn = document.getElementById('show-add-parts-btn');
  const addPartsInput = document.getElementById('add-parts-input');
  const partsList = document.getElementById('parts-list');
  const partsHistoryContainer = document.getElementById('parts-history');
  let editingPartIndex = -1; // Track index of part being edited

  // Show add parts input
  showAddPartsBtn.addEventListener('click', () => {
    addPartsInput.classList.remove('hidden');
    showAddPartsBtn.classList.add('hidden');
    editingPartIndex = -1; // Reset editing index when adding new part
    saveNewPartBtn.textContent = 'Save Part'; // Ensure button text is correct
  });

  // Add part functionality
  saveNewPartBtn.addEventListener('click', () => {
    const partName = partNameInput.value.trim();
    const partNumber = partNumberInput.value.trim();
    const replacementDate = partReplacementDateInput.value;

    if (partName && partNumber && currentMarker && currentMarker.markerData) {
      const now = new Date();

      if (editingPartIndex !== -1) {
        // Update existing part
        currentMarker.markerData.parts[editingPartIndex] = {
          name: partName,
          number: partNumber,
          replacementDate: replacementDate,
          addedDate: currentMarker.markerData.parts[editingPartIndex].addedDate
        };
      } else {
        // Add new part
        const newPart = {
          name: partName,
          number: partNumber,
          replacementDate: replacementDate,
          addedDate: now
        };
        
        currentMarker.markerData.parts.push(newPart);
        currentMarker.markerData.history.parts.unshift({
          date: now,
          action: 'added',
          part: newPart
        });
      }

      // Clear inputs and update display
      partNameInput.value = '';
      partNumberInput.value = '';
      partReplacementDateInput.value = '';
      addPartsInput.classList.add('hidden');
      showAddPartsBtn.classList.remove('hidden');
      populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn);
      updatePartsHistory(partsHistoryContainer, currentMarker);
      saveMapProgress(); // Save state after updating parts
    }
  });

  // Details tab functionality
  const unitBrandInput = document.getElementById('unit-brand');
  const unitModelInput = document.getElementById('unit-model');
  const unitSerialInput = document.getElementById('unit-serial');
  const unitMfgDateInput = document.getElementById('unit-mfg-date');
  const unitFreonTypeSelect = document.getElementById('unit-freon-type');
  const saveDetailsBtn = document.getElementById('save-details-btn');
  const editDetailsBtn = document.getElementById('edit-details-btn');
  const detailsDisplay = document.getElementById('details-display');
  const detailsGrid = document.querySelector('.details-grid');

  editDetailsBtn.addEventListener('click', () => {
    // Show editable inputs
    unitBrandInput.disabled = false;
    unitModelInput.disabled = false;
    unitSerialInput.disabled = false;
    unitMfgDateInput.disabled = false;
    unitFreonTypeSelect.disabled = false;

    // Show save button, hide edit button
    editDetailsBtn.style.display = 'none';
    saveDetailsBtn.style.display = 'inline-block';

    // Hide details display, show editable grid
    detailsDisplay.style.display = 'none';
    detailsGrid.style.display = 'grid';
  });

  saveDetailsBtn.addEventListener('click', () => {
    if (currentMarker && currentMarker.markerData) {
      // Store details with the marker
      currentMarker.markerData.details = {
        brand: unitBrandInput.value.trim(),
        model: unitModelInput.value.trim(),
        serial: unitSerialInput.value.trim(),
        mfgDate: unitMfgDateInput.value,
        freonType: unitFreonTypeSelect.value
      };

      // Disable inputs
      unitBrandInput.disabled = true;
      unitModelInput.disabled = true;
      unitSerialInput.disabled = true;
      unitMfgDateInput.disabled = true;
      unitFreonTypeSelect.disabled = true;

      // Hide save button, show edit button
      editDetailsBtn.style.display = 'inline-block';
      saveDetailsBtn.style.display = 'none';

      // Create a formatted details string for easy copying
      const formattedDetails = `
UNIT DETAILS:
Brand:        ${currentMarker.markerData.details.brand || 'N/A'}
Model:        ${currentMarker.markerData.details.model || 'N/A'}
Serial:       ${currentMarker.markerData.details.serial || 'N/A'}
Mfg Date:     ${currentMarker.markerData.details.mfgDate || 'N/A'}
Freon Type:   ${currentMarker.markerData.details.freonType || 'N/A'}`.trim();

      // Update details display
      detailsDisplay.textContent = formattedDetails;

      // Hide editable grid, show details display
      detailsGrid.style.display = 'none';
      detailsDisplay.style.display = 'block';
      saveMapProgress(); // Save state after updating details
    }
  });

  function populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn) {
    partsList.innerHTML = ''; // Clear existing parts
    if (currentMarker && currentMarker.markerData && currentMarker.markerData.parts) {
      currentMarker.markerData.parts.forEach((part, index) => {
        const partEntry = document.createElement('li');
        partEntry.classList.add('part-entry');
        partEntry.innerHTML = `
          <div>
            <span class="part-name">${part.name}</span>
            <span class="part-number">(${part.number})</span>
            ${part.replacementDate ? `<span class="part-replacement-date">Replaced: ${part.replacementDate}</span>` : ''}
          </div>
          <div class="part-actions">
            <button class="btn btn-secondary edit-part-btn" data-part-index="${index}">Edit</button>
            <button class="btn btn-secondary delete-part-btn" data-part-index="${index}">Delete</button>
          </div>
        `;
        partsList.appendChild(partEntry);

        // Add event listener for delete button
        const deleteButton = partEntry.querySelector('.delete-part-btn');
        deleteButton.addEventListener('click', () => {
          const partIndex = parseInt(deleteButton.dataset.partIndex, 10);
          if (partIndex !== undefined && partIndex >= 0 && partIndex < currentMarker.markerData.parts.length) {
            // Add to history before removing
            const now = new Date();
            currentMarker.markerData.history.parts.unshift({
              date: now,
              action: 'deleted',
              part: currentMarker.markerData.parts[partIndex]
            });

            currentMarker.markerData.parts.splice(partIndex, 1); // Remove part from array
            populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn);
            updatePartsHistory(partsHistoryContainer, currentMarker);
            saveMapProgress(); // Save state after deleting part
          }
        });

        // Add event listener for edit button
        const editButton = partEntry.querySelector('.edit-part-btn');
        editButton.addEventListener('click', () => {
          const partToEdit = currentMarker.markerData.parts[index];
          partNameInput.value = partToEdit.name;
          partNumberInput.value = partToEdit.number;
          partReplacementDateInput.value = partToEdit.replacementDate || ''; // Handle cases where replacementDate might be undefined
          addPartsInput.classList.remove('hidden');
          showAddPartsBtn.classList.add('hidden');
          editingPartIndex = index; // Set the index being edited
          saveNewPartBtn.textContent = 'Update Part'; // Change button text to indicate edit mode

          // When editing, remove the current part entry so it can be replaced
          currentMarker.markerData.parts.splice(index, 1);
        });
      });
    }
  }

  // Update the existing save part functionality
  saveNewPartBtn.addEventListener('click', () => {
    const partName = partNameInput.value.trim();
    const partNumber = partNumberInput.value.trim();
    const replacementDate = partReplacementDateInput.value;

    if (partName && partNumber && currentMarker && currentMarker.markerData) {
      const now = new Date();

      if (!currentMarker.markerData.parts) {
        currentMarker.markerData.parts = [];
      }

      if (!currentMarker.markerData.history) {
        currentMarker.markerData.history = { status: [], parts: [] };
      }

      const newPart = {
        name: partName,
        number: partNumber,
        replacementDate: replacementDate,
        addedDate: now
      };
      
      currentMarker.markerData.parts.push(newPart);
      currentMarker.markerData.history.parts.unshift({
        date: now,
        action: editingPartIndex !== -1 ? 'updated' : 'added',
        part: newPart
      });

      // Reset inputs and UI
      partNameInput.value = '';
      partNumberInput.value = '';
      partReplacementDateInput.value = '';
      addPartsInput.classList.add('hidden');
      showAddPartsBtn.classList.remove('hidden');
      editingPartIndex = -1; // Reset editing index
      
      populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn);
      updatePartsHistory(partsHistoryContainer, currentMarker);
      saveMapProgress();
    }
  });

  function updateStatusHistory(container, marker) {
    if (marker && marker.markerData && marker.markerData.history) {
      container.innerHTML = '';
      marker.markerData.history.status.forEach(entry => {
        const historyEntry = document.createElement('div');
        historyEntry.classList.add('history-entry');
        
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        historyEntry.innerHTML = `
          <span class="history-date">${formattedDate}</span>
          <span class="history-status status-text status-${entry.status}">${entry.status.toUpperCase()}</span>
          ${entry.notes ? `<span class="history-notes">"${entry.notes}"</span>` : ''}
        `;
        
        container.appendChild(historyEntry);
      });
    }
  }

  function updatePartsHistory(container, marker) {
    if (marker && marker.markerData && marker.markerData.history) {
      container.innerHTML = '';
      marker.markerData.history.parts.forEach(entry => {
        const historyEntry = document.createElement('div');
        historyEntry.classList.add('history-entry');
        
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        historyEntry.innerHTML = `
          <span class="history-date">${formattedDate}</span>
          <span class="history-part">${entry.part.name} (${entry.part.number})</span>
          ${entry.part.replacementDate ? `<span class="history-replacement-date">Replaced: ${entry.part.replacementDate}</span>` : ''}
        `;
        
        container.appendChild(historyEntry);
      });
    }
  }

  function showContextMenu(event) {
    if (currentMarker && currentMarker.markerData) {
      // Create a new context menu for this marker
      const newContextMenu = document.getElementById('context-menu').cloneNode(true);
      newContextMenu.id = `context-menu-${currentMarker.markerData.unitId}`;
      newContextMenu.classList.remove('hidden');
      document.body.appendChild(newContextMenu);

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get context menu dimensions
      const menuWidth = 400; // Width defined in CSS
      const menuHeight = Math.min(newContextMenu.scrollHeight, window.innerHeight * 0.8); // 80% of viewport height max

      // Calculate initial position
      let left = event.containerPoint.x;
      let top = event.containerPoint.y;

      // Adjust horizontal position if menu would overflow right edge
      if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 10; // 10px padding from edge
      }
      // Ensure menu doesn't overflow left edge
      left = Math.max(10, left);

      // Adjust vertical position if menu would overflow bottom edge
      if (top + menuHeight > viewportHeight) {
        top = viewportHeight - menuHeight - 10; // 10px padding from edge
      }
      // Ensure menu doesn't overflow top edge
      top = Math.max(10, top);

      // Position the menu
      newContextMenu.style.left = `${left}px`;
      newContextMenu.style.top = `${top}px`;

      // Make the menu draggable
      makeDraggable(newContextMenu);

      // Set up close button
      const closeBtn = newContextMenu.querySelector('.close-btn');
      closeBtn.addEventListener('click', () => {
        newContextMenu.remove();
      });

      // Set up the header with unit ID and buttons
      const unitIdDisplay = newContextMenu.querySelector('#unit-id-display');
      unitIdDisplay.textContent = currentMarker.markerData.unitId;

      // Set up edit button
      const editBtn = newContextMenu.querySelector('.edit-unit-id-btn');
      editBtn.addEventListener('click', () => {
        const newUnitId = prompt("Enter new UNIT-ID:", currentMarker.markerData.unitId);
        if (newUnitId !== null && newUnitId.trim() !== '') {
          currentMarker.markerData.unitId = newUnitId.trim();
          unitIdDisplay.textContent = newUnitId.trim();
          saveMapProgress();
        }
      });

      // Set up delete button
      const deleteBtn = newContextMenu.querySelector('.delete-marker-btn');
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete ${currentMarker.markerData.unitId}? This action cannot be undone.`)) {
          map.removeLayer(currentMarker);
          newContextMenu.remove();
          saveMapProgress();
        }
      });

      // Set up tabs
      const tabButtons = newContextMenu.querySelectorAll('.tab');
      const tabPanels = newContextMenu.querySelectorAll('.tab-panel');

      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const tabId = button.dataset.tab;
          tabButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          tabPanels.forEach(panel => panel.classList.remove('active'));
          newContextMenu.querySelector(`#${tabId}-tab`).classList.add('active');
        });
      });

      // Initialize all the functionality for this context menu instance
      initializeContextMenuFunctionality(newContextMenu, currentMarker);
    }
  }

  function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = element.querySelector('.context-menu-header');
    
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      // Get the mouse cursor position at startup
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // Call a function whenever the cursor moves
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      // Calculate the new cursor position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // Set the element's new position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      // Stop moving when mouse button is released
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function initializeContextMenuFunctionality(newContextMenu, currentMarker) {
    const currentStatusDisplay = newContextMenu.querySelector('#current-status-display');
    const latestNotesDisplay = newContextMenu.querySelector('#latest-notes-display');
    const editStatusBtn = newContextMenu.querySelector('#edit-status-btn');
    const statusEditSection = newContextMenu.querySelector('#status-edit-section');
    const saveStatusBtn = newContextMenu.querySelector('#save-status-btn');
    const unitStatusSelect = newContextMenu.querySelector('#unit-status');
    const statusNotesTextarea = newContextMenu.querySelector('#status-notes');
    const statusHistoryContainer = newContextMenu.querySelector('#status-history');
    const partsList = newContextMenu.querySelector('#parts-list');
    const partsHistoryContainer = newContextMenu.querySelector('#parts-history');
    const showAddPartsBtn = newContextMenu.querySelector('#show-add-parts-btn');
    const addPartsInput = newContextMenu.querySelector('#add-parts-input');
    const partNameInput = newContextMenu.querySelector('#part-name');
    const partNumberInput = newContextMenu.querySelector('#part-number');
    const partReplacementDateInput = newContextMenu.querySelector('#part-replacement-date');
    const saveNewPartBtn = newContextMenu.querySelector('#save-new-part-btn');
    const tabButtons = newContextMenu.querySelectorAll('.tab');
    const tabPanels = newContextMenu.querySelectorAll('.tab-panel');
    const unitBrandInput = newContextMenu.querySelector('#unit-brand');
    const unitModelInput = newContextMenu.querySelector('#unit-model');
    const unitSerialInput = newContextMenu.querySelector('#unit-serial');
    const unitMfgDateInput = newContextMenu.querySelector('#unit-mfg-date');
    const unitFreonTypeSelect = newContextMenu.querySelector('#unit-freon-type');
    const editDetailsBtn = newContextMenu.querySelector('#edit-details-btn');
    const saveDetailsBtn = newContextMenu.querySelector('#save-details-btn');
    const detailsDisplay = newContextMenu.querySelector('#details-display');
    const detailsGrid = newContextMenu.querySelector('.details-grid');

    let editingPartIndex = -1;

    // Initialize display values
    if (currentMarker.markerData) {
      // Set initial status display
      currentStatusDisplay.textContent = (currentMarker.markerData.status || 'UP').toUpperCase();
      currentStatusDisplay.className = `status-text status-${currentMarker.markerData.status || 'up'}`;
      
      // Set initial notes display
      latestNotesDisplay.textContent = currentMarker.markerData.notes ? `Notes: ${currentMarker.markerData.notes}` : '';
      latestNotesDisplay.classList.toggle('has-notes', !!currentMarker.markerData.notes);
      
      // Set initial form values
      unitStatusSelect.value = currentMarker.markerData.status || 'up';
      statusNotesTextarea.value = currentMarker.markerData.notes || '';

      // Initialize details
      if (currentMarker.markerData.details) {
        unitBrandInput.value = currentMarker.markerData.details.brand || '';
        unitModelInput.value = currentMarker.markerData.details.model || '';
        unitSerialInput.value = currentMarker.markerData.details.serial || '';
        unitMfgDateInput.value = currentMarker.markerData.details.mfgDate || '';
        unitFreonTypeSelect.value = currentMarker.markerData.details.freonType || '';
        
        const formattedDetails = `
UNIT DETAILS:
Brand:        ${currentMarker.markerData.details.brand || 'N/A'}
Model:        ${currentMarker.markerData.details.model || 'N/A'}
Serial:       ${currentMarker.markerData.details.serial || 'N/A'}
Mfg Date:     ${currentMarker.markerData.details.mfgDate || 'N/A'}
Freon Type:   ${currentMarker.markerData.details.freonType || 'N/A'}`.trim();

        detailsDisplay.textContent = formattedDetails;
      }

      // Initialize history displays
      updateStatusHistory(statusHistoryContainer, currentMarker);
      updatePartsHistory(partsHistoryContainer, currentMarker);
      populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn);
    }

    // Tab switching
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        tabPanels.forEach(panel => panel.classList.remove('active'));
        newContextMenu.querySelector(`#${tabId}-tab`).classList.add('active');
      });
    });

    // Status editing
    editStatusBtn.addEventListener('click', () => {
      statusEditSection.classList.remove('hidden');
    });

    saveStatusBtn.addEventListener('click', () => {
      if (currentMarker && currentMarker.markerData) {
        const newStatus = unitStatusSelect.value;
        const newNotes = statusNotesTextarea.value;

        currentMarker.markerData.status = newStatus;
        currentMarker.markerData.notes = newNotes;

        setMarkerIcon(currentMarker);

        currentStatusDisplay.textContent = newStatus.toUpperCase();
        currentStatusDisplay.className = `status-text status-${newStatus}`;

        latestNotesDisplay.textContent = newNotes ? `Notes: ${newNotes}` : '';
        latestNotesDisplay.classList.toggle('has-notes', !!newNotes);

        if (!currentMarker.markerData.history) {
          currentMarker.markerData.history = { status: [], parts: [] };
        }

        const now = new Date();
        const historyEntry = {
          date: now,
          status: newStatus,
          notes: newNotes
        };
        currentMarker.markerData.history.status.unshift(historyEntry);

        updateStatusHistory(statusHistoryContainer, currentMarker);
        statusEditSection.classList.add('hidden');
        saveMapProgress();
      }
    });

    // Parts functionality
    showAddPartsBtn.addEventListener('click', () => {
      addPartsInput.classList.remove('hidden');
      showAddPartsBtn.classList.add('hidden');
      editingPartIndex = -1;
      saveNewPartBtn.textContent = 'Save Part';
    });

    saveNewPartBtn.addEventListener('click', () => {
      const partName = partNameInput.value.trim();
      const partNumber = partNumberInput.value.trim();
      const replacementDate = partReplacementDateInput.value;

      if (partName && partNumber && currentMarker && currentMarker.markerData) {
        const now = new Date();

        if (!currentMarker.markerData.parts) {
          currentMarker.markerData.parts = [];
        }

        if (!currentMarker.markerData.history) {
          currentMarker.markerData.history = { status: [], parts: [] };
        }

        const newPart = {
          name: partName,
          number: partNumber,
          replacementDate: replacementDate,
          addedDate: now
        };
        
        currentMarker.markerData.parts.push(newPart);
        currentMarker.markerData.history.parts.unshift({
          date: now,
          action: editingPartIndex !== -1 ? 'updated' : 'added',
          part: newPart
        });

        partNameInput.value = '';
        partNumberInput.value = '';
        partReplacementDateInput.value = '';
        addPartsInput.classList.add('hidden');
        showAddPartsBtn.classList.remove('hidden');
        
        populatePartsList(partsList, currentMarker, editingPartIndex, partNameInput, partNumberInput, partReplacementDateInput, addPartsInput, showAddPartsBtn, saveNewPartBtn);
        updatePartsHistory(partsHistoryContainer, currentMarker);
        saveMapProgress();
      }
    });

    // Details functionality
    editDetailsBtn.addEventListener('click', () => {
      unitBrandInput.disabled = false;
      unitModelInput.disabled = false;
      unitSerialInput.disabled = false;
      unitMfgDateInput.disabled = false;
      unitFreonTypeSelect.disabled = false;

      editDetailsBtn.style.display = 'none';
      saveDetailsBtn.style.display = 'inline-block';

      detailsDisplay.style.display = 'none';
      detailsGrid.style.display = 'grid';
    });

    saveDetailsBtn.addEventListener('click', () => {
      if (currentMarker && currentMarker.markerData) {
        currentMarker.markerData.details = {
          brand: unitBrandInput.value.trim(),
          model: unitModelInput.value.trim(),
          serial: unitSerialInput.value.trim(),
          mfgDate: unitMfgDateInput.value,
          freonType: unitFreonTypeSelect.value
        };

        unitBrandInput.disabled = true;
        unitModelInput.disabled = true;
        unitSerialInput.disabled = true;
        unitMfgDateInput.disabled = true;
        unitFreonTypeSelect.disabled = true;

        editDetailsBtn.style.display = 'inline-block';
        saveDetailsBtn.style.display = 'none';

        const formattedDetails = `
UNIT DETAILS:
Brand:        ${currentMarker.markerData.details.brand || 'N/A'}
Model:        ${currentMarker.markerData.details.model || 'N/A'}
Serial:       ${currentMarker.markerData.details.serial || 'N/A'}
Mfg Date:     ${currentMarker.markerData.details.mfgDate || 'N/A'}
Freon Type:   ${currentMarker.markerData.details.freonType || 'N/A'}`.trim();

        detailsDisplay.textContent = formattedDetails;
        detailsGrid.style.display = 'none';
        detailsDisplay.style.display = 'block';
        saveMapProgress();
      }
    });
  }

  // Marker List Toggle Functionality
  const markerListToggle = document.getElementById('marker-list-toggle');
  const markerListContainer = document.getElementById('marker-list-container');
  const markerList = document.getElementById('marker-list');

  function updateMarkerList() {
    const searchInput = document.getElementById('marker-list-search').value.toLowerCase().trim();
    
    // Get filter checkbox states
    const filterUp = document.getElementById('filter-up').checked;
    const filterLimited = document.getElementById('filter-limited').checked;
    const filterDown = document.getElementById('filter-down').checked;

    markerList.innerHTML = ''; // Clear existing list
    
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.markerData) {
        const status = (layer.markerData.status || 'up').toLowerCase();
        const unitId = (layer.markerData.unitId || '').toLowerCase();
        
        // Determine if status matches selected filters
        const statusMatchesFilter = 
          (status === 'up' && filterUp) ||
          (status === 'limited' && filterLimited) ||
          (status === 'down' && filterDown);
        
        // Check if search input matches unit ID
        const searchMatch = 
          !searchInput || 
          unitId.includes(searchInput);
        
        // Only add to list if both filter and search conditions are met
        if (statusMatchesFilter && searchMatch) {
          const markerListItem = document.createElement('div');
          markerListItem.classList.add('marker-list-item');
          markerListItem.setAttribute('draggable', 'true');
          
          markerListItem.innerHTML = `
            <div>
              <span class="marker-list-item-unit-id">${layer.markerData.unitId}</span>
            </div>
            <span class="marker-list-item-status status-${status}">${status.toUpperCase()}</span>
          `;
          
          markerListItem.addEventListener('click', () => {
            // Center map on this marker and show its context menu
            map.setView(layer.getLatLng(), 20);
            currentMarker = layer;
            showContextMenu({
              containerPoint: map.latLngToContainerPoint(layer.getLatLng()),
              originalEvent: { stopPropagation: () => {} }
            });

            // Collapse the marker list
            markerListContainer.classList.remove('visible');
            markerListToggle.classList.remove('active');
          });
          
          markerList.appendChild(markerListItem);
        }
      }
    });

    // Update count or show message if no markers match
    if (markerList.children.length === 0) {
      const noResultsMessage = document.createElement('div');
      noResultsMessage.textContent = 'No units match your search or filter criteria.';
      noResultsMessage.style.padding = '10px';
      noResultsMessage.style.color = '#888';
      noResultsMessage.style.textAlign = 'center';
      markerList.appendChild(noResultsMessage);
    }
  }

  markerListToggle.addEventListener('click', () => {
    markerListContainer.classList.toggle('visible');
    markerListToggle.classList.toggle('active');
    updateMarkerList();
  });

  // Update marker list after any marker operations
  map.on('layeradd', updateMarkerList);
  map.on('layerremove', updateMarkerList);

  function setupEnhancedSaveMapProgress(originalSaveMapProgress) {
    return function() {
      if (this !== window) {
        // Prevent infinite recursion by using the original save function
        originalSaveMapProgress.call(this);
        updateMarkerList();
      }
    };
  }

  const originalSaveMapProgress = saveMapProgress;
  saveMapProgress = setupEnhancedSaveMapProgress(originalSaveMapProgress);

  const markerListSearch = document.getElementById('marker-list-search');
  const filterCheckboxes = document.querySelectorAll('.marker-list-filters input[type="checkbox"]');

  // Ensure initial list update and consistent filtering
  function setupMarkerListFilters() {
    markerListSearch.addEventListener('input', updateMarkerList);
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateMarkerList);
    });

    // Trigger initial list update
    updateMarkerList();
  }

  // Call the setup function when the map is ready
  setupMarkerListFilters();

  // Add drag and drop functionality to the marker list
  function setupMarkerListDragAndDrop() {
    const markerList = document.getElementById('marker-list');
    let draggedItem = null;

    markerList.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('marker-list-item')) {
        draggedItem = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
      }
    });

    markerList.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('marker-list-item')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.marker-list-item').forEach(item => {
          item.classList.remove('drag-over');
        });
      }
    });

    markerList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(markerList, e.clientY);
      const draggingItem = document.querySelector('.dragging');
      
      if (afterElement == null) {
        markerList.appendChild(draggingItem);
      } else {
        markerList.insertBefore(draggingItem, afterElement);
      }
    });

    markerList.addEventListener('dragenter', (e) => {
      if (e.target.classList.contains('marker-list-item') && e.target !== draggedItem) {
        e.target.classList.add('drag-over');
      }
    });

    markerList.addEventListener('dragleave', (e) => {
      if (e.target.classList.contains('marker-list-item')) {
        e.target.classList.remove('drag-over');
      }
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.marker-list-item:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  }

  // Call the setup function after the filters are set up
  function enhanceMarkerList() {
    setupMarkerListDragAndDrop();
  }

  // Enhance the marker list after setting up the filters
  setupMarkerListFilters();
  enhanceMarkerList();
  
  // Modal for multiple markers
  const multipleMarkersModal = document.getElementById('multiple-markers-modal');
  const addMarkerRowBtn = document.getElementById('add-marker-row-btn');
  const multipleMarkersContainer = document.getElementById('multiple-markers-container');
  const saveMultipleMarkersBtn = document.getElementById('save-multiple-markers-btn');
  const cancelMultipleMarkersBtn = document.getElementById('cancel-multiple-markers-btn');
  const closeModalBtn = document.querySelector('.close-modal');

  // Open modal for multiple markers
  function openMultipleMarkersModal() {
    // Reset the modal to initial state
    multipleMarkersContainer.innerHTML = `
        <div class="marker-input-row">
            <input type="text" class="unit-id-input" placeholder="UNIT-ID">
            <button class="remove-marker-row">-</button>
        </div>
    `;
    multipleMarkersModal.style.display = 'block';
  }

  // Add a new marker input row
  addMarkerRowBtn.addEventListener('click', () => {
    const newRow = document.createElement('div');
    newRow.classList.add('marker-input-row');
    newRow.innerHTML = `
        <input type="text" class="unit-id-input" placeholder="UNIT-ID">
        <button class="remove-marker-row">-</button>
    `;
    multipleMarkersContainer.appendChild(newRow);

    // Add event listener to remove button
    newRow.querySelector('.remove-marker-row').addEventListener('click', () => {
      // Don't allow removing the last row
      if (multipleMarkersContainer.children.length > 1) {
        newRow.remove();
      }
    });
  });

  // Close modal
  function closeMultipleMarkersModal() {
    multipleMarkersModal.style.display = 'none';
  }

  closeModalBtn.addEventListener('click', closeMultipleMarkersModal);
  cancelMultipleMarkersBtn.addEventListener('click', closeMultipleMarkersModal);

  // Save multiple markers
  saveMultipleMarkersBtn.addEventListener('click', () => {
    const unitIdInputs = document.querySelectorAll('.unit-id-input');
    const validUnitIds = [];

    // Validate and collect unit IDs
    unitIdInputs.forEach(input => {
      const unitId = input.value.trim();
      if (unitId) {
        validUnitIds.push(unitId);
      }
    });

    // Check if we have any valid unit IDs
    if (validUnitIds.length > 0 && rightClickPoint) {
      // Calculate spread for multiple markers
      const spreadRadius = Math.min(validUnitIds.length * 0.0001, 0.001); // Adjust spread based on number of markers

      validUnitIds.forEach((unitId, index) => {
        // Slightly offset each marker
        const offsetLat = rightClickPoint.lat + (Math.random() - 0.5) * spreadRadius;
        const offsetLng = rightClickPoint.lng + (Math.random() - 0.5) * spreadRadius;

        const marker = L.marker([offsetLat, offsetLng], {
          draggable: false,
          icon: greenIcon
        }).addTo(map)
        .on('click', function(markerEvent) {
          markerEvent.originalEvent.stopPropagation();
          if (!this.markerData) {
            this.markerData = {
              unitId: unitId,
              status: 'up',
              notes: '',
              details: {},
              parts: [],
              history: {
                status: [],
                parts: []
              }
            };
          }
          currentMarker = this;
          showContextMenu(markerEvent);
        });

        marker.markerData = {
          unitId: unitId,
          status: 'up',
          notes: '',
          details: {},
          parts: [],
          history: {
            status: [],
            parts: []
          }
        };
      });

      saveMapProgress();
      closeMultipleMarkersModal();
    }

    // Hide the map context menu
    mapContextMenu.classList.add('hidden');
    rightClickPoint = null;
  });
});