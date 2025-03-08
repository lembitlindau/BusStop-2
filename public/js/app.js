// DOM Elements
const stopsTabs = document.querySelector('.stops-tabs');
const selectedStopName = document.querySelector('.selected-stop-name');
const departureList = document.querySelector('.departure-list');
const addStopForm = document.getElementById('add-stop-form');
const addDepartureForm = document.getElementById('add-departure-form');
const departureStopSelect = document.getElementById('departureStop');
const manageStopSelect = document.getElementById('manageStop');
const manageDeparturesList = document.getElementById('manage-departures-list');

// Global state
let stops = [];
let selectedStopId = null;

// Initialize the application
async function init() {
    await loadStops();
    if (stops.length > 0) {
        selectStop(stops[0].id);
    }
    setupEventListeners();
}

// Load all stops from the server
async function loadStops() {
    try {
        const response = await fetch('/api/stops');
        if (!response.ok) {
            throw new Error('Failed to load stops');
        }
        stops = await response.json();
        renderStopsTabs();
        populateStopSelects();
    } catch (error) {
        console.error('Error loading stops:', error);
        showError('Ei saanud peatusi laadida');
    }
}

// Render the tabs for each stop
function renderStopsTabs() {
    stopsTabs.innerHTML = '';
    stops.forEach(stop => {
        const tab = document.createElement('div');
        tab.className = 'stop-tab';
        tab.dataset.stopId = stop.id;
        tab.textContent = stop.name;
        tab.addEventListener('click', () => selectStop(stop.id));
        stopsTabs.appendChild(tab);
    });
}

// Populate the stop select dropdowns
function populateStopSelects() {
    const selects = [departureStopSelect, manageStopSelect];
    
    selects.forEach(select => {
        select.innerHTML = '';
        stops.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.id;
            option.textContent = stop.name;
            select.appendChild(option);
        });
    });

    // Load departures for the manage section if a stop is selected
    if (manageStopSelect.value) {
        loadManageDepartures(manageStopSelect.value);
    }
}

// Select a stop and load its departures
async function selectStop(stopId) {
    selectedStopId = stopId;
    
    // Update active tab
    document.querySelectorAll('.stop-tab').forEach(tab => {
        if (parseInt(tab.dataset.stopId) === stopId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update selected stop name
    const selectedStop = stops.find(stop => stop.id === stopId);
    if (selectedStop) {
        selectedStopName.textContent = selectedStop.name;
    }
    
    // Load and display next departures
    await loadNextDepartures(stopId);
}

// Load the next 3 departures for a stop
async function loadNextDepartures(stopId) {
    try {
        departureList.innerHTML = '<div class="loader"></div>';
        
        const response = await fetch(`/api/departures/${stopId}/next`);
        if (!response.ok) {
            throw new Error('Failed to load departures');
        }
        
        const departures = await response.json();
        renderDepartures(departures);
    } catch (error) {
        console.error('Error loading departures:', error);
        departureList.innerHTML = '<li>Väljumisaegade laadimine ebaõnnestus</li>';
    }
}

// Render departures in the list
function renderDepartures(departures) {
    departureList.innerHTML = '';
    
    if (departures.length === 0) {
        const li = document.createElement('li');
        li.className = 'departure-item';
        li.textContent = 'Täna rohkem väljumisi ei ole';
        departureList.appendChild(li);
        return;
    }
    
    departures.forEach(departure => {
        const li = document.createElement('li');
        li.className = 'departure-item';
        
        const time = document.createElement('span');
        time.className = 'departure-time';
        time.textContent = departure.departure_time;
        
        li.appendChild(time);
        departureList.appendChild(li);
    });
}

// Load all departures for a stop to manage
async function loadManageDepartures(stopId) {
    try {
        manageDeparturesList.innerHTML = '<div class="loader"></div>';
        
        const response = await fetch(`/api/departures/${stopId}`);
        if (!response.ok) {
            throw new Error('Failed to load departures');
        }
        
        const departures = await response.json();
        renderManageDepartures(departures);
    } catch (error) {
        console.error('Error loading departures:', error);
        manageDeparturesList.innerHTML = '<li>Väljumisaegade laadimine ebaõnnestus</li>';
    }
}

// Render all departures for management
function renderManageDepartures(departures) {
    manageDeparturesList.innerHTML = '';
    
    if (departures.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Väljumisaegu pole';
        manageDeparturesList.appendChild(li);
        return;
    }
    
    // Sort departures by time
    departures.sort((a, b) => {
        return a.departure_time.localeCompare(b.departure_time);
    });
    
    departures.forEach(departure => {
        const li = document.createElement('li');
        
        const time = document.createElement('span');
        time.textContent = departure.departure_time;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Kustuta';
        deleteBtn.addEventListener('click', () => deleteDeparture(departure.id));
        
        li.appendChild(time);
        li.appendChild(deleteBtn);
        manageDeparturesList.appendChild(li);
    });
}

// Delete a departure
async function deleteDeparture(departureId) {
    if (!confirm('Kas olete kindel, et soovite selle väljumisaja kustutada?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/departures/${departureId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete departure');
        }
        
        // Reload departures list
        loadManageDepartures(manageStopSelect.value);
        
        // If the selected stop is the same as the managed stop, reload next departures
        if (parseInt(manageStopSelect.value) === selectedStopId) {
            loadNextDepartures(selectedStopId);
        }
    } catch (error) {
        console.error('Error deleting departure:', error);
        showError('Väljumisaja kustutamine ebaõnnestus');
    }
}

// Add a new stop
async function addStop(event) {
    event.preventDefault();
    
    const stopName = document.getElementById('stopName').value.trim();
    if (!stopName) return;
    
    try {
        const response = await fetch('/api/stops', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: stopName })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add stop');
        }
        
        const newStop = await response.json();
        document.getElementById('stopName').value = '';
        
        // Reload stops
        await loadStops();
        
        // Select the new stop
        selectStop(newStop.id);
    } catch (error) {
        console.error('Error adding stop:', error);
        showError('Peatuse lisamine ebaõnnestus');
    }
}

// Add a new departure time
async function addDeparture(event) {
    event.preventDefault();
    
    const stopId = parseInt(departureStopSelect.value);
    const departureTime = document.getElementById('departureTime').value;
    
    if (!stopId || !departureTime) return;
    
    try {
        const response = await fetch('/api/departures', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stop_id: stopId,
                departure_time: departureTime
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add departure');
        }
        
        document.getElementById('departureTime').value = '';
        
        // Reload departures if the added departure is for the selected stop
        if (stopId === selectedStopId) {
            loadNextDepartures(selectedStopId);
        }
        
        // Reload manage departures if the current manage view is for the same stop
        if (stopId === parseInt(manageStopSelect.value)) {
            loadManageDepartures(manageStopSelect.value);
        }
    } catch (error) {
        console.error('Error adding departure:', error);
        showError('Väljumisaja lisamine ebaõnnestus');
    }
}

// Show error message (simple alert for now)
function showError(message) {
    alert(message);
}

// Set up event listeners
function setupEventListeners() {
    addStopForm.addEventListener('submit', addStop);
    addDepartureForm.addEventListener('submit', addDeparture);
    
    manageStopSelect.addEventListener('change', () => {
        const stopId = parseInt(manageStopSelect.value);
        if (stopId) {
            loadManageDepartures(stopId);
        }
    });
    
    // Auto-refresh departures every minute
    setInterval(() => {
        if (selectedStopId) {
            loadNextDepartures(selectedStopId);
        }
    }, 60000);
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
