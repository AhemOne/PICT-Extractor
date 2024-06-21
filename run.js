function parse() {
  const fileref = document.getElementById('file').files[0];
	const reader = new FileReader();
	
	reader.onload = e => {
    (new MacResourceFork(e.target.result)).then(fork=>{
      console.log('fork', fork);
      if ( fork.PICT !== undefined ) {
        for ( var id in fork.PICT ) {
          console.log('found PICT id', id);
					const picture = new PICT(fork.PICT[id].raw);
          const img = document.createElement('img');
          img.src = picture.dataURL;
          document.body.append(img);
				}
			}
		});
	}
		
	reader.readAsArrayBuffer(fileref);
}

function setup() {
  document.getElementById('loadbutton').onclick = parse;	
  console.log('loader setup complete');
}
