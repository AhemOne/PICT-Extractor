function parse() {
	const fileref = document.getElementById('file').files[0];
	const reader = new FileReader();
	
	reader.onload = e => {
		(new MacResourceFork(e.target.result)).then(fork=>{
			console.log('fork', fork);
			if ( fork.PICT !== undefined ) {
				document.body.append(`    
					<table id='table'>
	      		<tr>
	        		<th>ID</th>
	        		<th>Image</th>
	      		</tr>
	    		</table>
	    	`);
				for ( var id in fork.PICT ) {
					console.log('found PICT id', id);
					const picture = new PICT(fork.PICT[id].raw);
					const img = document.createElement('img');
					img.src = picture.dataURL;
					const tr = document.createElement('tr');
					const tdid = document.createElement('td');
					tdid.append(id);
					tr.append(tdid);
					const tdimg = document.createElement('td');
					tdimg.append(img);
					document.getElementById('table').append(tr);
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

setup();
