# epidemic-paint

Collaborative drawer project done over a couple of days as an assignment in a recruitment process. It is very much a prototype rather than an polished product and there are some withstanding issues and some corners had to be cut due to the time contraints.  Nonetheless it works quite well.

The project is built with a nodejs backend, socket.io for client-server communication and fabric.js for client canvas handling. Data persistance is handled with SQlite.

## Installation
* Checkout/Download this repository and make sure you have `nodejs` and `npm` installed.
* `npm install` in repository root to install app and dependencies.
* If sqlite3 dependency installation fails make sure you have /usr/bin/node symlinked to /usr/bin/nodejs. This was an issue on my Ubuntu 16.04 machine.

## Usage
* `npm start` in repository root to start server. Checks environment variable 'PORT' for configuration of which port to listen to. Defaults to 3000.
* Go to your server's url and port configured (`http://localhost:3000` by default) in browser(s) and start drawing!

## Features
* Chaos drawing, any client (browser) connected to server will share the same canvas and all objects created are editable and removeable by client.
* Images can be added to canvas by drag and drop from desktop.
* Any connected client can add/move/scale/rotate/delete paths and images.
* Client specific Undo / Redo

## Known issues
* If to many actions (especially loads of stored canvases) occur more or less simultaneously and the client-server connection isn't fast enough clients might get out of sync with each other.
* Trying to select text by mouse in the canvas controls box moves box instead.
* Undo / Redo functionality currently limited to only adding and removing objects, not editing them.
