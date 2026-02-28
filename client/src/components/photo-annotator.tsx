import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Minus, Circle, Square, MousePointer, Pencil,
  Undo2, Redo2, Trash2, Check, MoveRight
} from "lucide-react";

type Tool = "select" | "arrow" | "line" | "rect" | "circle" | "freehand";

const COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
  { name: "Blue", value: "#3b82f6" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#000000" },
];

const TOOLS: { id: Tool; icon: any; label: string }[] = [
  { id: "select", icon: MousePointer, label: "Select" },
  { id: "arrow", icon: MoveRight, label: "Arrow" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "freehand", icon: Pencil, label: "Draw" },
];

interface PhotoAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedDataUrl: string) => void;
  onCancel: () => void;
}

export default function PhotoAnnotator({ imageUrl, onSave, onCancel }: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [activeTool, setActiveTool] = useState<Tool>("arrow");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    import("fabric").then((mod) => {
      if (mounted) {
        (window as any).__fabric = mod.fabric || mod;
        setFabricLoaded(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!fabricLoaded || !canvasRef.current) return;
    const fabric = (window as any).__fabric;
    if (!fabric) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = 800;
      const maxH = 600;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      canvas.setWidth(w);
      canvas.setHeight(h);

      const fabricImage = new fabric.Image(img, {
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        hasControls: false,
      });
      canvas.setBackgroundImage(fabricImage, canvas.renderAll.bind(canvas));
      saveHistory(canvas);
    };
    img.src = imageUrl;

    return () => {
      canvas.dispose();
    };
  }, [fabricLoaded, imageUrl]);

  const saveHistory = useCallback((canvas: any) => {
    const json = JSON.stringify(canvas.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(json);
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const newIndex = historyIndex - 1;
    canvas.loadFromJSON(history[newIndex], () => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const newIndex = historyIndex + 1;
    canvas.loadFromJSON(history[newIndex], () => {
      canvas.renderAll();
      setHistoryIndex(newIndex);
    });
  }, [history, historyIndex]);

  const clearAnnotations = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const bg = canvas.backgroundImage;
    canvas.clear();
    if (bg) canvas.setBackgroundImage(bg, canvas.renderAll.bind(canvas));
    else canvas.renderAll();
    saveHistory(canvas);
  }, [saveHistory]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (activeTool === "freehand") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 3;
      canvas.selection = false;
    } else if (activeTool === "select") {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = false;
    }
  }, [activeTool, activeColor]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const fabric = (window as any).__fabric;
    if (!fabric) return;

    const onMouseDown = (opt: any) => {
      if (activeTool === "select" || activeTool === "freehand") return;
      const pointer = canvas.getPointer(opt.e);
      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };

      let shape: any;
      if (activeTool === "line") {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: activeColor, strokeWidth: 3, selectable: true, hasControls: true,
        });
      } else if (activeTool === "arrow") {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: activeColor, strokeWidth: 3, selectable: true, hasControls: true,
        });
      } else if (activeTool === "rect") {
        shape = new fabric.Rect({
          left: pointer.x, top: pointer.y, width: 0, height: 0,
          stroke: activeColor, strokeWidth: 3, fill: "transparent",
          selectable: true, hasControls: true,
        });
      } else if (activeTool === "circle") {
        shape = new fabric.Ellipse({
          left: pointer.x, top: pointer.y, rx: 0, ry: 0,
          stroke: activeColor, strokeWidth: 3, fill: "transparent",
          selectable: true, hasControls: true,
        });
      }
      if (shape) {
        canvas.add(shape);
        activeShapeRef.current = shape;
      }
    };

    const onMouseMove = (opt: any) => {
      if (!isDrawingRef.current || !startPointRef.current || !activeShapeRef.current) return;
      const pointer = canvas.getPointer(opt.e);
      const shape = activeShapeRef.current;
      const start = startPointRef.current;

      if (activeTool === "line" || activeTool === "arrow") {
        shape.set({ x2: pointer.x, y2: pointer.y });
      } else if (activeTool === "rect") {
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        shape.set({
          left, top,
          width: Math.abs(pointer.x - start.x),
          height: Math.abs(pointer.y - start.y),
        });
      } else if (activeTool === "circle") {
        shape.set({
          rx: Math.abs(pointer.x - start.x) / 2,
          ry: Math.abs(pointer.y - start.y) / 2,
          left: Math.min(start.x, pointer.x),
          top: Math.min(start.y, pointer.y),
        });
      }
      canvas.renderAll();
    };

    const onMouseUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (activeTool === "arrow" && activeShapeRef.current) {
        const line = activeShapeRef.current;
        const x1 = line.x1, y1 = line.y1, x2 = line.x2, y2 = line.y2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 15;

        const head = new fabric.Polygon([
          { x: x2, y: y2 },
          { x: x2 - headLen * Math.cos(angle - Math.PI / 6), y: y2 - headLen * Math.sin(angle - Math.PI / 6) },
          { x: x2 - headLen * Math.cos(angle + Math.PI / 6), y: y2 - headLen * Math.sin(angle + Math.PI / 6) },
        ], {
          fill: activeColor, stroke: activeColor, strokeWidth: 1,
          selectable: true, hasControls: true,
        });

        const group = new fabric.Group([line, head], { selectable: true, hasControls: true });
        canvas.remove(line);
        canvas.add(group);
      }

      activeShapeRef.current = null;
      startPointRef.current = null;
      saveHistory(canvas);
    };

    const onPathCreated = () => {
      saveHistory(canvas);
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);
    canvas.on("path:created", onPathCreated);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("path:created", onPathCreated);
    };
  }, [activeTool, activeColor, saveHistory]);

  const handleSave = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: "png", quality: 1 });
    onSave(dataUrl);
  };

  if (!fabricLoaded) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading annotation tool...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-muted/50 border">
        <div className="flex gap-0.5">
          {TOOLS.map(t => {
            const Icon = t.icon;
            return (
              <Button
                key={t.id}
                variant={activeTool === t.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(t.id)}
                title={t.label}
                data-testid={`button-tool-${t.id}`}
                className="h-8 w-8 p-0"
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex gap-1">
          {COLORS.map(c => (
            <button
              key={c.value}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                activeColor === c.value ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c.value }}
              onClick={() => setActiveColor(c.value)}
              title={c.name}
              data-testid={`button-color-${c.name.toLowerCase()}`}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="flex gap-0.5">
          <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo" data-testid="button-undo" className="h-8 w-8 p-0">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo" data-testid="button-redo" className="h-8 w-8 p-0">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAnnotations} title="Clear all" data-testid="button-clear-annotations" className="h-8 w-8 p-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center">
        <canvas ref={canvasRef} data-testid="canvas-annotator" />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel} data-testid="button-cancel-annotate">
          Cancel
        </Button>
        <Button onClick={handleSave} data-testid="button-save-annotate">
          <Check className="h-4 w-4 mr-1" /> Save Annotations
        </Button>
      </div>
    </div>
  );
}
