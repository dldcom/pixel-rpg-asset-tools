import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_ASSETS_DIR = path.join(PROJECT_ROOT, 'source-assets', 'society-4-1-2-2', 'src-assets', 'characters');
const TEMP_DIR = path.join(PROJECT_ROOT, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const upload = multer({ dest: TEMP_DIR });

app.use(express.static(path.join(PROJECT_ROOT, 'public')));
app.use('/assets', express.static(path.join(PROJECT_ROOT, 'assets')));
app.use('/source-assets', express.static(path.join(PROJECT_ROOT, 'source-assets')));

app.get('/api/source-assets', (req, res) => {
  try {
    if (!fs.existsSync(SOURCE_ASSETS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(SOURCE_ASSETS_DIR)
      .filter(f => f.toLowerCase().endsWith('.png'))
      .map(f => ({
        name: f,
        url: `/source-assets/society-4-1-2-2/src-assets/characters/${f}`
      }));
    res.json(files);
  } catch (error) {
    console.error('Error reading source assets:', error);
    res.status(500).json({ error: 'Failed to read source assets' });
  }
});

const runImportScript = (args: string[]): Promise<{ stdout: string, stderr: string }> => {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/import-character.ts', ...args], {
      cwd: PROJECT_ROOT,
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Script exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
      }
    });
  });
};

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const { id, sourceFile, threshold } = req.body;
    
    let targetPath = '';
    if (req.file) {
      targetPath = req.file.path;
    } else if (sourceFile) {
      targetPath = path.join(SOURCE_ASSETS_DIR, sourceFile);
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(400).json({ error: 'Image file not found' });
    }

    const args = [id, targetPath, '--mode', 'split3'];
    if (threshold) {
      args.push('--threshold', threshold);
    }

    console.log('Running import-character (analyze):', args.join(' '));
    const result = await runImportScript(args);
    
    // Parse head and leg lines from stdout
    // Expected stdout format: [import-character] head/leg lines: head=24 leg=47
    const match = result.stdout.match(/head=(\d+) leg=(\d+)/);
    let head = 24;
    let leg = 47;
    
    if (match) {
      head = parseInt(match[1], 10);
      leg = parseInt(match[2], 10);
    }

    // Since it already generated the preview images, we can just return the URLs
    // Add a timestamp to bypass browser cache
    const ts = Date.now();
    res.json({
      head,
      leg,
      frontFrame: `/assets/characters/${id}-frames/down_0.png?t=${ts}`,
      previewUrl: `/assets/characters/${id}-preview.png?t=${ts}`,
      spritesheetUrl: `/assets/characters/${id}.png?t=${ts}`,
      stdout: result.stdout
    });
  } catch (error: any) {
    console.error('Analyze Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const { id, sourceFile, threshold, headLimit, legLimit } = req.body;
    
    let targetPath = '';
    if (req.file) {
      targetPath = req.file.path;
    } else if (sourceFile) {
      targetPath = path.join(SOURCE_ASSETS_DIR, sourceFile);
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(400).json({ error: 'Image file not found' });
    }

    const args = [id, targetPath, '--mode', 'split3'];
    if (threshold) args.push('--threshold', threshold);
    if (headLimit !== undefined) args.push('--head-limit', headLimit);
    if (legLimit !== undefined) args.push('--leg-limit', legLimit);

    console.log('Running import-character (generate):', args.join(' '));
    const result = await runImportScript(args);

    const ts = Date.now();
    res.json({
      frontFrame: `/assets/characters/${id}-frames/down_0.png?t=${ts}`,
      previewUrl: `/assets/characters/${id}-preview.png?t=${ts}`,
      spritesheetUrl: `/assets/characters/${id}.png?t=${ts}`,
      stdout: result.stdout
    });
  } catch (error: any) {
    console.error('Generate Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`UI Server running at http://localhost:${PORT}`);
});
