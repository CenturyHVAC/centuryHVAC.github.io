document.addEventListener('DOMContentLoaded', () => {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD_LT5zrf0xYeOUFMsP_2IvRkm9qOUuTlU",
        authDomain: "collaborative-map-bd5d5.firebaseapp.com",
        databaseURL: "https://collaborative-map-bd5d5-default-rtdb.firebaseio.com",
        projectId: "collaborative-map-bd5d5",
        storageBucket: "collaborative-map-bd5d5.appspot.com",
        messagingSenderId: "232697178794",
        appId: "1:232697178794:web:3c0d0a9c9ea4e975a8d3f6"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    const latitude = 35.31062486972806;
    const longitude = -81.84777052479605;

    // Create map with rotation plugin and context menu
    const map = L.map('map', {
        center: [latitude, longitude],
        zoom: 19,
        minZoom: 18,
        maxZoom: 20.25,
        zoomSnap: 0.25,
        rotate: true,
        rotateControl: {
            closeOnZeroBearing: false
        },
        contextmenu: true,
        contextmenuWidth: 200,
        contextmenuItems: [
            {
                text: 'Add Marker Here',
                callback: (e) => {
                    // Store the clicked location
                    window.currentMarkerLocation = e.latlng;
                    
                    // Show label modal
                    const markerLabelModal = document.getElementById('marker-label-modal');
                    const markerLabelInput = document.getElementById('marker-label-input');
                    markerLabelModal.style.display = 'block';
                    markerLabelInput.value = ''; // Clear previous input
                    markerLabelInput.focus();
                }
            },
            '-', // Separator
            {
                text: 'Center map here',
                callback: (e) => {
                    map.panTo(e.latlng);
                }
            }
        ]
    });

    // Add satellite tile layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 20.25
    }).addTo(map);

    // Get rotation slider and display
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationDisplay = document.getElementById('rotation-display');

    // Map code modal elements
    const mapCodeModal = document.getElementById('map-code-modal');
    const mapCodeDisplay = document.getElementById('map-code-display');
    const mapCodeInput = document.getElementById('map-code-input');
    const joinMapBtn = document.getElementById('join-map-btn');
    const closeMapCodeModal = document.getElementById('close-map-code-modal');

    // Function to generate a unique map code
    function generateMapCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Setup Firebase listeners for map changes
    function setupFirebaseListeners(mapCode) {
        const mapRef = database.ref(`maps/${mapCode}`);

        // Clear existing listeners if any
        mapRef.off();

        // Listen for rotation changes
        mapRef.child('rotation').on('value', (snapshot) => {
            const rotation = snapshot.val();
            map.setBearing(rotation);
            rotationSlider.value = rotation;
            rotationDisplay.textContent = `${rotation}°`;
        });

        // Listen for map center changes
        mapRef.child('center').on('value', (snapshot) => {
            const center = snapshot.val();
            if (center) {
                map.setView([center.lat, center.lng], center.zoom);
            }
        });

        // Listen for marker changes
        mapRef.child('markers').on('child_added', (snapshot) => {
            const markerData = snapshot.val();
            const marker = L.marker([markerData.lat, markerData.lng], {
                contextmenu: true,
                contextmenuItems: [
                    {
                        text: 'Remove Marker',
                        callback: function(e) {
                            // Remove from Firebase and map
                            mapRef.child(`markers/${snapshot.key}`).remove();
                            map.removeLayer(this);
                        }
                    }
                ]
            }).addTo(map);

            if (markerData.label) {
                marker.bindPopup(markerData.label).openPopup();
            }
        });

        // Listen for marker removals
        mapRef.child('markers').on('child_removed', (snapshot) => {
            // Remove marker from map if it exists
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    const latlng = layer.getLatLng();
                    const markerData = snapshot.val();
                    if (latlng.lat === markerData.lat && latlng.lng === markerData.lng) {
                        map.removeLayer(layer);
                    }
                }
            });
        });
    }

    // Show map code modal on page load
    function showMapCodeModal() {
        const mapCode = generateMapCode();
        mapCodeDisplay.textContent = mapCode;
        window.currentMapCode = mapCode;

        // Create initial map state in Firebase
        database.ref(`maps/${mapCode}`).set({
            center: { 
                lat: latitude, 
                lng: longitude,
                zoom: 19
            },
            rotation: 163,
            markers: {}
        });

        // Setup listeners for the new map
        setupFirebaseListeners(mapCode);

        mapCodeModal.style.display = 'block';
    }

    // Join map functionality
    joinMapBtn.addEventListener('click', () => {
        const inputMapCode = mapCodeInput.value.trim().toUpperCase();
        
        // Validate map code
        if (inputMapCode) {
            // Check if map exists
            database.ref(`maps/${inputMapCode}`).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    window.currentMapCode = inputMapCode;
                    mapCodeModal.style.display = 'none';

                    // Load map state from Firebase
                    const mapData = snapshot.val();
                    map.setView([mapData.center.lat, mapData.center.lng], mapData.center.zoom);
                    map.setBearing(mapData.rotation);
                    rotationSlider.value = mapData.rotation;
                    rotationDisplay.textContent = `${mapData.rotation}°`;

                    // Setup listeners for the joined map
                    setupFirebaseListeners(inputMapCode);
                } else {
                    alert('Invalid map code');
                }
            });
        }
    });

    // Rotation slider event listener
    rotationSlider.addEventListener('input', (e) => {
        const rotation = e.target.value;
        map.setBearing(rotation);
        
        // Update rotation display
        rotationDisplay.textContent = `${rotation}°`;

        // If we have an active map, update Firebase
        if (window.currentMapCode) {
            database.ref(`maps/${window.currentMapCode}/rotation`).set(rotation);
        }
    });

    // Initially set the map rotation to 163 degrees
    map.setBearing(163);
    rotationSlider.value = 163;
    rotationDisplay.textContent = '163°';

    // Marker label modal events
    const markerLabelModal = document.getElementById('marker-label-modal');
    const markerLabelInput = document.getElementById('marker-label-input');
    const saveMarkerLabel = document.getElementById('save-marker-label');
    const cancelMarkerLabel = document.getElementById('cancel-marker-label');

    saveMarkerLabel.addEventListener('click', () => {
        const label = markerLabelInput.value.trim();
        
        if (!window.currentMapCode) {
            alert('Please join or create a map first');
            return;
        }

        // Create marker with optional label
        const marker = L.marker(window.currentMarkerLocation, {
            contextmenu: true,
            contextmenuItems: [
                {
                    text: 'Remove Marker',
                    callback: function(e) {
                        // Remove from Firebase
                        const markerRef = database.ref(`maps/${window.currentMapCode}/markers`).push();
                        markerRef.remove();
                        
                        // Remove from map
                        map.removeLayer(this);
                    }
                }
            ]
        }).addTo(map);

        // Add marker to Firebase
        const markerRef = database.ref(`maps/${window.currentMapCode}/markers`).push();
        markerRef.set({
            lat: window.currentMarkerLocation.lat,
            lng: window.currentMarkerLocation.lng,
            label: label || null
        });

        // Add popup if label is provided
        if (label) {
            marker.bindPopup(label).openPopup();
        }

        // Hide modal
        markerLabelModal.style.display = 'none';
    });

    cancelMarkerLabel.addEventListener('click', () => {
        // Simply hide the modal
        markerLabelModal.style.display = 'none';
    });

    // New event listener for map code button
    const mapCodeButton = document.getElementById('map-code-button');
    mapCodeButton.addEventListener('click', () => {
        mapCodeModal.style.display = 'block';
    });

    // Close map code modal
    closeMapCodeModal.addEventListener('click', () => {
        mapCodeModal.style.display = 'none';
    });

    // Show map code modal on page load
    showMapCodeModal();
});