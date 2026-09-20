import { useState, useRef, useEffect, useCallback } from 'react';
import {
  PenTool,
  Download,
  Trash2,
  Square,
  ArrowRight,
  Type,
  Circle,
  Sparkles,
} from 'lucide-react';

type Tool = 'pen' | 'rect' | 'arrow' | 'text' | 'eraser';

export default function SystemDesignWhiteboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  // Resize canvas to full container width while preserving existing drawing
  const resizeCanvasToContainer = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = 580;

    if (canvas.width === width && canvas.height === height) return;

    const ctx = canvas.getContext('2d');
    let tempImage: ImageData | null = null;
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      try {
        tempImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        // In case of error, continue
      }
    }

    canvas.width = width;
    canvas.height = height;

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      if (tempImage) {
        ctx.putImageData(tempImage, 0, 0);
      }
    }
  }, []);

  useEffect(() => {
    resizeCanvasToContainer();
    window.addEventListener('resize', resizeCanvasToContainer);
    return () => window.removeEventListener('resize', resizeCanvasToContainer);
  }, [resizeCanvasToContainer]);

  // Whiteboard drawing event handlers
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos({ x, y });

    // Save snapshot for shape previews
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? 18 : lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !startPos) return;

    const { x, y } = getCanvasCoordinates(e);

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (snapshot) {
      // Restore previous snapshot for shape dragging preview
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else if (tool === 'arrow') {
        // Draw line with arrowhead
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(y - startPos.y, x - startPos.x);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x, y);
        ctx.lineTo(x - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && tool === 'text' && startPos) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const text = prompt('Enter text note for architecture diagram:');
        if (text) {
          ctx.fillStyle = color;
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText(text, startPos.x, startPos.y);
        }
      }
    }
    setIsDrawing(false);
    setStartPos(null);
    setSnapshot(null);
  };

  const handleClearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleStampComponent = (name: string, subtext: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = Math.floor(Math.random() * Math.max(30, canvas.width - 200)) + 40;
    const y = Math.floor(Math.random() * Math.max(30, canvas.height - 120)) + 40;

    // Draw box with clean border
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 160, 60, 8);
    ctx.fill();
    ctx.stroke();

    // Draw text inside
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x + 80, y + 26);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(subtext, x + 80, y + 44);
    ctx.textAlign = 'start';
  };

  const handleExportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'system-design-architecture.png';
    a.click();
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Header Container - Technical Interview Execution Suite */}
      <div className="glass-card p-6 sm:p-8 space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#3c4a59]" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Technical Interview Execution Suite
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              System Design Whiteboard
            </h2>
            <p className="text-xs text-gray-600">
              Sketch distributed system architectures, data flows, caches, microservices, and infrastructure topologies on this full-width interactive canvas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Full-Width Architecture Canvas
            </span>
          </div>
        </div>
      </div>

      {/* System Design Whiteboard Suite - Spans Full Width (w-full) */}
      <div className="w-full space-y-4">
        {/* Whiteboard Controls & Architecture Stamps */}
        <div className="glass-card p-4 space-y-3 w-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Drawing Tools */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`p-2 rounded-lg text-xs font-bold transition-all ${
                  tool === 'pen' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Freehand Pen"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('arrow')}
                className={`p-2 rounded-lg text-xs font-bold transition-all ${
                  tool === 'arrow' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Connection Arrow"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('rect')}
                className={`p-2 rounded-lg text-xs font-bold transition-all ${
                  tool === 'rect' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Rectangle Box"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('text')}
                className={`p-2 rounded-lg text-xs font-bold transition-all ${
                  tool === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Text Note"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg text-xs font-bold transition-all ${
                  tool === 'eraser' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Eraser"
              >
                <Circle className="w-4 h-4" />
              </button>
            </div>

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase">Width:</span>
              {[2, 3, 5].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setLineWidth(w)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                    lineWidth === w ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              {['#0f172a', '#2563eb', '#16a34a', '#dc2626', '#9333ea'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>

            {/* Actions: Clear & Export */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearWhiteboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Canvas
              </button>
              <button
                type="button"
                onClick={handleExportImage}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3c4a59] text-white hover:bg-[#2e3a47] text-xs font-bold shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Export Architecture PNG
              </button>
            </div>
          </div>

          {/* Quick Component Stamp Badges */}
          <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mr-1">
              Stamp Component:
            </span>
            <button
              type="button"
              onClick={() => handleStampComponent('Client / SPA', 'React Web / Mobile')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + Client App
            </button>
            <button
              type="button"
              onClick={() => handleStampComponent('Load Balancer', 'NGINX / Cloudflare')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + Load Balancer
            </button>
            <button
              type="button"
              onClick={() => handleStampComponent('API Gateway', 'Auth & Rate Limiting')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + API Gateway
            </button>
            <button
              type="button"
              onClick={() => handleStampComponent('PostgreSQL DB', 'Primary / Replica')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + Relational DB
            </button>
            <button
              type="button"
              onClick={() => handleStampComponent('Redis Cache', 'In-Memory / TTL Cluster')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + Redis Cache
            </button>
            <button
              type="button"
              onClick={() => handleStampComponent('Kafka Broker', 'Event Streaming Queue')}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-1 rounded-lg font-medium border border-gray-200 transition-colors"
            >
              + Kafka Queue
            </button>
          </div>
        </div>

        {/* Canvas Board - Full Width (w-full) */}
        <div
          ref={containerRef}
          className="glass-card overflow-hidden border border-gray-300 shadow-md bg-white w-full"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-[580px] cursor-crosshair bg-white block"
          />
        </div>
      </div>
    </div>
  );
}
