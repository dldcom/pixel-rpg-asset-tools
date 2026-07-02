document.addEventListener('DOMContentLoaded', () => {
  const assetSelect = document.getElementById('asset-select');
  const charIdInput = document.getElementById('char-id');
  const thresholdSlider = document.getElementById('threshold');
  const thresholdVal = document.getElementById('threshold-val');
  const btnAnalyze = document.getElementById('btn-analyze');
  const btnGenerate = document.getElementById('btn-generate');
  const analyzeStatus = document.getElementById('analyze-status');
  const generateStatus = document.getElementById('generate-status');
  
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const editorPlaceholder = document.getElementById('editor-placeholder');
  const headLimitDisp = document.getElementById('head-limit-disp');
  const legLimitDisp = document.getElementById('leg-limit-disp');
  
  const resultPreview = document.getElementById('result-preview');
  const resultSpritesheet = document.getElementById('result-spritesheet');
  const resultPlaceholder = document.getElementById('result-placeholder');

  let currentImage = null;
  // Limits are 0-63
  let headLimit = 24;
  let legLimit = 47;
  const SCALE = 10;
  const FRAME_W = 48;
  const FRAME_H = 64;

  let isDraggingHead = false;
  let isDraggingLeg = false;

  // Load assets
  fetch('/api/source-assets')
    .then(res => res.json())
    .then(files => {
      assetSelect.innerHTML = '<option value="">-- Select an asset --</option>';
      files.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = f.name;
        assetSelect.appendChild(opt);
      });
    })
    .catch(err => {
      assetSelect.innerHTML = '<option value="">Error loading assets</option>';
    });

  // Auto-fill ID based on asset name
  assetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const baseName = val.split('.')[0];
      charIdInput.value = baseName;
    }
  });

  thresholdSlider.addEventListener('input', (e) => {
    thresholdVal.textContent = e.target.value;
  });

  const drawCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImage) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(currentImage, 0, 0, FRAME_W * SCALE, FRAME_H * SCALE);
      
      // Draw Head Line
      ctx.beginPath();
      ctx.moveTo(0, headLimit * SCALE);
      ctx.lineTo(canvas.width, headLimit * SCALE);
      ctx.strokeStyle = '#ef4444'; // Red
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px Inter';
      ctx.fillText('Head Limit', 5, headLimit * SCALE - 5);

      // Draw Leg Line
      ctx.beginPath();
      ctx.moveTo(0, legLimit * SCALE);
      ctx.lineTo(canvas.width, legLimit * SCALE);
      ctx.strokeStyle = '#3b82f6'; // Blue
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('Leg Limit', 5, legLimit * SCALE - 5);
    }
  };

  const updateDisplays = () => {
    headLimitDisp.textContent = headLimit;
    legLimitDisp.textContent = legLimit;
  };

  btnAnalyze.addEventListener('click', async () => {
    const sourceFile = assetSelect.value;
    let id = charIdInput.value.trim();
    if (!sourceFile || !id) {
      alert('Please select an asset and enter an ID.');
      return;
    }
    
    analyzeStatus.textContent = 'Processing...';
    btnAnalyze.disabled = true;
    
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile,
          id,
          threshold: parseInt(thresholdSlider.value, 10)
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze');
      
      headLimit = data.head;
      legLimit = data.leg;
      updateDisplays();

      // Load image into canvas
      const img = new Image();
      img.src = data.frontFrame;
      img.onload = () => {
        currentImage = img;
        editorPlaceholder.style.display = 'none';
        drawCanvas();
        btnGenerate.disabled = false;
      };

      // Show previews
      resultPreview.src = data.previewUrl;
      resultPreview.style.display = 'block';
      resultSpritesheet.src = data.spritesheetUrl;
      resultSpritesheet.style.display = 'block';
      resultPlaceholder.style.display = 'none';

      analyzeStatus.textContent = 'Done! You can adjust the lines on the image.';
      analyzeStatus.style.color = 'var(--success)';
    } catch (err) {
      analyzeStatus.textContent = 'Error: ' + err.message;
      analyzeStatus.style.color = '#ef4444';
    } finally {
      btnAnalyze.disabled = false;
    }
  });

  btnGenerate.addEventListener('click', async () => {
    const sourceFile = assetSelect.value;
    let id = charIdInput.value.trim();
    
    generateStatus.textContent = 'Generating...';
    btnGenerate.disabled = true;
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile,
          id,
          threshold: parseInt(thresholdSlider.value, 10),
          headLimit,
          legLimit
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      
      // Update previews
      resultPreview.src = data.previewUrl;
      resultSpritesheet.src = data.spritesheetUrl;
      
      generateStatus.textContent = 'Spritesheet updated successfully!';
      generateStatus.style.color = 'var(--success)';
      setTimeout(() => generateStatus.textContent = '', 3000);
    } catch (err) {
      generateStatus.textContent = 'Error: ' + err.message;
      generateStatus.style.color = '#ef4444';
    } finally {
      btnGenerate.disabled = false;
    }
  });

  // Canvas Interactions
  const getMouseY = (e) => {
    const rect = canvas.getBoundingClientRect();
    return e.clientY - rect.top;
  };

  canvas.addEventListener('mousedown', (e) => {
    if (!currentImage) return;
    const y = getMouseY(e);
    
    // Check if near head line (within 10 pixels scaled)
    if (Math.abs(y - headLimit * SCALE) < 15) {
      isDraggingHead = true;
    } else if (Math.abs(y - legLimit * SCALE) < 15) {
      isDraggingLeg = true;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!currentImage) return;
    const y = getMouseY(e);
    
    if (isDraggingHead || isDraggingLeg) {
      let rawY = Math.round(y / SCALE);
      if (rawY < 0) rawY = 0;
      if (rawY > 63) rawY = 63;

      if (isDraggingHead) {
        headLimit = rawY;
      } else if (isDraggingLeg) {
        legLimit = rawY;
      }
      updateDisplays();
      drawCanvas();
    } else {
      // Update cursor
      if (Math.abs(y - headLimit * SCALE) < 15 || Math.abs(y - legLimit * SCALE) < 15) {
        canvas.style.cursor = 'ns-resize';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }
  });

  const stopDrag = () => {
    isDraggingHead = false;
    isDraggingLeg = false;
  };

  canvas.addEventListener('mouseup', stopDrag);
  canvas.addEventListener('mouseleave', stopDrag);
});
