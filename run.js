// By Jesse Falzon, 2024

function parse() {
	const fileref = document.getElementById('file').files[0];
	if ( fileref === undefined ) return;

	const reader = new FileReader();
	
	reader.onload = e => {
		(new MacResourceFork(e.target.result)).then(fork=>{
			console.log('fork', fork);
			if ( fork.PICT !== undefined ) {
				document.body.innerHTML += `    
					<table id='table'>
						<tr>
							<th>ID</th>
							<th>Image</th>
						</tr>
					</table>
				`;
				const progress = document.getElementById('progress');
				progress.setAttribute('max', fork.PICT.length);
				for ( var id in fork.PICT ) {
					if ( id == "template" ) continue;
					console.log('found PICT id', id);

					const picture = new PICT(fork.PICT[id].raw);
					
					const tr = document.createElement('tr');
					const tdid = document.createElement('td');
					tdid.append(id);
					tr.append(tdid);
					const tdimg = document.createElement('td');
					if ( picture.dataURL === undefined ) {
						tdimg.innerHTML = "Error loading image: feature probably not supported";
					} else {
						img = document.createElement('img');
						img.src = picture.dataURL;
						img.pict = picture;
						tdimg.append(img);
					}
					tr.append(tdimg);
					document.getElementById('table').append(tr);
					
					progress.setAttribute('value', id);
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

window.addEventListener('load', setup);
