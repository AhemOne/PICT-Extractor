/**
 * EV Quirks - things to handle 'strange' Mac/EV features:
 * 
 *  bytesToText() - converts an array of bytes to a string of ASCII
 *                  old Macs used 256 chars (ASCII is 128)
 *                  set encoding to a map to remap the extended characters
 *  
 * */

class MacQuirks {
  static #MacRomanExtendedMap = {
    long: [
      'A', 'A', 'C', 'E', 'N', 'O', 'U', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e',
      'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u',
      'dag', 'deg', 'cent', 'GBP', 'sec.', '*', 'par.', 's', '(R)', '(C)', 'TM', "'", 'dia.', '!=', 'AE', 'O',
      'inf.', '+/-', '<=', '>=', 'Yen', 'u', 'd', 'Sum', 'Pi', 'pi', 'Int.', 'a', 'o', 'Ohm', 'ae', 'o',
      '?', '!', '~', 'sqrt', 'f', '~=', 'del', '<<', '>>', '...', ' ', 'A', 'A', 'O', 'OE', 'oe', 
      '--', '---', '"', '"', "'", "'", '/', 'Loz.', 'y', 'Y', '/', 'Euro', '<', '>'  , 'fi', 'fl',
      'ddag', '*', ',', ',,', '%%', 'A', 'E', 'A', 'E', 'E', 'I', 'I', 'I', 'I', 'O', 'O',
      'Apple', 'O', 'U', 'U', 'U', 'i', 'circ.', '~', 'bar', 'br.', 'dot', 'ring', 'cedil.', "''", 'ogo.', 'wed.'
    ],
    short: [
      'A', 'A', 'C', 'E', 'N', 'O', 'U', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e',
      'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u',
      ' ', ' ', ' ', ' ', ' ', ' ', ' ', 's', ' ', ' ', ' ', "'", ' ', ' ', ' ', 'O',
      ' ', ' ', ' ', ' ', ' ', 'u', 'd', ' ', ' ', ' ', ' ', 'a', 'o', ' ', ' ', 'o',
      ' ', ' ', '~', ' ', 'f', ' ', ' ', ' ', ' ', ' ', ' ', 'A', 'A', 'O', ' ', ' ', 
      '-', '-', '"', '"', "'", "'", '/', ' ', 'y', 'Y', '/', ' ', '<', '>', ' ', ' ',
      ' ', ' ', ',', ' ', ' ', 'A', 'E', 'A', 'E', 'E', 'I', 'I', 'I', 'I', 'O', 'O',
      ' ', 'O', 'U', 'U', 'U', 'i', ' ', '~', ' ', ' ', ' ', ' ', ' ', " ", ' ', ' '
    ],
    utf8: [ // update this with utf8 encoding equivalents...
      'A', 'A', 'C', 'E', 'N', 'O', 'U', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e',
      'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u',
      'dag', 'deg', 'cent', 'GBP', 'sec.', '*', 'par.', 's', '(R)', '(C)', 'TM', "'", 'dia.', '!=', 'AE', 'O',
      'inf.', '+/-', '<=', '>=', 'Yen', 'u', 'd', 'Sum', 'Pi', 'pi', 'Int.', 'a', 'o', 'Ohm', 'ae', 'o',
      '?', '!', '~', 'sqrt', 'f', '~=', 'del', '<<', '>>', '...', ' ', 'A', 'A', 'O', 'OE', 'oe', 
      '--', '---', '"', '"', "'", "'", '/', 'Loz.', 'y', 'Y', '/', 'Euro', '<', '>'  , 'fi', 'fl',
      'ddag', '*', ',', ',,', '%%', 'A', 'E', 'A', 'E', 'E', 'I', 'I', 'I', 'I', 'O', 'O',
      'Apple', 'O', 'U', 'U', 'U', 'i', 'circ.', '~', 'bar', 'br.', 'dot', 'ring', 'cedil.', "''", 'ogo.', 'wed.'
    ]
  }
  
  // arrayOrString -  "long" map (does not preserve char position)
  //                  "short" map (preserves char position, long subs are blanked)
  //      default:    "blank" map (all chars above 127 are blank/space)
  //                  ['a','b', ... 'z'] array of 127 strings mapping the upper 128 characters of mac roman to ASCII
  #extendedEncodingMap = $=>' ';
  
  set encoding(arrayOrString) {
    //console.log('MacQuirks is using map:', arrayOrString);
    
    switch ( typeof arrayOrString ) {
      case 'Array':
        // check the array is the correct length
        if ( arrayOrString.length != 128 ) 
          throw new TypeError(`Array requires 128 positions`);
        // check each array position contains a string
        for ( let content of arrayOrString ) 
          if ( typeof content !== 'String' ) 
            throw new TypeError(`Array contains ${typeof content} however must be a string`);
        
        this.#extendedEncodingMap = c => arrayOrString[c];
        break;
        
      case 'string':
        if ( arrayOrString in MacQuirks.#MacRomanExtendedMap ) {
          this.#extendedEncodingMap = c => MacQuirks.#MacRomanExtendedMap[arrayOrString][c];
        } else if ( arrayOrString === 'blank' ) {
          this.#extendedEncodingMap = c => ' ';
        } else {
          throw new SyntaxError(`no encoding profile '${arrayOrString}' known, please use 'blank', 'long' or 'short'.`);
        }
        break;
        
      default:
        throw new SyntaxError(`cannot set encoding to '${arrayOrString}' using type ${typeof arrayOrString}.`);
    } 
  }
  
  bytesToText(array) {
    let str = '';
    
    for ( let c of array) {
      str += ( c < 0x20 ) ? ' ' : ( c >= 0x80 ) ? this.#extendedEncodingMap(c - 0x80) : String.fromCharCode(c); 
    }
    
    //console.log('converted:', array, `to '${str}'`);
    
    return str;
  }
}