import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getDatabase, ref, set, onValue, push, remove } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDXWogbfI_heWojtSOP9A-dnMVTm9R9ad4",
    authDomain: "centuryhvac-7a45d.firebaseapp.com",
    projectId: "centuryhvac-7a45d",
    storageBucket: "centuryhvac-7a45d.firebasestorage.app",
    messagingSenderId: "668748123530",
    appId: "1:668748123530:web:a42d8778e5f238b7e94c73",
    measurementId: "G-ZPFFWN1PP4",
    databaseURL: "https://centuryhvac-7a45d-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    // Connection status elements
    const connectionStatus = document.getElementById('connection-status');

    // Map configuration
    const latitude = 35.31062486972806;
    const longitude = -81.84777052479605;

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
                    window.currentMarkerLocation = e.latlng;
                    
                    const markerLabelModal = document.getElementById('marker-label-modal');
                    const markerLabelInput = document.getElementById('marker-label-input');
                    markerLabelModal.style.display = 'block';
                    markerLabelInput.value = '';
                    markerLabelInput.focus();
                }
            },
            '-',
            {
                text: 'Center map here',
                callback: (e) => {
                    map.panTo(e.latlng);
                    syncMapState();
                }
            }
        ]
    });

    // Satellite tile layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 20.25
    }).addTo(map);

    // Rotation controls
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationDisplay = document.getElementById('rotation-display');

    // Initial map state
    map.setBearing(163);
    rotationSlider.value = 163;
    rotationDisplay.textContent = '163°';

    // Sync function for map state
    function syncMapState() {
        const mapState = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            bearing: map.getBearing()
        };
        
        set(ref(database, 'mapState'), mapState);
    }

    // Listen for map state changes from Firebase
    onValue(ref(database, 'mapState'), (snapshot) => {
        const mapState = snapshot.val();
        if (mapState) {
            map.setView(mapState.center, mapState.zoom);
            map.setBearing(mapState.bearing);
            
            // Update UI
            rotationSlider.value = mapState.bearing;
            rotationDisplay.textContent = `${mapState.bearing}°`;
        }
    });

    // Rotation slider event
    rotationSlider.addEventListener('input', (e) => {
        const rotation = e.target.value;
        map.setBearing(rotation);
        rotationDisplay.textContent = `${rotation}°`;
        syncMapState();
    });

    // Markers synchronization
    const markersRef = ref(database, 'markers');

    // Save marker to Firebase
    function saveMarkerToFirebase(latlng, label) {
        const newMarkerRef = push(markersRef);
        set(newMarkerRef, {
            lat: latlng.lat,
            lng: latlng.lng,
            label: label
        });
    }

    // Listen for markers from Firebase
    onValue(markersRef, (snapshot) => {
        // Clear existing markers first
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Add markers from Firebase
        snapshot.forEach((childSnapshot) => {
            const markerData = childSnapshot.val();
            const marker = L.marker([markerData.lat, markerData.lng], {
                contextmenu: true,
                contextmenuItems: [
                    {
                        text: 'Remove Marker',
                        callback: function() {
                            remove(childSnapshot.ref);
                        }
                    }
                ]
            }).addTo(map);

            if (markerData.label) {
                marker.bindPopup(markerData.label).openPopup();
            }
        });
    });

    // Marker label modal events
    const markerLabelModal = document.getElementById('marker-label-modal');
    const markerLabelInput = document.getElementById('marker-label-input');
    const saveMarkerLabel = document.getElementById('save-marker-label');
    const cancelMarkerLabel = document.getElementById('cancel-marker-label');

    saveMarkerLabel.addEventListener('click', () => {
        const label = markerLabelInput.value.trim();
        
        saveMarkerToFirebase(window.currentMarkerLocation, label);

        // Hide modal
        markerLabelModal.style.display = 'none';
    });

    cancelMarkerLabel.addEventListener('click', () => {
        markerLabelModal.style.display = 'none';
    });

    // Connection state monitoring
    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.style.backgroundColor = 'rgba(0,255,0,0.7)';
        } else {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.style.backgroundColor = 'rgba(255,0,0,0.7)';
        }
    });
});