
  const imuCar = document.getElementById("imuCar");
  const speedRealEl = document.getElementById('speedValReal');
  const distanceEl = document.getElementById('distanceVal');
  const statusTxt = document.getElementById('statusTxt');
  const connStatus = document.getElementById('connStatus');
  const speedNeedle = document.getElementById('speedNeedle');
  const rpmNeedle = document.getElementById('rpmNeedle');
  const speedValEl = document.getElementById('speedVal');
  const rpmValEl = document.getElementById('rpmVal');
  const commandStatus = document.getElementById('commandStatus');

  const ESP32_IP = "http://10.58.215.95";

  setInterval(() => {
    fetch(ESP32_IP + "/data")
      .then(res => res.json())
      .then(data => {
        const heading = data.heading || 0;

        if (speedRealEl) speedRealEl.textContent = data.speed || 0;
        if (distanceEl) distanceEl.textContent = data.distance || 0;

        if (imuCar) {
          carAngle = heading;
          imuCar.style.transition = "transform 0.3s linear";
        }
      })
      .catch(() => console.log("Rotation fetch failed"));
  }, 1000);

  const headingEl = document.getElementById('headingVal');
  const statusEl = document.getElementById('statusVal');
  
 
  let baseAngle = 129, baseRpm = 116;
  let targetAngle = 129, targetRpm = 116;
  let currentAngle = 129, currentRpm = 116;
  let currentSpeed = 95, currentRpmNum = 3500;
  let activeDir = null;
  let carX = 0, carY = 0;
  let targetCarX = 0, targetCarY = 0;
  let carAngle = 0;
  let animId;

  const dirConfig = {
    FORWARD:  { angle: 155, rpm: 140, speed: 120, label: 'MOVING FORWARD', moveX: 0,   moveY: -50 },
    BACKWARD: { angle: 60,  rpm: 80,  speed: 55,  label: 'REVERSING',      moveX: 0,   moveY: 50 },
    LEFT:     { angle: 105, rpm: 105, speed: 75,  label: 'TURNING LEFT',   moveX: -50, moveY: 0  },
    RIGHT:    { angle: 155, rpm: 105, speed: 75,  label: 'TURNING RIGHT',  moveX: 50,  moveY: 0  },
    STOP:     { angle: 30,  rpm: 40,  speed: 0,   label: 'STOPPED',        moveX: 0,   moveY: 0  }
  };

  function lerp(a, b, t){ return a + (b - a) * t; }

  const commandMap = {
    FORWARD: ['forward', 'go-forward', 'move-forward'],
    BACKWARD: ['backward', 'back', 'reverse', 'move-back', 'move-backward'],
    LEFT: ['left', 'turn-left', 'move-left'],
    RIGHT: ['right', 'turn-right', 'move-right'],
    STOP: ['stop']
  };

  function sendCommand(cmd) {
    const endpoints = commandMap[cmd] || [cmd.toLowerCase()];
    if (commandStatus) commandStatus.textContent = `COMMAND: ${cmd}`;

    let sent = false;
    endpoints.forEach((endpoint, index) => {
      const url = `${ESP32_IP}/${endpoint}?_=${Date.now()}&r=${index}`;
      console.log('sendCommand:', url);
      if (commandStatus && index === 0) commandStatus.textContent = `COMMAND URL: ${url}`;

      const img = new Image();
      img.src = url;
      sent = true;
    });

    if (commandStatus) {
      if (sent) {
        commandStatus.textContent = `COMMAND SENT: ${endpoints.join(', ')}`;
      } else {
        commandStatus.textContent = `COMMAND FAILED: ${cmd}`;
      }
    }
  }

  function updateConnectionStatus(isConnected, statusText) {
    connStatus.textContent = isConnected ? `ESP32: ${statusText}` : 'ESP32: connected';
    connStatus.style.color = isConnected ? '#0f0' : '#f55';
  }

  function animate(){

    const jitter = (Math.random() - 0.5) * (activeDir && activeDir !== 'STOP' ? 2 : 0.6);
    currentAngle = lerp(currentAngle, targetAngle, 0.06);
    currentRpm   = lerp(currentRpm,   targetRpm,   0.06);
    speedNeedle.setAttribute('transform', `rotate(${currentAngle + jitter} 145 145)`);
    rpmNeedle.setAttribute('transform',   `rotate(${currentRpm   + jitter} 145 145)`);

    const tSpeed = activeDir ? dirConfig[activeDir].speed : 95;
    const tRpmNum = activeDir ? Math.round(dirConfig[activeDir].rpm * 35) : 3500;
    currentSpeed   = lerp(currentSpeed,  tSpeed,  0.04);
    currentRpmNum  = lerp(currentRpmNum, tRpmNum, 0.04);
    speedValEl.textContent = Math.round(currentSpeed);
    rpmValEl.textContent   = Math.round(currentRpmNum);

    carX = lerp(carX, targetCarX, 0.22);
    carY = lerp(carY, targetCarY, 0.22);
    if (imuCar) {
      imuCar.style.transform = `translate(${carX}px, ${carY}px) rotate(${carAngle}deg)`;
    }

    animId = requestAnimationFrame(animate);
  }
  animate();

  function setDir(dir){
    activeDir = dir;
    const cfg = dirConfig[dir];
    targetAngle = cfg.angle;
    targetRpm   = cfg.rpm;
    targetCarX  = cfg.moveX;
    targetCarY  = cfg.moveY;
    statusTxt.textContent = cfg.label;
    statusTxt.style.color = dir === 'STOP' ? '#f55' : '#0af';
  }

  function clearDir(){
    activeDir = null;
    targetAngle = baseAngle;
    targetRpm   = baseRpm;
    statusTxt.textContent = 'STANDBY';
    statusTxt.style.color = '#567';
    ['btnFwd','btnLeft','btnRight','btnBwd'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('pressed');
    });
  }

  const directionButtons = ['btnFwd','btnLeft','btnRight','btnBwd'].map(id => document.getElementById(id));

  directionButtons.forEach(btn => {
    if (!btn) return;
    const dir = btn.dataset.dir;
    btn.addEventListener('click', () => {
      console.log('direction click:', dir);
      directionButtons.forEach(other => {
        if (other) other.classList.toggle('pressed', other === btn);
      });
      setDir(dir);
      sendCommand(dir);
    });
  });

  const stopBtn = document.getElementById('btnStop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      console.log('stop click');
      stopBtn.classList.add('pressed');
      setDir('STOP');
      sendCommand('stop');
      setTimeout(() => stopBtn.classList.remove('pressed'), 150);
    });
  }

  document.addEventListener('keydown', e => {
    const map = { ArrowUp:'btnFwd', ArrowDown:'btnBwd', ArrowLeft:'btnLeft', ArrowRight:'btnRight', ' ':'btnStop' };
    const id = map[e.key];
    if(id){
      e.preventDefault();
      const btn = document.getElementById(id);
      if (btn) btn.click();
    }
  });

  // AUTO STATUS
  setInterval(() => {
    fetch(ESP32_IP + "/status")
      .then(res => res.text())
      .then(data => {

        updateConnectionStatus(true, data);
      })
      .catch(() => {
        updateConnectionStatus(false);
      });
  }, 2000);

  // set initial connection status text
  updateConnectionStatus(false);

  // ===== LEAFLET MAP FUNCTIONALITY =====
  let mapInstance = null;
  let mapMarker = null;
  let mapPath = [];
  let mapPolyline = null;
  let isMapVisible = false;

  const btnLocation = document.getElementById('btnLocation');
  const mapContainer = document.getElementById('mapContainer');
  const controlsArea = document.getElementById('controlsArea');

  // Initialize map (lazy load)
  function initMap() {
    if (mapInstance) return;
    
    // Create map with default location
    mapInstance = L.map('map').setView([13.0827, 80.2707], 18);
    
    // OpenStreetMap (NO API KEY needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapInstance);
    
    // Add marker
    const carIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

mapMarker = L.marker([13.0827, 80.2707], { icon: carIcon }).addTo(mapInstance);
    
    // Add polyline for path
    mapPath = [];
    mapPolyline = L.polyline(mapPath, {color: '#0af', weight: 2}).addTo(mapInstance);
  }

  // Toggle map view
  btnLocation.addEventListener('click', () => {
    isMapVisible = !isMapVisible;
    
    if (isMapVisible) {
      mapContainer.style.display = 'flex';
      controlsArea.style.display = 'none';
      btnLocation.classList.add('active');
      
      // Initialize map if not already done
      if (!mapInstance) {
        initMap();
        setTimeout(() => {
          mapInstance.invalidateSize();
        }, 100);
      } else {
        mapInstance.invalidateSize();
      }
    } else {
      mapContainer.style.display = 'none';
      controlsArea.style.display = 'flex';
      btnLocation.classList.remove('active');
    }
  });

  // Update map with ESP32 location data
  let mapUpdateInterval = null;

  function startMapUpdates() {
    if (mapUpdateInterval) clearInterval(mapUpdateInterval);
    
    mapUpdateInterval = setInterval(() => {
      if (isMapVisible && mapInstance) {
        fetch(ESP32_IP + "/data")
          .then(res => res.json())
          .then(data => {
            if (speedRealEl) speedRealEl.textContent = data.speed || 0;
if (distanceEl) distanceEl.textContent = data.distance || 0;
if (headingEl) headingEl.textContent = data.heading || 0;
if (statusEl) statusEl.textContent = data.status || "--";
            const heading = data.heading || 0;

if (imuCar) {
  carAngle = heading;
  imuCar.style.transition = "transform 0.3s linear";
}
            const lat = data.lat;
            const lon = data.lon;
            
// prevent wrong location
if (!lat || !lon || lat === 0 || lon === 0) {
  console.log("Waiting for GPS...");
  return;
}
            
            // Update marker
            if (mapMarker) {
              mapMarker.setLatLng([lat, lon]);
              if (mapMarker.getElement()) {
  mapMarker.getElement().style.transform =
    `translate(-50%, -50%) rotate(${data.heading || 0}deg)`;
}
            }
            
            // Update map view to follow marker
            if (mapInstance) {
              mapInstance.panTo([lat, lon]);
            }
            
            // Add to path
            mapPath.push([lat, lon]);
            if (mapPath.length > 500) mapPath.shift(); // Limit path to 500 points
            
            if (mapPolyline) {
              mapPolyline.setLatLngs(mapPath);
            }
          })
          .catch(err => {
            console.log("Map update failed");
          });
      }
    }, 1000);
  }

  startMapUpdates();