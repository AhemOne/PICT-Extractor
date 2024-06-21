// PICT parsing class by Jesse Falzon, 2024

class PICT extends ResourceScanner {
  #version = 1; // assume version 1 on startup
  get version() { return this.#version; }
  
  #height = 0;
  get height() { return this.#height; }
  
  #width = 0;
  get width() { return this.#width; }
  
  #canvas = null;
  get canvas() { return this.#canvas; }
  
  #comments = [];
  get comments() { return this.#comments; }
  
  constructor(input, type = "raw") {
    
    // unpackBits(data) - from wikipedia page for packbits
    function unpackBits (data) {
      var output = [];
      
      for ( var i = 0; i < data.length; i += 1) {
        var hex = data.at(i);

        if (hex == 128) { } // nop
        else if (hex > 128) {
          // This is a repeated byte
          hex = 256 - hex;

          for (var j = 0; j <= hex; ++j)
            output.push(data.at(i + 1));

          i += 1;
        } else {
          // These are literal bytes
          for (var j = 0; j <= hex; ++j)
            output.push(data.at(i + j + 1));

          i += j;
        }
      }
  
      return output;
    }
    
    // QuickDraw routines act as a series of instructions
    //var PC = 0;
    
    
    if ( type == 'file' ) input = input.slice(512);
    
    super(input);

    // current operation (opcode)
    var op = null;

    switch (type) {
      case "content":
        this.header = {
          picSize: input.Size,
          picFrame: {
            top: input.Rect[0],
            left: input.Rect[1],
            bottom: input.Rect[2],
            right: input.Rect[3],
          }
        };
        break;
      
      case "file":
      case 'raw':
        this.header = {
          picSize: this.read('word'),
          picFrame: this.read('rect')
        };
        break;
    }

    // add these for now, for debugging purposes
    this.#height = this.header.picFrame.bottom - this.header.picFrame.top;
    this.#width = this.header.picFrame.right - this.header.picFrame.left;
    
    // this is where we're drawing, set it to the size of the picture
    this.#canvas = document.createElement('canvas');
    this.#canvas.setAttribute('height', this.height);
    this.#canvas.setAttribute('width', this.width);
    
    // this is the context were using to draw
    const context = this.canvas.getContext('2d');
    
    // start from top of opcodes;
    //const data = opcodes;
    //PC = 0;
    
    while (true) {
      switch (op = this.read(`op${this.version}`)) {
        case 0x0000: // NOP
          break;
          
        case 0x0001: // Clip
          this.clip = true;
          break;
          
        case 0x0002: // BkPat
          this.BkPat = [
            this.read('int'),
            this.read('int'),
            this.read('int'),
            this.read('int')
          ];
          break;
          
        case 0x000a: // FillPat
          this.fill = this.read('pattern');
          break;
          
        case 0x0011: // set version
          // v1: 
          //  0x11 version op
          //  0x01 set #version to 1.. continue reading
          //
          // v1 only reading v2:
          //  0x00 NOP
          //  0x11 version op
          //  0x02 set #version to 2
          //  0xff terminate read
          //
          // v2: should still be in v1 mode
          //  0x00 NOP
          //  0x11 version op
          //  0x02 set #version to 2
          //  0xff discard, from this point on, if in version 2, opcodes are read as 2 bytes
          this.#version = this.read('byte');
          if (this.#version > 1) this.read('byte');
          break;
        
        case 0x0090: // BitsRect
        case 0x0098: // PackBitsRect
          
          var rect = {
            type: "bitMap",
            rowBytes: 0,
            packed: false,
            map: {},
            lines: 0,
            scanlines: []
          };
          
          rect.map = this.read('bitMap');
          rect.rowBytes = rect.map.rowBytes & 0x7FFF;
          if ( rect.map.rowBytes & 0x8000 ) {
            rect.type = "pixMap";
            rect.map = {
              ...rect.map,
              ...this.read('pixMap-bitMap')
            }
          }
          
          rect.lines = 
            // this.height;
            (rect.map.Bounds.bottom - rect.map.Bounds.top);
          
          switch(rect.type) {
            case "bitMap":
              rect.bitMap = rect.map;
              rect.colorTable = {
                ctSeed: -1,
                ctFlags: 0,
                ctSize: 2,
                ctTable: [
                  // QuickDraw defines a bitMap's pixel as 0: white, 1: black
                  {     // 0: white
                    value: 0,
                    rgb: {
                      red: 255,
                      green: 255,
                      blue: 255
                    }
                  },{   // 1: black
                    value: 0,
                    rgb: {
                      red: 0,
                      green: 0,
                      blue: 0
                    }
                  }
                ]
              }; // fake colorTable for bitMap (B/W)
              rect.srcRect = this.read('rect');
              rect.dstRect = this.read('rect');
              rect.mode = this.read('word');
              
              //rect.data = data.slice(PC);
              
              if ( rect.rowBytes < 8 ) {
                // data is unpacked
                rect.size = rect.rowBytes * rect.lines;
                
                // scan all the data in and convert to 1s and 0s
                for ( var line = 0; line < rect.lines; line += 1 ) {
                  var scan = [];
                  for ( var b = 0; b < rect.rowBytes; b += 1 ) {
                    scan.push(this.read('byte'));
                  }
                  rect.scanlines.push(scan);
                }
                
              } else {
                // data is packed
                rect.packed = true;
                
                var byteCount = 0;
                const nextBC = rect.rowBytes > 250 ? 
                  () => byteCount = this.read('word') : 
                  () => byteCount = this.read('byte');
                  
                
                for ( var line = 0; line < rect.lines; line += 1 ) {
                  nextBC();
                  var scan = [];
                  for ( var b = 0; b < byteCount; b += 1 )
                    scan.push(this.read('byte'));
                  rect.scanlines.push(scan);
                }
              }
              
              break;
            case "pixMap":
              rect.pixMap = rect.map;
              rect.colorTable = this.read('colorTable');
              rect.srcRect = this.read('rect');
              rect.dstRect = this.read('rect');
              rect.mode = this.read('word');
              
              rect.size = rect.rowBytes * rect.lines;
              
              //rect.data = data.slice(PC);
              
              if ( rect.rowBytes < 8 ) {
                // data is unpacked
                
                for ( var line = 0; line < rect.lines; line += 1 ) {
                  var scan = [];
                  for ( var b = 0; b < rect.rowBytes; b += 1 )
                    scan.push(Array.from(this.read('byte')));
                  rect.scanlines.push(scan);
                }
              } else {
                rect.packed = true;
                
                var byteCount = 0;
                const nextBC = rect.rowBytes > 250 ? 
                  () => byteCount = this.read('word') : 
                  () => byteCount = this.read('byte');
                
                for ( var line = 0; line < rect.lines; line += 1 ) {
                  nextBC();
                  var scan = [];
                  for ( var b = 0; b < byteCount; b += 1 )
                    scan.push(this.read('byte'));
                  rect.scanlines.push(scan);
                }
              }
              
              break;
          }
          
          // unpack packed (if packed) line to pix
          rect.pix = [];
          if ( rect.packed ) {
            for ( var scan of rect.scanlines ) {
              var line = unpackBits(scan);
              rect.pix.push(line);
            }
          } else rect.pix = rect.scanlines;
                    
          // if bytes need to be split into smaller chunks, do so
          if ( rect.type == "bitMap" ) {
            for ( var i = 0; i < rect.pix.length; i += 1 ) {
              rect.pix[i] = rect.pix[i].map(v=>Array.from(v.toString(2).padStart(8, '0'))).flat();
            }
          } else switch ( rect.map.pixelSize ) {
            case 8: break;
            case 4:
              for ( var i = 0; i < rect.pix.length; i += 1 ) {
                rect.pix[i] = rect.pix[i].map(v=>Array.from(v.toString(16).padStart(2, '0')).map(v=>parseInt(v, 16))).flat();
              }
              break;
            case 2:
              for ( var i = 0; i < rect.pix.length; i += 1 ) {
                rect.pix[i] = rect.pix[i].map(v=>Array.from(v.toString(4).padStart(4, '0')).map(v=>parseInt(v, 4))).flat();
              }
              break;
            case 1:
              for ( var i = 0; i < rect.pix.length; i += 1 ) {
                rect.pix[i] = rect.pix[i].map(v=>Array.from(v.toString(2).padStart(8, '0')).map(v=>parseInt(v, 2))).flat();
              }
              break;
          }
          
          // here we could check if the length of each .pix line is equal to header.picFrame{width}
          console.log(rect);
          
          // save rgb values to pixelmap
          this.pixelmap = [];
          for ( var line of rect.pix ) {
            var colorLine = [];
            for ( var pixel of line ) {
              colorLine.push(rect.colorTable.ctTable[pixel].rgb);
            }
            this.pixelmap.push(colorLine);
          }
            
          // blit onto canvas
          //    This might be modified to blit by width and height, instead of bounds.
          //    Bounds might better be used to position and crop the resulting image (eg eith css)
          //    there are a number of rects read (header, map src and dst, etc...), need to work out what each means
          for ( var y = rect.map.Bounds.top; y < rect.map.Bounds.bottom; y += 1 ) {
            var line = this.pixelmap[y - rect.map.Bounds.top];
            for ( var x = rect.map.Bounds.left; x < rect.map.Bounds.right; x += 1 ) {
              var rgb = line[x - rect.map.Bounds.left];
              context.fillStyle = `rgb(${rgb.red},${rgb.green},${rgb.blue})`;
              context.fillRect(x, y, 1, 1);
            }
          }
          break;
          
        case 0x00A0: // short comment
          this.#comments.push(this.read("word"));
          break;
          
        case 0x00A1: // long comment
          {
            const kind = this.read('word');
            const comment = [];
            var length = this.read('word');
            while (length--) comment.push(this.read("byte"));
            //  if (PC%2) PC += 1;
            this.#comments.push({
              kind: kind,
              comment: comment
            });
          }
          break;
          
        case 0x00FF:
          console.log("end of PICT");
          
          this.dataURL = this.canvas.toDataURL('image/png');
          
          return this;
          
        case 0x02FF: // this is included, but should never be used - it is handled by 0x0011
          this.#version = 0x02;
          break;
        
        case 0x0C00: // header (reserved - 24 bytes)
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          this.read("word");
          break;
          
        default:
          // this error is given when unused opcodes are encountered.
          // by spec each opcode is defined but programming for each op is too much work.
          console.error(`opcode: ${op.toString(16).padStart(this.version*2, '0')} is defined but not supported`);
          return this;
      }
    }
  }
}

