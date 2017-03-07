# epidemic-paint

Collaborative drawer project.

Built with nodejs backend, socket.io for client-server communication and fabric.js for client canvas handling.

## Installation
* Checkout/Download this repository and make sure you have `nodejs` and `npm` installed.
* `npm install` in repository root to install app and dependencies.
* If sqlite3 dependency installation fails make sure you have /usr/bin/node symlinked to /usr/bin/nodejs. This was an issue on my Ubuntu 16.04 machine.

## Usage
* `npm start` in repository root to start server. Checks environment variable 'PORT' for configuration of which port to listen to. Defaults to 3000.
* Go to your server's url and port configured (`http://localhost:3000` by default) in browser(s) and start drawing!

## Features
* Chaos drawing, any client (browser) connected to server will share the same canvas.
* Images can be added to canvas by drag and drop from desktop.
* Any connected client can add/move/scale/rotate/delete paths and images.
* Undo / Redo (currently only support adding and removing objects, not editing them.).

## Limitations
* Undo / Redo is currently only supported for adding and removing objects.
