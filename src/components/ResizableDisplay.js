import React, { useState, useRef, useEffect } from 'react';
import './ResizableDisplay.css';

const ResizableDisplay = ({
  children,
  width,
  height,
  position,
  scale,
  onResize,
  onMove,
  onScaleChange,
  isPreview = false,
  containerScale = 1
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState('');
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Handle resize start
  const handleResizeStart = (e, handle) => {
    if (!isPreview) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({ width, height });
  };

  // Handle drag start
  const handleDragStart = (e) => {
    if (!isPreview) return;
    if (e.target.classList.contains('resize-handle')) return;

    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartOffset({ x: position.x, y: position.y });
  };

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const deltaX = (e.clientX - startPos.x) / containerScale;
        const deltaY = (e.clientY - startPos.y) / containerScale;
        let newWidth = startSize.width;
        let newHeight = startSize.height;
        let newX = position.x;
        let newY = position.y;

        switch (resizeHandle) {
          case 'se': // Southeast
            newWidth = Math.max(320, startSize.width + deltaX);
            newHeight = Math.max(180, startSize.height + deltaY);
            break;
          case 'sw': // Southwest
            newWidth = Math.max(320, startSize.width - deltaX);
            newHeight = Math.max(180, startSize.height + deltaY);
            newX = position.x + deltaX;
            break;
          case 'ne': // Northeast
            newWidth = Math.max(320, startSize.width + deltaX);
            newHeight = Math.max(180, startSize.height - deltaY);
            newY = position.y + deltaY;
            break;
          case 'nw': // Northwest
            newWidth = Math.max(320, startSize.width - deltaX);
            newHeight = Math.max(180, startSize.height - deltaY);
            newX = position.x + deltaX;
            newY = position.y + deltaY;
            break;
          case 'n': // North
            newHeight = Math.max(180, startSize.height - deltaY);
            newY = position.y + deltaY;
            break;
          case 's': // South
            newHeight = Math.max(180, startSize.height + deltaY);
            break;
          case 'e': // East
            newWidth = Math.max(320, startSize.width + deltaX);
            break;
          case 'w': // West
            newWidth = Math.max(320, startSize.width - deltaX);
            newX = position.x + deltaX;
            break;
          default:
            break;
        }

        onResize({ width: Math.round(newWidth), height: Math.round(newHeight) });
        if (newX !== position.x || newY !== position.y) {
          onMove({ x: Math.round(newX), y: Math.round(newY) });
        }
      }

      if (isDragging) {
        const deltaX = (e.clientX - startPos.x) / containerScale;
        const deltaY = (e.clientY - startPos.y) / containerScale;

        onMove({
          x: Math.round(startOffset.x + deltaX),
          y: Math.round(startOffset.y + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsDragging(false);
      setResizeHandle('');
    };

    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizing ?
        (resizeHandle.includes('n') || resizeHandle.includes('s') ? 'ns-resize' :
         resizeHandle.includes('e') || resizeHandle.includes('w') ? 'ew-resize' :
         'nwse-resize') :
        'move';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isDragging, resizeHandle, startPos, startSize, startOffset, position, onResize, onMove, containerScale]);

  // Handle scroll for zoom
  const handleWheel = (e) => {
    if (!isPreview) return;
    if (!e.ctrlKey && !e.metaKey) return;

    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newScale = Math.max(0.1, Math.min(2, scale + delta));
    onScaleChange(newScale);
  };

  const totalScale = scale * containerScale;
  const displayStyle = {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${position.x * containerScale}px, ${position.y * containerScale}px) scale(${totalScale})`,
    transformOrigin: 'top left'
  };

  return (
    <div
      ref={containerRef}
      className={`resizable-display ${isPreview ? 'preview-mode' : ''} ${isDragging ? 'dragging' : ''}`}
      style={displayStyle}
      onMouseDown={handleDragStart}
      onWheel={handleWheel}
    >
      {isPreview && (
        <>
          {/* Corner handles */}
          <div
            className="resize-handle nw"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className="resize-handle ne"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="resize-handle sw"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="resize-handle se"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />

          {/* Edge handles */}
          <div
            className="resize-handle n"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div
            className="resize-handle s"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div
            className="resize-handle e"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          <div
            className="resize-handle w"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />

          <div className="size-indicator">
            {width} × {height} | {Math.round(scale * 100)}%
          </div>
        </>
      )}

      <div className="resizable-content">
        {children}
      </div>
    </div>
  );
};

export default ResizableDisplay;