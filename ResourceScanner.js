/* mac fork scanner, By Jesse Falzon, 2024 */
class ResourceScanner {
  #index = 0;
  #data = [];
  
  constructor(data) {
    this.#data = data;
    this.#index = 0;
  }
  
  align(type) {
    switch (type) {
      case 2:
      case 'word':
        this.#index += this.#index %= 2;
        break;
        
      case 4:
      case 'long':
        this.#index += this.#index %= 4;
        break;
    }
  }
  
  read(type) {
    if ( this.#index >= this.#data.length ) throw "read error: no more data";
    //console.log('reading ' + type)
    switch (type) {
      case "byte":
      case "op1":
        const b = parseInt(this.#data[this.#index++]);
        //console.log('read ' + b);
        return b
      
      case 'char':
        return String.fromCharCode(this.read('byte'));
        
      case "word":
      case "integer":
      case "int":
      case "mode":
      case "rowbytes":
        return (this.read("byte") << 8) + this.read("byte");
        
      case "op2":
        if ( this.#index % 2 ) this.#index++; // realign if this.#index is odd
        return this.read('word');
        
      case "long":
        return (this.read("word") << 16) + this.read("word");
        
      case "point":
        return {
          x: this.read('word'),
          y: this.read('word')
        };
        
      case "rect":
        return {
          top: this.read("integer"),
          left: this.read("integer"),
          bottom: this.read("integer"),
          right: this.read("integer")
        };
        
      case "fixed":
        return {
          integer: this.read("integer"),
          fraction: this.read("integer")
        };
      
      case "pattern":
        return [
          this.read("integer"),
          this.read("integer"),
          this.read("integer"),
          this.read("integer")
        ];
        
      case "pixMap":
        return {
          // baseAddr: this.read("long"),
          ...this.read('bitMap'),
          ...this.read('pixMap-bitMap')
        };
      
      case "pixMap-bitMap": // rest of a pixMap
        return {
          version: this.read("int"),
          packType: this.read("int"),
          packSize: this.read("long"),
          hRes: this.read("fixed"),
          vRes: this.read("fixed"),
          pixelType: this.read("int"),
          pixelSize: this.read("int"),
          cmIndexCount: this.read("int"),
          cmpSize: this.read("int"),
          planeBytes: this.read("long"),
          pmTable: this.read("long"),
          pmReserved: this.read("long")
        }
        
      case "bitMap":
        return {
          rowBytes: this.read("int"),
          Bounds: this.read("rect")
        }
        
      case "colorTable":
        {
          var table = {
            ctSeed: this.read('long'),
            ctFlags: this.read('int'),
            ctSize: this.read('int') + 1,
            ctTable: []
          };
          
          for ( var i = 0; i < table.ctSize; i += 1 )
            table.ctTable.push(this.read('colorSpec'));
          
          return table;
        }
      
      case "colorSpec":
        return {
          value: this.read('int'),
          rgb: this.read('RGBColor')
        };
        
      case "RGBColor":
        // colours are read as words, but are bytes
        return {
          red: this.read('integer') / 256,
          green: this.read('integer') / 256,
          blue: this.read('integer') / 256
        };
      
      default:
        throw `unknown type "this.read{type}"`;
    }
  }
  
  
}
