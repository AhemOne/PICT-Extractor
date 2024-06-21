/**
 * This interpretation is based on the information which can be found at:
 *    https://developer.apple.com/library/archive/documentation/mac/pdf/ResEditReference.pdf
 * 
 * Note: when creating a MacResourceFork object it will return a Promise which will resolve the object.
 * This method was chosen because it was useful for creating a loader as most resource forks are going to be (relatively) large files which will be requested from the server on a seperate HTTP request (eg. using fetch, XMLHttpRequest, AJAX). Futhermore, to set up the static object, MacResourceFork will make a request for 'forkTmpl.json' (this file is an abstraction of the TMPL resource which is found in the ResEdit application's resource fork, and contains most of the standardised 'native' resource types Macs rely on). Such an implementation might go something like...
 * 
 *  const resourcePromises = [ 
 *    new MacResourceFork(someResourceForkData1), 
 *    new MacResourceFork(someResourceForkData2), 
 *    new MacResourceFork(someResourceForkData3), 
 *    ..., 
 *    new MacResourceFork(someResourceForkDataN)
 *  ];
 * 
 * Promise.all(resourcePromises)
 * .then(ResourceList => {
 *    // some code acting on resource forks...
 * )
 * 
 * */

class MacResourceFork {
  static #TMPLPromise = new Promise((resolve, reject) => {
    const MacTemplateJsonFilename = 'forkTmpl.json';
    const MacTemplateJsonUrl = 'source/resourcefork/' + MacTemplateJsonFilename;
    
    console.log(`MacResourceFork: collecting ${MacTemplateJsonFilename}`);
    const request = new XMLHttpRequest();
    request.onreadystatechange = () => {
      if ( request.readyState == 4 ) {
        if ( request.status == 200 ) {
          try {
            // populate standard templates
            const templates = {}
            const systemTemplates = JSON.parse(request.responseText)
            for ( let id in systemTemplates ) {
              const templateName = systemTemplates[id].Name;
              const templateList = systemTemplates[id].template;
              templates[templateName] = templateList;
            }
            console.log(`MacResourceFork: ${MacTemplateJsonFilename} was successfully loaded`)
            resolve(templates);
          } catch(e) {
            console.error(`${MacTemplateJsonFilename} contains an error, maybe try a new copy?`)
            reject(e);
          }
        } else {
          reject(new Error(`${MacTemplateJsonFilename} not found, is it in the correct location?`))
        }
      }
    }
    request.open('GET', MacTemplateJsonUrl, true);
    request.send();
  });
  
  #Resource = class extends ResourceFork {
    constructor(rawData) {
      super(new KaitaiStream(rawData));
    }
  }
  
  fillElement(type, raw, rIndex) {
    let result = {
      rOffset: 0,
      tOffset: 0,
      data: 0
    };
    
    switch ( type ) {
      case 'DLNG':
      case 'HLNG': {
        let longResult = this.fillElement('DWRD', raw, rIndex + result.rOffset);
        result.data += longResult.data * 2**16;
        result.rOffset += longResult.rOffset;
      }
      
      case 'DWRD':
      case 'HWRD':{
        let wordResult = this.fillElement('DBYT', raw, rIndex + result.rOffset);
        result.data += wordResult.data * 2**8;
        result.rOffset += wordResult.rOffset;
      }
        
      case 'DBYT':
      case 'HBYT':
        // Decimal/Hex byte
        result.data += raw[rIndex + result.rOffset];
        result.rOffset += 1;
        
        const intMax = 2**((result.rOffset * 8) - 1) - 1;
        if ( result.data > intMax ) result.data -= 2**(result.rOffset * 8);
        
        break;
      
      case 'FBYT': {
        // Fill byte (0x00)
        let fillResult = this.fillElement('DBYT', raw, rIndex + result.rOffset);
        result.data = null;
        result.rOffset += fillResult.rOffset;
        break;
      }
      
      case 'FWRD': {
        // Fill word (0x0000)
        let fillResult = this.fillElement('DWRD', raw, rIndex + result.rOffset);
        result.data = null;
        result.rOffset += fillResult.rOffset;
        break;
      }
      
      case 'FLNG': {
        // Fill long word (0x00000000)
        let fillResult = this.fillElement('DLNG', raw, rIndex + result.rOffset);
        result.data = null;
        result.rOffset += fillResult.rOffset;
        break;
      }
      
      case 'BOOL': {
        // Boolean (two bytes)
        result.data = raw[rIndex + result.rOffset] ? true : false;
        result.rOffset = 2;
        break;
      }
      
      case 'RECT': {
        result.data = [];
        for ( let index = 0; index < 4; index += 1 ) {
          result.data[index] = this.fillElement('DWRD', raw, rIndex + result.rOffset).data;
          result.rOffset += 2;
        }
        break;
      }
      
      case 'HEXD': {
        result.data = [];
        // Hex dump of remaining bytes in resource (This can only be the last type in a resource.)
        for ( ; (rIndex + result.rOffset) < raw.length; result.rOffset += 1 ) {
          result.data[result.rOffset] = raw[rIndex + result.rOffset];
        }
        break;
      }
      
      case 'ALNG':
      case 'AWRD':
        throw (`${type} not implemented.`);
      
      case 'TNAM': {
        result.data = '';
        const startIndex = rIndex + result.rOffset;
        const endIndex = startIndex + 4;
        const chunk = raw.slice(startIndex, endIndex);

        chunk.forEach(c=>result.data += String.fromCharCode(c));
        result.rOffset += 4;
        
        break;
      }
      
      default:
        // type is either string or unknown
        // if its a string, we need quirks set to utf8
        const quirks = new MacQuirks();
        quirks.encoding = 'long';
        
        switch ( type ) {
          case 'LSTR':
          case 'WSTR':
            throw (`${state.type} not implemented.`);
            
          case 'PSTR': {
            result.count = raw[rIndex + result.rOffset];
            let startIndex = rIndex + result.rOffset + 1;
            const endIndex = startIndex + result.count;
            const chunk = raw.slice(startIndex, endIndex);

            result.data = quirks.bytesToText(chunk);
            result.rOffset = result.count + 1;
            break;
          }
          
          case 'CSTR': {
            let index = 0;
            const startIndex = rIndex + result.rOffset;
            while ( raw[startIndex + index] ) index += 1;
            const endIndex = startIndex + index;
            result.data = quirks.bytesToText(raw.slice(startIndex, endIndex));
            result.rOffset += index;
            break;
          }
          
          case 'OCST':
          case 'ECST':
          case 'ESTR':
          case 'OSTR':
            throw (`${type} not implemented.`);
            
          default:
            throw new Error(`Unknown resource type '${type}'.`);
        }
    }
    
    return result;
  }
  
  fillTemplate(template, tIndex, raw, rIndex) {
    const result = {
      tOffset: 0,
      rOffset: 0,
      data: {}
    }
    
    
    try {
      while ( tIndex + result.tOffset < template.length ) {
        const templateName = template[tIndex + result.tOffset].Label;
        const templateType = template[tIndex + result.tOffset].Type;
        result.tOffset += 1;
  
        switch ( templateType ) {
                  // list from 0 to ZCNT
          case 'ZCNT': {
            let fillResult = this.fillElement('DWRD', raw, rIndex + result.rOffset)
            result.index = 0;
            result.count = fillResult.data + 1;
            result.rOffset += fillResult.rOffset;
            break;
          }
          
          // list from 1 to OCNT
          case 'OCNT': {
            let fillResult = this.fillElement('DWRD', raw, rIndex + result.rOffset)
            result.index = 1;
            result.count = fillResult.data + 1;
            result.rOffset += fillResult.rOffset;
            break;
          }
          
          case 'LSTC': {
            let fillResult;
            result.data[templateName] = [];
            for ( ; result.index < result.count; result.index += 1 ) {
              fillResult = this.fillTemplate(template, tIndex + result.tOffset, raw, rIndex + result.rOffset);
              result.data[templateName][result.index] = fillResult.data;
              result.rOffset += fillResult.rOffset
            }
            result.tOffset += 1; // fillResult.tOffset;
            break;
          }
  
          
          case 'LSTZ': {
            let listIndex = 0;
            let fillResult;
            result.data[templateName] = [];
            while ( raw[rIndex + result.rOffset] ) {
              fillResult = this.fillTemplate(template, tIndex + result.tOffset, raw, rIndex + result.rOffset);
              result.data[templateName][listIndex++] = fillResult.data;
              result.rOffset += fillResult.rOffset
            }
            result.tOffset = fillResult.tOffset;
            break;
          }
          
          case 'LSTB': {
            let listIndex = 0;
            let fillResult;
            result.data[templateName] = [];
            while ( (rIndex + result.rOffset) < raw.length ) {
              fillResult = this.fillTemplate(template, tIndex + result.tOffset, raw, rIndex + result.rOffset);
              result.data[templateName][listIndex++] = fillResult.data;
              result.rOffset += fillResult.rOffset
            }
            result.tOffset = fillResult.tOffset;
          }
          
          case 'LSTE': {
            return result;
          }
          
          default: {
            const fillResult = this.fillElement(templateType, raw, rIndex + result.rOffset);
            result.data[templateName] = fillResult.data;
            result.rOffset += fillResult.rOffset;
          }
        }
  //      console.log(templateName,'=>',result.data[templateName])
      }
    } catch ( error ) {
      throw error;
    }
    
    return result;
  }
  
  constructor(rawData) {
    return MacResourceFork.#TMPLPromise
    .then(TMPL => {
      const quirks = new MacQuirks();
      quirks.encoding = 'short';
      
      const resource = new this.#Resource(rawData);
      
      for ( let entry of resource.resourceMap.typeListAndReferenceLists.typeList.entries ) {
        const resourceName = quirks.bytesToText(entry.type);
        
        console.log('Creating resource:', resourceName);
        this[resourceName] = [];
        
        // add template (if a standard template)
        //console.log (`${resourceName} in TMPL? ${resourceName in TMPL}`)
        if ( resourceName in TMPL ) this[resourceName].template = TMPL[resourceName]; 
        
        for ( let reference of entry.referenceList.references ) {
          let dataPoint = {}
          
          // add name
          dataPoint.Name = (typeof reference.name !== 'undefined') ? 
            quirks.bytesToText(reference.name.value) : undefined;

          // raw data
          dataPoint.raw = reference.dataBlock.data;
          
          // parse to txt (for testing purposes, this will be removed)
          dataPoint._txt = quirks.bytesToText(dataPoint.raw);
          
          // place in this
          this[resourceName][reference.id] = dataPoint;
          //console.log('-> added', reference.id, dataPoint.name === undefined ? '' : dataPoint.name);
        }
      }
      
      // check for TMPL resource
      let nextTmpl = 1000;
      if ( 'TMPL' in this ) {
        const template = this['TMPL'].template;
        
        for ( let id in this['TMPL'] ) {
          if ( isNaN(Number(id)) ) continue;
          
          const raw = this['TMPL'][id].raw
          const resourceName = this['TMPL'][id].Name;
          //console.log('filling template for', resourceName, id);
          
          const result = this.fillTemplate(template, 0, raw, 0);
          this['TMPL'][id].content = result.data['*****'];
          
          if ( resourceName in this ) {
            this[resourceName].template = this['TMPL'][id].content;
          }
          
          try {
            for ( let templateKey in TMPL ) {
              if ( templateKey === resourceName ) throw 'repeated';
            }
            
            TMPL[resourceName] = this[resourceName].template;

          } catch ( $ ) {
            console.warn(`The resource '${resourceName}' already has a standard template or a template for '${resourceName}' already been used in a previous resource fork. The new template will only applied to this resource fork.`, $);
            continue;
          }
          
          //console.log('template for', resourceName, 'is ready');
        }
      }
      
      // all known templates have been applied, parse what we can (hopefully everything)
      for ( let resourceName in this) {
        if ( resourceName === 'TMPL' ) continue;
        
        const resource = this[resourceName];
        const template = resource.template;
        
        //console.log('starting fill for', resource.Name)
        
        for ( let id in resource ) {
          if ( isNaN(Number(id)) ) continue;
          
          //console.log(`Parsing .${resourceName}[${id}]`)
          
          const raw = resource[id].raw;
          
          
          try {
            let result = this.fillTemplate(template, 0, raw, 0);
            
            resource[id].content = result.data;
          } catch (error) {
            console.warn(`${resourceName} failed to parse:`, error);
          }
          
          //console.log(`.${resourceName}[${id}].content =`, resource[id].content)
        }
      }
      
      console.log('MacResourceFork created');
      console.log('using Templates:', TMPL)
      
      return Promise.resolve(this);
    })
    .catch(error => {
      console.error(`Could not make new MacResourceFork() because an error occured:`, error);
      return Promise.reject(null);
    })
  }
}
