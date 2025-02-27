// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyDXWogbfI_heWojtSOP9A-dnMVTm9R9ad4",
  authDomain: "centuryhvac-7a45d.firebaseapp.com",
  databaseURL: "https://centuryhvac-7a45d-default-rtdb.firebaseio.com",
  projectId: "centuryhvac-7a45d",
  storageBucket: "centuryhvac-7a45d.firebasestorage.app",
  messagingSenderId: "668748123530",
  appId: "1:668748123530:web:a42d8778e5f238b7e94c73",
  measurementId: "G-ZPFFWN1PP4"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const markersRef = database.ref('markers');
const buildingsRef = database.ref('buildings');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');

  const unitListToggle = document.getElementById('unit-list-toggle');
  const unitListPanel = document.getElementById('unit-list-panel');
  const unitList = document.getElementById('unit-list');
  const unitCount = document.getElementById('unit-count');
  
  unitListToggle.addEventListener('click', () => {
    unitListPanel.classList.toggle('visible');
  });
 
  const latitude = 35.31062486972806;
  const longitude = -81.84743842537509 ;

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

  // Create map with rotation plugin and set specific zoom and center
  const map = L.map('map', {
    center: [latitude, longitude],
    zoom: 19,
    minZoom: 18,
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

  let markersMap = new Map(); // Store markers with their Firebase keys
  let rightClickPos = null; // Store position of right click
  let draggedItem = null; // Store the item being dragged
  let isListLocked = true; // List is locked by default
  let areMarkersLocked = true; // Add this near the top with other state variables
  let editingPartIndex = -1; // Track index of part being edited
  let currentMarker = null; // Track current marker for editing
  let globalHistoryList = [];

  // Create right-click context menu
  const mapContextMenu = document.createElement('div');
  mapContextMenu.id = 'map-context-menu';
  mapContextMenu.className = 'map-context-menu hidden';
  mapContextMenu.innerHTML = `
    <ul>
      <li id="add-unit-option">Add Unit Marker</li>
    </ul>
  `;
  document.body.appendChild(mapContextMenu);

  // Hide map context menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!mapContextMenu.contains(e.target)) {
      mapContextMenu.classList.add('hidden');
    }
  });

  // Show map context menu on right click
  map.on('contextmenu', function(e) {
    e.originalEvent.preventDefault();
    rightClickPos = e.latlng;
    
    mapContextMenu.style.left = e.originalEvent.pageX + 'px';
    mapContextMenu.style.top = e.originalEvent.pageY + 'px';
    mapContextMenu.classList.remove('hidden');
  });

  // Handle "Add Unit Marker" option
  document.getElementById('add-unit-option').addEventListener('click', () => {
    if (rightClickPos) {
      // Create marker data with complete structure
      const markerData = {
        latlng: rightClickPos,
        markerData: {
          unitId: 'UNIT-ID',
          status: 'up',
          notes: '',
          statusImageUrl: '',
          details: {
            brand: '',
            model: '',
            serial: '',
            mfgDate: '',
            freonType: ''
          },
          parts: [],
          history: {
            status: [],
            parts: []
          }
        }
      };

      // Push to Firebase and let the child_added listener handle marker creation
      markersRef.push(markerData).then(newMarkerRef => {
        const newMarkerKey = newMarkerRef.key;
        
        // Wait briefly for marker to be created and added to map
        setTimeout(() => {
          const newMarker = markersMap.get(newMarkerKey);
          if (newMarker) {
            currentMarker = newMarker;
            
            // Bind click event explicitly
            newMarker.on('click', function(e) {
              e.originalEvent.stopPropagation();
              currentMarker = this;
              showContextMenu({
                containerPoint: map.latLngToContainerPoint(newMarker.getLatLng())
              });
            });
            
            // Calculate position for context menu
            const containerPoint = map.latLngToContainerPoint(newMarker.getLatLng());
            
            // Show context menu
            showContextMenu({
              containerPoint: containerPoint
            });
          }
        }, 500);
      });

      mapContextMenu.classList.add('hidden');
      rightClickPos = null;
    }
  });

  // Close context menu when clicking outside
  const contextMenu = document.getElementById('context-menu');
  
  function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;

    try {
      // Reset all edit states
      const statusEditSection = document.getElementById('status-edit-section');
      const addPartsInput = document.getElementById('add-parts-input');
      const showAddPartsBtn = document.getElementById('show-add-parts-btn');
      const detailsGrid = document.querySelector('.details-grid');
      const detailsDisplay = document.getElementById('details-display');
      const editDetailsBtn = document.getElementById('edit-details-btn');
      const saveDetailsBtn = document.getElementById('save-details-btn');
      const statusImageContainer = document.querySelector('.status-image-container');

      // Reset tab states
      const tabButtons = document.querySelectorAll('.tab');
      const tabPanels = document.querySelectorAll('.tab-panel');
      
      // Set first tab (Status) as active, hide others
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      tabButtons[0].classList.add('active');
      tabPanels[0].classList.add('active');

      // Reset status editing
      if (statusEditSection) {
        statusEditSection.classList.add('hidden');
      }

      // Reset status image container
      if (statusImageContainer) {
        statusImageContainer.classList.remove('editing');
      }

      // Reset parts editing
      if (addPartsInput) {
        addPartsInput.classList.add('hidden');
      }
      if (showAddPartsBtn) {
        showAddPartsBtn.classList.remove('hidden');
      }

      // Reset details editing
      if (detailsGrid) {
        detailsGrid.style.display = 'none';
      }
      if (detailsDisplay) {
        detailsDisplay.style.display = 'block';
      }
      if (editDetailsBtn) {
        editDetailsBtn.style.display = 'inline-block';
      }
      if (saveDetailsBtn) {
        saveDetailsBtn.style.display = 'none';
      }

      // Reset input fields
      const inputs = contextMenu.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        if (input.type === 'text' || input.tagName === 'TEXTAREA') {
          input.value = '';
        }
      });

      // Reset status select to default
      const unitStatusSelect = document.getElementById('unit-status');
      if (unitStatusSelect) {
        unitStatusSelect.selectedIndex = 0;
      }

      // Reset editing states
      editingPartIndex = -1;

      // Hide the menu
      contextMenu.classList.add('hidden');
      contextMenu.style.transform = 'translate3d(0px, 0px, 0px)'; // Reset position
    } catch (error) {
      console.error('Error hiding context menu:', error);
    }
  }

  function showContextMenu(event) {
    const contextMenu = document.getElementById('context-menu');
    if (!currentMarker || !contextMenu) return;

    // Hide any existing context menu
    hideContextMenu();

    try {
      // Initialize marker data if needed
      if (!currentMarker.markerData) {
        currentMarker.markerData = {
          unitId: 'UNIT-ID',
          status: 'up',
          notes: '',
          statusImageUrl: '',
          details: {
            brand: '',
            model: '',
            serial: '',
            mfgDate: '',
            freonType: ''
          },
          parts: [],
          history: {
            status: [],
            parts: []
          }
        };
      }

      // Update header with current unit ID
      const headerUnitId = document.getElementById('header-unit-id');
      if (headerUnitId) {
        headerUnitId.textContent = currentMarker.markerData.unitId;
      }

      // Update current status display and notes
      const currentStatusDisplay = document.getElementById('current-status-display');
      const statusNotesTextarea = document.getElementById('status-notes');
      const latestNotesDisplay = document.getElementById('latest-notes-display');
        
      if (currentStatusDisplay) {
        currentStatusDisplay.textContent = currentMarker.markerData.status.toUpperCase();
        currentStatusDisplay.className = `status-text status-${currentMarker.markerData.status}`;
      }

      // Clear and update status notes
      if (statusNotesTextarea) {
        statusNotesTextarea.value = currentMarker.markerData.notes || '';
      }

      if (latestNotesDisplay) {
        latestNotesDisplay.textContent = currentMarker.markerData.notes ? 
            `Notes: ${currentMarker.markerData.notes}` : '';
        latestNotesDisplay.classList.toggle('has-notes', !!currentMarker.markerData.notes);
      }

      // Update status selection to match current marker
      const unitStatusSelect = document.getElementById('unit-status');
      if (unitStatusSelect) {
        unitStatusSelect.value = currentMarker.markerData.status;
      }

      // Show menu and position it
      contextMenu.classList.remove('hidden');

      // Calculate position
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = contextMenu.offsetWidth;
      const menuHeight = contextMenu.offsetHeight;

      let left, top;
      if (event.containerPoint) {
        left = event.containerPoint.x;
        top = event.containerPoint.y;
      } else if (event.originalEvent) {
        left = event.originalEvent.pageX;
        top = event.originalEvent.pageY;
      } else {
        const markerPos = map.latLngToContainerPoint(currentMarker.getLatLng());
        left = markerPos.x;
        top = markerPos.y;
      }

      // Adjust position to keep menu in viewport
      if (left + menuWidth > viewportWidth) {
        left = Math.max(0, viewportWidth - menuWidth - 10);
      }
      if (top + menuHeight > viewportHeight) {
        top = Math.max(0, viewportHeight - menuHeight - 10);
      }

      // Set position and show menu
      contextMenu.style.left = `${Math.max(10, left)}px`;
      contextMenu.style.top = `${Math.max(10, top)}px`;
      contextMenu.style.opacity = '1';

      // Refresh all panels
      populatePartsList();
      populateDetailsTab();
      updateStatusHistory();
      updatePartsHistory();

    } catch (error) {
      console.error('Error showing context menu:', error);
    }
  }

  document.addEventListener('click', (event) => {
    const contextMenu = document.getElementById('context-menu');
    const mapContextMenu = document.getElementById('map-context-menu');
    const historyListPanel = document.getElementById('history-list-panel');
    const unitListPanel = document.getElementById('unit-list-panel');
    
    // Close history list if click is outside panel and toggle button
    if (historyListPanel && !historyListPanel.contains(event.target) && 
        !document.getElementById('history-list-toggle').contains(event.target)) {
      historyListPanel.classList.remove('visible');
    }
    
    // Close context menu and unit list if click is outside all menus and not dragging
    if (contextMenu && !contextMenu.contains(event.target) && 
        mapContextMenu && !mapContextMenu.contains(event.target) && 
        unitListPanel && !unitListPanel.contains(event.target) && 
        !document.getElementById('unit-list-toggle').contains(event.target)) {
      
      // Check if we're dragging the context menu
      const isDraggingContextMenu = contextMenu.classList.contains('dragging');
      
      // Only hide if not dragging and not clicking on a marker
      const clickedOnMarker = Array.from(markersMap.values()).some(marker => 
        marker.getElement() && marker.getElement().contains(event.target)
      );
      
      if (!isDraggingContextMenu && !clickedOnMarker) {
        hideContextMenu();
      }
    }
  });

  // Load saved progress after map initialization
  function loadMapProgress() {
    const savedProgress = localStorage.getItem('mapViewState');
    
    // Always start at the hardcoded center and zoom
    map.setView([latitude, longitude], 19);
    map.setBearing(163);

    // Update rotation slider to match
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationDisplay = document.getElementById('rotation-display');
    if (rotationSlider && rotationDisplay) {
      rotationSlider.value = 163;
      rotationDisplay.textContent = '163°';
    }

    // If there's saved progress, you might want to log it or use parts of it later
    if (savedProgress) {
      console.log('Saved map progress exists, but using hardcoded center and zoom');
    }
  }

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

  if (editStatusBtn) {
    editStatusBtn.addEventListener('click', () => {
      if (statusEditSection) {
        statusEditSection.classList.remove('hidden');
      }
    });
  }

  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', () => {
      if (!currentMarker) return;

      const markerData = safeGetMarkerData(currentMarker);
      const newStatus = unitStatusSelect?.value || 'up';
      const newNotes = statusNotesTextarea?.value || '';
      const newImageUrl = document.getElementById('status-image-url')?.value?.trim() || markerData.statusImageUrl;

      // Update marker data with null checks
      currentMarker.markerData = {
        ...markerData,
        status: newStatus,
        notes: newNotes,
        statusImageUrl: newImageUrl
      };

      // Update UI elements with null checks
      setMarkerIcon(currentMarker);
      
      if (currentStatusDisplay) {
        currentStatusDisplay.textContent = newStatus.toUpperCase();
        currentStatusDisplay.className = `status-text status-${newStatus}`;
      }

      const latestNotesDisplay = document.getElementById('latest-notes-display');
      if (latestNotesDisplay) {
        latestNotesDisplay.textContent = newNotes ? `Notes: ${newNotes}` : '';
        latestNotesDisplay.classList.toggle('has-notes', !!newNotes);
      }

      const statusImage = document.querySelector('.status-image');
      if (statusImage) {
        statusImage.src = newImageUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTN3lFE1mgBbxtpLcZeDQVMNl-JX0w5cI6pzQ&s';
      }

      // Add to history with null checks
      if (!currentMarker.markerData.history) {
        currentMarker.markerData.history = { status: [], parts: [] };
      }

      const historyEntry = {
        date: new Date().toISOString(),
        status: newStatus,
        notes: newNotes
      };

      currentMarker.markerData.history.status.unshift(historyEntry);

      // Update displays and sync
      updateStatusHistory();
      if (statusEditSection) {
        statusEditSection.classList.add('hidden');
      }
      
      // Store current lock state
      const wasLocked = areMarkersLocked;
      
      syncMarkerToFirebase(currentMarker);
      
      // Ensure marker stays locked if it was locked before
      if (wasLocked) {
        currentMarker.dragging.disable();
      }
      updateGlobalHistory();
    });
  }

  // Parts functionality
  const partNameInput = document.getElementById('part-name');
  const partNumberInput = document.getElementById('part-number');
  const partReplacementDateInput = document.getElementById('part-replacement-date');
  const saveNewPartBtn = document.getElementById('save-new-part-btn');
  const showAddPartsBtn = document.getElementById('show-add-parts-btn');
  const addPartsInput = document.getElementById('add-parts-input');
  const partsList = document.getElementById('parts-list');
  const partsHistoryContainer = document.getElementById('parts-history');

  // Show add parts input
  showAddPartsBtn.addEventListener('click', () => {
    addPartsInput.classList.remove('hidden');
    showAddPartsBtn.classList.add('hidden');
    editingPartIndex = -1; // Reset editing index when adding new part
    saveNewPartBtn.textContent = 'Save Part'; // Ensure button text is correct
  });

  // Modify the save buttons to properly handle dates
  saveNewPartBtn.addEventListener('click', () => {
    const partName = partNameInput.value.trim();
    const partNumber = partNumberInput.value.trim();
    const replacementDate = partReplacementDateInput.value;

    if (partName && currentMarker && currentMarker.markerData) {
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
          addedDate: now.toISOString()
        };
        
        currentMarker.markerData.parts.push(newPart);
        currentMarker.markerData.history.parts.unshift({
          date: now.toISOString(),
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
      populatePartsList();
      updatePartsHistory();
      syncMarkerToFirebase(currentMarker);
      updateGlobalHistory();
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
      syncMarkerToFirebase(currentMarker);
    }
  });

  function populatePartsList() {
    partsList.innerHTML = ''; // Clear existing parts
    if (currentMarker?.markerData?.parts) {
      currentMarker.markerData.parts.forEach((part, index) => {
        if (!part) return; // Skip if part is undefined
    
        const partEntry = document.createElement('li');
        partEntry.classList.add('part-entry');
        partEntry.innerHTML = `
          <div>
            <span class="part-name">${part.name || ''}</span>
            ${part.number ? `<span class="part-number">(${part.number})</span>` : ''}
            ${part.replacementDate ? `<span class="part-replacement-date">Replaced: ${part.replacementDate}</span>` : ''}
          </div>
          <div class="part-actions">
            <button class="btn btn-secondary edit-part-btn" data-part-index="${index}">Edit</button>
            <button class="btn btn-secondary delete-part-btn" data-part-index="${index}">Delete</button>
          </div>
        `;
        partsList.appendChild(partEntry);

        // Add event listeners with error handling
        try {
          const deleteButton = partEntry.querySelector('.delete-part-btn');
          deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const partIndex = parseInt(deleteButton.dataset.partIndex, 10);
            if (!isNaN(partIndex) && partIndex >= 0 && partIndex < currentMarker.markerData.parts.length) {
              currentMarker.markerData.parts.splice(partIndex, 1);
              populatePartsList();
              syncMarkerToFirebase(currentMarker);
            }
          });

          const editButton = partEntry.querySelector('.edit-part-btn');
          editButton.addEventListener('click', () => {
            const partIndex = parseInt(editButton.dataset.partIndex, 10);
            if (!isNaN(partIndex) && partIndex >= 0 && partIndex < currentMarker.markerData.parts.length) {
              const partToEdit = currentMarker.markerData.parts[partIndex];
              partNameInput.value = partToEdit.name || '';
              partNumberInput.value = partToEdit.number || '';
              partReplacementDateInput.value = partToEdit.replacementDate || '';
              addPartsInput.classList.remove('hidden');
              showAddPartsBtn.classList.add('hidden');
              editingPartIndex = partIndex;
              saveNewPartBtn.textContent = 'Update Part';
            }
          });
        } catch (error) {
          console.error('Error setting up part buttons:', error);
        }
      });
    }
  }

  function populateDetailsTab() {
    try {
      if (currentMarker?.markerData) {
        // Initialize details object if it doesn't exist
        if (!currentMarker.markerData.details) {
          currentMarker.markerData.details = {
            brand: '',
            model: '',
            serial: '',
            mfgDate: '',
            freonType: ''
          };
        }

        const details = currentMarker.markerData.details;
        unitBrandInput.value = details.brand || '';
        unitModelInput.value = details.model || '';
        unitSerialInput.value = details.serial || '';
        unitMfgDateInput.value = details.mfgDate || '';
        unitFreonTypeSelect.value = details.freonType || '';

        // Populate status image URL in edit field
        const statusImageUrlInput = document.getElementById('status-image-url');
        const statusImage = document.querySelector('.status-image');
        
        if (statusImageUrlInput) {
          statusImageUrlInput.value = currentMarker.markerData.statusImageUrl || '';
        }

        if (statusImage) {
          statusImage.src = currentMarker.markerData.statusImageUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTN3lFE1mgBbxtpLcZeDQVMNl-JX0w5cI6pzQ&s';
        }

        const formattedDetails = `
UNIT DETAILS:
Brand:        ${details.brand || 'N/A'}
Model:        ${details.model || 'N/A'}
Serial:       ${details.serial || 'N/A'}
Mfg Date:     ${details.mfgDate || 'N/A'}
Freon Type:   ${details.freonType || 'N/A'}`.trim();

        detailsDisplay.textContent = formattedDetails;
      } else {
        // Reset inputs and display if no details exist
        unitBrandInput.value = '';
        unitModelInput.value = '';
        unitSerialInput.value = '';
        unitMfgDateInput.value = '';
        unitFreonTypeSelect.value = '';
        detailsDisplay.textContent = 'No details available';
      }

      // Ensure inputs are disabled by default
      unitBrandInput.disabled = true;
      unitModelInput.disabled = true;
      unitSerialInput.disabled = true;
      unitMfgDateInput.disabled = true;
      unitFreonTypeSelect.disabled = true;

      // Reset button states and visibility
      editDetailsBtn.style.display = 'inline-block';
      saveDetailsBtn.style.display = 'none';

      // Hide editable grid, show details display
      detailsGrid.style.display = 'none';
      detailsDisplay.style.display = 'block';
    } catch (error) {
      console.error('Error in populateDetailsTab:', error);
    }
  }

  function updateStatusHistory() {
    if (currentMarker?.markerData?.history?.status) {
      try {
        statusHistoryContainer.innerHTML = '';
        currentMarker.markerData.history.status.forEach(entry => {
          if (!entry) return;
          
          const historyEntry = document.createElement('div');
          historyEntry.classList.add('history-entry');
          
          const entryDate = new Date(entry.date);
          const formattedDate = !isNaN(entryDate) ? entryDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Invalid Date';

          historyEntry.innerHTML = `
            <span class="history-date">${formattedDate}</span>
            <span class="history-status status-text status-${entry.status || 'unknown'}">${(entry.status || 'UNKNOWN').toUpperCase()}</span>
            ${entry.notes ? `<span class="history-notes">"${entry.notes}"</span>` : ''}
          `;
          
          statusHistoryContainer.appendChild(historyEntry);
        });
      } catch (error) {
        console.error('Error in updateStatusHistory:', error);
        statusHistoryContainer.innerHTML = '<div class="error">Error loading status history</div>';
      }
    }
  }

  function updatePartsHistory() {
    if (currentMarker?.markerData?.history?.parts) {
      try {
        partsHistoryContainer.innerHTML = '';
        currentMarker.markerData.history.parts.forEach(entry => {
          if (!entry?.part) return;
          
          const entryDate = new Date(entry.date);
          const formattedDate = !isNaN(entryDate) ? entryDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Invalid Date';

          partsHistoryContainer.innerHTML += `
            <div class="history-entry">
              <span class="history-date">${formattedDate}</span>
              <span class="history-part">${entry.part.name || ''} (${entry.part.number || ''})</span>
              ${entry.part.replacementDate ? `<span class="history-replacement-date">Replaced: ${entry.part.replacementDate}</span>` : ''}
            </div>
          `;
        });
      } catch (error) {
        console.error('Error in updatePartsHistory:', error);
        partsHistoryContainer.innerHTML = '<div class="error">Error loading parts history</div>';
      }
    }
  }

  function syncMarkerToFirebase(marker) {
    try {
      if (!marker) {
        console.warn('No marker provided to syncMarkerToFirebase');
        return;
      }

      const markerData = safeGetMarkerData(marker);
      const data = {
        latlng: marker.getLatLng(),
        position: marker.listPosition || 0,
        markerData: markerData
      };

      if (marker.firebaseKey) {
        markersRef.child(marker.firebaseKey).set(data)
          .then(() => {
            // After successful sync, ensure marker remains locked if markers are locked
            if (areMarkersLocked) {
              marker.dragging.disable();
            }
          });
      } else {
        const newMarkerRef = markersRef.push(data);
        marker.firebaseKey = newMarkerRef.key;
        // Ensure new marker is locked if markers are locked
        if (areMarkersLocked) {
          marker.dragging.disable();
        }
      }
      updateUnitList();
    } catch (error) {
      console.error('Error syncing marker to Firebase:', error);
    }
  }

  function updateUnitCount() {
  // Count total units (excluding buildings)
  const totalUnits = document.querySelectorAll('.unit-list-item:not(.building-item)').length;

  // Count units by status
  const upUnits = document.querySelectorAll('.unit-list-item:not(.building-item) .unit-list-status.status-up').length;
  const downUnits = document.querySelectorAll('.unit-list-item:not(.building-item) .unit-list-status.status-down').length;
  const limitedUnits = document.querySelectorAll('.unit-list-item:not(.building-item) .unit-list-status.status-limited').length;

  // Update the total count for the "ALL" status
  const totalCountElement = document.getElementById('unit-count-all');
  if (totalCountElement) {
    totalCountElement.innerHTML = `(${totalUnits})`;
    totalCountElement.classList.remove('count-up', 'count-down', 'count-limited'); // Remove previous status classes
  }

  // Update the count for the "UP" status
  const upCountElement = document.getElementById('unit-count-up');
  if (upCountElement) {
    upCountElement.innerHTML = `(${upUnits})`;
    upCountElement.classList.add('count-up');  // Add the "count-up" class
  }

  // Update the count for the "DOWN" status
  const downCountElement = document.getElementById('unit-count-down');
  if (downCountElement) {
    downCountElement.innerHTML = `(${downUnits})`;
    downCountElement.classList.add('count-down');  // Add the "count-down" class
  }

  // Update the count for the "LIMITED" status
  const limitedCountElement = document.getElementById('unit-count-limited');
  if (limitedCountElement) {
    limitedCountElement.innerHTML = `(${limitedUnits})`;
    limitedCountElement.classList.add('count-limited');  // Add the "count-limited" class
  }
}


  function updateUnitList() {
    const searchInput = document.getElementById('unit-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const activeFilter = document.querySelector('.status-filter-btn.active')?.dataset.status || 'all';

    // Clear existing units but keep buildings
    const existingUnits = document.querySelectorAll('.unit-list-item:not(.building-item)');
    existingUnits.forEach(unit => unit.remove());

    // Get all markers and sort by position
    const sortedMarkers = Array.from(markersMap.entries())
      .sort(([,a], [,b]) => (a.listPosition || 0) - (b.listPosition || 0));

    sortedMarkers.forEach(([key, marker]) => {
      const unitId = marker.markerData?.unitId || 'UNIT-ID';
      const status = marker.markerData?.status || 'up';
      
      // Apply filters
      const matchesSearch = unitId.toLowerCase().includes(searchTerm);
      const matchesStatus = activeFilter === 'all' || status === activeFilter;
      
      if (matchesSearch && matchesStatus) {
        const li = document.createElement('li');
        li.className = 'unit-list-item';
        li.draggable = !isListLocked;
        li.dataset.position = marker.listPosition || 0;
        li.dataset.unitKey = key;

        li.innerHTML = `
          <span class="unit-id">${unitId}</span>
          <span class="unit-list-status status-text status-${status}">${status.toUpperCase()}</span>
          <button class="delete-unit-btn" data-unit-key="${key}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;

        // Update click handler for the list item
        li.addEventListener('click', (e) => {
          if (!e.target.classList.contains('delete-unit-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const unitKey = li.dataset.unitKey;
            
            if (unitKey && markersMap.has(unitKey)) {
              const marker = markersMap.get(unitKey);
              currentMarker = marker;

              // Pan and zoom to the marker with maximum zoom
              map.setView(marker.getLatLng(), 20.25, {  
                animate: true,
                duration: 1
              });

              // Show context menu
              const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
              showContextMenu({
                containerPoint: markerPoint
              });

              // Hide unit list panel
              const unitListPanel = document.getElementById('unit-list-panel');
              if (unitListPanel) {
                unitListPanel.classList.remove('visible');
              }
            }
          }
        });

        // Add delete button event listener
        const deleteBtn = li.querySelector('.delete-unit-btn');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const unitKey = deleteBtn.dataset.unitKey;
          
          // Remove from Firebase
          if (unitKey) {
            markersRef.child(unitKey).remove().then(() => {
              // Marker removal will be handled by Firebase listener
              console.log('Unit deleted successfully');
            }).catch((error) => {
              console.error('Error deleting unit:', error);
            });
          }
        });

        // Insert at the correct position
        const items = Array.from(unitList.children);
        const insertPosition = items.findIndex(item => 
          Number(item.dataset.position) > Number(marker.listPosition || 0)
        );

        if (insertPosition === -1) {
          unitList.appendChild(li);
        } else {
          unitList.insertBefore(li, items[insertPosition]);
        }
      }
    });

    updateUnitCount();
    updateLockState();
  }

  unitList.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('unit-list-item')) {
      const items = Array.from(unitList.children);
      items.forEach((item, index) => {
        const position = index; // Use simple index instead of timestamp
        item.dataset.position = position;

        // Handle units
        if (!item.classList.contains('building-item')) {
          const unitKey = item.querySelector('.delete-unit-btn')?.dataset.unitKey;
          if (unitKey && markersMap.has(unitKey)) {
            const marker = markersMap.get(unitKey);
            marker.listPosition = position;
            // Update Firebase with the new position
            markersRef.child(unitKey).update({
              position: position
            });
          }
        }
        // Handle buildings
        else {
          const buildingKey = item.dataset.buildingKey;
          if (buildingKey) {
            buildingsRef.child(buildingKey).update({
              position: position
            });
          }
        }
      });
    }
  });

  function addBuildingToFirebase(buildingName) {
    if (buildingName.trim()) {
      // Get the current number of items to use as position
      const currentItems = document.querySelectorAll('.unit-list-item').length;
      buildingsRef.push({
        name: buildingName,
        position: currentItems
      }).then(() => {
        const buildingNameInput = document.getElementById('building-name-input');
        if (buildingNameInput) {
          buildingNameInput.value = '';
        }
      });
    }
  }

  document.getElementById('add-building-button').addEventListener('click', () => {
    const buildingNameInput = document.getElementById('building-name-input');
    const buildingName = buildingNameInput.value.trim();
    if (buildingName) {
      addBuildingToFirebase(buildingName);
    }
  });

  function addBuildingToUI(buildingData, buildingKey) {
    // Check if building already exists
    const existingBuilding = document.querySelector(`[data-building-key="${buildingKey}"]`);
    if (existingBuilding) {
      return;
    }

    const li = document.createElement('li');
    li.className = 'unit-list-item building-item';
    li.draggable = !isListLocked;
    li.dataset.buildingKey = buildingKey;
    li.dataset.position = buildingData.position || 0;

    li.innerHTML = `
      <span class="unit-id">${buildingData.name}</span>
      <button class="delete-building-btn" data-key="${buildingKey}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    const deleteBtn = li.querySelector('.delete-building-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      buildingsRef.child(buildingKey).remove();
      li.remove();
      updateUnitCount();
    });

    // Insert at the correct position
    const items = Array.from(unitList.children);
    const insertPosition = items.findIndex(item => 
      Number(item.dataset.position) > Number(buildingData.position)
    );

    if (insertPosition === -1) {
      unitList.appendChild(li);
    } else {
      unitList.insertBefore(li, items[insertPosition]);
    }
    updateLockState();
  }

  function updateBuildingList() {
    // Clear existing buildings first
    const existingBuildings = document.querySelectorAll('.building-item');
    existingBuildings.forEach(building => building.remove());
    
    buildingsRef.once('value').then(snapshot => {
      const buildings = [];
      snapshot.forEach(childSnapshot => {
        buildings.push({
          key: childSnapshot.key,
          data: childSnapshot.val()
        });
      });
      
      // Sort buildings by position before adding to UI
      buildings.sort((a, b) => (a.data.position || 0) - (b.data.position || 0));
      
      buildings.forEach(building => {
        addBuildingToUI(building.data, building.key);
      });
      updateUnitCount();
    });
  }

  function initializeBuildingsListener() {
    buildingsRef.off(); // Remove any existing listeners
    
    buildingsRef.on('child_added', (snapshot) => {
      const buildingData = snapshot.val();
      addBuildingToUI(buildingData, snapshot.key);
      updateUnitCount();
    });

    buildingsRef.on('child_removed', (snapshot) => {
      const buildingElement = document.querySelector(`[data-building-key="${snapshot.key}"]`);
      if (buildingElement) {
        buildingElement.remove();
        updateUnitCount();
      }
    });

    buildingsRef.on('child_changed', (snapshot) => {
      const buildingElement = document.querySelector(`[data-building-key="${snapshot.key}"]`);
      if (buildingElement) {
        const nameElement = buildingElement.querySelector('.unit-id');
        if (nameElement) {
          nameElement.textContent = snapshot.val().name;
        }
        buildingElement.dataset.position = snapshot.val().position || 0;
        updateBuildingList(); // Refresh list to ensure correct positioning
      }
    });
  }

  // Initialize Firebase listeners after map is ready
  function initializeFirebaseListeners() {
    // Listen for new markers
    markersRef.on('child_added', (snapshot) => {
      const key = snapshot.key;
      const data = snapshot.val();
      if (!markersMap.has(key)) {
        const marker = createMarkerFromData(key, data);
        // Ensure marker is locked on creation
        marker.dragging.disable();
        updateUnitList();
      }
    });

    // Listen for marker updates
    markersRef.on('child_changed', (snapshot) => {
      const key = snapshot.key;
      const data = snapshot.val();
      const marker = markersMap.get(key);
      if (marker) {
        marker.setLatLng(data.latlng);
        marker.markerData = data.markerData;
        setMarkerIcon(marker);
        updateUnitList();
      }
      updateGlobalHistory();
    });

    // Listen for marker deletions
    markersRef.on('child_removed', (snapshot) => {
      const key = snapshot.key;
      const marker = markersMap.get(key);
      if (marker) {
        map.removeLayer(marker);
        markersMap.delete(key);
        updateUnitList();
      }
      updateGlobalHistory();
    });
  }

  initializeFirebaseListeners();

  map.on('contextmenu', function(e) {
    e.originalEvent.preventDefault(); // Prevent default right-click
    return false;
  });

  initializeBuildingsListener();
  updateUnitList();
  updateBuildingList(); // Initial load of buildings

  function initializeStatusFilters() {
    const statusFilters = document.querySelectorAll('.status-filter-btn');
  
    statusFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        statusFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update list
        updateUnitList();
      });
    });
  }

  initializeStatusFilters();

  // Save map progress when rotation changes
  function saveMapProgress() {
    if (map) {
      const mapState = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing()
      };
      localStorage.setItem('mapViewState', JSON.stringify(mapState));
    }
  }

  // Modify the edit unit ID handler
  const editUnitIdBtn = document.getElementById('edit-unit-id-btn');
  editUnitIdBtn.addEventListener('click', () => {
    const headerUnitId = document.getElementById('header-unit-id');
    if (!headerUnitId) return;

    const currentId = headerUnitId.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'unit-id-input';
    input.value = currentId;
    
    headerUnitId.replaceWith(input);
    input.focus();
    input.select();

    let isSaving = false;

    const saveChanges = () => {
      if (isSaving) return;
      isSaving = true;

      const input = document.getElementById('unit-id-input');
      if (!input) return;

      const newId = input.value.trim();
      
      // Create new header element
      const headerUnitId = document.createElement('span');
      headerUnitId.id = 'header-unit-id';
      headerUnitId.textContent = newId || currentId;

      // Get the container and existing input
      const container = document.getElementById('context-menu-header');
      const existingInput = document.getElementById('unit-id-input');
      
      // Only proceed if elements exist
      if (container && existingInput) {
        existingInput.replaceWith(headerUnitId);
      }

      // Update marker and UI if we have a valid new ID
      if (currentMarker && newId) {
        currentMarker.markerData.unitId = newId;
        syncMarkerToFirebase(currentMarker);
        updateUnitList();
      }
    };

    const handleBlur = () => {
      saveChanges();
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keypress', handleKeypress);
    };

    const handleKeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveChanges();
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('keypress', handleKeypress);
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keypress', handleKeypress);
  });

  // Function to create a marker
  function createMarkerFromData(key, data) {
    const marker = L.marker(data.latlng, {
      draggable: false // Explicitly set draggable to false when creating
    }).addTo(map);
    
    marker.markerData = {
      unitId: data.markerData?.unitId || 'UNIT-ID',
      status: data.markerData?.status || 'up',
      notes: data.markerData?.notes || '',
      statusImageUrl: data.markerData?.statusImageUrl || '',
      details: {
        brand: data.markerData?.details?.brand || '',
        model: data.markerData?.details?.model || '',
        serial: data.markerData?.details?.serial || '',
        mfgDate: data.markerData?.details?.mfgDate || '',
        freonType: data.markerData?.details?.freonType || ''
      },
      parts: data.markerData?.parts || [],
      history: {
        status: data.markerData?.history?.status || [],
        parts: data.markerData?.history?.parts || []
      }
    };
    
    marker.firebaseKey = key;
    marker.listPosition = data.position || 0;

    // Make sure dragging is disabled
    marker.dragging.disable();

    // Track if marker is being dragged
    let isDragging = false;

    // Add dragstart event listener
    marker.on('dragstart', function() {
      isDragging = true;
    });

    // Update drag end event listener
    marker.on('dragend', function(e) {
      if (!areMarkersLocked) {
        const newPos = e.target.getLatLng();
        if (marker.firebaseKey) {
          markersRef.child(marker.firebaseKey).update({
            latlng: newPos
          }).catch(error => {
            console.error('Error updating marker position:', error);
            marker.setLatLng(data.latlng);
          });
        }
      }
      // Reset drag state after a short delay
      setTimeout(() => {
        isDragging = false;
      }, 10);
    });

    // Set marker click handler
    marker.on('click', function(e) {
      e.originalEvent.stopPropagation();
      // Only show context menu if not dragging
      if (!isDragging) {
        currentMarker = this;
        const containerPoint = map.latLngToContainerPoint(this.getLatLng());
        showContextMenu({
          containerPoint: containerPoint
        });
      }
    });

    const opacitySlider = document.getElementById('opacity-slider');
    const opacity = opacitySlider?.value || 100;
    const size = document.getElementById('size-slider')?.value || 40;

    const markerIcon = marker.getElement();
    if (markerIcon) {
      markerIcon.style.opacity = opacity / 100;
      const markerIconImg = markerIcon.querySelector('.marker-icon');
      if (markerIconImg) {
        markerIconImg.style.width = `${size}px`;
        markerIconImg.style.height = `${size}px`;
      }
    }
    setMarkerIcon(marker);
    markersMap.set(key, marker);
    return marker;
  }

  function initializeMarkerLockToggle() {
    const markerLockToggle = document.getElementById('marker-lock-toggle');
    const rotationControl = document.getElementById('rotation-control');
    
    // Set initial state to locked
    areMarkersLocked = true;
    
    // Force all existing markers to be locked
    markersMap.forEach(marker => {
      marker.dragging.disable();
    });
    
    // Update initial UI state to show locked
    markerLockToggle.classList.add('locked');
    
    // Initially hide rotation control since markers are locked
    rotationControl.style.display = 'none';
    
    markerLockToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
    
    markerLockToggle.addEventListener('click', () => {
      areMarkersLocked = !areMarkersLocked;
      markerLockToggle.classList.toggle('locked');
      
      // Update all existing markers
      markersMap.forEach(marker => {
        if (areMarkersLocked) {
          marker.dragging.disable();
        } else {
          marker.dragging.enable();
        }
      });
      
      // Show/hide rotation control based on lock state
      rotationControl.style.display = areMarkersLocked ? 'none' : 'block';
      
      // Update the lock icon
      markerLockToggle.innerHTML = areMarkersLocked ? `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      ` : `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>
      `;
    });
  }

  initializeMarkerLockToggle();

  // Create marker controls HTML section with new Save Settings button
  const markerControls = document.createElement('div');
  markerControls.id = 'marker-controls';
  markerControls.innerHTML = `
   
  
  <div class="control-group" 
       style="display: flex; align-items: center; justify-content: center; width: 90%; gap: 5x;">
    
    <!-- Opacity Slider -->
    <label style="text-align: center;">Opacity:</label>
    <input type="range" id="opacity-slider" min="1" max="100" value="100" 
      style="width: 30%; min-width: 40%;">
    <span id="opacity-value" style="text-align: center;">100%</span>

    <!-- Size Slider -->
    <label style="text-align: center;">Size:</label>
    <input type="range" id="size-slider" min="20" max="100" value="40" 
      style="width: 30%; min-width: 40%;">
    <span id="size-value" style="text-align: center;">40px</span>

  </div>

  <button id="marker-controls-save-btn" class="btn" 
    style="margin-top: 5px; align-self: flex-end;">Save Settings</button>
</div>

  `;
  document.body.appendChild(markerControls);

  // Retrieve control elements
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityValue = document.getElementById('opacity-value');
  const sizeSlider = document.getElementById('size-slider');
  const sizeValue = document.getElementById('size-value');

  // Load saved marker settings, if available
  const savedOpacity = localStorage.getItem('markerOpacity');
  const savedSize = localStorage.getItem('markerSize');
  if (savedOpacity) {
    opacitySlider.value = savedOpacity;
    opacityValue.textContent = `${savedOpacity}%`;
  }
  if (savedSize) {
    sizeSlider.value = savedSize;
    sizeValue.textContent = `${savedSize}px`;
  }

  // Function to update markers based on slider values
  function updateMarkers() {
    markersMap.forEach(marker => {
      const markerIcon = marker.getElement();
      if (markerIcon) {
        const opacity = opacitySlider.value / 100;
        markerIcon.style.opacity = opacity;
        
        const size = sizeSlider.value;
        const markerIconImg = markerIcon.querySelector('.marker-icon');
        if (markerIconImg) {
          markerIconImg.style.width = `${size}px`;
          markerIconImg.style.height = `${size}px`;
        }
      }
    });
  }

  // Event listeners for sliders
  opacitySlider.addEventListener('input', (e) => {
    const opacity = e.target.value;
    opacityValue.textContent = `${opacity}%`;
    updateMarkers();
  });

  sizeSlider.addEventListener('input', (e) => {
    const size = e.target.value;
    sizeValue.textContent = `${size}px`;
    updateMarkers();
  });

  // New: Save button event listener for marker controls
  const markerControlsSaveBtn = document.getElementById('marker-controls-save-btn');
  if (markerControlsSaveBtn) {
    markerControlsSaveBtn.addEventListener('click', () => {
      const opacity = opacitySlider.value;
      const size = sizeSlider.value;
      localStorage.setItem('markerOpacity', opacity);
      localStorage.setItem('markerSize', size);
      alert('Marker settings saved locally!');
    });
  }

  // Toggle button for marker controls (existing code)
  const markerControlsToggle = document.getElementById('marker-controls-toggle');
  if (markerControlsToggle) {
    markerControlsToggle.addEventListener('click', () => {
      const markerControls = document.getElementById('marker-controls');
      if (markerControls) {
        markerControls.classList.toggle('visible');
      }
    });
  }

  // Function to set marker icon based on status
  function setMarkerIcon(marker) {
    if (marker.markerData) {
      let status = marker.markerData.status;
      let icon;

      // Add right-click handling for markers
      marker.off('contextmenu'); // Remove any existing handler
      marker.on('contextmenu', function(e) {
        e.originalEvent.preventDefault(); // Prevent default right-click

        // Create and show a simple marker context menu
        let markerMenu = document.createElement('div');
        markerMenu.className = 'marker-context-menu';
        markerMenu.innerHTML = `
          <ul>
            <li id="delete-marker-option">Delete Marker</li>
          </ul>
        `;
        
        // Position menu at click location
        markerMenu.style.left = e.originalEvent.pageX + 'px';
        markerMenu.style.top = e.originalEvent.pageY + 'px';
        
        // Remove any existing marker menus
        document.querySelectorAll('.marker-context-menu').forEach(menu => menu.remove());
        
        // Add menu to document
        document.body.appendChild(markerMenu);
        
        // Handle delete option click
        document.getElementById('delete-marker-option').addEventListener('click', () => {
          if (marker.firebaseKey) {
            markersRef.child(marker.firebaseKey).remove();
          }
          map.removeLayer(marker);
          markersMap.delete(marker.firebaseKey);
          markerMenu.remove();
        });
        
        // Close menu when clicking elsewhere
        document.addEventListener('click', function closeMenu(e) {
          if (!markerMenu.contains(e.target)) {
            markerMenu.remove();
            document.removeEventListener('click', closeMenu);
          }
        });
      });

      // Set the icon based on the marker's status
      if (status === 'down') {
        icon = L.divIcon({
          className: "custom-marker",
          html: `<img src="https://i.postimg.cc/t4xb9vZc/down.png" class="marker-icon" style="width:40px;height:40px;">`,
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
      } else if (status === 'limited') {
        icon = L.divIcon({
          className: "custom-marker",
          html: `<img src="https://i.postimg.cc/J4HvXDrD/limited.png" class="marker-icon" style="width:40px;height:40px;">`,
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
      } else if (status === 'up') {
        icon = L.divIcon({
          className: "custom-marker",
          html: `<img src="https://i.postimg.cc/HkHJDmRn/UP.png" class="marker-icon" style="width:40px;height:40px;">`,
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        });
      } else {
        icon = L.divIcon({
          className: "custom-marker",
          html: `<img src="https://i.postimg.cc/HkHJDmRn/UP.png" class="marker-icon" style="width:40px;height:40px;">`,
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        }); // Default to 'up' if status is unknown
      }

      // Set the icon
      marker.setIcon(icon);
    }

    const opacity = document.getElementById('opacity-slider')?.value || 100;
    const size = document.getElementById('size-slider')?.value || 40;

    const markerIcon = marker.getElement();
    if (markerIcon) {
      markerIcon.style.opacity = opacity / 100;
      const markerIconImg = markerIcon.querySelector('.marker-icon');
      if (markerIconImg) {
        markerIconImg.style.width = `${size}px`;
        markerIconImg.style.height = `${size}px`;
      }
    }
  }

  // Helper function to handle undefined and null cases
  function safeGetMarkerData(marker) {
    if (!marker || !marker.markerData) {
      return {
        unitId: 'UNIT-ID',
        status: 'up',
        notes: '',
        statusImageUrl: '',
        details: {
          brand: '',
          model: '',
          serial: '',
          mfgDate: '',
          freonType: ''
        },
        parts: [],
        history: {
          status: [],
          parts: []
        }
      };
    }
    return marker.markerData;
  }

  // Add search input event listener
  const searchInput = document.getElementById('unit-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateUnitList();
    });
  }

  function updateHistoryList() {
    const historyList = document.getElementById('history-list');
    const searchTerm = document.getElementById('history-search')?.value.toLowerCase() || '';
    const activeFilter = document.querySelector('.history-filter-btn.active')?.dataset.type || 'all';
    const startDate = document.getElementById('history-date-start')?.value;
    const endDate = document.getElementById('history-date-end')?.value;

    historyList.innerHTML = '';

    let filteredHistory = [...globalHistoryList];

    // Apply date range filter if dates are selected
    if (startDate || endDate) {
      filteredHistory = filteredHistory.filter(entry => {
        const entryDate = new Date(entry.date);
        
        if (startDate && endDate) {
          return entryDate >= new Date(startDate) && entryDate <= new Date(endDate + 'T23:59:59');
        } else if (startDate) {
          return entryDate >= new Date(startDate);
        } else if (endDate) {
          return entryDate <= new Date(endDate + 'T23:59:59');
        }
        return true;
      });
    }

    // Apply other filters
    filteredHistory = filteredHistory.filter(entry => {
      return (activeFilter === 'all' || entry.type === activeFilter) &&
             (entry.unitId.toLowerCase().includes(searchTerm) ||
              (entry.notes && entry.notes.toLowerCase().includes(searchTerm)));
    });

    filteredHistory.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'history-item';
    
      const date = new Date(entry.date).toLocaleString();
    
      if (entry.type === 'status') {
        li.innerHTML = `
          <div class="history-item-header">
            <span class="history-item-unit">${entry.unitId}</span>
            <span class="history-item-type status">Status Update</span>
          </div>
          <div class="history-item-content">
           <div class="status-text status-${entry.status}" style="margin-bottom: 8px;">
    ${entry.status.toUpperCase()}
</div>

            ${entry.notes ? `<div class="history-item-notes">"${entry.notes}"</div>` : ''}
          </div>
          <div class="history-item-date">${date}</div>
        `;
      } else {
        li.innerHTML = `
          <div class="history-item-header">
            <span class="history-item-unit">${entry.unitId}</span>
            <span class="history-item-type parts">Parts Update</span>
          </div>
          <div class="history-item-content">
            <div>${entry.action.toUpperCase()}: ${entry.part.name}</div>
            ${entry.part.number ? `<div>Part #: ${entry.part.number}</div>` : ''}
          </div>
          <div class="history-item-date">${date}</div>
        `;
      }
    
      // Add click handler to navigate to unit
      li.addEventListener('click', () => {
        const marker = Array.from(markersMap.values()).find(m => m.markerData?.unitId === entry.unitId);
        if (marker) {
          currentMarker = marker;
          map.setView(marker.getLatLng(), 20.25, {
            animate: true,
            duration: 1
          });
          showContextMenu({
            containerPoint: map.latLngToContainerPoint(marker.getLatLng())
          });
          document.getElementById('history-list-panel').classList.remove('visible');
        }
      });
    
      historyList.appendChild(li);
    });
  }

  document.getElementById('history-list-toggle').addEventListener('click', () => {
    const historyListPanel = document.getElementById('history-list-panel');
    historyListPanel.classList.toggle('visible');
    
    // Hide unit list if it's visible
    document.getElementById('unit-list-panel').classList.remove('visible');
    
    // Update history list when showing panel
    if (historyListPanel.classList.contains('visible')) {
      updateGlobalHistory();
    }
  });

  document.getElementById('history-search').addEventListener('input', updateHistoryList);

  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateHistoryList();
    });
  });

  const applyDateFilter = document.getElementById('apply-date-filter');
  if (applyDateFilter) {
    applyDateFilter.addEventListener('click', () => {
      updateHistoryList();
    });
  }

  function updateGlobalHistory() {
    globalHistoryList = [];
    
    markersMap.forEach((marker, key) => {
      const unitId = marker.markerData?.unitId || 'UNIT-ID';
      
      // Add status history
      if (marker.markerData?.history?.status) {
        marker.markerData.history.status.forEach(entry => {
          globalHistoryList.push({
            type: 'status',
            unitId: unitId,
            date: entry.date,
            status: entry.status,
            notes: entry.notes
          });
        });
      }
      
      // Add parts history
      if (marker.markerData?.history?.parts) {
        marker.markerData.history.parts.forEach(entry => {
          globalHistoryList.push({
            type: 'parts',
            unitId: unitId,
            date: entry.date,
            action: entry.action,
            part: entry.part
          });
        });
      }
    });
    
    // Sort by date, most recent first
    globalHistoryList.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    updateHistoryList();
  }

  function initializeListLockToggle() {
    const toggleLockButton = document.getElementById('toggle-lock-button');
    const unitListItems = document.querySelectorAll('.unit-list-item');
    
    // Set initial state
    updateLockState();
    
    toggleLockButton.addEventListener('click', (e) => {
      // Prevent event from bubbling up to collapsible header
      e.stopPropagation();
      
      isListLocked = !isListLocked;
      updateLockState();
      
      // Update the lock icon
      toggleLockButton.innerHTML = isListLocked ? `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      ` : `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
        </svg>
      `;
    });
  }

  function updateLockState() {
    const unitListItems = document.querySelectorAll('.unit-list-item');
    unitListItems.forEach(item => {
      item.draggable = !isListLocked;
      if (isListLocked) {
        item.classList.add('locked');
      } else {
        item.classList.remove('locked');
      }
    });
  }

  unitList.addEventListener('dragstart', (e) => {
    if (isListLocked || !e.target.classList.contains('unit-list-item')) {
      e.preventDefault();
      return;
    }
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  });

  initializeListLockToggle();
  initializeStatusFilters();

  const dateFilterContainer = document.getElementById('date-filter-container');
  if (dateFilterContainer) {
    dateFilterContainer.classList.add('collapsed');
  }

  const collapsibleHeader = document.querySelector('#date-filter-container .collapsible-header');
  if (collapsibleHeader) {
    collapsibleHeader.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dateFilterContainer.classList.toggle('collapsed');
    });
  }
});