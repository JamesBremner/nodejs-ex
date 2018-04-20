/*
    Javascript downloaded and running in the client
*/

// global string displayed html
display = 'BOM:<br>';

// global input specifications of pulley
var json_input;

var materials;

/** Display line of BOM with expected columns
 *
 * @param name name of JSON onject that holds this
 * @param line the JSON object
 */
function bom_line_expected( name, line )
{
    // check cost is real
    if( line["cost"] < 0 )
        return;

    display += '<tr>'
    display += '<td width="100px">' + name + '</td>';
    display += '<td width="200px">' + line["description"] + '</td> ';
    display += '<td>' +line["partnumber"] + '</td>';
    display += '<td>' +line["quantity"] + '</td>';
    display += '<td>' +line["unit"] + '</td>';
    display += '<td>' +line["cost_per_unit"] + '</td>';
    display += '<td>' +line["cost"] + '</td>';
    display += '</tr>';
}

/** Recurse through the BOM hierarchy
 *
 * @param name  name of JSON onject that holds this
 * @param line  the JSON object
 */
function bom_recurse( name, line )
{
    if( "cost" in line )
    {
        // this is a leaf of the BOM hierarchy, display it
        bom_line_expected( name, line );

    }
    else
    {
        // this not a leaf, so recurse deeper
        // ensure that total line, if present, is last
        for(let key in line )
            if( key != 'total' )
                bom_recurse( key, line[key] );
        for( let key in line )
            if( key == 'total') {
                display +='<tr><td width="100px">=====</td></tr>';
                bom_recurse(key, line[key]);
            }

    }
}

/** Display top level component */
function ComponentTopDisplay( componentName, bom )
{
    // so we need to create a local copy
    Name = componentName;

    // check for end disk A
    if( Name == 'EndDiskA' ) {

        // check for identical end disks
        if (bom.total.quantity == 2) {

            // the end disks are identical
            // so rename component
            Name = 'EndDisks';
        }
    }

    // display compoenrt name as BOM tabe titla
    display += '<h1>' + Name + ':</h1>';
    display += '<table>';
    display += '<tr><th>   </th><th>Description</th><th>Part #</th><th>Quantity</th><th>Units</th>';
    display += '<th>Cost/Unit</th><th>Total Cost</th></tr>';
}

/*  display pulley total cost */

function TotalCostDisplay(  bom )
{
    for(let key in bom) {

        // skip all but total
        if( key == "total")
        {
            display += "<h2>Pulley Total cost: </h2><h1>" + bom[key].cost.toFixed(2) + "</h1>";
        }
    }
}

/** Convert JSON from server to BOM table

	@param[in] json_server  HSON returned from server
*/

function bom_to_table( json_server ) {

    display = 'BOM:<br>';

// parse JSON

server = JSON.parse( json_server );
console.log( server );

// extract BOM part

bom = server.BOM.pulley;

// display pulley total cost

    TotalCostDisplay( bom );

// loop over top level components of BOM

for(let key in bom) {

    // skip the pulley total, already displayed
    if( key == "total")
        continue;

    // display component name
    ComponentTopDisplay(
        key,
        bom[key] );

    // recurse down into the details
    bom_recurse( key, bom[key]);

    // finish table
    display += '</table>';

}

// display results in HTML id "bom"

document.getElementById("bom").innerHTML = display;

}

function bom_run() {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {

            // success.  Reformat as table display
            bom_to_table( this.responseText );
        }
        if( this.status == 200 ) {
            document.getElementById("bom").innerHTML = 'Server error: ' + this.responseText;
        }
    };
    request.open("GET", 'run' , true);
    request.send();
}

function SpecsPost()
{
    console.log('SpecsPost');
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            bom_run();
        }
    };
    request.open("GET", 'specs?jsoninput='+JSON.stringify(json_input) , true);
    request.send();
}

function MaterialsPost()
{
    console.log('MaterialsPost');
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            SpecsPost();
        }
    };
    request.open("GET", 'materials?jsoninput='+JSON.stringify(materials) , true);
    request.send();
}

/**  User has clicked RUN! button */

function runClick()
{
    MaterialsPost();
}

function bom_run_old()
{
    MaterialsPost();

	var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
	    if (request.readyState === 4) {
	        if (request.status === 200) {
	            document.body.className = 'ok';

	            // convert server response to BOM table
	            bom_to_table(request.responseText);
	        } else if (!isValid(this.response) && this.status == 0) {
	            document.body.className = 'error offline';
	            console.log("The computer appears to be offline.");
	        } else {
	            document.body.className = 'error';
	        }
	    }
	};
	request.open("GET", 'run?jsoninput='+JSON.stringify(json_input) , true);

	request.send(null);

}

function readMaterials (evt) {
    var files = evt.target.files;
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
        materials = JSON.parse(event.target.result);
        document.getElementById("bom").innerHTML = '<pre>'+JSON.stringify(materials, null,2)+'</pre>';
    }
    reader.readAsText(file)
}


   function readFile (evt) {
       var files = evt.target.files;
       var file = files[0];
       var reader = new FileReader();
       reader.onload = function(event) {
		 json_input = JSON.parse(event.target.result);
		 document.getElementById("bom").innerHTML = '<pre>'+JSON.stringify(json_input, null,2)+'</pre>';
       }
       reader.readAsText(file)
    }


document.getElementById('file').addEventListener('change', readFile, false);
document.getElementById('materials').addEventListener('change', readMaterials, false);


