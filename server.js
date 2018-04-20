var http = require('http');
var fs = require('fs');
var url = require('url');
const { execFile, execFileSync } = require('child_process');

/** theMaterial ***************************************/

var theMaterial = {
    material  : ' ',

    findMaterial : function( number )
    {
        if( this.material[ number ] == undefined ) {
            console.log('Cannot find  material ' + number );
            return undefined;
        }
        return this.material[ number ];
    },

    /** find plate of material and sufficient thickness
     *
     * @param number  the material number, e.g PM00000050
     * @param thick    the minimum thickness required
     * @returns object with actual thickness and cost values
     *
     * return defaults to generic cost and requested thickness
     */
    findPlate : function( number, thick ) {

        // check material present
        if( this.material[ number ] == undefined ) {
            console.log('Cannot find plate material ' + number );
            return undefined;
        }
        const PM = this.material[ number ];

        // default return
        thick = parseFloat( thick );
        var ret = {
            thick : thick,
            cost : PM.cost,
            density : PM.density,
            thickCost : false };
        ret.thick = thick;

         // check for thickness-cost profile
        // if not, return generic cost
        if( PM.size == undefined )
            return ret;
        ret.thickCost = true;

        // loop over profile
        for(var i = 0; i < PM.size.length; i++) {

            // check for first thickness equal or thicker than required
            // if so, return its cost
            if( PM.size[i].t >= thick ) {
                ret.thick = PM.size[i].t;
                if( 'c' in PM.size[i] )
                    ret.cost  = PM.size[i].c;
                break;
            }
        }
        // return generic cost
        return ret
    },

    MaterialToRemoveForShellRoundness : function( thick )
    {
        for( let mat in this.material )
        {
            if( this.material[ mat ].group == 'Roll') {
                for(var i = 0; i < this.material[ mat ].out_of_roundness.length; i++) {
                    if( this.material[ mat ].out_of_roundness[i].t > thick )
                    {
                        return this.material[ mat ].out_of_roundness[i].r;
                    }
                }
            }
        }
        return 0;
    },
};

var theSpecs;

function BOMLine() {
    quantity : -1;
    cost_per_unit : -1;
    cost : -1;
    partnumber : ' ';
    description : ' ';
    unit : ' ';
}

/** theBOM ******************************************/

var theBill = {

    BOM : {
        endDiskA : {
            steel : new BOMLine(),
            total : new BOMLine(),
        }
    },

    myShellInnerDiameter : -1e10,
    myExtraEndDiskDiameter : 0,
    myEndDiskScrapFactor : 1.3225,

    costCalculate : function( line )
    {
        if( line.quantity < 0 || line.cost_per_unit < 0 )
            line.cost = -1;
        else
            line.cost = line.quantity * line.cost_per_unit;
    },

    costSum : function( line )
    {
        if( line.cost < 0 )
            return 0;
        else
            return line.cost;
    },

    endDiskBuild  : function()
    {
        plate = theMaterial.findPlate(
            theSpecs.endDiskAssembly.disk.material.itemNumber,
            parseFloat(theSpecs.endDiskAssembly.hub.innerWidth)
        );
        if( plate == undefined )
            return;
        plate_material = theMaterial.findMaterial(
            theSpecs.endDiskAssembly.disk.material.itemNumber
        );

        this.BOM.endDiskA.steel.description
            = plate_material.description + ' ( ' + plate.thick + ' ) ';
        this.BOM.endDiskA.steel.cost_per_unit = plate.cost;
        OD = parseFloat(this.myShellInnerDiameter) + this.myExtraEndDiskDiameter;
        var volume =  OD * OD * Math.PI/4.0 * plate.thick * this.myEndDiskScrapFactor;
        this.BOM.endDiskA.steel.quantity = volume * plate.density / 10.0 / 10.0 / 10.0 / 1000.0; // This is the quantity of the steel.
        this.costCalculate( this.BOM.endDiskA.steel );
        this.BOM.endDiskA.steel.partnumber = theSpecs.endDiskAssembly.disk.material.itemNumber;
        this.BOM.endDiskA.steel.unit = 'Kg';

        // assume both end disks are identical
        this.BOM.endDiskA.total.partnumber = 'endDisk';
        this.BOM.endDiskA.total.quantity = 2;
        this.BOM.endDiskA.total.unit = 'Each';
        this.BOM.endDiskA.total.cost_per_unit
            = this.costSum( this.BOM.endDiskA.steel );
        this.costCalculate( this.BOM.endDiskA.total );
    },

    selectShellPlate : function()
    {
        theSpecs.shell.thickness = parseFloat(theSpecs.shell.thickness);
        var amountToRemove = 0;
        for(var i = 0; i < 5; i++) {

            // select plate thicj enough, including amount to remove
             shellPlate = theMaterial.findPlate(
                theSpecs.shell.material.itemNumber,
                parseFloat(theSpecs.shell.thickness) + amountToRemove
            );

            amountToRemove = theMaterial.MaterialToRemoveForShellRoundness(shellPlate.thick);

            // check that material has a thickness-cost profile
            // if not, iteration will never finish
            // so just return reuired thickness and generic cose
            if( ! shellPlate.thickCost ) {
                shellPlate.thick = parseFloat(shellPlate.thick) + parseFloat(amountToRemove);

                this.myShellInnerDiameter
                    = theSpecs.shell.outerDiameter
                    - shellPlate.thick;
                return shellPlate;
            }

            // check that selected plate is thick enough
            if (theSpecs.shell.thickness + amountToRemove <= shellPlate.thick) {
                this.myShellInnerDiameter
                    = theSpecs.shell.outerDiameter
                    + amountToRemove
                    - shellPlate.thick;
                return shellPlate;
            }

            // selected plate not thick enough after amountToRemove
            // so loop around again including the amount to remove
        }
        return undefined;
    },
    calculate : function()
    {
        this.selectShellPlate();
        this.endDiskBuild();
    },
};

/** File server */
function serve_file( res, reqfile, content )
{
    fs.readFile(__dirname+reqfile, function(err, data) {
        res.writeHead(200, content );
        res.write(data);
        res.end();
       // console.log('served ' + reqfile);
    });
}

function materials( res, data )
{
    console.log('materials rcvd');

    theMaterial.material = JSON.parse( data );

    //console.log( data );
    // write to file
    fs.writeFileSync(
        __dirname + "\\materials.json",
        data,
        function(err){
            if (err)
                throw err;
        });

    res.writeHead(200, {'Content-Type': 'text/plain'} );
    res.write( 'OK' );
    res.end();
}

function specs( res, data )
{
    // ensure it is a BOM request, using uploaded materials file
    theSpecs = JSON.parse( data );
    theSpecs.clientRequest = 'BOM';
    theSpecs.companyID = "-1";
    jsoninput = JSON.stringify( theSpecs );

    res.writeHead(200, {'Content-Type': 'text/plain'} );
    res.write( 'OK' );
    res.end();
}

/**  run BOM, send JSON output to client

 @param[out] res  response to be sent to client

 */
function bom_run( res )
{
    // run the BOM calculation

     try {
        theBill.calculate();
        console.log(JSON.stringify(theBill.BOM));

        response = {
            BOM : {
                pulley : theBill.BOM
            }
        };

        res.writeHead(200, {'Content-Type': 'text/json'} );
        res.write( JSON.stringify( response ) );
        res.end();

    } catch (err) {
        console.log( err.message + err.fileName + err.lineNumber );
         res.writeHead(500, {'Content-Type': 'text/plain'} );
         res.write( err.message );
         res.end();
    }
}

/** Create server */

http.createServer(function (req, res) {

    reqfile = url.parse(req.url).pathname;
    console.log( 'req= ', reqfile );

    if( reqfile == '/bom.html' ) {

        serve_file( res, reqfile, {'Content-Type': 'text/html'} );

    } else  if( reqfile == '/bom.js' )  {

        serve_file( res, reqfile, {'Content-Type': 'text/js'} );

    } else  if( reqfile == '/materials' )  {

        materials(
            res,
            url.parse(req.url, true).query.jsoninput );

    } else  if( reqfile == '/specs' )  {

        specs(
            res,
            url.parse(req.url, true).query.jsoninput );

    } else  if( reqfile == '/run' )  {

// run BOM calculation

        bom_run( res, );

    } else {

        res.end();
        console.log('!!! ' + reqfile );
    }


}).listen(8080);
