import { useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import jsPDF from 'jspdf';

function App() {
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(6);
  const [ticketText, setTicketText] = useState('VALE PARA 1 REFRIGERIO');
  const [ticketsPerPage, setTicketsPerPage] = useState(6);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imagePositionX, setImagePositionX] = useState(50);
  const [imagePositionY, setImagePositionY] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [borderColor, setBorderColor] = useState('#0EA5E9'); // Sky-500

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }
    
    setImageFile(file);
    setImageUrl(''); // Limpiar URL si existe
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  const handleDownload = async () => {
    const ticketCount = endNumber - startNumber + 1;
    if (ticketCount <= 0) {
      alert('El número final debe ser mayor que el número inicial');
      return;
    }

    setIsGenerating(true);
    try {
      const tickets = [];
      for (let i = startNumber; i <= endNumber; i++) {
        tickets.push(i);
      }

      const logoUrl = 'https://cloud.unheval.edu.pe/public/imagenes/genericos/unheval.png';
      let logoBase64 = '';
      let customImageBase64 = '';

      try {
        const logoResponse = await fetch(logoUrl);
        const logoBlob = await logoResponse.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      } catch (error) {
        console.error('Error loading logo:', error);
      }

      // Cargar imagen personalizada (desde archivo local o URL)
      if (imagePreview) {
        customImageBase64 = imagePreview;
      } else if (imageUrl) {
        try {
          customImageBase64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  const base64 = canvas.toDataURL('image/png');
                  resolve(base64);
                } else {
                  reject(new Error('Could not get canvas context'));
                }
              } catch (err) {
                reject(err);
              }
            };
            
            img.onerror = () => {
              reject(new Error('Failed to load image'));
            };
            
            img.src = imageUrl;
          });
        } catch (error) {
          console.error('Error loading custom image:', error);
          alert('No se pudo cargar la imagen. Verifica que la URL sea correcta y que la imagen permita acceso CORS.');
        }
      }

      const getGridLayout = (perPage: number) => {
        if (perPage === 4) return { cols: 2, rows: 2 };
        if (perPage === 6) return { cols: 2, rows: 3 };
        if (perPage === 9) return { cols: 3, rows: 3 };
        if (perPage === 8) return { cols: 2, rows: 4 };
        return { cols: 2, rows: 3 };
      };

      const layout = getGridLayout(ticketsPerPage);

      // Calcular dimensiones del logo antes del loop
      let logoAspectRatio = 3.5; // Aspect ratio aproximado del logo UNHEVAL
      if (logoBase64) {
        try {
          const logoImg = new Image();
          logoImg.src = logoBase64;
          await new Promise<void>((resolve) => {
            logoImg.onload = () => {
              logoAspectRatio = logoImg.width / logoImg.height;
              resolve();
            };
            logoImg.onerror = () => {
              console.warn('Could not load logo for aspect ratio calculation');
              resolve(); // Usar valor por defecto
            };
            // Timeout para evitar esperas infinitas
            setTimeout(() => resolve(), 2000);
          });
        } catch (error) {
          console.error('Error calculating logo aspect ratio:', error);
        }
      }

      // Calcular dimensiones de la imagen personalizada antes del loop
      let customImageAspectRatio = 1;
      if (customImageBase64) {
        const customImg = new Image();
        customImg.src = customImageBase64;
        await new Promise((resolve) => {
          customImg.onload = () => {
            customImageAspectRatio = customImg.width / customImg.height;
            resolve(null);
          };
        });
      }

      // Crear PDF con jsPDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const padding = 8;
      const gap = 6;
      
      const gridWidth = pageWidth - (padding * 2);
      
      const ticketWidth = (gridWidth - (gap * (layout.cols - 1))) / layout.cols;
      
      // Calcular altura del ticket basada en el contenido real
      const maxLogoWidth = ticketWidth * 0.75;
      const maxLogoHeightLimit = 25; // Altura máxima del logo en mm
      let calculatedLogoHeight = maxLogoWidth / logoAspectRatio;
      if (calculatedLogoHeight > maxLogoHeightLimit) {
        calculatedLogoHeight = maxLogoHeightLimit;
      }
      
      const imageHeight = customImageBase64 ? 15 : 0;
      const textHeight = 12; // Aproximado para 1-2 líneas con texto más grande
      const numberBoxHeight = 14;
      const spacings = 4 + 5 + (customImageBase64 ? 4 : 0) + 8; // Más espacio después del texto
      
      const contentHeight = calculatedLogoHeight + imageHeight + textHeight + numberBoxHeight + spacings;
      const ticketHeight = contentHeight + 8; // Padding interno

      let pageIndex = 0;
      
      // Calcular altura total de la grilla
      const totalGridHeight = (ticketHeight * layout.rows) + (gap * (layout.rows - 1));
      const startY = (pageHeight - totalGridHeight) / 2; // Centrar verticalmente
      
      for (let i = 0; i < tickets.length; i += ticketsPerPage) {
        if (pageIndex > 0) {
          pdf.addPage();
        }
        
        const pageTickets = tickets.slice(i, i + ticketsPerPage);
        
        for (let j = 0; j < pageTickets.length; j++) {
          const num = pageTickets[j];
          const col = j % layout.cols;
          const row = Math.floor(j / layout.cols);
          
          const x = padding + (col * (ticketWidth + gap));
          const y = startY + (row * (ticketHeight + gap));
          
          // Dibujar borde del ticket
          const rgb = borderColor.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [14, 165, 233];
          pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
          pdf.setLineWidth(0.8);
          pdf.roundedRect(x, y, ticketWidth, ticketHeight, 1.5, 1.5, 'S');
          
          // Dibujar esquinas decorativas
          const cornerSize = 3.5;
          pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
          pdf.setLineWidth(0.5);
          // Top-left
          pdf.line(x, y, x + cornerSize, y);
          pdf.line(x, y, x, y + cornerSize);
          // Top-right
          pdf.line(x + ticketWidth - cornerSize, y, x + ticketWidth, y);
          pdf.line(x + ticketWidth, y, x + ticketWidth, y + cornerSize);
          // Bottom-left
          pdf.line(x, y + ticketHeight - cornerSize, x, y + ticketHeight);
          pdf.line(x, y + ticketHeight, x + cornerSize, y + ticketHeight);
          // Bottom-right
          pdf.line(x + ticketWidth - cornerSize, y + ticketHeight, x + ticketWidth, y + ticketHeight);
          pdf.line(x + ticketWidth, y + ticketHeight - cornerSize, x + ticketWidth, y + ticketHeight);
          
          let currentY = y + 4;
          
          // Logo - mantener aspect ratio
          if (logoBase64) {
            const maxLogoHeight = ticketHeight * 0.30;
            const maxLogoWidth = ticketWidth * 0.80;
            
            let logoWidth = maxLogoWidth;
            let logoHeight = logoWidth / logoAspectRatio;
            
            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * logoAspectRatio;
            }
            
            pdf.addImage(logoBase64, 'PNG', x + (ticketWidth - logoWidth) / 2, currentY, logoWidth, logoHeight);
            currentY += logoHeight + 5;
          }
          
          // Imagen personalizada
          if (customImageBase64) {
            const imageBarWidth = ticketWidth - 6;
            const imageBarX = x + 3;
            const imageBarHeight = 15; // Altura fija como en la vista previa
            
            // Fondo amarillo
            pdf.setFillColor(251, 191, 36); // #fbbf24
            pdf.rect(imageBarX, currentY, imageBarWidth, imageBarHeight, 'F');
            
            // Imagen - simular object-fit: cover con clipping
            try {
              // Calcular dimensiones para cubrir el área (object-fit: cover)
              let imgWidth = imageBarWidth;
              let imgHeight = imgWidth / customImageAspectRatio;
              
              // Si la altura es menor que el contenedor, ajustar por altura
              if (imgHeight < imageBarHeight) {
                imgHeight = imageBarHeight;
                imgWidth = imgHeight * customImageAspectRatio;
              }
              
              // Aplicar object-position (centrar la imagen según los controles)
              const offsetX = (imagePositionX / 100) * (imageBarWidth - imgWidth);
              const offsetY = (imagePositionY / 100) * (imageBarHeight - imgHeight);
              
              // Crear un canvas temporal para recortar la imagen
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // Establecer el tamaño del canvas al tamaño del contenedor
                const scale = 4; // Escala para mejor calidad
                canvas.width = imageBarWidth * scale;
                canvas.height = imageBarHeight * scale;
                
                // Crear imagen temporal
                const tempImg = new Image();
                tempImg.src = customImageBase64;
                
                await new Promise<void>((resolve) => {
                  tempImg.onload = () => {
                    // Dibujar la imagen recortada en el canvas
                    ctx.drawImage(
                      tempImg,
                      -offsetX * scale,
                      -offsetY * scale,
                      imgWidth * scale,
                      imgHeight * scale
                    );
                    
                    // Convertir el canvas a base64
                    const croppedImage = canvas.toDataURL('image/png');
                    
                    // Agregar la imagen recortada al PDF
                    pdf.addImage(croppedImage, 'PNG', imageBarX, currentY, imageBarWidth, imageBarHeight);
                    resolve();
                  };
                  tempImg.onerror = () => {
                    console.error('Error loading image for cropping');
                    resolve();
                  };
                });
              }
            } catch (e) {
              console.error('Error adding custom image to PDF:', e);
            }
            
            currentY += imageBarHeight + 4;
          }
          
          // Texto del ticket
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 41, 59); // #1e293b
          const textLines = pdf.splitTextToSize(ticketText, ticketWidth - 10);
          pdf.text(textLines, x + ticketWidth / 2, currentY, { align: 'center' });
          currentY += textLines.length * 4 + 8;
          
          // Número del ticket
          pdf.setDrawColor(203, 213, 225); // #cbd5e1
          pdf.setLineWidth(0.25);
          const numberBoxWidth = 45;
          const numberBoxHeight = 14;
          const numberBoxX = x + (ticketWidth - numberBoxWidth) / 2;
          
          // Borde punteado - dibujar líneas discontinuas manualmente
          const dashLength = 2;
          const gapLength = 2;
          
          // Línea superior
          for (let dx = numberBoxX; dx < numberBoxX + numberBoxWidth; dx += dashLength + gapLength) {
            const endX = Math.min(dx + dashLength, numberBoxX + numberBoxWidth);
            pdf.line(dx, currentY, endX, currentY);
          }
          // Línea inferior
          for (let dx = numberBoxX; dx < numberBoxX + numberBoxWidth; dx += dashLength + gapLength) {
            const endX = Math.min(dx + dashLength, numberBoxX + numberBoxWidth);
            pdf.line(dx, currentY + numberBoxHeight, endX, currentY + numberBoxHeight);
          }
          // Línea izquierda
          for (let dy = currentY; dy < currentY + numberBoxHeight; dy += dashLength + gapLength) {
            const endY = Math.min(dy + dashLength, currentY + numberBoxHeight);
            pdf.line(numberBoxX, dy, numberBoxX, endY);
          }
          // Línea derecha
          for (let dy = currentY; dy < currentY + numberBoxHeight; dy += dashLength + gapLength) {
            const endY = Math.min(dy + dashLength, currentY + numberBoxHeight);
            pdf.line(numberBoxX + numberBoxWidth, dy, numberBoxX + numberBoxWidth, endY);
          }
          
          // Número
          pdf.setFontSize(20);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(15, 23, 42); // #0f172a
          pdf.text(`N° ${String(num).padStart(3, '0')}`, x + ticketWidth / 2, currentY + 9.5, { align: 'center' });
        }
        
        pageIndex++;
      }

      // Descargar el PDF
      pdf.save(`Tickets_${startNumber}-${endNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalTickets = endNumber - startNumber + 1;
  const totalPages = Math.ceil(totalTickets / ticketsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Dashboard */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Generador de Tickets UNHEVAL</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número Inicial
              </label>
              <input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="1"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número Final
              </label>
              <input
                type="number"
                value={endNumber}
                onChange={(e) => setEndNumber(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="6"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tickets por Página
              </label>
              <select
                value={ticketsPerPage}
                onChange={(e) => setTicketsPerPage(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value={4}>4 tickets (2x2)</option>
                <option value={6}>6 tickets (2x3)</option>
                <option value={9}>9 tickets (3x3)</option>
                <option value={8}>8 tickets (2x4)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Texto del Ticket
              </label>
              <input
                type="text"
                value={ticketText}
                onChange={(e) => setTicketText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="VALE PARA 1 REFRIGERIO"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color del Borde
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                />
                <span className="text-sm text-gray-600">{borderColor.toUpperCase()}</span>
                <button
                  type="button"
                  onClick={() => setBorderColor('#0EA5E9')}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Restablecer
                </button>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Imagen Personalizada (Opcional)
            </label>
            
            {!imagePreview && !imageUrl ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-sky-400 transition-colors cursor-pointer bg-gray-50 hover:bg-sky-50"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Arrastra una imagen aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF hasta 10MB
                  </p>
                </label>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">O ingresa una URL:</p>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
              </div>
            ) : (
              <div className="border-2 border-sky-300 rounded-xl p-4 bg-sky-50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-white border-2 border-gray-200">
                    <img
                      src={imagePreview || imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        {imageFile ? imageFile.name : 'Imagen desde URL'}
                      </p>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="p-1 hover:bg-red-100 rounded-full transition-colors"
                        title="Eliminar imagen"
                      >
                        <X className="h-5 w-5 text-red-600" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      {imageFile ? `Tamaño: ${(imageFile.size / 1024).toFixed(2)} KB` : 'Cargada desde URL'}
                    </p>
                    <label htmlFor="image-upload-replace" className="inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                        id="image-upload-replace"
                      />
                      <span className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer inline-block transition-colors">
                        Cambiar imagen
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(imagePreview || imageUrl) && (
            <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Posición de la Imagen
              </label>
              
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {/* Grid visual de posiciones - más compacto */}
                <div className="flex-shrink-0">
                  <p className="text-xs text-gray-600 mb-2">Selección rápida:</p>
                  <div className="grid grid-cols-3 gap-1.5 bg-white p-2 rounded-lg border border-gray-200">
                    {[
                      { x: 0, y: 0, label: '↖' },
                      { x: 50, y: 0, label: '↑' },
                      { x: 100, y: 0, label: '↗' },
                      { x: 0, y: 50, label: '←' },
                      { x: 50, y: 50, label: '●' },
                      { x: 100, y: 50, label: '→' },
                      { x: 0, y: 100, label: '↙' },
                      { x: 50, y: 100, label: '↓' },
                      { x: 100, y: 100, label: '↘' }
                    ].map((pos, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setImagePositionX(pos.x); setImagePositionY(pos.y); }}
                        className={`w-10 h-10 flex items-center justify-center text-base rounded transition-all ${
                          imagePositionX === pos.x && imagePositionY === pos.y
                            ? 'bg-sky-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-sky-100 hover:text-sky-600'
                        }`}
                        title={`${pos.x}%, ${pos.y}%`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Controles deslizantes - más compactos */}
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700">Horizontal</label>
                      <span className="text-xs font-semibold text-sky-600">{imagePositionX}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={imagePositionX}
                      onChange={(e) => setImagePositionX(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700">Vertical</label>
                      <span className="text-xs font-semibold text-sky-600">{imagePositionY}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={imagePositionY}
                      onChange={(e) => setImagePositionY(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Total de tickets:</span>
              <span className="font-semibold text-sky-700">{totalTickets}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-700">Páginas A4 necesarias:</span>
              <span className="font-semibold text-sky-700">{totalPages}</span>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando PDF...
              </>
            ) : (
              <>
                <Download size={20} />
                Descargar {totalTickets} Ticket{totalTickets !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Vista Previa (Primeros 6 tickets)</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: Math.min(6, totalTickets) }, (_, i) => startNumber + i).map((num) => (
              <div
                key={num}
                className="relative bg-white rounded-lg p-4 flex flex-col items-center"
                style={{ aspectRatio: '1.4', border: `4px solid ${borderColor}` }}
              >
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-4 h-4 border-l-[2.5px] border-t-[2.5px] -translate-x-[2.5px] -translate-y-[2.5px]" style={{ borderColor }} />
                <div className="absolute top-0 right-0 w-4 h-4 border-r-[2.5px] border-t-[2.5px] translate-x-[2.5px] -translate-y-[2.5px]" style={{ borderColor }} />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-l-[2.5px] border-b-[2.5px] -translate-x-[2.5px] translate-y-[2.5px]" style={{ borderColor }} />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-r-[2.5px] border-b-[2.5px] translate-x-[2.5px] translate-y-[2.5px]" style={{ borderColor }} />

                {/* Header */}
                <div className="flex justify-center items-center mb-3">
                  <img
                    src="https://cloud.unheval.edu.pe/public/imagenes/genericos/unheval.png"
                    alt="UNHEVAL Logo"
                    className="w-32 h-32 object-contain"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col items-center w-full">
                  {(imagePreview || imageUrl) && (
                    <div
                      className="w-full bg-yellow-400 overflow-hidden mb-4"
                      style={{ height: '80px' }}
                    >
                      <img
                        src={imagePreview || imageUrl}
                        alt="Custom"
                        className="w-full h-full object-cover"
                        style={{
                          objectPosition: `${imagePositionX}% ${imagePositionY}%`
                        }}
                      />
                    </div>
                  )}
                  <p className="text-lg font-semibold text-center text-gray-800 tracking-wide px-2 mb-6">
                    {ticketText}
                  </p>

                  <div className="border-2 border-dashed border-gray-300 px-8 py-3 rounded">
                    <p className="text-4xl font-bold text-gray-900 tracking-wider">
                      N° {String(num).padStart(3, '0')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
