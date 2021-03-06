(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('stream')) :
	typeof define === 'function' && define.amd ? define(['stream'], factory) :
	(global.glitch = factory(global.stream));
}(this, (function (stream) { 'use strict';

stream = 'default' in stream ? stream['default'] : stream;

var clamp = function ( value, min, max ) {
	return value < min ? min : value > max ? max : value;
};

var clone = function ( obj ) {
	var result = false;
	
	if ( typeof obj !== 'undefined' ) {
		try {
			result = JSON.parse( JSON.stringify( obj ) );
		} catch ( e ) { }
	}
	
	return result;
};

var defaultParams = {
    amount:     35,
    iterations: 20,
    quality:    30,
	seed:       25
};

var sanitizeInput = function ( params ) {
	
	params = clone( params );

	if ( typeof params !== 'object' ) {
		params = { };
	}

	Object
		.keys( defaultParams )
		.filter( function (key) { return key !== 'iterations'; } )
		.forEach( function (key) {
			if ( typeof params[key] !== 'number' || isNaN( params[key] ) ) {
				params[key] = defaultParams[key];
			} else {
				params[key] = clamp( params[key], 0, 100 );
			}
		
			params[key] = Math.round( params[key] );
		} );

	if (
		typeof params.iterations !== 'number' ||
		isNaN( params.iterations ) || params.iterations <= 0
	) {
		params.iterations = defaultParams.iterations;	
	}

	params.iterations = Math.round( params.iterations );

	return params;
};

var Canvas = require( 'canvas' );

// https://github.com/Automattic/node-canvas#imagesrcbuffer
var Image = Canvas.Image;

var fromBufferToImageData = function ( buffer ) {
	if ( buffer instanceof Buffer ) {
		var image = new Image;
		image.src = buffer;

		var canvas = new Canvas( image.width, image.height );
		var ctx = canvas.getContext( '2d' );

		ctx.drawImage( image, 0, 0, image.width, image.height );

		return ctx.getImageData( 0, 0, canvas.width, canvas.height );
	} else {
		throw new Error( "Can't work with the buffer object provided." );
		return;
	}
};

// https://github.com/Automattic/node-canvas#imagesrcbuffer
var Readable = stream.Readable;
var Image$1 = Canvas.Image;

var fromStreamToImageData = function ( stream$$1, resolve, reject ) {
	if ( stream$$1 instanceof Readable ) {
		var bufferContent = [ ];
				
		stream$$1.on( 'data', function( chunk ) {
			bufferContent.push( chunk );
		} );
		
		stream$$1.on( 'end', function() {
			try {
				var buffer = Buffer.concat( bufferContent );
				var image = new Image$1;
				image.src = buffer;

				var canvas = new Canvas( image.width, image.height );
				var ctx = canvas.getContext( '2d' );

				ctx.drawImage( image, 0, 0, canvas.width, canvas.height );

				resolve( ctx.getImageData( 0, 0, canvas.width, canvas.height ) );
			} catch ( err ) {
				reject( err );
			}
		} );

	} else {
		reject( new Error( "Can't work with the buffer object provided." ) );
	}
};

var Image$2 = Canvas.Image;

var loadBase64Image = function ( base64URL ) {
	return new Promise( function ( resolve, reject ) {
		var image = new Image$2();
		
		image.onload = function () {
			resolve( image );
		};

		image.onerror = function (err) {
			reject( err );
		};
		
		image.src = base64URL;
	} );
};

var getImageSize = function ( image ) {
	return {
		width: image.width || image.naturalWidth,
		height: image.height || image.naturalHeight
	};
};

var canvasFromImage = function ( image ) {
	var size = getImageSize( image );
	var canvas = new Canvas( size.width, size.height );
	var ctx = canvas.getContext( '2d' );
	
	ctx.drawImage( image, 0, 0, size.width, size.height );
		
	return {
		canvas: canvas,
		ctx: ctx
	};
};

var base64URLToBuffer = function ( base64URL, options, resolve, reject ) {
	loadBase64Image( base64URL )
		.then( function (image) {
			var buffer = canvasFromImage( image ).canvas.toBuffer();
			resolve( buffer );
		}, reject );
};

var base64URLToImageData = function ( base64URL, options, resolve, reject ) {
	loadBase64Image( base64URL )
		.then( function (image) {
			var size = getImageSize( image );
			var imageData = canvasFromImage( image )
				.ctx
				.getImageData( 0, 0, size.width, size.height );
			
			if ( ! imageData.width ) {
				imageData.width = size.width;
			}

			if ( ! imageData.height ) {
				imageData.height = size.height;
			}

			resolve( imageData );
		}, reject );
};

// https://github.com/Automattic/node-canvas#canvaspngstream
var base64URLToPNGStream = function ( base64URL, options, resolve, reject ) {
	loadBase64Image( base64URL )
		.then( function (image) {
			var stream$$1 = canvasFromImage( image ).canvas.pngStream();
			resolve( stream$$1 );
		}, function ( err ) {
			reject( err );
		} );
};

// https://github.com/Automattic/node-canvas#canvasjpegstream-and-canvassyncjpegstream
var base64URLToJPGStream = function ( base64URL, options, resolve, reject ) {
	options = options || { };

	var streamParams = {
		bufsize: options.bufsize || 4096,
		quality: options.quality || 75,
		progressive: options.progressive || false
	};

	loadBase64Image( base64URL )
		.then( function (image) {
			var stream$$1 = canvasFromImage( image ).canvas.jpegStream( streamParams );
			resolve( stream$$1 );
		}, reject );
};

var isImageData = function ( imageData ) {
	return (
		imageData && 
		typeof imageData.width === 'number' &&
		typeof imageData.height === 'number' &&
		imageData.data &&
		typeof imageData.data.length === 'number' &&
		typeof imageData.data === 'object'
	);
};

var imageDataToBase64 = function ( imageData, quality ) {
	return new Promise ( function ( resolve, reject ) {
		if ( isImageData( imageData ) ) {
			var canvas = new Canvas( imageData.width, imageData.height );
			var ctx = canvas.getContext( '2d' );
			ctx.putImageData( imageData, 0, 0 );

			canvas.toDataURL( 'image/jpeg', quality / 100, function ( err, base64URL ) {
					if ( err ) {
						reject( err );
					}
					
					switch ( base64URL.length % 4 ) {
						case 3:
							base64URL += '=';
							break;
						case 2:
							base64URL += '==';
							break;
						case 1:
							base64URL += '===';
							break;
					}
					
					resolve( base64URL );
				} );
		} else {
			reject( new Error( 'object is not valid imageData' ) );
		}
	} );
};

var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var base64Map = base64Chars.split( '' );
var reversedBase64Map$1 = { };

base64Map.forEach( function ( val, key ) { reversedBase64Map$1[val] = key; } );

var maps = {
	base64Map: base64Map,
	reversedBase64Map: reversedBase64Map$1
};

var reversedBase64Map = maps.reversedBase64Map;

// https://github.com/mutaphysis/smackmyglitchupjs/blob/master/glitch.html
// base64 is 2^6, byte is 2^8, every 4 base64 values create three bytes
var base64ToByteArray = function ( base64URL ) {	
	var result = [ ];
	var prev;

	for ( var i = 23, len = base64URL.length; i < len; i++ ) {
		var currrentChar = reversedBase64Map[ base64URL.charAt( i ) ];
		var digitNum = ( i - 23 ) % 4;

		switch ( digitNum ) {
			// case 0: first digit - do nothing, not enough info to work with
			case 1: // second digit
				result.push( prev << 2 | currrentChar >> 4 );
				break;
			
			case 2: // third digit
				result.push( ( prev & 0x0f ) << 4 | currrentChar >> 2 );
				break;
			
			case 3: // fourth digit
				result.push( ( prev & 3 ) << 6 | currrentChar );
				break;
		}

		prev = currrentChar;
	}

	return result;
};

// http://stackoverflow.com/a/10424014/229189

var jpgHeaderLength = function ( byteArr ) {
	var result = 417;

	for ( var i = 0, len = byteArr.length; i < len; i++ ) {
		if ( byteArr[i] === 0xFF && byteArr[i + 1] === 0xDA ) {
			result = i + 2;
			break;
		}
	}

	return result;
};

var glitchByteArray = function ( byteArray, seed, amount, iterationCount ) {
	var headerLength = jpgHeaderLength( byteArray );
	var maxIndex = byteArray.length - headerLength - 4;

	var amountPercent = amount / 100;
	var seedPercent   = seed / 100;

	for ( var iterationIndex = 0; iterationIndex < iterationCount; iterationIndex++ ) {
		var minPixelIndex = ( maxIndex / iterationCount * iterationIndex ) | 0;
		var maxPixelIndex = ( maxIndex / iterationCount * ( iterationIndex + 1 ) ) | 0;
		
		var delta = maxPixelIndex - minPixelIndex;
		var pixelIndex = ( minPixelIndex + delta * seedPercent ) | 0;

		if ( pixelIndex > maxIndex ) {
			pixelIndex = maxIndex;
		}

		var indexInByteArray = ~~( headerLength + pixelIndex );

		byteArray[indexInByteArray] = ~~( amountPercent * 256 );
	}

	return byteArray;
};

var base64Map$1 = maps.base64Map;

var byteArrayToBase64 = function ( byteArray ) {
	var result = [ 'data:image/jpeg;base64,' ];
	var byteNum;
	var previousByte;

	for ( var i = 0, len = byteArray.length; i < len; i++ ) {
		var currentByte = byteArray[i];
		byteNum = i % 3;

		switch ( byteNum ) {
			case 0: // first byte
				result.push( base64Map$1[ currentByte >> 2 ] );
				break;
			case 1: // second byte
				result.push( base64Map$1[( previousByte & 3 ) << 4 | ( currentByte >> 4 )] );
				break;
			case 2: // third byte
				result.push( base64Map$1[( previousByte & 0x0f ) << 2 | ( currentByte >> 6 )] );
				result.push( base64Map$1[currentByte & 0x3f] );
				break;
		}

		previousByte = currentByte;
	}

	if ( byteNum === 0 ) {
		result.push( base64Map$1[( previousByte & 3 ) << 4] );
		result.push( '==' );
	} else {
		if ( byteNum === 1 ) {
			result.push( base64Map$1[( previousByte & 0x0f ) << 2] );
			result.push( '=' );
		}
	}

	return result.join( '' );
};

var glitchImageData = function ( imageData, base64URL, params ) {
	if ( isImageData( imageData ) ) {
		var byteArray = base64ToByteArray( base64URL );
		var glitchedByteArray = glitchByteArray( byteArray, params.seed, params.amount, params.iterations );
		var glitchedBase64URL = byteArrayToBase64( glitchedByteArray );
		return glitchedBase64URL;
	} else {
		throw new Error( 'glitchImageData: imageData seems to be corrupt.' );
		return;
	}
};

// constructing an object that allows for a chained interface.
// for example stuff like:
// 
// glitch( params )
//     .fromBuffer( buffer )
//     .toImageData()
// 
// etc...
// 

var index = function ( params ) {
	params = sanitizeInput( params );

	var inputFn;
	var outputFn;
	
	var api = { getParams: getParams, getInput: getInput, getOutput: getOutput };
	var inputMethods = { fromBuffer: fromBuffer, fromImageData: fromImageData, fromStream: fromStream };

	var outputMethods = {
		toBuffer: toBuffer,
		toDataURL: toDataURL,
		toImageData: toImageData,
		toPNGStream: toPNGStream,
		toJPGStream: toJPGStream,
		toJPEGStream: toJPEGStream
	};

	function getParams () {
		return params;
	}

	function getInput () {
		var result = Object.assign( { }, api );

		if ( ! inputFn ) {
			Object.assign( result, inputMethods );
		}

		return result;
	}

	function getOutput () {
		var result = Object.assign( { }, api );

		if ( ! outputFn ) {
			Object.assign( result, outputMethods );
		}

		return result;
	}

	function noTransform ( x ) { return x; }

	function fromBuffer ( inputOptions ) { return setInput( fromBufferToImageData, inputOptions ); }
	function fromStream ( inputOptions ) { return setInput( fromStreamToImageData, inputOptions, true ); }
	function fromImageData ( inputOptions ) { return setInput( noTransform, inputOptions ); }

	function toBuffer ( outputOptions ) { return setOutput( base64URLToBuffer, outputOptions, true ); }
	function toDataURL ( outputOptions ) { return setOutput( noTransform, outputOptions ); }
	function toImageData ( outputOptions ) { return setOutput( base64URLToImageData, outputOptions, true ); }
	function toPNGStream ( outputOptions ) { return setOutput( base64URLToPNGStream, outputOptions, true ); }
	function toJPGStream ( outputOptions ) { return setOutput( base64URLToJPGStream, outputOptions, true ); }
	function toJPEGStream ( outputOptions ) { return setOutput( base64URLToJPGStream, outputOptions, true ); }

	function setInput ( fn, inputOptions, canResolve ) {		
		inputFn = function () {
			return new Promise( function ( resolve, reject ) {
				if ( canResolve ) {
					fn( inputOptions, resolve, reject );
				} else {
					if ( fn === noTransform ) {
						resolve( inputOptions );
					} else {
						try {
							resolve( fn( inputOptions, resolve, reject ) );
						} catch ( err ) {
							reject( err );
						}
					}
				}
			} );
		};

		if ( isReady() ) {
			return getResult();
		} else {
			return getOutput();
		}
	}

	function setOutput ( fn, outputOptions, canResolve ) {
		outputFn = function (base64URL) {
			return new Promise( function ( resolve, reject ) {
				if ( canResolve ) {
					fn( base64URL, outputOptions, resolve, reject );
				} else {
					if ( fn === noTransform ) {
						resolve( base64URL );
					} else {
						fn( base64URL, outputOptions )
							.then( resolve, reject );
					}
				}
			} );
		};

		if ( isReady() ) {
			return getResult();
		} else {
			return getInput();
		}
	}

	function isReady () {
		return inputFn && outputFn;
	}

	function getResult () {
		return new Promise( function ( resolve, reject ) {
			inputFn()
				.then( function (imageData) {
					return glitch( imageData, params );
				}, reject )
				.then( function (base64URL) {
					outputFn( base64URL )
						.then( resolve, reject );
				}, reject );
		} );
	}

	function glitch ( imageData, params ) {
		return new Promise( function ( resolve, reject ) {
			imageDataToBase64( imageData, params.quality )
				.then(  function (base64URL) {
					try {
						resolve( glitchImageData( imageData, base64URL, params ) );
					} catch ( err ) {
						reject( err );
					}
				}, reject );
		} );
	}

	return getInput();
};

return index;

})));
