import React, { useState, useEffect, useRef } from 'react';
import './SimpleResizable.css';

const SimpleResizable = ({
  children,
  initialWidth = 1280,
  initialHeight = 720,
  onSizeChange,
  isPreview = false,
  previewScale = 0.5
}) => {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [sizeStart, setSizeStart] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    setSize({ width: initialWidth, height: initialHeight });
  }, [initialWidth, initialHeight]);

  useEffect(() => {
    if (onSizeChange) {
      onSizeChange(size);
    }
  }, [size, onSizeChange]);

  const handleMouseDown = (e) => {
    if (!isPreview) return;
    e.preventDefault();

    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    setIsDragging(true);
  };

  const handleResizeMouseDown = (e) => {
    if (!isPreview) return;
    e.preventDefault();
    e.stopPropagation();

    setSizeStart({ ...size });
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && !isResizing) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }

      if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setSize({
          width: Math.max(320, sizeStart.width + deltaX / previewScale),
          height: Math.max(180, sizeStart.height + deltaY / previewScale)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, sizeStart, previewScale]);

  const displayStyle = {
    width: size.width * previewScale,
    height: size.height * previewScale,
    transform: `translate(${position.x}px, ${position.y}px)`,
    cursor: isPreview ? (isDragging ? 'grabbing' : 'grab') : 'default'
  };

  return (
    <div
      ref={containerRef}
      className={`simple-resizable ${isPreview ? 'interactive' : ''}`}
      style={displayStyle}
      onMouseDown={handleMouseDown}
    >
      <div className="content-wrapper">
        {children}
      </div>

      {isPreview && (
        <>
          <div
            className="resize-handle"
            onMouseDown={handleResizeMouseDown}
          />
          <div className="size-label">
            {Math.round(size.width)} × {Math.round(size.height)}
          </div>
        </>
      )}
    </div>
  );
};

export default SimpleResizable;