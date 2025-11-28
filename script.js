let scene, camera, renderer, model;
let raycaster, mouse;
let measurementMode = null;
let selectedPoints = [];
let pointMarkers = [];
let lineMarkers = [];
let measurements = [];
let rotation = { x: 0, y: 0 };
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let currentUnit = 'mm';
let measurementCounter = { angle: 1, distance: 1 };

// Angle measurement objects
let angleOrigin = null;
let angleLine1 = null;
let permanentLines = [];

const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const angle1Btn = document.getElementById('angle1Btn');
const angle2Btn = document.getElementById('angle2Btn');
const angle3Btn = document.getElementById('angle3Btn');
const angle4Btn = document.getElementById('angle4Btn');
const b1Btn = document.getElementById('b1Btn');
const b2Btn = document.getElementById('b2Btn');
const cHeightBtn = document.getElementById('cHeightBtn');
const clearBtn = document.getElementById('clearBtn');
const unitSelect = document.getElementById('unitSelect');
const infoDiv = document.getElementById('info');
const statusDiv = document.getElementById('status');
const measurementsDiv = document.getElementById('measurements');
const placeholder = document.getElementById('placeholder');
const toggleViewBtn = document.getElementById('toggleViewBtn');
const toggleIcon = document.getElementById('toggleIcon');
const canvasContainer = document.getElementById('canvasContainer');

canvas.oncontextmenu = () => false;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xBAB7E2);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 100);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Event listeners
    fileInput.addEventListener('change', handleFileUpload);
    angle1Btn.addEventListener('click', () => toggleMeasurementMode('angle1'));
    angle2Btn.addEventListener('click', () => toggleMeasurementMode('angle2'));
    angle3Btn.addEventListener('click', () => toggleMeasurementMode('angle3'));
    angle4Btn.addEventListener('click', () => toggleMeasurementMode('angle4'));
    b1Btn.addEventListener('click', () => toggleMeasurementMode('b1'));
    b2Btn.addEventListener('click', () => toggleMeasurementMode('b2'));
    cHeightBtn.addEventListener('click', () => toggleMeasurementMode('cheight'));
    clearBtn.addEventListener('click', clearMeasurements);
    unitSelect.addEventListener('change', handleUnitChange);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    window.addEventListener('resize', handleResize);
    toggleViewBtn.addEventListener('click', toggleCanvasView);

    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        loadSTL(e.target.result);
        placeholder.style.display = 'none';
        infoDiv.textContent = `Loaded: ${file.name}`;
        angle1Btn.disabled = false;
        angle2Btn.disabled = false;
        angle3Btn.disabled = false;
        angle4Btn.disabled = false;
        b1Btn.disabled = false;
        b2Btn.disabled = false;
        cHeightBtn.disabled = false;
        
        // Show measurement controls
        angleControls.style.display = 'flex';
        distanceControls.style.display = 'flex';
    };
    reader.readAsArrayBuffer(file);
}

function loadSTL(arrayBuffer) {
    if (model) {
        scene.remove(model);
    }

    const geometry = parseSTL(arrayBuffer);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        color: 0x58BDDC,
        specular: 0x111111,
        shininess: 200
    });

    model = new THREE.Mesh(geometry, material);
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.z = maxDim * 2;
}

function parseSTL(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const isASCII = arrayBuffer.byteLength > 5 && 
        String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), 
        view.getUint8(3), view.getUint8(4)) === 'solid';

    return isASCII ? parseSTLASCII(arrayBuffer) : parseSTLBinary(arrayBuffer);
}

function parseSTLBinary(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const triangles = view.getUint32(80, true);
    
    const vertices = [];
    const normals = [];

    for (let i = 0; i < triangles; i++) {
        const offset = 84 + i * 50;
        
        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);

        for (let j = 0; j < 3; j++) {
            const vOffset = offset + 12 + j * 12;
            vertices.push(
                view.getFloat32(vOffset, true),
                view.getFloat32(vOffset + 4, true),
                view.getFloat32(vOffset + 8, true)
            );
            normals.push(nx, ny, nz);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
}

function parseSTLASCII(arrayBuffer) {
    const text = new TextDecoder().decode(arrayBuffer);
    const vertices = [];
    
    const vertexPattern = /vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/g;
    let match;
    
    while ((match = vertexPattern.exec(text)) !== null) {
        vertices.push(
            parseFloat(match[1]),
            parseFloat(match[2]),
            parseFloat(match[3])
        );
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
}

function toggleMeasurementMode(mode) {
    if (measurementMode === mode) {
        measurementMode = null;
        angle1Btn.classList.remove('active');
        angle2Btn.classList.remove('active');
        angle3Btn.classList.remove('active');
        angle4Btn.classList.remove('active');
        b1Btn.classList.remove('active');
        b2Btn.classList.remove('active');
        cHeightBtn.classList.remove('active');
        statusDiv.textContent = '';
        canvas.style.cursor = 'grab';
        clearAngleTools();
    } else {
        measurementMode = mode;
        angle1Btn.classList.toggle('active', mode === 'angle1');
        angle2Btn.classList.toggle('active', mode === 'angle2');
        angle3Btn.classList.toggle('active', mode === 'angle3');
        angle4Btn.classList.toggle('active', mode === 'angle4');
        b1Btn.classList.toggle('active', mode === 'b1');
        b2Btn.classList.toggle('active', mode === 'b2');
        cHeightBtn.classList.toggle('active', mode === 'cheight');
        canvas.style.cursor = 'crosshair';
        updateStatus();
        
        if (mode === 'b1' || mode === 'b2' || mode === 'cheight') {
            clearAngleTools();
        }
    }
    clearSelection();
}

function updateStatus() {
    if (measurementMode === 'b1' || measurementMode === 'b2' || measurementMode === 'cheight') {
        statusDiv.textContent = `Click 2 points to measure distance (${selectedPoints.length}/2 selected)`;
    } else if (measurementMode === 'angle1' || measurementMode === 'angle2' || 
               measurementMode === 'angle3' || measurementMode === 'angle4') {
        if (!angleOrigin) {
            statusDiv.textContent = 'Click on the model to place angle origin (center point)';
        } else {
            statusDiv.textContent = 'Click on the model to measure angle from X-axis';
        }
    }
}

function handleCanvasClick(event) {
    if (!measurementMode || !model) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        
        if (measurementMode === 'b1' || measurementMode === 'b2' || measurementMode === 'cheight') {
            addPointMarker(point);
            selectedPoints.push(point);
            updateStatus();

            if (selectedPoints.length === 2) {
                calculateDistance(measurementMode);
                clearSelection();
                toggleMeasurementMode(measurementMode);
            }
        } else if (measurementMode === 'angle1' || measurementMode === 'angle2' || 
                   measurementMode === 'angle3' || measurementMode === 'angle4') {
            if (!angleOrigin) {
                // First click: create origin and axes
                createAngleTool(point);
            } else {
                // Second click: create measurement line and calculate angle
                angleLine1 = createAngleLine(angleOrigin, point, 0xff0000);
                const marker = createEndMarker(point, 0xff0000);
                pointMarkers.push(marker);
                finalizeAngleMeasurement(point, measurementMode);
            }
        }
    }
}

function createAngleTool(origin) {
    angleOrigin = origin.clone();
    
    // Create origin marker (green center point)
    const originGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const originMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const originMarker = new THREE.Mesh(originGeometry, originMaterial);
    originMarker.position.copy(angleOrigin);
    scene.add(originMarker);
    pointMarkers.push(originMarker);
    
    // Create 4 reference axes (X, X', Y, Y')
    const length = 25;
    
    // X axis (positive, gray)
    const xAxisEnd = angleOrigin.clone().add(new THREE.Vector3(length, 0, 0));
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0x808080, linewidth: 2, opacity: 0.6, transparent: true });
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([angleOrigin, xAxisEnd]);
    const xAxisLine = new THREE.Line(xAxisGeometry, xAxisMaterial);
    scene.add(xAxisLine);
    lineMarkers.push(xAxisLine);
    
    // X' axis (negative, gray)
    const xAxisEndNeg = angleOrigin.clone().add(new THREE.Vector3(-length, 0, 0));
    const xAxisGeometryNeg = new THREE.BufferGeometry().setFromPoints([angleOrigin, xAxisEndNeg]);
    const xAxisLineNeg = new THREE.Line(xAxisGeometryNeg, xAxisMaterial);
    scene.add(xAxisLineNeg);
    lineMarkers.push(xAxisLineNeg);
    
    // Y axis (positive, gray)
    const yAxisEnd = angleOrigin.clone().add(new THREE.Vector3(0, length, 0));
    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([angleOrigin, yAxisEnd]);
    const yAxisLine = new THREE.Line(yAxisGeometry, xAxisMaterial);
    scene.add(yAxisLine);
    lineMarkers.push(yAxisLine);
    
    // Y' axis (negative, gray)
    const yAxisEndNeg = angleOrigin.clone().add(new THREE.Vector3(0, -length, 0));
    const yAxisGeometryNeg = new THREE.BufferGeometry().setFromPoints([angleOrigin, yAxisEndNeg]);
    const yAxisLineNeg = new THREE.Line(yAxisGeometryNeg, xAxisMaterial);
    scene.add(yAxisLineNeg);
    lineMarkers.push(yAxisLineNeg);
    
    statusDiv.textContent = 'Axes created. Click on the model to place first measurement point.';
}

function createAngleLine(start, end, color) {
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lineMarkers.push(line);
    return line;
}

function createEndMarker(position, color) {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    scene.add(marker);
    return marker;
}

function finalizeAngleMeasurement(endPoint, mode) {
    if (!angleLine1 || !angleOrigin) return;
    
    // Project points to 2D (XY plane) for accurate angle calculation
    const origin2D = new THREE.Vector2(angleOrigin.x, angleOrigin.y);
    const end2D = new THREE.Vector2(endPoint.x, endPoint.y);
    
    // Calculate vector from origin to endpoint in 2D
    const measurementVector = new THREE.Vector2().subVectors(end2D, origin2D);
    
    // Calculate angle from positive X-axis
    let angle = 90 - (Math.atan2(measurementVector.y, measurementVector.x) * 180 / Math.PI);

    // Normalize to 0-360 degrees
    if (angle < 0) angle += 360;
    
    // Convert to angle <= 90 degrees
    let displayAngle = angle;
    if (angle > 90 && angle <= 180) {
        displayAngle = 180 - angle;
    } else if (angle > 180 && angle <= 270) {
        displayAngle = angle - 180;
    } else if (angle > 270) {
        displayAngle = 360 - angle;
    }
    
    // Determine label based on mode
    let label;
    if (mode === 'angle1') label = 'Angle 1';
    else if (mode === 'angle2') label = 'Angle 2';
    else if (mode === 'angle3') label = 'Angle 3';
    else if (mode === 'angle4') label = 'Angle 4';

    // Store the measurement
    const measurement = {
        type: 'angle',
        label: label,
        value: displayAngle.toFixed(2),
        unit: '°',
        rawAngle: angle.toFixed(2),
        points: [
            { x: angleOrigin.x.toFixed(2), y: angleOrigin.y.toFixed(2), z: angleOrigin.z.toFixed(2) },
            { x: endPoint.x.toFixed(2), y: endPoint.y.toFixed(2), z: endPoint.z.toFixed(2) }
        ],
        visualElements: {
            origin: angleOrigin.clone(),
            end: endPoint.clone()
        }
    };
    
    measurements.push(measurement);
    
    // Create permanent visual lines for this measurement
    createPermanentAngleVisuals(angleOrigin, endPoint, measurements.length - 1);
    
    // Disable the button after measurement
    if (mode === 'angle1') angle1Btn.disabled = true;
    else if (mode === 'angle2') angle2Btn.disabled = true;
    else if (mode === 'angle3') angle3Btn.disabled = true;
    else if (mode === 'angle4') angle4Btn.disabled = true;
    
    updateMeasurementsDisplay();
    
    // Clear temporary tools
    clearSelection();
    clearAngleTools();
    toggleMeasurementMode(mode);
}

function createPermanentAngleVisuals(origin, end, measurementIndex) {
    // Create permanent origin marker (green center)
    const originGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const originMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const originMarker = new THREE.Mesh(originGeometry, originMaterial);
    originMarker.position.copy(origin);
    scene.add(originMarker);
    
    // Create permanent 4 reference axes (X, X', Y, Y')
    const length = 25;
    const axesMaterial = new THREE.LineBasicMaterial({ color: 0x808080, linewidth: 2, opacity: 0.6, transparent: true });
    
    // X axis
    const xAxisEnd = origin.clone().add(new THREE.Vector3(length, 0, 0));
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([origin, xAxisEnd]);
    const xAxisLine = new THREE.Line(xAxisGeometry, axesMaterial);
    scene.add(xAxisLine);
    
    // X' axis (negative)
    const xAxisEndNeg = origin.clone().add(new THREE.Vector3(-length, 0, 0));
    const xAxisGeometryNeg = new THREE.BufferGeometry().setFromPoints([origin, xAxisEndNeg]);
    const xAxisLineNeg = new THREE.Line(xAxisGeometryNeg, axesMaterial);
    scene.add(xAxisLineNeg);
    
    // Y axis
    const yAxisEnd = origin.clone().add(new THREE.Vector3(0, length, 0));
    const yAxisGeometry = new THREE.BufferGeometry().setFromPoints([origin, yAxisEnd]);
    const yAxisLine = new THREE.Line(yAxisGeometry, axesMaterial);
    scene.add(yAxisLine);
    
    // Y' axis (negative)
    const yAxisEndNeg = origin.clone().add(new THREE.Vector3(0, -length, 0));
    const yAxisGeometryNeg = new THREE.BufferGeometry().setFromPoints([origin, yAxisEndNeg]);
    const yAxisLineNeg = new THREE.Line(yAxisGeometryNeg, axesMaterial);
    scene.add(yAxisLineNeg);
    
    // Create permanent measurement line (red)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    
    // Create permanent end marker (red)
    const endGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const endMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const endMarker = new THREE.Mesh(endGeometry, endMaterial);
    endMarker.position.copy(end);
    scene.add(endMarker);
    
    // Store references for deletion
    permanentLines.push({
        measurementIndex: measurementIndex,
        elements: [originMarker, xAxisLine, xAxisLineNeg, yAxisLine, yAxisLineNeg, line, endMarker]
    });
}

function clearAngleTools() {
    angleOrigin = null;
    angleLine1 = null;
}

function addPointMarker(point) {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(point);
    scene.add(marker);
    pointMarkers.push(marker);

    // Add line if we have a previous point
    if (selectedPoints.length > 0) {
        addLine(selectedPoints[selectedPoints.length - 1], point);
    }
}

function addLine(point1, point2) {
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
    const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lineMarkers.push(line);
}

function clearSelection() {
    selectedPoints = [];
    pointMarkers.forEach(marker => scene.remove(marker));
    pointMarkers = [];
    lineMarkers.forEach(line => scene.remove(line));
    lineMarkers = [];
}

function calculateDistance(mode) {
    const distance = selectedPoints[0].distanceTo(selectedPoints[1]);
    const convertedDistance = convertUnits(distance);
    
    // Determine label based on mode
    let label;
    if (mode === 'b1') label = 'B1';
    else if (mode === 'b2') label = 'B2';
    else if (mode === 'cheight') label = 'C';
    
    const measurementIndex = measurements.length;

    measurements.push({
        type: 'distance',
        label: label,
        value: convertedDistance.toFixed(2),
        unit: currentUnit,
        rawValue: distance,
        points: selectedPoints.map(p => ({ 
            x: p.x.toFixed(2), 
            y: p.y.toFixed(2), 
            z: p.z.toFixed(2) 
        }))
    });
    
    // Create permanent visual elements for distance measurement
    createPermanentDistanceVisuals(selectedPoints[0], selectedPoints[1], measurementIndex);
    
    // Disable the button after measurement
    if (mode === 'b1') b1Btn.disabled = true;
    else if (mode === 'b2') b2Btn.disabled = true;
    else if (mode === 'cheight') cHeightBtn.disabled = true;
    
    updateMeasurementsDisplay();
}

function createPermanentDistanceVisuals(point1, point2, measurementIndex) {
    // Create permanent markers
    const marker1Geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const marker1Material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker1 = new THREE.Mesh(marker1Geometry, marker1Material);
    marker1.position.copy(point1);
    scene.add(marker1);
    
    const marker2Geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const marker2Material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker2 = new THREE.Mesh(marker2Geometry, marker2Material);
    marker2.position.copy(point2);
    scene.add(marker2);
    
    // Create permanent line
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    
    // Store references for deletion
    permanentLines.push({
        measurementIndex: measurementIndex,
        elements: [marker1, marker2, line]
    });
}

function convertUnits(value) {
    // Assuming the model units are in mm
    switch(currentUnit) {
        case 'mm': return value;
        case 'cm': return value / 10;
        case 'm': return value / 1000;
        case 'in': return value / 25.4;
        default: return value;
    }
}

function handleUnitChange() {
    currentUnit = unitSelect.value;
    // Recalculate all distance measurements with new unit
    measurements = measurements.map(m => {
        if (m.type === 'distance' && m.rawValue !== undefined) {
            const convertedValue = convertUnits(m.rawValue);
            return {
                ...m,
                value: convertedValue.toFixed(2),
                unit: currentUnit
            };
        }
        return m;
    });
    updateMeasurementsDisplay();
}

// Taper 3 lookup table
const taper3Table = {
    2: { 3: 16, 4: 12, 5: 10, 6: 8, 7: 7, 8: 6, 9: 6, 10: 5, 11: 5, 12: 4, 13: 4 },
    3: { 3: 24, 4: 18, 5: 14, 6: 12, 7: 10, 8: 9, 9: 8, 10: 7, 11: 7, 12: 6, 13: 6 },
    4: { 3: 33, 4: 24, 5: 19, 6: 16, 7: 14, 8: 12, 9: 11, 10: 10, 11: 9, 12: 8, 13: 8 },
    5: { 3: 33, 4: 31, 5: 24, 6: 20, 7: 17, 8: 15, 9: 12, 10: 11, 11: 11, 12: 10, 13: 9 },
    6: { 3: 28, 4: 37, 5: 29, 6: 24, 7: 21, 8: 18, 9: 16, 10: 14, 11: 13, 12: 12, 13: 11 },
    7: { 3: 24, 4: 32, 5: 35, 6: 28, 7: 24, 8: 21, 9: 19, 10: 17, 11: 15, 12: 14, 13: 13 },
    8: { 3: 21, 4: 38, 5: 33, 6: 28, 7: 24, 8: 22, 9: 19, 10: 17, 11: 16, 12: 15, 13: 14 },
    9: { 3: 19, 4: 25, 5: 31, 6: 37, 7: 21, 8: 27, 9: 24, 10: 22, 11: 20, 12: 18, 13: 17 },
    10: { 3: 17, 4: 23, 5: 28, 6: 33, 7: 35, 8: 31, 9: 27, 10: 24, 11: 22, 12: 20, 13: 18 }
};

// Store calculated taper values globally
let calculatedTapers = { taper1: null, taper2: null, taper3: null, height: null };
let currentStep = 1;

// Step indicators
const step1Indicator = document.getElementById('step1Indicator');
const step2Indicator = document.getElementById('step2Indicator');
const step3Indicator = document.getElementById('step3Indicator');
const angleControls = document.getElementById('angleControls');
const distanceControls = document.getElementById('distanceControls');

function calculateTapers() {
    const angles = measurements.filter(m => m.type === 'angle');
    const distances = measurements.filter(m => m.type === 'distance');
    
    let results = '';
    let allSuccess = true;
    
    // Taper 1: Average of Angle 1, Angle 2, Angle 3, and Angle 4
    if (angles.length >= 4) {
        const angle1 = parseFloat(angles.find(a => a.label === 'Angle 1')?.value || 0);
        const angle2 = parseFloat(angles.find(a => a.label === 'Angle 2')?.value || 0);
        const angle3 = parseFloat(angles.find(a => a.label === 'Angle 3')?.value || 0);
        const angle4 = parseFloat(angles.find(a => a.label === 'Angle 4')?.value || 0);
        
        calculatedTapers.taper1 = (angle1 + angle2 + angle3 + angle4) / 4;
        
        results += `
            <div class="taper-result">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-weight: 700; color: #10b981; font-size: 14px;">TAPER 1</span>
                    <span style="font-size: 28px; font-weight: 700; color: #10b981;">${calculatedTapers.taper1.toFixed(2)}°</span>
                </div>
                <div style="font-size: 12px; color: #6b7280;">
                    Average of Angle 1 (${angle1}°), Angle 2 (${angle2}°), Angle 3 (${angle3}°), and Angle 4 (${angle4}°)
                </div>
            </div>
        `;
    } else {
        allSuccess = false;
        results += `
            <div class="taper-result error">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: #ef4444;">TAPER 1</span>
                    <span style="color: #ef4444;">Need 4 angles</span>
                </div>
                <div style="font-size: 12px; color: #ef4444; margin-top: 8px;">
                    Please measure all 4 angles (currently have ${angles.length})
                </div>
            </div>
        `;
    }
    
    // Taper 2 & 3: Calculation based on B1, B2, and C
    if (distances.length >= 3) {
        const b1 = parseFloat(distances.find(d => d.label === 'B1')?.value || 0);
        const b2 = parseFloat(distances.find(d => d.label === 'B2')?.value || 0);
        const c = parseFloat(distances.find(d => d.label === 'C')?.value || 0);
        
        if (b1 && b2 && c) {
            calculatedTapers.height = c;
            
            const a = (b1 - b2) / 2;
            const ratio = a / c;
            
            // Taper 2
            if (Math.abs(ratio) <= 1) {
                const taper2Radians = Math.asin(ratio);
                calculatedTapers.taper2 = Math.abs(taper2Radians * (180 / Math.PI));
                
                results += `
                    <div class="taper-result">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 700; color: #10b981; font-size: 14px;">TAPER 2</span>
                            <span style="font-size: 28px; font-weight: 700; color: #10b981;">${calculatedTapers.taper2.toFixed(2)}°</span>
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            a = (B1 - B2) / 2 = ${a.toFixed(2)}<br>
                            T2 = sin⁻¹(${a.toFixed(2)} / C) = ${calculatedTapers.taper2.toFixed(2)}°
                        </div>
                    </div>
                `;
            } else {
                allSuccess = false;
                results += `
                    <div class="taper-result error">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: #ef4444;">TAPER 2</span>
                            <span style="color: #ef4444;">Error</span>
                        </div>
                        <div style="font-size: 12px; color: #ef4444; margin-top: 8px;">
                            Invalid calculation: a/c = ${ratio.toFixed(2)} (must be ≤ 1)
                        </div>
                    </div>
                `;
            }
            
            // Taper 3
            const b2Rounded = Math.round(b2);
            const cRounded = Math.round(c);
            
            if (taper3Table[cRounded] && taper3Table[cRounded][b2Rounded]) {
                calculatedTapers.taper3 = taper3Table[cRounded][b2Rounded];
                
                results += `
                    <div class="taper-result">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 700; color: #10b981; font-size: 14px;">TAPER 3</span>
                            <span style="font-size: 28px; font-weight: 700; color: #10b981;">${calculatedTapers.taper3}°</span>
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            From table: Width (B2) = ${b2Rounded}mm, Height (C) = ${cRounded}mm
                        </div>
                    </div>
                `;
            } else {
                allSuccess = false;
                results += `
                    <div class="taper-result error">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: #ef4444;">TAPER 3</span>
                            <span style="color: #ef4444;">Not Found</span>
                        </div>
                        <div style="font-size: 12px; color: #ef4444; margin-top: 8px;">
                            No table entry for Width=${b2Rounded}mm, Height=${cRounded}mm
                        </div>
                    </div>
                `;
            }
        } else {
            allSuccess = false;
            results += `
                <div class="taper-result error">
                    <div style="font-weight: 700; color: #ef4444; margin-bottom: 8px;">TAPER 2 & 3</div>
                    <div style="font-size: 12px; color: #ef4444;">
                        Please measure B1, B2, and C
                    </div>
                </div>
            `;
        }
    } else {
        allSuccess = false;
        results += `
            <div class="taper-result error">
                <div style="font-weight: 700; color: #ef4444; margin-bottom: 8px;">TAPER 2 & 3</div>
                <div style="font-size: 12px; color: #ef4444;">
                    Please measure B1, B2, and C (currently have ${distances.length})
                </div>
            </div>
        `;
    }
    
    document.getElementById('taperResults').innerHTML = results;
    
    // Show proceed to analysis button if all calculations successful
    if (allSuccess && calculatedTapers.taper1 !== null && calculatedTapers.taper2 !== null && calculatedTapers.taper3 !== null) {
        document.getElementById('taperResults').innerHTML += `
            <button class="workflow-btn analyze" onclick="proceedToStep3()" style="margin-top: 20px;">
                📊 Proceed to Analysis & Results
            </button>
        `;
    }
}

function backToStep1() {
    currentStep = 1;
    updateStepIndicators();
    
    // Show 3D canvas
    canvasContainer.classList.remove('hidden');
    sidebar.classList.remove('full-width');
    
    // Restore measurements view
    updateMeasurementsDisplay();
}

function proceedToStep3() {
    currentStep = 3;
    updateStepIndicators();
    
    showAnalysisResults();
}

function showAnalysisResults() {
    analyzeResults();
}

function analyzeResults() {
    const t1 = calculatedTapers.taper1;
    const t2 = calculatedTapers.taper2;
    const t3 = calculatedTapers.taper3;
    const height = calculatedTapers.height;
    const maxTaper = Math.max(t1, t2);

    let finalPriority = null;
    let finalMessage = "";

    // PRIORITY 1
    if (maxTaper > 20) {
        finalPriority = 1;
        finalMessage = "Add grooves on both buccal and proximal surfaces (dual grooves).";
    }
    // PRIORITY 2
    else if (height < 3.5) {
        finalPriority = 2;
        finalMessage = "Add grooves on both buccal and proximal surfaces (dual grooves).";
    }
    // PRIORITY 3
    else if (maxTaper > 15 && height < 4.0) {
        finalPriority = 3;
        finalMessage = "Add a proximal groove (single groove).";
    }
    // PRIORITY 4
    else if (t1 > t3 && t2 > t3) {
        finalPriority = 4;
        finalMessage = "Add grooves on both the more tapered surfaces (dual grooves).";
    }
    // PRIORITY 5
    else if ((t1 > t3 && t2 <= t3) || (t2 > t3 && t1 <= t3)) {
        finalPriority = 5;
        finalMessage = "Add one groove on the more tapered surface (prefer proximal if equal).";
    }
    // PRIORITY 6
    else if (t1 <= t3 && t2 <= t3 && height >= 4.0) {
        finalPriority = 6;
        finalMessage = "No grooves needed.";
    }

    // Display final output
    const resultHTML = `
        <div class="workflow-section">
            <h2>📊 Step 3: Analysis & Recommendations</h2>
            
            <div class="recommendation-card">
                <div class="recommendation-priority">Priority ${finalPriority} Recommendation</div>
                <div class="recommendation-text">${finalMessage}</div>
                
                <div class="recommendation-values">
                    <strong>Analysis Based On:</strong><br>
                    Taper 1: ${t1.toFixed(2)}° | Taper 2: ${t2.toFixed(2)}° | Taper 3: ${t3}°<br>
                    Height (C): ${height.toFixed(2)} mm | Max Taper: ${maxTaper.toFixed(2)}°
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="backToStep2()" style="flex: 1; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 14px; border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600;">
                    ← Back to Tapers
                </button>
                <button onclick="backToStep1()" style="flex: 1; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 14px; border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600;">
                    ← Back to Measurements
                </button>
            </div>
        </div>
    `;

    measurementsDiv.innerHTML = resultHTML;
}

function backToStep2() {
    currentStep = 2;
    updateStepIndicators();
    showTaperCalculation();
    calculateTapers(); // Recalculate to show results
}

function updateMeasurementsDisplay() {
    if (measurements.length === 0) {
        measurementsDiv.innerHTML = '<p class="no-measurements">No measurements yet. Load an STL file and start measuring.</p>';
        clearBtn.disabled = true;
    } else {
        let html = '<div class="sidebar-section"><h3 class="sidebar-section-title">📏 Current Measurements</h3>';
        
        html += measurements.map((m, i) => {
            let displayValue = `${m.value} ${m.unit}`;
            if (m.type === 'angle' && m.rawAngle) {
                displayValue += ` <span style="font-size: 11px; color: #9ca3af;">(${m.rawAngle}° raw)</span>`;
            }
            
            return `
            <div class="measurement">
                <div class="measurement-header">
                    <span class="measurement-type">${m.label}</span>
                    <span class="measurement-value">${displayValue}</span>
                </div>
                <div class="measurement-label">
                    <input type="text" value="${m.label}" 
                           onchange="updateMeasurementLabel(${i}, this.value)" 
                           placeholder="Enter label">
                    <button class="delete-btn" onclick="deleteMeasurement(${i})">Delete</button>
                </div>
                <div class="measurement-points">
                    ${m.points.map((p, j) => `P${j + 1}: (${p.x}, ${p.y}, ${p.z})`).join('<br>')}
                </div>
            </div>
        `;
        }).join('');
        
        html += '</div>';
        
        // Check if ready for taper calculation
        const angles = measurements.filter(m => m.type === 'angle');
        const distances = measurements.filter(m => m.type === 'distance');
        
        if (angles.length === 4 && distances.length === 3) {
            // All measurements complete - move to step 2
            html += `
                <div class="workflow-section">
                    <h2>✅ All measurements collected!</h2>
                    <button class="workflow-btn" onclick="proceedToStep2()">
                        🧮 Proceed to Calculate Tapers
                    </button>
                </div>
            `;
        } else {
            html += `
                <div class="workflow-section">
                    <h2>📊 Measurement Progress</h2>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: #667eea;">Angles:</strong> ${angles.length}/4 
                            ${angles.length === 4 ? '✅' : '⏳'}
                        </div>
                        <div>
                            <strong style="color: #667eea;">Distances:</strong> ${distances.length}/3 
                            ${distances.length === 3 ? '✅' : '⏳'}
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #6b7280;">Complete all measurements to proceed to analysis.</p>
                </div>
            `;
        }
        
        measurementsDiv.innerHTML = html;
        clearBtn.disabled = false;
    }
}

function proceedToStep2() {
    currentStep = 2;
    updateStepIndicators();
    
    // Hide 3D canvas
    canvasContainer.classList.add('hidden');
    sidebar.classList.add('full-width');
    
    // Show taper calculation view
    showTaperCalculation();
}

function updateStepIndicators() {
    step1Indicator.classList.remove('active', 'completed');
    step2Indicator.classList.remove('active', 'completed');
    step3Indicator.classList.remove('active', 'completed');
    
    if (currentStep === 1) {
        step1Indicator.classList.add('active');
    } else if (currentStep === 2) {
        step1Indicator.classList.add('completed');
        step2Indicator.classList.add('active');
    } else if (currentStep === 3) {
        step1Indicator.classList.add('completed');
        step2Indicator.classList.add('completed');
        step3Indicator.classList.add('active');
    }
}

function showTaperCalculation() {
    const angles = measurements.filter(m => m.type === 'angle');
    const distances = measurements.filter(m => m.type === 'distance');
    
    let html = `
        <div class="workflow-section">
            <h2>🧮 Step 2: Calculate Tapers</h2>
            
            <div class="workflow-step">
                <button class="workflow-btn" onclick="calculateTapers()">
                    Calculate All Tapers
                </button>
                <div id="taperResults"></div>
            </div>
            
            <button onclick="backToStep1()" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 12px 24px; border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600; margin-top: 20px;">
                ← Back to Measurements
            </button>
        </div>
    `;
    
    measurementsDiv.innerHTML = html;
}

function updateMeasurementLabel(index, newLabel) {
    if (measurements[index]) {
        measurements[index].label = newLabel;
    }
}

function deleteMeasurement(index) {
    // Remove visual elements associated with this measurement
    const visualsToRemove = permanentLines.filter(pl => pl.measurementIndex === index);
    visualsToRemove.forEach(visual => {
        visual.elements.forEach(element => scene.remove(element));
    });
    
    // Remove from permanentLines array
    permanentLines = permanentLines.filter(pl => pl.measurementIndex !== index);
    
    // Update indices for remaining measurements
    permanentLines.forEach(pl => {
        if (pl.measurementIndex > index) {
            pl.measurementIndex--;
        }
    });
    
    // Remove measurement
    measurements.splice(index, 1);
    updateMeasurementsDisplay();
}

function clearMeasurements() {
    measurements = [];
    measurementCounter = { angle: 1, distance: 1 };
    
    // Remove all permanent visual elements
    permanentLines.forEach(visual => {
        visual.elements.forEach(element => scene.remove(element));
    });
    permanentLines = [];
    
    clearSelection();
    clearAngleTools();
    updateMeasurementsDisplay();
    
    // Re-enable all buttons
    angle1Btn.disabled = false;
    angle2Btn.disabled = false;
    angle3Btn.disabled = false;
    angle4Btn.disabled = false;
    b1Btn.disabled = false;
    b2Btn.disabled = false;
    cHeightBtn.disabled = false;
}

function handleMouseDown(e) {
    if (measurementMode) return;
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (!isDragging || !model) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    if (e.buttons === 1) {
        // Left mouse button = ROTATION
        if (!measurementMode) {
            rotation.y += deltaX * 0.005;
            rotation.x += deltaY * 0.005;

            model.rotation.y = rotation.y;
            model.rotation.x = rotation.x;
        }
    } 
    else if (e.buttons === 2) {
        // Right mouse button = PAN
        model.position.x += deltaX * 0.1;
        model.position.y -= deltaY * 0.1;
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
}

function handleMouseUp() {
    isDragging = false;
    
    if ((measurementMode === 'angle1' || measurementMode === 'angle2' || 
         measurementMode === 'angle3' || measurementMode === 'angle4') && angleOrigin) {
        canvas.style.cursor = 'crosshair';
    } else if (!measurementMode) {
        canvas.style.cursor = 'grab';
    }
}

function deleteMeasurement(index) {
    const measurement = measurements[index];
    
    // Remove visual elements associated with this measurement
    const visualsToRemove = permanentLines.filter(pl => pl.measurementIndex === index);
    visualsToRemove.forEach(visual => {
        visual.elements.forEach(element => scene.remove(element));
    });
    
    // Remove from permanentLines array
    permanentLines = permanentLines.filter(pl => pl.measurementIndex !== index);
    
    // Update indices for remaining measurements
    permanentLines.forEach(pl => {
        if (pl.measurementIndex > index) {
            pl.measurementIndex--;
        }
    });
    
    // Remove measurement
    measurements.splice(index, 1);
    
    // Re-enable button if deleting specific measurement
    if (measurement.label === 'Angle 1') angle1Btn.disabled = false;
    else if (measurement.label === 'Angle 2') angle2Btn.disabled = false;
    else if (measurement.label === 'Angle 3') angle3Btn.disabled = false;
    else if (measurement.label === 'Angle 4') angle4Btn.disabled = false;
    else if (measurement.label === 'B1') b1Btn.disabled = false;
    else if (measurement.label === 'B2') b2Btn.disabled = false;
    else if (measurement.label === 'C') cHeightBtn.disabled = false;
    
    updateMeasurementsDisplay();
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY * 0.1;
    camera.position.z += delta;
    camera.position.z = Math.max(10, Math.min(500, camera.position.z));
}

function handleResize() {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

function toggleCanvasView() {
    canvasContainer.classList.toggle('minimized');
    const isMinimized = canvasContainer.classList.contains('minimized');
    
    // Update icon
    if (isMinimized) {
        toggleIcon.innerHTML = '<path d="M6 9l6 6 6-6"/>';
    } else {
        toggleIcon.innerHTML = '<path d="M18 15l-6-6-6 6"/>';
    }
}

// Touch handling for mobile
let touchStartX = 0;
let touchStartY = 0;
let touchStartDistance = 0;
let isTouchDragging = false;
let lastTouchTime = 0;

function handleTouchStart(e) {
    if (measurementMode) {
        // Handle measurement tap
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        const currentTime = Date.now();
        if (currentTime - lastTouchTime < 300) {
            // Double tap detected, treat as click
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
        lastTouchTime = currentTime;
        return;
    }

    if (e.touches.length === 1) {
        // Single touch - rotation
        isTouchDragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        // Two finger - zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistance = Math.sqrt(dx * dx + dy * dy);
    }
}

function handleTouchMove(e) {
    e.preventDefault();

    if (!model) return;

    if (e.touches.length === 1 && isTouchDragging && !measurementMode) {
        // Rotation
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        
        rotation.y += deltaX * 0.01;
        rotation.x += deltaY * 0.01;
        
        model.rotation.y = rotation.y;
        model.rotation.x = rotation.x;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        // Zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const delta = (touchStartDistance - distance) * 0.5;
        camera.position.z += delta;
        camera.position.z = Math.max(10, Math.min(500, camera.position.z));
        
        touchStartDistance = distance;
    }
}

function handleTouchEnd(e) {
    isTouchDragging = false;
}

// Modal functions
function showAngleInfo() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">
                        📐 Angle Measurements Guide
                    </div>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <h3>🎯 What Are Angle Measurements?</h3>
                        <p>Angle measurements capture the taper or convergence angle of the preparation from different perspectives. You need to measure <strong>4 angles</strong> to get a comprehensive taper analysis.</p>
                    </div>
                    
                    <div class="modal-section">
                        <h3>📍 How to Measure</h3>
                        <ul>
                            <li><strong>First Click:</strong> Place the origin point (green center marker) at the occlusal surface center</li>
                            <li><strong>Second Click:</strong> Click on the model at the gingival margin to create the measurement line</li>
                            <li>The angle is automatically calculated from the X-axis (horizontal reference)</li>
                            <li>Gray reference axes (X, X', Y, Y') help you visualize the measurement plane</li>
                        </ul>
                    </div>
                    
                    <div class="modal-section">
                        <h3>🔢 The 4 Required Angles</h3>
                        <ul>
                            <li><strong>Angle 1:</strong> Buccal surface taper angle</li>
                            <li><strong>Angle 2:</strong> Lingual surface taper angle</li>
                            <li><strong>Angle 3:</strong> Mesial surface taper angle</li>
                            <li><strong>Angle 4:</strong> Distal surface taper angle</li>
                        </ul>
                    </div>
                    
                    <div class="modal-tip">
                        <strong>💡 Pro Tip</strong>
                        <p>Measure from the same occlusal reference point for all 4 angles to ensure consistency. The displayed angle is automatically normalized to 0-90° for easier interpretation.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showDistanceInfo() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <div class="modal-title">
                        📏 Distance Measurements Guide
                    </div>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <h3>🎯 What Are Distance Measurements?</h3>
                        <p>Distance measurements capture the width and height dimensions of the preparation. You need <strong>3 measurements</strong> (B1, B2, and C) for complete taper analysis.</p>
                    </div>
                    
                    <div class="modal-section">
                        <h3>📍 How to Measure</h3>
                        <ul>
                            <li><strong>First Click:</strong> Click the starting point on the model</li>
                            <li><strong>Second Click:</strong> Click the ending point to complete the measurement</li>
                            <li>A yellow line connects the two points with red sphere markers</li>
                            <li>Distance is calculated in 3D space and displayed in your selected unit</li>
                        </ul>
                    </div>
                    
                    <div class="modal-section">
                        <h3>🔢 The 3 Required Measurements</h3>
                        <ul>
                            <li><strong>B1 (Width 1):</strong> Maximum width at the occlusal surface - measure the widest point across the preparation top</li>
                            <li><strong>B2 (Width 2):</strong> Minimum width at the gingival margin - measure the narrowest point at the finish line</li>
                            <li><strong>C (Height):</strong> Vertical height of the preparation - measure from occlusal surface to gingival margin</li>
                        </ul>
                    </div>
                    
                    <div class="modal-tip">
                        <strong>💡 Pro Tip</strong>
                        <p>For B1 and B2, measure along the same axis (typically buccal-lingual) to get accurate taper calculations. C should be measured perpendicular to the occlusal plane for proper height assessment.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showInstructionInfo() {
    const modalHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                
                <div class="modal-header">
                    <div class="modal-title">📘 T-METRY – Instructions Guide</div>
                    <button class="modal-close" onclick="closeModal()">×</button>
                </div>

                <div class="modal-body">

                    <div class="modal-section">
                        <h3>📂 1. Upload the STL File</h3>
                        <p>Load the prepared tooth STL file using the <strong>Load STL</strong> button. Supported format: <strong>.stl</strong>.</p>
                    </div>

                    <div class="modal-section">
                        <h3>🦷 2. Orient the 3D Model</h3>
                        <ul>
                            <li>Rotate the model using your mouse/touchpad.</li>
                            <li>Zoom in/out to view details clearly.</li>
                            <li>Ensure margins and axial walls are fully visible before measuring.</li>
                        </ul>
                    </div>

                    <div class="modal-section">
                        <h3>📏 3. Measure Width (Buccolingual)</h3>
                        <ul>
                            <li>Select the <strong>Measure Width</strong> tool.</li>
                            <li>Click two points across the tip (Point 1 → Point 2).</li>
                            <li>Click two points across the base (Point 1 → Point 2).</li>
                            <li>The software displays both measurements automatically.</li>
                        </ul>
                    </div>

                    <div class="modal-section">
                        <h3>📐 4. Measure Height (Axial Wall)</h3>
                        <ul>
                            <li>Select the <strong>Measure Height</strong> tool.</li>
                            <li>Click at the finish line (Point 1).</li>
                            <li>Click at the occlusal end of the axial wall (Point 2).</li>
                            <li>Repeat on the opposite side.</li>
                            <li>The app shows the average height instantly.</li>
                        </ul>
                    </div>

                    <div class="modal-section">
                        <h3>📐 5. Measure Taper Angles</h3>
                        <ul>
                            <li>Select <strong>Measure Taper</strong>.</li>
                            <li>Align the tooth to view mesial & distal axial walls.</li>
                            <li>Click one point on the mesial wall.</li>
                            <li>Click one point on the distal wall.</li>
                            <li>The app calculates the taper angle automatically.</li>
                        </ul>
                    </div>

                    <div class="modal-section">
                        <h3>📊 6. Angle Calculations</h3>
                        <p>Click <strong>Calculate Taper</strong> to display:</p>
                        <ul>
                            <li>Taper 1 angle</li>
                            <li>Taper 2 angle</li>
                            <li>Taper 3 angle</li>
                        </ul>
                    </div>

                    <div class="modal-section">
                        <h3>🧠 7. Recommendation Generation</h3>
                        <ul>
                            <li>Click <strong>Analyze Results</strong>.</li>
                            <li>The app instantly shows preparation feedback.</li>
                        </ul>
                    </div>

                    <div class="modal-tip">
                        <strong>💡 Pro Tip</strong>
                        <p>Always capture width, height, and taper on both sides for accurate analysis.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}


function closeModal(event) {
    if (event) {
        // Only close if clicking the overlay or close button
        if (event.target.classList.contains('modal-overlay') || event.currentTarget.classList.contains('modal-close')) {
            const modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();
        }
    } else {
        // Direct call to closeModal()
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    }
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

init();